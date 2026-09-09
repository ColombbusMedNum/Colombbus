"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDocs, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, MagnifyingGlassIcon, ChartBarIcon, DocumentPlusIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { ActionSchema, InscriptionActionDynamique, QuestionDef } from "@/lib/dynamicActions/types";
import { chargerSchema, chargerConfiguration, inscriptionsCollection, ConfigurationChargee } from "@/lib/dynamicActions/store";

interface Apprenant extends InscriptionActionDynamique {
  Decision_Recrutement?: string;
}

// Signale les mineur·e·s avec le même jaune que les groupes ACI de l'agenda.
const estMineur = (age?: number | "") => typeof age === "number" && age < 18;

// Duplicata générique de reponses/prfe/[id]/apprenants : ne liste que les
// apprenant·e·s retenu·e·s (décision "OK") pour cette session précise. Les
// dizaines de colonnes de suivi pédagogique/administratif propres au
// parcours Tech de PRFE (Kairos, certifications PIX...) n'ont pas
// d'équivalent générique — elles sont remplacées par les colonnes CUSTOM du
// schéma de l'action (schema.questions), comme sur le tableau des réponses.
export default function ApprenantsSessionPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const router = useRouter();
  const sessionId = decodeURIComponent(id || "");

  const [schema, setSchema] = useState<ActionSchema | null>(null);
  const [config, setConfig] = useState<ConfigurationChargee | null>(null);
  const [inscriptions, setInscriptions] = useState<Apprenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [territoireSelectionne, setTerritoireSelectionne] = useState("");

  useEffect(() => {
    const charger = async () => {
      try {
        const [s, c] = await Promise.all([chargerSchema(slug), chargerConfiguration(slug)]);
        setSchema(s);
        setConfig(c);
        if (s) {
          const snap = await getDocs(query(inscriptionsCollection(slug), orderBy("createdAt", "desc")));
          setInscriptions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Apprenant)));
        }
      } catch (error) {
        console.error("Erreur lors du chargement des apprenant·e·s :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [slug]);

  const apprenantsSession = useMemo(
    () => inscriptions.filter((i) => i.Session === sessionId && i.Suivi_Recrutement && i.Decision_Recrutement === "OK").sort((a, b) => (a.Nom || "").localeCompare(b.Nom || "", "fr")),
    [inscriptions, sessionId]
  );

  const hrefEmargement = useMemo(() => {
    const noms = apprenantsSession.map((a) => `${encodeURIComponent(a.Prénom || "")}|${encodeURIComponent(a.Nom || "")}`).join(";");
    const params = new URLSearchParams({ intitule: schema?.label || "" });
    if (noms) params.set("noms", noms);
    return `/mediation/rencontres-numeriques/emargement?${params.toString()}`;
  }, [apprenantsSession, schema]);

  const territoireDeSession = useMemo(() => {
    if (!config) return "";
    const trouves = new Set<string>();
    Object.values(config.sessions).forEach((parTerritoire) => {
      Object.entries(parTerritoire).forEach(([territoire, dates]) => {
        if (dates.includes(sessionId)) trouves.add(territoire);
      });
    });
    return Array.from(trouves).join(" / ");
  }, [config, sessionId]);

  useEffect(() => {
    if (!config) return;
    if (territoireDeSession) {
      setTerritoireSelectionne(territoireDeSession.split(" / ")[0]);
    } else if (config.territoiresListe.length > 0 && !territoireSelectionne) {
      setTerritoireSelectionne(config.territoiresListe[0]);
    }
  }, [territoireDeSession, config]);

  const sessionsDuTerritoire = useMemo(() => {
    if (!config) return [];
    return Array.from(new Set(Object.values(config.sessions).flatMap((parTerritoire) => parTerritoire[territoireSelectionne] || []))).sort((a, b) => a.localeCompare(b, "fr"));
  }, [config, territoireSelectionne]);

  const changerSession = (nouvelleSession: string) => router.push(`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(nouvelleSession)}/apprenants`);

  const changerTerritoire = (nouveauTerritoire: string) => {
    setTerritoireSelectionne(nouveauTerritoire);
    if (!config) return;
    const datesDuTerritoire = Array.from(new Set(Object.values(config.sessions).flatMap((parTerritoire) => parTerritoire[nouveauTerritoire] || []))).sort((a, b) => a.localeCompare(b, "fr"));
    if (datesDuTerritoire.length > 0) changerSession(datesDuTerritoire[0]);
  };

  const statistiques = useMemo(() => {
    const sexe: Record<string, number> = { Femme: 0, Homme: 0, "Non renseigné": 0 };
    const age: Record<string, number> = { "Moins de 18 ans": 0, "18 à 25 ans": 0, "26 ans et +": 0, "Non renseigné": 0 };
    const diplome: Record<string, number> = Object.create(null);
    apprenantsSession.forEach((a) => {
      if (a.Civilité === "Mme") sexe.Femme++;
      else if (a.Civilité === "M.") sexe.Homme++;
      else sexe["Non renseigné"]++;

      const n = typeof a.Age === "number" ? a.Age : NaN;
      if (!isNaN(n) && n >= 26) age["26 ans et +"]++;
      else if (!isNaN(n) && n < 18) age["Moins de 18 ans"]++;
      else if (!isNaN(n)) age["18 à 25 ans"]++;
      else age["Non renseigné"]++;

      const niveau = a.Niveau_Etudes?.trim() || "Non renseigné";
      diplome[niveau] = (diplome[niveau] || 0) + 1;
    });
    return { sexe, age, diplome };
  }, [apprenantsSession]);

  const questionsTriees = useMemo(() => (schema ? [...schema.questions].sort((a, b) => a.etape - b.etape) : []), [schema]);

  const valeurCustom = (i: Apprenant, q: QuestionDef): string => {
    const v = i.reponses?.[q.id];
    if (v === undefined || v === null) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "boolean") return v ? "Oui" : "Non";
    return String(v);
  };

  const apprenantsFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return apprenantsSession;
    return apprenantsSession.filter((i) => `${i.Prénom || ""} ${i.Nom || ""}`.toLowerCase().includes(terme));
  }, [apprenantsSession, recherche]);

  if (loading) {
    return <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>Chargement des apprenant·e·s...</div>;
  }
  if (!schema || !config) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-center p-8 antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#EF736A]">Action introuvable</p>
        <Link href="/mediation/actions-collectives/creer-action" className="text-xs font-bold text-[#005259] underline">Retour à la liste des actions</Link>
      </div>
    );
  }

  const nbColonnes = 11 + questionsTriees.length;

  return (
    <PageGuard pageId="page_access_action_dynamique">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-[100rem] mx-auto relative z-10 space-y-6">

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]" style={{ backgroundColor: schema.accentColor }}></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Apprenant<span className="text-[#EA601F] font-semibold">·e·s</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                {schema.label} — Session : {sessionId || "—"}{territoireDeSession && ` — Territoire : ${territoireDeSession}`} — {apprenantsSession.length} apprenant{apprenantsSession.length > 1 ? "s" : ""} retenu{apprenantsSession.length > 1 ? "s" : ""} (OK)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {config.territoiresListe.length > 0 && (
              <select value={territoireSelectionne} onChange={(e) => changerTerritoire(e.target.value)} className="bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] outline-none font-medium shadow-sm">
                {config.territoiresListe.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {sessionsDuTerritoire.length > 0 && (
              <select value={sessionId} onChange={(e) => changerSession(e.target.value)} className="bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] outline-none font-medium shadow-sm max-w-[240px]">
                {!sessionsDuTerritoire.includes(sessionId) && sessionId && <option value={sessionId}>{sessionId}</option>}
                {sessionsDuTerritoire.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <Link href={`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionId)}/evolution`} className="flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white px-3.5 py-2 rounded-xl transition-colors text-xs font-bold uppercase tracking-wider shadow-sm">
              <ChartBarIcon className="w-4 h-4" /><span>Évolution</span>
            </Link>
            <Link href={hrefEmargement} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <DocumentPlusIcon className="w-4 h-4 text-[#EA601F]" /><span>Générateur d'émargement</span>
            </Link>
            <Link href={`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionId)}`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" /><span>Suivi de recrutement</span>
            </Link>
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" /><span>Accueil</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#005259] mb-2">Sexe</div>
            <div className="space-y-1">
              {Object.entries(statistiques.sexe).filter(([, n]) => n > 0).map(([label, n]) => (
                <div key={label} className="flex justify-between text-xs"><span className="text-[#404040]/70">{label}</span><span className="font-bold text-[#005259]">{n}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#005259] mb-2">Âge</div>
            <div className="space-y-1">
              {Object.entries(statistiques.age).filter(([, n]) => n > 0).map(([label, n]) => (
                <div key={label} className="flex justify-between text-xs"><span className="text-[#404040]/70">{label}</span><span className="font-bold text-[#005259]">{n}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#005259] mb-2">Diplôme</div>
            <div className="space-y-1">
              {Object.entries(statistiques.diplome).map(([label, n]) => (
                <div key={label} className="flex justify-between text-xs"><span className="text-[#404040]/70">{label}</span><span className="font-bold text-[#005259]">{n}</span></div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative group max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-[#404040]/40 group-focus-within:text-[#005259] transition-colors" />
          </div>
          <input type="text" placeholder="Rechercher par nom ou prénom..." className="w-full bg-white border border-[#404040]/15 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all shadow-sm font-medium" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>

        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-3 py-3 text-center">#</th>
                  <th className="px-3 py-3">Civilité</th>
                  <th className="px-3 py-3">Prénom</th>
                  <th className="px-3 py-3">Nom</th>
                  <th className="px-3 py-3">Âge</th>
                  <th className="px-3 py-3">Ville</th>
                  <th className="px-3 py-3">Dpt.</th>
                  <th className="px-3 py-3">QPV</th>
                  <th className="px-3 py-3">Diplôme</th>
                  <th className="px-3 py-3">Téléphone</th>
                  <th className="px-3 py-3">Email</th>
                  {questionsTriees.map((q) => <th key={q.id} className="px-3 py-3">{q.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {apprenantsFiltres.length > 0 ? (
                  apprenantsFiltres.map((i, index) => (
                    <tr key={i.id} className="hover:bg-[#F3F3F2]/60 transition-colors align-top">
                      <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{i.Civilité || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">
                        <Link href={`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionId)}/apprenants/${i.id}`} className="hover:text-[#EA601F] hover:underline transition-colors">{i.Prénom || "—"}</Link>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">
                        <Link href={`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionId)}/apprenants/${i.id}`} className="hover:text-[#EA601F] hover:underline transition-colors">{i.Nom || "—"}</Link>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {i.Age !== "" && i.Age !== undefined ? (estMineur(i.Age) ? <span className="inline-block px-2 py-0.5 rounded bg-[#F9C44E]/20 text-[#005259] border border-[#F9C44E] text-[10px] font-bold">{i.Age}</span> : i.Age) : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{i.Ville || "—"}</td>
                      <td className="px-3 py-2 text-center">{i.Territoire || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{i.QPV || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{i.Niveau_Etudes || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{i.Téléphone || "—"}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate">{i.Email || "—"}</td>
                      {questionsTriees.map((q) => (
                        <td key={q.id} className="px-3 py-2 max-w-[180px] truncate" title={valeurCustom(i, q)}>{valeurCustom(i, q) || "—"}</td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={nbColonnes} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                      🔍 Aucun·e apprenant·e retenu·e (OK) pour cette session.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
    </PageGuard>
  );
}

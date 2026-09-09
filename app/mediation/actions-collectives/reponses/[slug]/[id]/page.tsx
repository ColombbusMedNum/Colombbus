"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, MagnifyingGlassIcon, AcademicCapIcon, ChevronUpIcon, ChevronDownIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { ActionSchema, InscriptionActionDynamique, QuestionDef } from "@/lib/dynamicActions/types";
import { chargerSchema, chargerConfiguration, inscriptionsCollection, inscriptionDoc, ConfigurationChargee } from "@/lib/dynamicActions/store";

// Une préinscription affectée au suivi de recrutement d'une session — les
// champs CORE (voir lib/dynamicActions/types.ts) + les réponses CUSTOM
// (reponses{}) + un champ de décision propre au suivi de recrutement, non
// modélisé dans le schéma car identique pour toute action ("Decision_Recrutement" :
// "" | "OK" | "NOK"), équivalent générique du champ "OK_NOK" des 4 programmes historiques.
interface Inscription extends InscriptionActionDynamique {
  Decision_Recrutement?: string;
}

const inputEditClass = "w-full min-w-[140px] px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] focus:bg-white rounded-lg text-[11px] text-[#404040] outline-none font-medium transition-colors";

const classeFigee = "sticky z-10";
const ombreDerniereFigee = "shadow-[6px_0_8px_-6px_rgba(0,0,0,0.25)]";

const estMineur = (age?: number | "") => typeof age === "number" && age < 18;

const sexeDeCivilite = (civilite?: string) => (civilite === "Mme" ? "Femme" : civilite === "M." ? "Homme" : "—");

// Duplicata générique de reponses/prfe/[id], paramétré par slug (action) et
// par id de session (libellé, pas un id Firestore) : n'affiche que les
// personnes affectées à cette session précise (case "Suivi recrutement"
// cochée sur la page générale des réponses). Les colonnes CUSTOM propres à
// l'action remplacent les dizaines de colonnes de suivi codées en dur sur
// PRFE — voir schema.questions.
export default function SuiviRecrutementSessionPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const router = useRouter();
  const sessionId = decodeURIComponent(id || "");

  const [schema, setSchema] = useState<ActionSchema | null>(null);
  const [config, setConfig] = useState<ConfigurationChargee | null>(null);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [onglet, setOnglet] = useState<"en_attente" | "affectes">("en_attente");
  const [triNom, setTriNom] = useState<"asc" | "desc" | null>(null);
  const basculerTriNom = () => setTriNom((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
  const [territoireSelectionne, setTerritoireSelectionne] = useState("");

  const refNum = useRef<HTMLTableCellElement>(null);
  const refCivilite = useRef<HTMLTableCellElement>(null);
  const refPrenom = useRef<HTMLTableCellElement>(null);
  const refNom = useRef<HTMLTableCellElement>(null);
  const refTelephone = useRef<HTMLTableCellElement>(null);
  const [decalages, setDecalages] = useState({ num: 0, civilite: 0, prenom: 0, nom: 0, telephone: 0 });

  useEffect(() => {
    const mesurer = () => {
      const largeurNum = refNum.current?.offsetWidth || 0;
      const largeurCivilite = refCivilite.current?.offsetWidth || 0;
      const largeurPrenom = refPrenom.current?.offsetWidth || 0;
      const largeurNom = refNom.current?.offsetWidth || 0;
      const suivant = {
        num: 0,
        civilite: largeurNum,
        prenom: largeurNum + largeurCivilite,
        nom: largeurNum + largeurCivilite + largeurPrenom,
        telephone: largeurNum + largeurCivilite + largeurPrenom + largeurNom,
      };
      setDecalages((prev) =>
        prev.civilite === suivant.civilite && prev.prenom === suivant.prenom && prev.nom === suivant.nom && prev.telephone === suivant.telephone
          ? prev
          : suivant
      );
    };
    mesurer();
    window.addEventListener("resize", mesurer);
    return () => window.removeEventListener("resize", mesurer);
  });

  const scrollHautRef = useRef<HTMLDivElement>(null);
  const scrollTableRef = useRef<HTMLDivElement>(null);
  const [largeurTable, setLargeurTable] = useState(0);
  const synchroniseEnCours = useRef(false);

  useEffect(() => {
    const mettreAJourLargeur = () => { if (scrollTableRef.current) setLargeurTable(scrollTableRef.current.scrollWidth); };
    mettreAJourLargeur();
    window.addEventListener("resize", mettreAJourLargeur);
    return () => window.removeEventListener("resize", mettreAJourLargeur);
  });
  const surScrollHaut = () => {
    if (synchroniseEnCours.current) { synchroniseEnCours.current = false; return; }
    if (scrollHautRef.current && scrollTableRef.current) { synchroniseEnCours.current = true; scrollTableRef.current.scrollLeft = scrollHautRef.current.scrollLeft; }
  };
  const surScrollTable = () => {
    if (synchroniseEnCours.current) { synchroniseEnCours.current = false; return; }
    if (scrollHautRef.current && scrollTableRef.current) { synchroniseEnCours.current = true; scrollHautRef.current.scrollLeft = scrollTableRef.current.scrollLeft; }
  };

  useEffect(() => {
    const charger = async () => {
      try {
        const [s, c] = await Promise.all([chargerSchema(slug), chargerConfiguration(slug)]);
        setSchema(s);
        setConfig(c);
        if (s) {
          const snap = await getDocs(query(inscriptionsCollection(slug), orderBy("createdAt", "desc")));
          setInscriptions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Inscription)));
        }
      } catch (error) {
        console.error("Erreur lors du chargement des inscriptions :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [slug]);

  const inscriptionsSession = useMemo(
    () => inscriptions.filter((i) => i.Session === sessionId && i.Suivi_Recrutement),
    [inscriptions, sessionId]
  );

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

  const changerSession = (nouvelleSession: string) => router.push(`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(nouvelleSession)}`);

  const changerTerritoire = (nouveauTerritoire: string) => {
    setTerritoireSelectionne(nouveauTerritoire);
    if (!config) return;
    const datesDuTerritoire = Array.from(new Set(Object.values(config.sessions).flatMap((parTerritoire) => parTerritoire[nouveauTerritoire] || []))).sort((a, b) => a.localeCompare(b, "fr"));
    if (datesDuTerritoire.length > 0) changerSession(datesDuTerritoire[0]);
  };

  const questionsTriees = useMemo(() => (schema ? [...schema.questions].sort((a, b) => a.etape - b.etape) : []), [schema]);

  const valeurCustom = (i: Inscription, q: QuestionDef): string => {
    const v = i.reponses?.[q.id];
    if (v === undefined || v === null) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "boolean") return v ? "Oui" : "Non";
    return String(v);
  };

  const inscriptionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    const resultat = inscriptionsSession.filter((i) => {
      if (onglet === "en_attente" && i.Decision_Recrutement) return false;
      if (onglet === "affectes" && !i.Decision_Recrutement) return false;
      if (terme && !`${i.Prénom || ""} ${i.Nom || ""}`.toLowerCase().includes(terme)) return false;
      return true;
    });
    if (triNom) {
      const dir = triNom === "asc" ? 1 : -1;
      return [...resultat].sort((a, b) => (a.Nom || "").localeCompare(b.Nom || "", "fr") * dir);
    }
    return resultat;
  }, [inscriptionsSession, recherche, onglet, triNom]);

  const mettreAJourChamp = async (id: string, champ: string, valeur: string) => {
    setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, [champ]: valeur } : i)));
    try {
      await updateDoc(inscriptionDoc(slug, id), { [champ]: valeur });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du champ ${champ} :`, error);
    }
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement des inscriptions...
      </div>
    );
  }

  if (!schema || !config) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-center p-8 antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#EF736A]">Action introuvable</p>
        <Link href="/mediation/actions-collectives/creer-action" className="text-xs font-bold text-[#005259] underline">Retour à la liste des actions</Link>
      </div>
    );
  }

  const nbColonnes = 5 + 10 + questionsTriees.length + 1;

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
                Préinscriptions <span className="text-[#EA601F] font-semibold">{schema.label}</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Session : {sessionId || "—"}{territoireDeSession && ` — Territoire : ${territoireDeSession}`} — {inscriptionsSession.length} inscription{inscriptionsSession.length > 1 ? "s" : ""} affectée{inscriptionsSession.length > 1 ? "s" : ""} au suivi
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
            <Link href={`/mediation/actions-collectives/reponses/${slug}`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" /><span>Réponses</span>
            </Link>
            <Link href={`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionId)}/apprenants`} className="flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white px-3.5 py-2 rounded-xl transition-colors text-xs font-bold uppercase tracking-wider shadow-sm">
              <AcademicCapIcon className="w-4 h-4" /><span>Apprenant·e·s</span>
            </Link>
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" /><span>Accueil</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="inline-flex bg-white border border-[#404040]/10 rounded-2xl p-1.5 shadow-sm w-fit">
            <button type="button" onClick={() => setOnglet("en_attente")} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${onglet === "en_attente" ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/60 hover:text-[#005259]"}`}>
              En attente ({inscriptionsSession.filter((i) => !i.Decision_Recrutement).length})
            </button>
            <button type="button" onClick={() => setOnglet("affectes")} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${onglet === "affectes" ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/60 hover:text-[#005259]"}`}>
              Affecté·e·s ({inscriptionsSession.filter((i) => i.Decision_Recrutement).length})
            </button>
          </div>
          <div className="relative group flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-[#404040]/40 group-focus-within:text-[#005259] transition-colors" />
            </div>
            <input type="text" placeholder="Rechercher par nom ou prénom..." className="w-full bg-white border border-[#404040]/15 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all shadow-sm font-medium" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
        </div>

        <div ref={scrollHautRef} onScroll={surScrollHaut} className="sticky top-0 z-30 bg-[#F3F3F2] py-1.5 overflow-x-auto overflow-y-hidden">
          <div style={{ width: largeurTable, height: 1 }}></div>
        </div>

        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <div ref={scrollTableRef} onScroll={surScrollTable} className="overflow-x-auto">
            <table className="border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th ref={refNum} className={`${classeFigee} px-3 py-3 text-center bg-[#F3F3F2]`} style={{ left: decalages.num }}>#</th>
                  <th ref={refCivilite} className={`${classeFigee} px-3 py-3 bg-[#F3F3F2]`} style={{ left: decalages.civilite }}>Civilité</th>
                  <th ref={refPrenom} className={`${classeFigee} px-3 py-3 bg-[#F3F3F2]`} style={{ left: decalages.prenom }}>Prénom</th>
                  <th ref={refNom} className={`${classeFigee} px-3 py-3 bg-[#F3F3F2]`} style={{ left: decalages.nom }}>
                    <button type="button" onClick={basculerTriNom} className="flex items-center gap-1 cursor-pointer">
                      <span>Nom</span>
                      {triNom === "asc" ? <ChevronUpIcon className="w-3 h-3" /> : triNom === "desc" ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronUpDownIcon className="w-3 h-3 opacity-30" />}
                    </button>
                  </th>
                  <th ref={refTelephone} className={`${classeFigee} ${ombreDerniereFigee} px-3 py-3 bg-[#F3F3F2]`} style={{ left: decalages.telephone }}>Téléphone</th>
                  <th className="px-3 py-3">Âge</th>
                  <th className="px-3 py-3">Sexe</th>
                  <th className="px-3 py-3">Ville</th>
                  <th className="px-3 py-3">Dpt.</th>
                  <th className="px-3 py-3">QPV</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Niveau d'études</th>
                  <th className="px-3 py-3">Parcours</th>
                  <th className="px-3 py-3">Prescripteur</th>
                  <th className="px-3 py-3">Référent·e</th>
                  {questionsTriees.map((q) => <th key={q.id} className="px-3 py-3">{q.label}</th>)}
                  <th className="px-3 py-3 text-center">Décision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {inscriptionsFiltrees.length > 0 ? (
                  inscriptionsFiltrees.map((i, index) => {
                    const referent = `${i.Conseiller_Prenom || ""} ${i.Conseiller_Nom || ""}`.trim();
                    return (
                      <tr key={i.id} className="group hover:bg-[#F3F3F2]/60 transition-colors align-top">
                        <td className={`${classeFigee} px-3 py-2 text-center text-[#404040]/50 font-bold bg-white group-hover:bg-[#F3F3F2]/60`} style={{ left: decalages.num }}>{index + 1}</td>
                        <td className={`${classeFigee} px-3 py-2 whitespace-nowrap bg-white group-hover:bg-[#F3F3F2]/60`} style={{ left: decalages.civilite }}>{i.Civilité || "—"}</td>
                        <td className={`${classeFigee} px-3 py-2 whitespace-nowrap font-bold text-[#005259] bg-white group-hover:bg-[#F3F3F2]/60`} style={{ left: decalages.prenom }}>{i.Prénom || "—"}</td>
                        <td className={`${classeFigee} px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase bg-white group-hover:bg-[#F3F3F2]/60`} style={{ left: decalages.nom }}>{i.Nom || "—"}</td>
                        <td className={`${classeFigee} ${ombreDerniereFigee} px-3 py-2 whitespace-nowrap bg-white group-hover:bg-[#F3F3F2]/60`} style={{ left: decalages.telephone }}>{i.Téléphone || "—"}</td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {i.Age !== "" && i.Age !== undefined ? (estMineur(i.Age) ? <span className="inline-block px-2 py-0.5 rounded bg-[#F9C44E]/20 text-[#005259] border border-[#F9C44E] text-[10px] font-bold">{i.Age}</span> : i.Age) : "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{sexeDeCivilite(i.Civilité)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Ville || "—"}</td>
                        <td className="px-3 py-2 text-center">{i.Territoire || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.QPV || "—"}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate">{i.Email || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Niveau_Etudes || "—"}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate" title={i.Parcours}>{i.Parcours || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={i.Structure_Accompagnement}>{i.Structure_Accompagnement || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={referent}>{referent || "—"}</td>
                        {questionsTriees.map((q) => (
                          <td key={q.id} className="px-3 py-2 max-w-[180px] truncate" title={valeurCustom(i, q)}>{valeurCustom(i, q) || "—"}</td>
                        ))}
                        <td className="px-3 py-2">
                          <select defaultValue={i.Decision_Recrutement || ""} onChange={(e) => mettreAJourChamp(i.id!, "Decision_Recrutement", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="OK">OK</option>
                            <option value="NOK">NOK</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={nbColonnes} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                      🔍 Aucune inscription trouvée.
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

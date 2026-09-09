"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getDocs, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { ActionSchema, InscriptionActionDynamique, QuestionDef } from "@/lib/dynamicActions/types";
import { chargerSchema, chargerConfiguration, inscriptionsCollection, ConfigurationChargee } from "@/lib/dynamicActions/store";

interface Apprenant extends InscriptionActionDynamique {
  Decision_Recrutement?: string;
  Evolution?: Record<string, string>;
  createdAt?: { toDate: () => Date };
}

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function tauxDe(apprenants: Apprenant[]): number | null {
  let heuresPresence = 0;
  let heuresPrevues = 0;
  const HEURES_PAR_JOUR = 3;
  apprenants.filter((a) => a.Evolution_Actif).forEach((a) => {
    Object.entries(a.Evolution || {}).forEach(([iso, valeur]) => {
      if (!valeur || valeur === "F" || valeur === "A" || valeur === "ANJ" || valeur === "AB") return;
      heuresPrevues += HEURES_PAR_JOUR;
      const retard = Math.max(0, Math.min(HEURES_PAR_JOUR, parseFloat((a.Evolution_Retards?.[iso] || "0").replace(",", ".")) || 0));
      heuresPresence += HEURES_PAR_JOUR - retard;
    });
  });
  return heuresPrevues > 0 ? Math.round((heuresPresence / heuresPrevues) * 100) : null;
}

function extraireAnnee(texte: string): number | null {
  const regex = new RegExp(`(\\d{1,2})\\s+(${MOIS_FR.join("|")})\\s+(\\d{4})`, "gi");
  const annees: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texte.toLowerCase())) !== null) annees.push(parseInt(m[3], 10));
  return annees.length > 0 ? annees[annees.length - 1] : null;
}

function anneeDe(a: Apprenant): number | null {
  return extraireAnnee(a.Session || "") ?? a.createdAt?.toDate().getFullYear() ?? null;
}

function tauxPourcent(numerateur: number, denominateur: number): number | null {
  return denominateur > 0 ? Math.round((numerateur / denominateur) * 100) : null;
}

interface Stats {
  total: number;
  sexe: Record<string, number>;
  age: Record<string, number>;
  diplome: Record<string, number>;
  qpv: Record<string, number>;
}

function calculerStats(apprenants: Apprenant[]): Stats {
  const sexe: Record<string, number> = { Femme: 0, Homme: 0, "Non renseigné": 0 };
  const age: Record<string, number> = { "Moins de 18 ans": 0, "18 à 25 ans": 0, "26 ans et +": 0, "Non renseigné": 0 };
  const diplome: Record<string, number> = Object.create(null);
  const qpv: Record<string, number> = { Oui: 0, Non: 0, "Je ne sais pas": 0, "Non renseigné": 0 };
  apprenants.forEach((a) => {
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

    const valeurQpv = a.QPV?.trim();
    qpv[valeurQpv && qpv[valeurQpv] !== undefined ? valeurQpv : "Non renseigné"]++;
  });
  return { total: apprenants.length, sexe, age, diplome, qpv };
}

function BlocStats({ titre, stats, niveauEtudesActif = true }: { titre: string; stats: Stats; niveauEtudesActif?: boolean }) {
  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest text-[#005259]">{titre}</div>
        <div className="text-xs font-bold text-[#EA601F]">{stats.total} inscription{stats.total > 1 ? "s" : ""}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 mb-1">Sexe</div>
          <div className="space-y-1">
            {Object.entries(stats.sexe).filter(([, n]) => n > 0).map(([label, n]) => (
              <div key={label} className="flex justify-between text-xs"><span className="text-[#404040]/70">{label}</span><span className="font-bold text-[#005259]">{n}</span></div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 mb-1">Âge</div>
          <div className="space-y-1">
            {Object.entries(stats.age).filter(([, n]) => n > 0).map(([label, n]) => (
              <div key={label} className="flex justify-between text-xs"><span className="text-[#404040]/70">{label}</span><span className="font-bold text-[#005259]">{n}</span></div>
            ))}
          </div>
        </div>
        {niveauEtudesActif && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 mb-1">Diplôme</div>
            <div className="space-y-1">
              {Object.entries(stats.diplome).map(([label, n]) => (
                <div key={label} className="flex justify-between text-xs"><span className="text-[#404040]/70">{label}</span><span className="font-bold text-[#005259]">{n}</span></div>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 mb-1">QPV</div>
          <div className="space-y-1">
            {Object.entries(stats.qpv).filter(([, n]) => n > 0).map(([label, n]) => (
              <div key={label} className="flex justify-between text-xs"><span className="text-[#404040]/70">{label}</span><span className="font-bold text-[#005259]">{n}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Répartition simple d'une question CUSTOM de type oui_non/select/tags_multiples
// (nombre + pourcentage par option) — voir le plan (zippy-hatching-hoare.md) :
// "un résumé simple des réponses CUSTOM (répartition par option)", pas
// d'équivalent des graphiques sur-mesure des programmes historiques.
function BlocQuestionCustom({ question, apprenants }: { question: QuestionDef; apprenants: Apprenant[] }) {
  const repartition = useMemo(() => {
    const compteurs = new Map<string, number>();
    let renseignees = 0;
    apprenants.forEach((a) => {
      const v = a.reponses?.[question.id];
      if (v === undefined || v === null || v === "") return;
      const valeurs = Array.isArray(v) ? v : typeof v === "boolean" ? [v ? "Oui" : "Non"] : [String(v)];
      if (valeurs.length === 0) return;
      renseignees++;
      valeurs.forEach((val) => compteurs.set(val, (compteurs.get(val) || 0) + 1));
    });
    return { compteurs: Array.from(compteurs.entries()).sort((a, b) => b[1] - a[1]), renseignees };
  }, [question, apprenants]);

  if (repartition.renseignees === 0) return null;

  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest text-[#005259]">{question.label}</div>
        <div className="text-[10px] font-bold text-[#404040]/50">{repartition.renseignees} réponse{repartition.renseignees > 1 ? "s" : ""}</div>
      </div>
      <div className="space-y-1.5">
        {repartition.compteurs.map(([label, n]) => {
          const pct = Math.round((n / repartition.renseignees) * 100);
          return (
            <div key={label} className="space-y-0.5">
              <div className="flex justify-between text-xs"><span className="text-[#404040]/70">{label}</span><span className="font-bold text-[#005259]">{n} ({pct}%)</span></div>
              <div className="h-1.5 bg-[#F3F3F2] rounded-full overflow-hidden">
                <div className="h-full bg-[#005259] rounded-full" style={{ width: `${pct}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Duplicata générique de reponses/prfe/statistiques, paramétré par slug —
// couvre le socle CORE (sexe, âge, niveau d'études, territoire, présence)
// exactement comme PRFE, plus une répartition générique par option pour
// chaque question CUSTOM de type oui_non/select/tags_multiples (voir
// BlocQuestionCustom ci-dessus).
export default function StatistiquesActionPage() {
  const { slug } = useParams<{ slug: string }>();
  const anneeCourante = new Date().getFullYear();
  const [schema, setSchema] = useState<ActionSchema | null>(null);
  const [config, setConfig] = useState<ConfigurationChargee | null>(null);
  const [apprenants, setApprenants] = useState<Apprenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [annee, setAnnee] = useState(anneeCourante);

  useEffect(() => {
    const charger = async () => {
      try {
        const [s, c] = await Promise.all([chargerSchema(slug), chargerConfiguration(slug)]);
        setSchema(s);
        setConfig(c);
        if (s) {
          const snap = await getDocs(query(inscriptionsCollection(slug), orderBy("createdAt", "desc")));
          setApprenants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Apprenant)));
        }
      } catch (error) {
        console.error("Erreur lors du chargement des statistiques :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [slug]);

  const preinscriptionsAnnee = useMemo(() => apprenants.filter((a) => anneeDe(a) === annee), [apprenants, annee]);
  const affectesAnnee = useMemo(() => preinscriptionsAnnee.filter((a) => a.Suivi_Recrutement), [preinscriptionsAnnee]);
  const retenusAnnee = useMemo(() => affectesAnnee.filter((a) => a.Decision_Recrutement === "OK"), [affectesAnnee]);

  const anneesDisponibles = useMemo(() => {
    const annees = new Set<number>();
    apprenants.forEach((a) => { const an = anneeDe(a); if (an) annees.add(an); });
    annees.add(anneeCourante);
    return Array.from(annees).sort((a, b) => b - a);
  }, [apprenants, anneeCourante]);

  const territoiresListe = config?.territoiresListe || [];

  const statsPreinscriptionsGlobal = useMemo(() => calculerStats(preinscriptionsAnnee), [preinscriptionsAnnee]);
  const statsPreinscriptionsParTerritoire = useMemo(
    () => territoiresListe.map((t) => ({ territoire: t, stats: calculerStats(preinscriptionsAnnee.filter((a) => a.Territoire === t)) })),
    [preinscriptionsAnnee, territoiresListe]
  );

  const funnelGlobal = useMemo(() => ({ preinscrits: preinscriptionsAnnee.length, affectes: affectesAnnee.length, retenus: retenusAnnee.length }), [preinscriptionsAnnee, affectesAnnee, retenusAnnee]);
  const funnelParTerritoire = useMemo(
    () => territoiresListe.map((t) => ({
      territoire: t,
      preinscrits: preinscriptionsAnnee.filter((a) => a.Territoire === t).length,
      affectes: affectesAnnee.filter((a) => a.Territoire === t).length,
      retenus: retenusAnnee.filter((a) => a.Territoire === t).length,
    })),
    [preinscriptionsAnnee, affectesAnnee, retenusAnnee, territoiresListe]
  );

  const statsGlobal = useMemo(() => calculerStats(retenusAnnee), [retenusAnnee]);
  const statsParTerritoire = useMemo(
    () => territoiresListe.map((t) => ({ territoire: t, stats: calculerStats(retenusAnnee.filter((a) => a.Territoire === t)) })),
    [retenusAnnee, territoiresListe]
  );

  const sessions = config?.sessions || {};
  const codes = config?.codes || {};

  const tauxParSession = useMemo(() => {
    const preinscritsParSession = new Map<string, Apprenant[]>();
    preinscriptionsAnnee.forEach((a) => {
      const session = a.Session || "Session non renseignée";
      if (!preinscritsParSession.has(session)) preinscritsParSession.set(session, []);
      preinscritsParSession.get(session)!.push(a);
    });
    const parSession = new Map<string, Apprenant[]>();
    retenusAnnee.forEach((a) => {
      const session = a.Session || "Session non renseignée";
      if (!parSession.has(session)) parSession.set(session, []);
      parSession.get(session)!.push(a);
    });
    const territoireDeSession = (date: string): string => {
      for (const [, parTerritoire] of Object.entries(sessions)) {
        for (const [territoire, dates] of Object.entries(parTerritoire)) {
          if (dates.includes(date)) return territoire;
        }
      }
      return "—";
    };
    const codeDeSessionLocal = (date: string): string => {
      for (const [parcoursId, parTerritoire] of Object.entries(sessions)) {
        for (const [territoire, dates] of Object.entries(parTerritoire)) {
          if (dates.includes(date)) return codes[`${parcoursId}|${territoire}|${date}`] || date;
        }
      }
      return date;
    };
    const estAbandonne = (a: Apprenant) => Object.values(a.Evolution || {}).includes("AB");
    return Array.from(preinscritsParSession.keys())
      .map((session) => {
        const liste = parSession.get(session) || [];
        return {
          session,
          territoire: territoireDeSession(session),
          preinscrits: preinscritsParSession.get(session)!.length,
          retenus: liste.length,
          abandons: liste.filter(estAbandonne).length,
          nombre: liste.filter((a) => a.Evolution_Actif).length,
          taux: tauxDe(liste),
        };
      })
      .sort((a, b) => codeDeSessionLocal(a.session).localeCompare(codeDeSessionLocal(b.session), "fr", { numeric: true }));
  }, [preinscriptionsAnnee, retenusAnnee, sessions, codes]);

  const tauxParTerritoire = useMemo(() => territoiresListe.map((t) => ({ territoire: t, taux: tauxDe(retenusAnnee.filter((a) => a.Territoire === t)) })), [retenusAnnee, territoiresListe]);
  const tauxGlobal = useMemo(() => tauxDe(retenusAnnee), [retenusAnnee]);

  const codeDeSession = (date: string) => {
    for (const [parcoursId, parTerritoire] of Object.entries(sessions)) {
      for (const [territoire, dates] of Object.entries(parTerritoire)) {
        if (dates.includes(date)) return codes[`${parcoursId}|${territoire}|${date}`] || date;
      }
    }
    return date;
  };

  const questionsAAfficher = useMemo(
    () => (schema ? schema.questions.filter((q) => q.type === "oui_non" || q.type === "select" || q.type === "tags_multiples").sort((a, b) => a.etape - b.etape) : []),
    [schema]
  );

  if (loading) {
    return <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>Chargement des statistiques...</div>;
  }
  if (!schema || !config) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-center p-8 antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#EF736A]">Action introuvable</p>
        <Link href="/mediation/actions-collectives/creer-action" className="text-xs font-bold text-[#005259] underline">Retour à la liste des actions</Link>
      </div>
    );
  }

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
                Statistiques <span className="text-[#EA601F] font-semibold">{schema.label}</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Toutes les inscriptions de {annee} — {preinscriptionsAnnee.length} préinscription{preinscriptionsAnnee.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <select value={annee} onChange={(e) => setAnnee(parseInt(e.target.value, 10))} className="bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] outline-none font-medium shadow-sm">
              {anneesDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <Link href={`/mediation/actions-collectives/reponses/${slug}`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" /><span>Préinscriptions</span>
            </Link>
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" /><span>Accueil</span>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4 space-y-4">
          <div className="text-xs font-bold uppercase tracking-widest text-[#005259]">Entonnoir de conversion</div>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs w-full">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-3 py-2">Territoire</th>
                  <th className="px-3 py-2 text-center">Préinscrit·e·s</th>
                  <th className="px-3 py-2 text-center">Affecté·e·s à une session</th>
                  <th className="px-3 py-2 text-center">Retenu·e·s (OK)</th>
                  <th className="px-3 py-2 text-center">Taux d'affectation</th>
                  <th className="px-3 py-2 text-center">Taux de transformation</th>
                  <th className="px-3 py-2 text-center">Taux global</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                <tr className="bg-[#005259]/5 font-bold">
                  <td className="px-3 py-2 text-[#005259]">Tous territoires confondus</td>
                  <td className="px-3 py-2 text-center">{funnelGlobal.preinscrits}</td>
                  <td className="px-3 py-2 text-center">{funnelGlobal.affectes}</td>
                  <td className="px-3 py-2 text-center">{funnelGlobal.retenus}</td>
                  <td className="px-3 py-2 text-center text-[#005259]">{tauxPourcent(funnelGlobal.affectes, funnelGlobal.preinscrits) ?? "—"}{tauxPourcent(funnelGlobal.affectes, funnelGlobal.preinscrits) !== null ? "%" : ""}</td>
                  <td className="px-3 py-2 text-center text-[#005259]">{tauxPourcent(funnelGlobal.retenus, funnelGlobal.affectes) ?? "—"}{tauxPourcent(funnelGlobal.retenus, funnelGlobal.affectes) !== null ? "%" : ""}</td>
                  <td className="px-3 py-2 text-center text-[#005259]">{tauxPourcent(funnelGlobal.retenus, funnelGlobal.preinscrits) ?? "—"}{tauxPourcent(funnelGlobal.retenus, funnelGlobal.preinscrits) !== null ? "%" : ""}</td>
                </tr>
                {funnelParTerritoire.map(({ territoire, preinscrits, affectes, retenus }) => (
                  <tr key={territoire} className="hover:bg-[#F3F3F2]/60 transition-colors">
                    <td className="px-3 py-2 font-bold text-[#005259]">Territoire {territoire}</td>
                    <td className="px-3 py-2 text-center">{preinscrits}</td>
                    <td className="px-3 py-2 text-center">{affectes}</td>
                    <td className="px-3 py-2 text-center">{retenus}</td>
                    <td className="px-3 py-2 text-center">{tauxPourcent(affectes, preinscrits) ?? "—"}{tauxPourcent(affectes, preinscrits) !== null ? "%" : ""}</td>
                    <td className="px-3 py-2 text-center">{tauxPourcent(retenus, affectes) ?? "—"}{tauxPourcent(retenus, affectes) !== null ? "%" : ""}</td>
                    <td className="px-3 py-2 text-center">{tauxPourcent(retenus, preinscrits) ?? "—"}{tauxPourcent(retenus, preinscrits) !== null ? "%" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs font-extrabold uppercase tracking-widest text-[#EA601F] pt-2">Préinscriptions (toutes)</div>
        <BlocStats titre="Tous territoires confondus" stats={statsPreinscriptionsGlobal} niveauEtudesActif={schema.niveauEtudesActif !== false} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {statsPreinscriptionsParTerritoire.map(({ territoire, stats }) => <BlocStats key={territoire} titre={`Territoire ${territoire}`} stats={stats} niveauEtudesActif={schema.niveauEtudesActif !== false} />)}
        </div>

        <div className="text-xs font-extrabold uppercase tracking-widest text-[#EA601F] pt-2">Inscrit·e·s retenu·e·s (OK)</div>
        <BlocStats titre="Tous territoires confondus" stats={statsGlobal} niveauEtudesActif={schema.niveauEtudesActif !== false} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {statsParTerritoire.map(({ territoire, stats }) => <BlocStats key={territoire} titre={`Territoire ${territoire}`} stats={stats} niveauEtudesActif={schema.niveauEtudesActif !== false} />)}
        </div>

        {questionsAAfficher.length > 0 && (
          <>
            <div className="text-xs font-extrabold uppercase tracking-widest text-[#EA601F] pt-2">Questions complémentaires (préinscriptions de l'année)</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {questionsAAfficher.map((q) => <BlocQuestionCustom key={q.id} question={q} apprenants={preinscriptionsAnnee} />)}
            </div>
          </>
        )}

        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4 space-y-4">
          <div className="text-xs font-bold uppercase tracking-widest text-[#005259]">Taux de présence</div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#F3F3F2] rounded-xl p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 mb-1">Tous territoires confondus</div>
              <div className="text-2xl font-bold text-[#005259]">{tauxGlobal !== null ? `${tauxGlobal}%` : "—"}</div>
            </div>
            {tauxParTerritoire.map(({ territoire, taux }) => (
              <div key={territoire} className="bg-[#F3F3F2] rounded-xl p-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 mb-1">Cumul territoire {territoire}</div>
                <div className="text-2xl font-bold text-[#005259]">{taux !== null ? `${taux}%` : "—"}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="border-collapse text-xs w-full">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-3 py-2">Territoire</th>
                  <th className="px-3 py-2">Session</th>
                  <th className="px-3 py-2 text-center">Préinscrit·e·s</th>
                  <th className="px-3 py-2 text-center">Retenu·e·s</th>
                  <th className="px-3 py-2 text-center">Abandons</th>
                  <th className="px-3 py-2 text-center">Apprenant·e·s actifs</th>
                  <th className="px-3 py-2 text-center">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {tauxParSession.length > 0 ? (
                  tauxParSession.map(({ session, territoire, preinscrits, retenus, abandons, nombre, taux }) => (
                    <tr key={session} className="hover:bg-[#F3F3F2]/60 transition-colors">
                      <td className="px-3 py-2 text-center font-bold text-[#005259]">{territoire}</td>
                      <td className="px-3 py-2">
                        <span className="font-bold text-[#005259]">{codeDeSession(session)}</span>
                        {codeDeSession(session) !== session && <span className="text-[#404040]/50"> — {session}</span>}
                      </td>
                      <td className="px-3 py-2 text-center">{preinscrits}</td>
                      <td className="px-3 py-2 text-center">{retenus}</td>
                      <td className="px-3 py-2 text-center">{abandons > 0 ? <span className="font-bold text-[#EF736A]">{abandons}</span> : abandons}</td>
                      <td className="px-3 py-2 text-center">{nombre}</td>
                      <td className="px-3 py-2 text-center font-bold text-[#005259]">{taux !== null ? `${taux}%` : "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                      Aucune donnée de présence pour cette année.
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

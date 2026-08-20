"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

interface Apprenant {
  id: string;
  Civilité?: string;
  Age?: string;
  Niveau_Etudes?: string;
  Territoire?: string;
  QPV?: string;
  ASE?: string;
  Session?: string;
  Suivi_Recrutement?: boolean;
  OK_NOK?: string;
  Evolution?: Record<string, string>;
  Evolution_Actif?: boolean;
  // Heures manquées en cas de grand retard, mêmes clés que Evolution — vient
  // réduire les heures/le taux de présence comptabilisés ce jour-là.
  Evolution_Retards?: Record<string, string>;
  createdAt?: { toDate: () => Date };
}

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const TERRITOIRES_DEFAUT = ["91", "92", "Autres"];
const CODES_PRESENCE = ["G", "D", "GR", "SK"];
const HEURES_PAR_JOUR = 3;

// Présence d'un·e apprenant·e sur l'ensemble des jours renseignés dans sa
// feuille Évolution, en heures — les cases Férié ou non renseignées sont
// exclues, et les heures manquées en cas de grand retard réduisent les
// heures de présence comptabilisées ce jour-là. Reprend exactement le calcul
// de la page Évolution pour rester cohérent avec elle.
function calculerPresence(a: Apprenant): { heuresPresence: number; heuresPrevues: number } {
  let heuresPresence = 0;
  let heuresPrevues = 0;
  Object.entries(a.Evolution || {}).forEach(([iso, valeur]) => {
    if (!valeur || valeur === "F") return;
    heuresPrevues += HEURES_PAR_JOUR;
    if (CODES_PRESENCE.includes(valeur)) {
      const retard = Math.max(0, Math.min(HEURES_PAR_JOUR, parseFloat((a.Evolution_Retards?.[iso] || "0").replace(",", ".")) || 0));
      heuresPresence += HEURES_PAR_JOUR - retard;
    }
  });
  return { heuresPresence, heuresPrevues };
}

function tauxDe(apprenants: Apprenant[]): number | null {
  let heuresPresence = 0;
  let heuresPrevues = 0;
  apprenants.filter((a) => a.Evolution_Actif).forEach((a) => {
    const p = calculerPresence(a);
    heuresPresence += p.heuresPresence;
    heuresPrevues += p.heuresPrevues;
  });
  return heuresPrevues > 0 ? Math.round((heuresPresence / heuresPrevues) * 100) : null;
}

// Extrait l'année de début d'une session à partir de son libellé texte libre
// (ex. "Du lundi 7 septembre au vendredi 2 octobre 2026").
function extraireAnnee(texte: string): number | null {
  const regex = new RegExp(`(\\d{1,2})\\s+(${MOIS_FR.join("|")})\\s+(\\d{4})`, "gi");
  const annees: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texte.toLowerCase())) !== null) {
    annees.push(parseInt(m[3], 10));
  }
  return annees.length > 0 ? annees[annees.length - 1] : null;
}

// Année de rattachement d'une préinscription : celle de la session choisie
// si son libellé est exploitable, sinon celle de la date de soumission — pour
// qu'une préinscription sans session encore assignée compte quand même dans
// le total de son année plutôt que de disparaître des statistiques.
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
  ase: Record<string, number>;
}

function calculerStats(apprenants: Apprenant[]): Stats {
  const sexe: Record<string, number> = { Femme: 0, Homme: 0, "Non renseigné": 0 };
  const age: Record<string, number> = { "Moins de 18 ans": 0, "18 à 25 ans": 0, "26 ans et +": 0, "Non renseigné": 0 };
  const diplome: Record<string, number> = {};
  const qpv: Record<string, number> = { Oui: 0, Non: 0, "Je ne sais pas": 0, "Non renseigné": 0 };
  const ase: Record<string, number> = { Oui: 0, Non: 0, "Non renseigné": 0 };
  apprenants.forEach((a) => {
    if (a.Civilité === "Mme") sexe.Femme++;
    else if (a.Civilité === "M.") sexe.Homme++;
    else sexe["Non renseigné"]++;

    const brut = (a.Age || "").trim();
    const nombre = parseInt(brut, 10);
    if (brut.includes("+") || (!isNaN(nombre) && nombre >= 26)) age["26 ans et +"]++;
    else if (!isNaN(nombre) && nombre < 18) age["Moins de 18 ans"]++;
    else if (!isNaN(nombre)) age["18 à 25 ans"]++;
    else age["Non renseigné"]++;

    const niveau = a.Niveau_Etudes?.trim() || "Non renseigné";
    diplome[niveau] = (diplome[niveau] || 0) + 1;

    const valeurQpv = a.QPV?.trim();
    qpv[valeurQpv && qpv[valeurQpv] !== undefined ? valeurQpv : "Non renseigné"]++;

    const valeurAse = a.ASE?.trim();
    ase[valeurAse && ase[valeurAse] !== undefined ? valeurAse : "Non renseigné"]++;
  });
  return { total: apprenants.length, sexe, age, diplome, qpv, ase };
}

function BlocStats({ titre, stats }: { titre: string; stats: Stats }) {
  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest text-[#005259]">{titre}</div>
        <div className="text-xs font-bold text-[#EA601F]">{stats.total} apprenant{stats.total > 1 ? "s" : ""}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 mb-1">Sexe</div>
          <div className="space-y-1">
            {Object.entries(stats.sexe).filter(([, n]) => n > 0).map(([label, n]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-[#404040]/70">{label}</span>
                <span className="font-bold text-[#005259]">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 mb-1">Âge</div>
          <div className="space-y-1">
            {Object.entries(stats.age).filter(([, n]) => n > 0).map(([label, n]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-[#404040]/70">{label}</span>
                <span className="font-bold text-[#005259]">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 mb-1">Diplôme</div>
          <div className="space-y-1">
            {Object.entries(stats.diplome).map(([label, n]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-[#404040]/70">{label}</span>
                <span className="font-bold text-[#005259]">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 mb-1">QPV</div>
          <div className="space-y-1">
            {Object.entries(stats.qpv).filter(([, n]) => n > 0).map(([label, n]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-[#404040]/70">{label}</span>
                <span className="font-bold text-[#005259]">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 mb-1">ASE</div>
          <div className="space-y-1">
            {Object.entries(stats.ase).filter(([, n]) => n > 0).map(([label, n]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-[#404040]/70">{label}</span>
                <span className="font-bold text-[#005259]">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Statistiques annuelles de toutes les actions Digital'UP : tous territoires
// confondus, puis détaillées par territoire.
export default function StatistiquesDigitalUpPage() {
  const anneeCourante = new Date().getFullYear();
  const [apprenants, setApprenants] = useState<Apprenant[]>([]);
  const [territoiresListe, setTerritoiresListe] = useState<string[]>(TERRITOIRES_DEFAUT);
  // sessions[parcoursId][territoire] = liste de dates de session ;
  // codes["parcoursId|territoire|date"] = code interne — reprend la
  // configuration définie sur la page paramètres, pour afficher le code
  // plutôt que la date en toutes lettres dans le tableau des taux.
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [annee, setAnnee] = useState(anneeCourante);

  useEffect(() => {
    const charger = async () => {
      try {
        const [snapInscriptions, snapTerritoires, snapSessions] = await Promise.all([
          getDocs(query(collection(db, "inscriptions_digitalup"), orderBy("createdAt", "desc"))),
          getDoc(doc(db, "configuration_digitalup", "territoires")),
          getDoc(doc(db, "configuration_digitalup", "sessions")),
        ]);
        setApprenants(snapInscriptions.docs.map((d) => ({ id: d.id, ...d.data() } as Apprenant)));
        if (snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0) {
          setTerritoiresListe(snapTerritoires.data().liste);
        }
        if (snapSessions.exists()) {
          setSessions(snapSessions.data().parTerritoire || {});
          setCodes(snapSessions.data().codes || {});
        }
      } catch (error) {
        console.error("Erreur lors du chargement des statistiques :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  // Toutes les préinscriptions (quel que soit leur statut) dont l'année de
  // rattachement correspond à l'année choisie.
  const preinscriptionsAnnee = useMemo(() => apprenants.filter((a) => anneeDe(a) === annee), [apprenants, annee]);

  // Affecté·e·s à une session, puis retenu·e·s (OK) parmi les préinscrit·e·s
  // de l'année — les deux étapes suivantes de l'entonnoir de conversion.
  const affectesAnnee = useMemo(() => preinscriptionsAnnee.filter((a) => a.Suivi_Recrutement), [preinscriptionsAnnee]);
  const retenusAnnee = useMemo(() => affectesAnnee.filter((a) => a.OK_NOK === "OK"), [affectesAnnee]);

  const anneesDisponibles = useMemo(() => {
    const annees = new Set<number>();
    apprenants.forEach((a) => {
      const an = anneeDe(a);
      if (an) annees.add(an);
    });
    annees.add(anneeCourante);
    return Array.from(annees).sort((a, b) => b - a);
  }, [apprenants, anneeCourante]);

  const statsPreinscriptionsGlobal = useMemo(() => calculerStats(preinscriptionsAnnee), [preinscriptionsAnnee]);
  const statsPreinscriptionsParTerritoire = useMemo(
    () => territoiresListe.map((t) => ({ territoire: t, stats: calculerStats(preinscriptionsAnnee.filter((a) => a.Territoire === t)) })),
    [preinscriptionsAnnee, territoiresListe]
  );

  // Entonnoir de conversion préinscrit·e·s -> affecté·e·s -> retenu·e·s (OK),
  // globalement puis par territoire, pour l'année choisie.
  const funnelGlobal = useMemo(
    () => ({ preinscrits: preinscriptionsAnnee.length, affectes: affectesAnnee.length, retenus: retenusAnnee.length }),
    [preinscriptionsAnnee, affectesAnnee, retenusAnnee]
  );
  const funnelParTerritoire = useMemo(
    () =>
      territoiresListe.map((t) => {
        const preinscrits = preinscriptionsAnnee.filter((a) => a.Territoire === t).length;
        const affectes = affectesAnnee.filter((a) => a.Territoire === t).length;
        const retenus = retenusAnnee.filter((a) => a.Territoire === t).length;
        return { territoire: t, preinscrits, affectes, retenus };
      }),
    [preinscriptionsAnnee, affectesAnnee, retenusAnnee, territoiresListe]
  );

  const statsGlobal = useMemo(() => calculerStats(retenusAnnee), [retenusAnnee]);
  const statsParTerritoire = useMemo(
    () => territoiresListe.map((t) => ({ territoire: t, stats: calculerStats(retenusAnnee.filter((a) => a.Territoire === t)) })),
    [retenusAnnee, territoiresListe]
  );

  // Taux de présence par session, puis cumulé par territoire et tous
  // territoires confondus, pour l'année choisie.
  const tauxParSession = useMemo(() => {
    // Regroupe à partir de TOUTES les préinscriptions de l'année (pas
    // seulement les retenu·e·s) pour qu'une session apparaisse même si
    // personne n'y a encore été retenu·e, et pour pouvoir afficher son
    // nombre de préinscrit·e·s à côté du nombre de retenu·e·s.
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
    // Le territoire vient de la configuration des sessions (page paramètres),
    // pas du champ Territoire déclaré par le/la premier·ère apprenant·e de la
    // liste — ce dernier peut être vide ou incohérent avec la session réelle,
    // alors que le territoire de la session elle-même est fiable à 100 %.
    const territoireDeSession = (date: string): string => {
      for (const [parcoursId, parTerritoire] of Object.entries(sessions)) {
        for (const [territoire, dates] of Object.entries(parTerritoire)) {
          if (dates.includes(date)) return territoire;
        }
      }
      return "—";
    };
    // Même logique que codeDeSession plus bas (dupliquée ici, car un const
    // défini plus loin dans le composant n'est pas encore initialisé au
    // moment où ce useMemo s'exécute) — sert à trier par code plutôt que par
    // date brute, pour un ordre "01, 02, 03..." lisible au lieu de l'ordre
    // chronologique des dates de session.
    const codeDeSessionLocal = (date: string): string => {
      for (const [parcoursId, parTerritoire] of Object.entries(sessions)) {
        for (const [territoire, dates] of Object.entries(parTerritoire)) {
          if (dates.includes(date)) return codes[`${parcoursId}|${territoire}|${date}`] || date;
        }
      }
      return date;
    };
    // Un abandon en cours de parcours se traduit par un code "AB" dans la
    // feuille Évolution — le comportement en cascade de la page Évolution
    // (voir mettreAJourCase) marque tous les jours suivants en "AB" dès que
    // l'un d'eux l'est, donc chercher au moins une occurrence suffit.
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

  const tauxParTerritoire = useMemo(
    () => territoiresListe.map((t) => ({ territoire: t, taux: tauxDe(retenusAnnee.filter((a) => a.Territoire === t)) })),
    [retenusAnnee, territoiresListe]
  );

  const tauxGlobal = useMemo(() => tauxDe(retenusAnnee), [retenusAnnee]);

  // Retrouve le code interne d'une session à partir de sa date, en cherchant
  // le parkours/territoire auquel elle appartient — retombe sur la date si
  // aucun code n'a encore été généré sur la page paramètres.
  const codeDeSession = (date: string) => {
    for (const [parcoursId, parTerritoire] of Object.entries(sessions)) {
      for (const [territoire, dates] of Object.entries(parTerritoire)) {
        if (dates.includes(date)) return codes[`${parcoursId}|${territoire}|${date}`] || date;
      }
    }
    return date;
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement des statistiques...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-[100rem] mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Statistiques <span className="text-[#EA601F] font-semibold">Digital'UP</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Toutes les actions Digital'UP de {annee} — {preinscriptionsAnnee.length} préinscription{preinscriptionsAnnee.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <select
              value={annee}
              onChange={(e) => setAnnee(parseInt(e.target.value, 10))}
              className="bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] outline-none font-medium shadow-sm"
            >
              {anneesDisponibles.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <Link
              href="/mediation/rencontres-numeriques/actions-collectives/reponses/digital-up"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Préinscriptions</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>
        </div>

        {/* ENTONNOIR DE CONVERSION */}
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

        {/* PRÉINSCRIPTIONS — toutes, quel que soit leur statut */}
        <div className="text-xs font-extrabold uppercase tracking-widest text-[#EA601F] pt-2">Préinscriptions (toutes)</div>
        <BlocStats titre="Tous territoires confondus" stats={statsPreinscriptionsGlobal} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {statsPreinscriptionsParTerritoire.map(({ territoire, stats }) => (
            <BlocStats key={territoire} titre={`Territoire ${territoire}`} stats={stats} />
          ))}
        </div>

        {/* APPRENANT·E·S RETENU·E·S (OK) */}
        <div className="text-xs font-extrabold uppercase tracking-widest text-[#EA601F] pt-2">Apprenant·e·s retenu·e·s (OK)</div>
        <BlocStats titre="Tous territoires confondus" stats={statsGlobal} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {statsParTerritoire.map(({ territoire, stats }) => (
            <BlocStats key={territoire} titre={`Territoire ${territoire}`} stats={stats} />
          ))}
        </div>

        {/* TAUX DE PRÉSENCE */}
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

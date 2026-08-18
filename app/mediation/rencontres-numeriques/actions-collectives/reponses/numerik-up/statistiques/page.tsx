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
  Session?: string;
  Suivi_Recrutement?: boolean;
  OK_NOK?: string;
  Evolution?: Record<string, string>;
  Evolution_Actif?: boolean;
}

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const TERRITOIRES_DEFAUT = ["91", "92", "Autres"];
const CODES_PRESENCE = ["G", "D", "GR", "SK"];

// Présence d'un·e apprenant·e sur l'ensemble des jours renseignés dans sa
// feuille Évolution — les cases Férié ou non renseignées sont exclues.
function calculerPresence(a: Apprenant): { numerateur: number; denominateur: number } {
  let numerateur = 0;
  let denominateur = 0;
  Object.values(a.Evolution || {}).forEach((valeur) => {
    if (!valeur || valeur === "F") return;
    denominateur++;
    if (CODES_PRESENCE.includes(valeur)) numerateur++;
  });
  return { numerateur, denominateur };
}

function tauxDe(apprenants: Apprenant[]): number | null {
  let numerateur = 0;
  let denominateur = 0;
  apprenants.filter((a) => a.Evolution_Actif).forEach((a) => {
    const p = calculerPresence(a);
    numerateur += p.numerateur;
    denominateur += p.denominateur;
  });
  return denominateur > 0 ? Math.round((numerateur / denominateur) * 100) : null;
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

interface Stats {
  total: number;
  sexe: Record<string, number>;
  age: Record<string, number>;
  diplome: Record<string, number>;
}

function calculerStats(apprenants: Apprenant[]): Stats {
  const sexe: Record<string, number> = { Femme: 0, Homme: 0, "Non renseigné": 0 };
  const age: Record<string, number> = { "Moins de 18 ans": 0, "18 à 25 ans": 0, "26 ans et +": 0, "Non renseigné": 0 };
  const diplome: Record<string, number> = {};
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
  });
  return { total: apprenants.length, sexe, age, diplome };
}

function BlocStats({ titre, stats }: { titre: string; stats: Stats }) {
  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest text-[#005259]">{titre}</div>
        <div className="text-xs font-bold text-[#EA601F]">{stats.total} apprenant{stats.total > 1 ? "s" : ""}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      </div>
    </div>
  );
}

// Statistiques annuelles de toutes les actions Numérik'UP : tous territoires
// confondus, puis détaillées par territoire.
export default function StatistiquesNumerikUpPage() {
  const anneeCourante = new Date().getFullYear();
  const [apprenants, setApprenants] = useState<Apprenant[]>([]);
  const [territoiresListe, setTerritoiresListe] = useState<string[]>(TERRITOIRES_DEFAUT);
  const [loading, setLoading] = useState(true);
  const [annee, setAnnee] = useState(anneeCourante);

  useEffect(() => {
    const charger = async () => {
      try {
        const [snapInscriptions, snapTerritoires] = await Promise.all([
          getDocs(query(collection(db, "inscriptions_numerikup"), orderBy("createdAt", "desc"))),
          getDoc(doc(db, "configuration_numerikup", "territoires")),
        ]);
        setApprenants(snapInscriptions.docs.map((d) => ({ id: d.id, ...d.data() } as Apprenant)));
        if (snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0) {
          setTerritoiresListe(snapTerritoires.data().liste);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des statistiques :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  // Apprenant·e·s retenu·e·s (OK) dont la session tombe sur l'année choisie.
  const apprenantsAnnee = useMemo(
    () => apprenants.filter((a) => a.Suivi_Recrutement && a.OK_NOK === "OK" && extraireAnnee(a.Session || "") === annee),
    [apprenants, annee]
  );

  const anneesDisponibles = useMemo(() => {
    const annees = new Set<number>();
    apprenants.forEach((a) => {
      const an = extraireAnnee(a.Session || "");
      if (an) annees.add(an);
    });
    annees.add(anneeCourante);
    return Array.from(annees).sort((a, b) => b - a);
  }, [apprenants, anneeCourante]);

  const statsGlobal = useMemo(() => calculerStats(apprenantsAnnee), [apprenantsAnnee]);
  const statsParTerritoire = useMemo(
    () => territoiresListe.map((t) => ({ territoire: t, stats: calculerStats(apprenantsAnnee.filter((a) => a.Territoire === t)) })),
    [apprenantsAnnee, territoiresListe]
  );

  // Taux de présence par session, puis cumulé par territoire et tous
  // territoires confondus, pour l'année choisie.
  const tauxParSession = useMemo(() => {
    const parSession = new Map<string, Apprenant[]>();
    apprenantsAnnee.forEach((a) => {
      const session = a.Session || "Session non renseignée";
      if (!parSession.has(session)) parSession.set(session, []);
      parSession.get(session)!.push(a);
    });
    return Array.from(parSession.entries())
      .map(([session, liste]) => ({
        session,
        territoire: liste[0]?.Territoire || "—",
        nombre: liste.filter((a) => a.Evolution_Actif).length,
        taux: tauxDe(liste),
      }))
      .sort((a, b) => a.territoire.localeCompare(b.territoire, "fr") || a.session.localeCompare(b.session, "fr"));
  }, [apprenantsAnnee]);

  const tauxParTerritoire = useMemo(
    () => territoiresListe.map((t) => ({ territoire: t, taux: tauxDe(apprenantsAnnee.filter((a) => a.Territoire === t)) })),
    [apprenantsAnnee, territoiresListe]
  );

  const tauxGlobal = useMemo(() => tauxDe(apprenantsAnnee), [apprenantsAnnee]);

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
                Statistiques <span className="text-[#EA601F] font-semibold">Numérik'UP</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Toutes les actions Numérik'UP de {annee} — apprenant·e·s retenu·e·s (OK)
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
              href="/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up"
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
                  <th className="px-3 py-2 text-center">Apprenant·e·s actifs</th>
                  <th className="px-3 py-2 text-center">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {tauxParSession.length > 0 ? (
                  tauxParSession.map(({ session, territoire, nombre, taux }) => (
                    <tr key={session} className="hover:bg-[#F3F3F2]/60 transition-colors">
                      <td className="px-3 py-2 text-center font-bold text-[#005259]">{territoire}</td>
                      <td className="px-3 py-2">{session}</td>
                      <td className="px-3 py-2 text-center">{nombre}</td>
                      <td className="px-3 py-2 text-center font-bold text-[#005259]">{taux !== null ? `${taux}%` : "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
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

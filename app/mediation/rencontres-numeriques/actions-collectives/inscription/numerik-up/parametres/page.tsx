"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, ArrowLeftIcon, PlusIcon, XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

interface Parcours {
  id: string;
  label: string;
}

const PARCOURS_DEFAUT: Parcours[] = [
  { id: "crea", label: "Numérik'Up Créa : Game Design + Graphisme" },
  { id: "tech", label: "Numérik'Up Tech : Développement Web + Maintenance informatique" },
];

const TERRITOIRES_DEFAUT = ["91", "92", "Autres"];

function slugifier(texte: string, dejaUtilises: string[]): string {
  const base = texte
    .trim().toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "parcours";
  let candidat = base;
  let compteur = 2;
  while (dejaUtilises.includes(candidat)) {
    candidat = `${base}-${compteur}`;
    compteur++;
  }
  return candidat;
}

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Les dates de session sont du texte libre (ex. "Du lundi 7 septembre au
// vendredi 2 octobre 2026") : on extrait la première occurrence "jour mois
// année" pour obtenir un ordre chronologique fiable ; à défaut, on retombe
// sur un tri alphabétique du texte brut.
function extraireDatePourTri(texte: string): number | null {
  const regex = new RegExp(`(\\d{1,2})\\s+(${MOIS_FR.join("|")})\\s+(\\d{4})`, "i");
  const correspondance = texte.toLowerCase().match(regex);
  if (!correspondance) return null;
  const jour = parseInt(correspondance[1], 10);
  const mois = MOIS_FR.indexOf(correspondance[2].toLowerCase());
  const annee = parseInt(correspondance[3], 10);
  return new Date(annee, mois, jour).getTime();
}

const inputClass = "w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] placeholder-[#404040]/40 outline-none font-medium transition-colors";
const labelClass = "block text-[11px] font-bold text-[#404040]/70 uppercase tracking-wide mb-1";

export default function ParametresNumerikUpPage() {
  const { role, loading: loadingPermissions } = usePermissions();
  const [parcoursListe, setParcoursListe] = useState<Parcours[]>(PARCOURS_DEFAUT);
  const [nouveauParcoursLabel, setNouveauParcoursLabel] = useState("");
  const [territoiresListe, setTerritoiresListe] = useState<string[]>(TERRITOIRES_DEFAUT);
  const [nouveauTerritoire, setNouveauTerritoire] = useState("");
  // sessions[parcoursId][territoire] = liste de dates de session.
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});
  const [loading, setLoading] = useState(true);

  const [nouvelleSessionParcours, setNouvelleSessionParcours] = useState("crea");
  const [nouvelleSessionTerritoire, setNouvelleSessionTerritoire] = useState("91");
  const [nouvelleSessionDate, setNouvelleSessionDate] = useState("");

  useEffect(() => {
    const charger = async () => {
      const [snapSessions, snapParcours, snapTerritoires] = await Promise.all([
        getDoc(doc(db, "configuration_numerikup", "sessions")),
        getDoc(doc(db, "configuration_numerikup", "parcours")),
        getDoc(doc(db, "configuration_numerikup", "territoires")),
      ]);
      if (snapSessions.exists()) {
        setSessions(snapSessions.data().parTerritoire || {});
      }
      if (snapParcours.exists() && Array.isArray(snapParcours.data().liste) && snapParcours.data().liste.length > 0) {
        const liste = snapParcours.data().liste;
        setParcoursListe(liste);
        setNouvelleSessionParcours(liste[0].id);
      }
      if (snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0) {
        const liste = snapTerritoires.data().liste;
        setTerritoiresListe(liste);
        setNouvelleSessionTerritoire(liste[0]);
      }
      setLoading(false);
    };
    charger();
  }, []);

  const ajouterParcours = async () => {
    const label = nouveauParcoursLabel.trim();
    if (!label) return;
    const id = slugifier(label, parcoursListe.map((p) => p.id));
    const misesAJour = [...parcoursListe, { id, label }];
    setParcoursListe(misesAJour);
    setNouveauParcoursLabel("");
    await setDoc(doc(db, "configuration_numerikup", "parcours"), { liste: misesAJour });
  };

  const supprimerParcours = async (id: string) => {
    const misesAJour = parcoursListe.filter((p) => p.id !== id);
    setParcoursListe(misesAJour);
    await setDoc(doc(db, "configuration_numerikup", "parcours"), { liste: misesAJour });
  };

  const ajouterTerritoire = async () => {
    const valeur = nouveauTerritoire.trim();
    if (!valeur || territoiresListe.includes(valeur)) return;
    const misesAJour = [...territoiresListe, valeur];
    setTerritoiresListe(misesAJour);
    setNouveauTerritoire("");
    await setDoc(doc(db, "configuration_numerikup", "territoires"), { liste: misesAJour });
  };

  const supprimerTerritoire = async (valeur: string) => {
    const misesAJour = territoiresListe.filter((t) => t !== valeur);
    setTerritoiresListe(misesAJour);
    await setDoc(doc(db, "configuration_numerikup", "territoires"), { liste: misesAJour });
  };

  const ajouterSession = async () => {
    const valeur = nouvelleSessionDate.trim();
    if (!valeur) return;
    const pourParcours = sessions[nouvelleSessionParcours] || {};
    const misesAJour = {
      ...sessions,
      [nouvelleSessionParcours]: { ...pourParcours, [nouvelleSessionTerritoire]: [...(pourParcours[nouvelleSessionTerritoire] || []), valeur] },
    };
    setSessions(misesAJour);
    setNouvelleSessionDate("");
    await setDoc(doc(db, "configuration_numerikup", "sessions"), { parTerritoire: misesAJour });
  };

  const supprimerSession = async (parcours: string, territoire: string, valeur: string) => {
    const pourParcours = sessions[parcours] || {};
    const misesAJour = {
      ...sessions,
      [parcours]: { ...pourParcours, [territoire]: (pourParcours[territoire] || []).filter((s) => s !== valeur) },
    };
    setSessions(misesAJour);
    await setDoc(doc(db, "configuration_numerikup", "sessions"), { parTerritoire: misesAJour });
  };

  // Table à plat de toutes les sessions, tous parkours/territoires
  // confondus, triée par territoire puis par date.
  const lignesSessions = parcoursListe
    .flatMap((p) =>
      territoiresListe.flatMap((t) =>
        (sessions[p.id]?.[t] || []).map((date) => ({ parcoursId: p.id, parcoursLabel: p.label, territoire: t, date }))
      )
    )
    .sort((a, b) => {
      const territoireDiff = a.territoire.localeCompare(b.territoire, "fr", { numeric: true });
      if (territoireDiff !== 0) return territoireDiff;
      const dateA = extraireDatePourTri(a.date);
      const dateB = extraireDatePourTri(b.date);
      if (dateA !== null && dateB !== null && dateA !== dateB) return dateA - dateB;
      if (dateA !== null && dateB === null) return -1;
      if (dateA === null && dateB !== null) return 1;
      return a.date.localeCompare(b.date, "fr", { numeric: true });
    });

  if (loading || loadingPermissions) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement...
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-center p-8 antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#EF736A]">Page réservée à l'administrateur</p>
        <Link
          href="/mediation/rencontres-numeriques/actions-collectives/inscription/numerik-up"
          className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
        >
          <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
          <span>Retour au formulaire</span>
        </Link>
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Gérer <span className="text-[#EA601F] font-semibold">Numérik'UP</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Parkours, territoires et sessions du formulaire d'inscription
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link
              href="/mediation/rencontres-numeriques/actions-collectives/inscription/numerik-up"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Formulaire Numérik'UP</span>
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

        {/* PARKOURS */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Parkours</h2>
          <div className="flex flex-wrap gap-1.5">
            {parcoursListe.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 bg-[#F3F3F2] border border-[#404040]/10 rounded-lg px-2.5 py-1.5 text-xs text-[#404040]">
                {p.label}
                <button type="button" onClick={() => supprimerParcours(p.id)} className="text-[#EF736A] hover:text-[#EF736A]/70 cursor-pointer">
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={nouveauParcoursLabel}
              onChange={(e) => setNouveauParcoursLabel(e.target.value)}
              placeholder="Intitulé du nouveau parkours"
              className={inputClass}
            />
            <button type="button" onClick={ajouterParcours} className="shrink-0 px-3 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl transition-colors cursor-pointer">
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TERRITOIRES */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Territoires</h2>
          <div className="flex flex-wrap gap-1.5">
            {territoiresListe.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 bg-[#F3F3F2] border border-[#404040]/10 rounded-lg px-2.5 py-1.5 text-xs text-[#404040]">
                {t}
                <button type="button" onClick={() => supprimerTerritoire(t)} className="text-[#EF736A] hover:text-[#EF736A]/70 cursor-pointer">
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={nouveauTerritoire}
              onChange={(e) => setNouveauTerritoire(e.target.value)}
              placeholder="Ex : 75, 78, Autres..."
              className={inputClass}
            />
            <button type="button" onClick={ajouterTerritoire} className="shrink-0 px-3 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl transition-colors cursor-pointer">
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SESSIONS */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Sessions ({lignesSessions.length})</h2>

          {/* Ajout d'une nouvelle session */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
            <div>
              <label className={labelClass}>Parkours</label>
              <select value={nouvelleSessionParcours} onChange={(e) => setNouvelleSessionParcours(e.target.value)} className={inputClass}>
                {parcoursListe.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Territoire</label>
              <select value={nouvelleSessionTerritoire} onChange={(e) => setNouvelleSessionTerritoire(e.target.value)} className={inputClass}>
                {territoiresListe.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <div className="flex-1">
                <label className={labelClass}>Date de session</label>
                <input
                  type="text"
                  value={nouvelleSessionDate}
                  onChange={(e) => setNouvelleSessionDate(e.target.value)}
                  placeholder="Ex : Du lundi 7 septembre au vendredi 2 octobre 2026"
                  className={inputClass}
                />
              </div>
              <button type="button" onClick={ajouterSession} className="shrink-0 self-end px-3 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl transition-colors cursor-pointer">
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tableau des sessions existantes */}
          <div className="overflow-x-auto border border-[#404040]/10 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-4 py-3">Parkours</th>
                  <th className="px-4 py-3">Territoire</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {lignesSessions.length > 0 ? (
                  lignesSessions.map((ligne, index) => {
                    const changementTerritoire = index > 0 && lignesSessions[index - 1].territoire !== ligne.territoire;
                    return (
                    <tr key={`${ligne.parcoursId}-${ligne.territoire}-${index}`} className={`hover:bg-[#F3F3F2]/60 transition-colors ${changementTerritoire ? "border-t-2 border-t-[#005259]/30" : ""}`}>
                      <td className="px-4 py-2.5 font-bold text-[#005259]">{ligne.parcoursLabel}</td>
                      <td className="px-4 py-2.5">{ligne.territoire}</td>
                      <td className="px-4 py-2.5">{ligne.date}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => supprimerSession(ligne.parcoursId, ligne.territoire, ligne.date)}
                          className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer"
                          title="Supprimer cette session"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                      Aucune session enregistrée.
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

"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, ArrowLeftIcon, PlusIcon, XMarkIcon, TrashIcon, TagIcon } from "@heroicons/react/24/outline";
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

// Reprend les deux parcours réels observés dans les réponses au formulaire
// Numérik'Pro — librement renommables/complétables ensuite depuis cette page.
const PARCOURS_DEFAUT: Parcours[] = [
  { id: "numerikpro-tech", label: "Numérik'Pro Tech" },
  { id: "numerikpro-marketing", label: "Numérik'Pro Marketing" },
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
const JOURS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

// "YYYY-MM-DD" (valeur d'un <input type="date">) → Date locale, sans décalage
// de fuseau horaire (contrairement à new Date("YYYY-MM-DD") qui est en UTC).
function parseDateInput(valeur: string): Date | null {
  const m = valeur.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Reconstruit le libellé "Du lundi 7 septembre 2026 au vendredi 2 octobre
// 2026 — Matin" à partir des deux dates saisies séparément et du créneau —
// la session se déroule entièrement le matin OU l'après-midi, jamais les
// deux (même logique que la grille Évolution). Le créneau fait partie
// intégrante du libellé, qui sert d'identifiant de session partout ailleurs
// (champ Session, URLs, codes internes) : l'ajouter ici suffit à le propager
// sans toucher aucun autre fichier.
function formaterLibelleSession(debut: Date, fin: Date, creneau: string): string {
  const formater = (d: Date) => `${JOURS_FR[d.getDay()]} ${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
  return `Du ${formater(debut)} au ${formater(fin)} — ${creneau}`;
}

// Extrait les dates de début et de fin d'un libellé de session (première et
// dernière occurrence "jour mois année") pour les réafficher séparément.
function extraireDebutFin(texte: string): { debut: string; fin: string } | null {
  const regex = new RegExp(`\\d{1,2}\\s+(?:${MOIS_FR.join("|")})\\s+\\d{4}`, "gi");
  const correspondances = texte.match(regex);
  if (!correspondances || correspondances.length === 0) return null;
  return { debut: correspondances[0], fin: correspondances[correspondances.length - 1] };
}

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

export default function ParametresNumerikUpProPage() {
  const { role, loading: loadingPermissions } = usePermissions();
  const [parcoursListe, setParcoursListe] = useState<Parcours[]>(PARCOURS_DEFAUT);
  const [nouveauParcoursLabel, setNouveauParcoursLabel] = useState("");
  const [territoiresListe, setTerritoiresListe] = useState<string[]>(TERRITOIRES_DEFAUT);
  const [nouveauTerritoire, setNouveauTerritoire] = useState("");
  // sessions[parcoursId][territoire] = liste de dates de session.
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});
  // codes["parcoursId|territoire|date"] = code interne, jamais affiché sur le
  // formulaire public — sert uniquement en usage interne (Drive, suivi...).
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [nouvelleSessionParcours, setNouvelleSessionParcours] = useState("");
  const [nouvelleSessionTerritoire, setNouvelleSessionTerritoire] = useState("91");
  const [nouvelleSessionDebut, setNouvelleSessionDebut] = useState("");
  const [nouvelleSessionFin, setNouvelleSessionFin] = useState("");
  const [nouvelleSessionCreneau, setNouvelleSessionCreneau] = useState("Matin");

  useEffect(() => {
    const charger = async () => {
      const [snapSessions, snapParcours, snapTerritoires] = await Promise.all([
        getDoc(doc(db, "configuration_numerikuppro", "sessions")),
        getDoc(doc(db, "configuration_numerikuppro", "parcours")),
        getDoc(doc(db, "configuration_numerikuppro", "territoires")),
      ]);
      const parcoursCharges = snapParcours.exists() && Array.isArray(snapParcours.data().liste) && snapParcours.data().liste.length > 0
        ? snapParcours.data().liste
        : PARCOURS_DEFAUT;
      // Toujours synchronisé sur le premier parkours connu (par défaut ou
      // chargé) — pas seulement quand le document Firestore existe, sinon la
      // sélection reste bloquée sur une valeur vide/obsolète tant que
      // personne n'a jamais explicitement sauvegardé la liste des parkours
      // (cas des parkours par défaut jamais modifiés), et les sessions créées
      // atterrissent sous un identifiant de parkours qui n'existe nulle part.
      setParcoursListe(parcoursCharges);
      setNouvelleSessionParcours(parcoursCharges[0].id);
      if (snapSessions.exists()) {
        const sessionsChargees: Record<string, Record<string, string[]>> = snapSessions.data().parTerritoire || {};
        const codesCharges: Record<string, string> = snapSessions.data().codes || {};
        // Nettoie les sessions orphelines d'un parkours déjà supprimé, puis
        // les codes qui ne correspondent plus à aucune session existante
        // (parkours supprimé, ou simplement session supprimée entre-temps —
        // les deux cas laissaient un code fantôme avant la correction du
        // merge Firestore).
        const parcoursIdsValides = parcoursCharges.map((p: Parcours) => p.id);
        const sessionsNettoyees = Object.fromEntries(Object.entries(sessionsChargees).filter(([id]) => parcoursIdsValides.includes(id)));
        const codesNettoyes = Object.fromEntries(
          Object.entries(codesCharges).filter(([cle]) => {
            const [parcoursId, territoire, date] = (cle as string).split("|");
            return (sessionsNettoyees[parcoursId]?.[territoire] || []).includes(date);
          })
        );
        setSessions(sessionsNettoyees);
        setCodes(codesNettoyes);
        if (Object.keys(sessionsNettoyees).length !== Object.keys(sessionsChargees).length || Object.keys(codesNettoyes).length !== Object.keys(codesCharges).length) {
          await sauvegarderSessions(sessionsNettoyees, codesNettoyes);
        }
      }
      const territoiresCharges = snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0
        ? snapTerritoires.data().liste
        : TERRITOIRES_DEFAUT;
      setTerritoiresListe(territoiresCharges);
      setNouvelleSessionTerritoire(territoiresCharges[0]);
      setLoading(false);
    };
    charger();
  }, []);

  // Écrit tout le document "sessions" en une fois (jamais de merge partiel) :
  // { merge: true } fusionne les maps en profondeur au lieu de les remplacer,
  // donc une clé supprimée localement (session, code) réapparaîtrait après
  // rechargement si on l'utilisait ici.
  const sauvegarderSessions = async (parTerritoire: Record<string, Record<string, string[]>>, codesActuels: Record<string, string>) => {
    await setDoc(doc(db, "configuration_numerikuppro", "sessions"), { parTerritoire, codes: codesActuels });
  };

  const ajouterParcours = async () => {
    const label = nouveauParcoursLabel.trim();
    if (!label) return;
    const id = slugifier(label, parcoursListe.map((p) => p.id));
    const misesAJour = [...parcoursListe, { id, label }];
    setParcoursListe(misesAJour);
    setNouveauParcoursLabel("");
    await setDoc(doc(db, "configuration_numerikuppro", "parcours"), { liste: misesAJour });
  };

  const supprimerParcours = async (id: string) => {
    const misesAJour = parcoursListe.filter((p) => p.id !== id);
    setParcoursListe(misesAJour);
    await setDoc(doc(db, "configuration_numerikuppro", "parcours"), { liste: misesAJour });

    // Purge les sessions et codes internes rattachés à ce parkours, sinon ils
    // restent orphelins (le libellé du parkours ne se résout plus nulle part).
    const sessionsMisesAJour = { ...sessions };
    delete sessionsMisesAJour[id];
    setSessions(sessionsMisesAJour);
    const codesMisAJour = Object.fromEntries(Object.entries(codes).filter(([cle]) => cle.split("|")[0] !== id));
    setCodes(codesMisAJour);
    await sauvegarderSessions(sessionsMisesAJour, codesMisAJour);
  };

  const ajouterTerritoire = async () => {
    const valeur = nouveauTerritoire.trim();
    if (!valeur || territoiresListe.includes(valeur)) return;
    const misesAJour = [...territoiresListe, valeur];
    setTerritoiresListe(misesAJour);
    setNouveauTerritoire("");
    await setDoc(doc(db, "configuration_numerikuppro", "territoires"), { liste: misesAJour });
  };

  const supprimerTerritoire = async (valeur: string) => {
    const misesAJour = territoiresListe.filter((t) => t !== valeur);
    setTerritoiresListe(misesAJour);
    await setDoc(doc(db, "configuration_numerikuppro", "territoires"), { liste: misesAJour });
  };

  const ajouterSession = async () => {
    const debut = parseDateInput(nouvelleSessionDebut);
    const fin = parseDateInput(nouvelleSessionFin);
    if (!debut || !fin) return;
    const valeur = formaterLibelleSession(debut, fin, nouvelleSessionCreneau);
    // Le libellé de la session sert d'identifiant partout ailleurs (champ
    // Session sur les inscriptions, URL...) : deux sessions différentes (même
    // parkours ou non, même territoire ou non) ne doivent jamais partager le
    // même libellé, sinon impossible de les distinguer une fois affectées.
    const dejaExistant = Object.values(sessions).some((parTerritoire) => Object.values(parTerritoire).some((dates) => dates.includes(valeur)));
    if (dejaExistant) {
      alert("Une session existe déjà avec exactement les mêmes dates et le même créneau (même sur un autre parkours/territoire) — change le créneau ou les dates pour la distinguer.");
      return;
    }
    const pourParcours = sessions[nouvelleSessionParcours] || {};
    const misesAJour = {
      ...sessions,
      [nouvelleSessionParcours]: { ...pourParcours, [nouvelleSessionTerritoire]: [...(pourParcours[nouvelleSessionTerritoire] || []), valeur] },
    };
    setSessions(misesAJour);
    setNouvelleSessionDebut("");
    setNouvelleSessionFin("");
    await sauvegarderSessions(misesAJour, codes);
  };

  const supprimerSession = async (parcours: string, territoire: string, valeur: string) => {
    const pourParcours = sessions[parcours] || {};
    const misesAJour = {
      ...sessions,
      [parcours]: { ...pourParcours, [territoire]: (pourParcours[territoire] || []).filter((s) => s !== valeur) },
    };
    setSessions(misesAJour);
    const cle = `${parcours}|${territoire}|${valeur}`;
    const codesMisAJour = { ...codes };
    delete codesMisAJour[cle];
    setCodes(codesMisAJour);
    await sauvegarderSessions(misesAJour, codesMisAJour);
  };

  // Code interne "MN{AA}_NKPRO-{territoire}_{NN}" — jamais affiché sur le
  // formulaire public, numéroté séquentiellement par territoire.
  const genererCode = async (ligne: { parcoursId: string; territoire: string; date: string }) => {
    const cle = `${ligne.parcoursId}|${ligne.territoire}|${ligne.date}`;
    if (codes[cle]) return;
    const anneeMatch = ligne.date.match(/(\d{4})/);
    const annee = anneeMatch ? anneeMatch[1].slice(-2) : String(new Date().getFullYear()).slice(-2);
    const nombreExistant = Object.keys(codes).filter((c) => c.split("|")[1] === ligne.territoire).length;
    const numero = String(nombreExistant + 1).padStart(2, "0");
    const code = `MN${annee}_NKPRO-${ligne.territoire}_${numero}`;
    const misesAJour = { ...codes, [cle]: code };
    setCodes(misesAJour);
    await sauvegarderSessions(sessions, misesAJour);
  };

  // Le code auto-généré reste librement modifiable (ex. pour aligner avec une
  // convention déjà utilisée ailleurs, comme dans le suivi des absences).
  const modifierCode = async (cle: string, valeur: string) => {
    const misesAJour = { ...codes, [cle]: valeur };
    setCodes(misesAJour);
    await sauvegarderSessions(sessions, misesAJour);
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
          href="/mediation/actions-collectives/inscription/numerik-up-pro"
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
                Gérer <span className="text-[#EA601F] font-semibold">NUMERIK PRO</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Parkours, territoires et sessions du formulaire d'inscription
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link
              href="/mediation/actions-collectives/inscription/numerik-up-pro"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Formulaire NUMERIK PRO</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
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
            <div>
              <label className={labelClass}>Date de début</label>
              <input
                type="date"
                value={nouvelleSessionDebut}
                onChange={(e) => setNouvelleSessionDebut(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Date de fin</label>
              <input
                type="date"
                value={nouvelleSessionFin}
                onChange={(e) => setNouvelleSessionFin(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Créneau</label>
              <select value={nouvelleSessionCreneau} onChange={(e) => setNouvelleSessionCreneau(e.target.value)} className={inputClass}>
                <option value="Matin">Matin</option>
                <option value="Après-midi">Après-midi</option>
              </select>
            </div>
            <div className="flex">
              <button type="button" onClick={ajouterSession} className="w-full self-end px-3 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl transition-colors cursor-pointer flex items-center justify-center">
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
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          {codes[`${ligne.parcoursId}|${ligne.territoire}|${ligne.date}`] ? (
                            <input
                              key={`${ligne.parcoursId}|${ligne.territoire}|${ligne.date}|${codes[`${ligne.parcoursId}|${ligne.territoire}|${ligne.date}`]}`}
                              type="text"
                              defaultValue={codes[`${ligne.parcoursId}|${ligne.territoire}|${ligne.date}`]}
                              onBlur={(e) => modifierCode(`${ligne.parcoursId}|${ligne.territoire}|${ligne.date}`, e.target.value)}
                              className="font-mono text-[10px] font-bold text-[#005259] bg-[#005259]/5 border border-[#005259]/15 focus:border-[#005259] focus:bg-white rounded px-1.5 py-1 w-32 outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => genererCode(ligne)}
                              className="p-1.5 bg-[#005259]/10 hover:bg-[#005259] text-[#005259] hover:text-white border border-[#005259]/30 rounded-lg transition-colors cursor-pointer"
                              title="Générer un code interne (non visible sur le formulaire)"
                            >
                              <PlusIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => supprimerSession(ligne.parcoursId, ligne.territoire, ligne.date)}
                            className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer"
                            title="Supprimer cette session"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
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

        {/* CODES INTERNES */}
        {Object.keys(codes).length > 0 && (
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <TagIcon className="w-4 h-4 text-[#EA601F]" />
              <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Codes internes</h2>
            </div>
            <p className="text-[10px] text-[#404040]/50">Non visibles sur le formulaire d'inscription — pour usage interne (suivi, Drive partagé...).</p>
            <div className="border border-[#404040]/10 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_2fr_1fr_1fr] gap-3 px-4 py-2 bg-[#F3F3F2] border-b border-[#404040]/10 text-[10px] font-bold uppercase tracking-widest text-[#005259]">
                <span>Code</span>
                <span>Parkours</span>
                <span>Début</span>
                <span>Fin</span>
              </div>
              <div className="divide-y divide-[#404040]/5">
                {Object.entries(codes)
                  .sort(([, a], [, b]) => a.localeCompare(b))
                  .map(([cle, code]) => {
                    const [parcoursId, , date] = cle.split("|");
                    const parcoursLabel = parcoursListe.find((p) => p.id === parcoursId)?.label || parcoursId;
                    const debutFin = extraireDebutFin(date);
                    return (
                      <div key={`${cle}|${code}`} className="grid grid-cols-[1fr_2fr_1fr_1fr] items-center gap-3 px-4 py-2.5 text-xs">
                        <input
                          type="text"
                          defaultValue={code}
                          onBlur={(e) => modifierCode(cle, e.target.value)}
                          className="font-mono font-bold text-[#005259] bg-transparent border border-transparent hover:border-[#404040]/15 focus:border-[#005259] focus:bg-[#F3F3F2] rounded px-1.5 py-1 outline-none transition-colors"
                        />
                        <span className="text-[#404040]/70">{parcoursLabel}</span>
                        <span className="text-[#404040]/70">{debutFin?.debut || "—"}</span>
                        <span className="text-[#404040]/70">{debutFin?.fin || "—"}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
    </PageGuard>
  );
}

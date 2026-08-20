"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, ArrowLeftIcon, ChevronDownIcon, TrashIcon, PlusIcon, PencilSquareIcon, CheckIcon, XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

interface Apprenant {
  id: string;
  Prénom?: string;
  Nom?: string;
  Session?: string;
  Suivi_Recrutement?: boolean;
  OK_NOK?: string;
  // Un code par jour (la session entière se déroule le matin OU l'après-midi,
  // jamais les deux), clé "AAAA-MM-JJ".
  Evolution?: Record<string, string>;
  // Nombre d'heures manquées un jour donné en cas de grand retard, même clé
  // "AAAA-MM-JJ" — n'a de sens qu'à côté d'un code de présence (G/D/GR/SK),
  // et vient réduire les heures/le taux de présence comptabilisés ce jour-là.
  Evolution_Retards?: Record<string, string>;
  // Coché = apprenant·e suivi·e dans le calcul du taux de présence.
  Evolution_Actif?: boolean;
  // Journal des absences justifiées (une entrée par évènement signalé).
  Absences?: AbsenceRecord[];
}

interface AbsenceRecord {
  date: string;
  justifiee: boolean;
  type: string;
  raison: string;
  reference: string;
  lien: string;
}

const TYPES_JUSTIFICATIF = ["Email", "SMS", "Téléphone", "Autre"];

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// Codes de suivi et leur couleur — reprend le code couleur fourni par
// l'équipe pour la feuille "Évolution".
const CODES = [
  { code: "", label: "—", bg: "#FFFFFF", text: "#404040" },
  { code: "G", label: "Game Design", bg: "#7C1FD1", text: "#FFFFFF" },
  { code: "D", label: "Développement", bg: "#F5820D", text: "#FFFFFF" },
  { code: "GR", label: "Graphisme", bg: "#22D3EE", text: "#003044" },
  { code: "SK", label: "Soft Skills", bg: "#FDE047", text: "#3A3300" },
  { code: "A", label: "Absence justifiée", bg: "#EF4444", text: "#FFFFFF" },
  { code: "ANJ", label: "Absence non justifiée", bg: "#111827", text: "#FFFFFF" },
  { code: "F", label: "Férié / Off", bg: "#9CA3AF", text: "#111111" },
  { code: "AB", label: "Abandon", bg: "#22C55E", text: "#FFFFFF" },
];
const CODES_PRESENCE = ["G", "D", "GR", "SK"];
const HEURES_PAR_JOUR = 3;

function versISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Affiche une date stockée au format ISO ("AAAA-MM-JJ", tel que renvoyé par
// un <input type="date">) au format français "JJ/MM/AAAA".
function formaterDateFr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// Extrait la date de début d'une session à partir de son libellé texte libre
// (ex. "Du lundi 7 septembre au vendredi 2 octobre 2026").
function extraireDateDebut(texte: string): Date | null {
  const regex = new RegExp(`(\\d{1,2})\\s+(${MOIS_FR.join("|")})(?:\\s+(\\d{4}))?`, "gi");
  const trouvees: { jour: number; mois: number; annee?: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texte.toLowerCase())) !== null) {
    trouvees.push({ jour: parseInt(m[1], 10), mois: MOIS_FR.indexOf(m[2].toLowerCase()), annee: m[3] ? parseInt(m[3], 10) : undefined });
  }
  if (trouvees.length === 0) return null;
  const anneeParDefaut = [...trouvees].reverse().find((d) => d.annee !== undefined)?.annee;
  if (anneeParDefaut === undefined) return null;
  const dates = trouvees.map((d) => new Date(d.annee ?? anneeParDefaut, d.mois, d.jour));
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

// Génère les N prochains jours ouvrés (lun-ven) à partir d'une date de début.
function genererJoursOuvres(debut: Date, nombre: number): Date[] {
  const jours: Date[] = [];
  const curseur = new Date(debut);
  while (jours.length < nombre) {
    const jourSemaine = curseur.getDay();
    if (jourSemaine !== 0 && jourSemaine !== 6) {
      jours.push(new Date(curseur));
    }
    curseur.setDate(curseur.getDate() + 1);
  }
  return jours;
}

function decouperEnSemaines<T>(elements: T[], taille: number): T[][] {
  const semaines: T[][] = [];
  for (let i = 0; i < elements.length; i += taille) {
    semaines.push(elements.slice(i, i + taille));
  }
  return semaines;
}

// Grille de suivi pédagogique de la session : 4 blocs (4 semaines), une case
// par jour ouvré colorée selon le code d'activité ou d'absence du jour.
export default function EvolutionNumerikUpProSessionPage() {
  const params = useParams();
  const sessionId = decodeURIComponent((params?.id as string) || "");

  const [apprenants, setApprenants] = useState<Apprenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [semainesFermees, setSemainesFermees] = useState<Set<number>>(new Set());
  const [nouvelleAbsence, setNouvelleAbsence] = useState({ apprenantId: "", date: "", justifiee: true, type: "", raison: "", reference: "", lien: "" });
  const [brouillonAbsence, setBrouillonAbsence] = useState<{ apprenantId: string; indexRecord: number; valeurs: AbsenceRecord } | null>(null);
  const [alerteANJ, setAlerteANJ] = useState<{ prenom: string; nom: string; nombre: number } | null>(null);

  useEffect(() => {
    const charger = async () => {
      try {
        const snap = await getDocs(query(collection(db, "inscriptions_numerikuppro"), orderBy("createdAt", "desc")));
        setApprenants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Apprenant)));
      } catch (error) {
        console.error("Erreur lors du chargement des apprenant·e·s :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  const apprenantsSession = useMemo(
    () =>
      apprenants
        .filter((a) => a.Session === sessionId && a.Suivi_Recrutement && a.OK_NOK === "OK")
        .sort((a, b) => (a.Nom || "").localeCompare(b.Nom || "", "fr")),
    [apprenants, sessionId]
  );

  // 4 semaines de 5 jours ouvrés, calculées depuis la date de début de la
  // session (extraite de son libellé texte).
  const semaines = useMemo(() => {
    const debut = extraireDateDebut(sessionId);
    if (!debut) return [];
    return decouperEnSemaines(genererJoursOuvres(debut, 20), 5);
  }, [sessionId]);

  const mettreAJourCase = async (id: string, cle: string, valeur: string) => {
    const apprenant = apprenants.find((a) => a.id === id);
    setApprenants((prev) => prev.map((a) => (a.id === id ? { ...a, Evolution: { ...a.Evolution, [cle]: valeur } } : a)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", id), { [`Evolution.${cle}`]: valeur });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'évolution :", error);
    }
    // Signale au médiateur les absences non justifiées répétées, pour
    // remontée au coordinateur.
    if (apprenant && valeur === "ANJ") {
      const nombre = Object.values({ ...apprenant.Evolution, [cle]: valeur }).filter((v) => v === "ANJ").length;
      if (nombre >= 2) {
        setAlerteANJ({ prenom: apprenant.Prénom || "", nom: apprenant.Nom || "", nombre });
      }
    }
  };

  // Note le nombre d'heures manquées un jour donné (grand retard) —
  // indépendant du code de présence, qui reste sélectionné normalement à
  // côté, mais vient réduire les heures/le taux comptabilisés ce jour-là.
  const mettreAJourRetard = async (id: string, cle: string, valeur: string) => {
    setApprenants((prev) => prev.map((a) => (a.id === id ? { ...a, Evolution_Retards: { ...a.Evolution_Retards, [cle]: valeur } } : a)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", id), { [`Evolution_Retards.${cle}`]: valeur });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du retard :", error);
    }
  };

  const basculerActif = async (id: string, valeur: boolean) => {
    setApprenants((prev) => prev.map((a) => (a.id === id ? { ...a, Evolution_Actif: valeur } : a)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", id), { Evolution_Actif: valeur });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'évolution :", error);
    }
  };

  // Présence sur un ensemble de jours donné, en heures : les cases Férié (et
  // les cases pas encore renseignées) sont exclues ; un jour codé comme
  // activité (G/D/GR/SK) compte pour sa durée normale (HEURES_PAR_JOUR),
  // réduite des heures manquées si un grand retard a été noté ce jour-là.
  // Sert au calcul par semaine comme au calcul global.
  const calculerPresence = (apprenant: Apprenant, jours: Date[]): { heuresPresence: number; heuresPrevues: number } => {
    let heuresPresence = 0;
    let heuresPrevues = 0;
    jours.forEach((jour) => {
      const iso = versISO(jour);
      const valeur = apprenant.Evolution?.[iso];
      if (!valeur || valeur === "F") return;
      heuresPrevues += HEURES_PAR_JOUR;
      if (CODES_PRESENCE.includes(valeur)) {
        const retard = Math.max(0, Math.min(HEURES_PAR_JOUR, parseFloat((apprenant.Evolution_Retards?.[iso] || "0").replace(",", ".")) || 0));
        heuresPresence += HEURES_PAR_JOUR - retard;
      }
    });
    return { heuresPresence, heuresPrevues };
  };

  const tauxSemaine = (apprenant: Apprenant, jours: Date[]): number | null => {
    const { heuresPresence, heuresPrevues } = calculerPresence(apprenant, jours);
    return heuresPrevues > 0 ? Math.round((heuresPresence / heuresPrevues) * 100) : null;
  };

  // Tous les jours des 4 semaines, pour le tableau récapitulatif GLOBAL.
  const tousLesJours = useMemo(() => semaines.flat(), [semaines]);

  // Moyenne du groupe : total des jours de présence sur total des jours
  // comptabilisés, pour les apprenant·e·s coché·e·s "Actif" uniquement.
  const moyenneGroupe = useMemo(() => {
    let heuresPresence = 0;
    let heuresPrevues = 0;
    apprenantsSession.filter((a) => a.Evolution_Actif).forEach((a) => {
      const p = calculerPresence(a, tousLesJours);
      heuresPresence += p.heuresPresence;
      heuresPrevues += p.heuresPrevues;
    });
    return heuresPrevues > 0 ? Math.round((heuresPresence / heuresPrevues) * 100) : null;
  }, [apprenantsSession, tousLesJours]);

  const basculerSemaine = (index: number) => {
    setSemainesFermees((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(index)) suivant.delete(index);
      else suivant.add(index);
      return suivant;
    });
  };

  // Journal des absences, à plat, trié par date — une ligne par évènement.
  const journalAbsences = useMemo(
    () =>
      apprenantsSession
        .flatMap((a, indexRoster) =>
          (a.Absences || []).map((rec, indexRecord) => ({ ...rec, apprenant: a, indexRoster: indexRoster + 1, indexRecord }))
        )
        .sort((x, y) => x.date.localeCompare(y.date)),
    [apprenantsSession]
  );

  const ajouterAbsence = async () => {
    const apprenant = apprenantsSession.find((a) => a.id === nouvelleAbsence.apprenantId);
    if (!apprenant || !nouvelleAbsence.date) return;
    const enregistrement: AbsenceRecord = {
      date: nouvelleAbsence.date,
      justifiee: nouvelleAbsence.justifiee,
      type: nouvelleAbsence.type,
      raison: nouvelleAbsence.raison,
      reference: nouvelleAbsence.reference,
      lien: nouvelleAbsence.lien,
    };
    const nouvelleListe = [...(apprenant.Absences || []), enregistrement];
    setApprenants((prev) => prev.map((a) => (a.id === apprenant.id ? { ...a, Absences: nouvelleListe } : a)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", apprenant.id), { Absences: nouvelleListe });
    } catch (error) {
      console.error("Erreur lors de l'ajout de l'absence :", error);
    }
    setNouvelleAbsence({ apprenantId: "", date: "", justifiee: true, type: "", raison: "", reference: "", lien: "" });
  };

  // Édition d'une absence : un brouillon local, rien n'est écrit tant que
  // "Enregistrer" n'est pas cliqué — évite tout effacement accidentel au fil
  // de la frappe.
  const debuterModificationAbsence = (apprenantId: string, indexRecord: number, valeurs: AbsenceRecord) => {
    setBrouillonAbsence({ apprenantId, indexRecord, valeurs: { ...valeurs } });
  };

  const annulerModificationAbsence = () => setBrouillonAbsence(null);

  const enregistrerModificationAbsence = async () => {
    if (!brouillonAbsence) return;
    const { apprenantId, indexRecord, valeurs } = brouillonAbsence;
    const apprenant = apprenants.find((a) => a.id === apprenantId);
    if (!apprenant) return;
    const nouvelleListe = (apprenant.Absences || []).map((r, i) => (i === indexRecord ? valeurs : r));
    setApprenants((prev) => prev.map((a) => (a.id === apprenantId ? { ...a, Absences: nouvelleListe } : a)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", apprenantId), { Absences: nouvelleListe });
    } catch (error) {
      console.error("Erreur lors de la modification de l'absence :", error);
    }
    setBrouillonAbsence(null);
  };

  const supprimerAbsence = async (apprenantId: string, indexRecord: number) => {
    const apprenant = apprenants.find((a) => a.id === apprenantId);
    if (!apprenant) return;
    const nouvelleListe = (apprenant.Absences || []).filter((_, i) => i !== indexRecord);
    setApprenants((prev) => prev.map((a) => (a.id === apprenantId ? { ...a, Absences: nouvelleListe } : a)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", apprenantId), { Absences: nouvelleListe });
    } catch (error) {
      console.error("Erreur lors de la suppression de l'absence :", error);
    }
  };

  const styleCode = (valeur?: string) => {
    const info = CODES.find((c) => c.code === (valeur || "")) || CODES[0];
    return { backgroundColor: info.bg, color: info.text };
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement...
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
                Évolution
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Session : {sessionId || "—"} — {apprenantsSession.length} apprenant{apprenantsSession.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link
              href={`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionId)}/apprenants`}
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Apprenant·e·s</span>
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

        {/* LÉGENDE */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4 flex flex-wrap gap-x-6 gap-y-2">
          {CODES.filter((c) => c.code).map((c) => (
            <div key={c.code} className="flex items-center gap-2 text-xs font-medium">
              <span className="w-4 h-4 rounded border border-[#404040]/20" style={{ backgroundColor: c.bg }}></span>
              <span className="font-bold text-[#005259]">{c.code}</span>
              <span className="text-[#404040]/70">{c.label}</span>
            </div>
          ))}
        </div>

        {apprenantsSession.length === 0 ? (
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
            Aucun·e apprenant·e retenu·e (OK) pour cette session.
          </div>
        ) : semaines.length === 0 ? (
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
            Impossible de déterminer les dates de la session — vérifie son libellé (doit contenir une date de début, ex. "Du lundi 7 septembre...").
          </div>
        ) : (
          <>
          {/* RÉCAPITULATIF GLOBAL — cumul des 4 semaines */}
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-1 text-xs font-bold uppercase tracking-widest text-[#005259]">
              Global
            </div>
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs w-full">
                <thead>
                  <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-3 py-3 text-center">Moyenne groupe</th>
                    <th className="px-3 py-3 text-center">H / Sem</th>
                    <th className="px-3 py-3 text-center">Taux</th>
                    <th className="px-3 py-3 text-center">Actif</th>
                    <th className="px-3 py-3 text-center">Δ</th>
                    <th className="px-3 py-3">Prénom</th>
                    <th className="px-3 py-3">Nom</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#404040]/5">
                  {apprenantsSession.map((a, index) => {
                    const { heuresPresence, heuresPrevues } = calculerPresence(a, tousLesJours);
                    const taux = heuresPrevues > 0 ? (heuresPresence / heuresPrevues) * 100 : null;
                    return (
                      <tr key={a.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                        <td className="px-3 py-2 text-center font-bold text-[#005259]">
                          {index === 0 && moyenneGroupe !== null ? `${moyenneGroupe.toFixed(2)}%` : ""}
                        </td>
                        <td className="px-3 py-2 text-center font-bold">
                          {a.Evolution_Actif && heuresPrevues > 0 ? heuresPresence.toFixed(2) : ""}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-[#005259]">
                          {a.Evolution_Actif && taux !== null ? `${taux.toFixed(2)}%` : ""}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={a.Evolution_Actif || false} onChange={(e) => basculerActif(a.id, e.target.checked)} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                        </td>
                        <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{a.Prénom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">{a.Nom || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {semaines.map((jours, indexSemaine) => {
            const fermee = semainesFermees.has(indexSemaine);
            return (
            <div key={indexSemaine} className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => basculerSemaine(indexSemaine)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F3F3F2]/60 transition-colors cursor-pointer"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-[#005259]">Semaine {indexSemaine + 1}</span>
                <ChevronDownIcon className={`w-4 h-4 text-[#EA601F] transition-transform duration-200 ${fermee ? "" : "rotate-180"}`} />
              </button>
              {!fermee && (
              <div className="overflow-x-auto">
                <table className="border-collapse text-xs w-full">
                  <thead>
                    <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                      <th className="px-3 py-3 text-center">Taux</th>
                      <th className="px-3 py-3 text-center">Actif</th>
                      <th className="px-3 py-3 text-center">Δ</th>
                      <th className="px-3 py-3">Prénom</th>
                      <th className="px-3 py-3">Nom</th>
                      {jours.map((jour) => (
                        <th key={versISO(jour)} className="px-1 py-3 text-center border-l border-[#404040]/10">
                          {JOURS_FR[jour.getDay()]} {String(jour.getDate()).padStart(2, "0")}/{String(jour.getMonth() + 1).padStart(2, "0")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]/5">
                    {apprenantsSession.map((a, index) => {
                      const taux = tauxSemaine(a, jours);
                      return (
                        <tr key={a.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                          <td className="px-3 py-2 text-center font-bold text-[#005259]">
                            {a.Evolution_Actif && taux !== null ? `${taux.toFixed(2)}%` : ""}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={a.Evolution_Actif || false} onChange={(e) => basculerActif(a.id, e.target.checked)} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                          </td>
                          <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{a.Prénom || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">{a.Nom || "—"}</td>
                          {jours.map((jour) => {
                            const iso = versISO(jour);
                            return (
                              <td key={iso} className="p-0 border-l border-[#404040]/10">
                                <select
                                  value={a.Evolution?.[iso] || ""}
                                  onChange={(e) => mettreAJourCase(a.id, iso, e.target.value)}
                                  className="w-full px-1 py-2 text-[10px] font-bold text-center outline-none cursor-pointer border-0"
                                  style={styleCode(a.Evolution?.[iso])}
                                >
                                  {CODES.map((c) => (
                                    <option key={c.code} value={c.code}>{c.code || "—"}</option>
                                  ))}
                                </select>
                                <input
                                  key={a.Evolution_Retards?.[iso] || ""}
                                  type="text"
                                  defaultValue={a.Evolution_Retards?.[iso] || ""}
                                  onBlur={(e) => mettreAJourRetard(a.id, iso, e.target.value)}
                                  placeholder="0h"
                                  title="Heures manquées en cas de grand retard (ex : 1 ou 0.5) — réduit le taux de présence du jour"
                                  className="w-full px-1 py-0.5 text-[9px] text-center outline-none border-0 border-t border-[#404040]/10 bg-[#F3F3F2] text-[#404040] placeholder-[#404040]/30 focus:bg-white"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
            );
          })}

          {/* SUIVI DES ABSENCES */}
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-1 text-xs font-bold uppercase tracking-widest text-[#005259]">
              Suivi des absences
            </div>

            {/* Cumul par apprenant·e */}
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs w-full">
                <thead>
                  <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-3 py-3 text-center">Δ</th>
                    <th className="px-3 py-3">Prénom</th>
                    <th className="px-3 py-3">Nom</th>
                    <th className="px-3 py-3 text-center">Cumul absences justifiées</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#404040]/5">
                  {apprenantsSession.map((a, index) => (
                    <tr key={a.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                      <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{a.Prénom || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">{a.Nom || "—"}</td>
                      <td className="px-3 py-2 text-center font-bold text-[#005259]">
                        {(a.Absences || []).filter((r) => r.justifiee).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Journal des absences */}
            <div className="overflow-x-auto border-t border-[#404040]/10">
              <table className="border-collapse text-xs w-full">
                <thead>
                  <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3 text-center">Δ</th>
                    <th className="px-3 py-3 text-center">JA</th>
                    <th className="px-3 py-3 text-center">Nb</th>
                    <th className="px-3 py-3">Prénom</th>
                    <th className="px-3 py-3">Nom</th>
                    <th className="px-3 py-3">Type justificatif</th>
                    <th className="px-3 py-3">Raison</th>
                    <th className="px-3 py-3">N° enregistrement Drive partagé</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#404040]/5">
                  {journalAbsences.map((rec) => {
                    const enEdition = brouillonAbsence?.apprenantId === rec.apprenant.id && brouillonAbsence?.indexRecord === rec.indexRecord;
                    if (enEdition && brouillonAbsence) {
                      const b = brouillonAbsence.valeurs;
                      const maj = <K extends keyof AbsenceRecord>(champ: K, valeur: AbsenceRecord[K]) =>
                        setBrouillonAbsence({ ...brouillonAbsence, valeurs: { ...b, [champ]: valeur } });
                      return (
                        <tr key={`${rec.apprenant.id}-${rec.indexRecord}`} className="bg-[#005259]/5">
                          <td className="px-3 py-2">
                            <input type="date" value={b.date} onChange={(e) => maj("date", e.target.value)} className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                          </td>
                          <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{rec.indexRoster}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={b.justifiee} onChange={(e) => maj("justifiee", e.target.checked)} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                          </td>
                          <td className="px-3 py-2 text-center">{String(rec.indexRecord + 1).padStart(2, "0")}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{rec.apprenant.Prénom || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">{rec.apprenant.Nom || "—"}</td>
                          <td className="px-3 py-2">
                            <select value={b.type} onChange={(e) => maj("type", e.target.value)} className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none">
                              <option value="">-- Type --</option>
                              {TYPES_JUSTIFICATIF.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={b.raison} onChange={(e) => maj("raison", e.target.value)} placeholder="Raison" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                          </td>
                          <td className="px-3 py-2 space-y-1">
                            <input type="text" value={b.reference} onChange={(e) => maj("reference", e.target.value)} placeholder="Nom du fichier Drive" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                            <input type="url" value={b.lien} onChange={(e) => maj("lien", e.target.value)} placeholder="Lien Drive (https://...)" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <button type="button" onClick={enregistrerModificationAbsence} className="p-1.5 mr-1 bg-[#005259]/10 hover:bg-[#005259] text-[#005259] hover:text-white border border-[#005259]/30 rounded-lg transition-colors cursor-pointer" title="Enregistrer">
                              <CheckIcon className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={annulerModificationAbsence} className="p-1.5 bg-[#404040]/10 hover:bg-[#404040] text-[#404040] hover:text-white border border-[#404040]/20 rounded-lg transition-colors cursor-pointer" title="Annuler">
                              <XMarkIcon className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    return (
                    <tr key={`${rec.apprenant.id}-${rec.indexRecord}`} className="hover:bg-[#F3F3F2]/60 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">{formaterDateFr(rec.date)}</td>
                      <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{rec.indexRoster}</td>
                      <td className="px-3 py-2 text-center">{rec.justifiee ? "✔" : ""}</td>
                      <td className="px-3 py-2 text-center">{String(rec.indexRecord + 1).padStart(2, "0")}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{rec.apprenant.Prénom || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">{rec.apprenant.Nom || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{rec.type || "—"}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={rec.raison}>{rec.raison || "—"}</td>
                      <td className="px-3 py-2 max-w-[220px] truncate" title={rec.reference}>
                        {rec.reference ? (
                          rec.lien ? (
                            <a href={rec.lien} target="_blank" rel="noopener noreferrer" className="text-[#005259] font-bold underline hover:text-[#EA601F]">
                              {rec.reference}
                            </a>
                          ) : (
                            rec.reference
                          )
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <button type="button" onClick={() => debuterModificationAbsence(rec.apprenant.id, rec.indexRecord, rec)} className="p-1.5 mr-1 bg-[#005259]/10 hover:bg-[#005259] text-[#005259] hover:text-white border border-[#005259]/30 rounded-lg transition-colors cursor-pointer" title="Modifier">
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => supprimerAbsence(rec.apprenant.id, rec.indexRecord)} className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer" title="Supprimer">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                  <tr className="bg-[#F3F3F2]/40">
                    <td className="px-3 py-2">
                      <input type="date" value={nouvelleAbsence.date} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, date: e.target.value })} className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                    </td>
                    <td colSpan={2} className="px-3 py-2 text-center">
                      <input type="checkbox" checked={nouvelleAbsence.justifiee} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, justifiee: e.target.checked })} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                    </td>
                    <td colSpan={2} className="px-3 py-2">
                      <select value={nouvelleAbsence.apprenantId} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, apprenantId: e.target.value })} className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none">
                        <option value="">-- Apprenant·e --</option>
                        {apprenantsSession.map((a) => (
                          <option key={a.id} value={a.id}>{a.Prénom} {a.Nom}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select value={nouvelleAbsence.type} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, type: e.target.value })} className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none">
                        <option value="">-- Type --</option>
                        {TYPES_JUSTIFICATIF.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={nouvelleAbsence.raison} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, raison: e.target.value })} placeholder="Raison" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                    </td>
                    <td className="px-3 py-2 space-y-1">
                      <input type="text" value={nouvelleAbsence.reference} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, reference: e.target.value })} placeholder="Nom du fichier Drive" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                      <input type="url" value={nouvelleAbsence.lien} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, lien: e.target.value })} placeholder="Lien Drive (https://...)" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={ajouterAbsence} className="p-1.5 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-lg transition-colors cursor-pointer">
                        <PlusIcon className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}

      </div>

      {/* ALERTE ABSENCES NON JUSTIFIÉES RÉPÉTÉES */}
      {alerteANJ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center space-y-4">
            <ExclamationTriangleIcon className="w-10 h-10 text-[#EA601F] mx-auto" />
            <p className="text-sm font-medium text-[#404040]">
              {alerteANJ.prenom} {alerteANJ.nom} totalise désormais {alerteANJ.nombre} absences non justifiées sur cette session. Ce point mérite d'être signalé à votre coordinateur.
            </p>
            <button
              type="button"
              onClick={() => setAlerteANJ(null)}
              className="bg-[#005259] hover:bg-[#00363a] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </main>
    </PageGuard>
  );
}

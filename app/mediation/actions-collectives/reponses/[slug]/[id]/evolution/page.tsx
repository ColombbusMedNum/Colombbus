"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, ChevronDownIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { ActionSchema, CATEGORIE_EVOLUTION_DEFAUT, CategorieEvolution, InscriptionActionDynamique } from "@/lib/dynamicActions/types";
import { chargerSchema, chargerConfiguration, inscriptionsCollection, inscriptionDoc } from "@/lib/dynamicActions/store";

// Apprenant·e retenu·e (décision de recrutement "OK", voir [slug]/[id]/page.tsx)
// — Evolution est un champ de suivi générique, dans le même esprit
// qu'Evolution_Actif/Evolution_Retards déjà présents dans le socle CORE
// (lib/dynamicActions/types.ts), mais stocké librement (pas de forme fixe côté
// TypeScript) puisque Firestore n'impose pas de schéma.
interface Apprenant extends InscriptionActionDynamique {
  Decision_Recrutement?: string;
  Evolution?: Record<string, string>;
}

// Forme du journal des absences CORE (voir lib/dynamicActions/types.ts) :
// juste une date et un motif libre — justifiée/non justifiée se lit sur le
// code posé ce jour-là ("A"/"ANJ"), pas sur l'entrée du journal elle-même.
type AbsenceRecord = NonNullable<InscriptionActionDynamique["Absences"]>[number];
const MOTIF_JUSTIFIEE = "Absence justifiée";
const MOTIF_NON_JUSTIFIEE = "Absence non justifiée";

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// Les 4 codes structurels sont fixes, gérés par le moteur (d'autres
// logiques en dépendent : bascule "Suivi_Recrutement"/abandon en cascade,
// alimentation du journal des absences, alerte sur absences répétées) — les
// catégories ACTIVITÉ, elles, viennent du schéma de l'action (voir
// schema.categoriesEvolution, modifiable depuis la page paramètres).
const CODES_STRUCTURELS = [
  { code: "A", label: "Absence justifiée", bg: "#EF4444", text: "#FFFFFF" },
  { code: "ANJ", label: "Absence non justifiée", bg: "#111827", text: "#FFFFFF" },
  { code: "F", label: "Férié / Off", bg: "#9CA3AF", text: "#111111" },
  { code: "AB", label: "Abandon", bg: "#22C55E", text: "#FFFFFF" },
];
const HEURES_PAR_JOUR = 3;

function ajouterOuMajAbsence(absences: AbsenceRecord[] | undefined, cle: string, valeur: string): AbsenceRecord[] | null {
  if (valeur !== "A" && valeur !== "ANJ") return null;
  const motif = valeur === "A" ? MOTIF_JUSTIFIEE : MOTIF_NON_JUSTIFIEE;
  const liste = absences || [];
  const indexExistant = liste.findIndex((r) => r.date === cle);
  if (indexExistant === -1) return [...liste, { date: cle, motif }];
  if (liste[indexExistant].motif === motif) return null;
  return liste.map((r, i) => (i === indexExistant ? { ...r, motif } : r));
}

function versISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

function extraireDateFin(texte: string): Date | null {
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
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

function genererJoursOuvresEntre(debut: Date, fin: Date): Date[] {
  const jours: Date[] = [];
  const curseur = new Date(debut);
  while (curseur <= fin) {
    const jourSemaine = curseur.getDay();
    if (jourSemaine !== 0 && jourSemaine !== 6) jours.push(new Date(curseur));
    curseur.setDate(curseur.getDate() + 1);
  }
  return jours;
}

function decouperEnSemaines<T>(elements: T[], taille: number): T[][] {
  const semaines: T[][] = [];
  for (let i = 0; i < elements.length; i += taille) semaines.push(elements.slice(i, i + taille));
  return semaines;
}

// Duplicata générique de reponses/prfe/[id]/evolution — grille de suivi de
// présence, paramétrée par slug. Les codes d'activité détaillés (Game
// Design/Développement/...) propres au parcours Tech de PRFE sont
// remplacés par un simple code "Présent·e" générique (P), toute action
// n'ayant pas forcément de modules distincts à suivre jour par jour.
export default function EvolutionSessionPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const sessionId = decodeURIComponent(id || "");
  const permissions = usePermissions();

  const [schema, setSchema] = useState<ActionSchema | null>(null);
  const [apprenants, setApprenants] = useState<Apprenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [semainesFermees, setSemainesFermees] = useState<Set<number>>(new Set());
  const [globalFermee, setGlobalFermee] = useState(false);
  const [alerteANJ, setAlerteANJ] = useState<{ prenom: string; nom: string; nombre: number } | null>(null);
  // Code interne de la session (ex. "MN26_PRFE-91_01"), généré depuis la
  // page paramètres — jamais affiché sur le formulaire public, mais utile
  // ici pour identifier rapidement la session sans relire ses dates.
  const [codeSession, setCodeSession] = useState<string | null>(null);

  useEffect(() => {
    const charger = async () => {
      try {
        const [s, config] = await Promise.all([chargerSchema(slug), chargerConfiguration(slug)]);
        setSchema(s);
        if (s) {
          const snap = await getDocs(query(inscriptionsCollection(slug), orderBy("createdAt", "desc")));
          setApprenants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Apprenant)));
        }
        for (const [parcoursId, parTerritoire] of Object.entries(config.sessions)) {
          for (const [territoire, dates] of Object.entries(parTerritoire)) {
            if (dates.includes(sessionId)) {
              const code = config.codes[`${parcoursId}|${territoire}|${sessionId}`];
              if (code) setCodeSession(code);
            }
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des apprenant·e·s :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [slug, sessionId]);

  const apprenantsSession = useMemo(
    () => apprenants.filter((a) => a.Session === sessionId && a.Suivi_Recrutement && a.Decision_Recrutement === "OK").sort((a, b) => (a.Nom || "").localeCompare(b.Nom || "", "fr")),
    [apprenants, sessionId]
  );

  // Catégories ACTIVITÉ propres à l'action (modifiables depuis la page
  // paramètres, voir schema.categoriesEvolution), complétées par les 4 codes
  // structurels fixes du moteur (voir CODES_STRUCTURELS ci-dessus).
  const categoriesActivite: CategorieEvolution[] = schema?.categoriesEvolution && schema.categoriesEvolution.length > 0 ? schema.categoriesEvolution : CATEGORIE_EVOLUTION_DEFAUT;
  const CODES = useMemo(
    () => [{ code: "", label: "—", bg: "#FFFFFF", text: "#404040" }, ...categoriesActivite, ...CODES_STRUCTURELS],
    [categoriesActivite]
  );
  const CODES_PRESENCE = useMemo(() => categoriesActivite.map((c) => c.code), [categoriesActivite]);

  const semaines = useMemo(() => {
    const debut = extraireDateDebut(sessionId);
    const fin = extraireDateFin(sessionId);
    if (!debut || !fin) return [];
    return decouperEnSemaines(genererJoursOuvresEntre(debut, fin), 5);
  }, [sessionId]);

  const tousLesJours = useMemo(() => semaines.flat(), [semaines]);

  const mettreAJourCase = async (id: string, cle: string, valeur: string) => {
    const apprenant = apprenants.find((a) => a.id === id);

    if (valeur === "AB") {
      const joursSuivants = tousLesJours.map(versISO).filter((iso) => iso >= cle);
      const evolutionMaj = { ...(apprenant?.Evolution || {}) };
      joursSuivants.forEach((iso) => { evolutionMaj[iso] = "AB"; });
      setApprenants((prev) => prev.map((a) => (a.id === id ? { ...a, Evolution: evolutionMaj, Evolution_Actif: false } : a)));
      try {
        const champs: Record<string, string | boolean> = { Evolution_Actif: false };
        joursSuivants.forEach((iso) => { champs[`Evolution.${iso}`] = "AB"; });
        await updateDoc(inscriptionDoc(slug, id), champs);
      } catch (error) {
        console.error("Erreur lors de la mise à jour de l'évolution :", error);
      }
      return;
    }

    const absencesMaj = ajouterOuMajAbsence(apprenant?.Absences, cle, valeur);
    setApprenants((prev) => prev.map((a) => (a.id === id ? { ...a, Evolution: { ...a.Evolution, [cle]: valeur }, ...(absencesMaj ? { Absences: absencesMaj } : {}) } : a)));
    try {
      const champs: Record<string, string | AbsenceRecord[]> = { [`Evolution.${cle}`]: valeur };
      if (absencesMaj) champs.Absences = absencesMaj;
      await updateDoc(inscriptionDoc(slug, id), champs);
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'évolution :", error);
    }
    if (apprenant && valeur === "ANJ") {
      const nombre = Object.values({ ...apprenant.Evolution, [cle]: valeur }).filter((v) => v === "ANJ").length;
      if (nombre >= 2) setAlerteANJ({ prenom: apprenant.Prénom || "", nom: apprenant.Nom || "", nombre });
    }
  };

  const mettreAJourCaseGroupe = async (cle: string, valeur: string) => {
    const concernes = apprenantsSession.filter((a) => a.Evolution?.[cle] !== "AB");
    const idsConcernes = new Set(concernes.map((a) => a.id));
    const absencesParId = new Map(concernes.map((a) => [a.id, ajouterOuMajAbsence(a.Absences, cle, valeur)]));
    setApprenants((prev) => prev.map((a) => {
      if (!idsConcernes.has(a.id)) return a;
      const absencesMaj = absencesParId.get(a.id);
      return { ...a, Evolution: { ...a.Evolution, [cle]: valeur }, ...(absencesMaj ? { Absences: absencesMaj } : {}) };
    }));
    try {
      await Promise.all(concernes.map((a) => {
        const champs: Record<string, string | AbsenceRecord[]> = { [`Evolution.${cle}`]: valeur };
        const absencesMaj = absencesParId.get(a.id);
        if (absencesMaj) champs.Absences = absencesMaj;
        return updateDoc(inscriptionDoc(slug, a.id!), champs);
      }));
    } catch (error) {
      console.error("Erreur lors de la mise à jour groupée de l'évolution :", error);
    }
  };

  const mettreAJourRetard = async (id: string, cle: string, valeur: string) => {
    setApprenants((prev) => prev.map((a) => (a.id === id ? { ...a, Evolution_Retards: { ...a.Evolution_Retards, [cle]: valeur } } : a)));
    try {
      await updateDoc(inscriptionDoc(slug, id), { [`Evolution_Retards.${cle}`]: valeur });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du retard :", error);
    }
  };

  const basculerActif = async (id: string, valeur: boolean) => {
    setApprenants((prev) => prev.map((a) => (a.id === id ? { ...a, Evolution_Actif: valeur } : a)));
    try {
      await updateDoc(inscriptionDoc(slug, id), { Evolution_Actif: valeur });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'évolution :", error);
    }
  };

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

  const styleCode = (valeur?: string, retard?: string) => {
    const info = CODES.find((c) => c.code === (valeur || "")) || CODES[0];
    const heuresManquees = Math.max(0, Math.min(HEURES_PAR_JOUR, parseFloat((retard || "0").replace(",", ".")) || 0));
    if (CODES_PRESENCE.includes(info.code) && heuresManquees > 0) {
      const largeurRayures = Math.round((heuresManquees / HEURES_PAR_JOUR) * 100);
      return {
        backgroundColor: info.bg,
        backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0, rgba(255,255,255,0.55) 3px, transparent 3px, transparent 6px)",
        backgroundSize: `${largeurRayures}% 100%`,
        backgroundPosition: "right",
        backgroundRepeat: "no-repeat",
        color: info.text,
      };
    }
    return { backgroundColor: info.bg, color: info.text };
  };

  if (loading) {
    return <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>Chargement...</div>;
  }
  if (!schema) {
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
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">Évolution</h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                {schema.label} — Session : {sessionId || "—"}
                {codeSession && <span className="ml-1.5 font-mono font-bold text-[#005259] bg-[#005259]/10 px-1.5 py-0.5 rounded">{codeSession}</span>}
                {" "}— {apprenantsSession.length} apprenant{apprenantsSession.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link href={`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionId)}/apprenants`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" /><span>Apprenant·e·s</span>
            </Link>
            <Link href={`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionId)}/absences`} className="flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white px-3.5 py-2 rounded-xl transition-colors text-xs font-bold uppercase tracking-wider shadow-sm">
              <ClipboardDocumentListIcon className="w-4 h-4" /><span>Suivi des absences</span>
            </Link>
            {permissions?.role === "admin" && (
              <Link href={`/mediation/actions-collectives/inscription/${slug}/parametres`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm" title="Modifier les catégories d'évolution et autres réglages">
                <Cog6ToothIcon className="w-4 h-4 text-[#EA601F]" /><span>Paramètres</span>
              </Link>
            )}
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" /><span>Accueil</span>
            </Link>
          </div>
        </div>

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
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
            <button type="button" onClick={() => setGlobalFermee((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F3F3F2]/60 transition-colors cursor-pointer">
              <span className="text-xs font-bold uppercase tracking-widest text-[#005259]">Global</span>
              <ChevronDownIcon className={`w-4 h-4 text-[#EA601F] transition-transform duration-200 ${globalFermee ? "" : "rotate-180"}`} />
            </button>
            {!globalFermee && (
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
                        <td className="px-3 py-2 text-center font-bold text-[#005259]">{index === 0 && moyenneGroupe !== null ? `${moyenneGroupe.toFixed(2)}%` : ""}</td>
                        <td className="px-3 py-2 text-center font-bold">{a.Evolution_Actif && heuresPrevues > 0 ? heuresPresence.toFixed(2) : ""}</td>
                        <td className="px-3 py-2 text-center font-bold text-[#005259]">{a.Evolution_Actif && taux !== null ? `${taux.toFixed(2)}%` : ""}</td>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={a.Evolution_Actif || false} onChange={(e) => basculerActif(a.id!, e.target.checked)} className="w-4 h-4 accent-[#005259] cursor-pointer" />
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
            )}
          </div>

          {semaines.map((jours, indexSemaine) => {
            const fermee = semainesFermees.has(indexSemaine);
            return (
            <div key={indexSemaine} className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
              <button type="button" onClick={() => basculerSemaine(indexSemaine)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F3F3F2]/60 transition-colors cursor-pointer">
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
                      {jours.map((jour) => {
                        const iso = versISO(jour);
                        return (
                          <th key={iso} className="px-1 py-2 text-center border-l border-[#404040]/10 align-top">
                            <div className="mb-1">{JOURS_FR[jour.getDay()]} {String(jour.getDate()).padStart(2, "0")}/{String(jour.getMonth() + 1).padStart(2, "0")}</div>
                            <select
                              value=""
                              onChange={(e) => { if (e.target.value) mettreAJourCaseGroupe(iso, e.target.value); e.target.value = ""; }}
                              title="Applique ce code à tout le groupe pour ce jour — modifiable ensuite personne par personne sans répercussion"
                              className="w-full px-1 py-1 text-[9px] font-bold text-center outline-none cursor-pointer border border-[#404040]/15 rounded bg-white normal-case tracking-normal"
                            >
                              <option value="">Tout le groupe...</option>
                              {CODES.filter((c) => c.code).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                            </select>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]/5">
                    {apprenantsSession.map((a, index) => {
                      const taux = tauxSemaine(a, jours);
                      return (
                        <tr key={a.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                          <td className="px-3 py-2 text-center font-bold text-[#005259]">{a.Evolution_Actif && taux !== null ? `${taux.toFixed(2)}%` : ""}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={a.Evolution_Actif || false} onChange={(e) => basculerActif(a.id!, e.target.checked)} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                          </td>
                          <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{a.Prénom || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">{a.Nom || "—"}</td>
                          {jours.map((jour) => {
                            const iso = versISO(jour);
                            return (
                              <td key={iso} className="p-0 border-l border-[#404040]/10">
                                <select value={a.Evolution?.[iso] || ""} onChange={(e) => mettreAJourCase(a.id!, iso, e.target.value)} className="w-full px-1 py-2 text-[10px] font-bold text-center outline-none cursor-pointer border-0" style={styleCode(a.Evolution?.[iso], a.Evolution_Retards?.[iso])}>
                                  {CODES.map((c) => <option key={c.code} value={c.code}>{c.code || "—"}</option>)}
                                </select>
                                <input
                                  key={a.Evolution_Retards?.[iso] || ""}
                                  type="text"
                                  defaultValue={a.Evolution_Retards?.[iso] || ""}
                                  onBlur={(e) => mettreAJourRetard(a.id!, iso, e.target.value)}
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
          </>
        )}

      </div>

      {alerteANJ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center space-y-4">
            <ExclamationTriangleIcon className="w-10 h-10 text-[#EA601F] mx-auto" />
            <p className="text-sm font-medium text-[#404040]">
              {alerteANJ.prenom} {alerteANJ.nom} totalise désormais {alerteANJ.nombre} absences non justifiées sur cette session. Ce point mérite d'être signalé à votre coordinateur.
            </p>
            <button type="button" onClick={() => setAlerteANJ(null)} className="bg-[#005259] hover:bg-[#00363a] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer">
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </main>
    </PageGuard>
  );
}

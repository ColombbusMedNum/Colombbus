// Modèles d'activités (collection Firestore "activites_types"), partagés
// entre la sidebar de l'agenda (app/agenda/page.tsx) et la page dédiée
// app/mediation/modeles/page.tsx — les deux doivent rester en phase, d'où
// cette source unique pour le type, le calcul des jours fériés et le moteur
// de génération automatique de créneaux.

import { db } from "./firebase";
import {
  collection, query, where, getDocs, addDoc, doc, writeBatch, getDoc,
} from "firebase/firestore";
import type { Mediateur } from "./types";
import { identifiantMediateur } from "./matchMediateur";

// Modèles protégés contre la suppression accidentelle (RN/RND, fondateurs de
// la liaison Suresnes — voir isSuresnesAction ci-dessous — ainsi que TERRAGE
// et MASSY, dont les créneaux ACI utilisent la grille horaire personnelle de
// chacun plutôt que les horaires du modèle, voir genererCreneauxPourModele).
export function estModeleProtege(lieu?: string): boolean {
  const upper = (lieu || "").toUpperCase();
  return upper.includes("RN") || upper.includes("TERRAGE") || upper.includes("MASSY");
}

export interface ActiviteType {
  id?: string;
  lieu: string;
  // Horaires "legacy" (un seul couple pour toute la journée), conservés en
  // lecture pour les modèles créés avant la scission matin/après-midi —
  // resoudreHoraireModele() s'en sert de repli quand le champ du moment
  // demandé (ci-dessous) est vide. Les nouveaux/modifiés modèles n'écrivent
  // plus que debutMatin/finMatin/debutApresMidi/finApresMidi.
  debut?: string;
  fin?: string;
  debutMatin?: string;
  finMatin?: string;
  debutApresMidi?: string;
  finApresMidi?: string;
  // Coché quand ce modèle représente une plage horaire continue sur toute la
  // journée (ex. Congés) plutôt que deux demi-journées distinctes — sert
  // uniquement à ouvrir automatiquement l'accordéon "Horaires" à l'édition,
  // sans influer sur la résolution des horaires elle-même (voir
  // resoudreHoraireModele, toujours basée sur debutMatin/finMatin et
  // debutApresMidi/finApresMidi).
  journeeComplete?: boolean;
  // Tag texte (ex. "#accueil", "#Accompagnement") ajouté en préfixe du titre
  // de l'événement Google Agenda créé pour ce modèle (voir construireEvenement
  // dans functions/src/index.ts) — sert à catégoriser l'action pour les
  // besoins d'intégration aux agendas ACI, indépendamment du lieu affiché.
  codeACI?: string;
  // Code interne Colombbus (ex. "REC", "MEDNUM"...) — sert uniquement à
  // regrouper les heures dans Volume Horaire par grande catégorie interne,
  // indépendamment du lieu/de l'activité précise (voir
  // app/mediation/volume-horaire/page.tsx, "Regroupement par code interne").
  codeInterne?: string;
  adresse: string;
  territoire: string;
  couleur: string;
  codeAnalytique: string;
  dateDebut: string;
  dateFin: string;
  blocs?: string[];
  // Si renseigné, le modèle ne concerne que ces médiateurs (par id) : il
  // disparaît de la sidebar/de la sélection pour les autres, et des
  // créneaux sont générés automatiquement pour eux (voir
  // genererCreneauxPourModele) sur les jours ouvrés de [dateDebut, dateFin].
  mediateursIds?: string[];
  // Moment(s) concerné(s) par la génération automatique. Absent/"Les deux"
  // = Matin + Après-midi.
  generationMoment?: "Matin" | "Après-midi" | "Les deux";
  // Jours précis (YYYY-MM-DD) où ce modèle a effectivement lieu, pour les
  // activités récurrentes mais irrégulières (ex: "Quintinie" un mardi sur
  // deux) qu'une période continue [dateDebut, dateFin] représenterait mal.
  // Si renseigné, prime sur dateDebut/dateFin pour décider si le modèle
  // apparaît dans la sidebar de l'agenda une semaine donnée (voir
  // estVisibleCetteSemaine) — ne déclenche PAS de génération automatique
  // de créneaux, contrairement à dateDebut/dateFin.
  datesActives?: string[];
  // Coché si ce modèle correspond à de la production Médiation Numérique
  // (par opposition aux congés, réunions internes, etc.) — copié sur chaque
  // créneau généré depuis ce modèle pour permettre un filtrage ultérieur
  // (ex volume horaire de production) sans avoir à ré-identifier le modèle.
  estProduction?: boolean;
  // Coché quand ce modèle, bien qu'en production pour les permanents, est
  // pour un·e ACI de l'observation (accompagnement aux horaires habituels) :
  // copié sur chaque créneau généré, il fait que
  // calculerHeuresComplementairesACI (lib/planningHours.ts) ne compte jamais
  // d'heures complémentaires pour un ACI dessus, quels que soient les
  // horaires réels du créneau. observationACIDateFin borne cette exonération
  // dans le temps (ex: l'ACI reprend progressivement la main sur l'action) —
  // sans date, elle s'applique indéfiniment.
  observationACI?: boolean;
  observationACIDateFin?: string;
  // Archivé manuellement (page Modèles) ou automatiquement dès que dateFin
  // est dépassée (voir estModeleExpire, appliqué au chargement dans
  // app/mediation/modeles/page.tsx et app/agenda/page.tsx) — un modèle
  // archivé disparaît des listes par défaut mais reste consultable dans
  // l'onglet "Archivés" ; les créneaux déjà posés depuis ce modèle ne sont
  // jamais affectés.
  archive?: boolean;
}

// Un modèle à date de fin dépassée n'a plus lieu d'être proposé pour de
// nouveaux créneaux — sert à l'archivage automatique (voir ci-dessus). Un
// modèle sans dateFin (récurrent/permanent) n'expire jamais tout seul.
export function estModeleExpire(modele: ActiviteType): boolean {
  if (!modele.dateFin) return false;
  return modele.dateFin < new Date().toLocaleDateString('en-CA');
}

// Horaires des créneaux "Suresnes" (consultations individuelles de 1h30)
// posés dans planning_suresnes pour un site RN donné — Massy (91 - RN,
// site "rn91") démarre sa demi-journée du matin une heure plus tôt que
// Suresnes (92 - RN). L'après-midi est identique sur les deux sites.
export function horairesSuresnesPourSite(
  site: "rn91" | "suresnes",
  moment: "Matin" | "Après-midi"
): string[] {
  if (moment === "Après-midi") return ["14h00 - 15h30", "15h30 - 17h00"];
  return site === "rn91" ? ["09h00 - 10h30", "10h30 - 12h00"] : ["10h00 - 11h30", "11h30 - 13h00"];
}

// Horaire à appliquer à un créneau "Matin" ou "Après-midi" posé depuis ce
// modèle : priorité aux champs dédiés au moment, repli sur l'ancien couple
// unique debut/fin (modèles non encore réenregistrés depuis la scission).
export function resoudreHoraireModele(
  modele: Pick<ActiviteType, "debut" | "fin" | "debutMatin" | "finMatin" | "debutApresMidi" | "finApresMidi">,
  moment: "Matin" | "Après-midi"
): { debut: string; fin: string } | null {
  if (moment === "Matin" && modele.debutMatin && modele.finMatin) {
    return { debut: modele.debutMatin, fin: modele.finMatin };
  }
  if (moment === "Après-midi" && modele.debutApresMidi && modele.finApresMidi) {
    return { debut: modele.debutApresMidi, fin: modele.finApresMidi };
  }
  if (modele.debut && modele.fin) return { debut: modele.debut, fin: modele.fin };
  return null;
}

// Découpe l'horaire journalier d'une grille ACI (un seul couple début/fin,
// ex. 09:00-17:00 — voir configuration_equipe/parametres_horaires) en sa
// moitié Matin ou Après-midi, de part et d'autre d'une pause méridienne
// TOUJOURS fixée à 13h00-14h00, indépendamment de l'horaire du modèle posé.
// Renvoie null si la grille ne couvre pas du tout cette demi-journée (ex.
// grille finissant à 12h30 : pas d'après-midi ce jour-là pour cette
// personne).
export function decouperGrilleACI(
  grille: { debut: string; fin: string },
  moment: "Matin" | "Après-midi"
): { debut: string; fin: string } | null {
  if (moment === "Matin") {
    return grille.debut < "13:00" ? { debut: grille.debut, fin: "13:00" } : null;
  }
  return grille.fin > "14:00" ? { debut: "14:00", fin: grille.fin } : null;
}

// Résout, pour un médiateur ACI positionné sur un lieu à grille horaire
// dédiée (TERRAGE -> toujours Paris, MASSY -> toujours Massy, RN Observation
// -> le rattachement personnel de la personne), l'horaire de sa demi-journée
// pour une date et un moment donnés — découpé en Matin/Après-midi via
// decouperGrilleACI. Point d'entrée unique, utilisé à la fois à la création
// d'un créneau (processActionCreation, genererCreneauxPourModele) et lors de
// la répercussion d'une modification de modèle sur les créneaux déjà posés
// (sans quoi ces derniers repartaient sur l'horaire brut du modèle, écrasant
// la grille personnelle de l'ACI). Renvoie null si le lieu ne concerne pas ce
// mécanisme, si la personne n'est pas ACI, ou si sa grille ne couvre pas
// cette demi-journée.
export function resoudreHoraireGrilleACI(
  lieu: string,
  med: Pick<Mediateur, "statut" | "rattachementHoraireACI"> | undefined,
  dateStr: string,
  moment: "Matin" | "Après-midi",
  grillesHorairesACI: Record<string, Record<string, { debut: string; fin: string }>> | null | undefined
): { debut: string; fin: string } | null {
  if (!med || med.statut !== "ACI" || !grillesHorairesACI) return null;
  const upperLieu = (lieu || "").toUpperCase();
  const estTerrage = upperLieu.includes("TERRAGE");
  const estMassyLieu = upperLieu.includes("MASSY");
  const estObservation = upperLieu.includes("OBSERVATION");
  if (!estTerrage && !estMassyLieu && !estObservation) return null;
  const site = estTerrage ? "Paris" : estMassyLieu ? "Massy" : (med.rattachementHoraireACI || "Paris");
  const joursParIndex = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const jourKey = joursParIndex[new Date(`${dateStr}T00:00:00`).getDay()];
  const h = grillesHorairesACI[site]?.[jourKey];
  if (!h?.debut || !h?.fin) return null;
  return decouperGrilleACI(h, moment);
}

// Variante d'affichage de resoudreHoraireModele, pour les listes/cartes de
// modèles (sidebar agenda, page Modèles, page Adresses) : un modèle legacy
// (pas encore réenregistré avec des champs dédiés matin/après-midi, "Journée
// complète" non cochée) affichait sinon le même horaire unique dupliqué sur
// les deux lignes Matin/Après-midi, ce qui est trompeur puisqu'il ne
// concernait en réalité souvent qu'une seule des deux (ex: 14h30-17h30 posé
// uniquement l'après-midi). On devine alors la demi-journée réellement
// concernée à partir de l'heure de début historique (avant 13h = matin,
// sinon après-midi) et on laisse l'autre ligne vide plutôt que de deviner à
// tort en dupliquant. N'affecte jamais la résolution réelle d'un horaire
// posé sur un créneau (resoudreHoraireModele reste inchangée pour ça).
export function resoudreHoraireAffichage(
  modele: Pick<ActiviteType, "debut" | "fin" | "debutMatin" | "finMatin" | "debutApresMidi" | "finApresMidi" | "journeeComplete">,
  moment: "Matin" | "Après-midi"
): { debut: string; fin: string } | null {
  const champsDedies = moment === "Matin"
    ? !!(modele.debutMatin && modele.finMatin)
    : !!(modele.debutApresMidi && modele.finApresMidi);
  if (champsDedies) return resoudreHoraireModele(modele, moment);

  if (!modele.debut || !modele.fin) return null;
  if (modele.journeeComplete) return { debut: modele.debut, fin: modele.fin };

  const estMatin = modele.debut < "13:00";
  if (estMatin === (moment === "Matin")) return { debut: modele.debut, fin: modele.fin };
  return null;
}

// Un modèle est-il visible dans la sidebar de l'agenda pour la semaine
// [startOfWeekStr, endOfWeekStr] (toutes deux au format YYYY-MM-DD) ?
// datesActives, si renseigné, remplace complètement la logique de période
// continue (les deux mécanismes ne se combinent pas sur un même modèle).
export function estVisibleCetteSemaine(
  modele: ActiviteType,
  startOfWeekStr: string,
  endOfWeekStr: string
): boolean {
  if (modele.datesActives && modele.datesActives.length > 0) {
    return modele.datesActives.some((d) => d >= startOfWeekStr && d <= endOfWeekStr);
  }
  if (modele.dateDebut && endOfWeekStr < modele.dateDebut) return false;
  if (modele.dateFin && startOfWeekStr > modele.dateFin) return false;
  return true;
}

// Blocs thématiques : un modèle peut être rattaché à plusieurs à la fois.
export const BLOCS_THEMATIQUES = [
  { id: "inclusion", nom: "Inclusion Numérique", couleur: "#0F6B72" },
  { id: "decouverte", nom: "Découverte Métiers", couleur: "#B8863A" },
  { id: "insertion", nom: "Insertion Professionnelle", couleur: "#7A5A9E" },
  { id: "divers", nom: "Divers", couleur: "#5C7A8A" },
];

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Jours fériés français légaux pour une année donnée, au format YYYY-MM-DD
// (comme dateStr, calculé via toLocaleDateString('en-CA') partout ailleurs).
// Le Lundi de Pentecôte est volontairement exclu : c'est la seule journée
// travaillée dans ce planning (journée de solidarité).
export function getJoursFeries(year: number): Set<string> {
  const addDays = (date: Date, n: number) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + n);
    return copy;
  };
  const toStr = (date: Date) => date.toLocaleDateString('en-CA');

  const paques = getEasterSunday(year);

  return new Set([
    toStr(new Date(year, 0, 1)),      // Jour de l'An
    toStr(addDays(paques, 1)),        // Lundi de Pâques
    toStr(new Date(year, 4, 1)),      // Fête du Travail
    toStr(new Date(year, 4, 8)),      // Victoire 1945
    toStr(addDays(paques, 39)),       // Ascension
    toStr(new Date(year, 6, 14)),     // Fête Nationale
    toStr(new Date(year, 7, 15)),     // Assomption
    toStr(new Date(year, 10, 1)),     // Toussaint
    toStr(new Date(year, 10, 11)),    // Armistice
    toStr(new Date(year, 11, 25)),    // Noël
  ]);
}

export function formatDateFr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateFrCourt(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

export interface ResultatGeneration {
  crees: number;
  ignores: number;
}

// Estime, sans rien écrire, le nombre de créneaux (jours ouvrés × moments ×
// médiateurs) qu'une génération produirait au maximum — utilisé pour
// afficher un ordre de grandeur dans la boîte de confirmation avant de
// lancer réellement genererCreneauxPourModele.
export function estimerNombreCreneaux(modele: ActiviteType): number {
  if (!modele.mediateursIds?.length || !modele.dateDebut || !modele.dateFin) return 0;
  const debut = new Date(`${modele.dateDebut}T00:00:00`);
  const fin = new Date(`${modele.dateFin}T00:00:00`);
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime()) || debut > fin) return 0;

  const joursFeries = new Set<string>();
  for (let annee = debut.getFullYear(); annee <= fin.getFullYear(); annee++) {
    getJoursFeries(annee).forEach((d) => joursFeries.add(d));
  }

  let joursOuvres = 0;
  for (let d = new Date(debut); d <= fin; d.setDate(d.getDate() + 1)) {
    const jourSemaine = d.getDay();
    if (jourSemaine === 0 || jourSemaine === 6) continue;
    if (joursFeries.has(d.toLocaleDateString('en-CA'))) continue;
    joursOuvres++;
  }

  const nbMoments = modele.generationMoment === "Matin" || modele.generationMoment === "Après-midi" ? 1 : 2;
  return joursOuvres * nbMoments * modele.mediateursIds.length;
}

// Génère automatiquement les créneaux (planning_mediateurs, + planning_suresnes
// si le lieu du modèle est un lieu Suresnes RN/RND) pour un modèle limité à
// des médiateurs et une période données. Jours ouvrés uniquement (Lun-Ven,
// hors jours fériés français). Ne touche JAMAIS un créneau déjà existant
// pour un médiateur/jour/moment donné : il est simplement ignoré. Cela rend
// la fonction sûre à ré-appeler après modification du modèle (ajout d'un
// médiateur, extension de la période) — seule la différence est comblée,
// rien n'est jamais supprimé ou écrasé.
export async function genererCreneauxPourModele(
  modele: ActiviteType,
  mediateurs: Mediateur[]
): Promise<ResultatGeneration> {
  if (!modele.mediateursIds?.length || !modele.dateDebut || !modele.dateFin) {
    return { crees: 0, ignores: 0 };
  }

  const moments: string[] =
    modele.generationMoment === "Matin" || modele.generationMoment === "Après-midi"
      ? [modele.generationMoment]
      : ["Matin", "Après-midi"];

  const debut = new Date(`${modele.dateDebut}T00:00:00`);
  const fin = new Date(`${modele.dateFin}T00:00:00`);
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime()) || debut > fin) {
    return { crees: 0, ignores: 0 };
  }

  const joursFeries = new Set<string>();
  for (let annee = debut.getFullYear(); annee <= fin.getFullYear(); annee++) {
    getJoursFeries(annee).forEach((d) => joursFeries.add(d));
  }

  const dates: string[] = [];
  for (let d = new Date(debut); d <= fin; d.setDate(d.getDate() + 1)) {
    const jourSemaine = d.getDay();
    if (jourSemaine === 0 || jourSemaine === 6) continue;
    const dateStr = d.toLocaleDateString('en-CA');
    if (joursFeries.has(dateStr)) continue;
    dates.push(dateStr);
  }
  if (dates.length === 0) return { crees: 0, ignores: 0 };

  const mediateursConcernes = mediateurs.filter((m) => modele.mediateursIds!.includes(m.id));
  if (mediateursConcernes.length === 0) return { crees: 0, ignores: 0 };

  // Un seul aller-retour Firestore pour connaître les créneaux déjà posés sur
  // toute la période (tous médiateurs confondus), plutôt qu'une requête par
  // médiateur/jour/moment.
  const snapExistant = await getDocs(
    query(
      collection(db, "planning_mediateurs"),
      where("date", ">=", modele.dateDebut),
      where("date", "<=", modele.dateFin)
    )
  );
  // Indexé par identifiant ET par nom complet (quand ils diffèrent) pour ne
  // pas dupliquer un créneau existant sur un vieux document n'ayant que l'un
  // des deux champs — voir lib/matchMediateur.ts.
  const occupes = new Set<string>();
  snapExistant.docs.forEach((d) => {
    const data = d.data();
    const id = identifiantMediateur(data);
    if (id) occupes.add(`${id}_${data.date}_${data.moment}`);
    if (data.mediateurNom && data.mediateurNom !== id) {
      occupes.add(`${data.mediateurNom}_${data.date}_${data.moment}`);
    }
  });

  const upperLieu = (modele.lieu || "").toUpperCase();
  // "RN Observation" (accompagnement d'un médiateur en observation, pas de
  // permanence ouverte au public) ne doit pas générer de créneaux Suresnes.
  const isSuresnesAction = (upperLieu.includes("RN") || upperLieu.includes("RND")) && !upperLieu.includes("OBSERVATION");
  const isRND = upperLieu.includes("RND");
  // Un même agenda planning_suresnes héberge plusieurs sites RN, distingués
  // par le numéro de département dans le nom du modèle : "91" (Essonne) va
  // sur le site "rn91", tout le reste ("RN Suresnes", "92 - RN"...) reste
  // sur "suresnes" — voir app/mediation/rencontres-numeriques/suresnes.
  const siteSuresnes = upperLieu.includes("91") ? "rn91" : "suresnes";

  // Sur TERRAGE et MASSY, un médiateur ACI travaille selon sa propre grille
  // horaire (configuration_equipe/parametres_horaires) plutôt que selon les
  // horaires fixes du modèle — TERRAGE suit toujours la grille Paris, MASSY
  // toujours la grille Massy, indépendamment du rattachement personnel de
  // chacun. RN Observation suit la même logique, mais son lieu ne désigne
  // pas un site physique précis : on utilise donc le rattachement personnel
  // (rattachementHoraireACI, "Paris" par défaut) de chaque ACI concerné.
  const estTerrage = upperLieu.includes("TERRAGE");
  const estMassyLieu = upperLieu.includes("MASSY");
  const estObservation = upperLieu.includes("OBSERVATION");
  let grillesHorairesACI: Record<string, Record<string, { debut: string; fin: string }>> | null = null;
  if (estTerrage || estMassyLieu || estObservation) {
    const snapHoraires = await getDoc(doc(db, "configuration_equipe", "parametres_horaires"));
    grillesHorairesACI = snapHoraires.exists() ? (snapHoraires.data() as any) : null;
  }

  let crees = 0;
  let ignores = 0;
  let batch = writeBatch(db);
  let opsDansBatch = 0;

  const commitSiPlein = async () => {
    // Limite Firestore : 500 opérations par batch, marge de sécurité à 450.
    if (opsDansBatch >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opsDansBatch = 0;
    }
  };

  for (const med of mediateursConcernes) {
    const nomComplet = `${med.prenom || ""} ${med.nom || ""}`.trim();
    let creesPourCeMed = 0;

    for (const dateStr of dates) {
      for (const moment of moments) {
        if (occupes.has(`${med.id}_${dateStr}_${moment}`) || occupes.has(`${nomComplet}_${dateStr}_${moment}`)) {
          ignores++;
          continue;
        }

        const horaireOverride = resoudreHoraireGrilleACI(modele.lieu, med, dateStr, moment as "Matin" | "Après-midi", grillesHorairesACI);
        const horaireCreneau = horaireOverride || resoudreHoraireModele(modele, moment as "Matin" | "Après-midi");

        const ref = doc(collection(db, "planning_mediateurs"));
        batch.set(ref, {
          mediatId: med.id,
          mediateurNom: nomComplet,
          moment,
          date: dateStr,
          lieu: modele.lieu,
          type: "Action",
          commentaire: "",
          couleur: modele.couleur || "#005259",
          ...(modele.adresse ? { adresse: modele.adresse } : {}),
          ...(horaireCreneau ? { debut: horaireCreneau.debut, fin: horaireCreneau.fin } : {}),
          ...(modele.territoire ? { territoire: modele.territoire } : {}),
          ...(modele.codeAnalytique ? { codeAnalytique: modele.codeAnalytique } : {}),
          ...(modele.codeACI ? { codeACI: modele.codeACI } : {}),
          ...(modele.codeInterne ? { codeInterne: modele.codeInterne } : {}),
          ...(modele.observationACI ? { observationACI: true } : {}),
          ...(modele.observationACI && modele.observationACIDateFin
            ? { observationACIDateFin: modele.observationACIDateFin }
            : {}),
        });
        crees++;
        creesPourCeMed++;
        opsDansBatch++;
        await commitSiPlein();

        if (isSuresnesAction) {
          const horaires = horairesSuresnesPourSite(siteSuresnes, moment as "Matin" | "Après-midi");
          const nomAvecType = siteSuresnes === "rn91" ? `${nomComplet} (RN91)` : isRND ? `${nomComplet} (RND)` : `${nomComplet} (RN)`;
          for (const h of horaires) {
            const refS = doc(collection(db, "planning_suresnes"));
            batch.set(refS, { mediateurNom: nomAvecType, date: dateStr, moment, horaire: h, usager: "", site: siteSuresnes });
            opsDansBatch++;
            await commitSiPlein();
          }
        }
      }
    }

    if (creesPourCeMed > 0) {
      await addDoc(collection(db, "notifications"), {
        destinataireId: med.id,
        message: `📅 Planning généré : vous êtes planifié(e) sur "${modele.lieu}" du ${formatDateFr(modele.dateDebut)} au ${formatDateFr(modele.dateFin)} (jours ouvrés${moments.length === 2 ? "" : `, ${moments[0]}`}).`,
        createdAt: Date.now(),
        lue: false,
      });
    }
  }

  if (opsDansBatch > 0) await batch.commit();

  return { crees, ignores };
}

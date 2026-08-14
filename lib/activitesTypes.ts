// Modèles d'activités (collection Firestore "activites_types"), partagés
// entre la sidebar de l'agenda (app/agenda/page.tsx) et la page dédiée
// app/mediation/modeles/page.tsx — les deux doivent rester en phase, d'où
// cette source unique pour le type, le calcul des jours fériés et le moteur
// de génération automatique de créneaux.

import { db } from "./firebase";
import {
  collection, query, where, getDocs, addDoc, doc, writeBatch,
} from "firebase/firestore";
import type { Mediateur } from "./types";
import { identifiantMediateur } from "./matchMediateur";

export interface ActiviteType {
  id?: string;
  lieu: string;
  debut: string;
  fin: string;
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

function formatDateFr(dateStr: string): string {
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
  const isSuresnesAction = upperLieu.includes("RN") || upperLieu.includes("RND");
  const isRND = upperLieu.includes("RND");

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
          ...(modele.debut ? { debut: modele.debut, fin: modele.fin } : {}),
          ...(modele.territoire ? { territoire: modele.territoire } : {}),
          ...(modele.codeAnalytique ? { codeAnalytique: modele.codeAnalytique } : {}),
        });
        crees++;
        creesPourCeMed++;
        opsDansBatch++;
        await commitSiPlein();

        if (isSuresnesAction) {
          const horaires = moment === "Matin" ? ["10h00 - 11h30", "11h30 - 13h00"] : ["14h00 - 15h30", "15h30 - 17h00"];
          const nomAvecType = isRND ? `${nomComplet} (RND)` : `${nomComplet} (RN)`;
          for (const h of horaires) {
            const refS = doc(collection(db, "planning_suresnes"));
            batch.set(refS, { mediateurNom: nomAvecType, date: dateStr, moment, horaire: h, usager: "" });
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

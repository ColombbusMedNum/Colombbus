// Suivi des heures d'arrivée/départ des salariés en insertion (ACI), saisi
// par un permanent (médiateur ou coordinateur) — jamais par l'ACI lui-même,
// voir firestore.rules (isPermanentOuPlus()). Un document par (ACI, jour),
// id = `${uid}_${date}` pour un upsert simple sans avoir à chercher d'abord
// si le document existe déjà.

import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { calculerDureeHeures, timeToMinutes } from "@/lib/planningHours";

const JOURS_SEMAINE = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export interface PointageACI {
  id: string;
  uid: string;
  date: string; // YYYY-MM-DD
  arrivee?: string; // HH:MM
  depart?: string; // HH:MM
  saisiPar?: string;
  misAJourLe?: string;
}

function refPointage(uid: string, date: string) {
  return doc(db, "pointages_aci", `${uid}_${date}`);
}

export function ecouterPointagesDuJour(date: string, callback: (pointages: PointageACI[]) => void) {
  const q = query(collection(db, "pointages_aci"), where("date", "==", date));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PointageACI, "id">) })));
  });
}

// Pour le récapitulatif par période de paie — bornes incluses.
export function ecouterPointagesPeriode(dateDebut: string, dateFin: string, callback: (pointages: PointageACI[]) => void) {
  const q = query(collection(db, "pointages_aci"), where("date", ">=", dateDebut), where("date", "<=", dateFin));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PointageACI, "id">) })));
  });
}

export interface HorairesJour { debut: string; fin: string }
export type GrilleHoraireACI = Record<string, HorairesJour>; // clé = jour en minuscules ("lundi"...)
export type GrillesHorairesParSite = Record<string, GrilleHoraireACI>; // clé = "Paris" | "Massy"

// Même document que /mediation/parametres (configuration_equipe/parametres_horaires)
// et que app/mediation/volume-horaire/page.tsx — seule source des horaires de
// référence ACI par site, pour ne jamais désynchroniser "prévu" et "réel".
export function ecouterGrillesHorairesACI(callback: (grilles: GrillesHorairesParSite) => void) {
  return onSnapshot(doc(db, "configuration_equipe", "parametres_horaires"), (snap) => {
    callback((snap.data() as GrillesHorairesParSite) || {});
  });
}

// Horaires de référence (grille Paris/Massy) pour un ACI à une date donnée —
// null le week-end ou si la grille ne couvre pas ce jour (pas de comparaison
// retard/heures en trop possible dans ce cas).
export function horairesNormauxDuJour(grilles: GrillesHorairesParSite, site: string, dateISO: string): HorairesJour | null {
  const jour = JOURS_SEMAINE[new Date(`${dateISO}T00:00:00`).getDay()];
  return grilles[site]?.[jour] || null;
}

function versMinutes(horaire?: string): number | null {
  if (!horaire) return null;
  const [h, m] = horaire.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

// Minutes de retard : arrivée réelle après l'heure normale de début (0 sinon
// ou si l'une des deux horaires manque).
export function minutesRetard(normal: HorairesJour | null, arrivee?: string): number {
  const debutNormal = versMinutes(normal?.debut);
  const arriveeMin = versMinutes(arrivee);
  if (debutNormal === null || arriveeMin === null) return 0;
  return Math.max(0, arriveeMin - debutNormal);
}

// Minutes en trop : départ réel après l'heure normale de fin (0 sinon ou si
// l'une des deux horaires manque).
export function minutesEnTrop(normal: HorairesJour | null, depart?: string): number {
  const finNormal = versMinutes(normal?.fin);
  const departMin = versMinutes(depart);
  if (finNormal === null || departMin === null) return 0;
  return Math.max(0, departMin - finNormal);
}

// "Réellement en trop" : le dépassement d'horaire (départ tardif) qui reste
// une fois qu'on a soustrait le retard du jour — un ACI arrivé et reparti en
// retard de la même durée n'a pas fait d'heures en plus, juste décalé sa
// journée. Sans ce calcul, "Heures en trop" et "Retard" restent indépendants
// (un départ tardif compte en trop même s'il ne fait que rattraper un
// retard), ce qui reste affiché à côté pour ne pas masquer qu'un retard a eu
// lieu ce jour-là.
export function minutesReellementEnTrop(retard: number, enTrop: number): number {
  return Math.max(0, enTrop - retard);
}

export function formaterMinutes(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export async function enregistrerPointage(uid: string, date: string, champ: "arrivee" | "depart", valeur: string, saisiPar: string) {
  await setDoc(
    refPointage(uid, date),
    { uid, date, [champ]: valeur, saisiPar, misAJourLe: new Date().toISOString() },
    { merge: true }
  );
}

// Durée nette réellement travaillée (en heures), pause méridienne déduite si
// l'amplitude arrivée→départ l'englobe entièrement (règle validée partout
// ailleurs dans l'app, voir lib/planningHours.ts) — jamais le simple écart
// d'horloge, sinon deux salarié·e·s avec la même amplitude mais une pause
// réelle différente afficheraient la même "durée travaillée".
function dureeNetteHeures(arrivee?: string, depart?: string, lieu?: string): number | null {
  if (!arrivee || !depart) return null;
  if (timeToMinutes(depart) <= timeToMinutes(arrivee)) return null; // saisie en cours ou erronée
  return calculerDureeHeures(arrivee, depart, lieu);
}

export function formaterHeuresDecimal(heures: number): string {
  const totalMin = Math.round(heures * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// Durée affichée dans le tableau de pointage — nette de pause méridienne.
export function dureeTravaillee(arrivee?: string, depart?: string, lieu?: string): string {
  const h = dureeNetteHeures(arrivee, depart, lieu);
  return h === null ? "—" : formaterHeuresDecimal(h);
}

// Écart signé (en heures) entre la durée nette réellement travaillée et la
// durée nette normalement prévue par la grille Paris/Massy — ex. +0.5 = une
// demi-heure de plus que prévu, la pause méridienne étant déduite des deux
// côtés avant comparaison (sinon un simple décalage identique arrivée+départ
// ferait apparaître un écart alors qu'aucune pause ne change la donne).
export function ecartDureeLegale(arrivee: string | undefined, depart: string | undefined, normal: HorairesJour | null, lieu?: string): number | null {
  const net = dureeNetteHeures(arrivee, depart, lieu);
  if (net === null || !normal) return null;
  const netNormal = calculerDureeHeures(normal.debut, normal.fin, lieu);
  return net - netNormal;
}

export function formaterEcartHeures(ecart: number): string {
  if (Math.abs(ecart) < 1 / 60) return "";
  const signe = ecart > 0 ? "+" : "-";
  return `${signe}${formaterHeuresDecimal(Math.abs(ecart))}`;
}

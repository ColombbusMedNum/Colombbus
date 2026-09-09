// Accès Firestore pour le moteur "actions personnalisées" — tout est
// regroupé sous dynamic_actions/{slug}/... (voir lib/dynamicActions/types.ts
// pour l'explication du choix de ce chemin imbriqué, nécessaire pour que
// firestore.rules puisse couvrir toute future action avec une seule règle).

import { db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";
import { ActionSchema, NIVEAUX_ETUDES_DEFAUT, TERRITOIRES_DEFAUT } from "./types";

export interface Parcours {
  id: string;
  label: string;
}

const PARCOURS_DEFAUT: Parcours[] = [{ id: "parcours-principal", label: "Parcours principal" }];

export function refSchema(slug: string) {
  return doc(db, "dynamic_actions", slug);
}

export async function chargerSchema(slug: string): Promise<ActionSchema | null> {
  const snap = await getDoc(refSchema(slug));
  if (!snap.exists()) return null;
  return snap.data() as ActionSchema;
}

export async function sauvegarderSchema(schema: ActionSchema): Promise<void> {
  await setDoc(refSchema(schema.slug), { ...schema, updatedAt: Date.now() });
}

export function ecouterActionsDynamiques(callback: (actions: ActionSchema[]) => void): Unsubscribe {
  return onSnapshot(collection(db, "dynamic_actions"), (snap) => {
    callback(snap.docs.map((d) => d.data() as ActionSchema));
  });
}

export async function listerActionsDynamiques(): Promise<ActionSchema[]> {
  const snap = await getDocs(collection(db, "dynamic_actions"));
  return snap.docs.map((d) => d.data() as ActionSchema);
}

function refConfig(slug: string, id: string) {
  return doc(db, "dynamic_actions", slug, "configuration", id);
}

export interface ConfigurationChargee {
  parcoursListe: Parcours[];
  territoiresListe: string[];
  sessions: Record<string, Record<string, string[]>>; // [parcoursId][territoire] = dates
  codes: Record<string, string>;
  logosParTerritoire: Record<string, string[]>;
  programmes: Record<string, { storagePath: string; url: string }[]>;
  niveauxEtudes: string[];
}

export async function chargerConfiguration(slug: string): Promise<ConfigurationChargee> {
  const [snapParcours, snapTerritoires, snapSessions, snapLogos, snapProgrammes, snapNiveaux] = await Promise.all([
    getDoc(refConfig(slug, "parcours")),
    getDoc(refConfig(slug, "territoires")),
    getDoc(refConfig(slug, "sessions")),
    getDoc(refConfig(slug, "logosFormulaire")),
    getDoc(refConfig(slug, "programmes")),
    getDoc(refConfig(slug, "niveauxEtudes")),
  ]);

  const parcoursListe = snapParcours.exists() && Array.isArray(snapParcours.data().liste) && snapParcours.data().liste.length > 0
    ? snapParcours.data().liste
    : PARCOURS_DEFAUT;
  const territoiresListe = snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0
    ? snapTerritoires.data().liste
    : TERRITOIRES_DEFAUT;
  const sessions = snapSessions.exists() ? snapSessions.data().parTerritoire || {} : {};
  const codes = snapSessions.exists() ? snapSessions.data().codes || {} : {};
  const logosParTerritoire = snapLogos.exists() ? snapLogos.data().parTerritoire || {} : {};
  const programmes = snapProgrammes.exists() ? snapProgrammes.data().parParcours || {} : {};
  const niveauxEtudes = snapNiveaux.exists() && Array.isArray(snapNiveaux.data().liste) && snapNiveaux.data().liste.length > 0
    ? snapNiveaux.data().liste
    : NIVEAUX_ETUDES_DEFAUT;

  return { parcoursListe, territoiresListe, sessions, codes, logosParTerritoire, programmes, niveauxEtudes };
}

export async function sauvegarderParcours(slug: string, liste: Parcours[]) {
  await setDoc(refConfig(slug, "parcours"), { liste });
}
export async function sauvegarderTerritoires(slug: string, liste: string[]) {
  await setDoc(refConfig(slug, "territoires"), { liste });
}
export async function sauvegarderNiveauxEtudes(slug: string, liste: string[]) {
  await setDoc(refConfig(slug, "niveauxEtudes"), { liste });
}
export async function sauvegarderSessions(slug: string, parTerritoire: Record<string, Record<string, string[]>>, codes: Record<string, string>) {
  await setDoc(refConfig(slug, "sessions"), { parTerritoire, codes });
}
export async function sauvegarderLogos(slug: string, parTerritoire: Record<string, string[]>) {
  await setDoc(refConfig(slug, "logosFormulaire"), { parTerritoire });
}
export async function sauvegarderProgrammes(slug: string, parParcours: Record<string, { storagePath: string; url: string }[]>) {
  await setDoc(refConfig(slug, "programmes"), { parParcours });
}

export function inscriptionsCollection(slug: string) {
  return collection(db, "dynamic_actions", slug, "inscriptions");
}

export function inscriptionDoc(slug: string, id: string) {
  return doc(db, "dynamic_actions", slug, "inscriptions", id);
}

// Suppression complète et irréversible d'une action : le SDK client Firestore
// n'a pas d'équivalent de "recursive delete" (contrairement au SDK Admin),
// donc on liste et supprime nous-mêmes toutes les inscriptions et tous les
// documents de configuration connus, par lots de 500 (limite d'un batch),
// avant de supprimer le document racine dynamic_actions/{slug} en dernier —
// s'il reste un plantage en cours de route, le schéma reste visible/listable
// plutôt que de laisser des inscriptions orphelines sans schéma parent.
const DOCS_CONFIGURATION_CONNUS = ["parcours", "territoires", "sessions", "logosFormulaire", "programmes", "niveauxEtudes", "evolutionCategories"];

export async function supprimerActionDynamique(slug: string): Promise<void> {
  const snapInscriptions = await getDocs(inscriptionsCollection(slug));
  const refsASupprimer = [
    ...snapInscriptions.docs.map((d) => d.ref),
    ...DOCS_CONFIGURATION_CONNUS.map((id) => refConfig(slug, id)),
  ];
  for (let i = 0; i < refsASupprimer.length; i += 500) {
    const lot = writeBatch(db);
    refsASupprimer.slice(i, i + 500).forEach((ref) => lot.delete(ref));
    await lot.commit();
  }
  await deleteDoc(refSchema(slug));
}

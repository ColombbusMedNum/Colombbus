// Moteur générique de "questionnaire de satisfaction" — dérivé de
// lib/positionnement.ts mais sans notation (aucune bonne/mauvaise réponse) :
// les réponses sont enregistrées telles quelles pour lecture par le staff.
// Un seul questionnaire actif à la fois par programme (on remplace/modifie
// plutôt que d'en accumuler plusieurs), stocké dans Firestore sous
// satisfaction/{programmeId} (voir firestore.rules), programmeId étant une
// chaîne libre comme pour positionnement/{programmeId}.
//
// Différence clé avec le test de positionnement : une réponse peut déterminer
// quelle SECTION ENTIÈRE s'affiche ensuite (ex. "à chaud" vs "à froid"), pas
// seulement une question à l'intérieur d'une section déjà affichée — voir
// SectionSatisfaction.conditionSurQuestionId/conditionValeur.

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export type TypeItemSatisfaction = "texte_intro" | "choix_unique" | "choix_multiple" | "texte_libre" | "echelle";

export interface ItemSatisfaction {
  id: string;
  type: TypeItemSatisfaction;
  contenu?: string; // texte_intro
  enonce?: string; // choix_unique / choix_multiple / texte_libre / echelle
  options?: string[]; // choix_unique / choix_multiple
  echelleMin?: string; // echelle : libellé sous "1" (défaut "Pas satisfait")
  echelleMax?: string; // echelle : libellé sous "5" (défaut "Très satisfait")
  conditionSurQuestionId?: string;
  conditionValeur?: string;
}

export interface SectionSatisfaction {
  id: string;
  titre: string;
  sousTitre?: string;
  items: ItemSatisfaction[];
  // Section entière sautée si une question déjà répondue (dans une section
  // précédente) n'a pas cette valeur — permet le branchement "à chaud"/
  // "à froid" : le formulaire public saute la section, l'éditeur ne masque
  // rien (toutes les sections restent visibles/éditables).
  conditionSurQuestionId?: string;
  conditionValeur?: string;
}

export interface ConfigSatisfaction {
  titre: string;
  description?: string;
  logoIds: string[]; // ids dans la bibliothèque logos_emargement, affichés à plat en en-tête
  sections: SectionSatisfaction[];
}

export function nouvelleConfigSatisfactionVide(titre: string): ConfigSatisfaction {
  return { titre, description: "", logoIds: [], sections: [] };
}

export type ReponsesSatisfaction = Record<string, string | string[]>;

export function refConfigSatisfaction(programmeId: string) {
  return doc(db, "satisfaction", programmeId);
}

export async function chargerConfigSatisfaction(programmeId: string): Promise<ConfigSatisfaction | null> {
  const snap = await getDoc(refConfigSatisfaction(programmeId));
  return snap.exists() ? (snap.data() as ConfigSatisfaction) : null;
}

export async function sauvegarderConfigSatisfaction(programmeId: string, config: ConfigSatisfaction): Promise<void> {
  await setDoc(refConfigSatisfaction(programmeId), config);
}

// Une section est affichée si elle n'a pas de condition, ou si la réponse
// déjà donnée à la question référencée correspond (choix_multiple -> la
// valeur attendue fait partie du tableau de réponses).
export function sectionVisible(section: SectionSatisfaction, reponses: ReponsesSatisfaction): boolean {
  if (!section.conditionSurQuestionId) return true;
  const valeur = reponses[section.conditionSurQuestionId];
  if (Array.isArray(valeur)) return valeur.includes(section.conditionValeur as string);
  return valeur === section.conditionValeur;
}

export function itemVisible(item: ItemSatisfaction, reponses: ReponsesSatisfaction): boolean {
  if (!item.conditionSurQuestionId) return true;
  const valeur = reponses[item.conditionSurQuestionId];
  if (Array.isArray(valeur)) return valeur.includes(item.conditionValeur as string);
  return valeur === item.conditionValeur;
}

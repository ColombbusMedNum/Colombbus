// Points de départ de duplication pour "Nouvelle action" : la liste des
// questions CUSTOM (hors socle CORE, voir lib/dynamicActions/types.ts) de
// chacun des 4 programmes historiques codés en dur, saisie une fois pour
// toutes ici afin de servir de base à une action dynamique dupliquée.
// Les 4 programmes eux-mêmes ne sont PAS migrés vers ce moteur — ils
// continuent de vivre dans leurs propres pages.

import { QuestionDef } from "./types";

export interface ModeleDuplication {
  id: string;
  label: string;
  questions: Omit<QuestionDef, "id" | "etape">[];
}

const CANAUX_CONNAISSANCE = [
  "Mission locale / conseiller.e",
  "Bouche à oreille",
  "Email",
  "Site (www.colombbus.org)",
  "Réseaux sociaux (Facebook, Twitter, LinkedIn)",
  "Autre",
];

export const MODELES_DUPLICATION: ModeleDuplication[] = [
  {
    id: "numerik-up-pro",
    label: "NUMERIK PRO",
    questions: [
      { label: "Situation de handicap", type: "oui_non", requis: true },
      { label: "Reconnu·e RQTH ?", type: "oui_non", requis: true },
      { label: "Bénéficiaire du RSA ?", type: "oui_non", requis: true },
      { label: "NEET (ni en emploi, ni en formation) ?", type: "oui_non", requis: true },
      { label: "Contrat d'Engagement Jeune (CEJ) ?", type: "oui_non", requis: true },
      { label: "Inscrit·e à France Travail ?", type: "oui_non", requis: true },
      { label: "Identifiant France Travail", type: "texte", requis: false, conditionValeur: "Oui" },
      { label: "Comment avez-vous connu cette action ?", type: "select", requis: true, options: CANAUX_CONNAISSANCE, texteLibreLabel: "Précisez" },
      { label: "Projet professionnel", type: "textarea", requis: false },
      { label: "Comment accédez-vous habituellement à la formation/l'information ?", type: "textarea", requis: false },
      { label: "J'autorise le partage de ma simulation avec l'équipe pédagogique", type: "checkbox", requis: false },
    ],
  },
  {
    id: "numerik-up",
    label: "Numérik'UP",
    questions: [
      { label: "Situation de handicap", type: "oui_non", requis: true },
      { label: "Bénéficiaire du RSA ?", type: "oui_non", requis: true },
      { label: "Comment avez-vous connu cette action ?", type: "select", requis: true, options: CANAUX_CONNAISSANCE, texteLibreLabel: "Précisez" },
    ],
  },
  {
    id: "prfe",
    label: "Préparation Parcours Métiers",
    questions: [
      { label: "Métier souhaité", type: "textarea", requis: false },
      { label: "Formation certifiante suivie récemment ?", type: "oui_non", requis: true },
      { label: "Informé·e du titre professionnel TIP visé par cette formation ?", type: "oui_non", requis: true },
      { label: "Disponible aux dates de la session ?", type: "oui_non", requis: true },
    ],
  },
  {
    id: "vide",
    label: "Formulaire vierge (aucune question)",
    questions: [],
  },
];

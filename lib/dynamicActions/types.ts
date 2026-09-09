// Types partagés par tout le moteur "actions personnalisées" (voir le plan
// dans C:\Users\emman\.claude\plans\zippy-hatching-hoare.md) : un moteur
// générique qui rend un formulaire d'inscription (public + interne), un
// tableau de réponses, des statistiques et un suivi de recrutement à partir
// d'un schéma stocké dans Firestore (dynamic_actions/{slug}), plutôt que du
// JSX codé en dur par programme comme le sont Numérik'Up/NUMERIK PRO/
// Digital'UP/Préparation Parcours Métiers.

// Une question CUSTOM : tout ce qui n'appartient pas au socle CORE partagé
// par toute action (identité, adresse, QPV, date de naissance, niveau
// d'études, parcours/territoire/session, conseiller référent, RGPD).
export type TypeQuestion =
  | "texte"
  | "email"
  | "telephone"
  | "nombre"
  | "select"
  | "oui_non"
  | "textarea"
  | "checkbox"
  | "tags_multiples";

export interface QuestionDef {
  id: string; // clé stable, ex. "formation_certifiante" — sert de clé dans reponses{}
  label: string;
  type: TypeQuestion;
  options?: string[]; // pour "select" / "tags_multiples"
  requis: boolean;
  etape: number; // ordre d'affichage au sein de l'étape unique "Questions complémentaires" (pas une page séparée par valeur — juste un tri)
  conditionSurQuestionId?: string; // n'affiche cette question que si une autre a une valeur donnée
  conditionValeur?: string;
  placeholder?: string;
  texteLibreLabel?: string; // pour select/tags_multiples avec une option "Autre" en texte libre
}

// Dossier de la page d'accueil (app/page.tsx, NAV_TREE) où la tuile de
// cette action apparaît — reprend exactement les 3 ids de folder existants
// pour les 3 familles de programmes historiques. Optionnel : une action sans
// catégorie reste accessible uniquement via "Gestion Colombbus > Actions
// personnalisées" (creer-action), jusqu'à ce qu'un admin lui en choisisse une.
export type CategorieAccueil = "inclusion-numerique" | "insertion-pro" | "decouvertes-metiers";

export interface ActionSchema {
  slug: string;
  label: string;
  accentColor: string; // hex, ex. "#005259"
  actif: boolean;
  conseillerReferentActif: boolean;
  // Champ CORE "Niveau d'études" (étape Identité du formulaire) — absent ou
  // true = affiché (comportement historique) ; false = masqué partout
  // (formulaire, réponses, statistiques) pour les actions qui n'en ont pas
  // l'usage, sans pour autant en faire une question CUSTOM du questionnaire.
  niveauEtudesActif?: boolean;
  consentementRgpdTexte: string;
  questions: QuestionDef[];
  categorieAccueil?: CategorieAccueil;
  dupliqueDepuis?: string; // slug ou id du modèle source, pour référence
  // Catégories "activité" de la grille Évolution (page suivi de session) —
  // modifiables par action depuis la page paramètres, contrairement aux 4
  // codes structurels fixes (Absence justifiée "A" / non justifiée "ANJ" /
  // Férié "F" / Abandon "AB"), gérés par le moteur car d'autres logiques en
  // dépendent (bascule "Suivi_Recrutement"/abandon en cascade, alimentation
  // du journal des absences, alerte sur absences répétées).
  categoriesEvolution?: CategorieEvolution[];
  createdAt?: number;
  updatedAt?: number;
}

// Une catégorie "activité" de la grille Évolution, ex. {code:"G", label:
// "Game Design", bg:"#7C1FD1", text:"#FFFFFF"} — le code doit être unique
// parmi les catégories ACTIVITÉ de l'action (il ne doit pas non plus
// reprendre "A"/"ANJ"/"F"/"AB", réservés aux 4 codes structurels fixes).
export interface CategorieEvolution {
  code: string;
  label: string;
  bg: string;
  text: string;
}

export const CATEGORIE_EVOLUTION_DEFAUT: CategorieEvolution[] = [
  { code: "P", label: "Présent·e", bg: "#3B82F6", text: "#FFFFFF" },
];

// Un enregistrement d'inscription générique : les champs CORE au premier
// niveau (mêmes noms que sur les 4 programmes historiques, pour rester
// cohérent si on doit un jour les comparer/exporter ensemble), et les
// réponses aux questions CUSTOM regroupées sous "reponses" (clé = QuestionDef.id).
export interface InscriptionActionDynamique {
  id?: string;
  Civilité: string;
  Nom: string;
  Prénom: string;
  Téléphone: string;
  Email: string;
  Adresse_Postale: string;
  Code_Postal: string;
  Ville: string;
  QPV: string;
  Date_Naissance: string;
  Age: number | "";
  Niveau_Etudes: string;
  Territoire: string;
  Parcours: string;
  Session: string;
  Conseiller_Nom?: string;
  Conseiller_Prenom?: string;
  Conseiller_Email?: string;
  Conseiller_Telephone?: string;
  Structure_Accompagnement?: string;
  RGPD: boolean;
  reponses: Record<string, string | string[] | boolean>;
  Suivi_Recrutement?: boolean;
  Absences?: { date: string; motif?: string }[];
  Evolution_Actif?: boolean;
  Evolution_Retards?: Record<string, string>;
  createdAt?: any;
  _piege?: string;
  _dureeRemplissageMs?: number;
}

export const NIVEAUX_ETUDES_DEFAUT = [
  "Infra brevet",
  "Brevet, CAP, BEP",
  "Bac",
  "Bac+2 (L2, BTS, DUT, DEUST)",
  "Bac+3 (Licence, licence professionnelle)",
  "Bac+4/5 et plus",
  "Supérieur à Bac +3",
  "Autre",
];

export const TERRITOIRES_DEFAUT = ["91", "92", "Autres"];

export const RGPD_TEXTE_DEFAUT =
  "Les données recueillies dans ce formulaire font l'objet d'un traitement informatique destiné à l'inscription à l'action organisée par l'association Colombbus, en conformité avec la loi RGPD 2018.";

export function nouveauSchemaVide(slug: string, label: string): ActionSchema {
  return {
    slug,
    label,
    accentColor: "#005259",
    actif: true,
    conseillerReferentActif: true,
    niveauEtudesActif: true,
    consentementRgpdTexte: RGPD_TEXTE_DEFAUT,
    questions: [],
    categoriesEvolution: CATEGORIE_EVOLUTION_DEFAUT,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Slugs déjà pris par les 4 programmes historiques codés en dur — une
// nouvelle action dynamique ne peut pas réutiliser l'un de ces identifiants,
// sinon elle entrerait en conflit avec leurs routes statiques.
export const SLUGS_RESERVES = ["numerik-up", "numerik-up-pro", "digital-up", "prfe"];

export function slugifier(texte: string): string {
  return texte
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "action";
}

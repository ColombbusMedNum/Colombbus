// Types partagés pour les collections Firestore consommées par plusieurs
// pages. Avant cette centralisation, `Mediateur` était redéclaré séparément
// dans app/agenda/page.tsx (forme complète) et
// app/mediation/rencontres-numeriques/liste-beneficiaires/[id]/page.tsx
// (forme réduite à {id, nom}) ; les deux réfèrent au même document de la
// collection "liste_mediateurs", donc la forme complète ci-dessous sert de
// référence unique (une déclaration réduite peut toujours piocher un
// sous-ensemble de champs, la structurel typing de TypeScript le permet).

export interface Mediateur {
  id: string;
  prenom?: string;
  nom?: string;
  poste?: string;
  statut?: string;
  debutACI?: string;
  finACI?: string;
  masque?: boolean;
  actif?: boolean;
  sitePrincipal?: string;
  email?: string;
  telephone?: string;
  role?: string;
  taux?: number;
  sites?: string[];
  competences?: string[];
  rattachementHoraireACI?: string;
  trigramme?: string;
  // Numéro de groupe ACI (1 à 10), affiché sur l'agenda pour repérer d'un
  // coup d'œil les collaborateurs ACI qui partagent le même groupe.
  groupeACI?: number;
  // Durée hebdomadaire d'un ACI — "26h" par défaut si absent (comportement
  // historique : mercredi non travaillé, compté en heures complémentaires,
  // voir lib/planningHours.ts). Un ACI "35h" travaille normalement le
  // mercredi et ne déclenche pas cette règle.
  dureeHebdoACI?: "26h" | "35h";
}

// Créneau planifié (collection "planning_mediateurs"). Seuls mediatId et
// mediateurNom sont écrits par le code actuel (app/agenda/page.tsx et
// lib/activitesTypes.ts) ; mediateurId et mediateur sont d'anciens noms de
// champ qui peuvent encore exister sur des documents historiques mais que
// plus rien n'écrit. Un consommateur doit passer par les helpers de
// lib/matchMediateur.ts (estActionDuMediateur / identifiantMediateur), qui
// vérifient mediatId en priorité, plutôt que de comparer un champ au hasard.
export interface ActionPlanning {
  id: string;
  mediateurId?: string;
  mediatId?: string;
  mediateur?: string;
  mediateurNom?: string;
  moment?: string;
  date: string;
  lieu?: string;
  type?: string;
  commentaire?: string;
  couleur?: string;
  adresse?: string;
  debut?: string;
  fin?: string;
  territoire?: string;
  codeAnalytique?: string;
  // Position au sein de sa demi-journée (mediatId + date + moment) —
  // réordonnable par glisser-déposer sur l'agenda, plutôt que figée sur
  // l'ordre d'arrivée Firestore.
  ordre?: number;
  // Copié depuis le modèle d'activité à la création (voir ActiviteType dans
  // lib/activitesTypes.ts) — coché si ce créneau correspond à de la
  // production Médiation Numérique.
  estProduction?: boolean;
}

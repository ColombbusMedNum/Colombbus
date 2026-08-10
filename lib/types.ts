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
}

// Créneau planifié (collection "planning_mediateurs"). Le champ identifiant
// le médiateur n'a jamais été nommé de façon cohérente selon l'endroit du
// code qui a écrit le document — les 4 variantes ci-dessous coexistent
// réellement dans les données ; un consommateur doit vérifier
// `mediateurId || mediatId || mediateur` (voir lib/useAnalyticsSummary.ts)
// plutôt que supposer un seul nom de champ.
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
}

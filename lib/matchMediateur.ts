// Un créneau de planning_mediateurs identifie son médiateur par mediatId
// (seul champ réellement écrit aujourd'hui, par app/agenda/page.tsx →
// processActionCreation et lib/activitesTypes.ts → genererCreneauxPourModele)
// et/ou par mediateurNom (nom complet en texte libre, toujours écrit en
// parallèle). mediateurId et mediateur sont deux anciens noms de champ que
// plus aucun code n'écrit, mais qui peuvent subsister sur des documents
// historiques — vérifiés en dernier recours pour ne perdre aucune donnée.
export interface ActionAvecMediateur {
  mediatId?: string;
  mediateurId?: string;
  mediateur?: string;
  mediateurNom?: string;
}

export interface MediateurIdentifiable {
  id: string;
  prenom?: string;
  nom?: string;
}

export function nomCompletMediateur(m: MediateurIdentifiable): string {
  return `${m.prenom || ""} ${m.nom || ""}`.trim();
}

// true si l'action appartient au médiateur donné : vérifie d'abord
// l'identifiant (fiable) puis le nom complet (nécessaire pour les documents
// créés avant qu'un identifiant ne soit systématiquement posé).
export function estActionDuMediateur(action: ActionAvecMediateur, mediateur: MediateurIdentifiable): boolean {
  if (action.mediatId && action.mediatId === mediateur.id) return true;
  if (action.mediateurId && action.mediateurId === mediateur.id) return true;
  const nomComplet = nomCompletMediateur(mediateur);
  if (!nomComplet) return false;
  return action.mediateurNom === nomComplet || action.mediateur === nomComplet;
}

// Identifiant le plus fiable disponible pour une action, utilisé comme clé
// de regroupement/dédoublonnage quand on n'a pas de fiche médiateur précise
// à comparer (ex : agrégation par médiateur dans volume-horaire, clé de
// dédoublonnage dans useAnalyticsSummary).
export function identifiantMediateur(action: ActionAvecMediateur): string {
  return action.mediatId || action.mediateurId || action.mediateurNom || action.mediateur || "";
}

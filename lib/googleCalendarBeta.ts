// Fonctionnalité "Synchronisation Google Agenda" : ouverte à tout le
// personnel Permanent (statut de la fiche liste_mediateurs), plus une petite
// liste de comptes de test pour les autres statuts (voir
// app/page.tsx, app/mon-compte/page.tsx, app/agenda/page.tsx). Ajouter un
// email ici suffit à ouvrir le test à quelqu'un qui n'est pas Permanent,
// sans toucher au reste du code.
const COMPTES_BETA_GOOGLE_AGENDA = [
  "emmanuel.chaudy@colombbus.org",
  "cedric.divangamene-makau@colombbus.org",
];

function estCompteBeta(email?: string | null): boolean {
  if (!email) return false;
  const normalise = email.toLowerCase().trim();
  return COMPTES_BETA_GOOGLE_AGENDA.includes(normalise);
}

export function estBetaGoogleAgenda(email?: string | null, statut?: string | null): boolean {
  return statut === "Permanent" || estCompteBeta(email);
}

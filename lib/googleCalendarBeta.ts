// Fonctionnalité "Synchronisation Google Agenda" en cours de validation :
// tant qu'elle n'est pas ouverte à tout le staff, seuls les comptes listés
// ici voient les boutons de connexion/déconnexion et de resynchronisation
// (voir app/page.tsx, app/mon-compte/page.tsx, app/agenda/page.tsx). Ajouter
// un email ici suffit à lui ouvrir le test, sans toucher au reste du code.
const COMPTES_BETA_GOOGLE_AGENDA = [
  "emmanuel.chaudy@colombbus.org",
  "cedric.divangamene-makau@colombbus.org",
];

export function estBetaGoogleAgenda(email?: string | null): boolean {
  if (!email) return false;
  const normalise = email.toLowerCase().trim();
  return COMPTES_BETA_GOOGLE_AGENDA.includes(normalise);
}

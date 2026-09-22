// Accès à la fonctionnalité "Synchronisation Google Agenda" (voir
// app/page.tsx, app/mon-compte/page.tsx, app/agenda/page.tsx). Deux niveaux
// distincts :
// - peutConnecterGoogleAgenda : ouvre le bouton "Connecter mon agenda
//   Google" à tout le personnel Colombbus (adresse @colombbus.org) — chacun
//   ne connecte et n'agit que sur son propre calendrier.
// - estAdminGoogleAgenda : réservé aux actions qui agissent sur les données
//   de tout le monde en un clic (resynchronisation globale, rattrapage de
//   notifications), pas seulement de la personne qui clique.
export function peutConnecterGoogleAgenda(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim().endsWith("@colombbus.org");
}

const COMPTES_ADMIN_GOOGLE_AGENDA = [
  "emmanuel.chaudy@colombbus.org",
  "cedric.divangamene-makau@colombbus.org",
];

export function estAdminGoogleAgenda(email?: string | null): boolean {
  if (!email) return false;
  return COMPTES_ADMIN_GOOGLE_AGENDA.includes(email.toLowerCase().trim());
}

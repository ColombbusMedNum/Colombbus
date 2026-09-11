// Fabrique du client OAuth2 Google, partagée par les 3 routes de la
// poignée de main (app/api/google-calendar/{connect,callback,disconnect}) —
// réservé au code serveur, jamais importé depuis un composant "use client".
// La Cloud Function (functions/src/index.ts) est un codebase de déploiement
// séparé : elle redéfinit sa propre version minimale plutôt que d'importer
// ce fichier, qu'un build Cloud Functions ne peut pas résoudre hors du repo
// Next.js.
import { google } from "googleapis";

// Nom du calendrier secondaire créé dans le compte Google de chaque
// médiateur connecté — jamais son calendrier principal (voir le plan validé :
// séparation visuelle avec la vie perso, et suppression en un seul appel
// calendars.delete à la déconnexion).
export const NOM_CALENDRIER_COSMOS = "COSMOS — Planning";

// Portée volontairement large ("calendar", pas seulement "calendar.events") :
// nécessaire pour créer le calendrier secondaire lui-même (calendars.insert),
// pas seulement pour y poser des événements.
export const SCOPES_GOOGLE_CALENDAR = ["https://www.googleapis.com/auth/calendar"];

export function creerClientOAuth(redirectUri: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET non configurés.");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

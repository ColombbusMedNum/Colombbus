// Fabrique du client OAuth2 Google, partagée par les 3 routes de la
// poignée de main (app/api/google-calendar/{connect,callback,disconnect}) —
// réservé au code serveur, jamais importé depuis un composant "use client".
// La Cloud Function (functions/src/index.ts) est un codebase de déploiement
// séparé : elle redéfinit sa propre version minimale plutôt que d'importer
// ce fichier, qu'un build Cloud Functions ne peut pas résoudre hors du repo
// Next.js.
import type { NextRequest } from "next/server";
import { google } from "googleapis";

// Derrière le proxy/CDN de Firebase App Hosting (Cloud Run), request.nextUrl
// reflète l'adresse interne du conteneur (ex "0.0.0.0:8080") plutôt que le
// vrai domaine public visité — même problème déjà géré dans middleware.ts
// pour la redirection *.hosted.app, avec le même correctif : x-forwarded-host,
// posé par le proxy, donne le vrai hôte public. Sans repli sur request.nextUrl
// (pas d'en-tête en local, next dev n'étant pas derrière un tel proxy).
export function obtenirOrigineExterne(request: NextRequest): string {
  const hote = request.headers.get("x-forwarded-host");
  return hote ? `https://${hote}` : request.nextUrl.origin;
}

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

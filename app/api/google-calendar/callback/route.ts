import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebaseAdmin";
import { creerClientOAuth, NOM_CALENDRIER_COSMOS } from "@/lib/googleCalendarClient";

// Retour de Google après consentement : simple redirection navigateur (pas
// d'en-tête d'auth disponible ici), l'identité de l'utilisateur est donc
// retrouvée via l'état éphémère posé par /connect (oauth_state/{state}),
// supprimé dans tous les cas juste après lecture — usage unique.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateId = request.nextUrl.searchParams.get("state");
  const rediriger = (params: string) => NextResponse.redirect(new URL(`/mon-compte${params}`, request.nextUrl.origin));

  if (!code || !stateId) {
    return rediriger("?erreurGoogle=1");
  }

  const stateRef = adminDb.collection("oauth_state").doc(stateId);
  try {
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) {
      return rediriger("?erreurGoogle=1");
    }
    const { uid } = stateSnap.data() as { uid: string };
    await stateRef.delete();

    const redirectUri = `${request.nextUrl.origin}/api/google-calendar/callback`;
    const client = creerClientOAuth(redirectUri);
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      // Arrive si la personne avait déjà autorisé COSMOS sans jamais révoquer
      // l'accès entre-temps — Google ne renvoie alors pas de refresh_token
      // malgré prompt=consent. Il faut révoquer l'accès depuis
      // myaccount.google.com/permissions puis recommencer.
      return rediriger("?erreurGoogle=refresh_manquant");
    }

    client.setCredentials(tokens);
    const calendar = google.calendar({ version: "v3", auth: client });
    const { data: calendarCree } = await calendar.calendars.insert({
      requestBody: { summary: NOM_CALENDRIER_COSMOS, timeZone: "Europe/Paris" },
    });

    await adminDb.collection("oauth_google_tokens").doc(uid).set({
      refreshToken: tokens.refresh_token,
      calendarId: calendarCree.id,
      connectedAt: Date.now(),
    });
    await adminDb.collection("liste_mediateurs").doc(uid).set(
      { googleCalendarConnecte: true },
      { merge: true }
    );

    return rediriger("?connecte=1");
  } catch (err) {
    console.error("Erreur callback Google Agenda :", err);
    return rediriger("?erreurGoogle=1");
  }
}

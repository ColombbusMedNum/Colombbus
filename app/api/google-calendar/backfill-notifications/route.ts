import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebaseAdmin";
import { resoudreUidDepuisRequete } from "@/lib/verifierAuthRequete";
import { creerClientOAuth, obtenirOrigineExterne } from "@/lib/googleCalendarClient";
import { estAdminGoogleAgenda } from "@/lib/googleCalendarBeta";

// Action de rattrapage à usage unique : active les notifications email de
// Google Agenda (création/modification/annulation) sur le calendrier
// secondaire de TOUTES les personnes déjà connectées avant que
// app/api/google-calendar/callback/route.ts ne le fasse automatiquement à la
// connexion. Réservée aux comptes admin (voir lib/googleCalendarBeta.ts) —
// agit sur les jetons Google de tout le monde, pas seulement de l'appelant.
export async function POST(request: NextRequest) {
  const uid = await resoudreUidDepuisRequete(request);
  if (!uid) {
    return NextResponse.json({ erreur: "Non authentifié." }, { status: 401 });
  }

  const medSnap = await adminDb.collection("liste_mediateurs").doc(uid).get();
  const med = medSnap.data() as { email?: string } | undefined;
  if (!estAdminGoogleAgenda(med?.email)) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 403 });
  }

  const redirectUri = `${obtenirOrigineExterne(request)}/api/google-calendar/callback`;
  let traites = 0;
  let echecs = 0;
  try {
    const snapTokens = await adminDb.collection("oauth_google_tokens").get();
    for (const tokenDoc of snapTokens.docs) {
      const donnees = tokenDoc.data() as { refreshToken?: string; calendarId?: string };
      if (!donnees.refreshToken || !donnees.calendarId) continue;
      try {
        const client = creerClientOAuth(redirectUri);
        client.setCredentials({ refresh_token: donnees.refreshToken });
        const calendar = google.calendar({ version: "v3", auth: client });
        await calendar.calendarList.patch({
          calendarId: donnees.calendarId,
          requestBody: {
            notificationSettings: {
              notifications: [
                { method: "email", type: "eventCreation" },
                { method: "email", type: "eventChange" },
                { method: "email", type: "eventCancellation" },
              ],
            },
          },
        });
        traites++;
      } catch (err) {
        console.error(`Activation notifications Google Agenda échouée pour ${tokenDoc.id} :`, err);
        echecs++;
      }
    }
    return NextResponse.json({ ok: true, traites, echecs });
  } catch (err) {
    console.error("Erreur backfill notifications Google Agenda :", err);
    return NextResponse.json({ erreur: "Erreur lors du traitement." }, { status: 500 });
  }
}

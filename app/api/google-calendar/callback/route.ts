import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebaseAdmin";
import { creerClientOAuth, obtenirOrigineExterne, NOM_CALENDRIER_COSMOS } from "@/lib/googleCalendarClient";

// Retour de Google après consentement : simple redirection navigateur (pas
// d'en-tête d'auth disponible ici), l'identité de l'utilisateur est donc
// retrouvée via l'état éphémère posé par /connect (oauth_state/{state}),
// supprimé dans tous les cas juste après lecture — usage unique.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateId = request.nextUrl.searchParams.get("state");
  const origine = obtenirOrigineExterne(request);
  const rediriger = (params: string) => NextResponse.redirect(new URL(`/mon-compte${params}`, origine));

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

    const redirectUri = `${origine}/api/google-calendar/callback`;
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

    // Active les notifications par email de Google Agenda sur ce calendrier
    // secondaire (création/modification/annulation d'événement) — c'est
    // Google qui envoie l'email, jamais COSMOS : aucune infra d'envoi à
    // gérer. Réglage propre au calendrier, indépendant de qui modifie
    // l'événement (la Cloud Function de synchro y compris). Best-effort :
    // la connexion reste effective même si ce réglage échoue.
    try {
      await calendar.calendarList.patch({
        calendarId: calendarCree.id!,
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
    } catch (err) {
      console.error("Activation des notifications email Google Agenda échouée :", err);
    }

    await adminDb.collection("oauth_google_tokens").doc(uid).set({
      refreshToken: tokens.refresh_token,
      calendarId: calendarCree.id,
      connectedAt: Date.now(),
    });
    await adminDb.collection("liste_mediateurs").doc(uid).set(
      { googleCalendarConnecte: true },
      { merge: true }
    );

    // Première connexion : jusqu'ici, la Cloud Function (voir
    // functions/src/index.ts) ne répercute que les écritures à venir, jamais
    // l'historique déjà posé avant la connexion. On pose donc le même
    // horodatage "resyncGoogleDemande" que la resynchronisation manuelle sur
    // TOUS les créneaux déjà existants de cette personne, pour qu'elle
    // retrouve d'un coup tout son agenda déjà posé dans "COSMOS — Planning" —
    // best-effort : un échec ici ne doit pas faire échouer la connexion,
    // déjà effective à ce stade.
    try {
      const snapCreneaux = await adminDb.collection("planning_mediateurs").where("mediatId", "==", uid).get();
      let batch = adminDb.batch();
      let opsDansBatch = 0;
      for (const creneauDoc of snapCreneaux.docs) {
        batch.update(creneauDoc.ref, { resyncGoogleDemande: Date.now() });
        opsDansBatch++;
        if (opsDansBatch >= 450) {
          await batch.commit();
          batch = adminDb.batch();
          opsDansBatch = 0;
        }
      }
      if (opsDansBatch > 0) await batch.commit();
    } catch (err) {
      console.error("Synchronisation initiale de l'historique échouée (connexion déjà effective) :", err);
    }

    return rediriger("?connecte=1");
  } catch (err) {
    console.error("Erreur callback Google Agenda :", err);
    return rediriger("?erreurGoogle=1");
  }
}

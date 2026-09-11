import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebaseAdmin";
import { resoudreUidDepuisRequete } from "@/lib/verifierAuthRequete";
import { creerClientOAuth, obtenirOrigineExterne } from "@/lib/googleCalendarClient";

// Supprime le calendrier secondaire "COSMOS — Planning" (calendars.delete
// efface le calendrier ET tous ses événements en un seul appel, pas besoin
// de retrouver chaque événement un par un), puis le jeton stocké et le
// marqueur de connexion — dans cet ordre, pour ne jamais laisser un jeton
// orphelin si la suppression côté Google échoue.
export async function POST(request: NextRequest) {
  const uid = await resoudreUidDepuisRequete(request);
  if (!uid) {
    return NextResponse.json({ erreur: "Non authentifié." }, { status: 401 });
  }

  try {
    const tokenRef = adminDb.collection("oauth_google_tokens").doc(uid);
    const tokenSnap = await tokenRef.get();
    const donnees = tokenSnap.data() as { refreshToken?: string; calendarId?: string } | undefined;

    if (donnees?.refreshToken && donnees?.calendarId) {
      const redirectUri = `${obtenirOrigineExterne(request)}/api/google-calendar/callback`;
      const client = creerClientOAuth(redirectUri);
      client.setCredentials({ refresh_token: donnees.refreshToken });
      const calendar = google.calendar({ version: "v3", auth: client });
      try {
        await calendar.calendars.delete({ calendarId: donnees.calendarId });
      } catch (err) {
        // Le calendrier a pu déjà être supprimé manuellement côté Google —
        // on continue quand même le nettoyage local plutôt que de laisser
        // la personne bloquée en état "connecté" sans pouvoir se déconnecter.
        console.error("Suppression du calendrier Google échouée (poursuite du nettoyage) :", err);
      }
    }

    await tokenRef.delete();
    await adminDb.collection("liste_mediateurs").doc(uid).set(
      { googleCalendarConnecte: false },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erreur déconnexion Google Agenda :", err);
    return NextResponse.json({ erreur: "Impossible de déconnecter Google Agenda." }, { status: 500 });
  }
}

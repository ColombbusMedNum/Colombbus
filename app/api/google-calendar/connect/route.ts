import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { resoudreUidDepuisRequete } from "@/lib/verifierAuthRequete";
import { creerClientOAuth, obtenirOrigineExterne, SCOPES_GOOGLE_CALENDAR } from "@/lib/googleCalendarClient";

// Démarre la connexion Google Agenda depuis /mon-compte : le client envoie un
// ID token frais (Authorization: Bearer), on génère un état éphémère qui
// porte l'uid (oauth_state/{id}, lu et supprimé par le callback) pour éviter
// tout CSRF et pour retrouver l'utilisateur au retour de Google — le
// callback n'a lui aucun en-tête d'auth disponible, ce n'est qu'une
// redirection navigateur classique.
export async function POST(request: NextRequest) {
  const uid = await resoudreUidDepuisRequete(request);
  if (!uid) {
    return NextResponse.json({ erreur: "Non authentifié." }, { status: 401 });
  }

  try {
    const stateId = randomUUID();
    await adminDb.collection("oauth_state").doc(stateId).set({
      uid,
      createdAt: Date.now(),
    });

    const redirectUri = `${obtenirOrigineExterne(request)}/api/google-calendar/callback`;
    const client = creerClientOAuth(redirectUri);
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES_GOOGLE_CALENDAR,
      state: stateId,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Erreur démarrage connexion Google Agenda :", err);
    return NextResponse.json({ erreur: "Impossible de démarrer la connexion à Google Agenda." }, { status: 500 });
  }
}

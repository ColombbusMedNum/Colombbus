// Vérification serveur de l'identité de l'appelant sur une route
// app/api/**/route.ts, à partir d'un ID token Firebase Auth frais envoyé en
// en-tête "Authorization: Bearer <token>" (obtenu côté client via
// user.getIdToken() juste avant l'appel — jamais le cookie "session_token",
// qui n'est ni vérifié cryptographiquement ni renouvelé après son expiration
// d'1h, voir middleware.ts).
import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "./firebaseAdmin";

export async function resoudreUidDepuisRequete(request: NextRequest): Promise<string | null> {
  const enTete = request.headers.get("authorization") || "";
  const token = enTete.startsWith("Bearer ") ? enTete.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

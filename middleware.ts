import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { normalizeRole } from "./lib/roles";

// IMPORTANT : ce middleware ne fait que rediriger l'UX (éviter d'afficher une
// page inaccessible). Le cookie user_role est posé côté client et n'est pas
// vérifié cryptographiquement ici — ce n'est PAS la barrière de sécurité.
// La sécurité réelle est appliquée par les Firestore Security Rules
// (voir firestore.rules), qui rejettent les lectures/écritures non
// autorisées quel que soit ce que fait ou contourne le client.
export function middleware(request: Request) {
  // On convertit en NextRequest pour utiliser les cookies facilement
  const req = request as NextRequest;
  const { pathname } = req.nextUrl;

  // 1. Récupérer le token de session et le rôle depuis les cookies
  const token = req.cookies.get("session_token")?.value;
  const userRole = normalizeRole(req.cookies.get("user_role")?.value);

  // 2. CAS 1 : L'utilisateur n'est pas connecté
  if (!token) {
    if (pathname !== "/login") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // 3. CAS 2 : L'utilisateur est connecté
  if (token) {
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // --- RESTRICTIONS DE DOSSIERS (réservés aux administrateurs) ---
    const adminOnlyPrefixes = ["/mediation/equipe", "/staff", "/admin"];
    if (adminOnlyPrefixes.some((prefix) => pathname.startsWith(prefix)) && userRole !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|logo|images).*)",
  ],
};
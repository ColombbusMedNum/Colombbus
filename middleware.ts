import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: Request) {
  // On convertit en NextRequest pour utiliser les cookies facilement
  const req = request as NextRequest;
  const { pathname } = req.nextUrl;

  // 1. Récupérer le token de session et le rôle depuis les cookies
  const token = req.cookies.get("session_token")?.value;
  
  // Sécurité : On force le rôle en minuscules pour éviter les erreurs de majuscules (Admin vs admin)
  const userRole = (req.cookies.get("user_role")?.value || "mediateur").toLowerCase();

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

    // --- RESTRICTIONS DE DOSSIERS ---
    // Si la page est /staff OU /equipe, et que l'utilisateur n'est pas admin, redirection à l'accueil
    if ((pathname.startsWith("/equipe") || pathname.startsWith("/staff")) && userRole !== "admin") {
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
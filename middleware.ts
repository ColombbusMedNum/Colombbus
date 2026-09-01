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

  // 0. Domaine canonique : toute visite sur l'URL technique *.hosted.app
  // (générée automatiquement par Firebase App Hosting) redirige vers le
  // domaine personnalisé cosmos.colombbus.org, chemin et paramètres
  // conservés. Ne concerne que ce suffixe précis — jamais localhost en dev.
  // Derrière le proxy/CDN de Firebase App Hosting, req.nextUrl.hostname peut
  // refléter un hôte interne plutôt que le domaine public réellement visité
  // — x-forwarded-host, posé par le proxy, donne le vrai hôte public.
  const hoteVisite = req.headers.get("x-forwarded-host") || req.nextUrl.hostname;
  if (hoteVisite.endsWith(".hosted.app")) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, "https://cosmos.colombbus.org");
    return NextResponse.redirect(url, 308);
  }

  // 1. Récupérer le token de session et le rôle depuis les cookies
  const token = req.cookies.get("session_token")?.value;
  const userRole = normalizeRole(req.cookies.get("user_role")?.value);

  // Pages publiques accessibles sans être connecté — /reset-password reçoit
  // le lien d'activation/réinitialisation envoyé par e-mail (voir
  // app/login/page.tsx et app/mediation/equipe/page.tsx), donc forcément
  // visité avant toute connexion. /planning est la seule route qui ne fait
  // que rediriger (voir app/planning/page.tsx) : la laisser publique évite
  // un aller-retour de redirection en plus avant même d'atteindre /login.
  const pagesPubliques = ["/login", "/reset-password", "/planning"];

  // 2. CAS 1 : L'utilisateur n'est pas connecté — on retient la page visée
  // (ex /agenda/mobile via /planning) pour y revenir juste après connexion.
  if (!token) {
    if (!pagesPubliques.includes(pathname)) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 3. CAS 2 : L'utilisateur est connecté
  if (token) {
    if (pathname === "/login") {
      const next = req.nextUrl.searchParams.get("next");
      const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return NextResponse.redirect(new URL(destination, req.url));
    }

    // --- RESTRICTIONS DE DOSSIERS (réservés aux administrateurs) ---
    const adminOnlyPrefixes = ["/staff", "/admin"];
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
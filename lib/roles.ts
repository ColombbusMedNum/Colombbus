export interface Role {
  id: string;
  nom: string;
  desc: string;
}

// Référentiel unique des rôles de la plateforme.
// Toute page qui affiche ou manipule des rôles doit importer cette liste
// plutôt que d'en redéfinir une localement (c'était la source de la
// désynchronisation entre /mediation/analyse, /admin/droits et login/page.tsx).
export const ROLES: Role[] = [
  { id: "admin", nom: "Administrateur", desc: "Tous les droits d'administration" },
  { id: "mediateur", nom: "Médiateur", desc: "Opérations courantes d'accompagnement" },
  { id: "aci", nom: "ACI", desc: "Agent de coordination et d'intervention — consultation uniquement (reprend les droits de l'ancien rôle Lecteur)" },
  { id: "coordinateur", nom: "Coordinateur", desc: "Suivi global et gestion d'équipe" },
  { id: "formateur", nom: "Formateur", desc: "Accès limité à l'agenda uniquement" },
  { id: "cip", nom: "CIP", desc: "Accès limité à l'agenda uniquement" },
];

export const ROLE_IDS = ROLES.map((r) => r.id);

export const DEFAULT_ROLE = "mediateur";

// Alias vers d'anciens référentiels de rôles utilisés ailleurs dans l'app
// (ex. app/mediation/equipe/page.tsx utilisait autrefois "Mediateur", "Admin",
// "Lecteur", "CoordinateurProjet") : le rôle "Lecteur" a été fusionné dans
// "aci" (mêmes droits), "CoordinateurProjet" correspond au "coordinateur"
// actuel, et "charge_territoire" a été supprimé sans équivalent — un compte
// encore sur ce dernier retombe sur DEFAULT_ROLE et doit être réassigné
// manuellement (voir /admin/droits). Les autres anciennes valeurs
// ("Mediateur", "Admin") correspondent déjà aux ids canoniques une fois
// mises en minuscules, donc aucun alias n'est nécessaire pour elles.
const LEGACY_ROLE_ALIASES: Record<string, string> = {
  lecteur: "aci",
  coordinateurprojet: "coordinateur",
};

export function normalizeRole(rawRole: string | null | undefined): string {
  const normalized = (rawRole || "").toLowerCase().trim();
  const resolved = LEGACY_ROLE_ALIASES[normalized] || normalized;
  return ROLE_IDS.includes(resolved) ? resolved : DEFAULT_ROLE;
}

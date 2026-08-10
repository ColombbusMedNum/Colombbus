export interface Role {
  id: string;
  nom: string;
  desc: string;
}

// Référentiel unique des rôles de la plateforme.
// Toute page qui affiche ou manipule des rôles doit importer cette liste
// plutôt que d'en redéfinir une localement (c'était la source de la
// désynchronisation entre /analyse, /admin/droits et login/page.tsx).
export const ROLES: Role[] = [
  { id: "admin", nom: "Administrateur", desc: "Tous les droits d'administration" },
  { id: "mediateur", nom: "Médiateur", desc: "Opérations courantes d'accompagnement" },
  { id: "aci", nom: "ACI", desc: "Agent de coordination et d'intervention" },
  { id: "charge_territoire", nom: "Chargé de territoire", desc: "Suivi d'un territoire donné" },
  { id: "lecteur", nom: "Lecteur", desc: "Consultation uniquement (lecture seule)" },
  { id: "coordinateur", nom: "Coordinateur", desc: "Suivi global et gestion d'équipe" },
];

export const ROLE_IDS = ROLES.map((r) => r.id);

export const DEFAULT_ROLE = "mediateur";

export function normalizeRole(rawRole: string | null | undefined): string {
  const normalized = (rawRole || "").toLowerCase().trim();
  return ROLE_IDS.includes(normalized) ? normalized : DEFAULT_ROLE;
}

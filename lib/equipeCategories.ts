// Regroupement partagé des membres de l'équipe en catégories métier, utilisé
// par la page Équipe (fiches) et l'Agenda (grille de planning) pour afficher
// des blocs rétractables cohérents entre les deux pages. Les ACI sont scindés
// Paris/Massy selon leur grille de référence (rattachementHoraireACI) : ce
// sont deux plannings horaires distincts (voir app/mediation/equipe/page.tsx).
export interface CategorieEquipe {
  key: string;
  label: string;
  filtre: (m: any) => boolean;
}

export const CATEGORIES_EQUIPE: CategorieEquipe[] = [
  { key: "cadres", label: "Cadres", filtre: (m) => m.statut === "Cadre" },
  { key: "permanents", label: "Permanents", filtre: (m) => m.statut === "Permanent" },
  { key: "aci_massy", label: "ACI Massy", filtre: (m) => m.statut === "ACI" && (m.rattachementHoraireACI || "Paris") === "Massy" },
  { key: "aci_paris", label: "ACI Paris", filtre: (m) => m.statut === "ACI" && (m.rattachementHoraireACI || "Paris") === "Paris" },
  { key: "stagiaires", label: "Stagiaires", filtre: (m) => m.statut === "Stagiaire" },
];

export function regrouperParCategorie<T extends { id: string }>(membres: T[]): (CategorieEquipe & { membres: T[] })[] {
  const groupes = CATEGORIES_EQUIPE.map(cat => ({ ...cat, membres: membres.filter(cat.filtre) }));
  const dejaClasses = new Set(groupes.flatMap(g => g.membres.map((m) => m.id)));
  const autres = membres.filter((m) => !dejaClasses.has(m.id));
  if (autres.length > 0) {
    groupes.push({ key: "autres", label: "Autres", filtre: () => false, membres: autres });
  }
  return groupes;
}

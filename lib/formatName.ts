// Casse normalisée pour les noms/prénoms saisis dans les formulaires
// d'inscription — le nom de famille toujours en MAJUSCULES, le prénom avec
// une majuscule initiale par mot (gère les prénoms composés à trait d'union
// ou à apostrophe, ex. "Jean-Pierre", "N'Guessan") et le reste en minuscules.
export function formatNom(s?: string): string {
  return (s || "").trim().toUpperCase();
}

export function formatPrenom(s?: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep, lettre) => sep + lettre.toUpperCase());
}

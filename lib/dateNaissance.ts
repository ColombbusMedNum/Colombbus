// Calcule un âge (en années révolues) à partir d'une date de naissance au
// format "AAAA-MM-JJ" (valeur native d'un <input type="date">) — utilisé
// pour préremplir un champ "Age" dérivé sans redemander l'âge en chiffre.
export function calculerAge(dateNaissanceISO: string): number | null {
  if (!dateNaissanceISO) return null;
  const naissance = new Date(dateNaissanceISO);
  if (isNaN(naissance.getTime())) return null;

  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - naissance.getFullYear();
  const anniversaireDejaPasse =
    aujourdhui.getMonth() > naissance.getMonth() ||
    (aujourdhui.getMonth() === naissance.getMonth() && aujourdhui.getDate() >= naissance.getDate());
  if (!anniversaireDejaPasse) age--;

  return age >= 0 ? age : null;
}

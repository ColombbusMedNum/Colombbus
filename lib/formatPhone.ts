// Formatage de numéro de téléphone partagé — avant cette centralisation,
// deux implémentations divergentes coexistaient : l'une (bénéficiaires)
// ne formatait que les numéros à 10 chiffres exacts et retombait sur la
// valeur brute sinon ; l'autre (équipe) découpait par paires de chiffres
// sans condition de longueur, produisant un résultat différent pour tout
// numéro non standard (international, incomplet...).
export function formatPhoneNumber(phone?: string | null): string {
  if (!phone) return "—";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(?=\d)/g, "$1 ");
  }
  return phone;
}

// Lecture tolérante des champs nom/prénom/téléphone d'un document
// utilisateurs (bénéficiaire). Tous les formulaires actuels écrivent la
// casse canonique (Nom, Prénom, Téléphone — voir components/BeneficiaryForm.tsx
// et le formulaire de création rapide dans app/mediation/rencontres-numeriques/suresnes/page.tsx),
// mais d'anciennes fiches importées avant cette convention utilisent encore
// des variantes en minuscule/sans accent. Avant cette centralisation, chaque
// page qui lisait ces champs redéfinissait sa propre chaîne de repli, souvent
// incomplète — ce qui a fait disparaître un numéro de téléphone lors d'une
// fusion de fiches (la variante "Telephone" sans accent n'était couverte
// nulle part).
export function lireNom(data: any): string {
  return data?.Nom || data?.nom || "";
}

export function lirePrenom(data: any): string {
  return data?.Prénom || data?.prénom || data?.Prenom || data?.prenom || "";
}

export function lireTelephone(data: any): string {
  return data?.Téléphone || data?.telephone || data?.Telephone || "";
}

// Affichage "00 00 00 00 00" d'un numéro français à 10 chiffres — les
// numéros sont saisis/importés sans séparateur ; ne touche pas aux formats
// qui ne correspondent pas à ce schéma (international, incomplet...), pour
// ne jamais afficher un numéro tronqué ou mal coupé.
export function formaterTelephone(tel?: string): string {
  const chiffres = (tel || "").replace(/\D/g, "");
  if (chiffres.length !== 10) return tel || "";
  return chiffres.match(/.{1,2}/g)!.join(" ");
}

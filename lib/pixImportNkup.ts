// Import des exports CSV Pix pour le parcours diagnostic "PARKOUR
// NUMERIK'UP" — format différent de celui géré par lib/pixImport.ts
// (Digital Up 96H / Numérik'UP Pro) : pas de colonne Email ni de "Nombre de
// pix total"/"Niveau pour la compétence X", mais un palier (/3), 6 badges de
// compétences numériques de base, et un détail en % de maîtrise par
// compétence puis par domaine. Réutilise les utilitaires génériques de
// pixImport.ts (parseur CSV, normalisation, fusion par date) plutôt que de
// les dupliquer, mais garde son propre parseur d'en-têtes et sa propre
// structure de résultat, trop différents pour être unifiés avec PixResultat.

import { COMPETENCES_PIX, normaliser, parserCsvDelimite, trouverColonne, parseDateFr, fusionnerResultats } from "@/lib/pixImport";

export const BADGES_NKUP = [
  "J’utilise une application mobile",
  "J’ai des notions de bureautique",
  "Je navigue et je communique en ligne",
  "J’organise mes fichiers",
  "J’identifie mon environnement numérique",
  "J’adopte un comportement prudent",
] as const;

export const DOMAINES_NKUP = [
  "Information et données",
  "Communication et collaboration",
  "Création de contenu",
  "Protection et sécurité",
  "Environnement numérique",
] as const;

export interface PixAcquisResultatNkup {
  pct: number | null; // 0..1
  nbAcquisCible: number | null;
  nbAcquisMaitrises: number | null;
}

export interface PixResultatNkup {
  date: string; // ISO "AAAA-MM-JJ", extraite de "Date et heure de début"
  campagne?: string;
  partage: boolean;
  progression: number; // 0..1, connue même quand partage = false
  palier: number | null; // 0..3, null si non partagé
  maitriseGlobale: number | null; // 0..1
  badges: Record<string, boolean | null>; // clé = libellé de BADGES_NKUP
  competences: Record<string, PixAcquisResultatNkup>;
  domaines: Record<string, PixAcquisResultatNkup>;
}

export interface LignePixNkupCsv {
  nom: string;
  prenom: string;
  resultat: PixResultatNkup;
}

function parseDecimalOuNull(brut: string): number | null {
  const v = (brut || "").trim();
  if (!v || normaliser(v) === "na") return null;
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

function parseOuiNonOuNull(brut: string): boolean | null {
  const v = (brut || "").trim();
  if (!v || normaliser(v) === "na") return null;
  return normaliser(v).startsWith("oui");
}

// Rapproche un nom d'en-tête (ex. extrait de "% de maitrise des acquis de la
// compétence Gérer des données") de l'étiquette canonique la plus proche,
// tolérant aux variations d'accents/apostrophes/casse.
function trouverEtiquette(nomExtrait: string, liste: readonly string[]): string | null {
  const n = normaliser(nomExtrait);
  return liste.find((e) => normaliser(e) === n) || null;
}

export interface ParsePixNkupResultat {
  lignes: LignePixNkupCsv[];
  anomalies: number[];
}

export function parserCsvPixNkup(texte: string): ParsePixNkupResultat {
  const lignesBrutes = parserCsvDelimite(texte, ";");
  if (lignesBrutes.length === 0) return { lignes: [], anomalies: [] };
  const entetes = lignesBrutes[0];

  const iNom = trouverColonne(entetes, /^nom du participant$/);
  const iPrenom = trouverColonne(entetes, /^prenom du participant$/);
  const iCampagne = trouverColonne(entetes, /^nom de la campagne$/);
  const iDate = trouverColonne(entetes, /^date et heure de debut/);
  const iProgression = trouverColonne(entetes, /^% de progression$/);
  const iPartage = trouverColonne(entetes, /^partage/);
  const iPalier = trouverColonne(entetes, /^palier obtenu/);
  const iMaitriseGlobale = trouverColonne(entetes, /^% maitrise de l.ensemble des acquis du profil$/);

  const colonnesBadges: { index: number; badge: string }[] = [];
  BADGES_NKUP.forEach((badge) => {
    const cible = normaliser(badge);
    const index = entetes.findIndex((e) => {
      const h = normaliser(e);
      return h.startsWith(cible) && h.includes("obtenu");
    });
    if (index >= 0) colonnesBadges.push({ index, badge });
  });

  // Compétences et domaines : chaque bloc de 3 colonnes (%, nb acquis cible,
  // acquis maîtrisés) est identifié indépendamment, comme dans pixImport.ts.
  const colonnesCompetences: { index: number; nom: string; type: "pct" | "cible" | "maitrises" }[] = [];
  const colonnesDomaines: { index: number; nom: string; type: "pct" | "cible" | "maitrises" }[] = [];
  entetes.forEach((e, i) => {
    const h = normaliser(e);
    const mPctComp = h.match(/^% de maitrise des acquis de la competence (.+)$/);
    const mCibleComp = h.match(/^nombre d.?acquis du profil cible dans la competence (.+)$/);
    const mMaitrisesComp = h.match(/^acquis maitrises dans la competence (.+)$/);
    const mPctDom = h.match(/^% de maitrise des acquis du domaine (.+)$/);
    const mCibleDom = h.match(/^nombre d.?acquis du profil cible du domaine (.+)$/);
    const mMaitrisesDom = h.match(/^acquis maitrises du domaine (.+)$/);
    if (mPctComp) { const nom = trouverEtiquette(mPctComp[1], COMPETENCES_PIX); if (nom) colonnesCompetences.push({ index: i, nom, type: "pct" }); }
    else if (mCibleComp) { const nom = trouverEtiquette(mCibleComp[1], COMPETENCES_PIX); if (nom) colonnesCompetences.push({ index: i, nom, type: "cible" }); }
    else if (mMaitrisesComp) { const nom = trouverEtiquette(mMaitrisesComp[1], COMPETENCES_PIX); if (nom) colonnesCompetences.push({ index: i, nom, type: "maitrises" }); }
    else if (mPctDom) { const nom = trouverEtiquette(mPctDom[1], DOMAINES_NKUP); if (nom) colonnesDomaines.push({ index: i, nom, type: "pct" }); }
    else if (mCibleDom) { const nom = trouverEtiquette(mCibleDom[1], DOMAINES_NKUP); if (nom) colonnesDomaines.push({ index: i, nom, type: "cible" }); }
    else if (mMaitrisesDom) { const nom = trouverEtiquette(mMaitrisesDom[1], DOMAINES_NKUP); if (nom) colonnesDomaines.push({ index: i, nom, type: "maitrises" }); }
  });

  const donnees = lignesBrutes.slice(1);
  const anomalies = donnees
    .map((l, i) => (l.length !== entetes.length ? i + 2 : null))
    .filter((n): n is number => n !== null);

  const remplirAcquis = (l: string[], colonnes: { index: number; nom: string; type: "pct" | "cible" | "maitrises" }[]) => {
    const resultat: Record<string, PixAcquisResultatNkup> = {};
    colonnes.forEach(({ index, nom, type }) => {
      if (!resultat[nom]) resultat[nom] = { pct: null, nbAcquisCible: null, nbAcquisMaitrises: null };
      const valeur = parseDecimalOuNull(l[index] || "");
      if (type === "pct") resultat[nom].pct = valeur;
      else if (type === "cible") resultat[nom].nbAcquisCible = valeur;
      else resultat[nom].nbAcquisMaitrises = valeur;
    });
    return resultat;
  };

  const lignes: LignePixNkupCsv[] = donnees
    .map((l) => {
      const nom = (l[iNom] || "").trim();
      const prenom = (l[iPrenom] || "").trim();
      if (!nom && !prenom) return null;

      const badges: Record<string, boolean | null> = {};
      colonnesBadges.forEach(({ index, badge }) => { badges[badge] = parseOuiNonOuNull(l[index] || ""); });

      const dateEnvoi = iDate >= 0 ? parseDateFr(l[iDate]) : null;

      const resultat: PixResultatNkup = {
        date: dateEnvoi || new Date().toISOString().slice(0, 10),
        campagne: iCampagne >= 0 ? (l[iCampagne] || "").trim() : undefined,
        partage: iPartage >= 0 ? normaliser(l[iPartage] || "").startsWith("oui") : false,
        progression: iProgression >= 0 ? parseDecimalOuNull(l[iProgression] || "") || 0 : 0,
        palier: iPalier >= 0 ? parseDecimalOuNull(l[iPalier] || "") : null,
        maitriseGlobale: iMaitriseGlobale >= 0 ? parseDecimalOuNull(l[iMaitriseGlobale] || "") : null,
        badges,
        competences: remplirAcquis(l, colonnesCompetences),
        domaines: remplirAcquis(l, colonnesDomaines),
      };

      return { nom, prenom, resultat };
    })
    .filter((l): l is LignePixNkupCsv => l !== null);

  return { lignes, anomalies };
}

// Rapprochement uniquement par nom + prénom : ce format n'a pas de colonne
// email (voir en-tête du fichier).
export function trouverApprenantParNomPrenom<T extends { id: string; Nom?: string; Prénom?: string }>(
  ligne: { nom: string; prenom: string },
  apprenants: T[]
): T | null {
  const nomLigne = normaliser(ligne.nom);
  const prenomLigne = normaliser(ligne.prenom);
  return apprenants.find((a) => normaliser(a.Nom || "") === nomLigne && normaliser(a.Prénom || "") === prenomLigne) || null;
}

export const fusionnerResultatsNkup = fusionnerResultats<PixResultatNkup>;

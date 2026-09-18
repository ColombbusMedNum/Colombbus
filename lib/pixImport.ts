// Import des exports CSV Pix (plateforme pix.org) pour le suivi des
// compétences numériques des apprenant·e·s Digital Up 96H / Numérik'UP Pro.
// Partagé entre les deux modules — mêmes noms de champs sur les documents
// d'inscription (Prénom, Nom, Email, Session...), voir [id]/apprenants/page.tsx
// de chaque module.

// Liste fermée des 16 compétences du référentiel Pix (CleaNumérique), dans
// l'ordre où elles apparaissent sur l'export — sert de vocabulaire canonique
// pour les clés stockées en base, indépendamment du libellé exact retrouvé
// dans l'en-tête d'un fichier donné (voir trouverCompetence ci-dessous).
export const COMPETENCES_PIX = [
  "Mener une recherche et une veille d’information",
  "Gérer des données",
  "Traiter des données",
  "Interagir",
  "Partager et publier",
  "Collaborer",
  "S’insérer dans le monde numérique",
  "Développer des documents textuels",
  "Développer des documents multimedia",
  "Adapter les documents à leur finalité",
  "Programmer",
  "Sécuriser l’environnement numérique",
  "Protéger les données personnelles et la vie privée",
  "Protéger la santé, le bien-être et l’environnement",
  "Résoudre des problèmes techniques",
  "Construire un environnement numérique",
] as const;

export interface PixCompetenceResultat {
  niveau: number;
  pix: number;
}

// Un import CSV = un instantané à une date donnée (un·e apprenant·e peut être
// retesté·e plusieurs fois au cours de son parcours) — voir PixResultats sur
// le document d'inscription, tableau grandissant à chaque import.
export interface PixResultat {
  date: string; // ISO "AAAA-MM-JJ", extraite de "Date et heure de l'envoi"
  campagne?: string;
  totalPix: number;
  certifiable: boolean;
  nbCompetencesCertifiables: number;
  competences: Record<string, PixCompetenceResultat>;
}

export interface LignePixCsv {
  nom: string;
  prenom: string;
  email: string;
  resultat: PixResultat;
}

function normaliser(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Parseur CSV tolérant aux champs entre guillemets (RFC4180), délimiteur
// paramétrable — les exports Pix utilisent le point-virgule, contrairement
// aux exports Google Forms (virgule) déjà gérés par parserCSV côté import
// des préinscriptions (app/.../importer/page.tsx).
function parserCsvDelimite(texte: string, delimiteur: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let dansGuillemets = false;
  let debutDeChamp = true;
  let i = 0;
  while (i < texte.length) {
    const c = texte[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') { champ += '"'; i += 2; continue; }
        dansGuillemets = false; i++; continue;
      }
      champ += c; i++; continue;
    }
    if (c === '"' && debutDeChamp) { dansGuillemets = true; debutDeChamp = false; i++; continue; }
    if (c === delimiteur) { ligne.push(champ); champ = ""; debutDeChamp = true; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; debutDeChamp = true; i++; continue; }
    champ += c; debutDeChamp = false; i++;
  }
  if (champ.length > 0 || ligne.length > 0) { ligne.push(champ); lignes.push(ligne); }
  return lignes.filter((l) => l.some((v) => v.trim() !== ""));
}

function trouverColonne(entetes: string[], motif: RegExp): number {
  return entetes.findIndex((e) => motif.test(normaliser(e)));
}

// Retrouve la compétence canonique correspondant au nom extrait d'un en-tête
// "Niveau/Nombre de pix pour la compétence <nom>" — comparaison tolérante
// (accents/apostrophes/casse ignorés) plutôt qu'une égalité stricte, pour ne
// pas casser le rapprochement sur une variation mineure de ponctuation d'un
// export à l'autre.
function trouverCompetence(nomExtrait: string): string | null {
  const n = normaliser(nomExtrait);
  return COMPETENCES_PIX.find((c) => normaliser(c) === n) || null;
}

function parseDateEnvoi(brut: string): string | null {
  const m = (brut || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export interface ParsePixResultat {
  lignes: LignePixCsv[];
  anomalies: number[];
}

export function parserCsvPix(texte: string): ParsePixResultat {
  const lignesBrutes = parserCsvDelimite(texte, ";");
  if (lignesBrutes.length === 0) return { lignes: [], anomalies: [] };
  const entetes = lignesBrutes[0];

  const iNom = trouverColonne(entetes, /nom du participant/);
  const iPrenom = trouverColonne(entetes, /prenom du participant/);
  const iEmail = trouverColonne(entetes, /^email$/);
  const iDate = trouverColonne(entetes, /date et heure de l.?envoi/);
  const iCampagne = trouverColonne(entetes, /nom de la campagne/);
  const iTotalPix = trouverColonne(entetes, /nombre de pix total/);
  const iCertifiable = trouverColonne(entetes, /^certifiable/);
  const iNbCertifiables = trouverColonne(entetes, /nombre de competences certifiables/);

  // Colonnes par compétence : une paire (niveau, pix) par compétence trouvée
  // dans l'en-tête — l'ordre réel du fichier n'a pas besoin de correspondre à
  // COMPETENCES_PIX, chaque colonne est identifiée indépendamment.
  const colonnesCompetences: { index: number; competence: string; type: "niveau" | "pix" }[] = [];
  entetes.forEach((e, i) => {
    const h = normaliser(e);
    const mNiveau = h.match(/^niveau pour la competence (.+)$/);
    const mPix = h.match(/^nombre de pix pour la competence (.+)$/);
    if (mNiveau) {
      const competence = trouverCompetence(mNiveau[1]);
      if (competence) colonnesCompetences.push({ index: i, competence, type: "niveau" });
    } else if (mPix) {
      const competence = trouverCompetence(mPix[1]);
      if (competence) colonnesCompetences.push({ index: i, competence, type: "pix" });
    }
  });

  const donnees = lignesBrutes.slice(1);
  const anomalies = donnees
    .map((l, i) => (l.length !== entetes.length ? i + 2 : null))
    .filter((n): n is number => n !== null);

  const lignes: LignePixCsv[] = donnees
    .map((l) => {
      const nom = (l[iNom] || "").trim();
      const prenom = (l[iPrenom] || "").trim();
      if (!nom && !prenom) return null;

      const competences: Record<string, PixCompetenceResultat> = {};
      colonnesCompetences.forEach(({ index, competence, type }) => {
        const valeurBrute = parseFloat((l[index] || "0").replace(",", "."));
        const valeur = isNaN(valeurBrute) ? 0 : valeurBrute;
        if (!competences[competence]) competences[competence] = { niveau: 0, pix: 0 };
        competences[competence][type] = valeur;
      });

      const dateEnvoi = iDate >= 0 ? parseDateEnvoi(l[iDate]) : null;

      const resultat: PixResultat = {
        date: dateEnvoi || new Date().toISOString().slice(0, 10),
        campagne: iCampagne >= 0 ? (l[iCampagne] || "").trim() : undefined,
        totalPix: iTotalPix >= 0 ? parseInt(l[iTotalPix] || "0", 10) || 0 : 0,
        certifiable: iCertifiable >= 0 ? normaliser(l[iCertifiable]).startsWith("oui") : false,
        nbCompetencesCertifiables: iNbCertifiables >= 0 ? parseInt(l[iNbCertifiables] || "0", 10) || 0 : 0,
        competences,
      };

      return { nom, prenom, email: iEmail >= 0 ? (l[iEmail] || "").trim() : "", resultat };
    })
    .filter((l): l is LignePixCsv => l !== null);

  return { lignes, anomalies };
}

// Rapproche une ligne CSV d'un·e apprenant·e déjà inscrit·e : email en
// priorité (le plus fiable), nom+prénom en repli si l'email est absent ou ne
// correspond à personne — voir la question posée à l'équipe sur ce choix.
export function trouverApprenantPourLigne<T extends { id: string; Nom?: string; Prénom?: string; Email?: string }>(
  ligne: LignePixCsv,
  apprenants: T[]
): T | null {
  const emailLigne = normaliser(ligne.email);
  if (emailLigne) {
    const parEmail = apprenants.find((a) => normaliser(a.Email || "") === emailLigne);
    if (parEmail) return parEmail;
  }
  const nomLigne = normaliser(ligne.nom);
  const prenomLigne = normaliser(ligne.prenom);
  return apprenants.find((a) => normaliser(a.Nom || "") === nomLigne && normaliser(a.Prénom || "") === prenomLigne) || null;
}

// Fusionne un lot de nouveaux résultats (un import peut charger plusieurs
// fichiers CSV à la suite, chacun représentant une date de test différente,
// dans un ordre quelconque — l'équipe ne les dépose pas forcément du plus
// ancien au plus récent) dans l'historique existant : le tri final se fait
// toujours par date, jamais par ordre d'arrivée. Un ré-import à une date déjà
// présente remplace l'entrée existante plutôt que de la dupliquer ; en cas de
// doublon de date au sein du même lot, la dernière ligne rencontrée l'emporte.
export function fusionnerResultats(historique: PixResultat[] | undefined, nouveaux: PixResultat[]): PixResultat[] {
  const dernierParDate = new Map<string, PixResultat>();
  nouveaux.forEach((r) => dernierParDate.set(r.date, r));
  const sansDoublon = (historique || []).filter((r) => !dernierParDate.has(r.date));
  return [...sansDoublon, ...Array.from(dernierParDate.values())].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export const PALETTE_COURBES = [
  "#005259", "#EA601F", "#7C1FD1", "#22D3EE", "#F5820D", "#22C55E",
  "#EF4444", "#3B82F6", "#FDE047", "#EC4899", "#14B8A6", "#A855F7",
  "#84CC16", "#F97316", "#0EA5E9", "#DC2626",
];

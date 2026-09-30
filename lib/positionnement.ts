// Moteur générique de "test de positionnement" multi-sections, à contenu
// entièrement éditable depuis l'interface (voir components/EditeurPositionnement.tsx)
// — contrairement aux modules Test de langue B1 / Collecte Tech (lib/testLangueB1.ts,
// lib/collecteTechQuiz.ts), dont les questions sont fixes et codées en dur.
// Stocké dans Firestore sous positionnement/{programmeId} (voir firestore.rules) —
// programmeId est une chaîne libre, pas couplée à ActionSchema/dynamic_actions,
// pour rester attachable à n'importe quel programme (historique ou action
// dynamique). Premier programme câblé : PRFE (voir app/inscription/
// prfe-positionnement et reponses/prfe/positionnement).

export type TypeItemPositionnement = "texte_intro" | "qcm" | "texte_libre";

export interface ItemPositionnement {
  id: string;
  type: TypeItemPositionnement;
  // texte_intro : bloc de texte affiché tel quel (ex. le texte à lire avant
  // une série de questions de compréhension écrite) — jamais noté.
  contenu?: string;
  // qcm / texte_libre : l'énoncé de la question.
  enonce?: string;
  // qcm uniquement.
  options?: string[];
  bonneReponseIndex?: number;
  // texte_libre uniquement, facultatif : une réponse de référence, jamais
  // montrée au candidat, utilisée seulement comme indice visuel pour le
  // correcteur (voir reponseSembleCorrecte) — ne remplace pas sa décision.
  reponseIndicative?: string;
}

export interface SectionPositionnement {
  id: string;
  titre: string;
  sousTitre?: string;
  items: ItemPositionnement[];
}

export interface ConfigPositionnement {
  titre: string;
  description?: string;
  sections: SectionPositionnement[];
}

export function nouvelleConfigPositionnementVide(titre: string): ConfigPositionnement {
  return { titre, description: "", sections: [] };
}

// Une réponse candidat par item : un index (qcm) ou un texte libre (texte_libre).
// Les items "texte_intro" n'ont jamais de réponse associée.
export type ReponsesPositionnement = Record<string, number | string>;

export interface ScorePositionnement {
  scoreGlobal: number;
  totalQcmGlobal: number;
  parSection: Record<string, { score: number; total: number }>;
}

// Score = uniquement sur les items "qcm" (1 point par bonne réponse) — les
// réponses "texte_libre" ne comptent jamais dans le score, elles sont
// enregistrées telles quelles pour relecture manuelle côté staff (voir
// components/PositionnementResultats.tsx).
export function calculerScorePositionnement(config: ConfigPositionnement, reponses: ReponsesPositionnement): ScorePositionnement {
  let scoreGlobal = 0;
  let totalQcmGlobal = 0;
  const parSection: Record<string, { score: number; total: number }> = {};

  config.sections.forEach((section) => {
    let score = 0;
    let total = 0;
    section.items.forEach((item) => {
      if (item.type !== "qcm") return;
      total += 1;
      totalQcmGlobal += 1;
      if (reponses[item.id] === item.bonneReponseIndex) {
        score += 1;
        scoreGlobal += 1;
      }
    });
    parSection[section.id] = { score, total };
  });

  return { scoreGlobal, totalQcmGlobal, parSection };
}

// Regroupe les séparateurs de milliers ("1 500" -> "1500") et convertit la
// virgule décimale française ("16,25" -> "16.25"), pour extraire les
// nombres réellement présents dans une réponse (ex. "1 650 €" -> [1650],
// "3 h 30" -> [3, 30]).
function extraireNombres(texte: string): number[] {
  let t = texte;
  let precedent: string;
  do {
    precedent = t;
    t = t.replace(/(\d)[\s.](\d{3})(?!\d)/g, "$1$2");
  } while (t !== precedent);
  t = t.replace(/(\d)[,](\d{1,2})(?!\d)/g, "$1.$2");
  const trouves = t.match(/\d+(?:\.\d+)?/g) || [];
  return trouves.map(Number).filter((n) => !Number.isNaN(n));
}

// Comparaison numérique (calculs, prix, horaires...) : tous les nombres de
// la réponse indicative doivent se retrouver dans la réponse candidate,
// quel que soit le format (espace/virgule/unité). Retourne null quand la
// réponse indicative n'est pas numérique, pour retomber sur la comparaison
// textuelle (voir reponseSembleCorrecte).
function reponseNumeriqueSembleCorrecte(reponseCandidat: string, reponseIndicative: string): boolean | null {
  const nombresIndicatifs = extraireNombres(reponseIndicative);
  if (nombresIndicatifs.length === 0) return null;
  const nombresCandidat = extraireNombres(reponseCandidat);
  if (nombresCandidat.length === 0) return false;
  return nombresIndicatifs.every((n) => nombresCandidat.includes(n));
}

function normaliser(texte: string): string {
  return texte
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Indice visuel uniquement (jamais une correction automatique) : compare la
// réponse libre du/de la candidat·e à une réponse indicative optionnelle
// définie par l'admin (voir ItemPositionnement.reponseIndicative), pour
// surligner en vert les réponses qui semblent bonnes et accélérer la
// correction manuelle — la décision finale reste toujours celle du
// correcteur (voir CorrectionsManuelles).
export function reponseSembleCorrecte(reponseCandidat: string | undefined, reponseIndicative: string | undefined): boolean {
  if (!reponseCandidat || !reponseIndicative) return false;
  // Réponse indicative numérique (calcul, prix, horaire...) : comparaison
  // par valeur plutôt que par texte, tolère "62", "62€", "62 €" etc.
  const verdictNumerique = reponseNumeriqueSembleCorrecte(reponseCandidat, reponseIndicative);
  if (verdictNumerique !== null) return verdictNumerique;

  const candidat = normaliser(reponseCandidat);
  const indicative = normaliser(reponseIndicative);
  if (!candidat || !indicative) return false;
  if (candidat === indicative) return true;
  // Réponse indicative courte (ex. un nombre, une heure, un mot) : elle doit
  // apparaître telle quelle dans la réponse candidate.
  const mots = indicative.split(" ").filter((m) => m.length > 0);
  if (mots.length <= 2) return candidat.includes(indicative);
  // Réponse indicative plus longue (ex. une phrase) : on tolère que la
  // plupart des mots significatifs (3 lettres et plus) soient présents,
  // sans exiger le même ordre ni une correspondance exacte.
  const motsSignificatifs = mots.filter((m) => m.length >= 3);
  if (motsSignificatifs.length === 0) return candidat.includes(indicative);
  const motsTrouves = motsSignificatifs.filter((m) => candidat.includes(m)).length;
  return motsTrouves / motsSignificatifs.length >= 0.7;
}

// Statut de correction manuelle d'une réponse libre — "partiel" (ex. une
// production écrite avec quelques fautes mais compréhensible, ou un calcul
// à la bonne méthode mais au résultat légèrement faux) vaut un demi-point,
// à mi-chemin entre correct (1) et incorrect (0).
export type StatutCorrectionManuelle = "correct" | "partiel" | "incorrect";
export const POINTS_CORRECTION: Record<StatutCorrectionManuelle, number> = { correct: 1, partiel: 0.5, incorrect: 0 };
export type CorrectionsManuelles = Record<string, StatutCorrectionManuelle>;

// Combine le score QCM (calculé à l'envoi, voir calculerScorePositionnement)
// avec les corrections manuelles des réponses libres (voir
// components/PositionnementResultats.tsx) — global et par section.
export function calculerScoreCombine(
  config: ConfigPositionnement,
  scoreQcmGlobal: number,
  totalQcmGlobal: number,
  scoreParSectionQcm: Record<string, { score: number; total: number }> | undefined,
  corrections: CorrectionsManuelles | undefined
): { global: { score: number; total: number }; parSection: Record<string, { score: number; total: number }> } {
  let score = scoreQcmGlobal;
  let total = totalQcmGlobal;
  const parSection: Record<string, { score: number; total: number }> = {};

  config.sections.forEach((section) => {
    const base = scoreParSectionQcm?.[section.id] || { score: 0, total: 0 };
    let sScore = base.score;
    let sTotal = base.total;
    section.items.forEach((item) => {
      if (item.type !== "texte_libre") return;
      sTotal += 1;
      total += 1;
      const points = POINTS_CORRECTION[corrections?.[item.id] as StatutCorrectionManuelle];
      if (points !== undefined) {
        sScore += points;
        score += points;
      }
    });
    parSection[section.id] = { score: sScore, total: sTotal };
  });

  return { global: { score, total }, parSection };
}

// Score des seules questions "texte_libre" (corrections manuelles), pour
// l'afficher séparément du score QCM (colonnes distinctes sur la liste des
// résultats — voir components/PositionnementResultats.tsx).
export function calculerScoreTexteLibre(config: ConfigPositionnement, corrections: CorrectionsManuelles | undefined): { score: number; total: number } {
  let score = 0;
  let total = 0;
  config.sections.forEach((section) => {
    section.items.forEach((item) => {
      if (item.type !== "texte_libre") return;
      total += 1;
      const points = POINTS_CORRECTION[corrections?.[item.id] as StatutCorrectionManuelle];
      if (points !== undefined) score += points;
    });
  });
  return { score, total };
}

// Nombre de questions "texte_libre" pas encore corrigées manuellement — sert
// à alerter avant validation (voir components/PositionnementResultats.tsx).
export function compterTexteLibreNonCorrigees(config: ConfigPositionnement, corrections: CorrectionsManuelles | undefined): number {
  let n = 0;
  config.sections.forEach((section) => {
    section.items.forEach((item) => {
      if (item.type !== "texte_libre") return;
      if (POINTS_CORRECTION[corrections?.[item.id] as StatutCorrectionManuelle] === undefined) n += 1;
    });
  });
  return n;
}

// Un score peut désormais être fractionnaire (demi-point) — affiche "6" ou
// "6.5", jamais "6.50" ni "6.0".
export function formaterPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

import fs from "fs";
import path from "path";

// Vérification "adresse en QPV ?" côté serveur, à partir du jeu de données
// officiel data.gouv.fr (périmètres QPV 2024, WGS84 — voir data/qpv-2024.geojson,
// téléchargé depuis https://www.data.gouv.fr/datasets/quartiers-prioritaires-de-la-politique-de-la-ville-qpv).
// L'API officielle de sig.ville.gouv.fr n'est accessible que sur demande de
// compte (georeferencement@anct.gouv.fr) — cette approche reproduit la même
// vérification (géocodage + test point-dans-polygone) sans en dépendre.
// N'est qu'une aide au pré-remplissage : reste à confirmer/corriger par la
// personne qui remplit le formulaire, jamais garantie à 100% (adresse mal
// géocodée, imprécision des données...).

interface FeatureQPV {
  properties: { lib_qp?: string; [k: string]: unknown };
  geometry: { type: string; coordinates: any };
}

let featuresCache: FeatureQPV[] | null = null;

function chargerFeatures(): FeatureQPV[] {
  if (featuresCache) return featuresCache;
  const cheminFichier = path.join(process.cwd(), "data", "qpv-2024.geojson");
  const brut = fs.readFileSync(cheminFichier, "utf-8");
  const geojson = JSON.parse(brut);
  featuresCache = geojson.features || [];
  return featuresCache!;
}

// Algorithme de ray-casting classique (règle pair/impair), anneau par
// anneau : le premier anneau d'un polygone est son contour extérieur, les
// suivants sont des trous à soustraire.
function pointDansAnneau(point: [number, number], anneau: number[][]): boolean {
  const [x, y] = point;
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i];
    const [xj, yj] = anneau[j];
    const intersecte = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersecte) dedans = !dedans;
  }
  return dedans;
}

function pointDansPolygone(point: [number, number], polygone: number[][][]): boolean {
  if (!pointDansAnneau(point, polygone[0])) return false;
  for (let i = 1; i < polygone.length; i++) {
    if (pointDansAnneau(point, polygone[i])) return false;
  }
  return true;
}

function pointDansGeometrie(point: [number, number], geometrie: FeatureQPV["geometry"]): boolean {
  if (geometrie.type === "Polygon") return pointDansPolygone(point, geometrie.coordinates);
  if (geometrie.type === "MultiPolygon") {
    return (geometrie.coordinates as number[][][][]).some((polygone) => pointDansPolygone(point, polygone));
  }
  return false;
}

// lon/lat au format GeoJSON standard (ordre [longitude, latitude]), celui
// aussi renvoyé par l'API Adresse du gouvernement (api-adresse.data.gouv.fr).
export function verifierPointDansQPV(lon: number, lat: number): { enQPV: boolean; nomQPV?: string } {
  const point: [number, number] = [lon, lat];
  for (const feature of chargerFeatures()) {
    if (pointDansGeometrie(point, feature.geometry)) {
      return { enQPV: true, nomQPV: (feature.properties?.lib_qp as string) || undefined };
    }
  }
  return { enQPV: false };
}

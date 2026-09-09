import { NextRequest, NextResponse } from "next/server";
import { verifierPointDansQPV } from "@/lib/qpv";

// Détection automatique QPV : géocode l'adresse tapée via l'API Adresse du
// gouvernement (api-adresse.data.gouv.fr, publique et sans clé), puis teste
// le point obtenu contre les périmètres QPV 2024 (data/qpv-2024.geojson).
// N'est qu'une aide au pré-remplissage du champ "Résidez-vous en QPV ?" :
// le résultat reste à confirmer/corriger par la personne qui remplit le
// formulaire (adresse mal géocodée, imprécision des données...).
export async function POST(request: NextRequest) {
  try {
    const { adresse, codePostal, ville } = await request.json();
    if (!adresse || typeof adresse !== "string") {
      return NextResponse.json({ erreur: "Adresse manquante." }, { status: 400 });
    }

    const q = [adresse, codePostal, ville].filter(Boolean).join(" ");
    const urlGeocodage = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`;
    const reponseGeocodage = await fetch(urlGeocodage);
    if (!reponseGeocodage.ok) {
      return NextResponse.json({ erreur: "Géocodage indisponible." }, { status: 502 });
    }
    const dataGeocodage = await reponseGeocodage.json();
    const feature = dataGeocodage?.features?.[0];
    if (!feature) {
      return NextResponse.json({ trouve: false });
    }

    const [lon, lat] = feature.geometry.coordinates;
    const resultat = verifierPointDansQPV(lon, lat);
    return NextResponse.json({
      trouve: true,
      enQPV: resultat.enQPV,
      nomQPV: resultat.nomQPV,
      adresseTrouvee: feature.properties?.label,
      score: feature.properties?.score,
    });
  } catch {
    return NextResponse.json({ erreur: "Erreur lors de la vérification QPV." }, { status: 500 });
  }
}

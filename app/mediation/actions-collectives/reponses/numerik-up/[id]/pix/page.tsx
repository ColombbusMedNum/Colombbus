"use client";

import PixResultatsSessionNkup from "@/components/PixResultatsSessionNkup";

export default function PixNumerikUpSessionPage() {
  return (
    <PixResultatsSessionNkup
      collectionInscriptions="inscriptions_numerikup"
      basePath="/mediation/actions-collectives/reponses/numerik-up"
      mapperVersSuiviRecrutement={(dernier, nbBadgesObtenus) => ({
        Pix_Badge: dernier.partage ? String(nbBadgesObtenus) : "",
        Pix_Etoile: dernier.palier !== null ? String(dernier.palier) : "",
        Completion_Pix: dernier.maitriseGlobale !== null ? `${Math.round(dernier.maitriseGlobale * 100)}%` : "",
      })}
    />
  );
}

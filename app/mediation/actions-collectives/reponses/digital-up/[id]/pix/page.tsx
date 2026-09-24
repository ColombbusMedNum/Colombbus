"use client";

import PixResultatsSessionNkup from "@/components/PixResultatsSessionNkup";

export default function PixDigitalUpSessionPage() {
  return (
    <PixResultatsSessionNkup
      collectionInscriptions="inscriptions_digitalup"
      basePath="/mediation/actions-collectives/reponses/digital-up"
      mapperVersSuiviRecrutement={(dernier, nbBadgesObtenus) => ({
        Pix_Badges_Etoiles: dernier.partage ? `${nbBadgesObtenus} badge${nbBadgesObtenus > 1 ? "s" : ""} / palier ${dernier.palier ?? "—"}` : "",
        Completion_Pix: dernier.maitriseGlobale !== null ? `${Math.round(dernier.maitriseGlobale * 100)}%` : "",
      })}
    />
  );
}

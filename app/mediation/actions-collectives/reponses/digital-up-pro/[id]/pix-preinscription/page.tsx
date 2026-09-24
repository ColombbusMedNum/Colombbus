"use client";

import PixResultatsSessionNkup from "@/components/PixResultatsSessionNkup";

// Diagnostic Pix fait en préinscription (parcours "PARKOUR NUMERIK'UP",
// palier + badges) — distinct du suivi Pix du parcours pro lui-même (voir
// .../[id]/pix/page.tsx, format pix/niveau par compétence avec évolution).
export default function PixPreinscriptionDigitalUpProSessionPage() {
  return (
    <PixResultatsSessionNkup
      collectionInscriptions="inscriptions_digitaluppro"
      basePath="/mediation/actions-collectives/reponses/digital-up-pro"
    />
  );
}

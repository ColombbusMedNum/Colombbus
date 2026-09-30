"use client";

import { useParams } from "next/navigation";
import PixResultatsSessionNkup from "@/components/PixResultatsSessionNkup";

// Diagnostic Pix fait en préinscription (parcours "PARKOUR NUMERIK'UP",
// palier + badges), pour une action dynamique — voir aussi .../[id]/pix
// (format pix/niveau par compétence), et la version historique à
// app/mediation/actions-collectives/reponses/digital-up-pro/[id]/pix-preinscription.
// Visible seulement si schema.pixPreinscriptionActif (voir [slug]/[id]/apprenants).
export default function PixPreinscriptionActionDynamiqueSessionPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <PixResultatsSessionNkup
      slug={slug}
      basePath={`/mediation/actions-collectives/reponses/${slug}`}
    />
  );
}

"use client";

import { useParams } from "next/navigation";
import PixResultatsSession from "@/components/PixResultatsSession";

// Suivi Pix du parcours (format pix/niveau par compétence, avec évolution
// dans le temps), pour une action dynamique — distinct de .../[id]/pix-preinscription
// (palier + badges). Visible seulement si schema.pixSessionActif (voir
// [slug]/[id]/apprenants).
export default function PixSessionActionDynamiqueSessionPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <PixResultatsSession
      slug={slug}
      basePath={`/mediation/actions-collectives/reponses/${slug}`}
    />
  );
}

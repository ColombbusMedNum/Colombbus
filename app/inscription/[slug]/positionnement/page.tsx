"use client";

import { useParams } from "next/navigation";
import FormulairePositionnement from "@/components/FormulairePositionnement";

// Formulaire PUBLIC du test de positionnement, pour une action dynamique —
// voir aussi app/inscription/prfe-positionnement (câblage historique). Le
// contenu (sections/questions) est entièrement piloté par Firestore, voir
// lib/positionnement.ts et l'éditeur .../reponses/[slug]/positionnement/editer.
export default function PositionnementActionDynamiquePage() {
  const { slug } = useParams<{ slug: string }>();
  return <FormulairePositionnement programmeId={slug} />;
}

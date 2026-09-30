"use client";

import { useParams } from "next/navigation";
import FicheDiagnosticGenerique from "@/components/FicheDiagnosticGenerique";
import type { Inscription } from "./page";

// Wrapper fin, pour une action dynamique — voir la version DIGITAL UP 96H
// pour le contexte complet. programmeId = slug de l'action.
export default function FicheEntretienDiagnostic({
  inscription, mettreAJourChamp, intituleAction,
}: {
  inscription: Inscription;
  mettreAJourChamp: (champ: keyof Inscription, valeur: any) => void;
  intituleAction: string;
}) {
  const { slug } = useParams<{ slug: string }>();
  return (
    <FicheDiagnosticGenerique
      programmeId={slug}
      inscription={inscription}
      mettreAJourChamp={(champ, valeur) => mettreAJourChamp(champ as keyof Inscription, valeur)}
      hrefEditeur={`/mediation/actions-collectives/reponses/${slug}/fiche-diagnostic/editer`}
      intituleAction={intituleAction}
    />
  );
}

"use client";

import FicheDiagnosticGenerique from "@/components/FicheDiagnosticGenerique";
import type { Inscription } from "./page";

// Wrapper fin — voir la version DIGITAL UP 96H pour le contexte complet.
export default function FicheEntretienDiagnostic({
  inscription, mettreAJourChamp,
}: {
  inscription: Inscription;
  mettreAJourChamp: (champ: keyof Inscription, valeur: any) => void;
}) {
  return (
    <FicheDiagnosticGenerique
      programmeId="numerik-up-pro"
      inscription={inscription}
      mettreAJourChamp={(champ, valeur) => mettreAJourChamp(champ as keyof Inscription, valeur)}
      hrefEditeur="/mediation/actions-collectives/reponses/numerik-up-pro/fiche-diagnostic/editer"
      intituleAction={inscription.Parcours || "Numérik'Pro"}
    />
  );
}

"use client";

import FicheDiagnosticGenerique from "@/components/FicheDiagnosticGenerique";
import type { Inscription } from "./page";

// Wrapper fin — le rendu et l'édition des questions vivent désormais dans le
// moteur générique (voir lib/ficheDiagnostic.ts et
// components/FicheDiagnosticGenerique.tsx), partagé avec NUMERIK PRO, PRFE
// et les actions dynamiques. Signature d'export inchangée pour que page.tsx
// n'ait rien à modifier.
export default function FicheEntretienDiagnostic({
  inscription, mettreAJourChamp,
}: {
  inscription: Inscription;
  mettreAJourChamp: (champ: keyof Inscription, valeur: any) => void;
}) {
  return (
    <FicheDiagnosticGenerique
      programmeId="digital-up-pro"
      inscription={inscription}
      mettreAJourChamp={(champ, valeur) => mettreAJourChamp(champ as keyof Inscription, valeur)}
      hrefEditeur="/mediation/actions-collectives/reponses/digital-up-pro/fiche-diagnostic/editer"
      intituleAction={inscription.Parcours || "Digital Up"}
    />
  );
}

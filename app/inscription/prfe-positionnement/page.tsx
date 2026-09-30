"use client";

import FormulairePositionnement from "@/components/FormulairePositionnement";

// Formulaire PUBLIC du test de positionnement PRFE (Français/Anglais/Maths) —
// contenu entièrement éditable depuis /mediation/actions-collectives/reponses/
// prfe/positionnement/editer (voir lib/positionnement.ts).
export default function PositionnementPrfePage() {
  return <FormulairePositionnement programmeId="prfe" piedDePage="Plateforme C.O.S.M.O.S. — Colombbus" />;
}

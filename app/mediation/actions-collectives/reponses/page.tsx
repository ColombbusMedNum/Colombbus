"use client";

import { CpuChipIcon, RocketLaunchIcon, BriefcaseIcon } from "@heroicons/react/24/outline";
import HubActionsCollectives from "../_components/HubActionsCollectives";

export default function ReponsesPage() {
  return (
    <HubActionsCollectives
      titre="Réponses au formulaire"
      sousTitre="Choisir le programme concerné"
      retourHref="/mediation/actions-collectives"
      retourLabel="Actions Collectives"
      tuiles={[
        {
          href: "/mediation/actions-collectives/reponses/numerik-up",
          icone: CpuChipIcon,
          titre: "Numérik'UP",
          sousTitre: "Inscriptions reçues au programme Numérik'UP",
        },
        {
          href: "/mediation/actions-collectives/reponses/digital-up",
          icone: RocketLaunchIcon,
          titre: "Digital'UP",
          sousTitre: "Inscriptions reçues au programme Digital'UP",
        },
        {
          href: "/mediation/actions-collectives/reponses/numerik-up-pro",
          icone: BriefcaseIcon,
          titre: "NUMERIK PRO",
          sousTitre: "Inscriptions reçues au programme NUMERIK PRO",
        },
      ]}
    />
  );
}

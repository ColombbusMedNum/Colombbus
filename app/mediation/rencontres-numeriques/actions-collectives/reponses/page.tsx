"use client";

import { CpuChipIcon, RocketLaunchIcon, BriefcaseIcon } from "@heroicons/react/24/outline";
import HubActionsCollectives from "../_components/HubActionsCollectives";

export default function ReponsesPage() {
  return (
    <HubActionsCollectives
      titre="Réponses au formulaire"
      sousTitre="Choisir le programme concerné"
      retourHref="/mediation/rencontres-numeriques/actions-collectives/accueil"
      retourLabel="Actions Collectives"
      tuiles={[
        {
          href: "/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up",
          icone: CpuChipIcon,
          titre: "Numérik'UP",
          sousTitre: "Inscriptions reçues au programme Numérik'UP",
        },
        {
          href: "/mediation/rencontres-numeriques/actions-collectives/reponses/digital-up",
          icone: RocketLaunchIcon,
          titre: "Digital'UP",
          sousTitre: "Inscriptions reçues au programme Digital'UP",
        },
        {
          href: "/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro",
          icone: BriefcaseIcon,
          titre: "Numérik'UP Pro",
          sousTitre: "Inscriptions reçues au programme Numérik'UP Pro",
        },
      ]}
    />
  );
}

"use client";

import { CpuChipIcon, RocketLaunchIcon, BriefcaseIcon } from "@heroicons/react/24/outline";
import HubActionsCollectives from "../_components/HubActionsCollectives";

export default function InscriptionPage() {
  return (
    <HubActionsCollectives
      titre="Formulaire d'inscription"
      sousTitre="Choisir le programme concerné"
      retourHref="/mediation/rencontres-numeriques/actions-collectives"
      retourLabel="Actions Collectives"
      tuiles={[
        {
          href: "/mediation/rencontres-numeriques/actions-collectives/inscription/digital-up",
          icone: RocketLaunchIcon,
          titre: "Formulaire Digital'UP",
          sousTitre: "Inscription au programme Digital'UP",
        },
        {
          href: "/mediation/rencontres-numeriques/actions-collectives/inscription/numerik-up",
          icone: CpuChipIcon,
          titre: "Formulaire Numérik'UP",
          sousTitre: "Inscription au programme Numérik'UP",
        },
        {
          href: "/mediation/rencontres-numeriques/actions-collectives/inscription/numerik-up-pro",
          icone: BriefcaseIcon,
          titre: "Formulaire Numérik'UP Pro",
          sousTitre: "Inscription au programme Numérik'UP Pro",
        },
      ]}
    />
  );
}

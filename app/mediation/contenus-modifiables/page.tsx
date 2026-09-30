"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, PencilSquareIcon, Cog6ToothIcon, PlusIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { listerActionsDynamiques } from "@/lib/dynamicActions/store";
import { ActionSchema } from "@/lib/dynamicActions/types";

interface LienEdition {
  label: string;
  href: string;
}

// Pages "Paramètres" des 5 programmes historiques — questionnaire, parcours,
// territoires, sessions, catégories d'évolution, suivi administratif selon
// le programme. Liste fixe (comme sur Liens publics), à jour à la main si
// un nouveau programme historique voit le jour.
const PARAMETRES_FIXES: LienEdition[] = [
  { label: "Digital'UP — Paramètres", href: "/mediation/actions-collectives/inscription/digital-up/parametres" },
  { label: "DIGITAL UP 96H — Paramètres", href: "/mediation/actions-collectives/inscription/digital-up-pro/parametres" },
  { label: "Numérik'UP — Paramètres", href: "/mediation/actions-collectives/inscription/numerik-up/parametres" },
  { label: "NUMERIK PRO — Paramètres", href: "/mediation/actions-collectives/inscription/numerik-up-pro/parametres" },
  { label: "PRFE — Paramètres", href: "/mediation/actions-collectives/inscription/prfe/parametres" },
];

const FICHE_DIAGNOSTIC_FIXES: LienEdition[] = [
  { label: "DIGITAL UP 96H — Fiche entretien diagnostic", href: "/mediation/actions-collectives/reponses/digital-up-pro/fiche-diagnostic/editer" },
  { label: "NUMERIK PRO — Fiche entretien diagnostic", href: "/mediation/actions-collectives/reponses/numerik-up-pro/fiche-diagnostic/editer" },
  { label: "PRFE — Fiche entretien diagnostic", href: "/mediation/actions-collectives/reponses/prfe/fiche-diagnostic/editer" },
];

const SATISFACTION_FIXES: LienEdition[] = [
  { label: "Digital'UP — Questionnaire de satisfaction", href: "/mediation/actions-collectives/reponses/digital-up/satisfaction/editer" },
  { label: "DIGITAL UP 96H — Questionnaire de satisfaction", href: "/mediation/actions-collectives/reponses/digital-up-pro/satisfaction/editer" },
  { label: "Numérik'UP — Questionnaire de satisfaction", href: "/mediation/actions-collectives/reponses/numerik-up/satisfaction/editer" },
  { label: "NUMERIK PRO — Questionnaire de satisfaction", href: "/mediation/actions-collectives/reponses/numerik-up-pro/satisfaction/editer" },
  { label: "PRFE — Questionnaire de satisfaction", href: "/mediation/actions-collectives/reponses/prfe/satisfaction/editer" },
];

const POSITIONNEMENT_FIXES: LienEdition[] = [
  { label: "PRFE — Test de positionnement", href: "/mediation/actions-collectives/reponses/prfe/positionnement/editer" },
];

// Autres réglages transversaux modifiables par l'admin, sans lien avec un
// programme précis.
const AUTRES_CONTENUS: LienEdition[] = [
  { label: "Bibliothèque Logos", href: "/mediation/bibliotheque-logos" },
  { label: "Modèles d'Activités (agenda)", href: "/mediation/modeles" },
  { label: "Gérer les Droits", href: "/mediation/analyse" },
  { label: "Paramètres Généraux", href: "/mediation/parametres" },
];

function Section({ titre, liens, actionLabel, actionHref }: { titre: string; liens: LienEdition[]; actionLabel?: string; actionHref?: string }) {
  if (liens.length === 0 && !actionHref) return null;
  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">{titre} ({liens.length})</h2>
        {actionHref && actionLabel && (
          <Link href={actionHref} className="flex items-center gap-1.5 bg-[#005259] hover:bg-[#005259]/90 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors shrink-0">
            <PlusIcon className="w-3.5 h-3.5" />
            <span>{actionLabel}</span>
          </Link>
        )}
      </div>
      <div className="space-y-2">
        {liens.map((lien) => (
          <Link key={lien.href} href={lien.href} className="flex items-center justify-between gap-3 bg-[#F3F3F2] hover:bg-[#005259]/10 rounded-xl px-3 py-2.5 transition-colors group">
            <span className="text-xs font-bold text-[#005259]">{lien.label}</span>
            <PencilSquareIcon className="w-4 h-4 text-[#404040]/30 group-hover:text-[#EA601F] transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ContenusModifiablesPage() {
  const { role, loading: loadingPermissions } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<ActionSchema[]>([]);

  useEffect(() => {
    const charger = async () => {
      const actionsListe = await listerActionsDynamiques();
      setActions(actionsListe.filter((a) => a.actif));
      setLoading(false);
    };
    charger();
  }, []);

  if (loadingPermissions || loading) {
    return <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>Chargement...</div>;
  }
  if (role !== "admin") {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-center p-8 antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#EF736A]">Page réservée à l'administrateur</p>
        <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
          <HomeIcon className="w-4 h-4 text-[#EA601F]" />
          <span>Accueil</span>
        </Link>
      </div>
    );
  }

  const liensParametresActions: LienEdition[] = actions.map((a) => ({ label: `${a.label} — Paramètres (questionnaire, parcours, sessions...)`, href: `/mediation/actions-collectives/inscription/${a.slug}/parametres` }));
  const liensFicheDiagnosticActions: LienEdition[] = actions.map((a) => ({ label: `${a.label} — Fiche entretien diagnostic`, href: `/mediation/actions-collectives/reponses/${a.slug}/fiche-diagnostic/editer` }));
  const liensPositionnementActions: LienEdition[] = actions.filter((a) => a.positionnementActif).map((a) => ({ label: `${a.label} — Test de positionnement`, href: `/mediation/actions-collectives/reponses/${a.slug}/positionnement/editer` }));
  const liensSatisfactionActions: LienEdition[] = actions.filter((a) => a.satisfactionActif).map((a) => ({ label: `${a.label} — Questionnaire de satisfaction`, href: `/mediation/actions-collectives/reponses/${a.slug}/satisfaction/editer` }));

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-4xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Contenus <span className="text-[#EA601F] font-semibold">modifiables</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Toutes les pages d'édition réservées à l'administrateur</p>
              </div>
            </div>
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>

          <p className="text-[11px] text-[#404040]/50 font-medium flex items-center gap-1.5">
            <Cog6ToothIcon className="w-3.5 h-3.5" />
            Les actions personnalisées et leurs modules optionnels activés apparaissent ici automatiquement.
          </p>

          <Section titre="Paramètres par programme" liens={[...PARAMETRES_FIXES, ...liensParametresActions]} />
          <Section titre="Fiche entretien diagnostic" liens={[...FICHE_DIAGNOSTIC_FIXES, ...liensFicheDiagnosticActions]} />
          <Section titre="Tests de positionnement" liens={[...POSITIONNEMENT_FIXES, ...liensPositionnementActions]} />
          <Section titre="Questionnaires de satisfaction" liens={[...SATISFACTION_FIXES, ...liensSatisfactionActions]} actionLabel="Créer" actionHref="/mediation/satisfaction/nouveau" />
          <Section titre="Autres réglages" liens={AUTRES_CONTENUS} />
        </div>
      </main>
    </PageGuard>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, PlusIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { listerActionsDynamiques } from "@/lib/dynamicActions/store";
import { ActionSchema } from "@/lib/dynamicActions/types";

interface ProgrammeChoix {
  label: string;
  href: string;
}

// Programmes historiques — liste fixe, à jour à la main si un nouveau
// programme historique voit le jour (voir Liens publics / Contenus modifiables).
const PROGRAMMES_FIXES: ProgrammeChoix[] = [
  { label: "Digital'UP", href: "/mediation/actions-collectives/reponses/digital-up/satisfaction/editer" },
  { label: "DIGITAL UP 96H", href: "/mediation/actions-collectives/reponses/digital-up-pro/satisfaction/editer" },
  { label: "Numérik'UP", href: "/mediation/actions-collectives/reponses/numerik-up/satisfaction/editer" },
  { label: "NUMERIK PRO", href: "/mediation/actions-collectives/reponses/numerik-up-pro/satisfaction/editer" },
  { label: "PRFE", href: "/mediation/actions-collectives/reponses/prfe/satisfaction/editer" },
];

export default function NouveauQuestionnaireSatisfactionPage() {
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

  const programmesActions: ProgrammeChoix[] = actions.map((a) => ({ label: a.label, href: `/mediation/actions-collectives/reponses/${a.slug}/satisfaction/editer` }));
  const programmes = [...PROGRAMMES_FIXES, ...programmesActions];

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-2xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Créer un <span className="text-[#EA601F] font-semibold">questionnaire de satisfaction</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Choisis le programme concerné</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <Link href="/mediation/contenus-modifiables" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Retour</span>
              </Link>
              <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-2">
            {programmes.map((p) => (
              <Link key={p.href} href={p.href} className="flex items-center justify-between gap-3 bg-[#F3F3F2] hover:bg-[#005259]/10 rounded-xl px-3 py-2.5 transition-colors group">
                <span className="text-xs font-bold text-[#005259]">{p.label}</span>
                <PlusIcon className="w-4 h-4 text-[#404040]/30 group-hover:text-[#EA601F] transition-colors shrink-0" />
              </Link>
            ))}
          </div>

          <p className="text-[11px] text-[#404040]/50 font-medium">
            Si le programme n'a pas encore de questionnaire, l'éditeur t'invitera à en créer un depuis un modèle vide. Pour les actions personnalisées, pense à cocher « Questionnaire de satisfaction » dans les modules optionnels de la page Paramètres pour le rendre visible publiquement.
          </p>
        </div>
      </main>
    </PageGuard>
  );
}

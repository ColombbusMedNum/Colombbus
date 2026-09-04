"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { UserIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import PageGuard from "@/components/PageGuard";
import MediateurAnalyticsPanel from "@/components/MediateurAnalyticsPanel";
import MediateurActionsParMois from "@/components/MediateurActionsParMois";
import { useAnalyticsSummary } from "@/lib/useAnalyticsSummary";
import { useMediateurs } from "@/lib/MediateursProvider";
import { estActionDuMediateur } from "@/lib/matchMediateur";

export default function StatsMediateursAnalytique() {
  const [actions, setActions] = useState<any[]>([]);
  const { mediateurs: mediateursBruts } = useMediateurs();
  const [selectedMedId, setSelectedMedId] = useState<string>("");

  const mediateurs = React.useMemo(() => {
    return [...mediateursBruts].sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
  }, [mediateursBruts]);

  useEffect(() => {
    const unsubActions = onSnapshot(collection(db, "planning_mediateurs"), (snap) => {
      setActions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubActions();
  }, []);

  useEffect(() => {
    if (mediateurs.length > 0 && !selectedMedId) {
      setSelectedMedId(mediateurs[0].id);
    }
  }, [mediateurs, selectedMedId]);

  const currentMediateur = mediateurs.find(m => m.id === selectedMedId);

  // 1. Filtrer les actions du médiateur sélectionné
  const currentMedActions = actions.filter(a => {
    if (!currentMediateur) return false;
    return estActionDuMediateur(a, currentMediateur);
  });

  // 2. Grouper et cumuler intelligemment par code analytique
  const { analyticsSummary, totalHeuresGlobal, totalHeuresComplementaires } = useAnalyticsSummary(currentMedActions, mediateurs);

  return (
    <PageGuard pageId="page_access_mediateurs">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10 space-y-6">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-[#005259]">
                Synthèse analytique <span className="text-[#EA601F] font-semibold">par médiateur</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Répartition des heures travaillées par code analytique</p>
            </div>
          </div>
          <Link href="/agenda" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
            <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
            <span>Retour à l'Agenda</span>
          </Link>
        </div>

        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#005259]/10 rounded-lg text-[#005259] border border-[#005259]/20">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#005259]">Sélection du profil</h2>
              <p className="text-xs text-[#404040]/60">Choisissez un médiateur pour analyser la répartition de ses heures</p>
            </div>
          </div>

          <div className="w-full sm:w-72">
            <select
              value={selectedMedId}
              onChange={(e) => setSelectedMedId(e.target.value)}
              className="w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl text-sm text-[#404040] font-medium outline-none focus:border-[#EA601F] focus:ring-1 focus:ring-[#EA601F] transition-all cursor-pointer"
            >
              <option value="" disabled>-- Sélectionner un médiateur --</option>
              {mediateurs.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.prenom} {m.nom?.toUpperCase()} ({m.statut || "Permanent"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {currentMediateur ? (
          <>
            <MediateurAnalyticsPanel
              currentMediateur={currentMediateur}
              analyticsSummary={analyticsSummary}
              totalHeuresGlobal={totalHeuresGlobal}
              totalHeuresComplementaires={totalHeuresComplementaires}
              emptyMessage="Aucune mission ou activité planifiée trouvée pour ce médiateur."
            />
            <MediateurActionsParMois
              actions={currentMedActions}
              emptyMessage="Aucune action enregistrée sur l'agenda."
            />
          </>
        ) : (
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-12 text-center text-xs text-[#404040]/50 font-medium shadow-sm">
            Veuillez ajouter ou sélectionner un médiateur pour consulter ses statistiques analytiques.
          </div>
        )}
      </div>
    </main>
    </PageGuard>
  );
}

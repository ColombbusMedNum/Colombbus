"use client";

import { ChartBarIcon, ClockIcon } from "@heroicons/react/24/outline";
import type { AnalyticsSummaryItem } from "@/lib/useAnalyticsSummary";

interface MediateurAnalyticsPanelProps {
  currentMediateur: any;
  analyticsSummary: AnalyticsSummaryItem[];
  totalHeuresGlobal: number;
  emptyMessage: string;
}

// Bloc "Fiche Médiateur" + "Total d'heures par code analytique", partagé
// entre app/mediation/mediateurs et app/mediation/statistiques (deux pages
// d'analyse d'heures quasi-identiques qui avaient chacune leur propre copie,
// avec un style ayant légèrement divergé au fil du temps).
export default function MediateurAnalyticsPanel({
  currentMediateur,
  analyticsSummary,
  totalHeuresGlobal,
  emptyMessage,
}: MediateurAnalyticsPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

      {/* FICHE INDIVIDUELLE */}
      <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 space-y-4 self-start shadow-sm">
        <div>
          <h3 className="text-[10px] font-bold text-[#404040]/60 uppercase tracking-widest mb-2">Fiche Médiateur</h3>
          <div className="text-lg font-bold uppercase tracking-tight text-[#005259]">{currentMediateur.prenom} {currentMediateur.nom?.toUpperCase()}</div>
          <div className="text-xs text-[#EA601F] font-mono font-bold mt-0.5">{currentMediateur.poste || "Médiateur Social"}</div>
        </div>

        <div className="pt-3 border-t border-[#404040]/10 grid grid-cols-2 gap-2">
          <div>
            <span className="block text-[10px] text-[#404040]/60 uppercase font-bold tracking-wider">Statut</span>
            <span className="text-xs font-bold text-[#404040]">{currentMediateur.statut || "Permanent"}</span>
          </div>
          {currentMediateur.sitePrincipal && (
            <div>
              <span className="block text-[10px] text-[#404040]/60 uppercase font-bold tracking-wider">Site Principal</span>
              <span className="text-xs font-bold text-[#404040]">{currentMediateur.sitePrincipal}</span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-[#404040]/10 bg-[#F3F3F2] -mx-5 -mb-5 p-5 rounded-b-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-[#EA601F]" />
            <span className="text-xs text-[#005259] font-bold uppercase tracking-wider">Volume total :</span>
          </div>
          <div className="text-xl font-black text-[#005259] font-mono">
            {totalHeuresGlobal.toFixed(1)}h
          </div>
        </div>
      </div>

      {/* GRAPHIQUE ANALYTIQUE */}
      <div className="md:col-span-2 bg-white border border-[#404040]/10 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-[#404040]/10">
          <ChartBarIcon className="w-4 h-4 text-[#005259]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#005259]">Total d'heures par code analytique</h3>
        </div>

        {analyticsSummary.length === 0 ? (
          <div className="text-center py-12 text-xs text-[#404040]/60 font-bold uppercase tracking-wider">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {analyticsSummary.map((item) => {
              const pourcentage = totalHeuresGlobal > 0 ? (item.totalHeures / totalHeuresGlobal) * 100 : 0;
              const isSansCode = item.code === "SANS_CODE";

              return (
                <div key={item.code} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 border ${
                        isSansCode
                          ? "bg-[#F3F3F2] text-[#404040]/60 border-[#404040]/20"
                          : "bg-[#005259]/10 text-[#005259] border-[#005259]/20"
                      }`}>
                        {isSansCode ? "N/A" : item.code}
                      </span>
                      <span className="text-[#404040] truncate font-semibold">
                        {item.label}
                      </span>
                    </div>

                    <div className="text-right shrink-0 font-mono font-bold text-[#005259] pl-2">
                      {item.totalHeures.toFixed(1)}h
                      <span className="text-[10px] text-[#404040]/60 font-normal ml-1">
                        ({pourcentage.toFixed(0)}%)
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-[#F3F3F2] rounded-full h-2.5 overflow-hidden border border-[#404040]/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSansCode
                          ? "bg-[#404040]/30"
                          : "bg-gradient-to-r from-[#EA601F] to-[#EF736A]"
                      }`}
                      style={{ width: `${pourcentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

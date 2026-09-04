"use client";

import React, { useState } from "react";
import { quicksand } from "@/lib/fonts";
import {
  ArrowLeftIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  XMarkIcon,
  MapPinIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import PageGuard from "@/components/PageGuard";
import { useMediateurs } from "@/lib/MediateursProvider";
import { getTerritoryColor } from "@/lib/territoryColor";

export default function SuiviCompetences() {
  // Depuis la migration vers la collection configuration_equipe, liste_mediateurs
  // ne contient plus que des fiches de médiateurs : plus besoin de filtrer
  // les anciens documents de configuration au passage.
  const { mediateurs } = useMediateurs();
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);

  // Extraire dynamiquement la liste de tous les territoires des médiateurs actifs
  const listeTerritoires = Array.from(
    new Set(
      mediateurs
        .filter(m => m.actif !== false)
        .flatMap(m => m.sites || [])
    )
  ).sort() as string[];

  // Filtrer les médiateurs actifs par rapport au tag de compétences ET au territoire sélectionné
  const filteredData = mediateurs.filter(m => {
    if (m.actif === false) return false; // On ne garde que l'équipe active
    
    // 1. Filtrage par Territoire (si un territoire est sélectionné)
    if (selectedTerritory) {
      const mSites = m.sites || [];
      if (!mSites.includes(selectedTerritory)) return false;
    }

    // 2. Filtrage par Compétence / Qualité
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase().trim();
    const listComp = m.competences || [];
    
    return listComp.some((c: string) => c.toLowerCase().includes(query));
  });

  return (
    <PageGuard pageId="page_access_competences">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10 space-y-6">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <Link
              href="/mediation/equipe"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Retour à l'équipe</span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold uppercase text-[#005259] tracking-tight flex items-center gap-2">
                  Répertoire des Compétences et Territoires
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5">
                  Cartographie des compétences et savoir-faire des médiateurs
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ZONE FILTRES DE RECHERCHE */}
        <div className="space-y-4">
          {/* Recherche textuelle par qualité */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-3.5 w-5 h-5 text-[#005259]" />
            <input 
              type="text" 
              placeholder="Filtrer par qualité / outil (ex: Excel, Word, Animation)..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full pl-12 pr-12 py-3 bg-white border border-[#404040]/15 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] text-[#404040] placeholder-[#404040]/40 rounded-2xl text-xs font-medium outline-none transition-all shadow-sm"
            />
            {searchFilter && (
              <button 
                onClick={() => setSearchFilter("")}
                className="absolute right-4 top-3 p-1 bg-[#F3F3F2] hover:bg-[#EF736A] hover:text-white border border-[#404040]/10 text-[#404040]/70 rounded-lg transition-all cursor-pointer"
                title="Effacer le filtre"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtrage par Territoire / Site */}
          {listeTerritoires.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#005259] flex items-center gap-1 mr-1">
                <MapPinIcon className="w-3.5 h-3.5 text-[#EA601F]" /> Territoire :
              </span>
              <button
                onClick={() => setSelectedTerritory(null)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  selectedTerritory === null
                    ? "bg-[#005259] text-white shadow-sm"
                    : "bg-white border border-[#404040]/10 text-[#404040]/70 hover:text-[#005259] hover:bg-[#F3F3F2]"
                }`}
              >
                Tous
              </button>
              {listeTerritoires.map((territory) => (
                <button
                  key={territory}
                  onClick={() => setSelectedTerritory(territory)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    selectedTerritory === territory
                      ? "bg-[#005259] text-white shadow-sm"
                      : "bg-white border border-[#404040]/10 text-[#404040]/70 hover:text-[#005259] hover:bg-[#F3F3F2]"
                  }`}
                >
                  {territory}
                </button>
              ))}
            </div>
          )}

          {(searchFilter || selectedTerritory) && (
            <p className="text-[11px] text-[#404040]/70 font-medium">
              Filtres actifs :{" "}
              {searchFilter && (
                <span>
                  Qualité <span className="text-[#EA601F] font-bold">"{searchFilter}"</span>
                </span>
              )}
              {searchFilter && selectedTerritory && " + "}
              {selectedTerritory && (
                <span>
                  Territoire <span className="text-[#005259] font-bold">"{selectedTerritory}"</span>
                </span>
              )}
              {" — "}{filteredData.length} collaborateur(s) trouvé(s)
            </p>
          )}
        </div>

        {/* BLOC PRINCIPAL LISTING */}
        <div className="space-y-3">
          {filteredData.length === 0 ? (
            <div className="text-center py-16 border border-[#404040]/10 rounded-2xl bg-white shadow-sm">
              <UserGroupIcon className="w-8 h-8 text-[#005259]/40 mx-auto mb-2" />
              <p className="text-[#404040]/60 text-xs font-bold uppercase tracking-wider">
                Aucun médiateur ne correspond à ces critères de recherche.
              </p>
            </div>
          ) : (
            filteredData.map((m) => {
              const comps = m.competences || [];
              const localSites = m.sites || [];
              return (
                <div 
                  key={m.id} 
                  className="p-4 bg-white border border-[#404040]/10 hover:border-[#005259]/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm hover:shadow-md"
                >
                  {/* Identité */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#005259]/10 border border-[#005259]/20 flex items-center justify-center text-[#005259] font-bold text-xs shrink-0">
                      {m.trigramme || `${m.prenom?.[0] || ""}${m.nom?.[0] || ""}`}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#005259]">
                        {m.prenom} <span className="uppercase text-[#404040] font-bold">{m.nom}</span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[11px] text-[#404040]/70 font-medium">{m.poste}</span>
                        {localSites.length > 0 && (
                          <>
                            <span className="text-[#404040]/30 text-xs">•</span>
                            <div className="flex flex-wrap gap-1">
                              {localSites.map((s: string) => (
                                <span key={s} className={`px-1.5 py-0.5 border text-[10px] font-bold rounded ${getTerritoryColor(s)}`}>
                                  {s}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tags de compétences */}
                  <div className="flex flex-wrap gap-1.5 sm:max-w-[60%] justify-start sm:justify-end">
                    {comps.length === 0 ? (
                      <span className="text-[11px] italic text-[#404040]/40">Aucune qualité renseignée</span>
                    ) : (
                      comps.map((c: string, i: number) => {
                        const matchRecherche = searchFilter.trim() && c.toLowerCase().includes(searchFilter.toLowerCase().trim());
                        return (
                          <button 
                            key={i} 
                            onClick={() => setSearchFilter(c)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                              matchRecherche 
                              ? "bg-[#EA601F] border-[#EA601F] text-white shadow-sm" 
                              : "bg-[#005259]/10 border-[#005259]/20 text-[#005259] hover:bg-[#005259] hover:text-white"
                            }`}
                            title={`Filtrer par ${c}`}
                          >
                            {c}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </main>
    </PageGuard>
  );
}
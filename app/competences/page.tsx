"use client";

import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { 
  ChevronLeftIcon, 
  AcademicCapIcon, 
  MagnifyingGlassIcon,
  UserGroupIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";

export default function SuiviCompetences() {
  const [mediateurs, setMediateurs] = useState<any[]>([]);
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "liste_mediateurs"), (snapshot) => {
      const data = snapshot.docs
        .filter(doc => doc.id !== "parametres_configuration" && doc.id !== "parametres_horaires")
        .map(doc => ({ id: doc.id, ...doc.data() }));
      setMediateurs(data);
    });
    return () => unsub();
  }, []);

  // Filtrer les médiateurs actifs par rapport au tag de compétences recherché
  const filteredData = mediateurs.filter(m => {
    if (m.actif === false) return false; // On ne garde que l'équipe active
    
    // Si pas de recherche, on affiche tout le monde
    if (!searchFilter.trim()) return true;

    const query = searchFilter.toLowerCase().trim();
    const listComp = m.competences || [];
    
    // On vérifie si l'une des compétences contient le mot cherché
    return listComp.some((c: string) => c.toLowerCase().includes(query));
  });

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      
      {/* HEADER */}
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-slate-900 pb-6">
        <div className="flex items-center gap-3">
          <Link 
            href="/equipe" // Remplacez par le chemin exact si ce n'est pas /gestion_equipe
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer flex items-center justify-center"
            title="Retour à l'équipe"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
              <AcademicCapIcon className="w-6 h-6 text-blue-400" />
              Répertoire des Qualités
            </h1>
            <p className="text-xs text-slate-500 font-medium">Cartographie des compétences et savoir-faire des médiateurs</p>
          </div>
        </div>
      </div>

      {/* ZONE FILTRE DE RECHERCHE */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
          <input 
            type="text" 
            placeholder="Filtrer par qualité / outil (ex: Excel, Word, Animation)..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="w-full pl-12 pr-12 py-3.5 bg-slate-950 border-2 border-slate-800 focus:border-blue-600 text-white rounded-2xl text-sm font-medium outline-none transition-all placeholder:text-slate-600"
          />
          {/* Bouton pour vider la recherche si elle est active */}
          {searchFilter && (
            <button 
              onClick={() => setSearchFilter("")}
              className="absolute right-4 top-3.5 p-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
              title="Effacer le filtre"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchFilter && (
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Résultats pour la recherche : <span className="text-blue-400 font-bold">"{searchFilter}"</span> — {filteredData.length} collaborateur(s) trouvé(s)
          </p>
        )}
      </div>

      {/* BLOC PRINCIPAL LISTING */}
      <div className="max-w-4xl mx-auto space-y-3">
        {filteredData.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-900 rounded-2xl bg-slate-950/20">
            <UserGroupIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-sm font-medium">Aucun médiateur ne possède cette qualité pour le moment.</p>
          </div>
        ) : (
          filteredData.map((m) => {
            const comps = m.competences || [];
            return (
              <div 
                key={m.id} 
                className="p-4 bg-slate-950/60 border border-slate-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-slate-950"
              >
                {/* Identité */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 font-black text-xs shrink-0">
                    {m.trigramme || `${m.prenom?.[0] || ""}${m.nom?.[0] || ""}`}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      {m.prenom} <span className="uppercase text-slate-400 font-extrabold">{m.nom}</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">{m.poste} • {m.sites?.join(', ') || 'Aucun site'}</p>
                  </div>
                </div>

                {/* Tags de compétences modifiés en boutons cliquables */}
                <div className="flex flex-wrap gap-1.5 sm:max-w-[60%] justify-start sm:justify-end">
                  {comps.length === 0 ? (
                    <span className="text-[11px] italic text-slate-600">Aucune qualité renseignée</span>
                  ) : (
                    comps.map((c: string, i: number) => {
                      // Mettre en valeur la compétence si elle correspond au filtre tapé
                      const matchRecherche = searchFilter.trim() && c.toLowerCase().includes(searchFilter.toLowerCase().trim());
                      return (
                        <button 
                          key={i} 
                          onClick={() => setSearchFilter(c)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                            matchRecherche 
                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                            : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-blue-500/50 hover:text-blue-400"
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
  );
}
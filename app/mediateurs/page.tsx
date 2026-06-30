"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { UserIcon, ChartBarIcon, ClockIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function StatsMediateursAnalytique() {
  const [actions, setActions] = useState<any[]>([]);
  const [mediateurs, setMediateurs] = useState<any[]>([]);
  const [selectedMedId, setSelectedMedId] = useState<string>("");

  useEffect(() => {
    const unsubActions = onSnapshot(collection(db, "planning_mediateurs"), (snap) => {
      setActions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubMed = onSnapshot(collection(db, "liste_mediateurs"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorted = data.sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
      setMediateurs(sorted);
      
      if (sorted.length > 0 && !selectedMedId) {
        setSelectedMedId(sorted[0].id);
      }
    });

    return () => { unsubActions(); unsubMed(); };
  }, [selectedMedId]);

  const currentMediateur = mediateurs.find(m => m.id === selectedMedId);

  // 1. Filtrer les actions du médiateur sélectionné
  const currentMedActions = actions.filter(a => {
    if (!currentMediateur) return false;
    const nomComplet = `${currentMediateur.prenom || ""} ${currentMediateur.nom || ""}`.trim();
    return a.mediateurId === selectedMedId || a.mediateurNom === nomComplet || a.mediateur === nomComplet;
  });

  // Fonction de calcul ajustée pour déduire l'heure de repas (13h-14h)
  const calculerDureeHeures = (debut: string, fin: string) => {
    if (!debut || !fin) return 3.5; 
    const [hDeb, mDeb] = debut.split(":").map(Number);
    const [hFin, mFin] = fin.split(":").map(Number);
    
    if (isNaN(hDeb) || isNaN(hFin)) return 3.5;
    
    const minutesDebut = hDeb * 60 + mDeb;
    const minutesFin = hFin * 60 + mFin;
    
    let totalMinutes = minutesFin - minutesDebut;
    if (totalMinutes <= 0) return 3.5;

    // Repères en minutes pour la pause repas (13h00 = 780 min | 14h00 = 840 min)
    const pauseDebut = 13 * 60;
    const pauseFin = 14 * 60;

    // Si le créneau englobe la totalité de la pause de 13h à 14h, on retire 60 minutes
    if (minutesDebut <= pauseDebut && minutesFin >= pauseFin) {
      totalMinutes -= 60;
    }

    return totalMinutes / 60;
  };

  // 2. Grouper et cumuler intelligemment par code analytique
  const analyticsSummary = React.useMemo(() => {
    const summary: { [code: string]: { code: string; label: string; totalHeures: number; count: number } } = {};
    const dejaCompte = new Set<string>();

    currentMedActions.forEach(action => {
      const code = (action.codeAnalytique || "").trim() || "SANS_CODE";
      const label = action.codeAnalytique ? `Code ${action.codeAnalytique}` : "Sans code analytique / Non spécifié";
      
      const dateStr = action.date; 
      const debut = action.debut || "";
      const fin = action.fin || "";
      const moment = action.moment || ""; // Récupération du moment (Matin/Après-midi)
      
      // CORRECTION : On rajoute le 'moment' dans la clé ou l'ID unique de l'action pour ne pas écraser
      const cleUniqueJournee = `${dateStr}_${moment}_${code}_${debut}_${fin}`;

      if (!summary[code]) {
        summary[code] = { code, label, totalHeures: 0, count: 0 };
      }

      if (dejaCompte.has(cleUniqueJournee)) {
        summary[code].count += 1;
      } else {
        const heures = calculerDureeHeures(debut, fin);
        summary[code].totalHeures += heures;
        summary[code].count += 1;
        
        if (debut && fin) {
          dejaCompte.add(cleUniqueJournee);
        }
      }
    });

    // Arrondis propres pour éviter les résidus de virgule flottante JavaScript (ex: 14.000000002h)
    return Object.values(summary)
      .map(item => ({
        ...item,
        totalHeures: Math.round(item.totalHeures * 10) / 10
      }))
      .sort((a, b) => b.totalHeures - a.totalHeures);
  }, [currentMedActions]);

  const totalHeuresGlobal = analyticsSummary.reduce((acc, curr) => acc + curr.totalHeures, 0);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 pt-[75px]">
      
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-5 py-3 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg tracking-tight text-white hover:opacity-80 transition-opacity font-bold">
            Accueil
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 font-medium">Synthèse analytique par médiateur</span>
        </div>
        <Link href="/activites_types" className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-md text-xs font-medium transition-colors">
          Retour à l'Agenda
        </Link>
      </header>

      <div className="max-w-4xl mx-auto space-y-6 mt-4">
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 rounded-lg text-blue-500 border border-blue-500/20">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Sélection du profil</h2>
              <p className="text-xs text-slate-500">Choisissez un médiateur pour analyser la répartition de ses heures</p>
            </div>
          </div>
          
          <div className="w-full sm:w-72">
            <select
              value={selectedMedId}
              onChange={(e) => setSelectedMedId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-medium outline-none focus:border-slate-700 transition-colors cursor-pointer"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 self-start">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fiche Médiateur</h3>
                <div className="text-lg font-bold text-white">{currentMediateur.prenom} {currentMediateur.nom?.toUpperCase()}</div>
                <div className="text-xs text-blue-400 font-mono font-medium mt-0.5">{currentMediateur.poste || "Médiateur Social"}</div>
              </div>

              <div className="pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-mono">Statut</span>
                  <span className="text-xs font-semibold text-slate-300">{currentMediateur.statut || "Permanent"}</span>
                </div>
                {currentMediateur.sitePrincipal && (
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-mono">Site Principal</span>
                    <span className="text-xs font-semibold text-slate-300">{currentMediateur.sitePrincipal}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800/60 bg-slate-950/40 -mx-5 -mb-5 p-5 rounded-b-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-slate-400 font-medium">Volume total :</span>
                </div>
                <div className="text-lg font-black text-emerald-400 font-mono">
                  {totalHeuresGlobal.toFixed(1)}h
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
                <ChartBarIcon className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-200">Total d'heures par code analytique</h3>
              </div>

              {analyticsSummary.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500 font-medium">
                  Aucune mission ou activité planifiée trouvée pour ce médiateur.
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                              isSansCode 
                                ? "bg-slate-950 text-slate-500 border border-slate-800" 
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}>
                              {isSansCode ? "N/A" : item.code}
                            </span>
                            <span className="text-slate-300 truncate font-medium" title={item.label}>
                              {item.label}
                            </span>
                          </div>
                          
                          <div className="text-right shrink-0 font-mono font-bold text-slate-200 pl-2">
                            {item.totalHeures.toFixed(1)}h 
                            <span className="text-[10px] text-slate-500 font-normal ml-1">
                              ({pourcentage.toFixed(0)}%)
                            </span>
                          </div>
                        </div>

                        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800/40">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isSansCode ? "bg-slate-700" : "bg-gradient-to-r from-blue-600 to-indigo-500"
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
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-500 font-medium">
            Veuillez ajouter ou sélectionner un médiateur pour consulter ses statistiques analytiques.
          </div>
        )}
      </div>
    </main>
  );
}
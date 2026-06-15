"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { MapPinIcon, ArrowLeftIcon, ClockIcon, CalendarDaysIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function ListeAdresses() {
  const [lieuxSemaine, setLieuxSemaine] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Calculer le lundi (début) et le dimanche (fin) de la semaine en cours
    const aujourdhui = new Date();
    
    // Trouver le lundi de la semaine actuelle
    const jourCourant = aujourdhui.getDay();
    const differenceLundi = jourCourant === 0 ? -6 : 1 - jourCourant;
    const lundi = new Date(aujourdhui);
    lundi.setDate(aujourdhui.getDate() + differenceLundi);
    lundi.setHours(0, 0, 0, 0);

    // Trouver le dimanche de la semaine actuelle
    const dimanche = new Date(lundi);
    dimanche.setDate(lundi.getDate() + 6);
    dimanche.setHours(23, 59, 59, 999);

    // Formater au format standard YYYY-MM-DD utilisé dans 'planning_mediateurs'
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const dateDebutStr = formatDate(lundi);
    const dateFinStr = formatDate(dimanche);

    // 2. Écouter les actions planifiées chez les médiateurs pour cette semaine
    const qActions = query(
      collection(db, "planning_mediateurs"),
      where("date", ">=", dateDebutStr),
      where("date", "<=", dateFinStr)
    );

    const unsubActions = onSnapshot(qActions, (snapActions) => {
      // Extraire tous les noms de lieux uniques affectés aux médiateurs cette semaine
      const listeLieuxPlanifies = snapActions.docs.map(d => d.data().lieu).filter(Boolean);
      const lieuxUniques = Array.from(new Set(listeLieuxPlanifies));

      if (lieuxUniques.length === 0) {
        setLieuxSemaine([]);
        setLoading(false);
        return;
      }

      // 3. Écouter le référentiel des adresses (activites_types)
      const unsubAdresses = onSnapshot(collection(db, "activites_types"), (snapActs) => {
        const toutesLesAdresses = snapActs.docs.map(d => ({ id: d.id, ...d.data() as any }));
        
        // Filtrer pour ne garder que les modèles dont le lieu est actif dans le planning de la semaine
        const adressesFiltrees = toutesLesAdresses.filter(act => 
          lieuxUniques.some(lieuPlanifie => lieuPlanifie.toLowerCase().trim() === act.lieu?.toLowerCase().trim())
        );

        // Trier par ordre alphabétique
        adressesFiltrees.sort((a, b) => a.lieu.localeCompare(b.lieu));

        setLieuxSemaine(adressesFiltrees);
        setLoading(false);
      });

      return () => unsubAdresses();
    });

    return () => unsubActions();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-3xl mx-auto">
        
        {/* EN-TÊTE AVEC RETOUR VERS LE PLANNING EXPERT */}
        <div className="flex items-center gap-4 mb-10">
          <Link 
            href="/activites_types" 
            className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white rounded-xl text-slate-400 transition-all active:scale-95 shadow-md"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tight">
                Lieux de la <span className="text-emerald-400 not-italic font-light">semaine</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                <CalendarDaysIcon className="w-3.5 h-3.5 text-slate-500" />
                Adresses des activités planifiées sur le planning général cette semaine
              </p>
            </div>
          </div>
        </div>

        {/* LISTE DES LIEUX FILTRÉS */}
        {loading ? (
          <div className="text-center py-16 text-emerald-500 font-mono text-xs animate-pulse">
            Chargement des adresses de la semaine...
          </div>
        ) : (
          <div className="grid gap-4">
            {lieuxSemaine.map((act) => {
              const hexColor = act.couleur || "#10b981";
              const aUneAdresseValide = act.adresse && act.adresse !== "-";
              
              const googleMapsUrl = aUneAdresseValide
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${act.lieu} ${act.adresse}`)}`
                : null;

              return (
                <div 
                  key={act.id} 
                  className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-start gap-4 shadow-xl hover:border-slate-700/80 transition-colors group"
                >
                  {/* ICON ÉPINGLE UNIQUE OU CLIQUABLE GOOGLE MAPS */}
                  {googleMapsUrl ? (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: hexColor }}
                      title="Ouvrir dans Google Maps"
                      className="p-2.5 bg-slate-950 border border-slate-800/80 hover:border-white/20 rounded-xl shrink-0 transition-all active:scale-90 relative group/icon shadow-inner cursor-pointer"
                    >
                      <MapPinIcon className="w-6 h-6 shrink-0 group-hover/icon:scale-105 transition-transform" />
                      {/* Petit badge d'indication au survol de l'icône */}
                      <span className="absolute -top-1 -right-1 bg-slate-900 border border-slate-700 text-white p-0.5 rounded-md opacity-0 group-hover/icon:opacity-100 transition-opacity scale-75">
                        <ArrowTopRightOnSquareIcon className="w-2.5 h-2.5" />
                      </span>
                    </a>
                  ) : (
                    <div 
                      style={{ color: hexColor }}
                      className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl shrink-0 opacity-50"
                    >
                      <MapPinIcon className="w-6 h-6 shrink-0" />
                    </div>
                  )}
                  
                  {/* TEXTES ET INFOS */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3 className="font-black text-base text-white uppercase italic tracking-tight group-hover:text-emerald-400 transition-colors truncate">
                        {act.lieu}
                        {act.territoire && (
                          <span className="ml-2 not-italic text-[10px] lowercase font-mono bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                            dept {act.territoire}
                          </span>
                        )}
                      </h3>
                      
                      {act.debut && (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg uppercase tracking-wider self-start sm:self-center">
                          <ClockIcon className="w-4 h-4 text-emerald-500 shrink-0" /> 
                          <span>{act.debut} — {act.fin}</span>
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-400 font-medium mt-1.5 leading-relaxed selection:bg-emerald-500/20">
                      {aUneAdresseValide ? act.adresse : "Aucune adresse postale enregistrée pour ce modèle"}
                    </p>
                  </div>

                </div>
              );
            })}

            {/* CAS VIDE : AUCUN LIEU CETTE SEMAINE */}
            {lieuxSemaine.length === 0 && (
              <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl text-xs font-bold uppercase tracking-widest text-slate-600">
                🔍 Aucun lieu d'activité n'est assigné dans le planning pour la semaine en cours.
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
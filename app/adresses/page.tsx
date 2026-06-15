"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { MapPinIcon, ArrowLeftIcon, ClockIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function ListeAdresses() {
  const [activitesTypes, setActivitesTypes] = useState<any[]>([]);

  useEffect(() => {
    const unsubActs = onSnapshot(query(collection(db, "activites_types"), orderBy("lieu", "asc")), (snap) => {
      setActivitesTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubActs();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-3xl mx-auto">
        
        {/* EN-TÊTE AVEC RETOUR MODIFIÉ VERS ACTIVITES_TYPES 🔗 */}
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
                Répertoire <span className="text-emerald-400 not-italic font-light">des adresses</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                Lieux fixes configurés pour vos activités types
              </p>
            </div>
          </div>
        </div>

        {/* LISTE DES LIEUX STYLE SURESNES */}
        <div className="grid gap-4">
          {activitesTypes.map((act) => (
            <div 
              key={act.id} 
              className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-start gap-4 shadow-xl hover:border-slate-700/80 transition-colors group"
            >
              {/* ICON MAP-PIN AVEC LISERÉ EMERAUDE AU SURVOL */}
              <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl text-emerald-400 shrink-0 group-hover:border-emerald-500/40 group-hover:shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all">
                <MapPinIcon className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-black text-base text-white uppercase italic tracking-tight group-hover:text-emerald-400 transition-colors truncate">
                    {act.lieu}
                  </h3>
                  
                  {act.debut && (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg uppercase tracking-wider self-start sm:self-center">
                      <ClockIcon className="w-3.5 h-3.5 text-emerald-500" /> 
                      <span>{act.debut} — {act.fin}</span>
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-slate-400 font-medium mt-1.5 selection:bg-emerald-500/20 leading-relaxed">
                  {act.adresse && act.adresse !== "-" ? act.adresse : "Aucune adresse postale enregistrée"}
                </p>
              </div>
            </div>
          ))}

          {/* CAS VIDE */}
          {activitesTypes.length === 0 && (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl text-xs font-bold uppercase tracking-widest text-slate-600">
              🔍 Aucun modèle d'activité trouvé dans la base.
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
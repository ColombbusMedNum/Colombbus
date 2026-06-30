"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { 
  ChevronLeftIcon, 
  ClockIcon, 
  CurrencyEuroIcon, 
  UserGroupIcon, 
  BriefcaseIcon 
} from "@heroicons/react/24/outline";

export default function VolumeHoraireComplet() {
  const [mediateursRaw, setMediateursRaw] = useState<Record<string, any>>({});
  const [planningRaw, setPlanningRaw] = useState<any[]>([]);
  
  const [statsMediateurs, setStatsMediateurs] = useState<any[]>([]);
  const [statsActions, setStatsActions] = useState<any[]>([]);
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [loading, setLoading] = useState(true);

  // 1. CONVERTISSEUR DE CHAÎNE "HH:MM" EN MINUTES
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(":");
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  };

  // 2. MOTEUR DE CALCUL DES HEURES ET DÉBORDEMENTS ACI
  const calculerAnalyseAction = (action: any, medInfo: any) => {
    // Si l'action n'a pas d'horaires définis, on applique 3.5h (équivalent d'une demi-journée standard)
    if (!action.debut || !action.fin) {
      return { total: 3.5, comp: 0 };
    }

    const start = timeToMinutes(action.debut);
    const end = timeToMinutes(action.fin);
    const dureeTotale = Math.max(0, (end - start) / 60);

    // Règle 1 : Si le médiateur n'est pas ACI, pas d'heures complémentaires
    if (medInfo.statut !== "ACI") {
      return { total: dureeTotale, comp: 0 };
    }

    // Règle 2 : Déterminer le jour de la semaine pour la règle du Mercredi
    if (action.date) {
      const dateObj = new Date(action.date);
      if (dateObj.getDay() === 3) return { total: dureeTotale, comp: dureeTotale }; // 3 = Mercredi
    }

    // Règle 3 : Calcul des débordements basé sur les horaires ACI personnalisés du staff
    const contratDebutStr = medInfo.debutACI || "09:00";
    const contratFinStr = medInfo.finACI || "17:00";

    const debutContrat = timeToMinutes(contratDebutStr);
    const finContrat = timeToMinutes(contratFinStr);
    
    // Pause standard fixe midi (13h00 - 14h00)
    const pauseStart = 13 * 60;
    const pauseEnd = 14 * 60;

    let minsContrat = 0;
    for (let t = start; t < end; t++) {
      if (t >= debutContrat && t < finContrat && !(t >= pauseStart && t < pauseEnd)) {
        minsContrat++;
      }
    }

    const heuresContrat = minsContrat / 60;
    const heuresComplémentaires = Math.max(0, dureeTotale - heuresContrat);

    return { total: dureeTotale, comp: heuresComplémentaires };
  };

  // ÉCOUTEUR 1 : S'aligne sur la collection "liste_mediateurs"
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "liste_mediateurs"), (snap) => {
      const meds = snap.docs.reduce((acc: any, d) => {
        const data = d.data();
        // Indexation par ID et par Nom Complet pour sécuriser le croisement
        const nomComplet = `${data.prenom || ""} ${data.nom || ""}`.trim();
        acc[d.id] = data;
        if (nomComplet) acc[nomComplet] = data;
        return acc;
      }, {});
      setMediateursRaw(meds);
    });
    return () => unsub();
  }, []);

  // ÉCOUTEUR 2 : S'aligne sur la collection "planning_mediateurs"
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "planning_mediateurs"), (snap) => {
      const plan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlanningRaw(plan);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // CRUNCHING DES DONNÉES EN TEMPS RÉEL
  useEffect(() => {
    if (Object.keys(mediateursRaw).length === 0 && planningRaw.length === 0) return;

    const mStats: Record<string, any> = {};
    const aStats: Record<string, any> = {};
    let grandTotal = 0;

    planningRaw.forEach((action: any) => {
      // Recherche du médiateur par son ID ou à défaut par son Nom complet écrit dans l'action
      const identifiantMed = action.mediateurId || action.mediateurNom || action.mediateur;
      if (!identifiantMed) return;

      const medInfo = mediateursRaw[identifiantMed] || { statut: "Permanent", poste: "Médiateur", taux: 0 };
      const nomAffichage = action.mediateurNom || identifiantMed;
      
      const { total, comp } = calculerAnalyseAction(action, medInfo);
      const tauxHoraire = Number(medInfo.taux) || (medInfo.statut === "ACI" ? 13.5 : 22.0); 
      const cout = total * tauxHoraire;

      grandTotal += total;

      // Aggregations par Médiateur
      if (!mStats[nomAffichage]) {
        mStats[nomAffichage] = { 
          nom: nomAffichage, 
          poste: medInfo.poste || "Médiateur",
          statut: medInfo.statut || "Permanent",
          h: 0, 
          comp: 0, 
          cout: 0 
        };
      }
      mStats[nomAffichage].h += total;
      mStats[nomAffichage].comp += comp;
      mStats[nomAffichage].cout += cout;

      // Aggregations par type de Lieu / Activité
      const titre = action.lieu || "Activité non spécifiée";
      if (!aStats[titre]) {
        aStats[titre] = { titre, h: 0, cout: 0, details: {} };
      }
      aStats[titre].h += total;
      aStats[titre].cout += cout;
      
      if (!aStats[titre].details[nomAffichage]) {
        aStats[titre].details[nomAffichage] = { h: 0 };
      }
      aStats[titre].details[nomAffichage].h += total;
    });

    setTotalGeneral(grandTotal);
    setStatsMediateurs(Object.values(mStats).sort((a: any, b: any) => b.h - a.h));
    setStatsActions(Object.values(aStats).sort((a: any, b: any) => b.h - a.h));
  }, [planningRaw, mediateursRaw]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-bold animate-pulse text-xs uppercase tracking-widest">
        Analyse des plannings d'équipe en cours...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-6xl mx-auto">
        
        {/* BOUTON RETOUR DESIGN COHÉRENT */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-xs font-bold uppercase tracking-wider shadow-md mb-8"
        >
          <ChevronLeftIcon className="w-4 h-4" /> 
          <span>Retour à l'Agenda</span>
        </Link>

        {/* COMPOSANT EN-TÊTE ET CHIFFRES MASSIFS */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-1 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]"></div>
            <div>
              <h1 className="text-3xl font-black text-white uppercase italic tracking-tight">
                Analyse Volumétrique
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">
                Calcul automatisé des heures et coûts RH à partir de l'agenda pro
              </p>
            </div>
          </div>
          
          <div className="flex gap-4 w-full sm:w-auto">
             <div className="flex-1 sm:flex-initial bg-slate-950 border border-slate-800 px-6 py-3 rounded-2xl text-center min-w-[140px]">
                <div className="text-2xl font-black font-mono text-blue-400">{totalGeneral.toFixed(1)}h</div>
                <div className="text-[9px] uppercase font-black text-slate-500 mt-0.5 tracking-wider">Cumul Heures</div>
             </div>
             <div className="flex-1 sm:flex-initial bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-3 rounded-2xl text-center min-w-[140px] shadow-lg shadow-emerald-950/20">
                <div className="text-2xl font-black font-mono text-white">
                  {statsMediateurs.reduce((acc, curr) => acc + curr.cout, 0).toFixed(2)}€
                </div>
                <div className="text-[9px] uppercase font-black text-emerald-100 mt-0.5 tracking-wider">Budget Engagé</div>
             </div>
          </div>
        </div>

        {/* GRID DE REPARTITION DES COMMISSIONS SALARIÉS */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl mb-10">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 pb-3 border-b border-slate-800 flex items-center gap-2">
            <UserGroupIcon className="w-4 h-4 text-blue-400" />
            Suivi Individuel du Temps de Travail par Collaborateur
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs table-fixed min-w-[600px]">
              <thead className="bg-slate-950 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="p-4 rounded-l-xl w-[220px]">Collaborateur</th>
                  <th className="p-4">Volume Total</th>
                  <th className="p-4 text-amber-400">Heures Complémentaires (ACI)</th>
                  <th className="p-4 text-right rounded-r-xl">Coût Estimé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {statsMediateurs.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-950/40 transition-colors group">
                    <td className="p-4">
                      <div className="font-black text-white uppercase text-[13px] tracking-tight truncate">{m.nom}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${m.statut === 'ACI' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                        {m.poste}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-blue-400 font-mono text-sm">{m.h.toFixed(1)}h</td>
                    <td className="p-4">
                      <span className={`inline-flex px-3 py-1 rounded-md text-[10px] font-mono font-black border ${
                        m.comp > 0 
                          ? 'bg-amber-950/40 border-amber-800/60 text-amber-400' 
                          : 'bg-slate-950 border-slate-800 text-slate-600'
                      }`}>
                        +{m.comp.toFixed(1)}h
                      </span>
                    </td>
                    <td className="p-4 text-right font-black text-emerald-400 font-mono text-sm">{m.cout.toFixed(2)}€</td>
                  </tr>
                ))}
                {statsMediateurs.length === 0 && (
                  <tr>
                     <td colSpan={4} className="p-12 text-center text-slate-600 font-bold uppercase text-xs italic tracking-widest">
                       Aucune action enregistrée pour le moment dans l'agenda.
                     </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CARTES PAR THÉMATIQUE DE LIEU ET DE TERRAIN */}
        <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
          <BriefcaseIcon className="w-4 h-4 text-emerald-400" />
          Ventilation Financière et Horaire par Activité / Lieu
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {statsActions.map((a, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between hover:border-slate-700 transition-all shadow-xl group">
              <div className="flex justify-between items-start mb-4 border-b border-slate-800/50 pb-3">
                <div>
                  <div className="font-black uppercase text-white tracking-tight text-sm group-hover:text-blue-400 transition-colors">{a.titre}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">Volume Global : {a.h.toFixed(1)}h</div>
                </div>
                <div className="font-mono font-black text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-3 py-1 rounded-xl text-xs">
                  {a.cout.toFixed(2)}€
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {Object.entries(a.details).map(([nom, d]: any) => (
                  <span key={nom} className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                    <span className="text-slate-200 uppercase text-[9px]">{nom}</span>
                    <span className="text-blue-400 font-mono font-black">{d.h.toFixed(1)}h</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
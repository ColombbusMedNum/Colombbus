"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { 
  ArrowLeftIcon,
  ClockIcon, 
  CurrencyEuroIcon, 
  UserGroupIcon, 
  BriefcaseIcon 
} from "@heroicons/react/24/outline";

// Police Quicksand pour toute la page
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

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
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#EA601F] font-bold animate-pulse text-xs uppercase tracking-widest`}>
        Analyse des plannings d'équipe en cours...
      </div>
    );
  }

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      
      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        
        {/* EN-TÊTE ET BOUTON RETOUR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Analyse <span className="text-[#EA601F] font-semibold">Volumétrique</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Calcul automatisé des heures et coûts RH à partir de l'agenda pro
              </p>
            </div>
          </div>

          <Link 
            href="/" 
            className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm w-fit"
          >
            <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" /> 
            <span>Accueil</span>
          </Link>
        </div>

        {/* CARTES DE SYNTHÈSE DES CHIFFRES KIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#005259] tracking-widest block">Cumul Heures Globales</span>
              <div className="text-3xl font-bold font-mono text-[#005259] mt-1">{totalGeneral.toFixed(1)}h</div>
            </div>
            <div className="p-3 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl text-[#EA601F]">
              <ClockIcon className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#005259] tracking-widest block">Budget Engagé Estimé</span>
              <div className="text-3xl font-bold font-mono text-[#EA601F] mt-1">
                {statsMediateurs.reduce((acc, curr) => acc + curr.cout, 0).toFixed(2)}€
              </div>
            </div>
            <div className="p-3 bg-[#EA601F]/10 border border-[#EA601F]/20 rounded-xl text-[#EA601F]">
              <CurrencyEuroIcon className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* TABLEAU DE REPARTITION COLLABORATEURS */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#404040]/10 flex items-center gap-3 bg-[#F3F3F2]/60">
            <div className="p-2.5 rounded-xl border border-[#005259]/20 bg-white text-[#EA601F]">
              <UserGroupIcon className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold uppercase text-[#005259] tracking-tight">
              Suivi Individuel du Temps de Travail par Collaborateur
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="py-3 px-6">Collaborateur</th>
                  <th className="py-3 px-4">Volume Total</th>
                  <th className="py-3 px-4">Heures Complémentaires (ACI)</th>
                  <th className="py-3 px-6 text-right">Coût Estimé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/10">
                {statsMediateurs.map((m, i) => (
                  <tr key={i} className="hover:bg-[#F3F3F2]/50 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="font-bold text-xs text-[#005259] uppercase">{m.nom}</div>
                      <div className="text-[11px] text-[#404040]/70 mt-0.5 flex items-center gap-1.5 font-medium">
                        <span className={`w-1.5 h-1.5 rounded-full ${m.statut === 'ACI' ? 'bg-[#EA601F]' : 'bg-[#005259]'}`}></span>
                        {m.poste}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#005259] font-mono text-xs">{m.h.toFixed(1)}h</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-mono font-bold border ${
                        m.comp > 0 
                          ? 'bg-[#EA601F]/15 border-[#EA601F]/40 text-[#EA601F]' 
                          : 'bg-[#F3F3F2] border-[#404040]/10 text-[#404040]/50'
                      }`}>
                        +{m.comp.toFixed(1)}h
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-bold text-[#EA601F] font-mono text-xs">{m.cout.toFixed(2)}€</td>
                  </tr>
                ))}
                {statsMediateurs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-[#404040]/60 font-bold uppercase text-xs italic tracking-widest">
                      Aucune action enregistrée pour le moment dans l'agenda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CARTES PAR THÉMATIQUE DE LIEU ET DE TERRAIN */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#005259] text-white">
              <BriefcaseIcon className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-xs uppercase tracking-wider text-[#005259]">
              Ventilation Financière et Horaire par Activité / Lieu
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {statsActions.map((a, i) => (
              <div key={i} className="bg-white border border-[#404040]/10 p-5 rounded-2xl flex flex-col justify-between hover:border-[#EA601F]/40 transition-all shadow-sm">
                <div className="flex justify-between items-start mb-4 border-b border-[#404040]/10 pb-3">
                  <div>
                    <div className="font-bold uppercase text-[#005259] tracking-tight text-xs">{a.titre}</div>
                    <div className="text-[11px] text-[#404040]/70 font-mono mt-0.5">Volume Global : {a.h.toFixed(1)}h</div>
                  </div>
                  <div className="font-mono font-bold text-[#EA601F] bg-[#EA601F]/10 border border-[#EA601F]/20 px-2.5 py-1 rounded-lg text-xs">
                    {a.cout.toFixed(2)}€
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {Object.entries(a.details).map(([nom, d]: any) => (
                    <span key={nom} className="bg-[#F3F3F2] border border-[#404040]/10 px-2.5 py-1 rounded-lg text-xs font-bold text-[#404040] flex items-center gap-1.5">
                      <span className="text-[#005259] uppercase text-[10px]">{nom}</span>
                      <span className="text-[#EA601F] font-mono">{d.h.toFixed(1)}h</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
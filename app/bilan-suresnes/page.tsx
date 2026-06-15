"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { 
  HomeIcon,
  ArrowLeftIcon, // Réintégration de ArrowLeftIcon
  BuildingOfficeIcon, 
  UserGroupIcon, 
  CalendarDaysIcon 
} from "@heroicons/react/24/outline";

interface GrandTotal {
  hommes: number;
  femmes: number;
  total: number;
}

interface MoisStats {
  nom: string;
  hommes: number;
  femmes: number;
  total: number;
}

export default function BilanSuresnesPage() {
  const [loading, setLoading] = useState(true);
  const [totalSuresnes, setTotalSuresnes] = useState(0);
  
  const [trimestres, setTrimestres] = useState<Record<string, GrandTotal>>({
    T1: { hommes: 0, femmes: 0, total: 0 },
    T2: { hommes: 0, femmes: 0, total: 0 },
    T3: { hommes: 0, femmes: 0, total: 0 },
    T4: { hommes: 0, femmes: 0, total: 0 },
  });

  const [moisDetail, setMoisDetail] = useState<MoisStats[]>([]);

  useEffect(() => {
    const calcCohorteUnique = async () => {
      try {
        // 1. Récupérer et filtrer les usagers de Suresnes
        const usersSnap = await getDocs(collection(db, "utilisateurs"));
        const suresnesUsers = usersSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(u => u.Ville?.trim().toLowerCase() === "suresnes");

        setTotalSuresnes(suresnesUsers.length);

        const structureTrimestres = {
          T1: { hommes: 0, femmes: 0, total: 0 },
          T2: { hommes: 0, femmes: 0, total: 0 },
          T3: { hommes: 0, femmes: 0, total: 0 },
          T4: { hommes: 0, femmes: 0, total: 0 },
        };

        const structureMois = Array(12).fill(null).map(() => ({ hommes: 0, femmes: 0, total: 0 }));

        // 2. Parcourir chaque usager pour trouver sa TOUTE PREMIÈRE VENUE
        for (const user of suresnesUsers) {
          const rdvSnap = await getDocs(collection(db, "utilisateurs", user.id, "rendezvous"));
          let dates: Date[] = [];
          
          rdvSnap.docs.forEach(docRdv => {
            const rdvData = docRdv.data();
            if (rdvData.date) dates.push(new Date(rdvData.date));
            else if (rdvData.createdAt) dates.push(new Date(rdvData.createdAt));
          });

          // Sécurité s'il n'a pas encore de rendez-vous enregistré
          if (dates.length === 0 && user.createdAt) {
            dates.push(new Date(user.createdAt));
          }

          if (dates.length > 0) {
            // RÈGLE D'OR : On extrait uniquement la date minimale (la plus ancienne)
            const premiereVenue = new Date(Math.min(...dates.map(d => d.getTime())));
            const mois = premiereVenue.getMonth(); 
            
            const genre = user.Genre || "Non spécifié";
            const isHomme = genre.toLowerCase().startsWith("h") || genre.toLowerCase() === "monsieur";
            const isFemme = genre.toLowerCase().startsWith("f") || genre.toLowerCase() === "madame";

            // Enregistrement sur le mois unique
            structureMois[mois].total += 1;
            if (isHomme) structureMois[mois].hommes += 1;
            if (isFemme) structureMois[mois].femmes += 1;

            // Enregistrement sur le trimestre unique
            let triKey = "T1";
            if (mois >= 3 && mois <= 5) triKey = "T2";
            else if (mois >= 6 && mois <= 8) triKey = "T3";
            else if (mois >= 9 && mois <= 11) triKey = "T4";

            structureTrimestres[triKey as keyof typeof structureTrimestres].total += 1;
            if (isHomme) structureTrimestres[triKey as keyof typeof structureTrimestres].hommes += 1;
            if (isFemme) structureTrimestres[triKey as keyof typeof structureTrimestres].femmes += 1;
          }
        }

        const nomsMois = [
          "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
          "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
        ];

        const detailFormate: MoisStats[] = nomsMois.map((nom, index) => ({
          nom,
          hommes: structureMois[index].hommes,
          femmes: structureMois[index].femmes,
          total: structureMois[index].total
        }));

        setTrimestres(structureTrimestres);
        setMoisDetail(detailFormate);

      } catch (error) {
        console.error("Erreur calcul indicateurs Suresnes:", error);
      } finally {
        setLoading(false);
      }
    };

    calcCohorteUnique();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold animate-pulse tracking-widest text-xs uppercase">
        Génération du bilan d'impact Suresnes (Unique)...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-5xl mx-auto">
        
        {/* EN-TÊTE */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.6)]"></div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tight">
                Bilan Territorial <span className="text-emerald-400 not-italic font-light">Suresnes</span>
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">
                Cohorte Unique basée sur le mois de première venue — Sans Doublons
              </p>
            </div>
          </div>
          
          {/* ZONE DES BOUTONS DE NAVIGATION */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* BOUTON RETOUR ACCUEIL */}
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-xs font-bold uppercase tracking-wider shadow-md active:scale-95"
            >
              <HomeIcon className="w-4 h-4" />
              <span>Accueil</span>
            </Link>

            {/* BOUTON RETOUR PLANNING */}
            <Link 
              href="/suresnes" 
              className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-xs font-bold uppercase tracking-wider shadow-md active:scale-95"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span>Planning</span>
            </Link>
          </div>
        </div>

        {/* INDICATEUR MAÎTRE */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between mb-8 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-xl text-emerald-400">
              <BuildingOfficeIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Bénéficiaires Actifs Uniques</span>
              <span className="text-xs text-slate-400 mt-0.5 block">Chaque habitant n'est compté qu'une seule fois dans l'année</span>
            </div>
          </div>
          <span className="text-4xl font-mono font-black text-white">{totalSuresnes}</span>
        </div>

        {/* VUE TRIMESTRIELLE */}
        <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2 px-1">
          <UserGroupIcon className="w-4 h-4 text-emerald-400" />
          Synthèse par Trimestre de première venue
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Object.entries(trimestres).map(([tri, data]) => (
            <div key={tri} className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
              <div className="flex justify-between items-center mb-2 border-b border-slate-950 pb-1.5">
                <span className="font-black text-xs text-emerald-400 uppercase tracking-widest">{tri}</span>
                <span className="font-mono font-black text-white text-lg">{data.total}</span>
              </div>
              <div className="flex justify-between text-[11px] font-medium text-slate-500 font-mono">
                <span>H: <strong className="text-slate-300">{data.hommes}</strong></span>
                <span>F: <strong className="text-emerald-400/80">{data.femmes}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {/* VUE MENSUELLE */}
        <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2 px-1">
          <CalendarDaysIcon className="w-4 h-4 text-emerald-400" />
          Ventilation Mensuelle
        </h2>
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-4 bg-slate-950/80 border-b border-slate-800 p-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
            <div className="text-left pl-4">Mois d'entrée</div>
            <div>Hommes</div>
            <div>Femmes</div>
            <div className="text-emerald-400">Total Unique</div>
          </div>
          
          <div className="divide-y divide-slate-800/60">
            {moisDetail.map((m) => (
              <div key={m.nom} className="grid grid-cols-4 p-3.5 text-center text-xs font-semibold items-center hover:bg-slate-950/20 transition-colors">
                <div className="text-left font-black text-slate-300 uppercase tracking-wider pl-4">{m.nom}</div>
                <div className="font-mono text-slate-400">{m.hommes}</div>
                <div className="font-mono text-slate-400">{m.femmes}</div>
                <div className="font-mono font-black text-white bg-slate-950/60 py-1 rounded-lg border border-slate-800/60 max-w-[80px] mx-auto w-full">
                  {m.total}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
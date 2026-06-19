"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { 
  HomeIcon,
  ArrowLeftIcon,
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
        // 1. Récupérer l'intégralité des créneaux de l'agenda de Suresnes
        const agendaSnap = await getDocs(collection(db, "planning_suresnes"));
        
        // 2. Récupérer tous les profils usagers avec une extraction ultra-large
        const usersSnap = await getDocs(collection(db, "utilisateurs"));
        const listeUsagers = usersSnap.docs.map(d => {
          const data = d.data();
          
          // Récupère TOUTES les variantes possibles de clés utilisées pour le genre
          const genreExtrait = data.Genre || data.genre || data.Sexe || data.sexe || data.civility || data.civilite || "";
          
          return {
            id: d.id,
            nom: (data.Nom || data.nom || "").trim().toLowerCase().replace(/\s+/g, " "),
            prenom: (data.Prénom || data.prenom || "").trim().toLowerCase().replace(/\s+/g, " "),
            genreBrut: genreExtrait.toString().toLowerCase().trim()
          };
        });

        // DEBUG LOG : Permet de voir instantanément dans la console F12 comment sont écrits vos genres dans Firestore
        if (listeUsagers.length > 0) {
          console.log("Exemple de genres détectés dans Firestore :", listeUsagers.slice(0, 5).map(u => ({ nom: u.nom, genreBrut: u.genreBrut })));
        }

        // Dictionnaire pour isoler la date la plus ancienne de chaque bénéficiaire unique
        const cohorteUniques: Record<string, { date: Date; genre: string }> = {};

        // 3. Analyser le planning global de Suresnes
        agendaSnap.docs.forEach(docRdv => {
          const rdvData = docRdv.data();
          const nomUsagerAgenda = (rdvData.usager || "").trim().toLowerCase().replace(/\s+/g, " ");

          // On ignore les créneaux vides sans usager
          if (!nomUsagerAgenda) return;

          // Recherche de la correspondance avec double vérification (Prénom + Nom OU Nom + Prénom)
          const ficheUsager = listeUsagers.find(u => {
            const combinPrenomNom = `${u.prenom} ${u.nom}`;
            const combinNomPrenom = `${u.nom} ${u.prenom}`;
            return nomUsagerAgenda === combinPrenomNom || nomUsagerAgenda === combinNomPrenom;
          });

          // Extraction et sécurité sur la date du créneau (ex: "2026-06-15")
          if (!rdvData.date) return;
          const rdvDate = new Date(rdvData.date);

          // Normalisation à spectre très large pour attraper toutes les écritures de genre possibles
          let genreFinal = "non_specifie";
          if (ficheUsager && ficheUsager.genreBrut) {
            const g = ficheUsager.genreBrut;
            
            // Tests pour HOMME (gère: "homme", "h", "monsieur", "mr", "m.", "1")
            if (g.startsWith("h") || g.includes("monsieur") || g === "m" || g.startsWith("mr") || g === "1") {
              genreFinal = "homme";
            } 
            // Tests pour FEMME (gère: "femme", "f", "madame", "mme", "2")
            else if (g.startsWith("f") || g.includes("madame") || g.startsWith("mme") || g === "2") {
              genreFinal = "femme";
            }
          }

          // La clé unique reste le nom nettoyé de l'usager pour éliminer les doublons de rendez-vous
          const cleUnique = nomUsagerAgenda;

          if (!cohorteUniques[cleUnique]) {
            cohorteUniques[cleUnique] = { date: rdvDate, genre: genreFinal };
          } else if (rdvDate.getTime() < cohorteUniques[cleUnique].date.getTime()) {
            cohorteUniques[cleUnique].date = rdvDate;
          }
        });

        // 4. Initialisation des structures de compteurs d'impact
        const structureTrimestres = {
          T1: { hommes: 0, femmes: 0, total: 0 },
          T2: { hommes: 0, femmes: 0, total: 0 },
          T3: { hommes: 0, femmes: 0, total: 0 },
          T4: { hommes: 0, femmes: 0, total: 0 },
        };

        const structureMois = Array(12).fill(null).map(() => ({ hommes: 0, femmes: 0, total: 0 }));
        let totalCompteur = 0;

        // 5. Ventilation finale sans doublon
        Object.values(cohorteUniques).forEach(({ date, genre }) => {
          totalCompteur++;
          const mois = date.getMonth(); // 0 = Janvier, 5 = Juin, etc.

          // Remplissage de la grille mensuelle globale
          structureMois[mois].total += 1;
          if (genre === "homme") structureMois[mois].hommes += 1;
          if (genre === "femme") structureMois[mois].femmes += 1;

          // Calcul du trimestre correspondant
          let triKey = "T1";
          if (mois >= 3 && mois <= 5) triKey = "T2";
          else if (mois >= 6 && mois <= 8) triKey = "T3";
          else if (mois >= 9 && mois <= 11) triKey = "T4";

          structureTrimestres[triKey as keyof typeof structureTrimestres].total += 1;
          if (genre === "homme") structureTrimestres[triKey as keyof typeof structureTrimestres].hommes += 1;
          if (genre === "femme") structureTrimestres[triKey as keyof typeof structureTrimestres].femmes += 1;
        });

        setTotalSuresnes(totalCompteur);

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
        console.error("Erreur de calcul des indicateurs de l'agenda de Suresnes :", error);
      } finally {
        setLoading(false);
      }
    };

    calcCohorteUnique();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold animate-pulse tracking-widest text-xs uppercase">
        Génération du bilan d'impact Suresnes (Agenda Global)...
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
                Cohorte Unique basée sur le planning global — Sans Doublons
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-xs font-bold uppercase tracking-wider shadow-md active:scale-95"
            >
              <HomeIcon className="w-4 h-4" />
              <span>Accueil</span>
            </Link>

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
              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Bénéficiaires Distincts de l'Agenda</span>
              <span className="text-xs text-slate-400 mt-0.5 block">Chaque personne inscrite dans le planning n'est comptée qu'une fois</span>
            </div>
          </div>
          <span className="text-4xl font-mono font-black text-white">{totalSuresnes}</span>
        </div>

        {/* VUE TRIMESTRIELLE */}
        <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2 px-1">
          <UserGroupIcon className="w-4 h-4 text-emerald-400" />
          Synthèse par Trimestre de premier rendez-vous
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
          Ventilation Mensuelle Réelle
        </h2>
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-4 bg-slate-950/80 border-b border-slate-800 p-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
            <div className="text-left pl-4">Mois de visite</div>
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
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { 
  HomeIcon,
  ArrowLeftIcon,
  BuildingOfficeIcon, 
  UserGroupIcon,
  CalendarDaysIcon
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

// Police Quicksand pour toute la page
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

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

        // DEBUG LOG
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

          // Extraction et sécurité sur la date du créneau
          if (!rdvData.date) return;
          const rdvDate = new Date(rdvData.date);

          // Normalisation du genre
          let genreFinal = "non_specifie";
          if (ficheUsager && ficheUsager.genreBrut) {
            const g = ficheUsager.genreBrut;
            
            if (g.startsWith("h") || g.includes("monsieur") || g === "m" || g.startsWith("mr") || g === "1") {
              genreFinal = "homme";
            } 
            else if (g.startsWith("f") || g.includes("madame") || g.startsWith("mme") || g === "2") {
              genreFinal = "femme";
            }
          }

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
          const mois = date.getMonth();

          structureMois[mois].total += 1;
          if (genre === "homme") structureMois[mois].hommes += 1;
          if (genre === "femme") structureMois[mois].femmes += 1;

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
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase`}>
        Génération du bilan d'impact Suresnes (Agenda Global)...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_bilan_suresnes">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10 space-y-6">
        
        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Bilan Territorial <span className="text-[#EA601F] font-semibold">Suresnes</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Cohorte Unique basée sur le planning global — Sans Doublons
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link 
              href="/" 
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>

            <Link
              href="/mediation/rencontres-numeriques/suresnes"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Retour au Planning</span>
            </Link>
          </div>
        </div>

        {/* INDICATEUR MAÎTRE */}
        <div className="p-6 bg-white border border-[#404040]/10 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#005259]/10 rounded-xl text-[#005259] border border-[#005259]/20">
              <BuildingOfficeIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-[#005259]">Bénéficiaires Distincts de l'Agenda</span>
              <span className="text-xs text-[#404040]/70 mt-0.5 block font-medium">Chaque personne inscrite dans le planning n'est comptée qu'une fois</span>
            </div>
          </div>
          <span className="text-4xl font-mono font-black text-[#EA601F]">{totalSuresnes}</span>
        </div>

        {/* VUE TRIMESTRIELLE */}
        <div className="space-y-3">
          <h2 className="font-bold text-xs uppercase tracking-wider text-[#005259] flex items-center gap-2 px-1">
            <UserGroupIcon className="w-4 h-4 text-[#EA601F]" />
            Synthèse par Trimestre de premier rendez-vous
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(trimestres).map(([tri, data]) => (
              <div key={tri} className="bg-white border border-[#404040]/10 p-4 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-2 border-b border-[#404040]/10 pb-2">
                  <span className="font-bold text-xs text-[#EA601F] uppercase tracking-wider">{tri}</span>
                  <span className="font-mono font-black text-[#005259] text-lg">{data.total}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-[#404040]/80 font-mono">
                  <span>H: <strong className="text-[#005259]">{data.hommes}</strong></span>
                  <span>F: <strong className="text-[#EA601F]">{data.femmes}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VUE MENSUELLE */}
        <div className="space-y-3">
          <h2 className="font-bold text-xs uppercase tracking-wider text-[#005259] flex items-center gap-2 px-1">
            <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" />
            Ventilation Mensuelle Réelle
          </h2>
          
          <div className="bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-4 bg-[#F3F3F2] border-b border-[#404040]/10 p-3 text-[10px] font-bold uppercase tracking-widest text-[#005259] text-center">
              <div className="text-left pl-4">Mois de visite</div>
              <div>Hommes</div>
              <div>Femmes</div>
              <div className="text-[#EA601F]">Total Unique</div>
            </div>
            
            <div className="divide-y divide-[#404040]/10">
              {moisDetail.map((m) => (
                <div key={m.nom} className="grid grid-cols-4 p-3.5 text-center text-xs font-medium items-center hover:bg-[#F3F3F2]/50 transition-colors">
                  <div className="text-left font-bold text-[#005259] uppercase tracking-wider pl-4">{m.nom}</div>
                  <div className="font-mono text-[#404040]">{m.hommes}</div>
                  <div className="font-mono text-[#EA601F] font-semibold">{m.femmes}</div>
                  <div className="font-mono font-bold text-[#005259] bg-[#005259]/10 py-1 rounded-lg border border-[#005259]/20 max-w-[80px] mx-auto w-full">
                    {m.total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </main>
    </PageGuard>
  );
}
"use client";

import { useEffect, useState } from "react";
// CORRECTION ICI : Utilisation de l'alias d'importation Next.js (@/)
import { db } from "@/lib/firebase"; 
import { collection, getDocs, collectionGroup } from "firebase/firestore";
import Link from "next/link";
import { 
  ArrowLeftIcon, 
  UserGroupIcon, 
  CalendarDaysIcon, 
  SparklesIcon, 
  BuildingOfficeIcon,
  UserPlusIcon,
  BookmarkSquareIcon,
  ChartBarIcon
} from "@heroicons/react/24/outline";

interface TrimestreStats {
  hommes: number;
  femmes: number;
  total: number;
}

interface LieuStats {
  totalGlobal: number;
  trimestres: Record<string, TrimestreStats>;
}

interface CodeAnalytiqueData {
  count: number;
  mediateurs: Record<string, number>;
}

export default function Statistiques() {
  const [stats, setStats] = useState({
    totalInscrits: 0,
    totalInterventions: 0,
    repartitionPro: {} as Record<string, number>,
    repartitionHandicap: { Oui: 0, Non: 0 },
    villes: {} as Record<string, number>,
    repartitionThematiques: {} as Record<string, number> 
  });

  const [statsCollectives, setStatsCollectives] = useState<Record<string, LieuStats>>({});
  const [totalParticipantsCollectifs, setTotalParticipantsCollectifs] = useState(0);
  const [statsCodesAnalytiques, setStatsCodesAnalytiques] = useState<Record<string, CodeAnalytiqueData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 1. Bénéficiaires Individuels
        const usersSnap = await getDocs(collection(db, "utilisateurs"));
        const users = usersSnap.docs.map(doc => doc.data());

        // 2. Interventions / Suivis individuels
        const rdvSnap = await getDocs(collectionGroup(db, "rendezvous"));

        // 3. Actions Collectives
        const collectivesSnap = await getDocs(collection(db, "actions_collectives"));

        // 4. Actions planifiées (Planning des médiateurs)
        const planningSnap = await getDocs(collection(db, "planning_mediateurs"));
        
        // --- CALCULS INDIVIDUELS ---
        const proMap: Record<string, number> = {};
        const villeMap: Record<string, number> = {};
        let handicapOui = 0;

        users.forEach(u => {
          const s = u.Situation_Socio_Pro || "Non renseigné";
          proMap[s] = (proMap[s] || 0) + 1;
          
          const v = u.Ville || "Inconnue";
          villeMap[v] = (villeMap[v] || 0) + 1;

          if (u.Situation_Handicap === "Oui") handicapOui++;
        });

        // --- VENTILATION THÉMATIQUE DES RDV ---
        const thematiqueMap: Record<string, number> = {};
        rdvSnap.docs.forEach(docSnap => {
          const rdvData = docSnap.data();
          const bruteThematique = rdvData.thematique || rdvData.thématique || rdvData.Thematique || "Non spécifié";
          
          let cleanThematique = bruteThematique.trim();
          if (cleanThematique.toLowerCase().includes("droit")) cleanThematique = "Accès aux droits";
          if (cleanThematique.toLowerCase().includes("emploi") || cleanThematique.toLowerCase().includes("form")) cleanThematique = "Emploi / Formation";
          if (cleanThematique.toLowerCase().includes("sant")) cleanThematique = "Santé";
          if (cleanThematique.toLowerCase().includes("parent")) cleanThematique = "Parentalité";
          if (cleanThematique.toLowerCase().includes("numér") || cleanThematique.toLowerCase().includes("clavier")) cleanThematique = "Compétences Numériques";

          thematiqueMap[cleanThematique] = (thematiqueMap[cleanThematique] || 0) + 1;
        });

        // --- CALCULS ACTIONS COLLECTIVES ---
        const structureCollectives: Record<string, LieuStats> = {};
        let cumulCollectif = 0;

        collectivesSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const lieu = data.lieu || "Lieu non spécifié";
          const h = data.nbHommes || 0;
          const f = data.nbFemmes || 0;
          const totalAction = h + f;
          
          cumulCollectif += totalAction;

          let trimestre = "T1"; 
          if (data.createdAt) {
            const mois = new Date(data.createdAt).getMonth();
            if (mois >= 3 && mois <= 5) trimestre = "T2";
            else if (mois >= 6 && mois <= 8) trimestre = "T3";
            else if (mois >= 9 && mois <= 11) trimestre = "T4";
          }

          if (!structureCollectives[lieu]) {
            structureCollectives[lieu] = {
              totalGlobal: 0,
              trimestres: {
                "T1": { hommes: 0, femmes: 0, total: 0 },
                "T2": { hommes: 0, femmes: 0, total: 0 },
                "T3": { hommes: 0, femmes: 0, total: 0 },
                "T4": { hommes: 0, femmes: 0, total: 0 },
              }
            };
          }

          structureCollectives[lieu].totalGlobal += totalAction;
          structureCollectives[lieu].trimestres[trimestre].hommes += h;
          structureCollectives[lieu].trimestres[trimestre].femmes += f;
          structureCollectives[lieu].trimestres[trimestre].total += totalAction;
        });

        // --- FIX SÉCURISÉ : CODES ANALYTIQUES & MÉDIATEURS ---
        const analytiqueMap: Record<string, CodeAnalytiqueData> = {};
        
        planningSnap.docs.forEach(docSnap => {
          const planData = docSnap.data();
          
          // Récupère le code analytique (nettoyé)
          const code = planData.codeAnalytique?.trim() || "Sans code spécifié";
          
          // Recherche multicritère blindée pour le nom du médiateur
          const nomBrut = 
            planData.mediateur || 
            planData.mediateurNom || 
            planData.médiateur || 
            planData.nom || 
            planData.name ||
            planData.intervenant ||
            "Médiateur Inconnu";

          const mediateur = typeof nomBrut === "string" ? nomBrut.trim() : String(nomBrut);

          // Initialisation si le code analytique n'existe pas encore dans la map
          if (!analytiqueMap[code]) {
            analytiqueMap[code] = {
              count: 0,
              mediateurs: {}
            };
          }

          // Incrémente le compteur général du code
          analytiqueMap[code].count += 1;
          
          // Incrémente le compteur propre à ce médiateur pour ce code
          analytiqueMap[code].mediateurs[mediateur] = (analytiqueMap[code].mediateurs[mediateur] || 0) + 1;
        });

        // Debug console pour vérifier la structure exacte des données extraites
        console.log("Extraction analytique validée :", analytiqueMap);

        // Enregistrement des états globaux
        setStats({
          totalInscrits: users.length,
          totalInterventions: rdvSnap.size,
          repartitionPro: proMap,
          repartitionHandicap: { Oui: handicapOui, Non: users.length - handicapOui },
          villes: villeMap,
          repartitionThematiques: thematiqueMap
        });
        
        setStatsCollectives(structureCollectives);
        setTotalParticipantsCollectifs(cumulCollectif);
        setStatsCodesAnalytiques(analytiqueMap); 

      } catch (error) {
        console.error("Erreur générale lors de la génération des statistiques :", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-purple-500 font-bold animate-pulse tracking-widest text-xs uppercase">
        Génération des indicateurs de performance...
      </div>
    );
  }

  const tauxHandicap = stats.totalInscrits > 0 
    ? `${Math.round((stats.repartitionHandicap.Oui / stats.totalInscrits) * 100)}%` 
    : "0%";

  const totalActionsCodees = Object.entries(statsCodesAnalytiques)
    .filter(([code]) => code !== "Sans code spécifié")
    .reduce((sum, [_, data]) => sum + data.count, 0);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-6xl mx-auto">
        
        {/* EN-TÊTE DE LA PAGE */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-purple-500 rounded-full shadow-[0_0_15px_rgba(147,51,234,0.6)]"></div>
            <div>
              <h1 className="text-3xl font-black text-white uppercase italic tracking-tight">
                Tableau de Bord
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">
                Indicateurs d'impact et bilans — Colombbus 2026
              </p>
            </div>
          </div>
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-xs font-bold uppercase tracking-wider shadow-md"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Menu Principal</span>
          </Link>
        </div>

        {/* SECTION DES CHIFFRES CLÉS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard title="Profils Uniques (Indiv)" value={stats.totalInscrits} color="emerald" icon={<UserPlusIcon className="w-5 h-5" />} />
          <StatCard title="Rendez-vous (Indiv)" value={stats.totalInterventions} color="indigo" icon={<CalendarDaysIcon className="w-5 h-5" />} />
          <StatCard title="Fréquentation Ateliers (Coll)" value={totalParticipantsCollectifs} color="purple" icon={<UserGroupIcon className="w-5 h-5" />} />
          <StatCard title="Impact Global Total" value={stats.totalInscrits + totalParticipantsCollectifs} color="amber" icon={<SparklesIcon className="w-5 h-5" />} />
        </div>

        {/* SECTION CODES ANALYTIQUES & MÉDIATEURS */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl mb-10">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 pb-3 border-b border-slate-800 flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-cyan-400" />
            Extraction & Volume par Codes Analytiques (Répartition par équipe)
          </h2>
          
          {Object.keys(statsCodesAnalytiques).length === 0 ? (
            <p className="text-xs text-slate-600 font-bold uppercase py-4 text-center">Aucun code analytique indexé dans le planning actuel.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(statsCodesAnalytiques)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([code, data]) => {
                  const pct = totalActionsCodees > 0 && code !== "Sans code spécifié"
                    ? (data.count / totalActionsCodees) * 100 
                    : 0;

                  return (
                    <div key={code} className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60 flex flex-col justify-between gap-4">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs font-mono font-black uppercase tracking-wider ${code === "Sans code spécifié" ? "text-slate-500 italic" : "text-cyan-400"}`}>
                            {code}
                          </span>
                          {code !== "Sans code spécifié" && (
                            <span className="text-[10px] font-bold text-slate-600 uppercase">
                              Poids sur activités codées : {Math.round(pct)}%
                            </span>
                          )}
                        </div>
                        <div className="text-right font-mono shrink-0">
                          <span className="text-sm font-black text-white block">{data.count}</span>
                          <span className="text-[9px] text-slate-500 uppercase font-sans font-bold">Injections</span>
                        </div>
                      </div>

                      {/* RENDU DES BADGES DES MÉDIATEURS AFFECTÉS */}
                      <div className="border-t border-slate-900/60 pt-2">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Personnes affectées :</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(data.mediateurs).length === 0 ? (
                            <span className="text-[10px] text-slate-600 italic">Aucun médiateur assigné</span>
                          ) : (
                            Object.entries(data.mediateurs)
                              .sort((a, b) => b[1] - a[1])
                              .map(([nom, occurrences]) => (
                                <span key={nom} className="inline-flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 text-[10px] text-slate-300 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/80"></span>
                                  {nom} <strong className="text-cyan-400 font-mono font-bold">({occurrences})</strong>
                                </span>
                              ))
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* SUIVI THÉMATIQUE GLOBAL */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl mb-10">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 pb-3 border-b border-slate-800 flex items-center gap-2">
            <BookmarkSquareIcon className="w-4 h-4 text-emerald-400" />
            Impact par Thématique d'Accompagnement (Volume d'Actions)
          </h2>
          
          {Object.keys(stats.repartitionThematiques).length === 0 ? (
            <p className="text-xs text-slate-600 font-bold uppercase py-4 text-center">Aucune thématique enregistrée sur les rendez-vous.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
              {Object.entries(stats.repartitionThematiques)
                .sort((a, b) => b[1] - a[1])
                .map(([label, count]) => {
                  const percentage = stats.totalInterventions > 0 ? (count / stats.totalInterventions) * 100 : 0;
                  return (
                    <div key={label} className="group">
                      <div className="flex justify-between text-xs mb-2 font-bold">
                        <span className="text-slate-300 group-hover:text-emerald-400 transition-colors uppercase tracking-wide text-[11px]">{label}</span>
                        <div className="space-x-2 font-mono">
                          <span className="text-slate-500">({Math.round(percentage)}%)</span>
                          <span className="text-emerald-400 font-black">{count} actes</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-950 border border-slate-800/60 h-3 rounded-full overflow-hidden p-0.5">
                        <div 
                          className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* SUIVI TERRITORIAL ACTIONS COLLECTIVES */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl mb-10">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 pb-3 border-b border-slate-800 flex items-center gap-2">
            <BuildingOfficeIcon className="w-4 h-4 text-purple-400" />
            Suivi Territorial des Actions Collectives (Lieu & Trimestre)
          </h2> 

          {Object.keys(statsCollectives).length === 0 ? (
            <p className="text-xs text-slate-600 font-bold uppercase py-4 text-center">Aucune donnée collective disponible.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(statsCollectives).map(([lieu, donneesLieu]) => (
                <div key={lieu} className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start border-b border-slate-900 pb-2 mb-3">
                      <h3 className="font-black text-sm text-purple-400 uppercase italic tracking-tight truncate max-w-[70%]">{lieu}</h3>
                      <span className="bg-purple-950/60 border border-purple-900 text-purple-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                        {donneesLieu.totalGlobal} part.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(donneesLieu.trimestres).map(([tri, dataTri]) => (
                        <div key={tri} className="bg-slate-900 p-2.5 rounded-xl border border-slate-800/50 flex flex-col justify-between">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tri}</span>
                            <span className="text-xs font-mono font-black text-white">{dataTri.total}</span>
                          </div>
                          <div className="flex justify-between text-[9px] font-medium text-slate-600 border-t border-slate-950 pt-1 mt-1">
                            <span>H: <strong className="text-slate-400 font-mono">{dataTri.hommes}</strong></span>
                            <span>F: <strong className="text-purple-400/70 font-mono">{dataTri.femmes}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GRAPHES DE RÉPARTITION DES BÉNÉFICIAIRES INDIVIDUELS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SOCIO-PRO */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 pb-3 border-b border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Profils Publics (Situation Socio-Professionnelle)
            </h2>
            <div className="space-y-5">
              {Object.entries(stats.repartitionPro).map(([label, count]) => {
                const percentage = stats.totalInscrits > 0 ? (count / stats.totalInscrits) * 100 : 0;
                return (
                  <div key={label} className="group">
                    <div className="flex justify-between text-xs mb-1.5 font-medium">
                      <span className="text-slate-400 group-hover:text-white transition-colors">{label}</span>
                      <span className="font-mono font-bold text-indigo-400">{count} pers.</span>
                    </div>
                    <div className="w-full bg-slate-950 border border-slate-800/80 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VILLES ET REPARTITION GEOGRAPHIQUE */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
              <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 pb-3 border-b border-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Public Spécifique
              </h2>
              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800/60">
                <div>
                  <span className="text-xs text-slate-400 font-bold block uppercase">Bénéficiaires RQTH / Handicap</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Accompagnements adaptés mis en place</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-mono font-black text-purple-400">{tauxHandicap}</span>
                  <span className="text-[10px] text-slate-600 font-bold block uppercase font-mono">{stats.repartitionHandicap.Oui} / {stats.totalInscrits}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
              <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 pb-3 border-b border-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Répartition Géographique (Bénéficiaires Individuels)
              </h2>
              <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                {Object.entries(stats.villes).sort((a, b) => b[1] - a[1]).map(([ville, count]) => (
                  <div key={ville} className="flex justify-between items-center bg-slate-950 border border-slate-800/50 p-2.5 rounded-xl">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">{ville}</span>
                    <span className="bg-amber-950/60 border border-amber-900 text-amber-400 font-mono font-bold px-2.5 py-0.5 rounded-md text-xs">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}

function StatCard({ title, value, color, icon }: { title: string; value: string | number; color: "emerald" | "indigo" | "purple" | "amber"; icon: React.ReactNode }) {
  const colorThemes = {
    emerald: { text: "text-emerald-400", bgIcon: "bg-emerald-950/50 text-emerald-400 border-emerald-900/60" },
    indigo: { text: "text-indigo-400", bgIcon: "bg-indigo-950/50 text-indigo-400 border-indigo-900/60" },
    purple: { text: "text-purple-400", bgIcon: "bg-purple-950/50 text-purple-400 border-purple-900/60" },
    amber: { text: "text-amber-400", bgIcon: "bg-amber-950/50 text-amber-400 border-amber-900/60" },
  };

  return (
    <div className="p-5 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl flex items-center justify-between">
      <div>
        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-black">{title}</p>
        <p className={`text-3xl font-black mt-1 font-mono tracking-tight ${colorThemes[color].text}`}>{value}</p>
      </div>
      <div className={`p-2.5 rounded-xl border ${colorThemes[color].bgIcon}`}>{icon}</div>
    </div>
  );
}
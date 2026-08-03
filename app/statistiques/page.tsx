"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { UserIcon, ChartBarIcon, ClockIcon, ArrowLeftIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Quicksand } from "next/font/google";

// Police Quicksand pour toute la page
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function StatsMediateursAnalytique() {
  const [actions, setActions] = useState<any[]>([]);
  const [mediateurs, setMediateurs] = useState<any[]>([]);
  const [selectedMedId, setSelectedMedId] = useState<string>("");
  
  // États de session
  const [userRole, setUserRole] = useState<string>("mediateur");
  const [userEmail, setUserEmail] = useState<string>("emmanuel-nkup@colombbus.org");

  // 1. Récupération instantanée des rôles stockés au login
  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = (localStorage.getItem("user_role") || "mediateur").toLowerCase();
      setUserRole(role);
      setUserEmail(localStorage.getItem("user_email") || "");
      if (role === "admin" && !selectedMedId) {
        setSelectedMedId("all");
      }
    }
  }, []);

  // 2. Écoute temps réel Firestore
  useEffect(() => {
    const unsubActions = onSnapshot(collection(db, "planning_mediateurs"), (snap) => {
      setActions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubMed = onSnapshot(collection(db, "liste_mediateurs"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sécurité : On filtre pour ne garder QUE les fiches valides qui ont un nom et prénom
      const valides = data.filter(m => m.nom && m.prenom);
      const sorted = valides.sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
      
      setMediateurs(sorted);
      
      // Logique d'affectation automatique de la vue
      if (sorted.length > 0) {
        const storedRole = (localStorage.getItem("user_role") || "mediateur").toLowerCase();
        if (storedRole === "admin") {
          if (!selectedMedId) {
            setSelectedMedId("all");
          }
        } else {
          // Si c'est un médiateur, on le force directement sur son propre email
          const monEmail = localStorage.getItem("user_email") || "";
          const maFiche = sorted.find(m => m.email?.toLowerCase() === monEmail.toLowerCase());
          if (maFiche) {
            setSelectedMedId(maFiche.id);
          }
        }
      }
    });

    return () => { unsubActions(); unsubMed(); };
  }, [selectedMedId]);

  const currentMediateur = selectedMedId === "all"
    ? { id: "all", prenom: "Tous les", nom: "Médiateurs", poste: "Vue Globale", statut: "Tous les statuts" }
    : mediateurs.find(m => m.id === selectedMedId);

  // 3. Filtrage des actions
  const currentMedActions = actions.filter(a => {
    if (selectedMedId === "all") return true;
    if (!currentMediateur) return false;
    const nomComplet = `${currentMediateur.prenom || ""} ${currentMediateur.nom || ""}`.trim();
    return a.mediateurId === selectedMedId || a.mediateurNom === nomComplet || a.mediateur === nomComplet;
  });

  const calculerDureeHeures = (debut: string, fin: string) => {
    if (!debut || !fin) return 3.5; 
    const [hDeb, mDeb] = debut.split(":").map(Number);
    const [hFin, mFin] = fin.split(":").map(Number);
    if (isNaN(hDeb) || isNaN(hFin)) return 3.5;
    
    let totalMinutes = (hFin * 60 + mFin) - (hDeb * 60 + mDeb);
    if (totalMinutes <= 0) return 3.5;

    // Déduction repas (13h-14h)
    if ((hDeb * 60 + mDeb) <= 13 * 60 && (hFin * 60 + mFin) >= 14 * 60) {
      totalMinutes -= 60;
    }
    return totalMinutes / 60;
  };

  // 4. Synthèse analytique
  const analyticsSummary = React.useMemo(() => {
    const summary: { [code: string]: { code: string; label: string; totalHeures: number; count: number } } = {};
    const dejaCompte = new Set<string>();

    currentMedActions.forEach(action => {
      const code = (action.codeAnalytique || "").trim() || "SANS_CODE";
      const label = action.codeAnalytique ? `Code ${action.codeAnalytique}` : "Sans code analytique / Non spécifié";
      const cleUnique = `${action.mediateurId || action.mediateurNom || ""}_${action.date}_${action.moment || ""}_${code}_${action.debut || ""}_${action.fin || ""}`;

      if (!summary[code]) {
        summary[code] = { code, label, totalHeures: 0, count: 0 };
      }

      if (dejaCompte.has(cleUnique)) {
        summary[code].count += 1;
      } else {
        const heures = calculerDureeHeures(action.debut || "", action.fin || "");
        summary[code].totalHeures += heures;
        summary[code].count += 1;
        if (action.debut && action.fin) dejaCompte.add(cleUnique);
      }
    });

    return Object.values(summary)
      .map(item => ({ ...item, totalHeures: Math.round(item.totalHeures * 10) / 10 }))
      .sort((a, b) => b.totalHeures - a.totalHeures);
  }, [currentMedActions]);

  const totalHeuresGlobal = analyticsSummary.reduce((acc, curr) => acc + curr.totalHeures, 0);

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      
      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10 space-y-6">
        
        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Synthèse <span className="text-[#EA601F] font-semibold">analytique</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Suivi et audit du volume horaire par code analytique
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Link 
              href="/" 
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>

            <Link 
              href="/agenda" 
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md active:scale-95 group"
            >
              <CalendarDaysIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
              <span>Agenda</span>
            </Link>
          </div>
        </div>

        {/* BANDEAU DE SELECTION ET FILTRE ASSOCIE */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#005259]/10 rounded-xl text-[#005259] border border-[#005259]/20">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#005259] uppercase tracking-wider">
                {userRole === "admin" ? "Analyse de Profil (Mode Admin)" : "Mon Espace Analytique"}
              </h2>
              <p className="text-xs text-[#404040]/70 font-medium">
                {userRole === "admin" 
                  ? "Sélectionnez un profil pour auditer la répartition de ses heures." 
                  : "Consultez le récapitulatif de vos heures par code analytique."}
              </p>
            </div>
          </div>
          
          {/* CONDITION UNIQUE : Seulement si l'utilisateur connecté est un Admin */}
          {userRole === "admin" ? (
            <div className="w-full sm:w-72">
              <select
                value={selectedMedId}
                onChange={(e) => setSelectedMedId(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-xl text-xs font-bold text-[#404040] outline-none focus:border-[#005259] focus:ring-1 focus:ring-[#005259] transition-all cursor-pointer"
              >
                <option value="" disabled>-- Sélectionner un médiateur --</option>
                <option value="all">Tous les médiateurs</option>
                {mediateurs.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.prenom} {m.nom?.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            // Si c'est un Médiateur, on affiche un petit badge sécurisé
            <div className="px-4 py-2 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl text-xs font-mono text-[#005259] font-semibold shadow-inner">
              🔒 Compte connecté : {userEmail}
            </div>
          )}
        </div>

        {currentMediateur ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* FICHE INDIVIDUELLE */}
            <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 space-y-4 self-start shadow-sm">
              <div>
                <h3 className="text-[10px] font-bold text-[#404040]/60 uppercase tracking-widest mb-2">Fiche Médiateur</h3>
                <div className="text-lg font-bold uppercase tracking-tight text-[#005259]">{currentMediateur.prenom} {currentMediateur.nom?.toUpperCase()}</div>
                <div className="text-xs text-[#EA601F] font-mono font-bold mt-0.5">{currentMediateur.poste || "Médiateur Social"}</div>
              </div>

              <div className="pt-3 border-t border-[#404040]/10 grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[10px] text-[#404040]/60 uppercase font-bold tracking-wider">Statut</span>
                  <span className="text-xs font-bold text-[#404040]">{currentMediateur.statut || "Permanent"}</span>
                </div>
                {currentMediateur.sitePrincipal && (
                  <div>
                    <span className="block text-[10px] text-[#404040]/60 uppercase font-bold tracking-wider">Site Principal</span>
                    <span className="text-xs font-bold text-[#404040]">{currentMediateur.sitePrincipal}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#404040]/10 bg-[#F3F3F2] -mx-5 -mb-5 p-5 rounded-b-2xl flex items-center justify-between border-b border-x border-[#404040]/5">
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-[#EA601F]" />
                  <span className="text-xs text-[#005259] font-bold uppercase tracking-wider">Volume total :</span>
                </div>
                <div className="text-xl font-black text-[#005259] font-mono">
                  {totalHeuresGlobal.toFixed(1)}h
                </div>
              </div>
            </div>

            {/* GRAPHIQUE ANALYTIQUE */}
            <div className="md:col-span-2 bg-white border border-[#404040]/10 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-3 border-b border-[#404040]/10">
                <ChartBarIcon className="w-4 h-4 text-[#005259]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#005259]">Total d'heures par code analytique</h3>
              </div>

              {analyticsSummary.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#404040]/60 font-bold uppercase tracking-wider">
                  Aucune mission ou activité enregistrée sur l'agenda.
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
                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 border ${
                              isSansCode 
                                ? "bg-[#F3F3F2] text-[#404040]/60 border-[#404040]/20" 
                                : "bg-[#005259]/10 text-[#005259] border-[#005259]/20"
                            }`}>
                              {isSansCode ? "N/A" : item.code}
                            </span>
                            <span className="text-[#404040] truncate font-semibold">
                              {item.label}
                            </span>
                          </div>
                          
                          <div className="text-right shrink-0 font-mono font-bold text-[#005259] pl-2">
                            {item.totalHeures.toFixed(1)}h 
                            <span className="text-[10px] text-[#404040]/60 font-normal ml-1">
                              ({pourcentage.toFixed(0)}%)
                            </span>
                          </div>
                        </div>

                        <div className="w-full bg-[#F3F3F2] rounded-full h-2.5 overflow-hidden border border-[#404040]/10">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isSansCode 
                                ? "bg-[#404040]/30" 
                                : "bg-gradient-to-r from-[#EA601F] to-[#EF736A]"
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
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-12 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60 shadow-sm">
            Aucun profil de médiateur ne correspond à votre adresse e-mail.
          </div>
        )}
      </div>
    </main>
  );
}
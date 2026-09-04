"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { UserIcon, HomeIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import PageGuard from "@/components/PageGuard";
import MediateurAnalyticsPanel from "@/components/MediateurAnalyticsPanel";
import MediateurActionsParMois from "@/components/MediateurActionsParMois";
import { useAnalyticsSummary } from "@/lib/useAnalyticsSummary";
import { useMediateurs } from "@/lib/MediateursProvider";
import { usePermissions } from "@/lib/PermissionsProvider";
import { estActionDuMediateur } from "@/lib/matchMediateur";

function normaliser(texte: string): string {
  return texte.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export default function StatsMediateursAnalytique() {
  const [actions, setActions] = useState<any[]>([]);
  const { mediateurs: mediateursBruts } = useMediateurs();
  const [selectedMedId, setSelectedMedId] = useState<string>("");
  const [rechercheMed, setRechercheMed] = useState("");
  const [dropdownOuvert, setDropdownOuvert] = useState(false);
  const comboboxRef = React.useRef<HTMLDivElement>(null);

  // États de session : source unique de vérité (Firestore via PermissionsProvider),
  // au lieu de relire un rôle potentiellement obsolète dans localStorage.
  const { role, user } = usePermissions();
  const userRole = role || "mediateur";
  const userEmail = user?.email || "";

  // Sécurité : on ne garde QUE les fiches valides qui ont un nom et prénom
  const mediateurs = React.useMemo(() => {
    return mediateursBruts
      .filter((m: any) => m.nom && m.prenom)
      .sort((a: any, b: any) => (a.nom || "").localeCompare(b.nom || ""));
  }, [mediateursBruts]);

  // 1. Écoute temps réel Firestore des actions planifiées
  useEffect(() => {
    const unsubActions = onSnapshot(collection(db, "planning_mediateurs"), (snap) => {
      setActions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubActions();
  }, []);

  // 2. Affectation automatique de la vue une fois le rôle et la liste des médiateurs chargés
  useEffect(() => {
    if (userRole === "admin") {
      if (!selectedMedId) setSelectedMedId("all");
      return;
    }

    if (mediateurs.length === 0 || !userEmail) return;

    // Pour tout rôle non-admin (médiateur, ACI/lecteur, coordinateur...), on
    // force directement sur sa propre fiche, identifiée par son email.
    const maFiche = mediateurs.find((m: any) => m.email?.toLowerCase() === userEmail.toLowerCase());
    if (maFiche) setSelectedMedId(maFiche.id);
  }, [mediateurs, selectedMedId, userRole, userEmail]);

  const currentMediateur = selectedMedId === "all"
    ? { id: "all", prenom: "Tous les", nom: "Médiateurs", poste: "Vue Globale", statut: "Tous les statuts" }
    : mediateurs.find(m => m.id === selectedMedId);

  const libelleMediateur = (m: any) => (m.id === "all" ? "Tous les médiateurs" : `${m.nom?.toUpperCase()} ${m.prenom}`);

  // Reflète le médiateur sélectionné dans le champ de recherche tant que la
  // liste n'est pas ouverte (évite d'écraser la saisie en cours de frappe).
  useEffect(() => {
    if (dropdownOuvert) return;
    setRechercheMed(currentMediateur ? libelleMediateur(currentMediateur) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMedId, dropdownOuvert]);

  // Ferme la liste au clic en dehors du champ.
  useEffect(() => {
    const surClicExterieur = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setDropdownOuvert(false);
      }
    };
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, []);

  const mediateursFiltres = React.useMemo(() => {
    const terme = normaliser(rechercheMed);
    const options = [{ id: "all", prenom: "Tous les", nom: "Médiateurs" }, ...mediateurs];
    if (!terme) return options;
    return options.filter((m) => normaliser(libelleMediateur(m)).includes(terme));
  }, [mediateurs, rechercheMed]);

  // 3. Filtrage des actions
  const currentMedActions = actions.filter(a => {
    if (selectedMedId === "all") return true;
    if (!currentMediateur) return false;
    return estActionDuMediateur(a, currentMediateur);
  });

  // 4. Synthèse analytique
  const { analyticsSummary, totalHeuresGlobal, totalHeuresComplementaires } = useAnalyticsSummary(currentMedActions, mediateurs);

  return (
    <PageGuard pageId="page_access_statistiques">
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
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
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
            <div className="w-full sm:w-72 relative" ref={comboboxRef}>
              <input
                type="text"
                value={rechercheMed}
                onFocus={(e) => { setDropdownOuvert(true); e.target.select(); }}
                onChange={(e) => { setRechercheMed(e.target.value); setDropdownOuvert(true); }}
                placeholder="Rechercher un médiateur..."
                className="w-full px-3 py-2.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-xl text-xs font-bold text-[#404040] outline-none focus:border-[#005259] focus:ring-1 focus:ring-[#005259] transition-all"
              />
              {dropdownOuvert && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#404040]/15 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {mediateursFiltres.length > 0 ? (
                    mediateursFiltres.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setSelectedMedId(m.id); setDropdownOuvert(false); }}
                        className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-[#005259] hover:text-white transition-colors cursor-pointer ${m.id === selectedMedId ? "text-[#EA601F]" : "text-[#404040]"}`}
                      >
                        {libelleMediateur(m)}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-[#404040]/50 font-medium">Aucun résultat</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Si c'est un Médiateur, on affiche un petit badge sécurisé
            <div className="px-4 py-2 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl text-xs font-mono text-[#005259] font-semibold shadow-inner">
              🔒 Compte connecté : {userEmail}
            </div>
          )}
        </div>

        {currentMediateur ? (
          <>
            <MediateurAnalyticsPanel
              currentMediateur={currentMediateur}
              analyticsSummary={analyticsSummary}
              totalHeuresGlobal={totalHeuresGlobal}
              totalHeuresComplementaires={totalHeuresComplementaires}
              emptyMessage="Aucune mission ou activité enregistrée sur l'agenda."
            />
            <MediateurActionsParMois
              actions={currentMedActions}
              emptyMessage="Aucune action enregistrée sur l'agenda."
            />
          </>
        ) : (
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-12 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60 shadow-sm">
            Aucun profil de médiateur ne correspond à votre adresse e-mail.
          </div>
        )}
      </div>
    </main>
    </PageGuard>
  );
}
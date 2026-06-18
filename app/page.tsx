"use client";

import { useState } from "react";
import Link from "next/link";
import {   
  UsersIcon,   
  ChartBarIcon,   
  CalendarDaysIcon,
  CpuChipIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ClockIcon,
  CalendarIcon,
  DocumentPlusIcon,
  FolderIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

export default function HomePage() {
  // États pour gérer l'ouverture des dossiers smartphone
  const [activeFolder, setActiveFolder] = useState<"rencontres" | "stats" | null>(null);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 md:p-8 font-sans antialiased relative overflow-hidden">
      
      {/* Background Glow Effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl w-full relative z-10 flex flex-col items-center justify-center min-h-[80vh]">
        
        {/* EN-TÊTE */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-8 w-1 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.6)]"></div>
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">
              Colombbus
            </h1>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
            Plateforme de gestion des bénéficiaires — 2026
          </p>
        </div>

        {/* CONTENEUR PRINCIPAL DE LA NAVIGATION */}
        <div className="w-full max-w-6xl transition-all duration-300">
          
          {!activeFolder ? (
            /* ================= VUE FERMÉE : LES 3 BOUTONS PRINCIPAUX CÔTE À CÔTE ================= */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full items-stretch">
              
              {/* 1ÈRE POSITION : AGENDA DES MÉDIATEURS (Accès direct) */}
              <Link href="/activites_types" className="group bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-amber-500/50 shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center active:scale-95 min-h-[240px]">
                <div className="bg-slate-950 border border-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-amber-600 group-hover:border-amber-500 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all duration-300">
                  <CalendarDaysIcon className="w-7 h-7 text-amber-400 group-hover:text-white" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-wide text-white group-hover:text-amber-400 transition-colors">
                  Agenda des Médiateurs
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed max-w-[200px]">
                  Gérer l'équipe et le planning des actions
                </p>
              </Link>

              {/* 2ÈME POSITION : CARRE RENCONTRES NUMÉRIQUES */}
              <button 
                onClick={() => setActiveFolder("rencontres")}
                className="group bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-indigo-500/50 shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center active:scale-95 min-h-[240px]"
              >
                <div className="bg-slate-950 border border-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:border-indigo-500 group-hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all duration-300">
                  <FolderIcon className="w-7 h-7 text-indigo-400 group-hover:text-white" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-wide text-white group-hover:text-indigo-400 transition-colors">
                  Rencontres Numériques
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                  Bénéficiaires, émargements et ateliers
                </p>
                <div className="mt-4 grid grid-cols-3 gap-1 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/50 w-14">
                  <div className="w-1.5 h-1.5 rounded-sm bg-indigo-500/40"></div>
                  <div className="w-1.5 h-1.5 rounded-sm bg-teal-500/40"></div>
                  <div className="w-1.5 h-1.5 rounded-sm bg-cyan-500/40"></div>
                  <div className="w-1.5 h-1.5 rounded-sm bg-emerald-500/40"></div>
                  <div className="w-1.5 h-1.5 rounded-sm bg-fuchsia-500/40"></div>
                  <div className="w-1.5 h-1.5 rounded-sm bg-blue-500/40"></div>
                </div>
              </button>

              {/* 3ÈME POSITION : STATISTIQUES & BILANS (En dernier) */}
              <button 
                onClick={() => setActiveFolder("stats")}
                className="group bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-purple-500/50 shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center active:scale-95 min-h-[240px]"
              >
                <div className="bg-slate-950 border border-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-purple-600 group-hover:border-purple-500 group-hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all duration-300">
                  <ChartBarIcon className="w-7 h-7 text-purple-400 group-hover:text-white" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-wide text-white group-hover:text-purple-400 transition-colors">
                  Statistiques & Bilans
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                  Rapports globaux et impact Suresnes
                </p>
                <div className="mt-4 flex gap-1 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/50">
                  <div className="w-2 h-2 rounded-full bg-purple-500/50"></div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500/50"></div>
                </div>
              </button>

            </div>
          ) : activeFolder === "rencontres" ? (
            /* ================= VUE AGRANDIE : CONTENU DE RENCONTRES NUMÉRIQUES ================= */
            <div className="bg-slate-900/90 border border-indigo-500/40 rounded-[2.5rem] p-6 md:p-8 shadow-2xl transition-all duration-300 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 w-full max-w-4xl mx-auto">
              
              <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <FolderIcon className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm font-black uppercase tracking-wider text-white">
                    Rencontres Numériques
                  </span>
                </div>
                <button 
                  onClick={() => setActiveFolder(null)}
                  className="text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 p-2 rounded-xl border border-slate-800 transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3"
                >
                  <XMarkIcon className="w-4 h-4" /> Fermer
                </button>
              </div>

              {/* GRILLE INTERNE DU DOSSIER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* LISTE DES BÉNÉFICIAIRES */}
                <Link href="/liste-beneficiaires" className="group bg-slate-950 border border-slate-850 rounded-2xl p-4 hover:border-indigo-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="bg-slate-900 border border-slate-800 w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-indigo-600 transition-all">
                    <UsersIcon className="w-4 h-4 text-indigo-400 group-hover:text-white" />
                  </div>
                  <h2 className="text-[11px] font-black uppercase tracking-wide text-white group-hover:text-indigo-400 transition-colors">
                    Liste des bénéficiaires
                  </h2>
                  <p className="text-[9px] text-slate-500 font-medium mt-1 leading-relaxed">
                    Consulter et modifier les fiches existantes
                  </p>
                </Link>

                {/* AGENDA SURESNES */}
                <Link href="/suresnes" className="group bg-slate-950 border border-slate-850 rounded-2xl p-4 hover:border-teal-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="bg-slate-900 border border-slate-800 w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-teal-600 transition-all">
                    <CalendarIcon className="w-4 h-4 text-teal-400 group-hover:text-white" />
                  </div>
                  <h2 className="text-[11px] font-black uppercase tracking-wide text-white group-hover:text-teal-400 transition-colors">
                    Agenda Suresnes
                  </h2>
                  <p className="text-[9px] text-slate-500 font-medium mt-1 leading-relaxed">
                    Consulter l'agenda du Relais Numérique
                  </p>
                </Link>

                {/* ÉMARGEMENTS & DOC. INTERNES */}
                <Link href="/emargements" className="group bg-slate-950 border border-slate-850 rounded-2xl p-4 hover:border-cyan-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="bg-slate-900 border border-slate-800 w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-cyan-600 transition-all">
                    <ClipboardDocumentCheckIcon className="w-4 h-4 text-cyan-400 group-hover:text-white" />
                  </div>
                  <h2 className="text-[11px] font-black uppercase tracking-wide text-white group-hover:text-cyan-400 transition-colors">
                    Émargements & Doc. internes
                  </h2>
                  <p className="text-[9px] text-slate-500 font-medium mt-1 leading-relaxed">
                    Accéder aux feuilles archivées
                  </p>
                </Link>

                {/* GÉNÉRATEUR D'ÉMARGEMENTS */}
                <Link href="/emargement" className="group bg-slate-950 border border-slate-850 rounded-2xl p-4 hover:border-emerald-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center active:scale-95 bg-gradient-to-b from-slate-950 to-emerald-950/10">
                  <div className="bg-slate-900 border border-slate-800 w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-600 transition-all">
                    <DocumentPlusIcon className="w-4 h-4 text-emerald-400 group-hover:text-white" />
                  </div>
                  <h2 className="text-[11px] font-black uppercase tracking-wide text-white group-hover:text-emerald-400 transition-colors">
                    Générateur d'Émargements
                  </h2>
                  <p className="text-[9px] text-slate-400 font-medium mt-1 leading-relaxed">
                    Éditer de nouvelles feuilles A4 prêtes à imprimer
                  </p>
                </Link>

                {/* ACTIONS COLLECTIVES */}
                <Link href="/actions-collectives" className="group bg-slate-950 border border-slate-850 rounded-2xl p-4 hover:border-fuchsia-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="bg-slate-900 border border-slate-800 w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-fuchsia-600 transition-all">
                    <UserGroupIcon className="w-4 h-4 text-fuchsia-400 group-hover:text-white" />
                  </div>
                  <h2 className="text-[11px] font-black uppercase tracking-wide text-white group-hover:text-fuchsia-400 transition-colors">
                    Actions Collectives
                  </h2>
                  <p className="text-[9px] text-slate-500 font-medium mt-1 leading-relaxed">
                    Saisir les bilans simplifiés d'ateliers
                  </p>
                </Link>

                {/* VOLUME HORAIRE */}
                <Link href="/volume-horaire" className="group bg-slate-950 border border-slate-850 rounded-2xl p-4 hover:border-blue-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="bg-slate-900 border border-slate-800 w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-600 transition-all">
                    <ClockIcon className="w-4 h-4 text-blue-400 group-hover:text-white" />
                  </div>
                  <h2 className="text-[11px] font-black uppercase tracking-wide text-white group-hover:text-blue-400 transition-colors">
                    Volume Horaire
                  </h2>
                  <p className="text-[9px] text-slate-500 font-medium mt-1 leading-relaxed">
                    Analyser le temps de travail et coûts RH
                  </p>
                </Link>

              </div>
            </div>
          ) : (
            /* ================= VUE AGRANDIE : STATISTIQUES & BILANS ================= */
            <div className="bg-slate-900/90 border border-purple-500/40 rounded-[2.5rem] p-6 md:p-8 shadow-2xl transition-all duration-300 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 max-w-3xl mx-auto w-full">
              <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <ChartBarIcon className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-black uppercase tracking-wider text-white">
                    Statistiques & Analyses d'Impact
                  </span>
                </div>
                <button 
                  onClick={() => setActiveFolder(null)}
                  className="text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 p-2 rounded-xl border border-slate-800 transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3"
                >
                  <XMarkIcon className="w-4 h-4" /> Fermer
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* STATS GLOBALES */}
                <Link href="/statistiques" className="group bg-slate-950 border border-slate-850 rounded-2xl p-5 hover:border-purple-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="bg-slate-900 border border-slate-800 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-all">
                    <ChartBarIcon className="w-5 h-5 text-purple-400" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-purple-400 transition-colors">
                    Bilan & Stats Globaux
                  </h2>
                  <p className="text-[10px] text-slate-500 font-medium mt-1.5 leading-relaxed">
                    Consulter les rapports et indicateurs transversaux de la plateforme
                  </p>
                </Link>

                {/* STATS SURESNES */}
                <Link href="/bilan-suresnes" className="group bg-slate-950 border border-slate-850 rounded-2xl p-5 hover:border-emerald-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center active:scale-95 bg-gradient-to-b from-slate-950 to-emerald-950/10">
                  <div className="bg-slate-900 border border-slate-800 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 transition-all">
                    <BuildingOfficeIcon className="w-5 h-5 text-emerald-400 group-hover:text-white" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-emerald-400 transition-colors">
                    Analyse Actions Suresnes
                  </h2>
                  <p className="text-[10px] text-slate-500 font-medium mt-1.5 leading-relaxed">
                    Édition et étude du bilan d'impact annuel du Relais Numérique
                  </p>
                </Link>
              </div>
            </div>
          )}
          
        </div>

        {/* FOOTER CLOUD SYSTEM */}
        <footer className="mt-12 w-full max-w-4xl bg-gradient-to-r from-slate-900 to-slate-900/40 border border-slate-800/80 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 hidden sm:block">
              <CpuChipIcon className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Infrastructure Cloud</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Les données sont stockées de manière sécurisée et synchronisées en direct.
              </p>
            </div>
          </div>
          <div className="flex items-center bg-slate-950 px-5 py-3 rounded-2xl border border-slate-800">
            <div className="text-center sm:text-right">
              <span className="block text-sm font-black uppercase tracking-tighter italic text-white">
                Colombbus
              </span>
              <span className="text-[9px] uppercase tracking-widest font-black text-slate-600 block mt-0.5">
                Médiation Numérique
              </span>
            </div>
          </div>
        </footer>

      </div>
    </main>
  );
}
"use client";

import Link from "next/link";
import {   
  UsersIcon,   
  UserPlusIcon,   
  ChartBarIcon,   
  CalendarDaysIcon,
  CpuChipIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ClockIcon,
  CalendarIcon,
  DocumentPlusIcon
} from "@heroicons/react/24/outline";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 md:p-8 font-sans antialiased relative overflow-hidden">
      
      {/* Background Glow Effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl w-full relative z-10">
        
        {/* EN-TÊTE */}
        <div className="text-center mb-16">
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

        {/* GRILLE DE NAVIGATION PRINCIPALE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 xl:gap-5">
          
          {/* RENCONTRES NUMÉRIQUES */}
          <Link href="/liste-beneficiaires" className="group bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-indigo-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden active:scale-95">
            <div className="bg-slate-950 border border-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:border-indigo-500 group-hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all duration-300">
              <UsersIcon className="w-5 h-5 text-indigo-400 group-hover:text-white" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-indigo-400 transition-colors">
              Liste des bénéficiaires
            </h2>
            <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">
              Consulter et modifier les fiches existantes
            </p>
          </Link>

          {/* NOUVEAU PROFIL */}
          <Link href="/beneficiaires" className="group bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-emerald-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden active:scale-95">
            <div className="bg-slate-950 border border-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:border-emerald-500 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-300">
              <UserPlusIcon className="w-5 h-5 text-emerald-400 group-hover:text-white" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-emerald-400 transition-colors">
              Créer un bénéficiaire
            </h2>
            <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">
              Enregistrer une nouvelle personne en base
            </p>
          </Link>

          {/* ACTIVITÉS TYPES */}
          <Link href="/activites_types" className="group bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-amber-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden active:scale-95">
            <div className="bg-slate-950 border border-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-amber-600 group-hover:border-amber-500 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all duration-300">
              <CalendarDaysIcon className="w-5 h-5 text-amber-400 group-hover:text-white" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-amber-400 transition-colors">
              Agenda des Médiateurs
            </h2>
            <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">
              Gérer l'équipe et le planning des actions
            </p>
          </Link>

          {/* AGENDA SURESNES */}
          <Link href="/suresnes" className="group bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-teal-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden active:scale-95">
            <div className="bg-slate-950 border border-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-teal-600 group-hover:border-teal-500 group-hover:shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-all duration-300">
              <CalendarIcon className="w-5 h-5 text-teal-400 group-hover:text-white" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-teal-400 transition-colors">
              Agenda Suresnes
            </h2>
            <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">
              Consulter l'agenda du Relais Numérique
            </p>
          </Link>

          {/* ANCIENS ÉMARGEMENTS */}
          <Link href="/emargements" className="group bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-cyan-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden active:scale-95">
            <div className="bg-slate-950 border border-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-cyan-600 group-hover:border-cyan-500 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-300">
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-cyan-400 group-hover:text-white" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-cyan-400 transition-colors">
              Émargements & Doc. internes
            </h2>
            <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">
              Accéder aux feuilles d'émargement Google Docs archivées
            </p>
          </Link>

          {/* GÉNÉRATEUR D'ÉMARGEMENTS AUTOMATIQUE */}
          <Link href="/emargement" className="group bg-slate-900 border border-slate-800/90 rounded-3xl p-5 border-dashed border-emerald-500/30 hover:border-emerald-500 shadow-xl transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden active:scale-95 bg-gradient-to-b from-slate-900 to-emerald-950/20">
            <div className="bg-slate-950 border border-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:border-emerald-500 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-300">
              <DocumentPlusIcon className="w-5 h-5 text-emerald-400 group-hover:text-white" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-emerald-400 transition-colors">
              Générateur d'Émargements
            </h2>
            <p className="text-[10px] text-slate-400 font-medium mt-2 leading-relaxed">
              Éditer de nouvelles feuilles A4 prêtes à imprimer avec logos adaptatifs
            </p>
          </Link>

          {/* ACTIONS COLLECTIVES */}
          <Link href="/actions-collectives" className="group bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-fuchsia-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden active:scale-95">
            <div className="bg-slate-950 border border-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-fuchsia-600 group-hover:border-fuchsia-500 group-hover:shadow-[0_0_20px_rgba(217,70,239,0.4)] transition-all duration-300">
              <UserGroupIcon className="w-5 h-5 text-fuchsia-400 group-hover:text-white" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-fuchsia-400 transition-colors">
              Actions Collectives
            </h2>
            <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">
              Saisir les bilans simplifiés d'ateliers de groupe
            </p>
          </Link>

          {/* VOLUME HORAIRE */}
          <Link href="/volume-horaire" className="group bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-blue-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden active:scale-95">
            <div className="bg-slate-950 border border-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:border-blue-500 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all duration-300">
              <ClockIcon className="w-5 h-5 text-blue-400 group-hover:text-white" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-blue-400 transition-colors">
              Volume Horaire
            </h2>
            <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">
              Analyser le temps de travail et coûts RH
            </p>
          </Link>

          {/* BILAN & STATS */}
          <Link href="/statistiques" className="group bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-purple-500/50 shadow-xl transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden active:scale-95">
            <div className="bg-slate-950 border border-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:border-purple-500 group-hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all duration-300">
              <ChartBarIcon className="w-5 h-5 text-purple-400 group-hover:text-white" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-purple-400 transition-colors">
              Bilan & Stats
            </h2>
            <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">
              Consulter les rapports et indicateurs globaux
            </p>
          </Link>

        </div>

        {/* SECTION DÉDIÉE SURESNES */}
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <BuildingOfficeIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center justify-center md:justify-start gap-2">
                Espace Territorial Suresnes
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Piloter le Relais Numérique : Saisie des plannings quotidiens et édition du bilan d'impact annuel.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <Link 
  href="/suresnes" 
  className="flex-1 md:flex-initial text-center bg-slate-950 hover:bg-purple-950/40 text-purple-400 border border-purple-900/60 hover:border-purple-500 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(147,51,234,0.05)] hover:shadow-[0_0_15px_rgba(147,51,234,0.2)]"
>
  Agenda RN Suresnes
</Link>
            <Link 
              href="/bilan-suresnes" 
              className="flex-1 md:flex-initial text-center bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              Analyse ACTIONS SURESNES
            </Link>
          </div>
        </div>

        {/* FOOTER CLOUD SYSTEM */}
        <footer className="mt-6 bg-gradient-to-r from-slate-900 to-slate-900/40 border border-slate-800/80 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 hidden sm:block">
              <CpuChipIcon className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Infrastructure Cloud</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Les données et la satisfaction sont stockées de manière sécurisée et synchronisées en direct.
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
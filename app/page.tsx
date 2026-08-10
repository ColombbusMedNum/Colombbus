"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Quicksand } from "next/font/google";
import { PermissionGuard } from "@/components/PermissionGuard";
import PageGuard from "@/components/PageGuard";
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
  XMarkIcon,
  ArrowLeftStartOnRectangleIcon,
  LockClosedIcon,
  WrenchScrewdriverIcon,
  MapPinIcon
} from "@heroicons/react/24/outline";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function HomePage() {
  const [activeFolder, setActiveFolder] = useState<"rencontres" | "stats" | null>(null);

  // FONCTION DE DÉCONNEXION
  const handleLogout = () => {
    document.cookie = "session_token=; path=/; max-age=0; SameSite=Lax; Secure";
    document.cookie = "user_role=; path=/; max-age=0; SameSite=Lax; Secure";
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    window.location.href = "/login";
  };

  return (
    <PageGuard pageId="page_access_home">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden font-medium antialiased`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#005259]/5 blur-[140px] rounded-full pointer-events-none"></div>

      {/* BOUTON DÉCONNEXION */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-20">
        <button 
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#EA601F] hover:text-white border border-[#404040]/15 rounded-xl text-[#EA601F] text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 group cursor-pointer"
        >
          <ArrowLeftStartOnRectangleIcon className="w-4 h-4 text-[#EA601F] group-hover:text-white transition-colors" />
          <span>Déconnexion</span>
        </button>
      </div>

      <div className="max-w-7xl w-full relative z-10 flex flex-col items-center justify-center min-h-[80vh]">
        
        {/* EN-TÊTE AVEC LOGO ET TITRE */}
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="mb-3 relative w-16 h-16 md:w-20 md:h-20">
            <Image 
              src="/logos/Logo_Colombbus_noir_trans.png" 
              alt="Logo Colombbus" 
              fill
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase text-[#005259]">
            Colombbus
          </h1>

          <div className="mt-2 flex flex-col items-center gap-1">
            <span className="inline-block px-3 py-1 rounded-full bg-[#EA601F]/10 border border-[#EA601F]/20 text-[#EA601F] text-xs font-black uppercase tracking-widest">
              Plateforme C.O.S.M.O.S.
            </span>
            <p className="text-[11px] md:text-xs text-[#404040]/70 font-semibold tracking-wide max-w-lg mt-0.5">
              Colombbus Outil de Suivi et de Médiation Organisée et Solidaire
            </p>
          </div>

          <p className="text-[#404040]/50 text-[10px] font-bold uppercase tracking-widest mt-2">
            Gestion des bénéficiaires — 2026
          </p>
        </div>

        {/* CONTENEUR PRINCIPAL DE LA NAVIGATION */}
        <div className="w-full max-w-6xl transition-all duration-300">
          
          {!activeFolder ? (
            /* ================= VUE FERMÉE ================= */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full items-stretch">
              
              {/* AGENDA DES MÉDIATEURS PROTECTION */}
              <PermissionGuard
                actionId="home_nav_agenda_med"
                fallback={
                  <div className="group bg-white/60 border border-[#404040]/10 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center min-h-[240px] pointer-events-none select-none opacity-60">
                    <div className="bg-[#F3F3F2] w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-[#404040]/40 border border-[#404040]/10">
                      <LockClosedIcon className="w-7 h-7" />
                    </div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-[#404040]/50">
                      Agenda des Médiateurs
                    </h2>
                    <p className="text-xs text-[#404040]/40 font-medium mt-2 leading-relaxed max-w-[200px]">
                      Accès restreint par l'administrateur
                    </p>
                  </div>
                }
              >
                <Link 
                  href="/agenda" 
                  className="group bg-white border border-[#404040]/10 hover:border-[#005259] rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center text-center active:scale-95 min-h-[240px]"
                >
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 shadow-sm bg-[#F3F3F2] border border-[#404040]/10 text-[#005259] group-hover:bg-[#005259] group-hover:text-white">
                    <CalendarDaysIcon className="w-7 h-7 transition-colors" />
                  </div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F] transition-colors">
                    Agenda des Médiateurs
                  </h2>
                  <p className="text-xs text-[#404040]/70 font-medium mt-2 leading-relaxed max-w-[200px]">
                    Gérer l'équipe et le planning des actions
                  </p>
                </Link>
              </PermissionGuard>

              {/* RENCONTRES NUMÉRIQUES */}
              <button 
                onClick={() => setActiveFolder("rencontres")}
                className="group bg-white border border-[#404040]/10 hover:border-[#EA601F] rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center text-center active:scale-95 min-h-[240px] cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 shadow-sm bg-[#F3F3F2] border border-[#404040]/10 text-[#EA601F] group-hover:bg-[#EA601F] group-hover:text-white">
                  <FolderIcon className="w-7 h-7 transition-colors" />
                </div>
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F] transition-colors">
                  Rencontres Numériques
                </h2>
                <p className="text-xs text-[#404040]/70 font-medium mt-2 leading-relaxed">
                  Bénéficiaires, émargements et ateliers
                </p>
                <div className="mt-4 flex gap-1.5 p-1.5 rounded-lg bg-[#F3F3F2] border border-[#404040]/10">
                  <div className="w-2 h-2 rounded-full bg-[#005259]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#EA601F]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#005259]/40"></div>
                </div>
              </button>

              {/* STATISTIQUES & BILANS */}
              <button 
                onClick={() => setActiveFolder("stats")}
                className="group bg-[#white] border border-[#404040]/10 hover:border-[#005259] rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center text-center active:scale-95 min-h-[240px] cursor-pointer"
              >
                <div className="bg-[#F3F3F2] border border-[#404040]/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 shadow-sm text-[#005259] group-hover:bg-[#005259] group-hover:text-white">
                  <ChartBarIcon className="w-7 h-7 transition-colors" />
                </div>
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F] transition-colors">
                  Statistiques & Bilans
                </h2>
                <p className="text-xs text-[#404040]/70 font-medium mt-2 leading-relaxed">
                  Rapports globaux et impact Suresnes
                </p>
                <div className="mt-4 flex gap-1.5 p-1.5 rounded-lg bg-[#F3F3F2] border border-[#404040]/10">
                  <div className="w-2 h-2 rounded-full bg-[#EA601F]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#005259]"></div>
                </div>
              </button>

            </div>
          ) : activeFolder === "rencontres" ? (
            /* ================= VUE AGRANDIE : RENCONTRES NUMÉRIQUES ================= */
            <div className="bg-white border-2 border-[#EA601F] rounded-[2.5rem] p-6 md:p-8 shadow-md transition-all duration-300 animate-in fade-in zoom-in-95 duration-200 w-full max-w-4xl mx-auto">
              
              <div className="flex justify-between items-center mb-8 border-b border-[#404040]/10 pb-4">
                <div className="flex items-center gap-2">
                  <FolderIcon className="w-5 h-5 text-[#EA601F]" />
                  <span className="text-sm font-extrabold uppercase tracking-wider text-[#EA601F]">
                    Rencontres Numériques
                  </span>
                </div>
                <button 
                  onClick={() => setActiveFolder(null)}
                  className="text-[#404040] hover:bg-[#005259] hover:text-white bg-[#F3F3F2] p-2 rounded-xl border border-[#404040]/10 transition-all flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3 cursor-pointer"
                >
                  <XMarkIcon className="w-4 h-4" /> Fermer
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* LISTE DES BÉNÉFICIAIRES */}
                <Link href="/liste-beneficiaires" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-4 hover:border-[#005259] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white border border-[#404040]/10 text-[#005259] group-hover:bg-[#005259] group-hover:text-white transition-all">
                    <UsersIcon className="w-4 h-4" />
                  </div>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-[#005259]">
                    Liste des bénéficiaires
                  </h2>
                  <p className="text-[9px] text-[#404040]/70 font-medium mt-1 leading-relaxed">
                    Consulter et modifier les fiches existantes
                  </p>
                </Link>

                {/* RENDEZ-VOUS PAR LIEUX */}
                <Link href="/rendez-vous-par-lieu" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-4 hover:border-[#EA601F] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white border border-[#404040]/10 text-[#EA601F] group-hover:bg-[#EA601F] group-hover:text-white transition-all">
                    <MapPinIcon className="w-4 h-4" />
                  </div>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F]">
                    Rendez-vous par lieu
                  </h2>
                  <p className="text-[9px] text-[#404040]/70 font-medium mt-1 leading-relaxed">
                    Consulter et planifier les rendez-vous selon les lieux
                  </p>
                </Link>

                {/* FICHE BILAN */}
                <Link href="/fiches-bilans" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-4 hover:border-[#005259] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white border border-[#404040]/10 text-[#005259] group-hover:bg-[#005259] group-hover:text-white transition-all">
                    <ClipboardDocumentCheckIcon className="w-4 h-4" />
                  </div>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-[#005259]">
                    Fiche Bilan
                  </h2>
                  <p className="text-[9px] text-[#404040]/70 font-medium mt-1 leading-relaxed">
                    Accéder aux fiches de synthèses et bilans
                  </p>
                </Link>

                {/* BILAN TECH */}
                <Link href="/bilan_tech" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-4 hover:border-[#EA601F] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white border border-[#404040]/10 text-[#EA601F] group-hover:bg-[#EA601F] group-hover:text-white transition-all">
                    <WrenchScrewdriverIcon className="w-4 h-4" />
                  </div>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F]">
                    Bilan Tech
                  </h2>
                  <p className="text-[9px] text-[#404040]/70 font-medium mt-1 leading-relaxed">
                    Effectuer et suivre les bilans techniques
                  </p>
                </Link>

                {/* SUIVI DES COLLECTES TECH */}
                <Link href="/suivi-collecte" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-4 hover:border-[#005259] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white border border-[#404040]/10 text-[#005259] group-hover:bg-[#005259] group-hover:text-white transition-all">
                    <CpuChipIcon className="w-4 h-4" />
                  </div>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-[#005259]">
                    Suivi Collectes Tech
                  </h2>
                  <p className="text-[9px] text-[#404040]/70 font-medium mt-1.5 leading-relaxed">
                    Tableau d'activité synchrone type Excel / IdF
                  </p>
                </Link>

                {/* AGENDA SURESNES INTERACTIF PROTECTION */}
                <PermissionGuard
                  actionId="home_nav_agenda_suresnes"
                  fallback={
                    <div className="bg-[#F3F3F2]/50 border border-[#404040]/10 rounded-2xl p-4 flex flex-col items-center text-center pointer-events-none select-none opacity-50">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white text-[#404040]/40">
                        <LockClosedIcon className="w-4 h-4" />
                      </div>
                      <h2 className="text-[11px] font-bold uppercase tracking-wide text-[#404040]/50">
                        Agenda Suresnes
                      </h2>
                      <p className="text-[9px] text-[#404040]/40 font-medium mt-1 leading-relaxed">
                        Accès restreint
                      </p>
                    </div>
                  }
                >
                  <Link href="/suresnes" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-4 hover:border-[#EA601F] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white border border-[#404040]/10 text-[#EA601F] group-hover:bg-[#EA601F] group-hover:text-white transition-all">
                      <CalendarIcon className="w-4 h-4" />
                    </div>
                    <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F]">
                      Agenda Suresnes
                    </h2>
                    <p className="text-[9px] text-[#404040]/70 font-medium mt-1 leading-relaxed">
                      Consulter l'agenda du Relais Numérique
                    </p>
                  </Link>
                </PermissionGuard>

                {/* ÉMARGEMENTS & DOC. INTERNES */}
                <Link href="/emargements" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-4 hover:border-[#005259] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white border border-[#404040]/10 text-[#005259] group-hover:bg-[#005259] group-hover:text-white transition-all">
                    <ClipboardDocumentCheckIcon className="w-4 h-4" />
                  </div>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-[#005259]">
                    Émargements & Doc. internes
                  </h2>
                  <p className="text-[9px] text-[#404040]/70 font-medium mt-1 leading-relaxed">
                    Accéder aux feuilles archivées
                  </p>
                </Link>

                {/* GÉNÉRATEUR D'ÉMARGEMENTS */}
                <Link href="/emargement" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-4 hover:border-[#EA601F] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white border border-[#404040]/10 text-[#EA601F] group-hover:bg-[#EA601F] group-hover:text-white transition-all">
                    <DocumentPlusIcon className="w-4 h-4" />
                  </div>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F]">
                    Générateur d'Émargements
                  </h2>
                  <p className="text-[9px] text-[#404040]/70 font-medium mt-1 leading-relaxed">
                    Éditer de nouvelles feuilles A4 prêtes à imprimer
                  </p>
                </Link>

                {/* ACTIONS COLLECTIVES */}
                <Link href="/actions-collectives" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-4 hover:border-[#005259] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white border border-[#404040]/10 text-[#005259] group-hover:bg-[#005259] group-hover:text-white transition-all">
                    <UserGroupIcon className="w-4 h-4" />
                  </div>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-[#005259]">
                    Actions Collectives
                  </h2>
                  <p className="text-[9px] text-[#404040]/70 font-medium mt-1 leading-relaxed">
                    Saisir les bilans simplifiés d'ateliers
                  </p>
                </Link>

              </div>
            </div>
          ) : (
            /* ================= VUE AGRANDIE : STATISTIQUES & BILANS ================= */
            <div className="bg-white border-2 border-[#005259] rounded-[2.5rem] p-6 md:p-8 shadow-md transition-all duration-300 animate-in fade-in zoom-in-95 duration-200 max-w-4xl mx-auto w-full">
              <div className="flex justify-between items-center mb-8 border-b border-[#404040]/10 pb-4">
                <div className="flex items-center gap-2">
                  <ChartBarIcon className="w-5 h-5 text-[#005259]" />
                  <span className="text-sm font-extrabold uppercase tracking-wider text-[#005259]">
                    Statistiques & Analyses d'Impact
                  </span>
                </div>
                <button 
                  onClick={() => setActiveFolder(null)}
                  className="text-[#404040] hover:bg-[#005259] hover:text-white bg-[#F3F3F2] p-2 rounded-xl border border-[#404040]/10 transition-all flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3 cursor-pointer"
                >
                  <XMarkIcon className="w-4 h-4" /> Fermer
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* STATS GLOBALES */}
                <Link href="/statistiques" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-5 hover:border-[#EA601F] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="bg-white border border-[#404040]/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-[#EA601F] group-hover:bg-[#EA601F] group-hover:text-white transition-all">
                    <ChartBarIcon className="w-5 h-5" />
                  </div>
                  <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F]">
                    Bilan & Stats Globaux
                  </h2>
                  <p className="text-[10px] text-[#404040]/70 font-medium mt-1.5 leading-relaxed">
                    Consulter les rapports et indicateurs transversaux de la plateforme
                  </p>
                </Link>

                {/* STATS SURESNES */}
                <Link href="/bilan-suresnes" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-5 hover:border-[#005259] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="bg-[#white] border border-[#404040]/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-[#005259] group-hover:bg-[#005259] group-hover:text-white transition-all">
                    <BuildingOfficeIcon className="w-5 h-5" />
                  </div>
                  <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">
                    Analyse Actions Suresnes
                  </h2>
                  <p className="text-[10px] text-[#404040]/70 font-medium mt-1.5 leading-relaxed">
                    Édition et étude du bilan d'impact annuel du Relais Numérique
                  </p>
                </Link>

                {/* VOLUME HORAIRE */}
                <Link href="/volume-horaire" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-5 hover:border-[#EA601F] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                  <div className="bg-white border border-[#404040]/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-[#EA601F] group-hover:bg-[#EA601F] group-hover:text-white transition-all">
                    <ClockIcon className="w-5 h-5" />
                  </div>
                  <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F]">
                    Volume Horaire
                  </h2>
                  <p className="text-[10px] text-[#404040]/70 font-medium mt-1.5 leading-relaxed">
                    Analyser le temps de travail et coûts RH
                  </p>
                </Link>

                {/* GESTION DES DROITS (Reservé aux admins) */}
                <PermissionGuard actionId="home_nav_admin_droits">
                  <Link href="/analyse" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-5 hover:border-[#005259] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
                    <div className="bg-white border border-[#404040]/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-[#005259] group-hover:bg-[#005259] group-hover:text-white transition-all">
                      <CpuChipIcon className="w-5 h-5" />
                    </div>
                    <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">
                      Gérer les Droits
                    </h2>
                    <p className="text-[10px] text-[#404040]/70 font-medium mt-1.5 leading-relaxed">
                      Matrice de sécurité et modification des rôles de l'équipe
                    </p>
                  </Link>
                </PermissionGuard>
              </div>
            </div>
          )}
          
        </div>

        {/* FOOTER CLOUD SYSTEM */}
        <footer className="mt-12 w-full max-w-4xl bg-white border border-[#404040]/10 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="p-3 bg-[#F3F3F2] rounded-2xl border border-[#404040]/10 hidden sm:block text-[#005259]">
              <CpuChipIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005259]">Infrastructure Cloud C.O.S.M.O.S.</h3>
              <p className="text-xs text-[#404040]/70 font-medium mt-0.5">
                Les données sont stockées de manière sécurisée et synchronisées en direct.
              </p>
            </div>
          </div>
          <div className="flex items-center bg-[#F3F3F2] px-5 py-3 rounded-2xl border border-[#404040]/10">
            <div className="text-center sm:text-right">
              <span className="block text-sm font-black uppercase tracking-tight italic text-[#005259]">
                Colombbus
              </span>
              <span className="text-[9px] uppercase tracking-widest font-bold text-[#EA601F] block mt-0.5">
                Médiation Numérique
              </span>
            </div>
          </div>
        </footer>

      </div>
    </main>
    </PageGuard>
  );
}
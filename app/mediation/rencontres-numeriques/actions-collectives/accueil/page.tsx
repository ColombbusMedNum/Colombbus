"use client";

import Link from "next/link";
import { Quicksand } from "next/font/google";
import {
  HomeIcon,
  ArrowLeftIcon,
  DocumentPlusIcon,
  ClipboardDocumentCheckIcon,
  CpuChipIcon,
  RocketLaunchIcon,
  BriefcaseIcon
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function ActionsCollectivesAccueilPage() {
  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
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
                Actions <span className="text-[#EA601F] font-semibold">Collectives</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Inscriptions, réponses et programmes collectifs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link
              href="/mediation/rencontres-numeriques/actions-collectives"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Suivi des ateliers</span>
            </Link>

            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>
        </div>

        {/* TUILES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          <Link href="/mediation/rencontres-numeriques/actions-collectives/inscription" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-5 hover:border-[#005259] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
            <div className="bg-white border border-[#404040]/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-[#005259] group-hover:bg-[#005259] group-hover:text-white transition-all">
              <DocumentPlusIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">
              Formulaire d'inscription
            </h2>
            <p className="text-[10px] text-[#404040]/70 font-medium mt-1.5 leading-relaxed">
              Inscription aux ateliers collectifs
            </p>
          </Link>

          <Link href="/mediation/rencontres-numeriques/actions-collectives/reponses" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-5 hover:border-[#005259] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
            <div className="bg-white border border-[#404040]/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-[#005259] group-hover:bg-[#005259] group-hover:text-white transition-all">
              <ClipboardDocumentCheckIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">
              Réponses au formulaire
            </h2>
            <p className="text-[10px] text-[#404040]/70 font-medium mt-1.5 leading-relaxed">
              Consultation des inscriptions reçues
            </p>
          </Link>

          <Link href="/mediation/rencontres-numeriques/actions-collectives/numerik-up" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-5 hover:border-[#EA601F] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
            <div className="bg-white border border-[#404040]/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-[#EA601F] group-hover:bg-[#EA601F] group-hover:text-white transition-all">
              <CpuChipIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">
              Numérik'UP
            </h2>
            <p className="text-[10px] text-[#404040]/70 font-medium mt-1.5 leading-relaxed">
              Programme Numérik'UP
            </p>
          </Link>

          <Link href="/mediation/rencontres-numeriques/actions-collectives/digital-up" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-5 hover:border-[#EA601F] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
            <div className="bg-white border border-[#404040]/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-[#EA601F] group-hover:bg-[#EA601F] group-hover:text-white transition-all">
              <RocketLaunchIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">
              Digital'UP
            </h2>
            <p className="text-[10px] text-[#404040]/70 font-medium mt-1.5 leading-relaxed">
              Programme Digital'UP
            </p>
          </Link>

          <Link href="/mediation/rencontres-numeriques/actions-collectives/numerik-up-pro" className="group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-5 hover:border-[#005259] hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95">
            <div className="bg-white border border-[#404040]/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-[#005259] group-hover:bg-[#005259] group-hover:text-white transition-all">
              <BriefcaseIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">
              Numérik'UP Pro
            </h2>
            <p className="text-[10px] text-[#404040]/70 font-medium mt-1.5 leading-relaxed">
              Programme Numérik'UP Pro
            </p>
          </Link>

        </div>

      </div>
    </main>
    </PageGuard>
  );
}

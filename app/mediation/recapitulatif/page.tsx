"use client";

import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import RecapTuiles from "@/components/RecapTuiles";

export default function RecapitulatifPage() {
  return (
    <PageGuard pageId="page_access_recapitulatif">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-3xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Récapitul<span className="text-[#EA601F] font-semibold">atif</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Tout ce que contient chaque dossier de la page d'accueil</p>
              </div>
            </div>
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm w-fit">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-[#005259]">
              <Squares2X2Icon className="w-5 h-5 text-[#EA601F]" />
              <h2 className="text-sm font-bold uppercase tracking-wide">Vue d'ensemble</h2>
            </div>
            <p className="text-[11px] text-[#404040]/60 leading-relaxed">
              Clique un titre pour déplier son contenu.
            </p>
            <RecapTuiles />
          </div>
        </div>
      </main>
    </PageGuard>
  );
}

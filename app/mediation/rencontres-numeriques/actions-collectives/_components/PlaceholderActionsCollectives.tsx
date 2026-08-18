"use client";

import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Coquille commune aux pages Actions Collectives pas encore développées
// (formulaire d'inscription, réponses, Numérik'UP, Digital'UP, Numérik'UP
// Pro) — évite de dupliquer 5 fois le même habillage de page.
export default function PlaceholderActionsCollectives({
  titre,
  sousTitre,
  retourHref = "/mediation/rencontres-numeriques/actions-collectives/accueil",
  retourLabel = "Actions Collectives",
}: {
  titre: string;
  sousTitre: string;
  retourHref?: string;
  retourLabel?: string;
}) {
  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-medium antialiased`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10 text-center space-y-6">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-[#005259]">{titre}</h1>
          <p className="text-xs text-[#404040]/70 font-medium mt-2">{sousTitre}</p>
        </div>

        <div className="bg-white border border-dashed border-[#404040]/20 rounded-2xl p-10 text-xs font-bold uppercase tracking-widest text-[#404040]/40">
          Contenu à venir
        </div>

        <div className="flex justify-center flex-wrap gap-2">
          <Link
            href={retourHref}
            className="inline-flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
          >
            <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
            <span>{retourLabel}</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
          >
            <HomeIcon className="w-4 h-4 text-[#EA601F]" />
            <span>Accueil</span>
          </Link>
        </div>
      </div>
    </main>
    </PageGuard>
  );
}

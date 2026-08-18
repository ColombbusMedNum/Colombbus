"use client";

import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, ArrowLeftIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Page Actions Collectives affichant un Google Form public (lien "viewform",
// jamais le lien "/edit" du propriétaire) intégré en iframe, avec un lien de
// secours pour l'ouvrir dans un nouvel onglet si l'affichage intégré pose
// problème.
export default function FormulaireEmbed({
  titre,
  sousTitre,
  formUrl,
  retourHref = "/mediation/rencontres-numeriques/actions-collectives/accueil",
  retourLabel = "Actions Collectives",
}: {
  titre: string;
  sousTitre: string;
  formUrl: string;
  retourHref?: string;
  retourLabel?: string;
}) {
  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-3xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">{titre}</h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">{sousTitre}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link
              href={retourHref}
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>{retourLabel}</span>
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

        <a
          href={formUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#EA601F] hover:underline uppercase tracking-wide"
        >
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          Ouvrir le formulaire dans un nouvel onglet
        </a>

        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <iframe
            src={formUrl}
            className="w-full"
            style={{ height: "80vh", minHeight: 640 }}
            title={titre}
          >
            Chargement du formulaire…
          </iframe>
        </div>

      </div>
    </main>
    </PageGuard>
  );
}

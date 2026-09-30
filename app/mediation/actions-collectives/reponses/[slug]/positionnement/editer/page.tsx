"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import EditeurPositionnement from "@/components/EditeurPositionnement";

export default function EditerPositionnementActionDynamiquePage() {
  const { slug } = useParams<{ slug: string }>();
  const { role, loading } = usePermissions();

  if (loading) {
    return <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>Chargement...</div>;
  }
  if (role !== "admin") {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-center p-8 antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#EF736A]">Page réservée à l'administrateur</p>
        <Link href={`/mediation/actions-collectives/reponses/${slug}/positionnement`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
          <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
          <span>Retour</span>
        </Link>
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_action_dynamique">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-4xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Éditer le <span className="text-[#EA601F] font-semibold">test de positionnement</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Sections et questions</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <Link href={`/mediation/actions-collectives/reponses/${slug}/positionnement`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Résultats</span>
              </Link>
              <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

          <EditeurPositionnement programmeId={slug} />
        </div>
      </main>
    </PageGuard>
  );
}

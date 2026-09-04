"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import {
  HomeIcon,
  ArrowLeftIcon,
  ClockIcon,
  PlusCircleIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import PageGuard from "@/components/PageGuard";

interface EvenementHistorique {
  id: string;
  type: "creation" | "suppression";
  date: string;
  moment: string;
  mediatId?: string;
  mediateurNom: string;
  lieu: string;
  auteurUid?: string;
  auteurNom: string;
  horodatage: number;
}

// Journal des créations/suppressions de créneaux dans l'agenda ("qui a
// positionné quoi") — alimenté par processActionCreation et
// confirmDeleteAction dans app/agenda/page.tsx. Ne couvre pas le
// réordonnancement visuel de plusieurs actions au sein d'une même case
// (champ "ordre"), qui ne change ni la personne ni le créneau concerné.
export default function HistoriqueAgendaPage() {
  const [evenements, setEvenements] = useState<EvenementHistorique[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreType, setFiltreType] = useState<"tous" | "creation" | "suppression">("tous");
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    const q = query(collection(db, "historique_agenda"), orderBy("horodatage", "desc"), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      setEvenements(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    }, (error) => {
      console.error("Erreur de chargement de l'historique :", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const evenementsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return evenements.filter((e) => {
      if (filtreType !== "tous" && e.type !== filtreType) return false;
      if (!q) return true;
      return (
        (e.mediateurNom || "").toLowerCase().includes(q) ||
        (e.lieu || "").toLowerCase().includes(q) ||
        (e.auteurNom || "").toLowerCase().includes(q)
      );
    });
  }, [evenements, filtreType, recherche]);

  const formatHorodatage = (ts: number) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const formatDateCreneau = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <PageGuard pageId="page_access_agenda_historique">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#EA601F] rounded-full shadow-[0_0_15px_rgba(234,96,31,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-black uppercase text-[#005259] tracking-tight">
                Historique de l'<span className="text-[#EA601F] font-bold">Agenda</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 flex items-center gap-1.5 font-medium">
                <ClockIcon className="w-3.5 h-3.5 text-[#EA601F]" />
                Qui a positionné ou supprimé un créneau, et quand
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/agenda"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span className="hidden sm:inline">Retour à l'Agenda</span>
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

        {/* FILTRES */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-4 h-4 text-[#404040]/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un médiateur, un lieu, un auteur..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#404040]/15 focus:border-[#005259] rounded-xl text-xs text-[#404040] placeholder-[#404040]/40 outline-none shadow-sm font-medium transition-colors"
            />
          </div>
          <div className="flex gap-1.5 bg-white border border-[#404040]/10 rounded-xl p-1 shadow-sm">
            {([
              { id: "tous", label: "Tout" },
              { id: "creation", label: "Créations" },
              { id: "suppression", label: "Suppressions" },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFiltreType(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  filtreType === opt.id ? "bg-[#005259] text-white" : "text-[#404040]/60 hover:bg-[#F3F3F2]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* LISTE */}
        {loading ? (
          <div className="text-center py-16 text-[#EA601F] font-bold text-xs animate-pulse uppercase tracking-widest">
            Chargement de l'historique...
          </div>
        ) : (
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-[#F3F3F2]">
            {evenementsFiltres.length === 0 ? (
              <div className="text-center py-16 text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                🔍 Aucun événement ne correspond.
              </div>
            ) : (
              evenementsFiltres.map((e) => (
                <div key={e.id} className="flex items-start gap-3 p-4 hover:bg-[#F3F3F2]/60 transition-colors">
                  <div className={`p-2 rounded-xl shrink-0 ${e.type === "creation" ? "bg-[#A9E0C9]/25 text-[#005259]" : "bg-rose-500/10 text-rose-600"}`}>
                    {e.type === "creation" ? <PlusCircleIcon className="w-4 h-4" /> : <TrashIcon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
                      <span className="font-bold text-[#005259]">{e.auteurNom || "Utilisateur inconnu"}</span>
                      <span className="text-[#404040]/70">
                        {e.type === "creation" ? "a positionné" : "a supprimé"}
                      </span>
                      <span className="font-bold text-[#EA601F]">{e.lieu || "Activité"}</span>
                      <span className="text-[#404040]/70">pour</span>
                      <span className="font-bold text-[#404040]">{e.mediateurNom || "?"}</span>
                    </div>
                    <p className="text-[11px] text-[#404040]/60 mt-1">
                      Créneau du <span className="font-semibold">{formatDateCreneau(e.date)}</span> ({e.moment})
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-[#404040]/50 shrink-0 text-right whitespace-nowrap">
                    {formatHorodatage(e.horodatage)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <p className="text-center text-[10px] text-[#404040]/40 uppercase tracking-wider">
          {evenements.length >= 500 ? "500 événements les plus récents affichés" : `${evenements.length} événement(s) au total`}
        </p>

      </div>
    </main>
    </PageGuard>
  );
}

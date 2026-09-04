"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, Timestamp } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ExclamationTriangleIcon, TrashIcon, CheckCircleIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { useConfirm } from "@/components/ConfirmProvider";

interface Signalement {
  id: string;
  url: string;
  description: string;
  auteurEmail?: string;
  createdAt?: Timestamp;
  traite: boolean;
  captureUrl?: string | null;
}

// Liste des signalements envoyés via le bouton "B" (voir
// components/BugReportButton.tsx) — réservée aux admins, comme l'envoi.
export default function SignalementsPage() {
  const confirm = useConfirm();
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<"tous" | "a_traiter" | "traites">("a_traiter");

  useEffect(() => {
    const q = query(collection(db, "signalements"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSignalements(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setLoading(false);
      },
      (err) => {
        console.error("Erreur de chargement des signalements :", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const signalementsFiltres = useMemo(() => {
    return signalements.filter((s) => {
      if (filtre === "a_traiter") return !s.traite;
      if (filtre === "traites") return s.traite;
      return true;
    });
  }, [signalements, filtre]);

  const toggleTraite = async (s: Signalement) => {
    try {
      await updateDoc(doc(db, "signalements", s.id), { traite: !s.traite });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (s: Signalement) => {
    if (!(await confirm("Supprimer définitivement ce signalement ?"))) return;
    try {
      await deleteDoc(doc(db, "signalements", s.id));
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (ts?: Timestamp) =>
    ts ? ts.toDate().toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#EA601F] font-bold animate-pulse text-xs uppercase tracking-widest`}>
        Chargement des signalements...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_signalements">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-5xl mx-auto relative z-10 space-y-6">
          {/* HEADER */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
                title="Retour à l'accueil"
              >
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
              <div className="flex items-center gap-3">
                <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
                <div>
                  <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                    Signalements <span className="text-[#EA601F] font-normal">de Bugs</span>
                  </h1>
                  <p className="text-xs text-[#404040]/70 mt-0.5">
                    Problèmes remontés via le bouton « B »
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FILTRES */}
          <div className="flex items-center gap-1 bg-white border border-[#404040]/10 rounded-xl p-1 w-fit shadow-sm">
            {([
              { id: "a_traiter", label: "À traiter" },
              { id: "traites", label: "Traités" },
              { id: "tous", label: "Tous" },
            ] as const).map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltre(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  filtre === f.id ? "bg-[#005259] text-white" : "text-[#404040]/70 hover:text-[#005259]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* LISTE */}
          <div className="space-y-3">
            {signalementsFiltres.length === 0 ? (
              <div className="text-center py-16 border border-[#404040]/10 rounded-2xl bg-white shadow-sm">
                <p className="text-[#404040]/60 text-xs font-bold uppercase tracking-wider">Aucun signalement.</p>
              </div>
            ) : (
              signalementsFiltres.map((s) => (
                <div
                  key={s.id}
                  className={`bg-white border rounded-2xl p-4 shadow-sm space-y-2 ${s.traite ? "border-[#404040]/10 opacity-60" : "border-[#F9945D]/40"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#404040]/50">
                      {!s.traite && <ExclamationTriangleIcon className="w-3.5 h-3.5 text-[#EA601F]" />}
                      {formatDate(s.createdAt)}
                      {s.auteurEmail && <span className="text-[#005259]">— {s.auteurEmail}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggleTraite(s)}
                        title={s.traite ? "Marquer à traiter" : "Marquer comme traité"}
                        className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                          s.traite ? "bg-[#005259]/10 border-[#005259]/30 text-[#005259]" : "bg-[#F3F3F2] border-[#404040]/10 text-[#404040]/60 hover:text-[#005259]"
                        }`}
                      >
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        title="Supprimer"
                        className="p-1.5 rounded-lg bg-[#F3F3F2] border border-[#404040]/10 text-[#404040]/60 hover:text-[#EF736A] cursor-pointer transition-colors"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-[#404040] whitespace-pre-wrap">{s.description}</p>
                  {s.captureUrl && (
                    <a href={s.captureUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={s.captureUrl}
                        alt="Capture d'écran jointe"
                        className="max-h-48 rounded-lg border border-[#404040]/15 hover:border-[#005259]/40 transition-colors"
                      />
                    </a>
                  )}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-mono text-[#404040]/50 hover:text-[#EA601F] break-all"
                  >
                    <ArrowTopRightOnSquareIcon className="w-3 h-3 shrink-0" />
                    {s.url}
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </PageGuard>
  );
}

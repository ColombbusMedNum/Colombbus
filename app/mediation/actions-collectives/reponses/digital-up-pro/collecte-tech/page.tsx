"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, ArrowDownTrayIcon, WrenchScrewdriverIcon, LinkIcon, ClipboardDocumentCheckIcon, XMarkIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { QUESTIONS_COLLECTE_TECH, SCORE_MAX_COLLECTE_TECH } from "@/lib/collecteTechQuiz";

interface ResultatCollecteTech {
  id: string;
  Nom?: string;
  Prénom?: string;
  Téléphone?: string;
  Email?: string;
  Score?: number;
  Profil?: string;
  Réponses?: Record<string, number>;
  createdAt?: { toDate: () => Date } | null;
}

function formaterDate(createdAt?: { toDate: () => Date } | null): string {
  if (!createdAt) return "—";
  try {
    return createdAt.toDate().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

// Liste des résultats du diagnostic Collecte Tech, rempli en autonomie par
// les candidat·e·s (voir app/inscription/digital-up-pro-collecte-tech) —
// enregistrements autonomes, sans lien automatique avec une pré-inscription.
export default function CollecteTechDigitalUpProResultatsPage() {
  const [resultats, setResultats] = useState<ResultatCollecteTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOuvert, setDetailOuvert] = useState<ResultatCollecteTech | null>(null);
  const [lienCopie, setLienCopie] = useState(false);
  const [origine, setOrigine] = useState("");
  useEffect(() => { setOrigine(window.location.origin); }, []);
  const lienPublic = `${origine}/inscription/digital-up-pro-collecte-tech`;
  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(lienPublic);
      setLienCopie(true);
      setTimeout(() => setLienCopie(false), 2000);
    } catch (error) {
      console.error("Erreur lors de la copie du lien :", error);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "resultats_collecte_tech_digitaluppro"), orderBy("createdAt", "desc")),
      (snap) => {
        setResultats(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ResultatCollecteTech)));
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const exporterCSV = () => {
    if (resultats.length === 0) return;
    const headers = "Nom;Prénom;Téléphone;Email;Score;Profil;Date\n";
    const rows = resultats.map((r) =>
      [r.Nom, r.Prénom, formatPhoneNumber(r.Téléphone), r.Email, r.Score, r.Profil, formaterDate(r.createdAt)]
        .map((champ) => String(champ ?? "").replace(/;/g, ",").replace(/\n/g, " "))
        .join(";")
    );
    const blob = new Blob([headers + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "collecte_tech_digitalup96h.csv");
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-5xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Diagnostic <span className="text-[#EA601F] font-normal">Collecte Tech</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5">{resultats.length} résultat{resultats.length > 1 ? "s" : ""} reçu{resultats.length > 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={exporterCSV}
                disabled={resultats.length === 0}
                className="flex items-center gap-2 bg-[#005259] hover:bg-[#EA601F] text-white px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                <span>Exporter (.csv)</span>
              </button>
              <Link
                href="/mediation/actions-collectives/reponses/digital-up-pro"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Préinscriptions</span>
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

          <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-sm">
            <LinkIcon className="w-4 h-4 text-[#EA601F] shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#005259] shrink-0">Lien public du diagnostic :</span>
            <code className="flex-1 min-w-0 truncate text-xs font-mono text-[#404040] bg-[#F3F3F2] px-3 py-1.5 rounded-lg">{lienPublic}</code>
            <button
              onClick={copierLien}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#005259] hover:bg-[#EA601F] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
            >
              <ClipboardDocumentCheckIcon className="w-4 h-4" />
              <span>{lienCopie ? "Copié !" : "Copier"}</span>
            </button>
          </div>

          {resultats.length > 0 ? (
            <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                      <th className="px-4 py-3">Identité</th>
                      <th className="px-4 py-3 hidden md:table-cell">Contact</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3">Profil</th>
                      <th className="px-4 py-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]/5">
                    {resultats.map((r) => (
                      <tr key={r.id} onClick={() => setDetailOuvert(r)} className="hover:bg-[#F3F3F2]/60 transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="font-bold text-[#005259] uppercase">{r.Nom || "—"}</div>
                          <div className="text-[#404040]/70">{r.Prénom || "—"}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-[#404040]">
                          <div>{formatPhoneNumber(r.Téléphone)}</div>
                          <div className="text-[#404040]/60">{r.Email || "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-[#005259]">{r.Score ?? "—"}/{SCORE_MAX_COLLECTE_TECH}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                            (r.Score ?? 0) > 30 ? "bg-[#A9E0C9]/40 text-[#005259]" : (r.Score ?? 0) > 14 ? "bg-[#F9C44E]/25 text-[#8a6d1a]" : "bg-[#EF736A]/15 text-[#C0392B]"
                          }`}>
                            <WrenchScrewdriverIcon className="w-3.5 h-3.5" />
                            {r.Profil || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[#404040]/70">{formaterDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
              Aucun résultat pour le moment.
            </div>
          )}
        </div>
      </main>

      {/* DÉTAIL DES RÉPONSES */}
      {detailOuvert && (
        <div className="fixed inset-0 bg-[#005259]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setDetailOuvert(null)}>
          <div
            className={`${quicksand.className} bg-white border border-[#404040]/10 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#404040]/10">
              <div>
                <h2 className="text-lg font-black uppercase text-[#005259] tracking-tight">
                  {detailOuvert.Prénom} <span className="text-[#404040]">{detailOuvert.Nom}</span>
                </h2>
                <p className="text-xs text-[#404040]/60 mt-0.5">{detailOuvert.Email || "—"} — {formatPhoneNumber(detailOuvert.Téléphone)}</p>
                <div className="inline-flex items-center gap-2 mt-2 bg-[#F3F3F2] rounded-xl px-3 py-1.5">
                  <span className="text-sm font-black text-[#005259]">{detailOuvert.Score ?? "—"}/{SCORE_MAX_COLLECTE_TECH}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#EA601F]">{detailOuvert.Profil}</span>
                </div>
              </div>
              <button type="button" onClick={() => setDetailOuvert(null)} className="p-2 rounded-xl bg-[#F3F3F2] hover:bg-[#EF736A] hover:text-white text-[#404040]/60 transition-colors cursor-pointer shrink-0">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {QUESTIONS_COLLECTE_TECH.map((q, index) => {
                const indexReponse = detailOuvert.Réponses?.[q.id];
                const reponse = indexReponse !== undefined ? q.options[indexReponse] : undefined;
                const correct = (reponse?.points ?? 0) > 0;
                return (
                  <div key={q.id} className="border border-[#404040]/10 rounded-xl p-3">
                    <p className="text-xs font-bold text-[#005259]">{index + 1}. {q.question}</p>
                    <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${correct ? "text-[#005259]" : "text-[#C0392B]"}`}>
                      {reponse ? (correct ? <CheckCircleIcon className="w-4 h-4 shrink-0" /> : <XCircleIcon className="w-4 h-4 shrink-0" />) : null}
                      <span>{reponse?.text || "Pas de réponse"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </PageGuard>
  );
}

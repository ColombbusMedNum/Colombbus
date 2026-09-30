"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, ArrowDownTrayIcon, HeartIcon, LinkIcon, ClipboardDocumentCheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { ConfigSatisfaction, ItemSatisfaction, ReponsesSatisfaction } from "@/lib/satisfaction";

interface ResultatSatisfaction {
  id: string;
  Email?: string;
  Réponses?: ReponsesSatisfaction;
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

// Liste des réponses à un questionnaire de satisfaction (voir
// lib/satisfaction.ts et components/FormulaireSatisfaction.tsx) — pas de
// notation ni de correction (contrairement au test de positionnement),
// simple consultation réponse par réponse.
export default function SatisfactionResultats({ programmeId, basePath, lienPublic }: { programmeId: string; basePath: string; lienPublic: string }) {
  const [config, setConfig] = useState<ConfigSatisfaction | null>(null);
  const [resultats, setResultats] = useState<ResultatSatisfaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOuvert, setDetailOuvert] = useState<ResultatSatisfaction | null>(null);
  const [lienCopie, setLienCopie] = useState(false);

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
    getDoc(doc(db, "satisfaction", programmeId)).then((snap) => setConfig(snap.exists() ? (snap.data() as ConfigSatisfaction) : null));
  }, [programmeId]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "satisfaction", programmeId, "resultats"), orderBy("createdAt", "desc")),
      (snap) => {
        setResultats(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ResultatSatisfaction)));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [programmeId]);

  const exporterCSV = () => {
    if (resultats.length === 0 || !config) return;
    const tousLesItems = config.sections.flatMap((s) => s.items).filter((it) => it.type !== "texte_intro");
    const headers = ["Email", ...tousLesItems.map((it) => it.enonce || it.id), "Date"].join(";");
    const rows = resultats.map((r) =>
      [r.Email, ...tousLesItems.map((it) => { const v = r.Réponses?.[it.id]; return Array.isArray(v) ? v.join(", ") : v; }), formaterDate(r.createdAt)]
        .map((champ) => String(champ ?? "").replace(/;/g, ",").replace(/\n/g, " "))
        .join(";")
    );
    const blob = new Blob([headers + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `satisfaction_${programmeId}.csv`);
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
                  Questionnaire de <span className="text-[#EA601F] font-normal">satisfaction</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5">{resultats.length} réponse{resultats.length > 1 ? "s" : ""} reçue{resultats.length > 1 ? "s" : ""}</p>
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
              <Link href={`${basePath}/satisfaction/editer`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <HeartIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Éditer les questions</span>
              </Link>
              <Link href={basePath} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Préinscriptions</span>
              </Link>
              <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-sm">
            <LinkIcon className="w-4 h-4 text-[#EA601F] shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#005259] shrink-0">Lien public du questionnaire :</span>
            <code className="flex-1 min-w-0 truncate text-xs font-mono text-[#404040] bg-[#F3F3F2] px-3 py-1.5 rounded-lg">{lienPublic}</code>
            <button onClick={copierLien} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#005259] hover:bg-[#EA601F] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0">
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
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]/5">
                    {resultats.map((r) => (
                      <tr key={r.id} onClick={() => setDetailOuvert(r)} className="hover:bg-[#F3F3F2]/60 transition-colors cursor-pointer">
                        <td className="px-4 py-3 font-bold text-[#005259]">{r.Email || "—"}</td>
                        <td className="px-4 py-3 text-right text-[#404040]/70">{formaterDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
              Aucune réponse pour le moment.
            </div>
          )}
        </div>
      </main>

      {detailOuvert && config && (
        <div className="fixed inset-0 bg-[#005259]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setDetailOuvert(null)}>
          <div
            className={`${quicksand.className} bg-white border border-[#404040]/10 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#404040]/10">
              <div>
                <h2 className="text-lg font-black uppercase text-[#005259] tracking-tight">{detailOuvert.Email}</h2>
                <p className="text-xs text-[#404040]/60 mt-0.5">{formaterDate(detailOuvert.createdAt)}</p>
              </div>
              <button type="button" onClick={() => setDetailOuvert(null)} className="p-2 rounded-xl bg-[#F3F3F2] hover:bg-[#EF736A] hover:text-white text-[#404040]/60 transition-colors cursor-pointer shrink-0">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {config.sections.map((section) => {
              const items = section.items.filter((it) => it.type !== "texte_intro" && detailOuvert.Réponses?.[it.id] !== undefined);
              if (items.length === 0) return null;
              return (
                <div key={section.id} className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#005259]">{section.titre}</p>
                  {items.map((item) => {
                    const reponse = detailOuvert.Réponses?.[item.id];
                    return (
                      <div key={item.id} className="border border-[#404040]/10 rounded-xl p-3">
                        <p className="text-xs font-bold text-[#404040]">{item.enonce}</p>
                        <p className="mt-1.5 text-xs text-[#005259] font-medium whitespace-pre-line">{Array.isArray(reponse) ? reponse.join(", ") : reponse}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PageGuard>
  );
}

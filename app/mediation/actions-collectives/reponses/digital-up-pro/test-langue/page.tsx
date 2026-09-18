"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, ArrowDownTrayIcon, LanguageIcon, LinkIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { formatPhoneNumber } from "@/lib/formatPhone";

interface ResultatTestLangue {
  id: string;
  Civilité?: string;
  Nom?: string;
  Prénom?: string;
  Téléphone?: string;
  Email?: string;
  Score?: number;
  Niveau_B1_Francais?: string;
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

// Liste des résultats du test de langue B1 auto-corrigé, rempli en autonomie
// par les candidat·e·s (voir app/inscription/digital-up-pro-test-langue) —
// enregistrements autonomes, sans lien automatique avec une pré-inscription.
export default function TestLangueDigitalUpProResultatsPage() {
  const [resultats, setResultats] = useState<ResultatTestLangue[]>([]);
  const [loading, setLoading] = useState(true);
  const [lienCopie, setLienCopie] = useState(false);
  const [origine, setOrigine] = useState("");
  useEffect(() => { setOrigine(window.location.origin); }, []);
  const lienPublic = `${origine}/inscription/digital-up-pro-test-langue`;
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
      query(collection(db, "resultats_test_langue_digitaluppro"), orderBy("createdAt", "desc")),
      (snap) => {
        setResultats(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ResultatTestLangue)));
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const exporterCSV = () => {
    if (resultats.length === 0) return;
    const headers = "Civilité;Nom;Prénom;Téléphone;Email;Score;Niveau;Date\n";
    const rows = resultats.map((r) =>
      [r.Civilité, r.Nom, r.Prénom, formatPhoneNumber(r.Téléphone), r.Email, r.Score, r.Niveau_B1_Francais, formaterDate(r.createdAt)]
        .map((champ) => String(champ ?? "").replace(/;/g, ",").replace(/\n/g, " "))
        .join(";")
    );
    const blob = new Blob([headers + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "test_langue_digitalup96h.csv");
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
                  Test de langue <span className="text-[#EA601F] font-normal">B1</span>
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

          {/* LIEN PUBLIC — à envoyer aux candidat·e·s pour qu'ils/elles
              passent le test en autonomie (voir app/inscription/
              digital-up-pro-test-langue, aucune connexion requise). */}
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-sm">
            <LinkIcon className="w-4 h-4 text-[#EA601F] shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#005259] shrink-0">Lien public du test :</span>
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
                      <th className="px-4 py-3">Niveau</th>
                      <th className="px-4 py-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]/5">
                    {resultats.map((r) => (
                      <tr key={r.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-[#005259] uppercase">{r.Civilité ? `${r.Civilité} ` : ""}{r.Nom || "—"}</div>
                          <div className="text-[#404040]/70">{r.Prénom || "—"}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-[#404040]">
                          <div>{formatPhoneNumber(r.Téléphone)}</div>
                          <div className="text-[#404040]/60">{r.Email || "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-[#005259]">{r.Score ?? "—"}/10</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                            (r.Score ?? 0) >= 7 ? "bg-[#A9E0C9]/40 text-[#005259]" : (r.Score ?? 0) >= 4 ? "bg-[#F9C44E]/25 text-[#8a6d1a]" : "bg-[#EF736A]/15 text-[#C0392B]"
                          }`}>
                            <LanguageIcon className="w-3.5 h-3.5" />
                            {r.Niveau_B1_Francais || "—"}
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
    </PageGuard>
  );
}

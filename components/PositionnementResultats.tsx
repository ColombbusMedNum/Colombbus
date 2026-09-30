"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, ArrowDownTrayIcon, AcademicCapIcon, LinkIcon, ClipboardDocumentCheckIcon, XMarkIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { ConfigPositionnement, CorrectionsManuelles, ReponsesPositionnement, StatutCorrectionManuelle, calculerScoreCombine, calculerScoreTexteLibre, compterTexteLibreNonCorrigees, formaterPoints, reponseSembleCorrecte } from "@/lib/positionnement";

interface ResultatPositionnement {
  id: string;
  Nom?: string;
  Prénom?: string;
  Téléphone?: string;
  Email?: string;
  Réponses?: ReponsesPositionnement;
  ScoreGlobal?: number;
  TotalQcmGlobal?: number;
  ScoreParSection?: Record<string, { score: number; total: number }>;
  // Corrections manuelles des questions "texte_libre" — clé = id de l'item,
  // absent = pas encore corrigé (voir StatutCorrectionManuelle).
  CorrectionsManuelles?: CorrectionsManuelles;
  CorrectionValidee?: boolean;
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

// Liste des résultats d'un test de positionnement (voir lib/positionnement.ts
// et components/FormulairePositionnement.tsx), pour n'importe quel programme
// câblé sur cette collection Firestore (positionnement/{programmeId}/resultats)
// — même idiome que les pages résultats Test de langue/Collecte Tech, avec en
// plus le détail réponse par réponse (QCM ✔/✘, réponses libres en clair pour
// relecture manuelle, aucune n'étant notée automatiquement).
export default function PositionnementResultats({ programmeId, basePath, lienPublic }: { programmeId: string; basePath: string; lienPublic: string }) {
  const [config, setConfig] = useState<ConfigPositionnement | null>(null);
  const [resultats, setResultats] = useState<ResultatPositionnement[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOuvert, setDetailOuvert] = useState<ResultatPositionnement | null>(null);
  const [alerteValidation, setAlerteValidation] = useState(false);

  const ouvrirDetail = (r: ResultatPositionnement) => {
    setAlerteValidation(false);
    setDetailOuvert(r);
  };
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
    getDoc(doc(db, "positionnement", programmeId)).then((snap) => setConfig(snap.exists() ? (snap.data() as ConfigPositionnement) : null));
  }, [programmeId]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "positionnement", programmeId, "resultats"), orderBy("createdAt", "desc")),
      (snap) => {
        setResultats(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ResultatPositionnement)));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [programmeId]);

  // Correction manuelle d'une réponse libre — s'ajoute au score QCM déjà
  // calculé à l'envoi (voir lib/positionnement.ts, calculerScoreCombine).
  // Mise à jour optimiste locale (le detailOuvert affiché ET la liste), puis
  // confirmée par l'onSnapshot déjà abonné à la collection.
  const marquerCorrection = async (resultat: ResultatPositionnement, itemId: string, statut: StatutCorrectionManuelle) => {
    const dejaCeStatut = resultat.CorrectionsManuelles?.[itemId] === statut;
    const nouvelles = { ...(resultat.CorrectionsManuelles || {}) };
    if (dejaCeStatut) delete nouvelles[itemId];
    else nouvelles[itemId] = statut;

    setResultats((prev) => prev.map((r) => (r.id === resultat.id ? { ...r, CorrectionsManuelles: nouvelles } : r)));
    setDetailOuvert((prev) => (prev && prev.id === resultat.id ? { ...prev, CorrectionsManuelles: nouvelles } : prev));
    try {
      await updateDoc(doc(db, "positionnement", programmeId, "resultats", resultat.id), { CorrectionsManuelles: nouvelles });
    } catch (error) {
      console.error("Erreur lors de la correction manuelle :", error);
    }
  };

  // Marque la correction comme terminée — si des réponses libres n'ont
  // encore aucun statut, affiche une alerte plutôt que de valider en
  // silence (voir compterTexteLibreNonCorrigees).
  const validerCorrection = async (resultat: ResultatPositionnement) => {
    if (!config) return;
    const nbRestantes = compterTexteLibreNonCorrigees(config, resultat.CorrectionsManuelles);
    if (nbRestantes > 0 && !alerteValidation) {
      setAlerteValidation(true);
      return;
    }
    setAlerteValidation(false);
    setResultats((prev) => prev.map((r) => (r.id === resultat.id ? { ...r, CorrectionValidee: true } : r)));
    setDetailOuvert(null);
    try {
      await updateDoc(doc(db, "positionnement", programmeId, "resultats", resultat.id), { CorrectionValidee: true, CorrectionValideeLe: serverTimestamp() });
    } catch (error) {
      console.error("Erreur lors de la validation de la correction :", error);
    }
  };

  const exporterCSV = () => {
    if (resultats.length === 0) return;
    const headers = "Nom;Prénom;Téléphone;Email;Score QCM;Date\n";
    const rows = resultats.map((r) =>
      [r.Nom, r.Prénom, formatPhoneNumber(r.Téléphone), r.Email, `${r.ScoreGlobal ?? "—"}/${r.TotalQcmGlobal ?? "—"}`, formaterDate(r.createdAt)]
        .map((champ) => String(champ ?? "").replace(/;/g, ",").replace(/\n/g, " "))
        .join(";")
    );
    const blob = new Blob([headers + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `positionnement_${programmeId}.csv`);
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
                  Test de <span className="text-[#EA601F] font-normal">positionnement</span>
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
              <Link href={`${basePath}/positionnement/editer`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <AcademicCapIcon className="w-4 h-4 text-[#EA601F]" />
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
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#005259] shrink-0">Lien public du test :</span>
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
                      <th className="px-4 py-3">Identité</th>
                      <th className="px-4 py-3 hidden md:table-cell">Contact</th>
                      <th className="px-4 py-3 text-center">Score QCM</th>
                      <th className="px-4 py-3 text-center">Réponse libre</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                      <th className="px-4 py-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]/5">
                    {resultats.map((r) => {
                      const scoreTexteLibre = config ? calculerScoreTexteLibre(config, r.CorrectionsManuelles) : null;
                      const nbNonCorrigees = config ? compterTexteLibreNonCorrigees(config, r.CorrectionsManuelles) : 0;
                      return (
                        <tr key={r.id} onClick={() => ouvrirDetail(r)} className="hover:bg-[#F3F3F2]/60 transition-colors cursor-pointer">
                          <td className="px-4 py-3">
                            <div className="font-bold text-[#005259] uppercase">{r.Nom || "—"}</div>
                            <div className="text-[#404040]/70">{r.Prénom || "—"}</div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-[#404040]">
                            <div>{formatPhoneNumber(r.Téléphone)}</div>
                            <div className="text-[#404040]/60">{r.Email || "—"}</div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-[#005259]">{r.ScoreGlobal ?? 0}/{r.TotalQcmGlobal ?? 0}</td>
                          <td className="px-4 py-3 text-center font-bold text-[#005259]">{scoreTexteLibre ? `${formaterPoints(scoreTexteLibre.score)}/${scoreTexteLibre.total}` : "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                                !r.CorrectionValidee
                                  ? "bg-[#404040]/5 text-[#404040]/50"
                                  : nbNonCorrigees > 0
                                  ? "bg-[#F9C44E]/25 text-[#8a6d1a]"
                                  : "bg-[#A9E0C9]/40 text-[#005259]"
                              }`}
                              title={r.CorrectionValidee && nbNonCorrigees > 0 ? `Validé malgré ${nbNonCorrigees} réponse(s) non corrigée(s)` : undefined}
                            >
                              {!r.CorrectionValidee ? "À corriger" : nbNonCorrigees > 0 ? "Validé (incomplet)" : "Corrigé"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-[#404040]/70">{formaterDate(r.createdAt)}</td>
                        </tr>
                      );
                    })}
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

      {detailOuvert && config && (
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
                {(() => {
                  const combine = calculerScoreCombine(config, detailOuvert.ScoreGlobal ?? 0, detailOuvert.TotalQcmGlobal ?? 0, detailOuvert.ScoreParSection, detailOuvert.CorrectionsManuelles).global;
                  return (
                    <div className="inline-flex items-center gap-2 mt-2 bg-[#F3F3F2] rounded-xl px-3 py-1.5">
                      <span className="text-sm font-black text-[#005259]">{formaterPoints(combine.score)}/{combine.total}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50">({detailOuvert.ScoreGlobal ?? 0}/{detailOuvert.TotalQcmGlobal ?? 0} QCM)</span>
                    </div>
                  );
                })()}
              </div>
              <button type="button" onClick={() => setDetailOuvert(null)} className="p-2 rounded-xl bg-[#F3F3F2] hover:bg-[#EF736A] hover:text-white text-[#404040]/60 transition-colors cursor-pointer shrink-0">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const parSection = calculerScoreCombine(config, detailOuvert.ScoreGlobal ?? 0, detailOuvert.TotalQcmGlobal ?? 0, detailOuvert.ScoreParSection, detailOuvert.CorrectionsManuelles).parSection;
              return config.sections.map((section) => {
                const scoreSection = parSection[section.id];
                return (
                  <div key={section.id} className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#005259]">
                      {section.titre}{scoreSection && scoreSection.total > 0 ? ` — ${formaterPoints(scoreSection.score)}/${scoreSection.total}` : ""}
                    </p>
                    {section.items.map((item, index) => {
                      if (item.type === "texte_intro") return null;
                      const reponse = detailOuvert.Réponses?.[item.id];
                      if (item.type === "qcm") {
                        const correct = reponse === item.bonneReponseIndex;
                        return (
                          <div key={item.id} className="border border-[#404040]/10 rounded-xl p-3">
                            <p className="text-xs font-bold text-[#404040]">{index + 1}. {item.enonce}</p>
                            <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${correct ? "text-[#005259]" : "text-[#C0392B]"}`}>
                              {reponse !== undefined ? (correct ? <CheckCircleIcon className="w-4 h-4 shrink-0" /> : <XCircleIcon className="w-4 h-4 shrink-0" />) : null}
                              <span>{typeof reponse === "number" ? (item.options?.[reponse] ?? "—") : "Pas de réponse"}</span>
                            </div>
                          </div>
                        );
                      }
                      // texte_libre : indice visuel (vert) si la réponse
                      // ressemble à la réponse indicative éventuellement
                      // définie, plus deux boutons pour que le/la correcteur·rice
                      // tranche lui/elle-même (voir marquerCorrection).
                      const sembleCorrecte = reponseSembleCorrecte(reponse as string | undefined, item.reponseIndicative);
                      const correction = detailOuvert.CorrectionsManuelles?.[item.id];
                      return (
                        <div key={item.id} className="border border-[#404040]/10 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-bold text-[#404040]">{index + 1}. {item.enonce}</p>
                          <p className={`text-xs whitespace-pre-line rounded-lg px-2 py-1.5 ${sembleCorrecte ? "bg-[#A9E0C9]/25 text-[#005259] font-medium" : "text-[#404040]/80"}`}>
                            {(reponse as string) || "Pas de réponse"}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => marquerCorrection(detailOuvert, item.id, "correct")}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                                correction === "correct" ? "bg-[#005259] text-white" : "bg-[#F3F3F2] text-[#404040]/60 hover:bg-[#005259]/10 hover:text-[#005259]"
                              }`}
                            >
                              <CheckCircleIcon className="w-3.5 h-3.5" /> Correct
                            </button>
                            <button
                              type="button"
                              onClick={() => marquerCorrection(detailOuvert, item.id, "partiel")}
                              title="Demi-point (ex. réponse partielle ou méthode correcte mais résultat inexact)"
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                                correction === "partiel" ? "bg-[#F9C44E] text-[#3A3300]" : "bg-[#F3F3F2] text-[#404040]/60 hover:bg-[#F9C44E]/25 hover:text-[#8a6d1a]"
                              }`}
                            >
                              <span className="w-3.5 h-3.5 flex items-center justify-center text-[11px] font-black leading-none">½</span> Partiel
                            </button>
                            <button
                              type="button"
                              onClick={() => marquerCorrection(detailOuvert, item.id, "incorrect")}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                                correction === "incorrect" ? "bg-[#C0392B] text-white" : "bg-[#F3F3F2] text-[#404040]/60 hover:bg-[#C0392B]/10 hover:text-[#C0392B]"
                              }`}
                            >
                              <XCircleIcon className="w-3.5 h-3.5" /> Incorrect
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}

            <div className="pt-2 border-t border-[#404040]/10 space-y-2">
              {alerteValidation && (
                <div className="bg-[#F9C44E]/15 border border-[#F9C44E] text-[#8a6d1a] text-xs font-bold rounded-xl p-3">
                  {compterTexteLibreNonCorrigees(config, detailOuvert.CorrectionsManuelles)} réponse(s) libre(s) sans correction. Valider quand même ?
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                {alerteValidation && (
                  <button
                    type="button"
                    onClick={() => setAlerteValidation(false)}
                    className="px-4 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Continuer la correction
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => validerCorrection(detailOuvert)}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm ${
                    alerteValidation ? "bg-[#F9C44E] hover:bg-[#e6b23f] text-[#3A3300]" : "bg-[#005259] hover:bg-[#EA601F] text-white"
                  }`}
                >
                  <CheckCircleIcon className="w-4 h-4" />
                  {alerteValidation ? "Valider quand même" : "Valider la correction"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageGuard>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { db, storage } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, Timestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ExclamationTriangleIcon, TrashIcon, CheckCircleIcon, ArrowTopRightOnSquareIcon, ChatBubbleLeftRightIcon, PhotoIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import { usePermissions } from "@/lib/PermissionsProvider";

interface Signalement {
  id: string;
  url: string;
  description: string;
  auteurEmail?: string;
  auteurUid?: string;
  createdAt?: Timestamp;
  traite: boolean;
  captureUrl?: string | null;
  reponse?: string;
  reponseAt?: number;
  reponseCaptureUrl?: string | null;
}

// Liste des signalements envoyés via le bouton "B" (voir
// components/BugReportButton.tsx) — réservée aux admins, comme l'envoi.
export default function SignalementsPage() {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { user } = usePermissions();
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<"tous" | "a_traiter" | "traites">("a_traiter");
  // Brouillon de réponse en cours d'édition, par signalement — id du
  // signalement en cours d'édition -> texte tapé (pas encore enregistré).
  const [reponseEnCours, setReponseEnCours] = useState<Record<string, string>>({});
  const [envoiReponseEnCours, setEnvoiReponseEnCours] = useState<string | null>(null);
  // Capture d'écran collée (Ctrl+V, même principe que BugReportButton) en
  // attente d'envoi avec la réponse — id du signalement -> fichier + aperçu.
  const [captureReponse, setCaptureReponse] = useState<Record<string, { fichier: File; apercu: string }>>({});

  const collerCaptureReponse = (id: string, e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
    if (!item) return;
    const fichier = item.getAsFile();
    if (!fichier) return;
    setCaptureReponse((prev) => {
      if (prev[id]) URL.revokeObjectURL(prev[id].apercu);
      return { ...prev, [id]: { fichier, apercu: URL.createObjectURL(fichier) } };
    });
  };

  const retirerCaptureReponse = (id: string) => {
    setCaptureReponse((prev) => {
      if (prev[id]) URL.revokeObjectURL(prev[id].apercu);
      const { [id]: _, ...reste } = prev;
      return reste;
    });
  };

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

  // Enregistre la réponse sur le signalement ET alerte l'auteur·rice via son
  // centre de notifications (voir app/mediation/notifications/page.tsx) —
  // seulement possible si auteurUid a été capturé à l'envoi (BugReportButton,
  // champ absent sur d'éventuels très anciens signalements).
  const envoyerReponse = async (s: Signalement) => {
    const texte = (reponseEnCours[s.id] ?? s.reponse ?? "").trim();
    if (!texte) return;
    setEnvoiReponseEnCours(s.id);
    try {
      let reponseCaptureUrl: string | null = s.reponseCaptureUrl || null;
      const capture = captureReponse[s.id];
      if (capture) {
        const chemin = `signalements/${Date.now()}-${user?.uid || "admin"}-reponse.png`;
        const ref = storageRef(storage, chemin);
        await uploadBytes(ref, capture.fichier);
        reponseCaptureUrl = await getDownloadURL(ref);
      }

      await updateDoc(doc(db, "signalements", s.id), { reponse: texte, reponseAt: Date.now(), reponseCaptureUrl });
      if (s.auteurUid) {
        await addDoc(collection(db, "notifications"), {
          destinataireId: s.auteurUid,
          message: `💬 Réponse à votre signalement (${s.url}) : ${texte}`,
          createdAt: Date.now(),
          lue: false,
          ...(reponseCaptureUrl ? { imageUrl: reponseCaptureUrl } : {}),
        });
        showToast("Réponse envoyée et notification transmise.", "success");
      } else {
        showToast("Réponse enregistrée (auteur·rice non identifié·e, pas de notification envoyée).", "success");
      }
      setReponseEnCours((prev) => { const { [s.id]: _, ...reste } = prev; return reste; });
      retirerCaptureReponse(s.id);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'envoi de la réponse.", "error");
    } finally {
      setEnvoiReponseEnCours(null);
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

                  {/* RÉPONSE — visible par l'auteur·rice via son centre de notifications */}
                  <div className="pt-2 border-t border-[#404040]/10 space-y-1.5">
                    {s.reponse && reponseEnCours[s.id] === undefined && (
                      <div className="flex items-start gap-1.5 bg-[#005259]/5 border border-[#005259]/15 rounded-lg p-2 text-xs text-[#404040]">
                        <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-[#005259] shrink-0 mt-0.5" />
                        <div className="space-y-1.5 min-w-0">
                          <span className="whitespace-pre-wrap">{s.reponse}</span>
                          {s.reponseCaptureUrl && (
                            <a href={s.reponseCaptureUrl} target="_blank" rel="noopener noreferrer" className="block w-fit">
                              <img src={s.reponseCaptureUrl} alt="Capture jointe à la réponse" className="max-h-32 rounded-lg border border-[#404040]/15 hover:border-[#005259]/40 transition-colors" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={reponseEnCours[s.id] ?? s.reponse ?? ""}
                        onChange={(e) => setReponseEnCours((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        onPaste={(e) => collerCaptureReponse(s.id, e)}
                        placeholder={s.auteurUid ? "Répondre (alerte l'auteur·rice) — Ctrl+V pour joindre une capture..." : "Répondre... (Ctrl+V pour joindre une capture)"}
                        className="flex-1 px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] rounded-lg text-xs text-[#404040] outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => envoyerReponse(s)}
                        disabled={envoiReponseEnCours === s.id || !(reponseEnCours[s.id] ?? s.reponse ?? "").trim()}
                        className="shrink-0 px-3 py-1.5 bg-[#005259] hover:bg-[#EA601F] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        {envoiReponseEnCours === s.id ? "Envoi..." : s.reponse ? "Modifier" : "Répondre"}
                      </button>
                    </div>
                    {captureReponse[s.id] ? (
                      <div className="relative inline-block">
                        <img src={captureReponse[s.id].apercu} alt="Capture d'écran collée" className="max-h-24 rounded-lg border border-[#404040]/15" />
                        <button
                          type="button"
                          onClick={() => retirerCaptureReponse(s.id)}
                          title="Retirer la capture"
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#EF736A] text-white flex items-center justify-center shadow cursor-pointer"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <p className="flex items-center gap-1.5 text-[9px] text-[#404040]/40 font-medium">
                        <PhotoIcon className="w-3 h-3" /> Cliquez dans le champ puis Ctrl+V pour joindre une capture d'écran.
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </PageGuard>
  );
}

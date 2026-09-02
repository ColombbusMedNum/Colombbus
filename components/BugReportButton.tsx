"use client";

import { useState } from "react";
import { usePermissions } from "@/lib/PermissionsProvider";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { XMarkIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { useToast } from "./ToastProvider";

// Équivalent du badge "N" de Next.js en développement (bas de l'écran), mais
// pour le site déployé : ouvre une remontée de problème plutôt que les outils
// de dev. Ouvert à tout le staff connecté (le suivi/traitement, lui, reste
// réservé aux admins — voir app/mediation/signalements) ; masqué en local
// (le badge Next.js suffit là).
export default function BugReportButton() {
  const { role, user } = usePermissions();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [capture, setCapture] = useState<{ fichier: File; apercu: string } | null>(null);

  if (!role) return null;
  if (typeof window !== "undefined" && window.location.hostname === "localhost") return null;

  // Ctrl+V d'une capture d'écran directement depuis le presse-papier (aucun
  // enregistrement de fichier requis au préalable, juste "Impr écran" puis
  // coller ici) — un seul aperçu à la fois, le dernier collé remplace le
  // précédent.
  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
    if (!item) return;
    const fichier = item.getAsFile();
    if (!fichier) return;
    if (capture) URL.revokeObjectURL(capture.apercu);
    setCapture({ fichier, apercu: URL.createObjectURL(fichier) });
  };

  const retirerCapture = () => {
    if (capture) URL.revokeObjectURL(capture.apercu);
    setCapture(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setEnvoiEnCours(true);
    try {
      let captureUrl: string | null = null;
      if (capture) {
        const chemin = `signalements/${Date.now()}-${user?.uid || "anonyme"}.png`;
        const ref = storageRef(storage, chemin);
        await uploadBytes(ref, capture.fichier);
        captureUrl = await getDownloadURL(ref);
      }

      await addDoc(collection(db, "signalements"), {
        url: window.location.href,
        description: description.trim(),
        captureUrl,
        auteurUid: user?.uid || "",
        auteurEmail: user?.email || "",
        createdAt: serverTimestamp(),
        traite: false,
      });
      showToast("Signalement envoyé, merci !");
      setDescription("");
      retirerCapture();
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'envoi du signalement.", "error");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Signaler un problème"
        className="fixed bottom-4 left-4 z-[200] h-9 px-3.5 rounded-full bg-[#404040] hover:bg-[#EF736A] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center shadow-lg transition-colors cursor-pointer"
      >
        Bug
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[210] p-4">
          <form onSubmit={handleSubmit} className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-sm space-y-4 shadow-2xl text-[#404040]">
            <div className="flex justify-between items-center border-b border-[#F3F3F2] pb-2">
              <h3 className="font-bold text-sm text-[#005259]">Signaler un problème</h3>
              <button type="button" onClick={() => setIsOpen(false)} className="text-[#404040]/50 hover:text-[#404040] cursor-pointer">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#404040] font-bold">Page concernée :</label>
              <div className="w-full bg-[#F3F3F2] border border-[#404040]/10 rounded-md text-[10px] text-[#404040]/70 p-2 break-all font-mono">
                {window.location.href}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#404040] font-bold">Description du problème :</label>
              <textarea
                rows={4}
                required
                autoFocus
                onPaste={handlePaste}
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none focus:border-[#005259] transition-colors resize-none"
                placeholder="Décrivez ce qui ne va pas... (Ctrl+V pour coller une capture d'écran)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {capture ? (
              <div className="relative inline-block">
                <img src={capture.apercu} alt="Capture d'écran jointe" className="max-h-32 rounded-md border border-[#404040]/15" />
                <button
                  type="button"
                  onClick={retirerCapture}
                  title="Retirer la capture"
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#EF736A] text-white flex items-center justify-center shadow cursor-pointer"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-[10px] text-[#404040]/50 font-medium">
                <PhotoIcon className="w-3.5 h-3.5" /> Colle une capture d'écran (Ctrl+V) dans le champ ci-dessus si besoin.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#F3F3F2]">
              <button type="button" onClick={() => setIsOpen(false)} className="text-[#404040]/60 text-xs px-2 font-bold cursor-pointer">
                Annuler
              </button>
              <button
                type="submit"
                disabled={envoiEnCours}
                className="bg-[#005259] hover:bg-[#003d42] text-white px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {envoiEnCours ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

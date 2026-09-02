"use client";

import { useState } from "react";
import { usePermissions } from "@/lib/PermissionsProvider";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { XMarkIcon } from "@heroicons/react/24/outline";
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

  if (!role) return null;
  if (typeof window !== "undefined" && window.location.hostname === "localhost") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setEnvoiEnCours(true);
    try {
      await addDoc(collection(db, "signalements"), {
        url: window.location.href,
        description: description.trim(),
        auteurUid: user?.uid || "",
        auteurEmail: user?.email || "",
        createdAt: serverTimestamp(),
        traite: false,
      });
      showToast("Signalement envoyé, merci !");
      setDescription("");
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
        className="fixed bottom-4 left-4 z-[200] w-9 h-9 rounded-full bg-[#404040] hover:bg-[#EF736A] text-white font-black text-sm flex items-center justify-center shadow-lg transition-colors cursor-pointer"
      >
        B
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
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none focus:border-[#005259] transition-colors resize-none"
                placeholder="Décrivez ce qui ne va pas..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

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

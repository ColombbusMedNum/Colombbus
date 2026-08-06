"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { ArrowLeftIcon, TrashIcon, CheckCircleIcon, BellIcon, HomeIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Quicksand } from "next/font/google";

// Police Quicksand pour toute la page
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function AllNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Écoute temps réel de la collection "notifications"
    const unsubNotifs = onSnapshot(collection(db, "notifications"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Tri du plus récent au plus ancien
      setNotifications(list.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)));
      setLoading(false);
    });

    return () => unsubNotifs();
  }, []);

  const marquerCommeLu = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { lue: true });
    } catch (error) {
      console.error("Erreur lors du marquage :", error);
    }
  };

  const marquerToutCommeLu = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        if (!n.lue) batch.update(doc(db, "notifications", n.id), { lue: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erreur lors du marquage global :", error);
    }
  };

  const supprimerNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (error) {
      console.error("Erreur lors de la suppression :", error);
    }
  };

  const effacerTout = async () => {
    if (!confirm("Effacer définitivement tout l'historique des notifications ?")) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, "notifications", n.id));
      });
      await batch.commit();
    } catch (error) {
      console.error("Erreur lors de la suppression globale :", error);
    }
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement des notifications...
      </div>
    );
  }

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      
      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10 space-y-6">
        
        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Centre de <span className="text-[#EA601F] font-normal">Notifications</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5">
                {notifications.length} message(s) enregistré(s)
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Link 
              href="/agenda" 
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              title="Retour à l'agenda des médiateurs"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Retour Agenda</span>
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

        {/* ACTIONS GLOBALES */}
        {notifications.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2 px-1">
            <button 
              onClick={marquerToutCommeLu} 
              className="px-3.5 py-1.5 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 rounded-xl text-xs font-bold text-[#005259] uppercase tracking-wider transition-all shadow-sm cursor-pointer"
            >
              Tout marquer comme lu
            </button>
            <button 
              onClick={effacerTout} 
              className="px-3.5 py-1.5 bg-white hover:bg-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-xl text-xs font-bold text-[#EF736A] uppercase tracking-wider transition-all shadow-sm cursor-pointer"
            >
              Vider l'historique
            </button>
          </div>
        )}

        {/* LISTE COMPLÈTE DE L'HISTORIQUE */}
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="bg-white border border-dashed border-[#404040]/20 rounded-2xl p-12 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60 shadow-sm">
              <BellIcon className="w-8 h-8 text-[#005259]/30 mx-auto mb-2" />
              Aucune notification dans votre historique pour le moment.
            </div>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id} 
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 shadow-sm ${
                  n.lue 
                    ? "bg-white/60 border-[#404040]/10 text-[#404040]/70" 
                    : "bg-white border-[#005259]/30 text-[#404040] shadow-md border-l-4 border-l-[#005259]"
                }`}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.lue && (
                      <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-[#005259] bg-[#A9E0C9]/30 px-2 py-0.5 rounded border border-[#A9E0C9]">
                        Nouveau
                      </span>
                    )}
                    <p className="text-sm font-medium leading-relaxed">{n.message}</p>
                  </div>
                  
                  <p className="text-[10px] text-[#404040]/60 uppercase tracking-wider font-bold">
                    {n.createdAt 
                      ? new Date(n.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) 
                      : "Date inconnue"}
                  </p>
                </div>

                {/* OPTIONS INDIVIDUELLES */}
                <div className="flex items-center gap-2 shrink-0">
                  {!n.lue && (
                    <button 
                      onClick={() => marquerCommeLu(n.id)}
                      className="p-2 bg-[#F3F3F2] hover:bg-[#005259] text-[#005259] hover:text-white border border-[#005259]/20 rounded-xl transition-all cursor-pointer shadow-sm"
                      title="Marquer comme lu"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => supprimerNotification(n.id)}
                    className="p-2 bg-[#F3F3F2] hover:bg-[#EF736A] text-[#404040]/60 hover:text-white border border-[#404040]/10 hover:border-[#EF736A] rounded-xl transition-all cursor-pointer shadow-sm"
                    title="Supprimer la notification"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </main>
  );
}
"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { ArrowLeftIcon, TrashIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function AllNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    // Écoute temps réel de la collection "notifications"
    const unsubNotifs = onSnapshot(collection(db, "notifications"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Tri du plus récent au plus ancien
      setNotifications(list.sort((a: any, b: any) => b.createdAt - a.createdAt));
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

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 pt-12">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* RETOUR & TITRE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-5 gap-4">
          <div className="flex items-center gap-4">
            {/* BOUTON DE RETOUR VERS L'AGENDA DES MÉDIATEURS / ACTIVITÉS TYPES */}
            <Link 
              href="/activites_types" 
              className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center cursor-pointer gap-2 text-xs font-medium"
              title="Retour à l'agenda des médiateurs"
            >
              <ArrowLeftIcon className="w-4 h-4"/>
              <span>Retour à l'agenda</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Centre de Notifications</h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{notifications.length} message(s) enregistré(s)</p>
            </div>
          </div>

          {/* ACTIONS GLOBALES */}
          {notifications.length > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={marquerToutCommeLu} 
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-blue-400 transition-colors cursor-pointer"
              >
                Tout marquer comme lu
              </button>
              <button 
                onClick={effacerTout} 
                className="px-3 py-1.5 bg-rose-950/30 hover:bg-rose-950/50 border border-rose-900/30 rounded-lg text-xs font-semibold text-rose-400 transition-colors cursor-pointer"
              >
                Vider l'historique
              </button>
            </div>
          )}
        </div>

        {/* LISTE COMPLÈTE DE L'HISTORIQUE */}
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800/80 rounded-xl bg-slate-900/10 text-sm">
              Aucune notification dans votre historique pour le moment.
            </div>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id} 
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                  n.lue 
                    ? "bg-slate-900/30 border-slate-900/80 text-slate-400" 
                    : "bg-slate-900 border-blue-500/10 text-slate-100 shadow-[0_0_15px_rgba(59,130,246,0.01)]"
                }`}
              >
                <div className="flex-1 space-y-1">
                  <p className="text-sm leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date inconnue"}
                  </p>
                </div>

                {/* OPTIONS INDIVIDUELLES */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {!n.lue && (
                    <button 
                      onClick={() => marquerCommeLu(n.id)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800/80 rounded-lg text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                      title="Marquer comme lu"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => supprimerNotification(n.id)}
                    className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800/80 rounded-lg text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
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
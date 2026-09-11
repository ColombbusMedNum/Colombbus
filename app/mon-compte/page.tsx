"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePermissions } from "@/lib/PermissionsProvider";
import PageGuard from "@/components/PageGuard";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { quicksand } from "@/lib/fonts";
import {
  HomeIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

// Page self-service ouverte à tout le staff connecté, quel que soit son rôle
// (voir page_access_mon_compte dans lib/permissionsCatalog.ts, accordé true
// partout comme page_access_planning) : c'est ici que chacun·e connecte son
// propre compte Google, pour que ses créneaux "planning_mediateurs" soient
// répercutés automatiquement sur un calendrier Google secondaire dédié
// ("COSMOS — Planning") — voir la Cloud Function déclenchée par Firestore
// dans functions/src/index.ts, qui ne dépend d'aucune action ici une fois la
// connexion faite.
export default function MonComptePage() {
  return (
    <Suspense fallback={null}>
      <MonCompteContenu />
    </Suspense>
  );
}

function MonCompteContenu() {
  const { user, loading } = usePermissions();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (searchParams.get("connecte") === "1") {
      showToast("✅ Google Agenda connecté avec succès.", "success");
    } else if (searchParams.get("erreurGoogle")) {
      showToast("❌ Connexion à Google Agenda impossible, merci de réessayer.", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "liste_mediateurs", user.uid), (snap) => {
      setConnecte(!!snap.data()?.googleCalendarConnecte);
    });
    return () => unsub();
  }, [user]);

  const connecterGoogle = async () => {
    if (!user) return;
    setEnCours(true);
    try {
      const token = await user.getIdToken();
      const reponse = await fetch("/api/google-calendar/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await reponse.json();
      if (!reponse.ok || !data.url) throw new Error(data.erreur || "Erreur");
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      showToast("❌ Impossible de démarrer la connexion à Google Agenda.", "error");
      setEnCours(false);
    }
  };

  const deconnecterGoogle = async () => {
    if (!user) return;
    if (!(await confirm("Déconnecter Google Agenda ? Le calendrier \"COSMOS — Planning\" et tous ses événements seront définitivement supprimés de votre compte Google."))) {
      return;
    }
    setEnCours(true);
    try {
      const token = await user.getIdToken();
      const reponse = await fetch("/api/google-calendar/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!reponse.ok) throw new Error();
      showToast("Google Agenda déconnecté.", "success");
    } catch (err) {
      console.error(err);
      showToast("❌ Erreur lors de la déconnexion.", "error");
    } finally {
      setEnCours(false);
    }
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_mon_compte">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-2xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight flex items-center gap-2">
                  <UserCircleIcon className="w-7 h-7 text-[#EA601F]" />
                  Mon <span className="text-[#EA601F] font-normal">Compte</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5">{user?.email}</p>
              </div>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm w-fit"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#005259]">
              <CalendarDaysIcon className="w-5 h-5 text-[#EA601F]" />
              <h2 className="text-sm font-bold uppercase tracking-wide">Synchronisation avec Google Agenda</h2>
            </div>
            <p className="text-[11px] text-[#404040]/60 leading-relaxed">
              Une fois connecté·e, chaque créneau posé, modifié ou supprimé sur votre agenda COSMOS
              est automatiquement répercuté sur un calendrier Google secondaire dédié, "COSMOS — Planning" —
              séparé de votre agenda personnel, visible depuis votre téléphone comme n'importe quel autre agenda Google.
            </p>

            {connecte === null ? (
              <div className="text-xs text-[#404040]/50 italic">Vérification du statut...</div>
            ) : connecte ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#A9E0C9]/20 border border-[#A9E0C9] rounded-xl p-3.5">
                <div className="flex items-center gap-2 text-[#005259]">
                  <CheckCircleIcon className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wide">Google Agenda connecté</span>
                </div>
                <button
                  onClick={deconnecterGoogle}
                  disabled={enCours}
                  className="px-4 py-2 bg-white hover:bg-[#EF736A] hover:text-white border border-[#EF736A]/30 text-[#EF736A] rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {enCours ? "Déconnexion..." : "Déconnecter"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl p-3.5">
                <span className="text-xs font-bold text-[#404040]/70 uppercase tracking-wide">Non connecté</span>
                <button
                  onClick={connecterGoogle}
                  disabled={enCours}
                  className="flex items-center gap-2 px-4 py-2 bg-[#005259] hover:bg-[#EA601F] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  Connecter mon agenda Google
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </PageGuard>
  );
}

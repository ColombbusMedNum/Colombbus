"use client";

import React from "react";
import { db } from "../../../lib/firebase";
import { updateDoc, doc } from "firebase/firestore";
import { ROLES } from "../../../lib/roles";
import { usePermissions } from "../../../lib/PermissionsProvider";
import { useMediateurs } from "../../../lib/MediateursProvider";
import PageGuard from "../../../components/PageGuard";
import { useToast } from "../../../components/ToastProvider";
import { Quicksand } from "next/font/google";
import {
  ShieldCheckIcon,
  UserGroupIcon,
  LockClosedIcon,
  HomeIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// La matrice de droits par action/page a été fusionnée dans /mediation/analyse, qui est
// désormais la seule source éditée et lue (collection Firestore
// configuration_droits). Cette page ne garde que la gestion individuelle des
// rôles des membres du staff, qui est une préoccupation distincte.
export default function GestionDroitsPage() {
  const { role: userRole, loading } = usePermissions();
  // Depuis la migration vers la collection configuration_equipe, liste_mediateurs
  // ne contient plus que des fiches de médiateurs : plus besoin de filtrer
  // les anciens documents de configuration au passage.
  const { mediateurs } = useMediateurs();
  const { showToast } = useToast();

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (userRole !== "admin") {
      showToast("⛔ Action refusée : Vous devez être administrateur.", "error");
      return;
    }
    try {
      await updateDoc(doc(db, "liste_mediateurs", userId), { role: newRole });
    } catch (err) {
      console.error("Erreur de mise à jour du rôle :", err);
      showToast("La mise à jour a échoué (droits insuffisants ou erreur réseau).", "error");
    }
  };

  if (loading) {
    return (
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] flex items-center justify-center font-medium antialiased`}>
        <p className="text-xs text-[#404040]/50 font-bold uppercase tracking-widest animate-pulse">Vérification des droits d'accès...</p>
      </main>
    );
  }

  if (userRole !== "admin") {
    return (
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] flex flex-col items-center justify-center p-4 font-medium antialiased`}>
        <div className="bg-white border border-[#404040]/10 p-8 rounded-3xl max-w-md text-center shadow-sm">
          <LockClosedIcon className="w-12 h-12 text-[#EA601F] mx-auto mb-4" />
          <h1 className="text-xl font-bold uppercase text-[#005259] tracking-tight">Accès Refusé</h1>
          <p className="text-xs text-[#404040]/60 mt-2 leading-relaxed">
            Cette interface de sécurité maîtresse est réservée exclusivement aux administrateurs de la plateforme Colombbus.
          </p>
          <Link
            href="/"
            className="mt-6 flex items-center justify-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm w-fit mx-auto"
          >
            <HomeIcon className="w-4 h-4 text-[#EA601F]" />
            <span>Accueil</span>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <PageGuard pageId="page_access_admin_droits">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl w-full mx-auto relative z-10">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-[#404040]/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-[#005259]">Gestion des Droits</h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Rôle par membre du staff</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
          >
            <HomeIcon className="w-4 h-4 text-[#EA601F]" />
            <span>Accueil</span>
          </Link>
        </div>

        <Link
          href="/mediation/analyse"
          className="mb-6 flex items-center gap-3 bg-white border border-[#404040]/10 hover:border-[#005259] rounded-2xl p-4 transition-colors group shadow-sm"
        >
          <div className="bg-[#F3F3F2] border border-[#404040]/10 p-2.5 rounded-xl text-[#EA601F] group-hover:bg-[#EA601F]/10">
            <Cog6ToothIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#005259]">Matrice des droits par page et par action</div>
            <div className="text-[11px] text-[#404040]/60">Configurer précisément ce que chaque rôle peut voir/faire → /mediation/analyse</div>
          </div>
        </Link>

        <div className="bg-white border border-[#404040]/10 rounded-3xl p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#005259] mb-4 flex items-center gap-2">
            <UserGroupIcon className="w-4 h-4 text-[#EA601F]" />
            <span>Membres du Staff ({mediateurs.length})</span>
          </h2>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {mediateurs.map((m) => {
              const currentRole = m.role || "mediateur";
              return (
                <div key={m.id} className="p-3 bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl flex justify-between items-center gap-3 hover:border-[#005259]/30 transition-colors">
                  <div className="truncate mr-2">
                    <div className="font-bold text-xs text-[#404040] truncate">{m.prenom} {m.nom}</div>
                    <div className="text-[10px] text-[#404040]/50 font-mono mt-0.5 truncate">{m.email || "Aucun email"}</div>
                  </div>

                  <select
                    value={currentRole}
                    onChange={(e) => handleChangeRole(m.id, e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-white border border-[#404040]/10 text-[#005259] outline-none cursor-pointer shrink-0 focus:border-[#EA601F]"
                  >
                    {ROLES.map((role) => (
                      <option key={role.id} value={role.id}>{role.nom}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </main>
    </PageGuard>
  );
}

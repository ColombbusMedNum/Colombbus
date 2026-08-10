"use client";

import React, { useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { ROLES } from "../../../lib/roles";
import { usePermissions } from "../../../lib/PermissionsProvider";
import PageGuard from "../../../components/PageGuard";
import {
  ShieldCheckIcon,
  UserGroupIcon,
  LockClosedIcon,
  ArrowLeftIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

// La matrice de droits par action/page a été fusionnée dans /analyse, qui est
// désormais la seule source éditée et lue (collection Firestore
// configuration_droits). Cette page ne garde que la gestion individuelle des
// rôles des membres du staff, qui est une préoccupation distincte.
export default function GestionDroitsPage() {
  const { role: userRole, loading } = usePermissions();
  const [mediateurs, setMediateurs] = useState<any[]>([]);

  React.useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, "liste_mediateurs"), (snap) => {
      setMediateurs(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => m.id !== "parametres_configuration" && m.id !== "parametres_horaires")
      );
    });
    return () => unsubStaff();
  }, []);

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (userRole !== "admin") {
      alert("⛔ Action refusée : Vous devez être administrateur.");
      return;
    }
    try {
      await updateDoc(doc(db, "liste_mediateurs", userId), { role: newRole });
    } catch (err) {
      console.error("Erreur de mise à jour du rôle :", err);
      alert("La mise à jour a échoué (droits insuffisants ou erreur réseau).");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-xs text-slate-500 animate-pulse">Vérification des droits d'accès...</p>
      </main>
    );
  }

  if (userRole !== "admin") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-red-950 p-8 rounded-3xl max-w-md text-center shadow-2xl">
          <LockClosedIcon className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
          <h1 className="text-xl font-black text-white uppercase tracking-tight">Accès Refusé</h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Cette interface de sécurité maîtresse est réservée exclusivement aux administrateurs de la plateforme Colombbus.
          </p>
          <Link href="/" className="mt-6 inline-block text-xs bg-slate-950 hover:bg-slate-850 px-4 py-2 rounded-xl border border-slate-800 transition-colors font-bold text-slate-300">
            Retourner à l'accueil
          </Link>
        </div>
      </main>
    );
  }

  return (
    <PageGuard pageId="page_access_admin_droits">
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-500/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl w-full mx-auto relative z-10">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-slate-900 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-rose-950 border border-rose-900/50 p-2.5 rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.1)]">
              <ShieldCheckIcon className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-white">Gestion des Droits</h1>
              <p className="text-[11px] text-slate-500 font-medium">Rôle par membre du staff</p>
            </div>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 text-xs font-bold transition-all shadow-md active:scale-95">
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span>Retour Dashboard</span>
          </Link>
        </div>

        <Link
          href="/analyse"
          className="mb-6 flex items-center gap-3 bg-slate-900 border border-slate-850 hover:border-rose-900/50 rounded-2xl p-4 transition-colors group"
        >
          <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl text-rose-400 group-hover:bg-rose-950/40">
            <Cog6ToothIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Matrice des droits par page et par action</div>
            <div className="text-[11px] text-slate-500">Configurer précisément ce que chaque rôle peut voir/faire → /analyse</div>
          </div>
        </Link>

        <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl">
          <h2 className="text-sm font-black uppercase tracking-wider text-white mb-4 flex items-center gap-2">
            <UserGroupIcon className="w-4 h-4 text-blue-400" />
            <span>Membres du Staff ({mediateurs.length})</span>
          </h2>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {mediateurs.map((m) => {
              const currentRole = m.role || "mediateur";
              return (
                <div key={m.id} className="p-3 bg-slate-950 border border-slate-850 rounded-2xl flex justify-between items-center gap-3 hover:border-slate-800 transition-colors">
                  <div className="truncate mr-2">
                    <div className="font-bold text-xs text-white truncate">{m.prenom} {m.nom}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{m.email || "Aucun email"}</div>
                  </div>

                  <select
                    value={currentRole}
                    onChange={(e) => handleChangeRole(m.id, e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-900 border border-slate-850 text-slate-300 outline-none cursor-pointer shrink-0"
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

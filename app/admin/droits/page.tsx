"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../../lib/firebase";
import { collection, onSnapshot, updateDoc, doc, setDoc } from "firebase/firestore";
import { 
  ShieldCheckIcon, 
  UserGroupIcon, 
  LockClosedIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ArrowLeftIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";

export default function GestionDroitsPage() {
  const [mediateurs, setMediateurs] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [droitsMaitres, setDroitsMaitres] = useState<Record<string, any>>({});

  // Liste exhaustive des actions de sécurité de la plateforme
  const listeActions = [
    { id: "consulter_agenda_mediateurs", nom: "Consulter l'Agenda des Médiateurs (Page)" },
    { id: "voir_adresse_mediateurs", nom: "Voir les adresses des activités" },
    { id: "voir_staff_mediateurs", nom: "Voir le staff / médiateur affecté" },
    { id: "changer_semaines", nom: "Faire défiler les semaines (Suivant / Précédent)" },
    { id: "consulter_agenda_suresnes", nom: "Accéder à l'Agenda de Suresnes" }
  ];

  // Liste des rôles configurables dans la matrice (hors admin qui a tous les droits d'office)
  const listeRoles = [
    { id: "mediateur", nom: "Médiateur" },
    { id: "aci", nom: "ACI" },
    { id: "charge_territoire", nom: "Chargé Territoire" }
  ];

  // 1. Récupérer le rôle de l'utilisateur connecté et écouter Firestore
  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(";").shift();
      return null;
    };

    const role = (getCookie("user_role") || localStorage.getItem("user_role"))?.toLowerCase() || null;
    setUserRole(role);

    // Écoute en temps réel de la liste du staff
    const unsubStaff = onSnapshot(collection(db, "liste_mediateurs"), (snap) => {
      setMediateurs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Écoute en temps réel de la configuration globale des droits
    const unsubDroits = onSnapshot(collection(db, "configuration_droits"), (snap) => {
      const dataDroits: Record<string, any> = {};
      snap.docs.forEach(d => {
        dataDroits[d.id] = d.data();
      });
      setDroitsMaitres(dataDroits);
    });

    return () => {
      unsubStaff();
      unsubDroits();
    };
  }, []);

  // 2. Modifier le rôle d'un utilisateur du staff (Bouton Admin/Médiateur rapide)
  const handleToggleRole = async (userId: string, currentRole: string) => {
    if (userRole !== "admin") {
      alert("⛔ Action refusée : Vous devez être administrateur.");
      return;
    }
    
    const nuevoRole = currentRole === "admin" ? "mediateur" : "admin";
    try {
      await updateDoc(doc(db, "liste_mediateurs", userId), {
        role: nuevoRole
      });
    } catch (err) {
      console.error("Erreur de mise à jour du rôle :", err);
    }
  };

  // 3. Modifier une cellule de la matrice de droits en direct dans Firestore
  const handleToggleDroitCentral = async (actionId: string, roleId: string, valeurActuelle: boolean) => {
    if (userRole !== "admin") {
      alert("⛔ Action refusée : Réservé à l'administrateur.");
      return;
    }

    try {
      const docRef = doc(db, "configuration_droits", actionId);
      await setDoc(docRef, {
        [roleId]: !valeurActuelle
      }, { merge: true });
    } catch (err) {
      console.error("Erreur lors de la modification du droit centralisé :", err);
    }
  };

  // Sécurité d'accès à l'écran
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
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased relative overflow-hidden">
      {/* Background Glow Effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-500/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl w-full mx-auto relative z-10">
        
        {/* En-tête de la page */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-slate-900 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-rose-950 border border-rose-900/50 p-2.5 rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.1)]">
              <ShieldCheckIcon className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-white">Matrice des Droits Équipe</h1>
              <p className="text-[11px] text-slate-500 font-medium">Contrôle centralisé de la sécurité et des visibilités par rôle</p>
            </div>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 text-xs font-bold transition-all shadow-md active:scale-95">
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span>Retour Dashboard</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* ================= BLOC GAUCHE : LA MATRICE CENTRALISÉE DES ACTIONS ================= */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-sm font-black uppercase tracking-wider text-white mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4 text-rose-400" />
              <span>Droits par Fonctionnalité</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-500">
                    <th className="py-3 px-2">Actions / Pages</th>
                    {listeRoles.map((r) => (
                      <th key={r.id} className="py-3 px-2 text-center">{r.nom}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {listeActions.map((action) => (
                    <tr key={action.id} className="hover:bg-slate-950/40 transition-colors group">
                      <td className="py-4 px-2 text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                        {action.nom}
                        <span className="block text-[9px] font-mono font-medium text-slate-600 mt-0.5">{action.id}</span>
                      </td>

                      {listeRoles.map((role) => {
                        const estCoche = !!droitsMaitres[action.id]?.[role.id];
                        return (
                          <td key={role.id} className="py-4 px-2 text-center">
                            <button
                              onClick={() => handleToggleDroitCentral(action.id, role.id, estCoche)}
                              className={`p-1.5 rounded-lg border transition-all inline-flex items-center justify-center cursor-pointer active:scale-95 ${
                                estCoche
                                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                                  : "bg-slate-950 border-slate-850 text-slate-600 hover:text-slate-400"
                              }`}
                            >
                              {estCoche ? (
                                <CheckCircleIcon className="w-4 h-4 shadow-[0_0_10px_rgba(16,185,129,0.2)]" />
                              ) : (
                                <XCircleIcon className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ================= BLOC DROIT : LA LISTE DES MEMBRES ET LEUR RÔLE RAPIDE ================= */}
          <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-sm font-black uppercase tracking-wider text-white mb-4 flex items-center gap-2">
              <UserGroupIcon className="w-4 h-4 text-blue-400" />
              <span>Membres du Staff ({mediateurs.length})</span>
            </h2>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {mediateurs.map((m) => {
                const currentRole = m.role || "mediateur";
                const isAdmin = currentRole === "admin";
                
                return (
                  <div key={m.id} className="p-3 bg-slate-950 border border-slate-850 rounded-2xl flex justify-between items-center hover:border-slate-800 transition-colors">
                    <div className="truncate mr-2">
                      <div className="font-bold text-xs text-white truncate">{m.prenom} {m.nom}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{m.email || "Aucun email"}</div>
                    </div>
                    
                    <button
                      onClick={() => handleToggleRole(m.id, currentRole)}
                      className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border shrink-0 cursor-pointer active:scale-95 ${
                        isAdmin 
                          ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.05)]" 
                          : "bg-slate-900 border-slate-850 text-slate-400 hover:text-white"
                      }`}
                    >
                      {isAdmin ? "Admin" : "Staff"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
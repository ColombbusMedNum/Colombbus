"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../../lib/firebase";
import { collection, onSnapshot, updateDoc, doc, setDoc, getDocs } from "firebase/firestore";
import { ShieldCheckIcon, UserGroupIcon, LockClosedIcon } from "@heroicons/react/24/outline";

// Configuration par défaut automatique (plus besoin de la console Firebase !)
const ACTIONS_LISTE = [
  { 
    id: "consulter_agenda_mediateurs", 
    label: "Consulter l'agenda des médiateurs",
    defaut: { admin: true, charge_territoire: true, aci: true, mediateur: true }
  },
  { 
    id: "modifier_propres_actions", 
    label: "Ajouter / Modifier ses propres actions (Semaine non validée)",
    defaut: { admin: true, charge_territoire: true, aci: true, mediateur: true }
  },
  { 
    id: "modifier_commentaire_activite", 
    label: "Écrire ou modifier un commentaire d'activité",
    defaut: { admin: true, charge_territoire: true, aci: true, mediateur: true }
  },
  { 
    id: "consulter_agenda_suresnes", 
    label: "Consulter l'agenda Suresnes",
    defaut: { admin: true, charge_territoire: true, aci: true, mediateur: true }
  },
  { 
    id: "modifier_agenda_suresnes", 
    label: "Modifier l'agenda Suresnes (Rendez-vous usagers)",
    defaut: { admin: true, charge_territoire: true, aci: false, mediateur: false }
  },
  { 
    id: "valider_semaine_complete", 
    label: "Valider et verrouiller une semaine complète",
    defaut: { admin: true, charge_territoire: false, aci: false, mediateur: false }
  },
  { 
    id: "modifier_profil_equipe", 
    label: "Ajouter, masquer ou modifier un profil de l'équipe",
    defaut: { admin: true, charge_territoire: false, aci: false, mediateur: false }
  },
  { 
    id: "modifier_droits_acces", 
    label: "Modifier les droits et rôles d'accès",
    defaut: { admin: true, charge_territoire: false, aci: false, mediateur: false }
  },
];

export default function GestionDroitsPage() {
  const [mediateurs, setMediateurs] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [matrixDroits, setMatrixDroits] = useState<Record<string, any>>({});
  const [loadingMatrix, setLoadingMatrix] = useState(true);

  // Fonction magique qui configure automatiquement Firestore si besoin
  const initialiserMatriceAutomatiquement = async (donneesActuelles: any) => {
    for (const action of ACTIONS_LISTE) {
      // Si l'action n'existe pas encore en base de données, on la crée avec les droits par défaut
      if (!donneesActuelles[action.id]) {
        try {
          await setDoc(doc(db, "configuration_droits", action.id), action.defaut);
        } catch (err) {
          console.error(`Erreur d'initialisation auto pour ${action.id}:`, err);
        }
      }
    }
  };

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    setUserRole(role);

    // Écoute en temps réel de la matrice
    const unsubMatrix = onSnapshot(collection(db, "configuration_droits"), (snap) => {
      const dbDroits: Record<string, any> = {};
      snap.docs.forEach(d => {
        dbDroits[d.id] = d.data();
      });
      
      setMatrixDroits(dbDroits);
      setLoadingMatrix(false);

      // Si Firestore ne contient pas toutes les actions configurées, on lance l'auto-configuration
      if (snap.docs.length < ACTIONS_LISTE.length) {
        initialiserMatriceAutomatiquement(dbDroits);
      }
    });

    // Écoute du staff
    const unsubStaff = onSnapshot(collection(db, "liste_mediateurs"), (snap) => {
      setMediateurs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubMatrix();
      unsubStaff();
    };
  }, []);

  const handleCheckboxChange = async (actionId: string, profilKey: string, currentVal: boolean) => {
    if (userRole !== "admin") {
      alert("⛔ Action refusée : Vous devez être administrateur.");
      return;
    }

    try {
      await setDoc(doc(db, "configuration_droits", actionId), {
        [profilKey]: !currentVal
      }, { merge: true });
    } catch (err) {
      console.error("Erreur lors de la mise à jour du droit :", err);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    if (userRole !== "admin") {
      alert("⛔ Action refusée : Vous devez être administrateur.");
      return;
    }
    
    const rolesDisponibles = ["mediateur", "aci", "charge_territoire", "admin"];
    const currentIndex = rolesDisponibles.indexOf(currentRole.toLowerCase());
    const nextIndex = (currentIndex + 1) % rolesDisponibles.length;
    const nuevoRole = rolesDisponibles[nextIndex];

    if (!confirm(`Changer le rôle de cet utilisateur en [${nuevoRole.toUpperCase()}] ?`)) return;

    try {
      await updateDoc(doc(db, "liste_mediateurs", userId), {
        role: nuevoRole
      });
    } catch (err) {
      console.error("Erreur lors de la modification du rôle :", err);
    }
  };

  if (userRole !== "admin") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3">
        <LockClosedIcon className="w-12 h-12 text-rose-500 animate-pulse" />
        <h1 className="text-xl font-bold">Accès Refusé</h1>
        <p className="text-xs text-slate-500">Cette page est réservée exclusivement aux administrateurs.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <ShieldCheckIcon className="w-8 h-8 text-emerald-400" />
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide">Matrice des Droits & Rôles</h1>
            <p className="text-xs text-slate-500">Configuration globale et automatique de la sécurité</p>
          </div>
        </div>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-x-auto">
          <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <span>⚙️</span> Configurer les droits d'accès en direct
          </h2>
          
          {loadingMatrix ? (
            <div className="text-xs text-slate-500 py-4 text-center animate-pulse">Configuration automatique du système de sécurité en cours...</div>
          ) : (
            <table className="w-full text-left border-collapse text-xs min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="pb-2 w-2/5">Fonctionnalité / Action</th>
                  <th className="pb-2 text-center">Médiateur</th>
                  <th className="pb-2 text-center">ACI</th>
                  <th className="pb-2 text-center">Chargé Territoire</th>
                  <th className="pb-2 text-center">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {ACTIONS_LISTE.map((act) => {
                  const medDroit = !!matrixDroits[act.id]?.mediateur;
                  const aciDroit = !!matrixDroits[act.id]?.aci;
                  const chargeDroit = !!matrixDroits[act.id]?.charge_territoire;
                  const adminDroit = !!matrixDroits[act.id]?.admin;

                  return (
                    <tr key={act.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-3 font-medium text-slate-200">{act.label}</td>
                      
                      <td className="py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={medDroit} 
                          onChange={() => handleCheckboxChange(act.id, "mediateur", medDroit)}
                          className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                        />
                      </td>

                      <td className="py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={aciDroit} 
                          onChange={() => handleCheckboxChange(act.id, "aci", aciDroit)}
                          className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer accent-amber-500"
                        />
                      </td>

                      <td className="py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={chargeDroit} 
                          onChange={() => handleCheckboxChange(act.id, "charge_territoire", chargeDroit)}
                          className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer accent-blue-500"
                        />
                      </td>

                      <td className="py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={adminDroit} 
                          onChange={() => handleCheckboxChange(act.id, "admin", adminDroit)}
                          className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-400"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Membres de l'équipe */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <UserGroupIcon className="w-5 h-5 text-blue-400" />
            <span>Membres de l'équipe ({mediateurs.length})</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mediateurs.map((m) => {
              const currentRole = m.role || "mediateur";
              
              let badgeStyle = "bg-slate-900 border-slate-800 text-slate-400";
              if (currentRole === "admin") {
                badgeStyle = "bg-emerald-950/40 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.05)]";
              } else if (currentRole === "charge_territoire") {
                badgeStyle = "bg-blue-950/40 border-blue-500/40 text-blue-400";
              } else if (currentRole === "aci") {
                badgeStyle = "bg-amber-950/40 border-amber-500/40 text-amber-400";
              }
              
              const formatRoleName = (r: string) => {
                if (r === "charge_territoire") return "Chargé Territoire";
                if (r === "aci") return "ACI";
                return r;
              };

              return (
                <div key={m.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center hover:border-slate-700 transition-colors">
                  <div>
                    <div className="font-bold text-sm text-white">{m.prenom} {m.nom}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{m.email || "Pas d'adresse email renseignée"}</div>
                  </div>
                  
                  <button
                    onClick={() => handleToggleRole(m.id, currentRole)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${badgeStyle}`}
                  >
                    {formatRoleName(currentRole)}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}
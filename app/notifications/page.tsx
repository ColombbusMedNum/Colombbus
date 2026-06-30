"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { 
  collection, onSnapshot, query, orderBy, addDoc, 
  deleteDoc, doc, getDocs, where, updateDoc, setDoc, writeBatch
} from "firebase/firestore";
import { 
  PlusIcon, TrashIcon, XMarkIcon, 
  DocumentDuplicateIcon, PencilSquareIcon, 
  UsersIcon, MapPinIcon, EyeIcon, EyeSlashIcon,
  CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon,
  CheckCircleIcon, LockClosedIcon, BellIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getWeekIdentifier(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

export default function PlanningExpertMix() {
  const [actions, setActions] = useState<any[]>([]);
  const [mediateurs, setMediateurs] = useState<any[]>([]);
  const [activitesTypes, setActivitesTypes] = useState<any[]>([]);
  const [semainesValidees, setSemainesValidees] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // États UI
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isActiviteModalOpen, setIsActiviteModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<any | null>(null);
  const [voirMasques, setVoirMasques] = useState(false); 
  const [voirSamedi, setVoirSamedi] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  // Formulaires
  const [newMed, setNewMed] = useState({ prenom: "", nom: "", poste: "", statut: "Permanent", debutACI: "09:00", finACI: "17:00", masque: false });
  const [editingMed, setEditingMed] = useState<any | null>(null);
  const [editingActivite, setEditingActivite] = useState<any | null>(null);
  const [newActivite, setNewActivite] = useState({
    lieu: "", debut: "09:00", fin: "17:00", adresse: "", territoire: "", couleur: "#6366f1", codeAnalytique: "", dateDebut: "", dateFin: ""
  });

  const currentWeekId = getWeekIdentifier(currentDate);
  const estSemaineValidee = !!semainesValidees[currentWeekId];
  const nonLuesCount = notifications.filter(n => !n.lue).length;

  const getStatusPriority = (statut: string) => {
    if (statut === "Cadre") return 1;
    if (statut === "Permanent") return 2;
    if (statut === "ACI") return 3;
    return 4;
  };

  useEffect(() => {
    const unsubActions = onSnapshot(collection(db, "planning_mediateurs"), (snap) => {
      setActions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubSemaines = onSnapshot(collection(db, "semaines_validees"), (snap) => {
      const vMap: Record<string, boolean> = {};
      snap.docs.forEach(doc => { vMap[doc.id] = doc.data().validee || false; });
      setSemainesValidees(vMap);
    });

    // Écoute des notifications (triées par date décroissante)
    const unsubNotifs = onSnapshot(collection(db, "notifications"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(list.sort((a: any, b: any) => b.createdAt - a.createdAt));
    });

    const unsubMed = onSnapshot(collection(db, "liste_mediateurs"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sortedData = data.sort((a, b) => {
        const priorityA = getStatusPriority(a.statut || "Permanent");
        const priorityB = getStatusPriority(b.statut || "Permanent");
        if (priorityA !== priorityB) return priorityA - priorityB;
        return (a.nom || "").localeCompare(b.nom || "");
      });
      setMediateurs(sortedData);
    });
    
    const unsubActs = onSnapshot(query(collection(db, "activites_types"), orderBy("lieu", "asc")), (snap) => {
      setActivitesTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubActions(); unsubMed(); unsubActs(); unsubSemaines(); unsubNotifs(); };
  }, []);

  const toggleValidationSemaine = async () => {
    try {
      const nouvelEtat = !estSemaineValidee;
      await setDoc(doc(db, "semaines_validees", currentWeekId), {
        validee: nouvelEtat
      });

      // Si on valide la semaine, on pousse une notification d'alerte générale
      if (nouvelEtat === true) {
        await addDoc(collection(db, "notifications"), {
          message: `📅 Le planning de la semaine du ${monday.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})} a été validé et verrouillé.`,
          createdAt: Date.now(),
          lue: false
        });
      }
    } catch (error) {
      console.error("Erreur lors de la validation :", error);
    }
  };

  const marquerToutCommeLu = async () => {
    const batch = writeBatch(db);
    notifications.forEach(n => {
      if (!n.lue) {
        batch.update(doc(db, "notifications", n.id), { lue: true });
      }
    });
    await batch.commit();
  };

  const effacerNotifications = async () => {
    if (!confirm("Effacer tout l'historique des notifications ?")) return;
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, "notifications", n.id));
    });
    await batch.commit();
    setIsNotifOpen(false);
  };

  const toggleMasqueMed = async (m: any) => {
    await updateDoc(doc(db, "liste_mediateurs", m.id), { masque: !m.masque });
  };

  const handleSaveActiviteType = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!newActivite.lieu.trim()) return;
    const dataPayload = {
      lieu: newActivite.lieu.trim(), debut: newActivite.debut, fin: newActivite.fin, adresse: newActivite.adresse.trim(), territoire: newActivite.territoire, couleur: newActivite.couleur, codeAnalytique: newActivite.codeAnalytique.trim(), dateDebut: newActivite.dateDebut, dateFin: newActivite.dateFin
    };
    if (editingActivite) {
      await updateDoc(doc(db, "activites_types", editingActivite.id), dataPayload);
    } else {
      await addDoc(collection(db, "activites_types"), dataPayload);
    }
    setNewActivite({ lieu: "", debut: "09:00", fin: "17:00", adresse: "", territoire: "", couleur: "#6366f1", codeAnalytique: "", dateDebut: "", dateFin: "" });
    setEditingActivite(null); setIsActiviteModalOpen(false);
  };

  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
    const mon = new Date(date.setDate(diff));
    mon.setHours(12, 0, 0, 0);
    return mon;
  };
  const monday = getMonday(currentDate);
  const totalDays = voirSamedi ? 6 : 5;
  const weekDays = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
  });

  const handleCaseClick = async (mediatId: string, prenom: string, nom: string, moment: string, dateStr: string) => {
    if (estSemaineValidee) {
      alert("🔒 Impossible d'ajouter une activité : Cette semaine a été validée et verrouillée.");
      return;
    }
    let lieu = selectedModel ? selectedModel.lieu : prompt(`Nouvelle action pour ${prenom} ${nom} (${moment}) :`);
    if (!lieu) return;

    const upperLieu = lieu.toUpperCase();
    const isSuresnesAction = upperLieu.includes("RN") || upperLieu.includes("RND");
    const nomCompletLiaison = `${prenom} ${nom}`.trim();

    const qSuresnes = query(collection(db, "planning_suresnes"), where("date", "==", dateStr), where("moment", "==", moment), where("mediateurNom", "==", nomCompletLiaison));
    const snapSuresnes = await getDocs(qSuresnes);
    const hasUsagers = snapSuresnes.docs.some(d => d.data().usager && d.data().usager.trim() !== "");

    if (hasUsagers && !isSuresnesAction) {
      const nouveauNom = prompt(`⚠️ TRANSFERT OBLIGATOIRE : ${prenom} ${nom} a des usagers inscrits à Suresnes.\n\nEntrez le nom complet du médiateur qui récupère ces rendez-vous :`);
      if (nouveauNom) {
        const transfers = snapSuresnes.docs.map(d => updateDoc(doc(db, "planning_suresnes", d.id), { mediateurNom: nouveauNom }));
        await Promise.all(transfers);
      } else return;
    }

    await addDoc(collection(db, "planning_mediateurs"), {
      mediateurId: mediatId, mediateurNom: nomCompletLiaison, moment, date: dateStr, lieu, type: "Action", couleur: selectedModel?.couleur || "#6366f1",
      ...(selectedModel?.adresse ? { adresse: selectedModel.adresse } : {}), ...(selectedModel?.debut ? { debut: selectedModel.debut, fin: selectedModel.fin } : {}), ...(selectedModel?.territoire ? { territoire: selectedModel.territoire } : {}), ...(selectedModel?.codeAnalytique ? { codeAnalytique: selectedModel.codeAnalytique } : {}) 
    });
  };

  const deleteAction = async (id: string) => {
    if (estSemaineValidee) { alert("🔒 Semaine verrouillée."); return; }
    if (!confirm("Supprimer cette action ?")) return;
    await deleteDoc(doc(db, "planning_mediateurs", id));
  };

  const todayStr = new Date().toLocaleDateString('en-CA');

  return (
    <main className="min-h-screen bg-slate-950 text-white pl-4 pt-[55px]">
      
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-5 py-2.5 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 bg-slate-900 border border-slate-800 rounded-md text-slate-400 hover:text-white mr-1 cursor-pointer">
            {isSidebarOpen ? <ChevronLeftIcon className="w-4 h-4"/> : <ChevronRightIcon className="w-4 h-4"/>}
          </button>
          <Link href="/" className="text-lg font-bold">Accueil</Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 mr-2">Agenda des médiateurs</span>

          {/* BOUTON VALIDATION */}
          <button
            onClick={toggleValidationSemaine}
            className={`px-3 py-1 rounded-md text-xs transition-all border flex items-center gap-1.5 cursor-pointer font-semibold ${
              estSemaineValidee ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-400" : "bg-amber-950/30 border-amber-500/20 text-amber-500 hover:border-amber-500/40"
            }`}
          >
            {estSemaineValidee ? (
              <><LockClosedIcon className="w-3.5 h-3.5 text-emerald-400"/> Semaine Validée</>
            ) : (
              <><CheckCircleIcon className="w-3.5 h-3.5 text-amber-500 animate-pulse"/> En cours de validation</>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 relative">
          
          {/* MENU CLOCHE NOTIFICATIONS */}
          <div className="relative">
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)} 
              className="p-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-300 hover:text-white relative cursor-pointer"
            >
              <BellIcon className="w-4 h-4" />
              {nonLuesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[9px] font-black text-white rounded-full flex items-center justify-center animate-bounce">
                  {nonLuesCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 p-3 space-y-2">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-300">Notifications ({notifications.length})</span>
                  <div className="flex gap-2">
                    {nonLuesCount > 0 && (
                      <button onClick={marquerToutCommeLu} className="text-[10px] text-blue-400 hover:underline">Tout lire</button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={effacerNotifications} className="text-[10px] text-rose-400 hover:underline">Effacer</button>
                    )}
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {notifications.length === 0 ? (
                    <div className="text-center py-4 text-slate-500 text-[11px]">Aucune alerte pour le moment</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={`p-2 rounded-lg text-[11px] leading-tight border ${n.lue ? 'bg-slate-950/40 border-slate-900/60 text-slate-400' : 'bg-slate-950 border-blue-500/20 text-slate-200 font-medium'}`}>
                        {n.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5">
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-7); setCurrentDate(d); }} className="text-slate-400 cursor-pointer text-[11px] px-1">←</button>
            <span className="text-[11px] font-medium text-slate-300 min-w-28 text-center">Sem. du {monday.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}</span>
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()+7); setCurrentDate(d); }} className="text-slate-400 cursor-pointer text-[11px] px-1">→</button>
          </div>

          <button onClick={() => setVoirSamedi(!voirSamedi)} className={`px-3 py-1 rounded-md text-xs border cursor-pointer font-medium ${voirSamedi ? "bg-amber-950/40 border-amber-900/40 text-amber-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}>
            {voirSamedi ? "Masquer Samedi" : "Afficher Samedi"}
          </button>

          <button onClick={() => setVoirMasques(!voirMasques)} className={`px-3 py-1 rounded-md text-xs border cursor-pointer font-medium ${voirMasques ? "bg-rose-950/40 border-rose-900/40 text-rose-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}>
            {voirMasques ? "Agenda épuré" : "Lignes masquées"}
          </button>
        </div>
      </header>

      {/* DISPOSITION SIDEBAR + TABLEAU */}
      <div className="max-w-8xl mx-auto py-6 pr-4 flex gap-4">
        <aside className={`shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5 transition-all ${isSidebarOpen ? "w-52 block" : "w-0 p-0 border-0 hidden"}`}>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Modèles</div>
          <div className="space-y-1.5 pt-1.5 border-t border-slate-800/60">
            {activitesTypes.map(type => (
              <div 
                key={type.id} 
                onClick={() => !estSemaineValidee && setSelectedModel(type)} 
                style={{ backgroundColor: hexToRgba(type.couleur || "#6366f1", selectedModel?.id === type.id ? 0.25 : 0.12), borderColor: type.couleur }} 
                className="p-2 rounded-lg text-xs border cursor-pointer text-slate-200"
              >
                {type.lieu}
              </div>
            ))}
          </div>
        </aside>

        {/* GRILLE DU PLANNING */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-x-auto">
          <table className="border-collapse text-xs w-full table-fixed">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="text-left pb-2 w-[160px]">Médiateur</th>
                {weekDays.map(d => (
                  <th key={d.toString()} className="text-center pb-2">
                    <span className="font-semibold text-slate-300 uppercase">{d.toLocaleDateString('fr-FR', { weekday: 'short' })} </span>
                    <span className="text-[10px] font-normal">{d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {mediateurs.filter(m => m.actif !== false && (voirMasques ? true : !m.masque)).map(m => (
                <tr key={m.id} className="hover:bg-slate-950/10">
                  <td className="py-2 font-bold text-white w-[160px]">{m.prenom} <span className="uppercase text-slate-400 block text-xs font-normal">{m.nom}</span></td>
                  {weekDays.map(day => {
                    const dateStr = day.toLocaleDateString('en-CA');
                    return (
                      <td key={dateStr} className="p-1 border-l border-slate-800/30">
                        <div className="grid grid-cols-2 gap-1 min-h-[38px]">
                          <DayCell actions={actions} m={m} moment="Matin" date={dateStr} onAdd={() => handleCaseClick(m.id, m.prenom, m.nom, "Matin", dateStr)} onDelete={deleteAction} estSemaineValidee={estSemaineValidee} />
                          <DayCell actions={actions} m={m} moment="Après-midi" date={dateStr} onAdd={() => handleCaseClick(m.id, m.prenom, m.nom, "Après-midi", dateStr)} onDelete={deleteAction} estSemaineValidee={estSemaineValidee} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function DayCell({ actions, m, moment, date, onAdd, onDelete, estSemaineValidee }: any) {
  const mNomComplet = `${m.prenom || ""} ${m.nom || ""}`.trim();
  const filtered = actions.filter((a: any) => (a.mediateurId === m.id || a.mediateurNom === mNomComplet) && a.date === date && a.moment === moment);
  return (
    <div className="flex flex-col h-full justify-start gap-1 min-h-[36px] p-0.5">
      {filtered.map((a: any) => (
        <div key={a.id} style={{ backgroundColor: hexToRgba(a.couleur || "#6366f1", 0.15), borderColor: a.couleur, color: a.couleur }} className="px-1.5 py-0.5 rounded border text-[9px] flex items-center justify-between w-full">
          <span className="truncate text-slate-200">{a.lieu}</span>
          {!estSemaineValidee && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(a.id); }} className="text-slate-500 hover:text-red-400"><TrashIcon className="w-2.5 h-2.5"/></button>
          )}
        </div>
      ))}
      {filtered.length === 0 && (
        <button onClick={onAdd} disabled={estSemaineValidee} className={`w-full h-full min-h-[26px] border border-dashed rounded text-[10px] ${estSemaineValidee ? "border-slate-900 text-slate-800 cursor-not-allowed" : "border-slate-800/40 text-slate-600 hover:text-slate-400 cursor-pointer"}`}>
          {moment === "Matin" ? "AM" : "PM"}
        </button>
      )}
    </div>
  );
}
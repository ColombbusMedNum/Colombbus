"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { 
  collection, onSnapshot, query, orderBy, addDoc, 
  deleteDoc, doc, getDocs, where, updateDoc 
} from "firebase/firestore";
import { 
  PlusIcon, TrashIcon, XMarkIcon, 
  DocumentDuplicateIcon, PencilSquareIcon, 
  UsersIcon, MapPinIcon, EyeIcon, EyeSlashIcon,
  CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";

// Fonction utilitaire pour convertir un Hex (#RRGGBB) en RGBA pour gérer l'opacité du fond sur fond noir
function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function PlanningExpertMix() {
  const [actions, setActions] = useState<any[]>([]);
  const [mediateurs, setMediateurs] = useState<any[]>([]);
  const [activitesTypes, setActivitesTypes] = useState<any[]>([]);
  
  // États UI
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isActiviteModalOpen, setIsActiviteModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<any | null>(null);
  const [voirMasques, setVoirMasques] = useState(false); 
  const [voirSamedi, setVoirSamedi] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Formulaires Médiateurs
  const [newMed, setNewMed] = useState({ prenom: "", nom: "", poste: "", statut: "Permanent", debutACI: "09:00", finACI: "17:00", masque: false });
  const [editingMed, setEditingMed] = useState<any | null>(null);
  
  // Formulaire Activité Type
  const [editingActivite, setEditingActivite] = useState<any | null>(null);
  const [newActivite, setNewActivite] = useState({
    lieu: "",
    debut: "09:00",
    fin: "17:00",
    adresse: "",
    territoire: "",
    couleur: "#6366f1",
    codeAnalytique: "" 
  });

  // Fonction pour définir le poids du tri des statuts
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

    const unsubMed = onSnapshot(collection(db, "liste_mediateurs"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Tri par ordre de priorité de statut, puis par Nom de famille par ordre alphabétique
      const sortedData = data.sort((a, b) => {
        const priorityA = getStatusPriority(a.statut || "Permanent");
        const priorityB = getStatusPriority(b.statut || "Permanent");
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        return (a.nom || "").localeCompare(b.nom || "");
      });

      setMediateurs(sortedData);
    });
    
    const unsubActs = onSnapshot(query(collection(db, "activites_types"), orderBy("lieu", "asc")), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (docs.length === 0 && snap.metadata.fromCache === false) {
        const initiales = [
          { lieu: "RN Suresnes", debut: "10:00", fin: "17:00", adresse: "Hôtel de Ville, Suresnes", territoire: "92", couleur: "#6366f1", codeAnalytique: "" },
          { lieu: "RND Suresnes", debut: "10:00", fin: "17:00", adresse: "Hôtel de Ville, Suresnes", territoire: "92", couleur: "#475569", codeAnalytique: "" },
          { lieu: "Bureau", debut: "09:00", fin: "17:00", adresse: "Siège social", territoire: "", couleur: "#94a3b8", codeAnalytique: "" },
          { lieu: "Réunion", debut: "14:00", fin: "16:00", adresse: "Salle Polyvalente", territoire: "", couleur: "#f59e0b", codeAnalytique: "" },
          { lieu: "Déplacement", debut: "09:00", fin: "18:00", adresse: "Extérieur", territoire: "", couleur: "#0ea5e9", codeAnalytique: "" },
          { lieu: "Congés", debut: "00:00", fin: "23:59", adresse: "-", territoire: "", couleur: "#f43f5e", codeAnalytique: "" }
        ];
        initiales.forEach(act => addDoc(collection(db, "activites_types"), act));
      } else {
        setActivitesTypes(docs);
      }
    });

    return () => { unsubActions(); unsubMed(); unsubActs(); };
  }, []);

  const toggleMasqueMed = async (m: any) => {
    try {
      await updateDoc(doc(db, "liste_mediateurs", m.id), {
        masque: !m.masque
      });
    } catch (error) {
      console.error("Erreur lors du changement de statut de visibilité :", error);
    }
  };

  const handleSaveActiviteType = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!newActivite.lieu.trim()) return;
    
    try {
      const dataPayload = {
        lieu: newActivite.lieu.trim(),
        debut: newActivite.debut,
        fin: newActivite.fin,
        adresse: newActivite.adresse.trim(),
        territoire: newActivite.territoire,
        couleur: newActivite.couleur,
        codeAnalytique: newActivite.codeAnalytique.trim() 
      };

      if (editingActivite) {
        await updateDoc(doc(db, "activites_types", editingActivite.id), dataPayload);
        if (selectedModel?.id === editingActivite.id) {
          setSelectedModel({ id: editingActivite.id, ...dataPayload });
        }
      } else {
        await addDoc(collection(db, "activites_types"), dataPayload);
      }
      
      setNewActivite({ lieu: "", debut: "09:00", fin: "17:00", adresse: "", territoire: "", couleur: "#6366f1", codeAnalytique: "" });
      setEditingActivite(null);
      setIsActiviteModalOpen(false);
    } catch (error) {
      console.error("Erreur lors du sauvegarde du modèle :", error);
    }
  };

  const handleOpenEditActivite = (type: any, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setEditingActivite(type);
    setNewActivite({
      lieu: type.lieu || "",
      debut: type.debut || "09:00",
      fin: type.fin || "17:00",
      adresse: type.adresse || "",
      territoire: type.territoire || "",
      couleur: type.couleur || "#6366f1",
      codeAnalytique: type.codeAnalytique || "" 
    });
    setIsActiviteModalOpen(true);
  };

  const handleDeleteActiviteType = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!confirm("Supprimer ce modèle de la liste de gauche ?")) return;
    await deleteDoc(doc(db, "activites_types", id));
    if (selectedModel?.id === id) setSelectedModel(null);
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
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const handleCaseClick = async (mediatId: string, prenom: string, nom: string, moment: string, dateStr: string) => {
    let lieu = selectedModel ? selectedModel.lieu : prompt(`Nouvelle action pour ${prenom} ${nom} (${moment}) :`);
    if (!lieu) return;

    const upperLieu = lieu.toUpperCase();
    const isSuresnesAction = upperLieu.includes("RN") || upperLieu.includes("RND");
    
    // On recrée l'identifiant textuel complet pour l'agenda Suresnes
    const nomCompletLiaison = `${prenom} ${nom}`.trim();

    const qSuresnes = query(
      collection(db, "planning_suresnes"),
      where("date", "==", dateStr),
      where("moment", "==", moment),
      where("mediateurNom", "==", nomCompletLiaison)
    );
    const snapSuresnes = await getDocs(qSuresnes);
    const hasUsagers = snapSuresnes.docs.some(d => d.data().usager && d.data().usager.trim() !== "");

    if (hasUsagers && !isSuresnesAction) {
      const nouveauNom = prompt(
        `⚠️ TRANSFERT OBLIGATOIRE : ${prenom} ${nom} a des usagers inscrits à Suresnes.\n\n` +
        `Entrez le nom complet du médiateur qui récupère ces rendez-vous :`
      );

      if (nouveauNom) {
        const transfers = snapSuresnes.docs.map(d => 
          updateDoc(doc(db, "planning_suresnes", d.id), { mediateurNom: nouveauNom })
        );
        await Promise.all(transfers);
        alert(`Succès : Les usagers de Suresnes sont maintenant affectés à ${nouveauNom}.`);
      } else {
        alert("Action annulée.");
        return;
      }
    }

    const deletes = snapSuresnes.docs.map(d => 
        (!d.data().usager ? deleteDoc(doc(db, "planning_suresnes", d.id)) : Promise.resolve())
    );
    await Promise.all(deletes);

    await addDoc(collection(db, "planning_mediateurs"), {
      mediateurId: mediatId, 
      mediateurNom: nomCompletLiaison, 
      moment, 
      date: dateStr, 
      lieu, 
      type: "Action",
      couleur: selectedModel?.couleur || "#6366f1",
      ...(selectedModel?.adresse ? { adresse: selectedModel.adresse } : {}),
      ...(selectedModel?.debut ? { debut: selectedModel.debut, fin: selectedModel.fin } : {}),
      ...(selectedModel?.territoire ? { territoire: selectedModel.territoire } : {}),
      ...(selectedModel?.codeAnalytique ? { codeAnalytique: selectedModel.codeAnalytique } : {}) 
    });

    if (isSuresnesAction) {
      const horaires = moment === "Matin" ? ["10h00 - 11h30", "11h30 - 13h00"] : ["14h00 - 15h30", "15h30 - 17h00"];
      const isRND = upperLieu.includes("RND");
      const nomAvecType = isRND ? `${nomCompletLiaison} (RND)` : `${nomCompletLiaison} (RN)`;

      for (const h of horaires) {
        await addDoc(collection(db, "planning_suresnes"), {
          mediateurNom: nomAvecType,
          date: dateStr, 
          moment, 
          horaire: h, 
          usager: ""
        });
      }
    }
  };

  const deleteAction = async (id: string) => {
    if (!confirm("Supprimer cette action ?")) return;

    const actionDoc = actions.find(a => a.id === id);
    if (!actionDoc) return;

    const qSuresnes = query(
      collection(db, "planning_suresnes"),
      where("date", "==", actionDoc.date),
      where("moment", "==", actionDoc.moment)
    );
    
    const snapSuresnes = await getDocs(qSuresnes);
    const docsDuMediateur = snapSuresnes.docs.filter(d => {
      const mNom = d.data().mediateurNom || "";
      const cible = actionDoc.mediateurNom || "";
      return mNom === cible || mNom === `${cible} (RN)` || mNom === `${cible} (RND)`;
    });

    const hasUsagers = docsDuMediateur.some(d => d.data().usager && d.data().usager.trim() !== "");

    if (hasUsagers) {
      alert("⚠️ Suppression impossible : Des usagers sont inscrits sur vos créneaux à Suresnes.");
      return; 
    }

    const deletesSuresnes = docsDuMediateur.map(d => deleteDoc(doc(db, "planning_suresnes", d.id)));
    await Promise.all(deletesSuresnes);
    await deleteDoc(doc(db, "planning_mediateurs", id));
  };

  const getBadgeTerritoireColor = (site: string) => {
    if (!site) return "bg-slate-800 text-slate-400 border-slate-700/60";
    const dep = site.trim().substring(0, 2);
    if (dep === "75") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (dep === "91") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white pl-4 pt-[55px]">
      
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-5 py-2.5 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-md text-slate-400 hover:text-white transition-all cursor-pointer mr-1"
            title={isSidebarOpen ? "Masquer les modèles" : "Afficher les modèles"}
          >
            {isSidebarOpen ? <ChevronLeftIcon className="w-4 h-4"/> : <ChevronRightIcon className="w-4 h-4"/>}
          </button>
          
          <Link href="/" className="text-lg tracking-tight text-white hover:opacity-80 transition-opacity font-bold">
            Accueil
          </Link>
          <span className="text-slate-600">/</span>
            Agenda des médiateurs
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5">
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-7); setCurrentDate(d); }} className="text-slate-400 hover:text-white transition-colors cursor-pointer text-[11px] px-1">←</button>
            <span className="text-[11px] font-medium text-slate-300 min-w-28 text-center">Sem. du {monday.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}</span>
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()+7); setCurrentDate(d); }} className="text-slate-400 hover:text-white transition-colors pointer-events-auto cursor-pointer text-[11px] px-1">→</button>
          </div>

          {selectedModel && (
            <div className="bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-md text-[11px] flex items-center gap-2 animate-pulse">
              <span className="font-medium">Injection : {selectedModel.lieu}</span>
              <button onClick={() => setSelectedModel(null)} className="text-slate-400 hover:text-white transition-colors p-0.5 bg-slate-800 rounded">
                <XMarkIcon className="w-3 h-3 stroke-[3]"/>
              </button>
            </div>
          )}

          <button
            onClick={() => setVoirSamedi(!voirSamedi)}
            className={`px-3 py-1 rounded-md text-xs transition-colors border flex items-center gap-1.5 cursor-pointer font-medium ${
              voirSamedi ? "bg-amber-950/40 border-amber-900/40 text-amber-400" : "bg-slate-900 border-slate-800 text-slate-400"
            }`}
          >
            <CalendarDaysIcon className="w-3.5 h-3.5"/>
            {voirSamedi ? "Masquer le Samedi" : "Afficher le Samedi"}
          </button>

          <button
            onClick={() => setVoirMasques(!voirMasques)}
            className={`px-3 py-1 rounded-md text-xs transition-colors border flex items-center gap-1.5 cursor-pointer font-medium ${
              voirMasques ? "bg-rose-950/40 border-rose-900/40 text-rose-400" : "bg-slate-900 border-slate-800 text-slate-400"
            }`}
          >
            {voirMasques ? <><EyeIcon className="w-3.5 h-3.5"/> Agenda épuré</> : <><EyeSlashIcon className="w-3.5 h-3.5"/> Lignes masquées</>}
          </button>

          <Link href="/adresses" className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1 rounded-md text-xs flex items-center gap-1.5">
            <MapPinIcon className="w-3.5 h-3.5 text-slate-400"/> Adresses
          </Link>

          <Link href="/equipe" className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1.5 font-medium">
            <UsersIcon className="w-3.5 h-3.5 text-slate-400"/> Staff
          </Link>

          <Link 
            href="/suresnes" 
            className="bg-blue-900 hover:bg-blue-800 text-blue-100 border border-blue-800 px-3 py-1 rounded-md text-xs transition-colors flex items-center gap-1.5 font-medium"
          >
            <CalendarDaysIcon className="w-3.5 h-3.5 text-blue-300"/> Agenda Suresnes
          </Link>
        </div>
      </header>

      {/* BOX PRINCIPALE */}
      <div className="max-w-8xl mx-auto py-6 pr-4 flex gap-4 transition-all duration-300">
        
        {/* SIDEBAR MODÈLES */}
        <aside className={`shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5 self-start transition-all duration-350 ${isSidebarOpen ? "w-52 opacity-100 transform translate-x-0" : "w-0 p-0 border-0 opacity-0 pointer-events-none -translate-x-4"}`}>
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <DocumentDuplicateIcon className="w-3.5 h-3.5 text-slate-500" /> Modèles
            </div>
            <button 
              onClick={() => { setEditingActivite(null); setNewActivite({ lieu: "", debut: "09:00", fin: "17:00", adresse: "", territoire: "", couleur: "#6366f1", codeAnalytique: "" }); setIsActiviteModalOpen(true); }} 
              className="p-1 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1.5 pt-1.5 border-t border-slate-800/60">
            {activitesTypes.map(type => {
              const hexColor = type.couleur || "#6366f1";
              const isSelected = selectedModel?.id === type.id;

              const customStyle = {
                backgroundColor: hexToRgba(hexColor, isSelected ? 0.25 : 0.12),
                borderColor: isSelected ? hexColor : hexToRgba(hexColor, 0.4),
                color: hexColor,
                boxShadow: isSelected ? `0 0 8px ${hexToRgba(hexColor, 0.4)}` : "none"
              };

              return (
                <div 
                  key={type.id}
                  onClick={() => setSelectedModel(type)}
                  style={customStyle}
                  className={`group/item w-full flex flex-col p-2 rounded-lg text-xs transition-all cursor-pointer border ${isSelected ? 'ring-1 ring-white/20' : 'hover:brightness-125'}`}
                >
                  <div className="w-full flex items-center justify-between">
                    <span className="truncate font-medium flex items-center gap-1.5 text-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hexColor }}></span>
                      <span className="truncate">{type.lieu}</span> 
                      {type.territoire && <span className="text-[10px] opacity-60 bg-slate-950 px-1 rounded text-slate-300">{type.territoire}</span>}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <button onClick={(e) => handleOpenEditActivite(type, e)} className="text-slate-400 hover:text-white p-0.5">
                        <PencilSquareIcon className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => handleDeleteActiviteType(type.id, e)} className="text-slate-500 hover:text-red-400 p-0.5">
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {type.debut && <div className="text-[9px] text-slate-500 font-mono mt-0.5 pl-3">{type.debut} - {type.fin}</div>}
                </div>
              );
            })}
          </div>
        </aside>

        {/* GRILLE PLANNING */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-x-auto transition-all duration-300">
          <table className="border-collapse text-xs w-full table-fixed">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left pr-2 pb-2 w-[160px] text-slate-500 font-medium text-[11px]">Médiateur</th>
                {weekDays.map(d => (
                  <th key={d.toString()} className="text-center pb-2 px-1">
                    <span className="font-semibold text-slate-300 uppercase">{d.toLocaleDateString('fr-FR', { weekday: 'short' })} </span>
                    <span className="text-slate-500 text-[10px] font-normal">{d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {mediateurs
                .filter(m => m.actif !== false)
                .filter(m => voirMasques ? true : !m.masque)
                .map(m => {
                  const pNom = m.prenom || "";
                  const fNom = m.nom || "";
                  return (
                    <tr key={m.id} className={`hover:bg-slate-950/10 ${m.masque ? 'opacity-35 bg-slate-950/40 border-dashed' : ''}`}>
                      <td className="pr-2 py-2 sticky left-0 bg-slate-900 z-10 w-[160px]">
                        <div className="flex items-start justify-between gap-2">
                          <div className={`flex flex-col text-[13px] leading-tight select-none ${m.masque ? 'line-through text-slate-500' : ''}`}>
                            <span className="font-bold text-white whitespace-normal break-words">{pNom}</span>
                            {fNom && <span className="font-medium text-slate-300 text-xs whitespace-normal break-words mt-0.5 uppercase">{fNom}</span>}
                          </div>
                          
                          <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                            <button onClick={() => toggleMasqueMed(m)} className={`p-0.5 rounded ${m.masque ? 'text-rose-400' : 'text-slate-600 hover:text-rose-400'}`}>
                              {m.masque ? <EyeSlashIcon className="w-3.5 h-3.5"/> : <EyeIcon className="w-3.5 h-3.5"/>}
                            </button>
                            <button onClick={() => { setEditingMed(m); setNewMed({ prenom: m.prenom || "", nom: m.nom || "", poste: m.poste || "", statut: m.statut || "Permanent", debutACI: m.debutACI || "09:00", finACI: m.finACI || "17:00", masque: m.masque || false }); setIsUserModalOpen(true); }} className="text-slate-600 hover:text-slate-400 p-0.5">
                              <PencilSquareIcon className="w-3 h-3"/>
                            </button>
                          </div>
                        </div>
                        
                        {m.statut === 'ACI' && (
                          <div className="mt-1.5">
                            <span className={`inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${getBadgeTerritoireColor(m.sitePrincipal)}`}>
                              ACI
                            </span>
                          </div>
                        )}
                      </td>

                      {weekDays.map(day => {
                        const dateStr = day.toLocaleDateString('en-CA');
                        return (
                          <td key={dateStr} className="p-1 border-l border-slate-800/30 align-middle">
                            <div className="grid grid-cols-2 gap-1 min-h-[38px]">
                              <DayCell actions={actions} m={m} moment="Matin" date={dateStr} onAdd={() => handleCaseClick(m.id, pNom, fNom, "Matin", dateStr)} onDelete={deleteAction} />
                              <DayCell actions={actions} m={m} moment="Après-midi" date={dateStr} onAdd={() => handleCaseClick(m.id, pNom, fNom, "Après-midi", dateStr)} onDelete={deleteAction} />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALE STAFF */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <form onSubmit={async (e) => {
            e.preventDefault();
            editingMed ? await updateDoc(doc(db, "liste_mediateurs", editingMed.id), newMed) : await addDoc(collection(db, "liste_mediateurs"), newMed);
            setIsUserModalOpen(false);
          }} className="bg-slate-900 border border-slate-800 p-5 rounded-xl w-full max-w-xs space-y-3">
            <h3 className="font-semibold text-sm">{editingMed ? "Modifier le staff" : "Nouveau staff"}</h3>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Prénom" value={newMed.prenom} className="field-dark" required onChange={e => setNewMed({...newMed, prenom: e.target.value})} />
              <input placeholder="Nom" value={newMed.nom} className="field-dark" required onChange={e => setNewMed({...newMed, nom: e.target.value})} />
            </div>
            <input placeholder="Poste" value={newMed.poste} className="field-dark" onChange={e => setNewMed({...newMed, poste: e.target.value})} />
            <select className="field-dark" value={newMed.statut} onChange={e => setNewMed({...newMed, statut: e.target.value})}>
              <option value="Cadre">Cadre</option>
              <option value="Permanent">Permanent</option>
              <option value="ACI">ACI</option>
            </select>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 bg-blue-600 py-1.5 rounded-md text-xs font-medium">Sauver</button>
              <button type="button" onClick={() => { setIsUserModalOpen(false); setEditingMed(null); }} className="text-slate-400 text-xs px-2">Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE ACTIVITE */}
      {isActiviteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <form onSubmit={handleSaveActiviteType} className="bg-slate-900 border border-slate-800 p-5 rounded-xl w-full max-w-xs space-y-3">
            <h3 className="font-semibold text-sm">{editingActivite ? "Modifier le Modèle" : "Nouveau Modèle"}</h3>
            <input placeholder="Nom de l'activité" value={newActivite.lieu} className="field-dark" required onChange={e => setNewActivite({...newActivite, lieu: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <input type="time" className="field-dark" value={newActivite.debut} onChange={e => setNewActivite({...newActivite, debut: e.target.value})} />
              <input type="time" className="field-dark" value={newActivite.fin} onChange={e => setNewActivite({...newActivite, fin: e.target.value})} />
            </div>
            <input placeholder="Adresse (Optionnel)" value={newActivite.adresse} className="field-dark" onChange={e => setNewActivite({...newActivite, adresse: e.target.value})} />
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-medium font-mono">Territoire</label>
              <select className="field-dark" value={newActivite.territoire} onChange={e => setNewActivite({...newActivite, territoire: e.target.value})}>
                <option value="">Aucun</option>
                <option value="75">75 (Paris)</option>
                <option value="91">91 (Essonne)</option>
                <option value="92">92 (Hauts-de-Seine)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-medium font-mono">Code analytique (Stats)</label>
              <input 
                placeholder="Ex: C-2026, STAT_A..." 
                value={newActivite.codeAnalytique} 
                className="field-dark" 
                onChange={e => setNewActivite({...newActivite, codeAnalytique: e.target.value})} 
              />
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-[10px] text-slate-400 font-medium font-mono">Couleur personnalisée</label>
              <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-md p-2">
                <input 
                  type="color" 
                  value={newActivite.couleur} 
                  onChange={e => setNewActivite({...newActivite, couleur: e.target.value})}
                  className="w-8 h-8 rounded cursor-pointer border border-slate-700 bg-transparent"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-semibold text-slate-300 uppercase">{newActivite.couleur}</span>
                  <span className="text-[10px] text-slate-500">Cliquez pour ajuster</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 py-1.5 rounded-md text-xs font-medium">
                {editingActivite ? "Enregistrer" : "Ajouter"}
              </button>
              <button type="button" onClick={() => { setIsActiviteModalOpen(false); setEditingActivite(null); }} className="text-slate-400 text-xs px-2">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <style jsx>{`
        .field-dark {
          @apply w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white outline-none focus:border-slate-700 transition-colors;
        }
      `}</style>
    </main>
  );
}

// Composant de cellule pour chaque moment de la journée
function DayCell({ actions, m, moment, date, onAdd, onDelete }: any) {
  const mNomComplet = `${m.prenom || ""} ${m.nom || ""}`.trim();
  const filtered = actions.filter((a: any) => 
    (a.mediateurId === m.id || a.mediateur === mNomComplet || a.mediateurNom === mNomComplet) && 
    a.date === date && 
    a.moment === moment
  );
  
  return (
    <div className="flex flex-col relative group/cell h-full justify-start gap-1 min-h-[36px] bg-slate-950/20 p-0.5 rounded border border-transparent hover:border-slate-800/40 transition-colors">
      
      {filtered.map((a: any) => {
        const territoire = a.territoire || "";
        const hexColor = a.couleur || "#6366f1";

        const cellStyle = {
          backgroundColor: hexToRgba(hexColor, 0.15),
          borderColor: hexToRgba(hexColor, 0.4),
          color: hexColor
        };

        return (
          <div 
            key={a.id} 
            style={cellStyle}
            className="px-1.5 py-0.5 rounded border text-[9px] font-medium flex items-center justify-between w-full min-h-[22px] hover:brightness-125 transition-all"
          >
            <span className="truncate pr-0.5 text-slate-200" title={`${moment} : ${a.lieu}`}>
              {a.lieu} {territoire && <span className="text-[8px] opacity-50">[{territoire}]</span>}
            </span>
            <button onClick={(e) => { e.stopPropagation(); onDelete(a.id); }} className="text-slate-500 hover:text-red-400 p-0.5 shrink-0">
              <TrashIcon className="w-2.5 h-2.5"/>
            </button>
          </div>
        );
      })}

      {filtered.length === 0 ? (
        <button 
          onClick={onAdd} 
          className="w-full h-full min-h-[26px] border border-dashed border-slate-800/40 hover:border-slate-700/80 rounded flex items-center justify-center text-slate-600 hover:text-slate-400 transition-all text-[10px] cursor-pointer"
        >
          <span className="text-slate-700 text-[9px] group-hover/cell:text-slate-500">
            {moment === "Matin" ? "AM" : "PM"}
          </span>
        </button>
      ) : (
        <button
          onClick={onAdd}
          className="opacity-0 group-hover/cell:opacity-100 transition-opacity w-full py-0.5 bg-slate-900/80 border border-dashed border-slate-700 hover:border-slate-500 rounded flex items-center justify-center text-slate-400 hover:text-white text-[8px] font-medium cursor-pointer"
        >
          + Autre
        </button>
      )}
    </div>
  );
}
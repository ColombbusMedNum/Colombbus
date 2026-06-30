"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { 
  ArrowLeftIcon, 
  PlusIcon, 
  TrashIcon,
  MapPinIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

// Interfaces pour la structure Lieu > Trimestre
interface TrimestreStats {
  hommes: number;
  femmes: number;
  total: number;
}

interface LieuStats {
  totalGlobal: number;
  trimestres: Record<string, TrimestreStats>;
  commentaires: string[];
}

export default function ActionsCollectivesPage() {
  const [actions, setActions] = useState<any[]>([]);
  const [listeLieuxExistants, setListeLieuxExistants] = useState<string[]>([]);
  const [statsParLieu, setStatsParLieu] = useState<Record<string, LieuStats>>({});
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState("");

  // États du formulaire de création
  const [lieuSelectionne, setLieuSelectionne] = useState("");
  const [nouveauLieu, setNouveauLieu] = useState("");
  const [isNouveauLieu, setIsNouveauLieu] = useState(false);
  const [thematique, setThematique] = useState("");
  const [nbHommes, setNbHommes] = useState<number | "">("");
  const [nbFemmes, setNbFemmes] = useState<number | "">("");
  const [commentaire, setCommentaire] = useState("");

  // États liés à l'Édition en ligne
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editThematique, setEditThematique] = useState("");
  const [editLieu, setEditLieu] = useState("");
  const [editNbHommes, setEditNbHommes] = useState<number>(0);
  const [editNbFemmes, setEditNbFemmes] = useState<number>(0);
  const [editCommentaire, setEditCommentaire] = useState("");

  // Récupération des données Firestore
  useEffect(() => {
    const q = query(collection(db, "actions_collectives"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setActions(docs);

      // 1. Extraction des lieux uniques pour le menu déroulant
      const lieuxUniques: string[] = Array.from(
        new Set(docs.map((d: any) => d.lieu).filter(Boolean))
      ).sort();
      setListeLieuxExistants(lieuxUniques);
      
      if (lieuxUniques.length > 0 && !lieuSelectionne) {
        setLieuSelectionne(lieuxUniques[0]);
      }

      // 2. Calcul automatique du croisement : Lieu > Trimestre 📊 + Historique commentaires
      const structureStats: Record<string, LieuStats> = {};

      docs.forEach(act => {
        const lieu = act.lieu || "Non spécifié";
        const h = act.nbHommes || 0;
        const f = act.nbFemmes || 0;
        const totalAction = h + f;
        
        let trimestre = "T1"; 
        if (act.createdAt) {
          const mois = new Date(act.createdAt).getMonth(); 
          if (mois >= 3 && mois <= 5) trimestre = "T2";
          else if (mois >= 6 && mois <= 8) trimestre = "T3";
          else if (mois >= 9 && mois <= 11) trimestre = "T4";
        }

        if (!structureStats[lieu]) {
          structureStats[lieu] = {
            totalGlobal: 0,
            commentaires: [], 
            trimestres: {
              "T1": { hommes: 0, femmes: 0, total: 0 },
              "T2": { hommes: 0, femmes: 0, total: 0 },
              "T3": { hommes: 0, femmes: 0, total: 0 },
              "T4": { hommes: 0, femmes: 0, total: 0 },
            }
          };
        }

        structureStats[lieu].totalGlobal += totalAction;
        structureStats[lieu].trimestres[trimestre].hommes += h;
        structureStats[lieu].trimestres[trimestre].femmes += f;
        structureStats[lieu].trimestres[trimestre].total += totalAction;
        
        if (act.commentaire && act.commentaire.trim() !== "") {
          structureStats[lieu].commentaires.push(act.commentaire.trim());
        }
      });

      setStatsParLieu(structureStats);
    });
    return () => unsubscribe();
  }, [lieuSelectionne]);

  // Sélection du lieu
  const handleLieuChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLieuSelectionne(val);
    setIsNouveauLieu(val === "__NEW__");
  };

  // Envoi du formulaire de création
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lieuFinal = isNouveauLieu ? nouveauLieu.trim() : lieuSelectionne;
    if (!lieuFinal || !thematique) return;

    setStatus("Enregistrement...");
    try {
      await addDoc(collection(db, "actions_collectives"), {
        lieu: lieuFinal,
        thematique,
        nbHommes: Number(nbHommes) || 0,
        nbFemmes: Number(nbFemmes) || 0,
        commentaire: commentaire.trim(), 
        createdAt: new Date().toISOString()
      });

      setNouveauLieu("");
      setIsNouveauLieu(false);
      setThematique("");
      setNbHommes("");
      setNbFemmes("");
      setCommentaire(""); 
      setShowForm(false);
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus("❌ Erreur de sauvegarde");
    }
  };

  // Activer le mode édition pour un élément spécifique
  const startEditing = (act: any) => {
    setEditingId(act.id);
    setEditThematique(act.thematique || "");
    setEditLieu(act.lieu || "");
    setEditNbHommes(act.nbHommes || 0);
    setEditNbFemmes(act.nbFemmes || 0);
    setEditCommentaire(act.commentaire || "");
  };

  // Sauvegarder les modifications d'une ligne
  const handleSaveEdit = async (id: string) => {
    if (!editThematique.trim() || !editLieu.trim()) {
      alert("La thématique et le lieu ne peuvent pas être vides.");
      return;
    }
    try {
      const docRef = doc(db, "actions_collectives", id);
      await updateDoc(docRef, {
        thematique: editThematique.trim(),
        lieu: editLieu.trim(),
        nbHommes: Number(editNbHommes) || 0,
        nbFemmes: Number(editNbFemmes) || 0,
        commentaire: editCommentaire.trim()
      });
      setEditingId(null);
    } catch (error) {
      console.error("Erreur de modification :", error);
      alert("Une erreur est survenue lors de la modification.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer cette action collective ?")) {
      try {
        await deleteDoc(doc(db, "actions_collectives", id));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const totalH = actions.reduce((acc, curr) => acc + (curr.nbHommes || 0), 0);
  const totalF = actions.reduce((acc, curr) => acc + (curr.nbFemmes || 0), 0);

  const inputClass = "w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:border-fuchsia-500/60 focus:ring-1 focus:ring-fuchsia-500/60 outline-none transition-all appearance-none";
  const inlineInputClass = "bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-white focus:border-fuchsia-500/60 outline-none transition-all";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-fuchsia-500/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* EN-TÊTE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 px-3 py-2.5 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-xl text-slate-200 hover:text-white transition-all shadow-md text-xs font-bold uppercase tracking-wider active:scale-95"
            >
              <ArrowLeftIcon className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Retour</span>
            </Link>

            <div className="flex items-center gap-3">
              <div className="h-8 w-1 bg-fuchsia-500 rounded-full shadow-[0_0_15px_rgba(217,70,239,0.5)]"></div>
              <div>
                <h1 className="text-2xl font-black text-white uppercase italic tracking-tight">
                  Actions Collectives
                </h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                  Suivi des présences anonymes et ateliers de groupe
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setShowForm(!showForm);
              if (listeLieuxExistants.length > 0) {
                setLieuSelectionne(listeLieuxExistants[0]);
                setIsNouveauLieu(false);
              } else {
                setIsNouveauLieu(true);
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-95"
          >
            <PlusIcon className="w-4 h-4 stroke-[3]" />
            <span>{showForm ? "Fermer" : "Saisir un rapport"}</span>
          </button>
        </div>

        {/* COMPTEURS GENERAUX */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
            <span className="block text-[9px] uppercase font-black tracking-widest text-slate-500">Total Hommes</span>
            <span className="text-2xl font-mono font-black text-white">{totalH}</span>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
            <span className="block text-[9px] uppercase font-black tracking-widest text-slate-500">Total Femmes</span>
            <span className="text-2xl font-mono font-black text-fuchsia-400">{totalF}</span>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl bg-gradient-to-br from-slate-900 to-fuchsia-950/20">
            <span className="block text-[9px] uppercase font-black tracking-widest text-slate-400">Impact Global</span>
            <span className="text-2xl font-mono font-black text-white">{totalH + totalF} <span className="text-xs font-sans font-light text-slate-400">pers.</span></span>
          </div>
        </div>

        {/* FORMULAIRE DE SAISIE */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
            <h2 className="text-xs font-black uppercase tracking-widest text-fuchsia-400">Nouvel enregistrement collectif</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Lieu d'intervention *</label>
                {listeLieuxExistants.length > 0 && !isNouveauLieu ? (
                  <select 
                    value={lieuSelectionne} 
                    onChange={handleLieuChange} 
                    required
                    className={`${inputClass} pr-8 cursor-pointer`}
                    style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156,163,175,1)' stroke-width='2'><path stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/></svg>")`, backgroundSize: '1rem', backgroundPosition: 'calc(100% - 0.75rem) center', backgroundRepeat: 'no-repeat' }}
                  >
                    {listeLieuxExistants.map((l) => (
                      <option key={l} value={l} className="bg-slate-900 text-white">{l}</option>
                    ))}
                    <option value="__NEW__" className="bg-slate-900 text-fuchsia-400 font-bold">➕ Créer un nouveau lieu...</option>
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input type="text" placeholder="Nom du nouveau lieu" value={nouveauLieu} onChange={(e) => setNouveauLieu(e.target.value)} required className={inputClass} autoFocus />
                    {listeLieuxExistants.length > 0 && (
                      <button type="button" onClick={() => setIsNouveauLieu(false)} className="text-[10px] text-slate-500 hover:text-white underline block">Choisir un lieu existant</button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Thématique *</label>
                <input type="text" placeholder="Ex: Atelier CV Connecté" value={thematique} onChange={(e) => setThematique(e.target.value)} required className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Nombre d'hommes</label>
                <input type="number" min="0" placeholder="0" value={nbHommes} onChange={(e) => setNbHommes(e.target.value === "" ? "" : Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Nombre de femmes</label>
                <input type="number" min="0" placeholder="0" value={nbFemmes} onChange={(e) => setNbFemmes(e.target.value === "" ? "" : Number(e.target.value))} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Commentaires / Notes sur la séance</label>
              <textarea 
                rows={4} 
                placeholder="Ajoutez ici le déroulé, retours des usagers, observations particulières..." 
                value={commentaire} 
                onChange={(e) => setCommentaire(e.target.value)} 
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase">{status}</span>
              <button type="submit" className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer">Valider l'action</button>
            </div>
          </form>
        )}

        {/* SYNTHÈSE D'ACTIVITÉ PAR LIEU & TRIMESTRE */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl mb-8">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-fuchsia-400" />
            Synthèse d'activité par Lieu et Trimestre
          </h2>
          
          {Object.keys(statsParLieu).length === 0 ? (
            <p className="text-xs text-slate-600 font-bold uppercase py-2 text-center">Aucune statistique disponible.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {Object.entries(statsParLieu).map(([nomLieu, dataLieu]) => (
                <div key={nomLieu} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
                  
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <span className="font-black text-xs text-white uppercase italic tracking-tight truncate max-w-[70%]">{nomLieu}</span>
                    <span className="bg-fuchsia-950 border border-fuchsia-900 text-fuchsia-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md">Total : {dataLieu.totalGlobal} p.</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid grid-cols-2 gap-2 md:col-span-2">
                      {Object.entries(dataLieu.trimestres).map(([trimestre, dataTri]) => (
                        <div key={trimestre} className="bg-slate-900 p-2 rounded-lg border border-slate-800/40 flex flex-col justify-between">
                          <div className="flex justify-between items-center text-[10px] mb-0.5">
                            <span className="font-black text-slate-500">{trimestre}</span>
                            <span className="font-mono font-black text-white">{dataTri.total} <span className="text-[8px] font-sans text-slate-600">p.</span></span>
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-600 border-t border-slate-950/80 pt-0.5 mt-0.5">
                            <span>H: {dataTri.hommes}</span>
                            <span>F: {dataTri.femmes}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/40 flex flex-col">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                        <ChatBubbleBottomCenterTextIcon className="w-3 h-3 text-fuchsia-500" />
                        Historique ({nomLieu})
                      </span>
                      <div className="flex-1 overflow-y-auto max-h-[110px] space-y-1.5 pr-1 scrollbar-thin">
                        {dataLieu.commentaires.length === 0 ? (
                          <p className="text-[9px] text-slate-700 italic">Aucun commentaire enregistré.</p>
                        ) : (
                          dataLieu.commentaires.map((com, index) => (
                            <div key={index} className="text-[10px] text-slate-400 bg-slate-950/60 p-1.5 rounded border border-slate-850 text-left leading-relaxed break-words">
                              {com}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* HISTORIQUE / LISTING DES ENREGISTREMENTS AVEC MODE EDITION INTEGRÉ */}
        <div className="space-y-3">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 pl-1">Dernières saisies</h2>
          {actions.map((act) => {
            const isEditing = editingId === act.id;

            return (
              <div key={act.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md transition-colors">
                
                {isEditing ? (
                  /* Formulaire d'édition à la place de l'affichage textuel standard */
                  <div className="space-y-3 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-1">
                      <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Mode Modification en ligne</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-0.5">Thématique</label>
                        <input 
                          type="text" 
                          value={editThematique} 
                          onChange={(e) => setEditThematique(e.target.value)} 
                          className={`${inlineInputClass} w-full`}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-0.5">Lieu d'intervention</label>
                        <input 
                          type="text" 
                          value={editLieu} 
                          onChange={(e) => setEditLieu(e.target.value)} 
                          className={`${inlineInputClass} w-full`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 w-full sm:w-1/2">
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-0.5">Nombre d'hommes</label>
                        <input 
                          type="number" 
                          min="0"
                          value={editNbHommes} 
                          onChange={(e) => setEditNbHommes(Number(e.target.value))} 
                          className={`${inlineInputClass} w-full font-mono`}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-0.5">Nombre de femmes</label>
                        <input 
                          type="number" 
                          min="0"
                          value={editNbFemmes} 
                          onChange={(e) => setEditNbFemmes(Number(e.target.value))} 
                          className={`${inlineInputClass} w-full font-mono`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase mb-0.5">Commentaires / Notes</label>
                      <textarea 
                        rows={2}
                        value={editCommentaire} 
                        onChange={(e) => setEditCommentaire(e.target.value)} 
                        className={`${inlineInputClass} w-full resize-none`}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-800/50">
                      <button 
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-all"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                        <span>Annuler</span>
                      </button>
                      <button 
                        onClick={() => handleSaveEdit(act.id)}
                        className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all shadow-md"
                      >
                        <CheckIcon className="w-3.5 h-3.5" />
                        <span>Enregistrer</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Affichage normal de la ligne */
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="font-black text-sm text-white uppercase italic tracking-tight">{act.thematique}</h3>
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800/60">
                          <MapPinIcon className="w-3 h-3 text-fuchsia-400" /> {act.lieu}
                        </span>
                      </div>
                      
                      {act.commentaire && (
                        <p className="text-xs text-slate-400 bg-slate-950/40 border border-slate-950/80 p-2 rounded-xl mt-2 italic font-sans line-clamp-2">
                          « {act.commentaire} »
                        </p>
                      )}

                      <div className="flex gap-4 mt-2 text-xs font-medium text-slate-500">
                        <div>Hommes : <span className="font-mono font-bold text-slate-300">{act.nbHommes || 0}</span></div>
                        <div>Femmes : <span className="font-mono font-bold text-fuchsia-400/80">{act.nbFemmes || 0}</span></div>
                        <div className="border-l border-slate-800 pl-4">Total : <span className="font-mono font-bold text-white">{(act.nbHommes || 0) + (act.nbFemmes || 0)}</span></div>
                      </div>
                    </div>

                    {/* Bloc Actions de droite : Modifier + Supprimer */}
                    <div className="flex gap-1.5 self-end sm:self-center shrink-0">
                      <button 
                        onClick={() => startEditing(act)} 
                        title="Modifier cette saisie"
                        className="p-2 bg-slate-950 border border-slate-800 text-slate-500 hover:text-amber-400 hover:border-amber-950 rounded-xl transition-colors cursor-pointer"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(act.id)} 
                        title="Supprimer cette saisie"
                        className="p-2 bg-slate-950 border border-slate-800 text-slate-600 hover:text-red-400 hover:border-red-950 rounded-xl transition-colors cursor-pointer"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

              </div>
            );
          })}

          {actions.length === 0 && !status.includes("Enreg") && (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl text-xs font-bold uppercase tracking-widest text-slate-600">📭 Aucun enregistrement.</div>
          )}
        </div>

      </div>
    </main>
  );
}
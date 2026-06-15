"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import Link from "next/link";
import { 
  ArrowLeftIcon, 
  PlusIcon, 
  TrashIcon,
  MapPinIcon,
  ChartBarIcon
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
}

export default function ActionsCollectivesPage() {
  const [actions, setActions] = useState<any[]>([]);
  const [listeLieuxExistants, setListeLieuxExistants] = useState<string[]>([]);
  const [statsParLieu, setStatsParLieu] = useState<Record<string, LieuStats>>({});
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState("");

  // États du formulaire
  const [lieuSelectionne, setLieuSelectionne] = useState("");
  const [nouveauLieu, setNouveauLieu] = useState("");
  const [isNouveauLieu, setIsNouveauLieu] = useState(false);
  
  const [thematique, setThematique] = useState("");
  const [nbHommes, setNbHommes] = useState<number | " text-white">("");
  const [nbFemmes, setNbFemmes] = useState<number | " text-white">("");

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

      // 2. Calcul automatique du croisement : Lieu > Trimestre 📊
      const structureStats: Record<string, LieuStats> = {};

      docs.forEach(act => {
        const lieu = act.lieu || "Non spécifié";
        const h = act.nbHommes || 0;
        const f = act.nbFemmes || 0;
        const totalAction = h + f;
        
        // Calcul du trimestre basé sur la date de création
        let trimestre = "T1"; 
        if (act.createdAt) {
          const mois = new Date(act.createdAt).getMonth(); // 0 = Janvier, 11 = Décembre
          if (mois >= 3 && mois <= 5) trimestre = "T2";
          else if (mois >= 6 && mois <= 8) trimestre = "T3";
          else if (mois >= 9 && mois <= 11) trimestre = "T4";
        }

        if (!structureStats[lieu]) {
          structureStats[lieu] = {
            totalGlobal: 0,
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

  // Envoi du formulaire
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
        createdAt: new Date().toISOString()
      });

      setNouveauLieu("");
      setIsNouveauLieu(false);
      setThematique("");
      setNbHommes("");
      setNbFemmes("");
      setShowForm(false);
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus("❌ Erreur de sauvegarde");
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-fuchsia-500/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* EN-TÊTE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            
            {/* BOUTON RETOUR TRÈS VISIBLE */}
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 px-3 py-2.5 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-xl text-slate-200 hover:text-white transition-all shadow-md hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] text-xs font-bold uppercase tracking-wider active:scale-95"
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

          {/* BOUTON D'ACTION VERT EMERAUDE VISIBLE */}
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
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.35)] active:scale-95"
          >
            <PlusIcon className="w-4 h-4 stroke-[3]" />
            <span>{showForm ? "Fermer" : "Saisir un rapport"}</span>
          </button>
        </div>

        {/* COMPTEURS GENERAUX GLOBAUX */}
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

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase">{status}</span>
              <button type="submit" className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer">Valider l'action</button>
            </div>
          </form>
        )}

        {/* DIRECT BLOC : VUE DÉTAILLÉE PAR LIEU & TRIMESTRE 📊 */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl mb-8">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-fuchsia-400" />
            Synthèse d'activité par Lieu et Trimestre
          </h2>
          
          {Object.keys(statsParLieu).length === 0 ? (
            <p className="text-xs text-slate-600 font-bold uppercase py-2 text-center">Aucune statistique disponible.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(statsParLieu).map(([nomLieu, dataLieu]) => (
                <div key={nomLieu} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2 mb-3">
                    <span className="font-black text-xs text-white uppercase italic tracking-tight truncate max-w-[70%]">{nomLieu}</span>
                    <span className="bg-fuchsia-950 border border-fuchsia-900 text-fuchsia-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md">Total : {dataLieu.totalGlobal} p.</span>
                  </div>

                  {/* Les 4 trimestres ventilés pour ce lieu */}
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(dataLieu.trimestres).map(([trimestre, dataTri]) => (
                      <div key={trimestre} className="bg-slate-900 p-2 rounded-lg border border-slate-800/40">
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* HISTORIQUE FLUIDE DES ENREGISTREMENTS */}
        <div className="space-y-3">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 pl-1">Dernières saisies</h2>
          {actions.map((act) => (
            <div key={act.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-4 shadow-md hover:border-slate-700/60 transition-colors group">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="font-black text-sm text-white uppercase italic tracking-tight">{act.thematique}</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800/60">
                    <MapPinIcon className="w-3 h-3 text-fuchsia-400" /> {act.lieu}
                  </span>
                </div>
                <div className="flex gap-4 mt-2 text-xs font-medium text-slate-500">
                  <div>Hommes : <span className="font-mono font-bold text-slate-300">{act.nbHommes || 0}</span></div>
                  <div>Femmes : <span className="font-mono font-bold text-fuchsia-400/80">{act.nbFemmes || 0}</span></div>
                  <div className="border-l border-slate-800 pl-4">Total : <span className="font-mono font-bold text-white">{(act.nbHommes || 0) + (act.nbFemmes || 0)}</span></div>
                </div>
              </div>
              <button onClick={() => handleDelete(act.id)} className="p-2 bg-slate-950 border border-slate-800 text-slate-600 hover:text-red-400 hover:border-red-950 rounded-xl transition-colors shrink-0 cursor-pointer"><TrashIcon className="w-4 h-4" /></button>
            </div>
          ))}

          {actions.length === 0 && !status.includes("Enreg") && (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl text-xs font-bold uppercase tracking-widest text-slate-600">📭 Aucun enregistrement.</div>
          )}
        </div>

      </div>
    </main>
  );
}
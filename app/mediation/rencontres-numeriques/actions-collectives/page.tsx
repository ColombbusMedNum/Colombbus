"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import {
  HomeIcon,
  PlusIcon,
  TrashIcon,
  MapPinIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

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

interface ActionCollective {
  id: string;
  lieu?: string;
  thematique?: string;
  nbHommes?: number;
  nbFemmes?: number;
  commentaire?: string;
  createdAt?: string | number;
}

export default function ActionsCollectivesPage() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [actions, setActions] = useState<ActionCollective[]>([]);
  const [lieuxDisponibles, setLieuxDisponibles] = useState<string[]>([]);
  const [statsParLieu, setStatsParLieu] = useState<Record<string, LieuStats>>({});
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState("");

  // États du formulaire de création
  const [lieuSelectionne, setLieuSelectionne] = useState("");
  const [thematique, setThematique] = useState("");
  const [nbHommes, setNbHommes] = useState<number | "">("");
  const [nbFemmes, setNbFemmes] = useState<number | "">("");
  const [commentaire, setCommentaire] = useState("");

  // Pop-up de création d'un nouveau lieu (écrit directement dans le
  // référentiel liste_lieux, comme /mediation/localisations), sans quitter
  // cette page.
  const [isNouveauLieuModalOpen, setIsNouveauLieuModalOpen] = useState(false);
  const [nouveauLieuStatus, setNouveauLieuStatus] = useState("");
  const [nouveauLieuForm, setNouveauLieuForm] = useState({
    nomCourt: "",
    nomComplet: "",
    adresse: "",
    ville: "",
    codePostal: ""
  });

  // États liés à l'Édition en ligne
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editThematique, setEditThematique] = useState("");
  const [editLieu, setEditLieu] = useState("");
  const [editNbHommes, setEditNbHommes] = useState<number>(0);
  const [editNbFemmes, setEditNbFemmes] = useState<number>(0);
  const [editCommentaire, setEditCommentaire] = useState("");

  // Lieux prédéfinis, gérés depuis /mediation/localisations (collection
  // liste_lieux) — proposés dans le menu déroulant du formulaire de saisie,
  // en plus de l'option "Créer un nouveau lieu..." pour les cas non encore
  // enregistrés dans le référentiel.
  useEffect(() => {
    const unsubLieux = onSnapshot(collection(db, "liste_lieux"), (snap) => {
      const noms = snap.docs
        .map(d => d.data())
        .filter((l: any) => l.actif !== false)
        .map((l: any) => l.nomCourt || l.nomRaccourci || l.nomComplet)
        .filter(Boolean)
        .sort((a: string, b: string) => a.localeCompare(b, "fr", { sensitivity: "base" }));
      setLieuxDisponibles(Array.from(new Set(noms)) as string[]);
    });
    return () => unsubLieux();
  }, []);

  // Récupération des données Firestore
  useEffect(() => {
    const q = query(collection(db, "actions_collectives"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: ActionCollective[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActionCollective));
      setActions(docs);

      // Calcul automatique du croisement : Lieu > Trimestre 📊 + Historique commentaires
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
    if (val === "__NEW__") {
      setIsNouveauLieuModalOpen(true);
      return;
    }
    setLieuSelectionne(val);
  };

  // Création d'un nouveau lieu dans le référentiel partagé (liste_lieux),
  // sans quitter cette page. Une fois créé, il est automatiquement
  // sélectionné pour l'action collective en cours de saisie.
  const handleCreateLieuInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nouveauLieuForm.nomCourt.trim()) return;

    setNouveauLieuStatus("Enregistrement en cours...");
    try {
      const nomFinal = nouveauLieuForm.nomCourt.trim();
      await addDoc(collection(db, "liste_lieux"), {
        nomCourt: nomFinal,
        nomComplet: nouveauLieuForm.nomComplet.trim() || nomFinal,
        adresse: nouveauLieuForm.adresse.trim(),
        ville: nouveauLieuForm.ville.trim(),
        codePostal: nouveauLieuForm.codePostal.trim(),
        actif: true,
        createdAt: serverTimestamp(),
      });

      setLieuSelectionne(nomFinal);
      setNouveauLieuStatus("✅ Lieu ajouté avec succès !");
      setTimeout(() => {
        setIsNouveauLieuModalOpen(false);
        setNouveauLieuStatus("");
        setNouveauLieuForm({ nomCourt: "", nomComplet: "", adresse: "", ville: "", codePostal: "" });
      }, 900);
    } catch (error) {
      console.error("Erreur de création du lieu :", error);
      setNouveauLieuStatus("❌ Erreur lors de l'enregistrement");
    }
  };

  // Envoi du formulaire de création
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lieuFinal = lieuSelectionne;
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
      showToast("La thématique et le lieu ne peuvent pas être vides.", "error");
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
      showToast("Une erreur est survenue lors de la modification.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (await confirm("Supprimer cette action collective ?")) {
      try {
        await deleteDoc(doc(db, "actions_collectives", id));
      } catch (error) {
        console.error(error);
        showToast("Erreur lors de la suppression.", "error");
      }
    }
  };

  const totalH = actions.reduce((acc, curr) => acc + (curr.nbHommes || 0), 0);
  const totalF = actions.reduce((acc, curr) => acc + (curr.nbFemmes || 0), 0);

  const inputClass = "w-full bg-[#F3F3F2] text-[#404040] border border-[#404040]/15 rounded-xl p-3 text-xs font-bold placeholder-[#404040]/40 focus:border-[#005259] outline-none transition-all appearance-none";
  const inlineInputClass = "bg-[#F3F3F2] text-[#404040] border border-[#404040]/15 rounded-lg p-2 text-xs font-bold focus:border-[#005259] outline-none transition-all";

  return (
    <PageGuard pageId="page_access_actions_collectives">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>

            <div className="flex items-center gap-3">
              <div className="h-8 w-1 bg-[#EA601F] rounded-full"></div>
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold uppercase text-[#005259] tracking-tight">
                  Actions Collectives
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5">
                  Suivi des présences anonymes et ateliers de groupe
                </p>
              </div>
            </div>
          </div>

          <PermissionGuard actionId="coll_toggle_form">
            <button
              onClick={() => {
                setShowForm(!showForm);
                if (lieuxDisponibles.length > 0 && !lieuSelectionne) {
                  setLieuSelectionne(lieuxDisponibles[0]);
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#EA601F] hover:bg-[#005259] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 self-start sm:self-auto"
            >
              <PlusIcon className="w-4 h-4 text-white stroke-[3]" />
              <span>{showForm ? "Fermer" : "Saisir un rapport"}</span>
            </button>
          </PermissionGuard>
        </div>

        {/* COMPTEURS GÉNÉRAUX */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-[#404040]/10 rounded-2xl shadow-sm">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-[#005259]">Total Hommes</span>
            <span className="text-2xl font-extrabold text-[#404040]">{totalH}</span>
          </div>
          <div className="p-5 bg-white border border-[#404040]/10 rounded-2xl shadow-sm">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-[#005259]">Total Femmes</span>
            <span className="text-2xl font-extrabold text-[#EA601F]">{totalF}</span>
          </div>
          <div className="p-5 bg-white border border-[#005259]/20 rounded-2xl shadow-sm bg-gradient-to-br from-white to-[#005259]/5">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-[#005259]">Impact Global</span>
            <span className="text-2xl font-extrabold text-[#005259]">{totalH + totalF} <span className="text-xs font-normal text-[#404040]/70">pers.</span></span>
          </div>
        </div>

        {/* FORMULAIRE DE SAISIE */}
        {showForm && (
          <form onSubmit={handleSubmit} className="p-6 bg-white border border-[#404040]/10 rounded-3xl shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#005259]">Nouvel enregistrement collectif</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-wider mb-1">Lieu d'intervention *</label>
                <select
                  value={lieuSelectionne}
                  onChange={handleLieuChange}
                  required
                  className={`${inputClass} pr-8 cursor-pointer`}
                  style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23005259' stroke-width='2'><path stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/></svg>")`, backgroundSize: '1rem', backgroundPosition: 'calc(100% - 0.75rem) center', backgroundRepeat: 'no-repeat' }}
                >
                  {!lieuSelectionne && <option value="" disabled>-- Choisir un lieu --</option>}
                  {lieuxDisponibles.map((l) => (
                    <option key={l} value={l} className="bg-white text-[#404040]">{l}</option>
                  ))}
                  <option value="__NEW__" className="bg-white text-[#EA601F] font-bold">➕ Créer un nouveau lieu...</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-wider mb-1">Thématique *</label>
                <input type="text" placeholder="Ex: Atelier CV Connecté" value={thematique} onChange={(e) => setThematique(e.target.value)} required className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-wider mb-1">Nombre d'hommes</label>
                <input type="number" min="0" placeholder="0" value={nbHommes} onChange={(e) => setNbHommes(e.target.value === "" ? "" : Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-wider mb-1">Nombre de femmes</label>
                <input type="number" min="0" placeholder="0" value={nbFemmes} onChange={(e) => setNbFemmes(e.target.value === "" ? "" : Number(e.target.value))} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-wider mb-1">Commentaires / Notes sur la séance</label>
              <textarea 
                rows={4} 
                placeholder="Ajoutez ici le déroulé, retours des usagers, observations particulières..." 
                value={commentaire} 
                onChange={(e) => setCommentaire(e.target.value)} 
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#EA601F] font-bold">{status}</span>
              <PermissionGuard actionId="coll_submit">
                <button type="submit" className="bg-[#EA601F] hover:bg-[#005259] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">Valider l'action</button>
              </PermissionGuard>
            </div>
          </form>
        )}

        {/* POP-UP : CRÉATION D'UN NOUVEAU LIEU DANS LE RÉFÉRENTIEL */}
        {isNouveauLieuModalOpen && (
          <div className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[110] p-4">
            <form onSubmit={handleCreateLieuInline} className="bg-white border border-[#404040]/10 p-6 rounded-2xl w-full max-w-sm space-y-3 shadow-2xl text-[#404040]">
              <div className="flex items-center gap-2 pb-2 border-b border-[#404040]/10">
                <MapPinIcon className="w-4 h-4 text-[#EA601F]" />
                <h3 className="font-extrabold text-sm text-[#005259] uppercase tracking-wide">Nouveau lieu</h3>
              </div>
              <p className="text-[11px] text-[#404040]/70">
                Ce lieu sera ajouté au référentiel partagé (visible aussi sur /mediation/localisations) et sélectionné automatiquement pour cette action.
              </p>

              <div>
                <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-wider mb-1">Nom court *</label>
                <input required placeholder="Ex: Terrage" value={nouveauLieuForm.nomCourt} onChange={(e) => setNouveauLieuForm({...nouveauLieuForm, nomCourt: e.target.value})} className={inputClass} autoFocus />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-wider mb-1">Nom complet (Optionnel)</label>
                <input placeholder="Ex: Résidence Autonomie - Le Terrage" value={nouveauLieuForm.nomComplet} onChange={(e) => setNouveauLieuForm({...nouveauLieuForm, nomComplet: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-wider mb-1">Adresse</label>
                <input placeholder="Ex: 10 rue du Terrage" value={nouveauLieuForm.adresse} onChange={(e) => setNouveauLieuForm({...nouveauLieuForm, adresse: e.target.value})} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-wider mb-1">Code Postal</label>
                  <input placeholder="75010" value={nouveauLieuForm.codePostal} onChange={(e) => setNouveauLieuForm({...nouveauLieuForm, codePostal: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-wider mb-1">Ville</label>
                  <input placeholder="Paris" value={nouveauLieuForm.ville} onChange={(e) => setNouveauLieuForm({...nouveauLieuForm, ville: e.target.value})} className={inputClass} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-[#EA601F] font-bold">{nouveauLieuStatus}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsNouveauLieuModalOpen(false); setNouveauLieuStatus(""); setNouveauLieuForm({ nomCourt: "", nomComplet: "", adresse: "", ville: "", codePostal: "" }); }}
                    className="text-[#404040]/60 hover:text-[#404040] text-xs font-bold px-2 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button type="submit" className="bg-[#EA601F] hover:bg-[#005259] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">
                    Créer et sélectionner
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* SYNTHÈSE D'ACTIVITÉ PAR LIEU & TRIMESTRE */}
        <div className="bg-white border border-[#404040]/10 p-6 rounded-3xl shadow-sm">
          <h2 className="font-extrabold text-xs uppercase tracking-wider text-[#005259] mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-[#EA601F]" />
            Synthèse d'activité par Lieu et Trimestre
          </h2>
          
          {Object.keys(statsParLieu).length === 0 ? (
            <p className="text-xs text-[#404040]/60 font-bold uppercase py-2 text-center">Aucune statistique disponible.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {Object.entries(statsParLieu).map(([nomLieu, dataLieu]) => (
                <div key={nomLieu} className="bg-[#F3F3F2] border border-[#404040]/10 p-4 rounded-2xl space-y-4">
                  
                  <div className="flex justify-between items-center border-b border-[#404040]/10 pb-2">
                    <span className="font-extrabold text-xs text-[#005259] uppercase tracking-tight truncate max-w-[70%]">{nomLieu}</span>
                    <span className="bg-white border border-[#404040]/10 text-[#EA601F] text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm">Total : {dataLieu.totalGlobal} p.</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid grid-cols-2 gap-2 md:col-span-2">
                      {Object.entries(dataLieu.trimestres).map(([trimestre, dataTri]) => (
                        <div key={trimestre} className="bg-white p-2.5 rounded-xl border border-[#404040]/10 flex flex-col justify-between shadow-sm">
                          <div className="flex justify-between items-center text-[10px] mb-0.5">
                            <span className="font-bold text-[#005259]">{trimestre}</span>
                            <span className="font-extrabold text-[#404040]">{dataTri.total} <span className="text-[8px] text-[#404040]/60 font-normal">p.</span></span>
                          </div>
                          <div className="flex justify-between text-[9px] text-[#404040]/70 border-t border-[#404040]/10 pt-1 mt-1 font-medium">
                            <span>H: {dataTri.hommes}</span>
                            <span>F: {dataTri.femmes}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-[#404040]/10 flex flex-col shadow-sm">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[#005259] mb-2 flex items-center gap-1">
                        <ChatBubbleBottomCenterTextIcon className="w-3 h-3 text-[#EA601F]" />
                        Historique ({nomLieu})
                      </span>
                      <div className="flex-1 overflow-y-auto max-h-[110px] space-y-1.5 pr-1 scrollbar-thin">
                        {dataLieu.commentaires.length === 0 ? (
                          <p className="text-[9px] text-[#404040]/50 italic">Aucun commentaire enregistré.</p>
                        ) : (
                          dataLieu.commentaires.map((com, index) => (
                            <div key={index} className="text-[10px] text-[#404040] bg-[#F3F3F2] p-2 rounded-lg border border-[#404040]/10 text-left leading-relaxed break-words font-medium">
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

        {/* HISTORIQUE / LISTING DES ENREGISTREMENTS AVEC MODE ÉDITION INTÉGRÉ */}
        <div className="space-y-3">
          <h2 className="font-extrabold text-xs uppercase tracking-wider text-[#005259] pl-1">Dernières saisies</h2>
          {actions.map((act) => {
            const isEditing = editingId === act.id;

            return (
              <div key={act.id} className="p-5 bg-white border border-[#404040]/10 rounded-2xl shadow-sm transition-colors">
                
                {isEditing ? (
                  /* Formulaire d'édition à la place de l'affichage textuel standard */
                  <div className="space-y-3 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between border-b border-[#404040]/10 pb-2 mb-1">
                      <span className="text-[10px] font-bold uppercase text-[#EA601F] tracking-wider">Mode Modification en ligne</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-[#005259] uppercase mb-0.5">Thématique</label>
                        <input 
                          type="text" 
                          value={editThematique} 
                          onChange={(e) => setEditThematique(e.target.value)} 
                          className={`${inlineInputClass} w-full`}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-[#005259] uppercase mb-0.5">Lieu d'intervention</label>
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
                        <label className="block text-[9px] font-bold text-[#005259] uppercase mb-0.5">Nombre d'hommes</label>
                        <input 
                          type="number" 
                          min="0"
                          value={editNbHommes} 
                          onChange={(e) => setEditNbHommes(Number(e.target.value))} 
                          className={`${inlineInputClass} w-full`}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-[#005259] uppercase mb-0.5">Nombre de femmes</label>
                        <input 
                          type="number" 
                          min="0"
                          value={editNbFemmes} 
                          onChange={(e) => setEditNbFemmes(Number(e.target.value))} 
                          className={`${inlineInputClass} w-full`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-[#005259] uppercase mb-0.5">Commentaires / Notes</label>
                      <textarea 
                        rows={2}
                        value={editCommentaire} 
                        onChange={(e) => setEditCommentaire(e.target.value)} 
                        className={`${inlineInputClass} w-full resize-none`}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-[#404040]/10">
                      <button 
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center gap-1 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] hover:bg-[#404040] hover:text-white px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-all"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                        <span>Annuler</span>
                      </button>
                      <PermissionGuard actionId="coll_save_edit">
                        <button
                          onClick={() => handleSaveEdit(act.id)}
                          className="inline-flex items-center gap-1 bg-[#EA601F] hover:bg-[#005259] text-white px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-all shadow-sm"
                        >
                          <CheckIcon className="w-3.5 h-3.5" />
                          <span>Enregistrer</span>
                        </button>
                      </PermissionGuard>
                    </div>
                  </div>
                ) : (
                  /* Affichage normal de la ligne */
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="font-extrabold text-sm text-[#005259] uppercase tracking-tight">{act.thematique}</h3>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#005259] bg-[#F3F3F2] px-2.5 py-1 rounded-lg border border-[#404040]/10">
                          <MapPinIcon className="w-3 h-3 text-[#EA601F]" /> {act.lieu}
                        </span>
                      </div>
                      
                      {act.commentaire && (
                        <p className="text-xs text-[#404040]/80 bg-[#F3F3F2] border border-[#404040]/10 p-2.5 rounded-xl mt-2 italic line-clamp-2">
                          « {act.commentaire} »
                        </p>
                      )}

                      <div className="flex gap-4 mt-2 text-xs font-bold text-[#404040]/70">
                        <div>Hommes : <span className="font-extrabold text-[#005259]">{act.nbHommes || 0}</span></div>
                        <div>Femmes : <span className="font-extrabold text-[#EA601F]">{act.nbFemmes || 0}</span></div>
                        <div className="border-l border-[#404040]/15 pl-4">Total : <span className="font-extrabold text-[#005259]">{(act.nbHommes || 0) + (act.nbFemmes || 0)}</span></div>
                      </div>
                    </div>

                    {/* Bloc Actions de droite : Modifier + Supprimer */}
                    <div className="flex gap-1.5 self-end sm:self-center shrink-0">
                      <button 
                        onClick={() => startEditing(act)} 
                        title="Modifier cette saisie"
                        className="p-2 bg-[#F3F3F2] border border-[#404040]/10 text-[#005259] hover:bg-[#005259] hover:text-white rounded-xl transition-all cursor-pointer"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <PermissionGuard actionId="coll_delete">
                        <button
                          onClick={() => handleDelete(act.id)}
                          title="Supprimer cette saisie"
                          className="p-2 bg-[#F3F3F2] border border-[#404040]/10 text-[#404040]/50 hover:text-red-500 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </PermissionGuard>
                    </div>
                  </div>
                )}

              </div>
            );
          })}

          {actions.length === 0 && !status.includes("Enreg") && (
            <div className="text-center py-16 border border-dashed border-[#404040]/20 rounded-2xl text-xs font-bold uppercase tracking-wider text-[#404040]/50 bg-white/50">📭 Aucun enregistrement.</div>
          )}
        </div>

      </div>
    </main>
    </PageGuard>
  );
}
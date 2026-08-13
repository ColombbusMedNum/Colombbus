"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { 
  HomeIcon,
  MapPinIcon,
  PlusCircleIcon, 
  PencilSquareIcon, 
  TrashIcon, 
  CheckIcon, 
  XMarkIcon,
  BuildingOffice2Icon,
  Squares2X2Icon,
  TableCellsIcon,
  ArchiveBoxIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

// Initialisation de la police Quicksand
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

interface Lieu {
  id: string;
  nomCourt: string;
  nomComplet: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  actif?: boolean;
}

export default function LocalisationsPage() {
  const [lieux, setLieux] = useState<Lieu[]>([]);
  const [loading, setLoading] = useState(true);

  // Bascule de vue : 'table' ou 'cards'
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Filtre d'affichage : 'actifs' ou 'archives'
  const [activeTab, setActiveTab] = useState<"actifs" | "archives">("actifs");

  // Modale d'ajout/création
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState("");

  // Modale de confirmation personnalisée (Archive / Supprimer)
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    actionLabel: "",
    isDanger: false,
    onConfirm: () => {},
  });

  // Formulaire de création
  const [formData, setFormData] = useState({
    nomCourt: "",
    nomComplet: "",
    adresse: "",
    ville: "",
    codePostal: "",
    actif: true,
  });

  // Édition en ligne
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Lieu | null>(null);

  const inputClass = "w-full bg-[#F3F3F2] border border-[#404040]/20 rounded-xl p-2.5 text-xs text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all";

  // Écoute de la collection Firestore des lieux
  useEffect(() => {
    const unsubLieux = onSnapshot(collection(db, "liste_lieux"), (snap) => {
      const liste = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nomCourt: data.nomCourt || data.nomRaccourci || data.nom || d.id,
          nomComplet: data.nomComplet || data.nom || "",
          adresse: data.adresse || "",
          ville: data.ville || "",
          codePostal: data.codePostal || "",
          actif: data.actif !== false,
        } as Lieu;
      });

      liste.sort((a, b) => (a.nomCourt || "").localeCompare(b.nomCourt || "", "fr", { sensitivity: "base" }));
      setLieux(liste);
      setLoading(false);
    });

    return () => unsubLieux();
  }, []);

  const handleCreateLieu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nomCourt.trim()) return;

    setModalStatus("Enregistrement en cours...");
    try {
      await addDoc(collection(db, "liste_lieux"), {
        nomCourt: formData.nomCourt.trim(),
        nomComplet: formData.nomComplet.trim() || formData.nomCourt.trim(),
        adresse: formData.adresse.trim(),
        ville: formData.ville.trim(),
        codePostal: formData.codePostal.trim(),
        actif: formData.actif,
        createdAt: serverTimestamp(),
      });

      setModalStatus("✅ Lieu ajouté avec succès !");
      setTimeout(() => {
        setIsModalOpen(false);
        setModalStatus("");
        setFormData({
          nomCourt: "",
          nomComplet: "",
          adresse: "",
          ville: "",
          codePostal: "",
          actif: true,
        });
      }, 1000);
    } catch (error) {
      console.error(error);
      setModalStatus("❌ Erreur lors de la création.");
    }
  };

  const startEditing = (lieu: Lieu) => {
    setEditingId(lieu.id);
    setEditFormData({ ...lieu });
  };

  const handleUpdateLieu = async (lieuId: string) => {
    if (!editFormData || !editFormData.nomCourt.trim()) return;

    try {
      await updateDoc(doc(db, "liste_lieux", lieuId), {
        nomCourt: editFormData.nomCourt.trim(),
        nomComplet: editFormData.nomComplet.trim(),
        adresse: editFormData.adresse?.trim() || "",
        ville: editFormData.ville?.trim() || "",
        codePostal: editFormData.codePostal?.trim() || "",
        actif: editFormData.actif ?? true,
      });

      setEditingId(null);
      setEditFormData(null);
    } catch (error) {
      console.error("Erreur mise à jour :", error);
    }
  };

  // Demande de confirmation personnalisée pour l'archivage
  const requestToggleArchiveLieu = (lieu: Lieu) => {
    const isArchiving = lieu.actif;
    setConfirmConfig({
      isOpen: true,
      title: isArchiving ? "Archiver le lieu" : "Désarchiver le lieu",
      message: isArchiving 
        ? `Voulez-vous masquer le lieu "${lieu.nomCourt}" des formulaires actifs ?` 
        : `Voulez-vous réactiver le lieu "${lieu.nomCourt}" ?`,
      actionLabel: isArchiving ? "Archiver" : "Réactiver",
      isDanger: false,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, "liste_lieux", lieu.id), { actif: !lieu.actif });
        } catch (error) {
          console.error(error);
        }
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Demande de confirmation personnalisée pour la suppression
  const requestDeleteLieu = (lieuId: string, nomCourt: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Supprimer définitivement",
      message: `Êtes-vous sûr de vouloir supprimer définitivement le lieu "${nomCourt}" ? Cette action est irréversible.`,
      actionLabel: "Supprimer",
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "liste_lieux", lieuId));
        } catch (error) {
          console.error(error);
        }
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold uppercase tracking-widest text-xs animate-pulse`}>
        Chargement des localisations...
      </div>
    );
  }

  // Filtrage selon l'onglet actif
  const lieuxActifs = lieux.filter((l) => l.actif);
  const lieuxArchives = lieux.filter((l) => !l.actif);
  const displayedLieux = activeTab === "actifs" ? lieuxActifs : lieuxArchives;

  return (
    <PageGuard pageId="page_access_localisations">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      
      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#005259]/5 blur-[140px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* NAV HAUTE */}
        <div className="flex justify-between items-center mb-6">
          <Link
            href="/"
            className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
          >
            <HomeIcon className="w-4 h-4 text-[#EA601F]" />
            <span>Accueil</span>
          </Link>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md"
          >
            <PlusCircleIcon className="w-4 h-4" />
            <span>Ajouter un lieu</span>
          </button>
        </div>

        {/* HEADER */}
        <header className="bg-white border border-[#404040]/10 rounded-2xl p-6 mb-6 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 rounded-full bg-[#005259] shadow-[0_0_12px_rgba(0,82,89,0.2)]"></div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#005259] uppercase flex items-center gap-2">
                  <MapPinIcon className="w-7 h-7 text-[#EA601F]" />
                  <span>Gestion des Localisations</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-1">
                  Gérez la liste des antennes, espaces et permanences disponibles pour vos rendez-vous.
                </p>
              </div>
            </div>

            <div className="bg-[#F3F3F2] border border-[#404040]/10 px-4 py-2 rounded-xl shrink-0 flex items-center gap-4">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-[#404040]/60">Lieux Actifs</p>
                <p className="text-xl font-bold text-[#005259]">{lieuxActifs.length} <span className="text-xs text-[#404040]/50 font-normal">/ {lieux.length}</span></p>
              </div>
              <div className="border-l border-[#404040]/10 pl-4">
                <p className="text-[10px] uppercase font-bold tracking-wider text-[#404040]/60">Archivés</p>
                <p className="text-xl font-bold text-[#404040]/80">{lieuxArchives.length}</p>
              </div>
            </div>
          </div>
        </header>

        {/* CONTROLES : ONGLETS ARCHIVES ET BASCULE VUE */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-4">
          
          {/* ONGLET ACTIFS / ARCHIVÉS */}
          <div className="flex bg-white p-1 rounded-xl border border-[#404040]/10 self-start shadow-sm">
            <button
              onClick={() => setActiveTab("actifs")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === "actifs" 
                  ? "bg-[#005259] text-white shadow-sm" 
                  : "text-[#404040]/70 hover:text-[#005259]"
              }`}
            >
              <BuildingOffice2Icon className="w-4 h-4" />
              <span>Actifs ({lieuxActifs.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("archives")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === "archives" 
                  ? "bg-[#005259] text-white shadow-sm" 
                  : "text-[#404040]/70 hover:text-[#005259]"
              }`}
            >
              <ArchiveBoxIcon className="w-4 h-4" />
              <span>Archivés ({lieuxArchives.length})</span>
            </button>
          </div>

          {/* BASCULE TABLEAU / CARTES */}
          <div className="flex bg-white p-1 rounded-xl border border-[#404040]/10 self-end sm:self-auto shadow-sm">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                viewMode === "table" 
                  ? "bg-[#F3F3F2] text-[#005259] border border-[#404040]/10 shadow-sm" 
                  : "text-[#404040]/50 hover:text-[#005259]"
              }`}
              title="Vue Tableau"
            >
              <TableCellsIcon className="w-4 h-4" />
              <span className="hidden md:inline">Tableau</span>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                viewMode === "cards" 
                  ? "bg-[#F3F3F2] text-[#005259] border border-[#404040]/10 shadow-sm" 
                  : "text-[#404040]/50 hover:text-[#005259]"
              }`}
              title="Vue Cartes"
            >
              <Squares2X2Icon className="w-4 h-4" />
              <span className="hidden md:inline">Cartes</span>
            </button>
          </div>

        </div>

        {/* CONTENU : TABLEAU OU CARTES */}
        <section className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#404040]/10">
            {activeTab === "actifs" ? (
              <BuildingOffice2Icon className="w-5 h-5 text-[#005259]" />
            ) : (
              <ArchiveBoxIcon className="w-5 h-5 text-[#005259]" />
            )}
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#005259]">
              {activeTab === "actifs" ? "Liste des lieux actifs" : "Archives des lieux"} ({displayedLieux.length})
            </h2>
          </div>

          {displayedLieux.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[#404040]/20 rounded-xl text-[#404040]/50 text-xs uppercase tracking-wider">
              {activeTab === "actifs" ? "Aucun lieu actif répertorié." : "Aucun lieu dans les archives."}
            </div>
          ) : viewMode === "table" ? (
            
            /* --- VUE TABLEAU --- */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#404040]/10 text-[#005259] uppercase tracking-wider text-[10px] font-bold bg-[#F3F3F2]">
                    <th className="py-3 px-3">Nom Court</th>
                    <th className="py-3 px-3">Nom Complet</th>
                    <th className="py-3 px-3">Adresse / Ville</th>
                    <th className="py-3 px-3 text-center">Statut</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#404040]/5">
                  {displayedLieux.map((lieu) => {
                    const isEditing = editingId === lieu.id;

                    return (
                      <tr key={lieu.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                        
                        {/* NOM COURT */}
                        <td className="py-3 px-3 font-bold text-[#005259]">
                          {isEditing && editFormData ? (
                            <input 
                              type="text" 
                              value={editFormData.nomCourt} 
                              onChange={(e) => setEditFormData({ ...editFormData, nomCourt: e.target.value })} 
                              className="bg-[#F3F3F2] border border-[#404040]/20 text-[11px] p-1.5 rounded text-[#404040] outline-none w-full" 
                            />
                          ) : (
                            lieu.nomCourt
                          )}
                        </td>

                        {/* NOM COMPLET */}
                        <td className="py-3 px-3 text-[#404040]">
                          {isEditing && editFormData ? (
                            <input 
                              type="text" 
                              value={editFormData.nomComplet} 
                              onChange={(e) => setEditFormData({ ...editFormData, nomComplet: e.target.value })} 
                              className="bg-[#F3F3F2] border border-[#404040]/20 text-[11px] p-1.5 rounded text-[#404040] outline-none w-full" 
                            />
                          ) : (
                            lieu.nomComplet || "—"
                          )}
                        </td>

                        {/* ADRESSE / VILLE */}
                        <td className="py-3 px-3 text-[#404040]">
                          {isEditing && editFormData ? (
                            <div className="space-y-1">
                              <input 
                                type="text" 
                                placeholder="Adresse..." 
                                value={editFormData.adresse} 
                                onChange={(e) => setEditFormData({ ...editFormData, adresse: e.target.value })} 
                                className="bg-[#F3F3F2] border border-[#404040]/20 text-[11px] p-1 rounded text-[#404040] outline-none w-full" 
                              />
                              <div className="flex gap-1">
                                <input 
                                  type="text" 
                                  placeholder="CP" 
                                  value={editFormData.codePostal} 
                                  onChange={(e) => setEditFormData({ ...editFormData, codePostal: e.target.value })} 
                                  className="bg-[#F3F3F2] border border-[#404040]/20 text-[11px] p-1 rounded text-[#404040] outline-none w-1/3" 
                                />
                                <input 
                                  type="text" 
                                  placeholder="Ville" 
                                  value={editFormData.ville} 
                                  onChange={(e) => setEditFormData({ ...editFormData, ville: e.target.value })} 
                                  className="bg-[#F3F3F2] border border-[#404040]/20 text-[11px] p-1 rounded text-[#404040] outline-none w-2/3" 
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="truncate">{lieu.adresse || "—"}</p>
                              {(lieu.codePostal || lieu.ville) && (
                                <p className="text-[10px] text-[#404040]/60">{lieu.codePostal} {lieu.ville}</p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* STATUT */}
                        <td className="py-3 px-3 text-center">
                          {isEditing && editFormData ? (
                            <select 
                              value={editFormData.actif ? "true" : "false"} 
                              onChange={(e) => setEditFormData({ ...editFormData, actif: e.target.value === "true" })} 
                              className="bg-[#F3F3F2] border border-[#404040]/20 text-[11px] p-1 rounded text-[#404040] outline-none"
                            >
                              <option value="true">Actif</option>
                              <option value="false">Inactif</option>
                            </select>
                          ) : (
                            lieu.actif ? (
                              <span className="inline-flex items-center gap-1 bg-[#A9E0C9]/30 border border-[#A9E0C9] text-[#005259] px-2 py-0.5 rounded-full text-[10px] font-bold">Actif</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 text-rose-600 px-2 py-0.5 rounded-full text-[10px] font-bold">Inactif</span>
                            )
                          )}
                        </td>

                        {/* ACTIONS */}
                        <td className="py-3 px-3 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => handleUpdateLieu(lieu.id)} className="p-1 bg-[#005259] text-white hover:bg-[#EA601F] rounded shadow-sm transition-colors" title="Valider">
                                <CheckIcon className="w-4 h-4 stroke-[3]" />
                              </button>
                              <button onClick={() => { setEditingId(null); setEditFormData(null); }} className="p-1 bg-[#F3F3F2] border border-[#404040]/20 text-[#404040] hover:bg-slate-200 rounded" title="Annuler">
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => startEditing(lieu)} className="p-1.5 bg-[#F3F3F2] border border-[#404040]/10 hover:border-[#005259] text-[#005259] rounded-lg transition-colors" title="Éditer">
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                              
                              {/* Bouton Archiver / Désarchiver */}
                              <button 
                                onClick={() => requestToggleArchiveLieu(lieu)} 
                                className={`p-1.5 bg-[#F3F3F2] border rounded-lg transition-colors ${
                                  lieu.actif 
                                    ? "border-amber-500/30 hover:bg-amber-500/10 text-amber-600" 
                                    : "border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600"
                                }`}
                                title={lieu.actif ? "Archiver ce lieu" : "Désarchiver ce lieu"}
                              >
                                {lieu.actif ? (
                                  <ArchiveBoxIcon className="w-4 h-4" />
                                ) : (
                                  <ArrowPathIcon className="w-4 h-4" />
                                )}
                              </button>

                              <button onClick={() => requestDeleteLieu(lieu.id, lieu.nomCourt)} className="p-1.5 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-600 rounded-lg transition-colors" title="Supprimer définitivement">
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          ) : (

            /* --- VUE CARTES (GRID) --- */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedLieux.map((lieu) => (
                <div 
                  key={lieu.id} 
                  className="bg-[#F3F3F2] border border-[#404040]/10 rounded-xl p-4 flex flex-col justify-between hover:border-[#005259]/40 transition-all shadow-sm group relative"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h3 className="font-bold text-[#005259] text-sm uppercase tracking-wide group-hover:translate-x-0.5 transition-transform">
                        {lieu.nomCourt}
                      </h3>
                      {lieu.actif ? (
                        <span className="bg-[#A9E0C9]/30 border border-[#A9E0C9] text-[#005259] px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0">Actif</span>
                      ) : (
                        <span className="bg-rose-500/10 border border-rose-500/30 text-rose-600 px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0">Inactif</span>
                      )}
                    </div>

                    <p className="text-xs text-[#404040] mb-3 font-semibold line-clamp-2">
                      {lieu.nomComplet || "Aucun nom complet renseigné"}
                    </p>

                    <div className="text-xs text-[#404040]/70 space-y-0.5 border-t border-[#404040]/10 pt-2">
                      <p className="truncate">{lieu.adresse || "Adresse non spécifiée"}</p>
                      {(lieu.codePostal || lieu.ville) && (
                        <p className="text-[11px] text-[#404040] font-bold">{lieu.codePostal} {lieu.ville}</p>
                      )}
                    </div>
                  </div>

                  {/* ACTIONS CARTE */}
                  <div className="flex items-center justify-end gap-2 border-t border-[#404040]/10 pt-3 mt-4">
                    <button 
                      onClick={() => startEditing(lieu)} 
                      className="p-1.5 bg-white border border-[#404040]/10 hover:border-[#005259] text-[#005259] rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase shadow-sm"
                      title="Modifier"
                    >
                      <PencilSquareIcon className="w-3.5 h-3.5" />
                      <span>Éditer</span>
                    </button>

                    <button 
                      onClick={() => requestToggleArchiveLieu(lieu)} 
                      className={`p-1.5 bg-white border rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase shadow-sm ${
                        lieu.actif 
                          ? "border-amber-500/30 hover:bg-amber-500/10 text-amber-600" 
                          : "border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600"
                      }`}
                      title={lieu.actif ? "Archiver" : "Désarchiver"}
                    >
                      {lieu.actif ? (
                        <>
                          <ArchiveBoxIcon className="w-3.5 h-3.5" />
                          <span>Archiver</span>
                        </>
                      ) : (
                        <>
                          <ArrowPathIcon className="w-3.5 h-3.5" />
                          <span>Désarchiver</span>
                        </>
                      )}
                    </button>

                    <button 
                      onClick={() => requestDeleteLieu(lieu.id, lieu.nomCourt)} 
                      className="p-1.5 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-600 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          )}
        </section>

        {/* MODALE D'AJOUT DE LIEU */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-[#404040]/50 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white border border-[#404040]/10 rounded-3xl shadow-2xl max-w-lg w-full p-6 md:p-8 relative text-[#404040] animate-in fade-in zoom-in-95 duration-150">
              
              <div className="flex justify-between items-center mb-6 pb-2 border-b border-[#404040]/10">
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5 text-[#EA601F]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#005259]">Ajouter un nouveau lieu</h2>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="text-[#404040]/50 hover:text-[#404040] p-1 rounded-lg hover:bg-[#F3F3F2] transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateLieu} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">
                    Nom Court / Raccourci *
                  </label>
                  <input 
                    type="text" 
                    value={formData.nomCourt} 
                    onChange={(e) => setFormData({ ...formData, nomCourt: e.target.value })} 
                    className={inputClass} 
                    placeholder="Ex: 92 - Suresnes / CCAS..." 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">
                    Nom Complet
                  </label>
                  <input 
                    type="text" 
                    value={formData.nomComplet} 
                    onChange={(e) => setFormData({ ...formData, nomComplet: e.target.value })} 
                    className={inputClass} 
                    placeholder="Ex: Centre Communal d'Action Sociale de Suresnes" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">
                    Adresse
                  </label>
                  <input 
                    type="text" 
                    value={formData.adresse} 
                    onChange={(e) => setFormData({ ...formData, adresse: e.target.value })} 
                    className={inputClass} 
                    placeholder="Ex: 6 Rue de Verdun" 
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">
                      Code Postal
                    </label>
                    <input 
                      type="text" 
                      value={formData.codePostal} 
                      onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })} 
                      className={inputClass} 
                      placeholder="92150" 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">
                      Ville
                    </label>
                    <input 
                      type="text" 
                      value={formData.ville} 
                      onChange={(e) => setFormData({ ...formData, ville: e.target.value })} 
                      className={inputClass} 
                      placeholder="Suresnes" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">
                    Statut du lieu
                  </label>
                  <select 
                    value={formData.actif ? "true" : "false"} 
                    onChange={(e) => setFormData({ ...formData, actif: e.target.value === "true" })} 
                    className={inputClass}
                  >
                    <option value="true">Actif (Visible dans les formulaires)</option>
                    <option value="false">Inactif (Archivé)</option>
                  </select>
                </div>

                {modalStatus && (
                  <div className="p-3 rounded-xl text-xs font-bold text-center border bg-[#F3F3F2] text-[#005259] border-[#404040]/10">
                    {modalStatus}
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t border-[#404040]/10 pt-4 mt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] hover:bg-slate-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2.5 bg-[#EA601F] hover:bg-[#EF736A] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md"
                  >
                    Enregistrer le lieu
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* POP-UP DISCRÈTE DE CONFIRMATION */}
        {confirmConfig.isOpen && (
          <div className="fixed inset-0 bg-[#404040]/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-[#404040]/15 rounded-2xl shadow-2xl max-w-sm w-full p-5 text-[#404040] animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-xl shrink-0 ${confirmConfig.isDanger ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30' : 'bg-[#005259]/10 text-[#005259] border border-[#005259]/30'}`}>
                  <ExclamationTriangleIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase text-[#005259] tracking-wide">
                    {confirmConfig.title}
                  </h3>
                  <p className="text-xs text-[#404040]/80 mt-1 leading-relaxed">
                    {confirmConfig.message}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5 border-t border-[#404040]/10 pt-3">
                <button
                  onClick={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] hover:bg-slate-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmConfig.onConfirm}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase transition-all shadow-md ${
                    confirmConfig.isDanger
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-[#005259] hover:bg-[#005259]/90 text-white'
                  }`}
                >
                  {confirmConfig.actionLabel}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
    </PageGuard>
  );
}
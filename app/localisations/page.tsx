"use client";

import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, addDoc, doc, updateDoc } from "firebase/firestore";
import { 
  BuildingOfficeIcon, 
  PencilSquareIcon, 
  ArchiveBoxIcon,
  ChevronLeftIcon,
  XMarkIcon,
  Squares2X2Icon,  
  ListBulletIcon,
  MapPinIcon,
  PlusIcon,
  UsersIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";

export default function GestionLieux() {
  const [lieux, setLieux] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLieu, setEditingLieu] = useState<any | null>(null);
  
  const [currentTab, setCurrentTab] = useState<"actifs" | "archives">("actifs");
  const [displayMode, setDisplayMode] = useState<"cartes" | "liste">("cartes");

  // Formulaire avec le champ typeAction ajouté
  const [formData, setFormData] = useState({
    nomRaccourci: "",
    nomComplet: "",
    adresse: "",
    codePostal: "",
    localisation: "",
    typeAction: "",
    actif: true
  });

  useEffect(() => {
    const unsubLieux = onSnapshot(collection(db, "liste_lieux"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLieux(data);
    });

    return () => {
      unsubLieux();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nomRaccourci || !formData.nomComplet || !formData.adresse || !formData.codePostal || !formData.localisation) {
      alert("Tous les champs obligatoires doivent être remplis.");
      return;
    }

    const payload = {
      nomRaccourci: formData.nomRaccourci.trim(),
      nomComplet: formData.nomComplet.trim(),
      adresse: formData.adresse.trim(),
      codePostal: formData.codePostal.trim(),
      localisation: formData.localisation.trim(),
      typeAction: formData.typeAction.trim().toUpperCase(),
      actif: formData.actif
    };

    try {
      if (editingLieu) {
        await updateDoc(doc(db, "liste_lieux", editingLieu.id), payload);
      } else {
        await addDoc(collection(db, "liste_lieux"), payload);
      }
      closeModal();
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du lieu :", err);
    }
  };

  const toggleArchive = async (l: any) => {
    try {
      await updateDoc(doc(db, "liste_lieux", l.id), { actif: !l.actif });
    } catch (err) {
      console.error("Erreur lors du changement de statut :", err);
    }
  };

  const openModal = (lieu: any = null) => {
    if (lieu) {
      setEditingLieu(lieu);
      setFormData({
        nomRaccourci: lieu.nomRaccourci || "",
        nomComplet: lieu.nomComplet || "",
        adresse: lieu.adresse || "",
        codePostal: lieu.codePostal || "",
        localisation: lieu.localisation || "",
        typeAction: lieu.typeAction || "",
        actif: lieu.actif !== undefined ? lieu.actif : true
      });
    } else {
      setEditingLieu(null);
      setFormData({
        nomRaccourci: "",
        nomComplet: "",
        adresse: "",
        codePostal: "",
        localisation: "",
        typeAction: "",
        actif: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLieu(null);
  };

  const filteredLieux = lieux
    .filter(l => (currentTab === "actifs" ? l.actif !== false : l.actif === false))
    .sort((a, b) => (a.nomRaccourci || "").localeCompare(b.nomRaccourci || ""));

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      
      {/* HEADER */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 border-b border-slate-900 pb-6">
        <div className="flex items-center gap-3">
          <Link 
            href="/" 
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer flex items-center justify-center"
            title="Retour à l'accueil"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Gestion des Lieux & Locations
            </h1>
            <p className="text-xs text-slate-500 font-medium">Configurez vos lieux d'intervention, adresses et localisations</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0">
          <Link
            href="/liste-beneficiaires"
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white px-5 py-3 rounded-xl font-bold uppercase text-xs tracking-wider transition-all cursor-pointer flex-1 md:flex-none"
          >
            <UsersIcon className="w-4 h-4 text-slate-400" />
            <span>Liste des bénéficiaires</span>
          </Link>

          <button 
            onClick={() => openModal()} 
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all cursor-pointer flex-1 md:flex-none"
          >
            <PlusIcon className="w-5 h-5" /> 
            <span>Ajouter un lieu</span>
          </button>
        </div>
      </div>

      {/* FILTRES & MODE D'AFFICHAGE */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 mb-6 bg-slate-950/40 p-1.5 rounded-xl border border-slate-900/60">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-900">
          <button 
            onClick={() => setCurrentTab("actifs")} 
            className={`px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${currentTab === "actifs" ? "bg-slate-900 text-emerald-400" : "text-slate-500"}`}
          >
            Lieux actifs ({filteredLieux.length})
          </button>
          <button 
            onClick={() => setCurrentTab("archives")} 
            className={`px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${currentTab === "archives" ? "bg-slate-900 text-orange-400" : "text-slate-500"}`}
          >
            Archives
          </button>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-900">
          <button onClick={() => setDisplayMode("cartes")} className={`p-2 rounded-md cursor-pointer ${displayMode === "cartes" ? "bg-slate-900 text-white" : "text-slate-600"}`}><Squares2X2Icon className="w-4 h-4" /></button>
          <button onClick={() => setDisplayMode("liste")} className={`p-2 rounded-md cursor-pointer ${displayMode === "liste" ? "bg-slate-900 text-white" : "text-slate-600"}`}><ListBulletIcon className="w-4 h-4" /></button>
        </div>
      </div>

      {/* LISTING LIEUX */}
      <div className="max-w-7xl mx-auto">
        {filteredLieux.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
            <p className="text-slate-500 text-sm font-medium">Aucun lieu trouvé.</p>
          </div>
        ) : displayMode === "cartes" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredLieux.map((l) => (
              <div key={l.id} className="group relative bg-slate-950/90 border-2 border-slate-700 hover:border-emerald-500/50 rounded-2xl p-5 shadow-2xl flex flex-col justify-between min-h-[190px] transition-all duration-200">
                
                {/* EN-TÊTE EN HAUT À DROITE : LOCALISATION + INITIALES TYPE ACTION */}
                <div className="absolute top-0 right-0 flex items-stretch">
                  {l.typeAction && (
                    <div className="rounded-bl-xl border-l-2 border-b-2 border-slate-700 bg-indigo-950/80 text-[10px] font-black uppercase px-2.5 py-1.5 text-indigo-400 tracking-wider">
                      {l.typeAction}
                    </div>
                  )}
                  <div className={`rounded-bl-xl rounded-tr-2xl border-l-2 border-b-2 border-slate-700 bg-slate-900 text-[10px] font-black uppercase px-3 py-1.5 text-emerald-400 ${l.typeAction ? 'border-l-2' : ''}`}>
                    {l.localisation}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 font-black text-xs shrink-0">
                      <BuildingOfficeIcon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white uppercase">{l.nomRaccourci}</h3>
                      <p className="text-[11px] text-slate-400 font-medium">{l.nomComplet}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1 border-t border-slate-900/60 pt-3 text-[11px] text-slate-400">
                    <p className="flex items-start gap-1.5">
                      <MapPinIcon className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <span>{l.adresse}, <strong className="text-slate-200">{l.codePostal} {l.localisation}</strong></span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-900/60 pt-3 mt-4">
                  <span className="text-[10px] bg-slate-900 px-2 py-1 rounded border border-slate-800 text-slate-400 font-mono">
                    CP : {l.codePostal}
                  </span>
                  <div className="flex gap-1.5">
                    <button onClick={() => openModal(l)} className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"><PencilSquareIcon className="w-4 h-4" /></button>
                    <button onClick={() => toggleArchive(l)} className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 cursor-pointer"><ArchiveBoxIcon className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* VERSION TABLEAU */
          <div className="w-full bg-slate-950/40 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 text-[10px] font-black uppercase text-slate-500 border-b-2 border-slate-700">
                  <th className="p-4 pl-6">Nom raccourci</th>
                  <th className="p-4">Nom intégral</th>
                  <th className="p-4">Type d'action</th>
                  <th className="p-4">Adresse</th>
                  <th className="p-4">Code Postal</th>
                  <th className="p-4">Localisation</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                {filteredLieux.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-950/50">
                    <td className="p-4 pl-6 font-bold text-white uppercase">{l.nomRaccourci}</td>
                    <td className="p-4 text-slate-300">{l.nomComplet}</td>
                    <td className="p-4 font-black text-indigo-400">{l.typeAction || "-"}</td>
                    <td className="p-4 text-slate-400">{l.adresse}</td>
                    <td className="p-4 font-mono text-[11px] text-slate-400">{l.codePostal}</td>
                    <td className="p-4 font-semibold text-emerald-400">{l.localisation}</td>
                    <td className="p-4 pr-6 text-right">
                      <button onClick={() => openModal(l)} className="p-1 text-slate-500 hover:text-white mr-2 cursor-pointer"><PencilSquareIcon className="w-4 h-4" /></button>
                      <button onClick={() => toggleArchive(l)} className="p-1 text-slate-500 cursor-pointer"><ArchiveBoxIcon className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALE CREATION / EDITION */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-950 border-2 border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-5">
              <h2 className="text-base font-black uppercase text-white flex items-center gap-2">
                <BuildingOfficeIcon className="w-5 h-5 text-emerald-500" />
                {editingLieu ? "Modifier le lieu" : "Nouveau lieu"}
              </h2>
              <button onClick={closeModal} className="p-1.5 bg-slate-900 border border-slate-800 text-slate-500 hover:text-white rounded-lg cursor-pointer"><XMarkIcon className="w-4 h-4" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Nom de lieu raccourci *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: MPT Massy, Fablab..." 
                  className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none focus:border-emerald-500" 
                  value={formData.nomRaccourci} 
                  onChange={e => setFormData({...formData, nomRaccourci: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Nom de lieu en intégralité *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: Maison Pour Tous Massy-Opéra" 
                  className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none focus:border-emerald-500" 
                  value={formData.nomComplet} 
                  onChange={e => setFormData({...formData, nomComplet: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Type d'action (Initiales)</label>
                <input 
                  type="text" 
                  maxLength={5}
                  placeholder="Ex: AT, FORM, ACC..." 
                  className="w-full p-3 bg-slate-900/50 border border-slate-800 text-indigo-300 font-mono font-bold uppercase rounded-lg outline-none focus:border-emerald-500" 
                  value={formData.typeAction} 
                  onChange={e => setFormData({...formData, typeAction: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Adresse *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: 12 avenue des Champs" 
                  className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none focus:border-emerald-500" 
                  value={formData.adresse} 
                  onChange={e => setFormData({...formData, adresse: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Code postal *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ex: 91300" 
                    className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg font-mono outline-none focus:border-emerald-500" 
                    value={formData.codePostal} 
                    onChange={e => setFormData({...formData, codePostal: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Localisation / Ville *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ex: Massy, Paris..." 
                    className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none focus:border-emerald-500" 
                    value={formData.localisation} 
                    onChange={e => setFormData({...formData, localisation: e.target.value})} 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800/60 pt-5 mt-6">
                <button type="button" onClick={closeModal} className="px-5 py-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white cursor-pointer">Annuler</button>
                <button type="submit" className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-black uppercase cursor-pointer">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, addDoc, doc, updateDoc } from "firebase/firestore";
import { 
  UserPlusIcon, 
  PencilSquareIcon, 
  ArchiveBoxIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  CurrencyEuroIcon,
  ClockIcon,
  UserIcon,
  XMarkIcon,
  EnvelopeIcon,
  PhoneIcon,       
  Squares2X2Icon,  
  ListBulletIcon,
  MapPinIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";

export default function GestionEquipe() {
  const [mediateurs, setMediateurs] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<any | null>(null);
  
  // États pour filtrer la vue (actifs/archivés) et le format d'affichage (cartes/liste)
  const [currentTab, setCurrentTab] = useState<"actifs" | "archives">("actifs");
  const [displayMode, setDisplayMode] = useState<"cartes" | "liste">("cartes");

  // État du formulaire avec Prénom, Nom et Trigramme
  const [formData, setFormData] = useState({
    prenom: "",      
    nom: "",         
    trigramme: "",   
    email: "",
    telephone: "",
    poste: "Médiateur Numérique",
    statut: "Permanent", 
    sitePrincipal: "",   
    taux: 0,
    debutACI: "09:30",
    finACI: "17:00",
    actif: true
  });

  // Récupération en temps réel depuis Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "liste_mediateurs"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMediateurs(data);
    });
    return () => unsubscribe();
  }, []);

  // Fonction d'importation CSV
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Découpe le fichier par ligne
      const lines = text.split(/\r?\n/);
      if (lines.length === 0) return;
      
      // Détection automatique du séparateur (; ou ,)
      const firstLine = lines[0] || "";
      const separator = firstLine.includes(";") ? ";" : ",";
      
      // On ignore la première ligne d'en-têtes
      const rows = lines.slice(1); 
      let importCount = 0;

      for (const row of rows) {
        if (!row.trim()) continue; // Ignore les lignes vides

        const columns = row.split(separator); 
        
        const prenom = columns[0]?.trim() || "";
        const nom = columns[1]?.trim() || "";
        const trigramme = columns[2]?.trim()?.toUpperCase() || "";
        const email = columns[3]?.trim() || "";
        const telephone = columns[4]?.trim() || "";
        const poste = columns[5]?.trim() || "Médiateur Numérique";
        const statut = columns[6]?.trim() || "Permanent"; 
        const sitePrincipal = columns[7]?.trim() || "";

        // Le prénom et le nom sont requis au minimum
        if (prenom && nom) {
          try {
            await addDoc(collection(db, "liste_mediateurs"), {
              prenom,
              nom,
              trigramme,
              email,
              telephone,
              poste,
              statut,
              sitePrincipal,
              taux: Number(columns[8]?.trim()) || 0,
              debutACI: columns[9]?.trim() || "09:30",
              finACI: columns[10]?.trim() || "17:00",
              actif: true
            });
            importCount++;
          } catch (error) {
            console.error(`Erreur lors de l'import de ${prenom} ${nom}:`, error);
          }
        }
      }

      alert(`🎉 Importation terminée avec succès ! ${importCount} membres ont été ajoutés.`);
      e.target.value = ""; // Réinitialise l'input
    };

    reader.readAsText(file, "UTF-8");
  };

  // Soumission du formulaire (Ajout ou Édition)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.prenom || !formData.nom) return;

    try {
      if (editingMed) {
        await updateDoc(doc(db, "liste_mediateurs", editingMed.id), formData);
      } else {
        await addDoc(collection(db, "liste_mediateurs"), formData);
      }
      closeModal();
    } catch (err) {
      console.error("Erreur lors de la sauvegarde :", err);
    }
  };

  // Toggle Actif / Archivé
  const toggleArchive = async (m: any) => {
    try {
      await updateDoc(doc(db, "liste_mediateurs", m.id), {
        actif: !m.actif
      });
    } catch (err) {
      console.error("Erreur lors du changement de statut :", err);
    }
  };

  const openModal = (med: any = null) => {
    if (med) {
      setEditingMed(med);
      setFormData({
        prenom: med.prenom || "",
        nom: med.nom || "",
        trigramme: med.trigramme || "",
        email: med.email || "",
        telephone: med.telephone || "",
        poste: med.poste || "Médiateur Numérique",
        statut: med.statut || "Permanent",
        sitePrincipal: med.sitePrincipal || "",
        taux: med.taux || 0,
        debutACI: med.debutACI || "09:30",
        finACI: med.finACI || "17:00",
        actif: med.actif !== undefined ? med.actif : true
      });
    } else {
      setEditingMed(null);
      setFormData({
        prenom: "",
        nom: "",
        trigramme: "",
        email: "",
        telephone: "",
        poste: "Médiateur Numérique",
        statut: "Permanent",
        sitePrincipal: "",
        taux: 0,
        debutACI: "09:30",
        finACI: "17:00",
        actif: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMed(null);
  };

  // Ordre de priorité stricte des statuts
  const statutOrder: { [key: string]: number } = {
    "Cadre": 1,
    "Permanent": 2,
    "Stagiaire": 3,
    "ACI": 4
  };

  // Filtrage et Tri logique
  const filteredMediateurs = mediateurs
    .filter(m => {
      if (currentTab === "actifs") return m.actif !== false;
      return m.actif === false;
    })
    .sort((a, b) => {
      const orderA = statutOrder[a.statut] || 99;
      const orderB = statutOrder[b.statut] || 99;

      // 1. D'abord séparer (Cadre/Permanent/Stagiaire) des (ACI)
      const isAciA = orderA === 4 ? 1 : 0;
      const isAciB = orderB === 4 ? 1 : 0;
      if (isAciA !== isAciB) {
        return isAciA - isAciB; // Les non-ACI (0) passent avant les ACI (1)
      }

      // 2. Regrouper par Territoire (Ceux sans territoire vont à la fin "ZZZZ")
      const siteA = (a.sitePrincipal || "ZZZZ").toLowerCase();
      const siteB = (b.sitePrincipal || "ZZZZ").toLowerCase();
      if (siteA !== siteB) {
        return siteA.localeCompare(siteB);
      }

      // 3. À territoire identique, trier selon l'ordre exact : Cadre > Permanent > Stagiaire
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // 4. Si même territoire et même statut, trier par Nom puis par Prénom
      const nomA = (a.nom || "").toLowerCase();
      const nomB = (b.nom || "").toLowerCase();
      if (nomA !== nomB) {
        return nomA.localeCompare(nomB);
      }

      const prenomA = (a.prenom || "").toLowerCase();
      const prenomB = (b.prenom || "").toLowerCase();
      return prenomA.localeCompare(prenomB);
    });

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      
      {/* HEADER SECTION */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 border-b border-slate-900 pb-6">
        <div className="flex items-center gap-4">
          {/* BOUTON RETOUR POINTANT VERS ACTIVITES_TYPES */}
          <Link href="/activites_types" className="p-2.5 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all active:scale-95 flex items-center gap-2 text-xs font-bold" title="Revenir à l'agenda">
            <ChevronLeftIcon className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline text-slate-400 font-medium">Agenda</span>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
              Gestion de l'Équipe
            </h1>
            <p className="text-xs text-slate-500 font-medium">Configurez vos collaborateurs, rôles et horaires de référence</p>
          </div>
        </div>

        {/* Boutons d'Action Header */}
        <div className="flex items-center gap-3 self-end md:self-auto w-full md:w-auto justify-end">
          {/* Bouton Import CSV */}
          <label className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 px-4 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all border border-slate-800 hover:border-slate-700 cursor-pointer active:scale-95">
            <ArrowPathIcon className="w-4 h-4 text-emerald-500" />
            <span>Importer CSV</span>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleCSVImport} 
            />
          </label>

          {/* Bouton Ajouter Membre */}
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-950/20 cursor-pointer"
          >
            <UserPlusIcon className="w-5 h-5" /> Ajouter un membre
          </button>
        </div>
      </div>

      {/* TABS & FILTRES VISUELS */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 mb-6 bg-slate-950/40 p-1.5 rounded-xl border border-slate-900/60">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-900">
          <button 
            onClick={() => setCurrentTab("actifs")}
            className={`px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${currentTab === "actifs" ? "bg-slate-900 text-emerald-400 shadow" : "text-slate-500 hover:text-slate-300"}`}
          >
            Membres actifs ({mediateurs.filter(m => m.actif !== false).length})
          </button>
          <button 
            onClick={() => setCurrentTab("archives")}
            className={`px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${currentTab === "archives" ? "bg-slate-900 text-orange-400 shadow" : "text-slate-500 hover:text-slate-300"}`}
          >
            Archives ({mediateurs.filter(m => m.actif === false).length})
          </button>
        </div>

        {/* Sélecteurs de mode d'affichage (Cartes / Liste) */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-900">
          <button 
            onClick={() => setDisplayMode("cartes")}
            className={`p-2 rounded-md transition-all cursor-pointer ${displayMode === "cartes" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-400"}`}
            title="Vue Cartes"
          >
            <Squares2X2Icon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setDisplayMode("liste")}
            className={`p-2 rounded-md transition-all cursor-pointer ${displayMode === "liste" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-400"}`}
            title="Vue Table/Liste"
          >
            <ListBulletIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* GRILLE / LISTE PRINCIPALE */}
      <div className="max-w-7xl mx-auto">
        {filteredMediateurs.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-900 rounded-2xl bg-slate-950/20">
            <p className="text-slate-500 text-sm font-medium">Aucun membre trouvé dans cette catégorie.</p>
          </div>
        ) : displayMode === "cartes" ? (
          
          /* MODE VISUEL : CARTES PROFIL */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMediateurs.map((m) => (
              <div 
                key={m.id}
                className="group relative bg-slate-950/60 border border-slate-900 hover:border-slate-800 rounded-2xl p-5 transition-all duration-300 shadow-xl flex flex-col justify-between min-h-[190px]"
              >
                {/* BADGE STATUT AJUSTÉ (Ne déborde plus visuellement) */}
                <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-xl rounded-tr-2xl text-[10px] font-black uppercase tracking-widest w-max border-l border-b
                  ${m.statut === 'Cadre' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                    m.statut === 'ACI' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                    m.statut === 'Stagiaire' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                  {m.statut}
                </div>

                {/* Bloc Identité */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:border-slate-700 font-black tracking-tighter text-xs">
                      {m.trigramme || `${m.prenom?.[0] || ""}${m.nom?.[0] || ""}`}
                    </div>
                    <div className="max-w-[160px]">
                      <h3 className="font-bold text-sm text-white tracking-wide truncate">
                        {m.prenom} <span className="uppercase text-slate-300 font-extrabold">{m.nom}</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-semibold truncate flex items-center gap-1 mt-0.5">
                        {m.poste}
                      </p>
                    </div>
                  </div>

                  {/* Coordonnées */}
                  <div className="space-y-1 border-t border-slate-900/60 pt-3 mt-1 text-[11px] text-slate-400">
                    {m.email && (
                      <p className="flex items-center gap-1.5 truncate text-slate-400" title={m.email}>
                        <EnvelopeIcon className="w-3.5 h-3.5 text-slate-600 shrink-0" /> {m.email}
                      </p>
                    )}
                    {m.telephone && (
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <PhoneIcon className="w-3.5 h-3.5 text-slate-600 shrink-0" /> {m.telephone}
                      </p>
                    )}
                    {m.sitePrincipal && (
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <MapPinIcon className="w-3.5 h-3.5 text-emerald-600/80 shrink-0" /> Territoire : <span className="font-bold text-emerald-400/90">{m.sitePrincipal}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Carte / Actions Métriques */}
                <div className="flex items-center justify-between border-t border-slate-900/60 pt-3 mt-4">
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1 bg-slate-900/50 px-2 py-1 rounded border border-slate-900">
                      <CurrencyEuroIcon className="w-3.5 h-3.5 text-slate-500" /> Taux : {m.taux || 0}€
                    </span>
                    {m.statut === "ACI" && (
                      <span className="flex items-center gap-1 bg-slate-900/50 px-2 py-1 rounded border border-slate-900">
                        <ClockIcon className="w-3.5 h-3.5 text-orange-500/70" /> {m.debutACI || "09:30"}-{m.finACI || "17:00"}
                      </span>
                    )}
                  </div>

                  {/* Actions Édition / Archive */}
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => openModal(m)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                      title="Modifier la fiche"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => toggleArchive(m)}
                      className={`p-1.5 border rounded-lg transition-all cursor-pointer ${m.actif !== false ? "bg-slate-900 hover:bg-orange-950/20 border-slate-800 hover:border-orange-900/40 text-slate-400 hover:text-orange-400" : "bg-slate-900 hover:bg-emerald-950/20 border-slate-800 hover:border-emerald-900/40 text-slate-400 hover:text-emerald-400"}`}
                      title={m.actif !== false ? "Archiver le membre" : "Restaurer le membre"}
                    >
                      <ArchiveBoxIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          
          /* MODE COMPACT : APPARENCE TABLEAU DE BORD */
          <div className="w-full bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-900">
                    <th className="p-4 pl-6">Initiales</th>
                    <th className="p-4">Collaborateur</th>
                    <th className="p-4">Poste / Rôle</th>
                    <th className="p-4">Statut</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Territoire</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-xs font-medium text-slate-300">
                  {filteredMediateurs.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-950/50 transition-all group">
                      <td className="p-4 pl-6">
                        <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] font-black text-slate-400 group-hover:border-slate-700">
                          {m.trigramme || "-"}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-white">
                        {m.prenom} <span className="uppercase text-slate-400 text-[11px] ml-0.5">{m.nom}</span>
                      </td>
                      <td className="p-4 text-slate-400">{m.poste}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border
                          ${m.statut === 'Cadre' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                            m.statut === 'ACI' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                            m.statut === 'Stagiaire' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                          {m.statut}
                        </span>
                      </td>
                      <td className="p-4 space-y-0.5 text-slate-400 font-normal">
                        {m.email && <p className="truncate max-w-[180px]">{m.email}</p>}
                        {m.telephone && <p className="text-slate-500">{m.telephone}</p>}
                      </td>
                      <td className="p-4">
                        {m.sitePrincipal ? (
                          <span className="text-emerald-400 font-bold bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">
                            {m.sitePrincipal}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openModal(m)}
                            className="p-1 hover:bg-slate-900 rounded text-slate-500 hover:text-white transition-all cursor-pointer"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => toggleArchive(m)}
                            className={`p-1 hover:bg-slate-900 rounded transition-all cursor-pointer ${m.actif !== false ? "text-slate-500 hover:text-orange-400" : "text-slate-500 hover:text-emerald-400"}`}
                          >
                            <ArchiveBoxIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* COMPOSANT MODALE (AJOUT / EDITION) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-950 border border-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            
            {/* Header Modale */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-5">
              <h2 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-emerald-500" />
                {editingMed ? "Modifier la fiche" : "Ajouter un collaborateur"}
              </h2>
              <button 
                onClick={closeModal}
                className="p-1.5 bg-slate-900 border border-slate-800 text-slate-500 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Formulaire Principal */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* Ligne Identité (Prénom / Nom) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Prénom *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Justine"
                    className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none font-bold focus:border-emerald-500" 
                    value={formData.prenom}
                    onChange={e => setFormData({...formData, prenom: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Nom de famille *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: PERINEL"
                    className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none font-bold uppercase focus:border-emerald-500" 
                    value={formData.nom}
                    onChange={e => setFormData({...formData, nom: e.target.value})}
                  />
                </div>
              </div>

              {/* Trigramme / Poste */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Trigramme</label>
                  <input 
                    type="text" 
                    maxLength={3}
                    placeholder="Ex: JPE"
                    className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none font-bold uppercase tracking-widest text-center focus:border-emerald-500" 
                    value={formData.trigramme}
                    onChange={e => setFormData({...formData, trigramme: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Poste / Fonction</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Médiateur Numérique"
                    className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none font-bold focus:border-emerald-500" 
                    value={formData.poste}
                    onChange={e => setFormData({...formData, poste: e.target.value})}
                  />
                </div>
              </div>

              {/* Email / Téléphone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Adresse Email</label>
                  <input 
                    type="email" 
                    placeholder="nom@colombbus.org"
                    className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none font-medium focus:border-emerald-500" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Téléphone</label>
                  <input 
                    type="tel" 
                    placeholder="06 00 00 00 00"
                    className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none font-medium focus:border-emerald-500" 
                    value={formData.telephone}
                    onChange={e => setFormData({...formData, telephone: e.target.value})}
                  />
                </div>
              </div>

              {/* Sélection Statut / Territoire / Coût */}
              <div className="grid grid-cols-3 gap-4 border-t border-slate-900/60 pt-4 mt-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Contrat / Statut</label>
                  <select 
                    className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-lg outline-none font-bold focus:border-emerald-500"
                    value={formData.statut}
                    onChange={e => setFormData({...formData, statut: e.target.value})}
                  >
                    <option value="Permanent">Permanent</option>
                    <option value="Cadre">Cadre</option>
                    <option value="Stagiaire">Stagiaire</option>
                    <option value="ACI">ACI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Territoire principal</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Paris ou Massy"
                    className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none font-bold focus:border-emerald-500 text-center text-emerald-400" 
                    value={formData.sitePrincipal}
                    onChange={e => setFormData({...formData, sitePrincipal: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Coût Horaire (€)</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none font-bold focus:border-emerald-500 text-center" 
                    value={formData.taux}
                    onChange={e => setFormData({...formData, taux: Number(e.target.value)})}
                  />
                </div>
              </div>

              {/* Section dédiée au paramétrage des horaires si ACI */}
              {formData.statut === "ACI" && (
                <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4 mt-3 animate-fade-in">
                  <p className="text-[10px] font-black uppercase tracking-wider text-orange-400 mb-3 flex items-center gap-1.5">
                    <ClockIcon className="w-4 h-4" /> Horaires de référence ACI (Grille)
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Début de journée</label>
                      <input 
                        type="time" 
                        className="w-full p-3 bg-slate-950 border border-orange-900/50 text-white rounded-lg outline-none font-bold text-xs focus:border-orange-500" 
                        value={formData.debutACI}
                        onChange={e => setFormData({...formData, debutACI: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Fin de journée</label>
                      <input 
                        type="time" 
                        className="w-full p-3 bg-slate-950 border border-orange-900/50 text-white rounded-lg outline-none font-bold text-xs focus:border-orange-500" 
                        value={formData.finACI}
                        onChange={e => setFormData({...formData, finACI: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* BOUTONS D'ACTION (Fin de formulaire) */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-800/60 pt-5 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-emerald-950/20 cursor-pointer"
                >
                  {editingMed ? "Enregistrer" : "Créer"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
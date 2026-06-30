"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import Link from "next/link";
import { 
  ArrowLeftIcon, 
  MapPinIcon, 
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  TrashIcon
} from "@heroicons/react/24/outline";

export default function EmargementsPage() {
  const [sites, setSites] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState("");
  
  // Champs du formulaire
  const [nomSite, setNomSite] = useState("");
  const [description, setDescription] = useState("");
  const [googleDocUrl, setGoogleDocUrl] = useState("");

  // Récupération en temps réel des lieux depuis Firebase
  useEffect(() => {
    const q = query(collection(db, "lieux_emargement"), orderBy("nomSite", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSites(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Soumission du nouveau lieu
  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomSite || !googleDocUrl) return;

    setStatus("Ajout en cours...");
    try {
      await addDoc(collection(db, "lieux_emargement"), {
        nomSite,
        description: description || "Aucune description fournie",
        googleDocUrl,
        createdAt: new Date().toISOString()
      });
      
      // Reset le formulaire
      setNomSite("");
      setDescription("");
      setGoogleDocUrl("");
      setShowForm(false);
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus("❌ Erreur lors de l'ajout");
    }
  };

  // Suppression d'un lieu au besoin
  const handleDeleteSite = async (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer ce lieu d'émargement ?")) {
      try {
        await deleteDoc(doc(db, "lieux_emargement", id));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const inputClass = "w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 outline-none transition-all";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased relative overflow-hidden">
      
      {/* EFFET LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-3xl mx-auto relative z-10">
        
        {/* EN-TÊTE AVEC RETOUR ACCUEIL & BOUTON AJOUTER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white rounded-xl text-slate-400 transition-all active:scale-95 shadow-md"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 bg-cyan-500 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
              <div>
                <h1 className="text-2xl font-black text-white uppercase italic tracking-tight">
                  Emargements <span className="text-cyan-400 not-italic font-light">et autres documents</span>
                </h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                  Accès direct aux registres Google Docs par structure
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md self-start sm:self-auto"
          >
            <PlusIcon className="w-4 h-4" />
            <span>{showForm ? "Fermer" : "Ajouter un document"}</span>
          </button>
        </div>

        {/* FORMULAIRE D'AJOUT DYNAMIQUE */}
        {showForm && (
          <form onSubmit={handleAddSite} className="mb-8 p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
            <h2 className="text-xs font-black uppercase tracking-widest text-cyan-400">Nouveau point d'émargement</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Nom du Site *</label>
                <input type="text" placeholder="Ex: Suresnes — Centre Principal" value={nomSite} onChange={(e) => setNomSite(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Description / Précision</label>
                <input type="text" placeholder="Ex: Atelier numérique de l'après-midi" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Lien Google Doc / Google Sheet *</label>
              <input type="url" placeholder="https://docs.google.com/..." value={googleDocUrl} onChange={(e) => setGoogleDocUrl(e.target.value)} required className={inputClass} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase">{status}</span>
              <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer">
                Enregistrer le document
              </button>
            </div>
          </form>
        )}

        {/* LISTE DES SITES CONFIGURÉS */}
        <div className="grid gap-4">
          {sites.map((site) => (
            <div 
              key={site.id}
              className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-4 shadow-xl hover:border-cyan-500/20 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl text-cyan-400 shrink-0 group-hover:border-cyan-500/30 group-hover:shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-all">
                  <MapPinIcon className="w-5 h-5" />
                </div>
                
                <div className="min-w-0">
                  <h3 className="font-black text-base text-white uppercase italic tracking-tight group-hover:text-cyan-400 transition-colors truncate">
                    {site.nomSite}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                    {site.description}
                  </p>
                </div>
              </div>

              {/* ACTIONS : OUVRIR ET SUPPRIMER */}
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => handleDeleteSite(site.id)}
                  className="p-2 bg-slate-950 border border-slate-800 text-slate-600 hover:text-red-400 hover:border-red-950 rounded-xl transition-colors cursor-pointer"
                  title="Supprimer ce document"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
                
                <a 
                  href={site.googleDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-950 group-hover:bg-cyan-600 text-slate-400 group-hover:text-white text-[10px] font-black uppercase tracking-wider rounded-xl border border-slate-800 group-hover:border-cyan-500 transition-all shadow-sm"
                >
                  <span className="hidden sm:inline">Ouvrir</span>
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}

          {/* MESSAGE SI LISTE VIDE */}
          {sites.length === 0 && !status.includes("Ajout") && (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl text-xs font-bold uppercase tracking-widest text-slate-600">
              🔍 Aucun document configuré. Cliquez sur "Ajouter un document" ci-dessus.
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
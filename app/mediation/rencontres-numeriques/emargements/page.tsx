"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import {
  HomeIcon,
  MapPinIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  TrashIcon
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { useConfirm } from "@/components/ConfirmProvider";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function EmargementsPage() {
  const confirm = useConfirm();
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
    if (await confirm("Voulez-vous vraiment supprimer ce lieu d'émargement ?")) {
      try {
        await deleteDoc(doc(db, "lieux_emargement", id));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const inputClass = "w-full bg-[#F3F3F2] text-[#404040] border border-[#404040]/15 rounded-xl p-3 text-xs font-bold placeholder-[#404040]/40 focus:border-[#005259] outline-none transition-all";

  return (
    <PageGuard pageId="page_access_emargements">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-3xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE AVEC RETOUR ACCUEIL & BOUTON AJOUTER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
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
                <h1 className="text-xl font-extrabold text-[#005259] uppercase tracking-tight">
                  Émargements <span className="text-[#EA601F] font-light">et autres documents</span>
                </h1>
                <p className="text-[10px] text-[#404040]/70 font-bold uppercase tracking-widest mt-0.5">
                  Accès direct aux registres Google Docs par structure
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#005259] hover:bg-[#005259]/90 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm self-start sm:self-auto"
          >
            <PlusIcon className="w-4 h-4 text-[#EA601F]" />
            <span>{showForm ? "Fermer" : "Ajouter un document"}</span>
          </button>
        </div>

        {/* FORMULAIRE D'AJOUT DYNAMIQUE */}
        {showForm && (
          <form onSubmit={handleAddSite} className="p-6 bg-white border border-[#404040]/10 rounded-3xl shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#005259]">Nouveau point d'émargement</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#005259] uppercase mb-1">Nom du Site *</label>
                <input type="text" placeholder="Ex: Suresnes — Centre Principal" value={nomSite} onChange={(e) => setNomSite(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#005259] uppercase mb-1">Description / Précision</label>
                <input type="text" placeholder="Ex: Atelier numérique de l'après-midi" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#005259] uppercase mb-1">Lien Google Doc / Google Sheet *</label>
              <input type="url" placeholder="https://docs.google.com/..." value={googleDocUrl} onChange={(e) => setGoogleDocUrl(e.target.value)} required className={inputClass} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-[#EA601F] font-bold uppercase">{status}</span>
              <button type="submit" className="bg-[#EA601F] hover:bg-[#005259] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">
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
              className="p-5 bg-white border border-[#404040]/10 rounded-2xl flex items-center justify-between gap-4 shadow-sm hover:border-[#005259]/30 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="p-2.5 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl text-[#005259] shrink-0 group-hover:bg-[#005259] group-hover:text-white transition-all">
                  <MapPinIcon className="w-5 h-5" />
                </div>
                
                <div className="min-w-0">
                  <h3 className="font-extrabold text-base text-[#005259] uppercase tracking-tight truncate">
                    {site.nomSite}
                  </h3>
                  <p className="text-xs text-[#404040]/70 font-medium mt-0.5 leading-relaxed">
                    {site.description}
                  </p>
                </div>
              </div>

              {/* ACTIONS : OUVRIR ET SUPPRIMER */}
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => handleDeleteSite(site.id)}
                  className="p-2.5 bg-[#F3F3F2] border border-[#404040]/10 text-[#404040]/50 hover:text-red-500 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                  title="Supprimer ce document"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
                
                <a 
                  href={site.googleDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#F3F3F2] group-hover:bg-[#EA601F] text-[#005259] group-hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-xl border border-[#404040]/15 group-hover:border-[#EA601F] transition-all shadow-sm"
                >
                  <span className="hidden sm:inline">Ouvrir</span>
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}

          {/* MESSAGE SI LISTE VIDE */}
          {sites.length === 0 && !status.includes("Ajout") && (
            <div className="text-center py-16 border border-dashed border-[#404040]/20 rounded-2xl text-xs font-bold uppercase tracking-widest text-[#404040]/50 bg-white/50">
              🔍 Aucun document configuré. Cliquez sur "Ajouter un document" ci-dessus.
            </div>
          )}
        </div>

      </div>
    </main>
    </PageGuard>
  );
}
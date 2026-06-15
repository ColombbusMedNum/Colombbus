"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase"; 
import { collection, addDoc, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { TrashIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function BibliothequeLogosGratuite() {
  const [logos, setLogos] = useState<any[]>([]);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [nomLogo, setNomNomLogo] = useState("");
  const [uploading, setUploading] = useState(false);

  // 1. Charger la bibliothèque depuis Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "logos_emargement"), (snap) => {
      setLogos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // 2. Convertir l'image sélectionnée en texte (Base64)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Sécurité : éviter les fichiers trop lourds pour Firestore (max 1 Mo conseillé pour un logo)
      if (file.size > 1024 * 1024) {
        alert("Ce fichier est trop lourd. Merci de choisir un logo de moins de 1 Mo.");
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 3. Enregistrer le texte de l'image dans Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileBase64 || !nomLogo) return alert("Veuillez donner un nom et choisir une image.");

    setUploading(true);
    try {
      await addDoc(collection(db, "logos_emargement"), {
        nom: nomLogo,
        url: fileBase64, // L'URL devient directement la chaîne Base64 textuelle
        createdAt: new Date().toISOString()
      });

      setFileBase64("");
      setNomNomLogo("");
      // Réinitialiser le champ file
      const fileInput = document.getElementById("logo-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      alert("Logo enregistré avec succès dans la bibliothèque !");
    } catch (error) {
      console.error("Erreur d'enregistrement :", error);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black uppercase tracking-tighter italic">
            Bibliothèque <span className="text-blue-500">Logos</span> <span className="text-xs text-emerald-400 font-normal not-italic tracking-normal bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">Gratuit</span>
          </h1>
          <Link href="/emargement" className="text-xs bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl hover:bg-slate-800 transition-all">
            ← Vers le Générateur
          </Link>
        </div>

        {/* FORMULAIRE D'AJOUT SANS STORAGE */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Nom du partenaire</label>
              <input 
                type="text" 
                value={nomLogo} 
                onChange={e => setNomNomLogo(e.target.value)}
                placeholder="Ex: Ville de Suresnes" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Fichier Image (PNG/JPG &lt; 1Mo)</label>
              <input 
                id="logo-file-input"
                type="file" 
                accept="image/*"
                onChange={handleFileChange}
                className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer w-full"
              />
            </div>
            <button 
              disabled={uploading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold uppercase text-[10px] py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {uploading ? "Enregistrement..." : <><CloudArrowUpIcon className="w-4 h-4"/> Enregistrer dans la bibliothèque</>}
            </button>
          </form>
        </div>

        {/* AFFICHAGE DE LA BIBLIOTHÈQUE POUR VÉRIFICATION */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {logos.map(logo => (
            <div key={logo.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center group relative">
               <div className="w-full h-24 bg-white rounded-lg mb-3 flex items-center justify-center p-2">
                  <img src={logo.url} alt={logo.nom} className="max-h-full max-w-full object-contain" />
               </div>
               <div className="text-[10px] font-bold uppercase text-slate-300 text-center truncate w-full">{logo.nom}</div>
               
               <button 
                onClick={async () => { if(confirm("Supprimer ce logo définitivement ?")) await deleteDoc(doc(db, "logos_emargement", logo.id)) }}
                className="absolute top-2 right-2 p-1.5 bg-red-950/80 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
               >
                <TrashIcon className="w-3.5 h-3.5"/>
               </button>
            </div>
          ))}
          {logos.length === 0 && (
            <div className="col-span-full text-center text-xs text-slate-500 py-8">
              Aucun logo dans votre bibliothèque pour le moment.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
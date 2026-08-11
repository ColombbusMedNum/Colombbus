"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { TrashIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function BibliothequeLogosGratuite() {
  const [logos, setLogos] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [nomLogo, setNomNomLogo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 1. Charger la bibliothèque depuis Firestore. Chargement unique (pas de
  // temps réel) : cette bibliothèque de logos change rarement (upload manuel
  // par un membre du staff), une écoute permanente n'apporte rien et garde
  // une connexion ouverte inutilement sur chaque page ouverte.
  const fetchLogos = async () => {
    try {
      setLoadError(null);
      const snap = await getDocs(collection(db, "logos_emargement"));
      setLogos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error: any) {
      console.error("Erreur de chargement des logos :", error);
      setLoadError(error?.message || "Erreur inconnue");
    }
  };

  useEffect(() => {
    fetchLogos();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (file.size > 1024 * 1024) {
        alert("Ce fichier est trop lourd. Merci de choisir un logo de moins de 1 Mo.");
        e.target.value = "";
        return;
      }

      setSelectedFile(file);
    }
  };

  // 2. Encoder l'image en base64 et l'enregistrer directement dans le
  // document Firestore. Ni Firebase Storage (nécessite le forfait Blaze) ni
  // Vercel Blob (blocage de déploiement lié à l'identité Git de ce dépôt) ne
  // sont utilisables sur ce projet ; le fichier reste limité à 1 Mo
  // (cf. handleFileChange), donc le coût en taille de document Firestore
  // reste négligeable.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !nomLogo) return alert("Veuillez donner un nom et choisir une image.");

    setUploading(true);
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      await addDoc(collection(db, "logos_emargement"), {
        nom: nomLogo,
        url,
        createdAt: new Date().toISOString()
      });

      setSelectedFile(null);
      setNomNomLogo("");
      const fileInput = document.getElementById("logo-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      await fetchLogos();
      alert("Logo enregistré avec succès dans la bibliothèque !");
    } catch (error) {
      console.error("Erreur d'enregistrement :", error);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setUploading(false);
    }
  };

  // 3. L'image vit directement dans le document Firestore (champ `url` en
  // base64) : la supprimer ne demande rien de plus que supprimer le document.
  const handleDelete = async (logo: any) => {
    if (!confirm("Supprimer ce logo définitivement ?")) return;
    try {
      await deleteDoc(doc(db, "logos_emargement", logo.id));
      await fetchLogos();
    } catch (error) {
      console.error("Erreur lors de la suppression :", error);
    }
  };

  return (
    <PageGuard pageId="page_access_bibliotheque_logos">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-[#005259]">
            Bibliothèque <span className="text-[#EA601F]">Logos</span> <span className="text-xs text-[#005259] font-bold normal-case tracking-normal bg-[#005259]/10 border border-[#005259]/20 px-2 py-0.5 rounded-full">Gratuit</span>
          </h1>
          <Link href="/mediation/rencontres-numeriques/emargement" className="text-xs bg-white border border-[#404040]/10 px-4 py-2 rounded-xl text-[#005259] font-bold uppercase tracking-wider hover:bg-[#005259] hover:text-white transition-all shadow-sm">
            ← Vers le Générateur
          </Link>
        </div>

        {/* FORMULAIRE D'AJOUT (encodage base64, stocké dans Firestore) */}
        <div className="bg-white border border-[#404040]/10 rounded-3xl p-6 mb-10 shadow-sm">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#005259] mb-2 tracking-wider">Nom du partenaire</label>
              <input
                type="text"
                value={nomLogo}
                onChange={e => setNomNomLogo(e.target.value)}
                placeholder="Ex: Ville de Suresnes"
                className="w-full bg-[#F3F3F2] border border-[#404040]/10 rounded-xl px-4 py-2.5 text-xs text-[#404040] outline-none focus:border-[#EA601F] focus:ring-1 focus:ring-[#EA601F] transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#005259] mb-2 tracking-wider">Fichier Image (PNG/JPG &lt; 1Mo)</label>
              <input
                id="logo-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="text-xs text-[#404040]/70 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#005259] file:text-white hover:file:bg-[#003d42] cursor-pointer w-full"
              />
            </div>
            <button
              disabled={uploading}
              className="w-full bg-[#EA601F] hover:bg-[#EF736A] disabled:bg-[#404040]/20 text-white font-bold uppercase text-[10px] py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
            >
              {uploading ? "Enregistrement..." : <><CloudArrowUpIcon className="w-4 h-4"/> Enregistrer dans la bibliothèque</>}
            </button>
          </form>
        </div>

        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl p-4 mb-6">
            Erreur de chargement de la bibliothèque : {loadError}
          </div>
        )}

        {/* AFFICHAGE DE LA BIBLIOTHÈQUE POUR VÉRIFICATION */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {logos.map(logo => (
            <div key={logo.id} className="bg-white border border-[#404040]/10 rounded-2xl p-4 flex flex-col items-center group relative shadow-sm">
               <div className="w-full h-24 bg-[#F3F3F2] rounded-lg mb-3 flex items-center justify-center p-2">
                  <img src={logo.url} alt={logo.nom} className="max-h-full max-w-full object-contain" />
               </div>
               <div className="text-[10px] font-bold uppercase text-[#404040]/70 text-center truncate w-full">{logo.nom}</div>

               <button
                onClick={() => handleDelete(logo)}
                className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 border border-red-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
               >
                <TrashIcon className="w-3.5 h-3.5"/>
               </button>
            </div>
          ))}
          {logos.length === 0 && (
            <div className="col-span-full text-center text-xs text-[#404040]/50 font-bold uppercase tracking-wider py-8">
              Aucun logo dans votre bibliothèque pour le moment.
            </div>
          )}
        </div>
      </div>
    </main>
    </PageGuard>
  );
}

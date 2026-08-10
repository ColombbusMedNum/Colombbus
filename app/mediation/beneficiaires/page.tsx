"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import Link from "next/link";
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  BriefcaseIcon,
  ArrowRightIcon,
  ListBulletIcon
} from "@heroicons/react/24/outline";
import { Quicksand } from "next/font/google";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function BeneficiaryForm() {
  const [status, setStatus] = useState("");
  const [formData, setFormData] = useState({
    civilite: "M.",
    nom: "",
    prenom: "",
    age: "", // Ajout du champ age dans le state
    email: "",
    telephone: "",
    ville: "",
    codePostal: "",
    situationSocioPro: "",
    handicap: "Non",
    rqth: "Non",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Enregistrement en cours...");

    try {
      await addDoc(collection(db, "utilisateurs"), {
        Civilité: formData.civilite,
        Nom: formData.nom.toUpperCase(),
        Prénom: formData.prenom,
        Age: formData.age ? Number(formData.age) : null, // Enregistrement de l'âge sous forme de nombre
        email: formData.email,
        Téléphone: formData.telephone,
        Ville: formData.ville,
        Code_Postal: formData.codePostal,
        Situation_Socio_Pro: formData.situationSocioPro,
        Situation_Handicap: formData.handicap,
        RQTH: formData.rqth,
        dateCreation: new Date().toISOString(),
      });

      setStatus("✅ Bénéficiaire enregistré avec succès !");

      setFormData({
        civilite: "M.", nom: "", prenom: "", age: "", email: "", telephone: "",
        ville: "", codePostal: "", situationSocioPro: "", handicap: "Non", rqth: "Non",
      });
    } catch (error) {
      console.error(error);
      setStatus("❌ Erreur de permissions ou réseau");
    }
  };

  // Classe Tailwind partagée pour harmoniser les champs du formulaire
  const inputClass = "w-full bg-[#F3F3F2] border border-[#404040]/10 rounded-xl p-2.5 text-xs text-[#404040] placeholder-[#404040]/40 focus:border-[#EA601F] focus:ring-1 focus:ring-[#EA601F] outline-none transition-all";

  return (
    <PageGuard pageId="page_access_beneficiaires">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] py-12 px-4 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#005259]/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-2xl mx-auto bg-white border border-[#404040]/10 rounded-3xl shadow-sm p-6 md:p-8 relative z-10">

        {/* TITRE ET CONTEXTE */}
        <header className="mb-8 relative">
          <div className="flex items-center gap-3 mb-2 justify-center">
            <div className="h-6 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <h1 className="text-xl font-bold tracking-tight text-[#005259] uppercase">
              Enregistrer un bénéficiaire
            </h1>
          </div>
          <p className="text-[10px] text-center text-[#404040]/50 font-bold uppercase tracking-widest">
            Collecte des informations du compte bénéficiaire
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* SECTION 1 : IDENTITÉ */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-[#404040]/10">
              <UserIcon className="w-4 h-4 text-[#EA601F]" />
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60">Identité civile</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#404040]/50 uppercase tracking-tighter mb-1">Civilité *</label>
                <select name="civilite" value={formData.civilite} onChange={handleChange} className={`${inputClass} cursor-pointer`}>
                  <option value="M.">Monsieur (M.)</option>
                  <option value="Mme">Madame (Mme)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#404040]/50 uppercase tracking-tighter mb-1">Prénom *</label>
                <input type="text" name="prenom" placeholder="Ex: Jean" value={formData.prenom} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#404040]/50 uppercase tracking-tighter mb-1">Nom *</label>
                <input type="text" name="nom" placeholder="Ex: DUPONT" value={formData.nom} onChange={handleChange} required className={inputClass} />
              </div>
            </div>

            {/* Rangée supplémentaire pour l'âge pour garder l'interface propre */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#404040]/50 uppercase tracking-tighter mb-1">Âge *</label>
                <input type="number" name="age" min="0" max="120" placeholder="Ex: 35" value={formData.age} onChange={handleChange} required className={inputClass} />
              </div>
            </div>
          </div>

          {/* SECTION 2 : COORDONNÉES */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-[#404040]/10">
              <EnvelopeIcon className="w-4 h-4 text-[#005259]" />
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60">Coordonnées de contact</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#404040]/50 uppercase tracking-tighter mb-1">Adresse Email</label>
                <div className="relative">
                  <EnvelopeIcon className="w-4 h-4 text-[#404040]/30 absolute left-3 top-3" />
                  <input type="email" name="email" placeholder="adresse@email.com" value={formData.email} onChange={handleChange} className={`${inputClass} pl-9`} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#404040]/50 uppercase tracking-tighter mb-1">Téléphone *</label>
                <div className="relative">
                  <PhoneIcon className="w-4 h-4 text-[#404040]/30 absolute left-3 top-3" />
                  <input type="tel" name="telephone" placeholder="06 00 00 00 00" value={formData.telephone} onChange={handleChange} required className={`${inputClass} pl-9 font-mono`} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-[#404040]/50 uppercase tracking-tighter mb-1">Ville</label>
                <div className="relative">
                  <MapPinIcon className="w-4 h-4 text-[#404040]/30 absolute left-3 top-3" />
                  <input type="text" name="ville" placeholder="Suresnes" value={formData.ville} onChange={handleChange} className={`${inputClass} pl-9 uppercase tracking-wide`} />
                </div>
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-[#404040]/50 uppercase tracking-tighter mb-1">Code Postal</label>
                <input type="text" name="codePostal" placeholder="92150" value={formData.codePostal} onChange={handleChange} className={`${inputClass} font-mono`} />
              </div>
            </div>
          </div>

          {/* SECTION 3 : SITUATION & HANDICAP */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-[#404040]/10">
              <BriefcaseIcon className="w-4 h-4 text-[#EA601F]" />
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#404040]/60">Situation Socio-Professionnelle</h2>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#404040]/50 uppercase tracking-tighter mb-1">Situation actuelle</label>
              <select name="situationSocioPro" value={formData.situationSocioPro} onChange={handleChange} className={`${inputClass} cursor-pointer`}>
                <option value="">-- Choisir une situation --</option>
                <option value="Salarie">Salarié(e)</option>
                <option value="Demandeur emploi">Demandeur d'emploi</option>
                <option value="Retraite">Retraité(e)</option>
                <option value="Etudiant">Étudiant(e) / Scolaire</option>
                <option value="Sans activite">Sans activité</option>
                <option value="Entrepreneur">Auto-entrepreneur / Indépendant</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#404040]/50 uppercase tracking-tighter mb-1">Situation de handicap ?</label>
                <select name="handicap" value={formData.handicap} onChange={handleChange} className={`${inputClass} cursor-pointer`}>
                  <option value="Non">Non</option>
                  <option value="Oui">Oui</option>
                  <option value="Ne souhaite pas preciser">Ne souhaite pas préciser</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#404040]/50 uppercase tracking-tighter mb-1">Reconnaissance RQTH ?</label>
                <select name="rqth" value={formData.rqth} onChange={handleChange} className={`${inputClass} cursor-pointer`}>
                  <option value="Non">Non</option>
                  <option value="Oui">Oui</option>
                  <option value="En cours">En cours de demande</option>
                </select>
              </div>
            </div>
          </div>

          {/* SOUMISSION & NOTIFICATION D'ETAT */}
          <div className="pt-4 space-y-4">
            {status && (
              <div className={`p-3 rounded-xl text-xs font-bold text-center border uppercase tracking-wide ${
                status.includes('✅')
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : status.includes('❌')
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-[#F3F3F2] border-[#404040]/10 text-[#404040]/60 animate-pulse'
              }`}>
                {status}
              </div>
            )}

            <button type="submit" className="w-full bg-[#EA601F] hover:bg-[#EF736A] text-white py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer group">
              <span>Valider l'inscription</span>
              <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </form>

        {/* RETOUR LISTE */}
        <footer className="mt-8 pt-4 border-t border-[#404040]/10 text-center">
          <Link href="/mediation/rencontres-numeriques/liste-beneficiaires" className="inline-flex items-center gap-2 text-xs text-[#404040]/60 hover:text-[#EA601F] font-bold uppercase tracking-wider transition-colors group">
            <ListBulletIcon className="w-4 h-4 text-[#404040]/40 group-hover:text-[#EA601F] transition-colors" />
            <span>Voir la liste des inscrits</span>
          </Link>
        </footer>

      </div>
    </main>
    </PageGuard>
  );
}

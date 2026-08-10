"use client";

import { useState } from "react";
import { db } from "../../lib/firebase"; 
import { collection, addDoc } from "firebase/firestore";
import Link from "next/link";

export default function BeneficiaryForm() {
  const [status, setStatus] = useState("");
  const [formData, setFormData] = useState({
    civilite: "M.",
    nom: "",
    prenom: "",
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
      
      // Réinitialisation du formulaire
      setFormData({
        civilite: "M.",
        nom: "",
        prenom: "",
        email: "",
        telephone: "",
        ville: "",
        codePostal: "",
        situationSocioPro: "",
        handicap: "Non",
        rqth: "Non",
      });
    } catch (error) {
      console.error("Erreur Firebase:", error);
      setStatus("❌ Erreur lors de l'enregistrement.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-black my-10">
      <h1 className="text-2xl font-bold mb-6 text-center text-blue-900">Nouveau Bénéficiaire</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* SECTION 1 : IDENTITÉ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1">Civilité *</label>
            <select name="civilite" value={formData.civilite} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50">
              <option value="M.">Monsieur (M.)</option>
              <option value="Mme">Madame (Mme)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Prénom *</label>
            <input type="text" name="prenom" value={formData.prenom} onChange={handleChange} required className="w-full p-2 border rounded" placeholder="Jean" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">NOM *</label>
            <input type="text" name="nom" value={formData.nom} onChange={handleChange} required className="w-full p-2 border rounded" placeholder="DUPONT" />
          </div>
        </div>

        {/* SECTION 2 : CONTACT & LIEU */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded" placeholder="exemple@mail.com" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Téléphone *</label>
            <input type="tel" name="telephone" value={formData.telephone} onChange={handleChange} required className="w-full p-2 border rounded" placeholder="0612345678" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Ville</label>
            <input type="text" name="ville" value={formData.ville} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Paris" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Code Postal</label>
            <input type="text" name="codePostal" value={formData.codePostal} onChange={handleChange} className="w-full p-2 border rounded" placeholder="75000" />
          </div>
        </div>

        {/* SECTION 3 : SOCIO-PRO & HANDICAP */}
        <div className="border-t pt-4">
          <label className="block text-sm font-semibold mb-1">Situation socio-professionnelle</label>
          <select name="situationSocioPro" value={formData.situationSocioPro} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 mb-4">
            <option value="">-- Choisir une situation --</option>
            <option value="Salarie">Salarié(e)</option>
            <option value="Demandeur emploi">Demandeur d'emploi</option>
            <option value="Retraite">Retraité(e)</option>
            <option value="Etudiant">Étudiant(e) / Scolaire</option>
            <option value="Sans activite">Sans activité</option>
            <option value="Entrepreneur">Auto-entrepreneur / Indépendant</option>
          </select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Situation de handicap ?</label>
              <select name="handicap" value={formData.handicap} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50">
                <option value="Non">Non</option>
                <option value="Oui">Oui</option>
                <option value="Ne souhaite pas preciser">Ne souhaite pas préciser</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Reconnaissance RQTH ?</label>
              <select name="rqth" value={formData.rqth} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50">
                <option value="Non">Non</option>
                <option value="Oui">Oui</option>
                <option value="En cours">En cours de demande</option>
              </select>
            </div>
          </div>
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg">
          Enregistrer le bénéficiaire
        </button>

        <div className="text-center mt-4">
          <Link href="/mediation/rencontres-numeriques/liste-beneficiaires" className="text-blue-600 hover:underline text-sm">
            ← Retour à la liste
          </Link>
        </div>
      </form>

      {status && (
        <div className={`mt-6 p-3 rounded text-center font-bold ${status.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {status}
        </div>
      )}
    </div>
  );
}
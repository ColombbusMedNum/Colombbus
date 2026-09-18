"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import { CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { formatNom, formatPrenom } from "@/lib/formatName";
import { formatPhoneForStorage } from "@/lib/formatPhone";
import { QUESTIONS_COLLECTE_TECH, SCORE_MAX_COLLECTE_TECH, calculerScoreCollecteTech, profilCollecteTechDepuisScore } from "@/lib/collecteTechQuiz";

// Version PUBLIQUE et autonome (voir middleware.ts, tout /inscription/* est
// ouvert) du diagnostic "Collecte Tech", question par question — même
// principe d'assistant que app/mediation/rencontres-numeriques/diagnosticform
// (staff-only, lié à une fiche existante), mais ici rattaché uniquement à
// Digital Up 96H / Actions Collectives : la personne se diagnostique
// elle-même, le résultat est un enregistrement autonome (voir
// lib/collecteTechQuiz.ts pour les questions/le barème partagés).

type Etape = "identite" | "questions";

export default function CollecteTechDigitalUp96HPage() {
  const [etape, setEtape] = useState<Etape>("identite");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formData, setFormData] = useState({ nom: "", prenom: "", telephone: "", email: "", rgpd: false });
  const [reponses, setReponses] = useState<Record<string, number>>({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState<{ score: number; profil: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const [piege, setPiege] = useState("");
  const [debutRemplissage] = useState(() => Date.now());

  const totalQuestions = QUESTIONS_COLLECTE_TECH.length;
  const questionActuelle = QUESTIONS_COLLECTE_TECH[currentQuestionIndex];
  const progressionPourcentage = ((currentQuestionIndex + 1) / totalQuestions) * 100;
  const aReponduQuestionActuelle = reponses[questionActuelle?.id] !== undefined;

  const demarrer = () => {
    setErreur(null);
    if (!formData.rgpd) {
      setErreur("Le consentement RGPD est obligatoire pour enregistrer votre diagnostic.");
      return;
    }
    if (!formData.nom.trim() || !formData.prenom.trim() || !formData.email.trim()) {
      setErreur("Merci de renseigner votre nom, prénom et adresse mail.");
      return;
    }
    setCurrentQuestionIndex(0);
    setEtape("questions");
  };

  const choisirReponse = (index: number) => {
    setReponses((prev) => ({ ...prev, [questionActuelle.id]: index }));
  };

  const handleSubmit = async () => {
    setErreur(null);
    const dureeRemplissageMs = Date.now() - debutRemplissage;
    const score = calculerScoreCollecteTech(reponses);
    const profil = profilCollecteTechDepuisScore(score);
    if (piege.trim() !== "" || dureeRemplissageMs < 4000) {
      setEnvoye({ score, profil: profil.label });
      return;
    }

    setEnvoiEnCours(true);
    try {
      await addDoc(collection(db, "resultats_collecte_tech_digitaluppro"), {
        _piege: piege,
        _dureeRemplissageMs: dureeRemplissageMs,
        Nom: formatNom(formData.nom),
        Prénom: formatPrenom(formData.prenom),
        Téléphone: formatPhoneForStorage(formData.telephone),
        Email: formData.email.trim(),
        Réponses: reponses,
        Score: score,
        Profil: profil.label,
        RGPD: formData.rgpd,
        createdAt: serverTimestamp(),
      });
      setEnvoye({ score, profil: profil.label });
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du diagnostic Collecte Tech :", error);
      setErreur("Une erreur est survenue lors de l'envoi — merci de réessayer.");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] outline-none font-medium transition-colors";
  const labelClass = "block text-xs font-bold uppercase tracking-wide text-[#005259] mb-1.5";

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] font-medium antialiased`}>
      <div className="max-w-xl mx-auto px-4 py-10 sm:py-14">

        <div className="text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-black uppercase text-[#005259] tracking-tight">
            2026 — Digital Up <span className="text-[#EA601F]">96 heures</span>
          </h1>
          <p className="text-sm font-bold text-[#404040] mt-1">Diagnostic Collecte Tech</p>
        </div>

        {/* Champ piège anti-bot : invisible pour un vrai visiteur. */}
        <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
          <label htmlFor="site-web">Site web</label>
          <input id="site-web" type="text" name="site-web" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
        </div>

        {envoye ? (
          <div className="bg-white border border-[#404040]/10 rounded-3xl p-8 shadow-sm text-center space-y-3">
            <CheckCircleIcon className="w-12 h-12 text-[#A9E0C9] mx-auto" />
            <h2 className="text-lg font-black uppercase text-[#005259]">Diagnostic envoyé !</h2>
            <p className="text-sm text-[#404040]/70">Merci {formData.prenom}, votre diagnostic a bien été enregistré.</p>
            <div className="inline-flex flex-col items-center gap-1 bg-[#F3F3F2] rounded-2xl px-6 py-4 mt-2">
              <span className="text-3xl font-black text-[#005259]">{envoye.score}/{SCORE_MAX_COLLECTE_TECH}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#EA601F]">{envoye.profil}</span>
            </div>
          </div>
        ) : etape === "identite" ? (
          <div className="bg-white border border-[#404040]/10 rounded-3xl p-5 sm:p-8 shadow-sm space-y-6">
            <p className="text-xs text-[#404040]/70 leading-relaxed">
              Ce diagnostic évalue votre niveau de départ sur les bases de l'informatique et d'Internet, pour adapter votre accompagnement au sein du programme Digital Up 96H. Il comporte {totalQuestions} questions.
            </p>

            <div className="bg-[#88ACEA]/10 border border-[#88ACEA]/40 rounded-xl p-3 text-[11px] text-[#404040]">
              Les données seront traitées en conformité avec la loi RGPD 2018.
            </div>

            {erreur && (
              <div className="bg-[#EF736A]/10 border border-[#EF736A]/30 text-[#EF736A] text-xs font-bold rounded-xl p-3">
                {erreur}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nom *</label>
                  <input type="text" required value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Prénom *</label>
                  <input type="text" required value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Numéro de téléphone</label>
                  <input type="tel" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Adresse mail *</label>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} />
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-[#404040] cursor-pointer">
                <input type="checkbox" checked={formData.rgpd} onChange={(e) => setFormData({ ...formData, rgpd: e.target.checked })} className="mt-0.5 accent-[#005259]" />
                <span>J'accepte que mes données personnelles soient collectées et utilisées dans le cadre de ce diagnostic, en conformité avec la loi RGPD 2018. *</span>
              </label>

              <button
                type="button"
                onClick={demarrer}
                className="w-full py-3 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Démarrer le diagnostic
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">

            <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="h-8 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
                <div>
                  <span className="text-[10px] font-bold text-[#005259] uppercase tracking-widest bg-[#005259]/10 border border-[#005259]/20 px-2.5 py-0.5 rounded-full">
                    Collecte Tech
                  </span>
                  <h2 className="text-base font-bold mt-1 text-[#005259] uppercase tracking-tight">
                    {formData.prenom} <span className="text-[#404040]">{formData.nom}</span>
                  </h2>
                </div>
              </div>
              <span className="text-xs font-bold text-white bg-[#005259] px-3 py-1 rounded-xl shadow-sm shrink-0">
                {currentQuestionIndex + 1} / {totalQuestions}
              </span>
            </div>

            <div className="w-full bg-white rounded-full h-2.5 border border-[#404040]/10 p-0.5 overflow-hidden shadow-inner">
              <div
                className="bg-[#005259] h-full transition-all duration-300 rounded-full shadow-[0_0_8px_rgba(0,82,89,0.3)]"
                style={{ width: `${progressionPourcentage}%` }}
              />
            </div>

            {erreur && (
              <div className="bg-[#EF736A]/10 border border-[#EF736A]/30 text-[#EF736A] text-xs font-bold rounded-xl p-3">
                {erreur}
              </div>
            )}

            <div className="bg-white border border-[#404040]/10 rounded-2xl p-6 space-y-5 shadow-sm min-h-[260px] flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#005259] uppercase tracking-widest bg-[#005259]/10 border border-[#005259]/20 px-2.5 py-1 rounded-md">
                  Évaluation Collect.Tech
                </span>
                <h2 className="text-sm font-bold text-[#005259] leading-relaxed pt-2">{questionActuelle.question}</h2>
              </div>
              <div className="grid grid-cols-1 gap-2.5 pt-2">
                {questionActuelle.options.map((option, idx) => {
                  const isSelected = reponses[questionActuelle.id] === idx;
                  return (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected ? "bg-[#005259]/5 border-[#005259] text-[#005259] font-bold ring-1 ring-[#005259]/30 shadow-sm" : "bg-white border-[#404040]/10 hover:bg-[#F3F3F2] text-[#404040]"
                      }`}
                    >
                      <input type="radio" name={questionActuelle.id} checked={isSelected} onChange={() => choisirReponse(idx)} className="accent-[#005259] w-4 h-4" />
                      <span>{option.text}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                className="flex items-center gap-1.5 text-xs font-bold text-[#404040]/70 hover:text-[#005259] disabled:opacity-30 transition-colors cursor-pointer uppercase tracking-wider"
              >
                <ChevronLeftIcon className="w-4 h-4 text-[#EA601F]" />
                Précédent
              </button>

              {currentQuestionIndex < totalQuestions - 1 ? (
                <button
                  type="button"
                  disabled={!aReponduQuestionActuelle}
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  className="flex items-center gap-1.5 bg-[#EA601F] hover:bg-[#EF736A] text-white text-xs font-bold px-5 py-2.5 rounded-xl disabled:opacity-30 transition-all cursor-pointer shadow-md uppercase tracking-wider"
                >
                  Suivant
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={envoiEnCours || !aReponduQuestionActuelle}
                  onClick={handleSubmit}
                  className="flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-30 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-md uppercase tracking-wider"
                >
                  <CheckCircleIcon className="w-4 h-4" />
                  <span>{envoiEnCours ? "Envoi..." : "Terminer et envoyer"}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

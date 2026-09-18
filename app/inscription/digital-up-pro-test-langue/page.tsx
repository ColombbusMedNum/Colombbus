"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { formatNom, formatPrenom } from "@/lib/formatName";
import { formatPhoneForStorage } from "@/lib/formatPhone";
import {
  QUESTIONS_PARTIE_1, QUESTIONS_PARTIE_2, TEXTE_COMPREHENSION, TOUTES_QUESTIONS,
  calculerScoreTestLangue, niveauB1DepuisScore,
} from "@/lib/testLangueB1";

// Formulaire PUBLIC (sans connexion, voir middleware.ts — tout /inscription/*
// est ouvert) de test d'auto-positionnement B1 pour Digital Up 96H. Auto-
// corrigé côté client (voir lib/testLangueB1.ts) : le score et le niveau sont
// calculés à l'envoi et enregistrés tels quels, dans un enregistrement
// autonome (pas de rapprochement avec une pré-inscription existante).

const CIVILITES = ["M.", "Mme.", "Autre."];

export default function TestLangueDigitalUp96HPage() {
  const [formData, setFormData] = useState({ civilite: "", nom: "", prenom: "", telephone: "", email: "", rgpd: false });
  const [reponses, setReponses] = useState<Record<string, number>>({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState<{ score: number; niveau: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Anti-bot : voir app/inscription/numerik-up-pro/page.tsx pour le même
  // mécanisme (champ invisible + délai minimum de remplissage), vérifié aussi
  // côté firestore.rules.
  const [piege, setPiege] = useState("");
  const [debutRemplissage] = useState(() => Date.now());

  const choisirReponse = (questionId: string, index: number) => {
    setReponses((prev) => ({ ...prev, [questionId]: index }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    if (!formData.rgpd) {
      setErreur("Le consentement RGPD est obligatoire pour enregistrer votre test.");
      return;
    }
    if (!formData.nom.trim() || !formData.prenom.trim() || !formData.email.trim()) {
      setErreur("Merci de renseigner votre nom, prénom et adresse mail.");
      return;
    }
    const questionsManquantes = TOUTES_QUESTIONS.filter((q) => reponses[q.id] === undefined);
    if (questionsManquantes.length > 0) {
      setErreur("Merci de répondre à toutes les questions avant d'envoyer le test.");
      return;
    }

    // Piège anti-bot : un vrai visiteur ne remplit jamais ce champ ni ne
    // soumet en moins de 4 secondes — on simule un envoi réussi (pour ne pas
    // signaler la détection) sans rien enregistrer.
    const dureeRemplissageMs = Date.now() - debutRemplissage;
    const score = calculerScoreTestLangue(reponses);
    const niveau = niveauB1DepuisScore(score);
    if (piege.trim() !== "" || dureeRemplissageMs < 4000) {
      setEnvoye({ score, niveau });
      return;
    }

    setEnvoiEnCours(true);
    try {
      await addDoc(collection(db, "resultats_test_langue_digitaluppro"), {
        _piege: piege,
        _dureeRemplissageMs: dureeRemplissageMs,
        Civilité: formData.civilite,
        Nom: formatNom(formData.nom),
        Prénom: formatPrenom(formData.prenom),
        Téléphone: formatPhoneForStorage(formData.telephone),
        Email: formData.email.trim(),
        Réponses: reponses,
        Score: score,
        Niveau_B1_Francais: niveau,
        RGPD: formData.rgpd,
        createdAt: serverTimestamp(),
      });
      setEnvoye({ score, niveau });
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du test de langue :", error);
      setErreur("Une erreur est survenue lors de l'envoi — merci de réessayer.");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] outline-none font-medium transition-colors";
  const labelClass = "block text-xs font-bold uppercase tracking-wide text-[#005259] mb-1.5";

  const renderQuestion = (q: (typeof TOUTES_QUESTIONS)[number], index: number) => (
    <div key={q.id} className="space-y-2">
      <p className="text-sm font-bold text-[#404040]">{index}. {q.enonce} <span className="text-[#EF736A]">*</span></p>
      <div className="space-y-1.5">
        {q.options.map((option, i) => (
          <label
            key={i}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors text-sm ${
              reponses[q.id] === i ? "bg-[#005259]/10 border-[#005259] text-[#005259] font-bold" : "bg-[#F3F3F2] border-[#404040]/10 text-[#404040] hover:border-[#005259]/40"
            }`}
          >
            <input
              type="radio"
              name={q.id}
              checked={reponses[q.id] === i}
              onChange={() => choisirReponse(q.id, i)}
              className="accent-[#005259]"
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] font-medium antialiased`}>
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">

        {/* EN-TÊTE */}
        <div className="text-center mb-8">
          <h1 className="text-xl sm:text-2xl font-black uppercase text-[#005259] tracking-tight">
            2026 — Digital Up <span className="text-[#EA601F]">96 heures</span>
          </h1>
          <p className="text-sm font-bold text-[#404040] mt-1">Test de langue B1</p>
        </div>

        {envoye ? (
          <div className="bg-white border border-[#404040]/10 rounded-3xl p-8 shadow-sm text-center space-y-3">
            <CheckCircleIcon className="w-12 h-12 text-[#A9E0C9] mx-auto" />
            <h2 className="text-lg font-black uppercase text-[#005259]">Test envoyé !</h2>
            <p className="text-sm text-[#404040]/70">Merci {formData.prenom}, votre test a bien été enregistré.</p>
            <div className="inline-flex flex-col items-center gap-1 bg-[#F3F3F2] rounded-2xl px-6 py-4 mt-2">
              <span className="text-3xl font-black text-[#005259]">{envoye.score}/10</span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#EA601F]">{envoye.niveau}</span>
            </div>
            <p className="text-[11px] text-[#404040]/50 mt-2">
              Ce résultat est une auto-évaluation indicative, pas une certification officielle.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#404040]/10 rounded-3xl p-5 sm:p-8 shadow-sm space-y-6">

            {/* PRÉSENTATION & BARÈME */}
            <div className="text-xs text-[#404040]/70 space-y-2 leading-relaxed">
              <p>Ce test d'auto-positionnement est basé sur le CECR. Il vise à vous aider à situer approximativement votre niveau de français. Il est utilisé en interne et ne constitue pas une certification officielle.</p>
              <div className="bg-[#F3F3F2] rounded-xl p-3 space-y-0.5">
                <p><span className="font-bold text-[#005259]">0 à 3/10</span> : Niveau B1 non atteint</p>
                <p><span className="font-bold text-[#005259]">4 à 6/10</span> : Niveau B1 en cours d'acquisition</p>
                <p><span className="font-bold text-[#005259]">7 à 10/10</span> : Niveau B1 acquis</p>
              </div>
            </div>

            {/* RGPD */}
            <div className="bg-[#88ACEA]/10 border border-[#88ACEA]/40 rounded-xl p-3 text-[11px] text-[#404040]">
              Les données seront traitées en conformité avec la loi RGPD 2018.
            </div>

            {erreur && (
              <div className="bg-[#EF736A]/10 border border-[#EF736A]/30 text-[#EF736A] text-xs font-bold rounded-xl p-3">
                {erreur}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">

              {/* Champ piège anti-bot : invisible pour un vrai visiteur. */}
              <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
                <label htmlFor="site-web">Site web</label>
                <input id="site-web" type="text" name="site-web" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
              </div>

              {/* VOS INFORMATIONS */}
              <div className="space-y-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259] border-b border-[#404040]/10 pb-2">Vos informations</h2>
                <div>
                  <label className={labelClass}>Civilité du participant·e</label>
                  <div className="flex gap-2">
                    {CIVILITES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, civilite: c })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                          formData.civilite === c ? "bg-[#005259] text-white border-[#005259]" : "bg-[#F3F3F2] border-[#404040]/10 text-[#404040] hover:border-[#005259]/40"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Nom du participant·e (MAJUSCULE) *</label>
                    <input type="text" required value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Prénom du participant·e *</label>
                    <input type="text" required value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Numéro de téléphone (débutez avec 06 / 07...)</label>
                    <input type="tel" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Adresse mail du participant·e *</label>
                    <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* PARTIE 1 : QCM */}
              <div className="space-y-5">
                <div className="border-b border-[#404040]/10 pb-2">
                  <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Partie 1 : QCM</h2>
                  <p className="text-[11px] text-[#404040]/60 mt-1">Répondez aux questions à choix multiples, indépendantes les unes des autres. Une seule bonne réponse par question.</p>
                </div>
                {QUESTIONS_PARTIE_1.map((q, i) => renderQuestion(q, i + 1))}
              </div>

              {/* PARTIE 2 : COMPRÉHENSION DE TEXTE */}
              <div className="space-y-5">
                <div className="border-b border-[#404040]/10 pb-2">
                  <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Partie 2 : Compréhension de texte</h2>
                  <p className="text-[11px] text-[#404040]/60 mt-1">Lisez attentivement le texte suivant et répondez aux questions qui s'y rapportent.</p>
                </div>
                <div className="bg-[#F3F3F2] rounded-xl p-4 text-[13px] leading-relaxed text-[#404040] whitespace-pre-line max-h-72 overflow-y-auto">
                  <p className="font-bold text-[#005259] mb-2">Une visite imprévue</p>
                  {TEXTE_COMPREHENSION}
                </div>
                {QUESTIONS_PARTIE_2.map((q, i) => renderQuestion(q, QUESTIONS_PARTIE_1.length + i + 1))}
              </div>

              {/* CONSENTEMENT */}
              <label className="flex items-start gap-2.5 text-xs text-[#404040] cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.rgpd}
                  onChange={(e) => setFormData({ ...formData, rgpd: e.target.checked })}
                  className="mt-0.5 accent-[#005259]"
                />
                <span>J'accepte que mes données personnelles soient collectées et utilisées dans le cadre de ce test, en conformité avec la loi RGPD 2018. *</span>
              </label>

              <button
                type="submit"
                disabled={envoiEnCours}
                className="w-full py-3 bg-[#005259] hover:bg-[#EA601F] disabled:opacity-50 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {envoiEnCours ? "Envoi en cours..." : "Envoyer mes réponses"}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

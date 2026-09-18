"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { WrenchScrewdriverIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { QUESTIONS_COLLECTE_TECH, SCORE_MAX_COLLECTE_TECH, profilCollecteTechDepuisScore } from "@/lib/collecteTechQuiz";

interface ResultatCollecteTech {
  Nom?: string;
  Prénom?: string;
  Email?: string;
  Score?: number;
  Profil?: string;
  Réponses?: Record<string, number>;
}

function normaliserTexte(s?: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

// Résultat complet du diagnostic Collecte Tech public (enregistrement
// autonome, voir app/inscription/digital-up-pro-collecte-tech), rapproché par
// email puis nom/prénom — même principe que ResultatsTestLangueFiche.
export default function ResultatsCollecteTechFiche({ nom, prenom, email }: { nom?: string; prenom?: string; email?: string }) {
  const [resultat, setResultat] = useState<ResultatCollecteTech | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "resultats_collecte_tech_digitaluppro"),
      (snap) => {
        const resultats = snap.docs.map((d) => d.data() as ResultatCollecteTech);
        const emailNorm = normaliserTexte(email);
        const nomNorm = normaliserTexte(nom);
        const prenomNorm = normaliserTexte(prenom);
        const trouve =
          (emailNorm && resultats.find((r) => normaliserTexte(r.Email) === emailNorm)) ||
          resultats.find((r) => normaliserTexte(r.Nom) === nomNorm && normaliserTexte(r.Prénom) === prenomNorm) ||
          null;
        setResultat(trouve);
      },
      (error) => console.error("Erreur lors de l'écoute du résultat Collecte Tech :", error)
    );
    return () => unsub();
  }, [nom, prenom, email]);

  if (!resultat) return null;

  const profil = resultat.Profil || profilCollecteTechDepuisScore(resultat.Score || 0).label;

  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <WrenchScrewdriverIcon className="w-4 h-4 text-[#EA601F]" />
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#005259]">Diagnostic Collecte Tech</h2>
      </div>

      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide bg-[#005259]/10 text-[#005259]">
        {resultat.Score ?? "—"}/{SCORE_MAX_COLLECTE_TECH} — {profil}
      </span>

      <div className="space-y-2">
        {QUESTIONS_COLLECTE_TECH.map((q, index) => {
          const idxReponse = resultat.Réponses?.[q.id];
          const reponse = idxReponse !== undefined ? q.options[idxReponse] : undefined;
          const correct = (reponse?.points ?? 0) > 0;
          return (
            <div key={q.id} className="text-xs">
              <p className="font-bold text-[#404040]">{index + 1}. {q.question}</p>
              <p className={`flex items-center gap-1.5 mt-0.5 ${correct ? "text-[#005259]" : "text-[#C0392B]"}`}>
                {reponse ? (correct ? <CheckCircleIcon className="w-3.5 h-3.5 shrink-0" /> : <XCircleIcon className="w-3.5 h-3.5 shrink-0" />) : null}
                {reponse?.text || "Pas de réponse"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

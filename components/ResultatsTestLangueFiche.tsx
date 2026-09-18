"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { LanguageIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { TOUTES_QUESTIONS, niveauB1DepuisScore } from "@/lib/testLangueB1";

interface ResultatTestLangue {
  Nom?: string;
  Prénom?: string;
  Email?: string;
  Score?: number;
  Niveau_B1_Francais?: string;
  Réponses?: Record<string, number>;
}

function normaliserTexte(s?: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

// Résultat complet du test de langue B1 public (enregistrement autonome, voir
// app/inscription/digital-up-pro-test-langue), rapproché par email puis
// nom/prénom — même principe que le rapprochement Pix sur cette même fiche.
export default function ResultatsTestLangueFiche({ nom, prenom, email }: { nom?: string; prenom?: string; email?: string }) {
  const [resultat, setResultat] = useState<ResultatTestLangue | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "resultats_test_langue_digitaluppro"),
      (snap) => {
        const resultats = snap.docs.map((d) => d.data() as ResultatTestLangue);
        const emailNorm = normaliserTexte(email);
        const nomNorm = normaliserTexte(nom);
        const prenomNorm = normaliserTexte(prenom);
        const trouve =
          (emailNorm && resultats.find((r) => normaliserTexte(r.Email) === emailNorm)) ||
          resultats.find((r) => normaliserTexte(r.Nom) === nomNorm && normaliserTexte(r.Prénom) === prenomNorm) ||
          null;
        setResultat(trouve);
      },
      (error) => console.error("Erreur lors de l'écoute du résultat du test de langue :", error)
    );
    return () => unsub();
  }, [nom, prenom, email]);

  if (!resultat) return null;

  const niveau = resultat.Niveau_B1_Francais || niveauB1DepuisScore(resultat.Score || 0);

  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <LanguageIcon className="w-4 h-4 text-[#EA601F]" />
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#005259]">Test de langue B1</h2>
      </div>

      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide bg-[#005259]/10 text-[#005259]">
        {resultat.Score ?? "—"}/10 — {niveau}
      </span>

      <div className="space-y-2">
        {TOUTES_QUESTIONS.map((q, index) => {
          const idxReponse = resultat.Réponses?.[q.id];
          const correct = idxReponse === q.bonneReponse;
          const reponseTexte = idxReponse !== undefined ? q.options[idxReponse] : undefined;
          return (
            <div key={q.id} className="text-xs">
              <p className="font-bold text-[#404040]">{index + 1}. {q.enonce}</p>
              <p className={`flex items-center gap-1.5 mt-0.5 ${correct ? "text-[#005259]" : "text-[#C0392B]"}`}>
                {reponseTexte ? (correct ? <CheckCircleIcon className="w-3.5 h-3.5 shrink-0" /> : <XCircleIcon className="w-3.5 h-3.5 shrink-0" />) : null}
                {reponseTexte || "Pas de réponse"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

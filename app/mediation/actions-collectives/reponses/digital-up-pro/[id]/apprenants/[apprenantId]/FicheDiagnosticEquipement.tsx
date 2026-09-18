"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { PrinterIcon, ExclamationTriangleIcon, WrenchScrewdriverIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import type { Inscription } from "./page";
import {
  ChampLigne, ZoneTexte, CocherChoixMultiple, SectionPDF, BoiteSignatureLocale, labelClass,
} from "./FicheEntretienDiagnostic";
import { QUESTIONS_COLLECTE_TECH, SCORE_MAX_COLLECTE_TECH, profilCollecteTechDepuisScore } from "@/lib/collecteTechQuiz";

// Reproduction éditable + imprimable de la "Fiche de diagnostic —
// Compétences numériques & équipement — Digital Up" (formulaire papier
// fourni, plus court que la fiche entretien diagnostic) — voir
// FicheEntretienDiagnostic.tsx pour les briques réutilisées (ChampLigne,
// ZoneTexte, etc., exportées depuis ce fichier).

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

export default function FicheDiagnosticEquipement({
  inscription, mettreAJourChamp,
}: {
  inscription: Inscription;
  mettreAJourChamp: (champ: keyof Inscription, valeur: any) => void;
}) {
  const i = inscription;
  const maj = (champ: keyof Inscription, valeur: any) => mettreAJourChamp(champ, valeur);

  const [signatureMedUrl, setSignatureMedUrl] = useState<string | undefined>(undefined);
  const [signatureBenefUrl, setSignatureBenefUrl] = useState<string | undefined>(undefined);
  const [televersementEnCours, setTeleversementEnCours] = useState<"med" | "benef" | null>(null);

  // Résultat du diagnostic Collecte Tech public (enregistrement autonome,
  // voir app/inscription/digital-up-pro-collecte-tech), rapproché par email
  // puis nom/prénom — reporté ici pour tout·e apprenant·e dont le diagnostic
  // a été rempli, sans avoir à aller chercher la réponse ailleurs.
  const [resultatCollecteTech, setResultatCollecteTech] = useState<ResultatCollecteTech | null>(null);
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "resultats_collecte_tech_digitaluppro"),
      (snap) => {
        const resultats = snap.docs.map((d) => d.data() as ResultatCollecteTech);
        const email = normaliserTexte(i.Email);
        const nom = normaliserTexte(i.Nom);
        const prenom = normaliserTexte(i.Prénom);
        const trouve =
          (email && resultats.find((r) => normaliserTexte(r.Email) === email)) ||
          resultats.find((r) => normaliserTexte(r.Nom) === nom && normaliserTexte(r.Prénom) === prenom) ||
          null;
        setResultatCollecteTech(trouve);
      },
      (error) => console.error("Erreur lors de l'écoute du résultat Collecte Tech :", error)
    );
    return () => unsub();
  }, [i.Email, i.Nom, i.Prénom]);

  // Reporte le profil déduit dans "Niveau observé" — seulement si la case est
  // encore vide, pour ne jamais écraser une observation déjà saisie à la main.
  useEffect(() => {
    if (resultatCollecteTech && !i.EquipDiag_NiveauObserve) {
      const profil = resultatCollecteTech.Profil || profilCollecteTechDepuisScore(resultatCollecteTech.Score || 0).label;
      maj("EquipDiag_NiveauObserve", `${resultatCollecteTech.Score ?? "—"}/${SCORE_MAX_COLLECTE_TECH} — ${profil} (auto)`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultatCollecteTech]);

  const televerserSignature = (cible: "med" | "benef", file: File) => {
    if (file.size > 500 * 1024) {
      console.error("Image de signature trop lourde (max 500 Ko).");
      return;
    }
    setTeleversementEnCours(cible);
    const reader = new FileReader();
    reader.onload = () => {
      (cible === "med" ? setSignatureMedUrl : setSignatureBenefUrl)(reader.result as string);
      setTeleversementEnCours(null);
    };
    reader.onerror = () => setTeleversementEnCours(null);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-[#EA601F] hover:bg-[#005259] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
        >
          <PrinterIcon className="w-4 h-4" /> Imprimer
        </button>
      </div>

      <div className="bg-white text-black p-6 md:p-[1.8cm] print:p-0 rounded-2xl print:rounded-none shadow-sm print:shadow-none mx-auto w-full max-w-4xl space-y-3">
        <img src="/logos/Logo_Colombbus_noir_trans.png" alt="Colombbus" className="h-12 w-auto object-contain" />

        <div className="bg-[#005259] text-white text-center py-4 rounded-xl print:rounded-none">
          <h1 className="text-lg font-bold uppercase tracking-wide">Fiche de diagnostic</h1>
          <p className="text-sm font-medium">Compétences numériques & équipement — Digital Up</p>
        </div>

        <SectionPDF titre="Identité & réalisation">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <ChampLigne label="NOM du participant" valeur={i.Nom} onValide={(v) => maj("Nom", v)} className="flex-1 min-w-[220px]" />
            <ChampLigne label="Prénom du participant" valeur={i.Prénom} onValide={(v) => maj("Prénom", v)} className="flex-1 min-w-[220px]" />
          </div>
          <ChampLigne label="Lieu et Date" valeur={i.EquipDiag_LieuEtDate} onValide={(v) => maj("EquipDiag_LieuEtDate", v)} />
        </SectionPDF>

        <SectionPDF titre="Maîtrise des bases sur ordinateur">
          <p className="text-xs italic text-[#404040]/70 print:text-black/70">Niveau grand débutant / débutant</p>
          <ChampLigne label="Niveau observé" valeur={i.EquipDiag_NiveauObserve} onValide={(v) => maj("EquipDiag_NiveauObserve", v)} />
          <CocherChoixMultiple
            label="Besoin d'équipement"
            options={["Ordinateur portable", "Smartphone"]}
            valeurs={i.EquipDiag_BesoinEquipement}
            onChange={(v) => maj("EquipDiag_BesoinEquipement", v)}
          />
        </SectionPDF>

        {resultatCollecteTech && (
          <SectionPDF titre="Diagnostic Collecte Tech (résultat auto)">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide bg-[#005259]/10 text-[#005259]">
                <WrenchScrewdriverIcon className="w-4 h-4" />
                {resultatCollecteTech.Score ?? "—"}/{SCORE_MAX_COLLECTE_TECH} — {resultatCollecteTech.Profil || "—"}
              </span>
            </div>
            <div className="space-y-2 print:break-inside-avoid-page">
              {QUESTIONS_COLLECTE_TECH.map((q, index) => {
                const idxReponse = resultatCollecteTech.Réponses?.[q.id];
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
          </SectionPDF>
        )}

        <SectionPDF titre="Attentes individuelles de cette formation">
          <ZoneTexte valeur={i.EquipDiag_Attentes} onValide={(v) => maj("EquipDiag_Attentes", v)} rows={4} />
        </SectionPDF>

        <div className="border-2 border-[#005259] rounded-xl p-4 space-y-4 break-inside-avoid-page print:border-black">
          <ChampLigne label="Date de réalisation" type="date" valeur={i.EquipDiag_DateRealisation} onValide={(v) => maj("EquipDiag_DateRealisation", v)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className={labelClass}>Signature du médiateur·rice Colombbus</span>
              <BoiteSignatureLocale
                url={signatureMedUrl}
                uploading={televersementEnCours === "med"}
                onUpload={(f) => televerserSignature("med", f)}
                onSupprimer={() => setSignatureMedUrl(undefined)}
              />
            </div>
            <div>
              <span className={labelClass}>Signature du bénéficiaire</span>
              <BoiteSignatureLocale
                url={signatureBenefUrl}
                uploading={televersementEnCours === "benef"}
                onUpload={(f) => televerserSignature("benef", f)}
                onSupprimer={() => setSignatureBenefUrl(undefined)}
              />
            </div>
          </div>
          <div className="print:hidden flex items-center gap-2.5 bg-[#F9C44E]/20 border border-[#F9C44E] rounded-xl p-3">
            <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-[#404040]" />
            <p className="text-xs font-bold text-[#404040]">
              Ces signatures ne sont pas enregistrées : elles ne servent qu'à l'impression/l'export de cette fiche et seront perdues si vous quittez la page.
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-[#EA601F] print:text-black pt-2">Digital Up</p>
      </div>

      <style jsx global>{`
        @media print {
          html, body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          input[type="date"]::-webkit-calendar-picker-indicator {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

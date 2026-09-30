"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PrinterIcon, ExclamationTriangleIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { usePermissions } from "@/lib/PermissionsProvider";
import { ChampLigne, ZoneTexte, CocherBool, CocherChoixUnique, CocherChoixMultiple, SectionPDF, BoiteSignatureLocale, labelClass } from "@/components/fichePapier/PrimitivesFiche";
import {
  ConfigFicheDiagnostic, DEFAULT_CONFIG_FICHE_DIAGNOSTIC, QuestionDiagnostic, SectionDiagnostic,
  chargerConfigFicheDiagnostic, sauvegarderConfigFicheDiagnostic, valeurCorrespond,
} from "@/lib/ficheDiagnostic";

interface Props {
  programmeId: string;
  inscription: Record<string, any>;
  mettreAJourChamp: (champ: string, valeur: any) => void;
  hrefEditeur: string;
  intituleAction?: string;
}

// Moteur de rendu générique de la "Fiche entretien diagnostic" — remplace 4
// copies quasi identiques codées en dur (voir lib/ficheDiagnostic.ts pour le
// contexte). Les questions viennent de fiches_diagnostic/{programmeId} ;
// l'en-tête, le bloc attestation/signature et le pied de page RGPD restent
// fixes (éléments structurels du document, pas des "questions").
export default function FicheDiagnosticGenerique({ programmeId, inscription, mettreAJourChamp, hrefEditeur, intituleAction }: Props) {
  const { role } = usePermissions();
  // undefined = chargement, null = aucune config encore enregistrée.
  const [config, setConfig] = useState<ConfigFicheDiagnostic | null | undefined>(undefined);
  const [initialisationEnCours, setInitialisationEnCours] = useState(false);

  useEffect(() => {
    chargerConfigFicheDiagnostic(programmeId).then(setConfig);
  }, [programmeId]);

  const initialiser = async () => {
    setInitialisationEnCours(true);
    try {
      await sauvegarderConfigFicheDiagnostic(programmeId, DEFAULT_CONFIG_FICHE_DIAGNOSTIC);
      setConfig(DEFAULT_CONFIG_FICHE_DIAGNOSTIC);
    } finally {
      setInitialisationEnCours(false);
    }
  };

  const i = inscription;
  const reponsesCustom: Record<string, any> = i.DiagnosticReponsesCustom || {};

  // champFirestore défini -> lit/écrit directement le champ existant sur le
  // document (préserve les données déjà saisies, aucune migration) ; sinon
  // -> lit/écrit DiagnosticReponsesCustom[id] (nouvelle question ajoutée
  // depuis l'éditeur).
  const valeurQuestion = (question: QuestionDiagnostic): any => {
    if (!question.champFirestore) return reponsesCustom[question.id];
    const brut = i[question.champFirestore];
    if (question.type === "case_oui_non" && question.valeurCommeOuiNonTexte) return brut === "Oui";
    return brut;
  };

  const majQuestion = (question: QuestionDiagnostic, valeur: any) => {
    if (!question.champFirestore) {
      mettreAJourChamp("DiagnosticReponsesCustom", { ...reponsesCustom, [question.id]: valeur });
      return;
    }
    if (question.type === "case_oui_non" && question.valeurCommeOuiNonTexte) {
      mettreAJourChamp(question.champFirestore, valeur ? "Oui" : "Non");
      return;
    }
    // "Âge" est un nombre côté actions dynamiques, une chaîne sur les 3
    // programmes historiques — on préserve le type déjà en place plutôt que
    // d'en imposer un, pour rester compatible avec les deux.
    if (typeof i[question.champFirestore] === "number") {
      mettreAJourChamp(question.champFirestore, valeur === "" ? "" : Number(valeur));
      return;
    }
    mettreAJourChamp(question.champFirestore, valeur);
  };

  const toutesQuestions = config ? config.sections.flatMap((s) => s.questions) : [];
  const questionVisible = (question: QuestionDiagnostic): boolean => {
    if (!question.conditionSurQuestionId) return true;
    const ref = toutesQuestions.find((q) => q.id === question.conditionSurQuestionId);
    if (!ref) return true;
    return valeurCorrespond(valeurQuestion(ref), question.conditionValeur);
  };

  // Signature de l'attestation finale — jamais persistée, même principe que
  // sur les 4 programmes historiques.
  const [signatureUrl, setSignatureUrl] = useState<string | undefined>(undefined);
  const [televersementSignature, setTeleversementSignature] = useState(false);
  const televerserSignature = (file: File) => {
    if (file.size > 500 * 1024) {
      console.error("Image de signature trop lourde (max 500 Ko).");
      return;
    }
    setTeleversementSignature(true);
    const reader = new FileReader();
    reader.onload = () => {
      setSignatureUrl(reader.result as string);
      setTeleversementSignature(false);
    };
    reader.onerror = () => setTeleversementSignature(false);
    reader.readAsDataURL(file);
  };

  if (config === undefined) {
    return <div className="text-xs font-bold uppercase tracking-widest text-[#404040]/50 animate-pulse py-10 text-center">Chargement...</div>;
  }

  if (!config) {
    return (
      <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-10 text-center space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#404040]/60">Aucune fiche configurée pour ce programme.</p>
        {role === "admin" && (
          <button
            type="button"
            onClick={initialiser}
            disabled={initialisationEnCours}
            className="inline-flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
          >
            {initialisationEnCours ? "Initialisation..." : "Initialiser avec le modèle par défaut"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden flex justify-end gap-2">
        {role === "admin" && (
          <Link
            href={hrefEditeur}
            className="inline-flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 text-[#005259] px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
          >
            <PencilSquareIcon className="w-4 h-4" /> Éditer les questions
          </Link>
        )}
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
          <h1 className="text-lg font-bold uppercase tracking-wide">Fiche entretien diagnostic</h1>
          <p className="text-sm font-medium">{intituleAction || i.Parcours || "—"}</p>
        </div>

        {config.sections.map((section) => {
          const questionsVisibles = section.questions.filter(questionVisible);
          if (questionsVisibles.length === 0) return null;
          return (
            <SectionPDF key={section.id} titre={section.titre}>
              {questionsVisibles.map((question) => (
                <RenduQuestion key={question.id} question={question} valeur={valeurQuestion(question)} onChange={(v) => majQuestion(question, v)} />
              ))}
            </SectionPDF>
          );
        })}

        <div className="border-2 border-[#005259] rounded-xl p-4 space-y-4 break-inside-avoid-page print:border-black">
          <p className="text-sm font-bold text-[#005259] print:text-black">J'atteste sur l'honneur que les informations portées sur cette fiche sont exactes</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChampLigne label="Date" type="date" valeur={i.Diagnostic_DateAttestation} onValide={(v) => mettreAJourChamp("Diagnostic_DateAttestation", v)} />
            <div>
              <span className={labelClass}>Signature (précédée de la mention "Lu et approuvé")</span>
              <BoiteSignatureLocale url={signatureUrl} uploading={televersementSignature} onUpload={televerserSignature} onSupprimer={() => setSignatureUrl(undefined)} />
            </div>
          </div>
          <div className="print:hidden flex items-center gap-2.5 bg-[#F9C44E]/20 border border-[#F9C44E] rounded-xl p-3">
            <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-[#404040]" />
            <p className="text-xs font-bold text-[#404040]">
              Cette signature n'est pas enregistrée : elle ne sert qu'à l'impression/l'export de cette fiche et sera perdue si vous quittez la page.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-[#404040]/15 text-[9px] text-[#404040]/70 print:text-black leading-relaxed space-y-2 break-inside-avoid-page">
          <p>
            <span className="font-bold italic">Les informations portées sur ce formulaire sont obligatoires.</span>{" "}
            <span className="italic">
              Elles font l'objet dans le cadre de votre accompagnement social et professionnel, d'un traitement informatisé destiné à une inscription à la certification PIX. Les
              destinataires des données sont le conseiller en insertion professionnelle de COLOMBBUS ou les acteurs de l'action sociale l'emploi. En application de la loi
              Informatique et Libertés du 6 janvier 1978 modifiée, vous disposez d'un droit d'accès, de rectification et d'effacement de vos données personnelles. Vous disposez
              également du droit de limiter ou de vous opposer au traitement de vos données pour motifs légitimes, et de décider du sort de celles-ci après votre décès, dans les
              limites fixées par la loi.
            </span>
          </p>
          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-[#EA601F] print:text-black pt-2">{intituleAction || i.Parcours || "—"}</p>
        </div>
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

function RenduQuestion({ question, valeur, onChange }: { question: QuestionDiagnostic; valeur: any; onChange: (v: any) => void }) {
  switch (question.type) {
    case "ligne":
      return <ChampLigne label={question.label} valeur={valeur} onValide={onChange} />;
    case "ligne_date":
      return <ChampLigne label={question.label} type="date" valeur={valeur} onValide={onChange} />;
    case "zone_texte":
      return <ZoneTexte label={question.label || undefined} sousLabel={question.sousLabel} valeur={valeur} onValide={onChange} />;
    case "case_oui_non":
      return <CocherBool label={question.label} valeur={valeur} onChange={onChange} />;
    case "case_unique":
      return <CocherChoixUnique label={question.label || undefined} options={question.options || []} valeur={valeur} onChange={onChange} />;
    case "case_multiple":
      return <CocherChoixMultiple label={question.label || undefined} options={question.options || []} valeurs={valeur} onChange={onChange} />;
    default:
      return null;
  }
}

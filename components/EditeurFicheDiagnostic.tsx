"use client";

import { useEffect, useState } from "react";
import { quicksand } from "@/lib/fonts";
import { PlusIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useToast } from "@/components/ToastProvider";
import {
  ConfigFicheDiagnostic, QuestionDiagnostic, SectionDiagnostic, TypeQuestionDiagnostic,
  chargerConfigFicheDiagnostic, sauvegarderConfigFicheDiagnostic, nouvelleConfigFicheDiagnosticVide, DEFAULT_CONFIG_FICHE_DIAGNOSTIC,
} from "@/lib/ficheDiagnostic";

const TYPES_QUESTION: { valeur: TypeQuestionDiagnostic; label: string }[] = [
  { valeur: "ligne", label: "Ligne de texte" },
  { valeur: "ligne_date", label: "Ligne de texte (date)" },
  { valeur: "zone_texte", label: "Zone de texte" },
  { valeur: "case_oui_non", label: "Case Oui / Non" },
  { valeur: "case_unique", label: "Choix unique" },
  { valeur: "case_multiple", label: "Choix multiple" },
];

const inputClass = "w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] placeholder-[#404040]/40 outline-none font-medium transition-colors";
const labelClass = "block text-[11px] font-bold text-[#404040]/70 uppercase tracking-wide mb-1";

// Éditeur générique de la "Fiche entretien diagnostic" — même idiome que
// components/EditeurPositionnement.tsx (sections > questions, ajouter/
// déplacer/supprimer à chaque niveau), avec en plus un sélecteur de type
// plus riche (les widgets du formulaire papier) et une condition d'affichage
// réutilisant le principe déjà établi sur le questionnaire CUSTOM des
// actions dynamiques (conditionSurQuestionId/conditionValeur).
export default function EditeurFicheDiagnostic({ programmeId }: { programmeId: string }) {
  const { showToast } = useToast();
  const [config, setConfig] = useState<ConfigFicheDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const c = await chargerConfigFicheDiagnostic(programmeId);
      setConfig(c || nouvelleConfigFicheDiagnosticVide());
      setLoading(false);
    };
    charger();
  }, [programmeId]);

  const enregistrer = async (suivant: ConfigFicheDiagnostic) => {
    setConfig(suivant);
    try {
      await sauvegarderConfigFicheDiagnostic(programmeId, suivant);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la fiche diagnostic :", error);
      showToast("Erreur lors de l'enregistrement.", "error");
    }
  };

  const chargerModeleParDefaut = () => {
    enregistrer(DEFAULT_CONFIG_FICHE_DIAGNOSTIC);
    showToast("Modèle par défaut chargé.", "success");
  };

  if (loading || !config) {
    return <div className={`${quicksand.className} text-xs font-bold uppercase tracking-widest text-[#404040]/50 animate-pulse`}>Chargement...</div>;
  }

  const majConfig = (patch: Partial<ConfigFicheDiagnostic>) => enregistrer({ ...config, ...patch });

  const ajouterSection = () => {
    const nouvelle: SectionDiagnostic = { id: `section_${Date.now()}`, titre: "Nouvelle section", questions: [] };
    majConfig({ sections: [...config.sections, nouvelle] });
  };
  const modifierSection = (index: number, patch: Partial<SectionDiagnostic>) => {
    majConfig({ sections: config.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  };
  const supprimerSection = (index: number) => {
    majConfig({ sections: config.sections.filter((_, i) => i !== index) });
  };
  const deplacerSection = (index: number, direction: -1 | 1) => {
    const cible = index + direction;
    if (cible < 0 || cible >= config.sections.length) return;
    const sections = [...config.sections];
    [sections[index], sections[cible]] = [sections[cible], sections[index]];
    majConfig({ sections });
  };

  const ajouterQuestion = (sectionIndex: number) => {
    const section = config.sections[sectionIndex];
    const nouvelle: QuestionDiagnostic = { id: `q_${Date.now()}`, type: "ligne", label: "Nouvelle question" };
    modifierSection(sectionIndex, { questions: [...section.questions, nouvelle] });
  };
  const modifierQuestion = (sectionIndex: number, questionIndex: number, patch: Partial<QuestionDiagnostic>) => {
    const section = config.sections[sectionIndex];
    modifierSection(sectionIndex, { questions: section.questions.map((q, i) => (i === questionIndex ? { ...q, ...patch } : q)) });
  };
  const supprimerQuestion = (sectionIndex: number, questionIndex: number) => {
    const section = config.sections[sectionIndex];
    modifierSection(sectionIndex, { questions: section.questions.filter((_, i) => i !== questionIndex) });
  };
  const deplacerQuestion = (sectionIndex: number, questionIndex: number, direction: -1 | 1) => {
    const section = config.sections[sectionIndex];
    const cible = questionIndex + direction;
    if (cible < 0 || cible >= section.questions.length) return;
    const questions = [...section.questions];
    [questions[questionIndex], questions[cible]] = [questions[cible], questions[questionIndex]];
    modifierSection(sectionIndex, { questions });
  };

  const toutesQuestions = config.sections.flatMap((s) => s.questions);

  return (
    <div className="space-y-6">
      {config.sections.length === 0 && (
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm text-center space-y-3">
          <p className="text-xs text-[#404040]/60 font-medium">Aucune question pour le moment.</p>
          <button type="button" onClick={chargerModeleParDefaut} className="px-4 py-2 bg-[#005259] hover:bg-[#EA601F] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer">
            Charger le modèle par défaut
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Sections ({config.sections.length})</h2>
        <button type="button" onClick={ajouterSection} className="flex items-center gap-1.5 px-3 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
          <PlusIcon className="w-4 h-4" /> Section
        </button>
      </div>

      {config.sections.map((section, si) => (
        <div key={section.id} className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-0.5 pt-1">
              <button type="button" onClick={() => deplacerSection(si, -1)} disabled={si === 0} className="text-[#404040]/40 hover:text-[#005259] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                <ChevronUpIcon className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => deplacerSection(si, 1)} disabled={si === config.sections.length - 1} className="text-[#404040]/40 hover:text-[#005259] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                <ChevronDownIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <input type="text" defaultValue={section.titre} onBlur={(e) => modifierSection(si, { titre: e.target.value })} placeholder="Titre de la section" className={`${inputClass} flex-1`} />
            <button type="button" onClick={() => supprimerSection(si)} className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer shrink-0">
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#404040]/10 pl-6">
            {section.questions.map((question, qi) => (
              <div key={question.id} className="pt-3 pb-3 space-y-2 first:pt-0">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button type="button" onClick={() => deplacerQuestion(si, qi, -1)} disabled={qi === 0} className="text-[#404040]/40 hover:text-[#005259] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                      <ChevronUpIcon className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => deplacerQuestion(si, qi, 1)} disabled={qi === section.questions.length - 1} className="text-[#404040]/40 hover:text-[#005259] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input type="text" defaultValue={question.label} onBlur={(e) => modifierQuestion(si, qi, { label: e.target.value })} placeholder="Intitulé de la question" className={`${inputClass} sm:col-span-2 min-w-0`} />
                      <select value={question.type} onChange={(e) => modifierQuestion(si, qi, { type: e.target.value as TypeQuestionDiagnostic })} className={`${inputClass} min-w-0`}>
                        {TYPES_QUESTION.map((t) => <option key={t.valeur} value={t.valeur}>{t.label}</option>)}
                      </select>
                    </div>

                    {question.type === "zone_texte" && (
                      <input
                        type="text"
                        defaultValue={question.sousLabel || ""}
                        onBlur={(e) => modifierQuestion(si, qi, { sousLabel: e.target.value })}
                        placeholder="Aide contextuelle (facultative, ex. « ex. : ... »)"
                        className={inputClass}
                      />
                    )}

                    {(question.type === "case_unique" || question.type === "case_multiple") && (
                      <div className="space-y-1.5">
                        <label className={labelClass}>Options (séparées par une virgule)</label>
                        <input
                          type="text"
                          defaultValue={(question.options || []).join(", ")}
                          onBlur={(e) => modifierQuestion(si, qi, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                          className={inputClass}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-[10px] font-bold uppercase text-[#404040]/50 shrink-0">Afficher seulement si</span>
                      <select
                        value={question.conditionSurQuestionId || ""}
                        onChange={(e) => modifierQuestion(si, qi, { conditionSurQuestionId: e.target.value || undefined, conditionValeur: undefined })}
                        className="max-w-full px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none"
                      >
                        <option value="">(toujours affichée)</option>
                        {toutesQuestions
                          .filter((autre) => autre.id !== question.id && (autre.type === "case_oui_non" || autre.type === "case_unique" || autre.type === "case_multiple"))
                          .map((autre) => <option key={autre.id} value={autre.id}>{autre.label || autre.id}</option>)}
                      </select>
                      {question.conditionSurQuestionId && (() => {
                        const ref = toutesQuestions.find((q) => q.id === question.conditionSurQuestionId);
                        if (!ref) return null;
                        if (ref.type === "case_oui_non") {
                          return (
                            <select
                              value={question.conditionValeur === true ? "oui" : question.conditionValeur === false ? "non" : ""}
                              onChange={(e) => modifierQuestion(si, qi, { conditionValeur: e.target.value === "oui" })}
                              className="max-w-full px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none"
                            >
                              <option value="">— choisir —</option>
                              <option value="oui">vaut Oui</option>
                              <option value="non">vaut Non</option>
                            </select>
                          );
                        }
                        return (
                          <select
                            value={(question.conditionValeur as string) || ""}
                            onChange={(e) => modifierQuestion(si, qi, { conditionValeur: e.target.value })}
                            className="max-w-full px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none"
                          >
                            <option value="">— choisir —</option>
                            {(ref.options || []).map((opt) => <option key={opt} value={opt}>vaut « {opt} »</option>)}
                          </select>
                        );
                      })()}
                    </div>
                  </div>
                  <button type="button" onClick={() => supprimerQuestion(si, qi)} className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer shrink-0">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {section.questions.length === 0 && <p className="text-xs text-[#404040]/50 italic">Aucune question dans cette section.</p>}
            <button type="button" onClick={() => ajouterQuestion(si)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F3F2] hover:bg-[#005259]/10 text-[#005259] rounded-xl text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer">
              <PlusIcon className="w-3.5 h-3.5" /> Question
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { QuestionDef } from "@/lib/dynamicActions/types";

interface Props {
  question: QuestionDef;
  valeur: string | string[] | boolean | undefined;
  valeurAutre?: string;
  onChange: (valeur: string | string[] | boolean) => void;
  onChangeAutre?: (valeur: string) => void;
  inputClass: string;
  labelClass: string;
}

// Rend une question CUSTOM (voir lib/dynamicActions/types.ts) selon son
// type — utilisé à la fois par le formulaire d'inscription (wizard) et par
// les modales d'édition des pages réponses, pour ne jamais désynchroniser
// le rendu entre les deux.
export default function ChampQuestion({ question, valeur, valeurAutre, onChange, onChangeAutre, inputClass, labelClass }: Props) {
  const label = `${question.label}${question.requis ? " *" : ""}`;

  switch (question.type) {
    case "texte":
      return (
        <div>
          <label className={labelClass}>{label}</label>
          <input required={question.requis} type="text" value={(valeur as string) || ""} onChange={(e) => onChange(e.target.value)} placeholder={question.placeholder} className={inputClass} />
        </div>
      );
    case "email":
      return (
        <div>
          <label className={labelClass}>{label}</label>
          <input required={question.requis} type="email" value={(valeur as string) || ""} onChange={(e) => onChange(e.target.value)} placeholder={question.placeholder} className={inputClass} />
        </div>
      );
    case "telephone":
      return (
        <div>
          <label className={labelClass}>{label}</label>
          <input required={question.requis} type="tel" value={(valeur as string) || ""} onChange={(e) => onChange(e.target.value)} placeholder={question.placeholder} className={inputClass} />
        </div>
      );
    case "nombre":
      return (
        <div>
          <label className={labelClass}>{label}</label>
          <input required={question.requis} type="number" value={(valeur as string) || ""} onChange={(e) => onChange(e.target.value)} placeholder={question.placeholder} className={inputClass} />
        </div>
      );
    case "textarea":
      return (
        <div>
          <label className={labelClass}>{label}</label>
          <textarea required={question.requis} value={(valeur as string) || ""} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={question.placeholder} className={inputClass} />
        </div>
      );
    case "oui_non":
      return (
        <div>
          <label className={labelClass}>{label}</label>
          <select required={question.requis} value={(valeur as string) || ""} onChange={(e) => onChange(e.target.value)} className={inputClass}>
            <option value="">--</option>
            <option value="Oui">Oui</option>
            <option value="Non">Non</option>
          </select>
        </div>
      );
    case "select": {
      const estAutre = valeur === "Autre";
      return (
        <div>
          <label className={labelClass}>{label}</label>
          <select required={question.requis} value={(valeur as string) || ""} onChange={(e) => onChange(e.target.value)} className={inputClass}>
            <option value="">--</option>
            {(question.options || []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          {estAutre && onChangeAutre && (
            <input
              type="text"
              value={valeurAutre || ""}
              onChange={(e) => onChangeAutre(e.target.value)}
              placeholder={question.texteLibreLabel || "Préciser"}
              className={`${inputClass} mt-2`}
            />
          )}
        </div>
      );
    }
    case "tags_multiples": {
      const valeurs = Array.isArray(valeur) ? valeur : [];
      const toggle = (option: string) => {
        onChange(valeurs.includes(option) ? valeurs.filter((v) => v !== option) : [...valeurs, option]);
      };
      return (
        <div>
          <label className={labelClass}>{label}</label>
          <div className="flex flex-wrap gap-2">
            {(question.options || []).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  valeurs.includes(o) ? "bg-[#005259] text-white border-[#005259]" : "bg-[#F3F3F2] text-[#404040] border-[#404040]/10 hover:border-[#005259]"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "checkbox":
      return (
        <label className="flex items-start gap-2.5 text-xs text-[#404040] cursor-pointer">
          <input
            type="checkbox"
            checked={!!valeur}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#005259] cursor-pointer"
          />
          <span>{label}</span>
        </label>
      );
    default:
      return null;
  }
}

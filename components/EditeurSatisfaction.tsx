"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import { PlusIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useToast } from "@/components/ToastProvider";
import {
  ConfigSatisfaction, ItemSatisfaction, SectionSatisfaction, TypeItemSatisfaction,
  chargerConfigSatisfaction, sauvegarderConfigSatisfaction, nouvelleConfigSatisfactionVide,
} from "@/lib/satisfaction";

const TYPES_ITEM: { valeur: TypeItemSatisfaction; label: string }[] = [
  { valeur: "choix_unique", label: "Choix unique" },
  { valeur: "choix_multiple", label: "Choix multiple" },
  { valeur: "texte_libre", label: "Réponse libre" },
  { valeur: "echelle", label: "Échelle 1 à 5" },
  { valeur: "texte_intro", label: "Bloc de texte (non noté)" },
];

const inputClass = "w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] placeholder-[#404040]/40 outline-none font-medium transition-colors";
const labelClass = "block text-[11px] font-bold text-[#404040]/70 uppercase tracking-wide mb-1";

// Éditeur générique du questionnaire de satisfaction — même idiome que
// components/EditeurPositionnement.tsx, avec en plus : un sélecteur de
// logos (bibliothèque logos_emargement) et une condition d'affichage au
// niveau SECTION (en plus de celle par question déjà présente), pour le
// branchement "à chaud"/"à froid" (voir lib/satisfaction.ts).
export default function EditeurSatisfaction({ programmeId }: { programmeId: string }) {
  const { showToast } = useToast();
  const [config, setConfig] = useState<ConfigSatisfaction | null>(null);
  const [logosDisponibles, setLogosDisponibles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const [c, snapLogos] = await Promise.all([
        chargerConfigSatisfaction(programmeId),
        getDocs(collection(db, "logos_emargement")),
      ]);
      setConfig(c || nouvelleConfigSatisfactionVide("Questionnaire de satisfaction"));
      setLogosDisponibles(snapLogos.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    charger();
  }, [programmeId]);

  const enregistrer = async (suivant: ConfigSatisfaction) => {
    setConfig(suivant);
    try {
      await sauvegarderConfigSatisfaction(programmeId, suivant);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du questionnaire de satisfaction :", error);
      showToast("Erreur lors de l'enregistrement.", "error");
    }
  };

  if (loading || !config) {
    return <div className={`${quicksand.className} text-xs font-bold uppercase tracking-widest text-[#404040]/50 animate-pulse`}>Chargement...</div>;
  }

  const majConfig = (patch: Partial<ConfigSatisfaction>) => enregistrer({ ...config, ...patch });

  const basculerLogo = (logoId: string) => {
    const liste = config.logoIds || [];
    majConfig({ logoIds: liste.includes(logoId) ? liste.filter((id) => id !== logoId) : [...liste, logoId] });
  };

  const ajouterSection = () => {
    const nouvelle: SectionSatisfaction = { id: `section_${Date.now()}`, titre: "Nouvelle section", items: [] };
    majConfig({ sections: [...config.sections, nouvelle] });
  };
  const modifierSection = (index: number, patch: Partial<SectionSatisfaction>) => {
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

  const ajouterItem = (sectionIndex: number) => {
    const section = config.sections[sectionIndex];
    const nouvel: ItemSatisfaction = { id: `item_${Date.now()}`, type: "choix_unique", enonce: "Nouvelle question", options: ["Oui", "Non"] };
    modifierSection(sectionIndex, { items: [...section.items, nouvel] });
  };
  const modifierItem = (sectionIndex: number, itemIndex: number, patch: Partial<ItemSatisfaction>) => {
    const section = config.sections[sectionIndex];
    modifierSection(sectionIndex, { items: section.items.map((it, i) => (i === itemIndex ? { ...it, ...patch } : it)) });
  };
  const supprimerItem = (sectionIndex: number, itemIndex: number) => {
    const section = config.sections[sectionIndex];
    modifierSection(sectionIndex, { items: section.items.filter((_, i) => i !== itemIndex) });
  };
  const deplacerItem = (sectionIndex: number, itemIndex: number, direction: -1 | 1) => {
    const section = config.sections[sectionIndex];
    const cible = itemIndex + direction;
    if (cible < 0 || cible >= section.items.length) return;
    const items = [...section.items];
    [items[itemIndex], items[cible]] = [items[cible], items[itemIndex]];
    modifierSection(sectionIndex, { items });
  };

  const toutesQuestions = config.sections.flatMap((s) => s.items.filter((it) => it.type === "choix_unique" || it.type === "choix_multiple" || it.type === "echelle"));

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Informations générales</h2>
        <div>
          <label className={labelClass}>Titre du questionnaire</label>
          <input type="text" defaultValue={config.titre} onBlur={(e) => majConfig({ titre: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description (facultative)</label>
          <textarea defaultValue={config.description} onBlur={(e) => majConfig({ description: e.target.value })} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Logos affichés en en-tête (en plus du logo Colombbus)</label>
          {logosDisponibles.length === 0 ? (
            <p className="text-xs text-[#404040]/50 italic">Aucun logo dans la bibliothèque pour le moment.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {logosDisponibles.map((logo) => {
                const selectionne = (config.logoIds || []).includes(logo.id);
                return (
                  <button key={logo.id} type="button" onClick={() => basculerLogo(logo.id)} title={logo.nom} className={`p-2 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center gap-1 ${selectionne ? "border-[#005259] bg-[#005259]/5" : "border-[#404040]/10 hover:border-[#404040]/25"}`}>
                    <div className="w-full h-12 flex items-center justify-center">
                      <img src={logo.url} alt={logo.nom} className="max-h-full max-w-full object-contain" />
                    </div>
                    <span className="text-[9px] font-bold uppercase text-[#404040]/60 truncate w-full text-center">{logo.nom}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" defaultValue={section.titre} onBlur={(e) => modifierSection(si, { titre: e.target.value })} placeholder="Titre de la section" className={inputClass} />
              <input type="text" defaultValue={section.sousTitre || ""} onBlur={(e) => modifierSection(si, { sousTitre: e.target.value })} placeholder="Sous-titre (facultatif)" className={inputClass} />
            </div>
            <button type="button" onClick={() => supprimerSection(si)} className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer shrink-0">
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap pl-6 min-w-0">
            <span className="text-[10px] font-bold uppercase text-[#404040]/50 shrink-0">Section entière affichée seulement si</span>
            <select
              value={section.conditionSurQuestionId || ""}
              onChange={(e) => modifierSection(si, { conditionSurQuestionId: e.target.value || undefined, conditionValeur: undefined })}
              className="max-w-full px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none"
            >
              <option value="">(toujours affichée)</option>
              {toutesQuestions.filter((q) => !section.items.some((it) => it.id === q.id)).map((q) => (
                <option key={q.id} value={q.id}>{q.enonce || q.id}</option>
              ))}
            </select>
            {section.conditionSurQuestionId && (() => {
              const ref = toutesQuestions.find((q) => q.id === section.conditionSurQuestionId);
              if (!ref) return null;
              if (ref.type === "echelle") {
                return (
                  <select value={section.conditionValeur || ""} onChange={(e) => modifierSection(si, { conditionValeur: e.target.value })} className="max-w-full px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none">
                    <option value="">— choisir —</option>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={String(n)}>vaut {n}</option>)}
                  </select>
                );
              }
              return (
                <select value={section.conditionValeur || ""} onChange={(e) => modifierSection(si, { conditionValeur: e.target.value })} className="max-w-full px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none">
                  <option value="">— choisir —</option>
                  {(ref.options || []).map((opt) => <option key={opt} value={opt}>vaut « {opt} »</option>)}
                </select>
              );
            })()}
          </div>

          <div className="divide-y divide-[#404040]/10 pl-6">
            {section.items.map((item, ii) => (
              <div key={item.id} className="pt-3 pb-3 space-y-2 first:pt-0">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button type="button" onClick={() => deplacerItem(si, ii, -1)} disabled={ii === 0} className="text-[#404040]/40 hover:text-[#005259] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                      <ChevronUpIcon className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => deplacerItem(si, ii, 1)} disabled={ii === section.items.length - 1} className="text-[#404040]/40 hover:text-[#005259] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {item.type === "texte_intro" ? (
                        <textarea defaultValue={item.contenu || ""} onBlur={(e) => modifierItem(si, ii, { contenu: e.target.value })} placeholder="Texte à afficher" rows={2} className={`${inputClass} sm:col-span-2 min-w-0`} />
                      ) : (
                        <textarea defaultValue={item.enonce || ""} onBlur={(e) => modifierItem(si, ii, { enonce: e.target.value })} placeholder="Énoncé de la question" rows={2} className={`${inputClass} sm:col-span-2 min-w-0`} />
                      )}
                      <select value={item.type} onChange={(e) => modifierItem(si, ii, { type: e.target.value as TypeItemSatisfaction })} className={`${inputClass} min-w-0`}>
                        {TYPES_ITEM.map((t) => <option key={t.valeur} value={t.valeur}>{t.label}</option>)}
                      </select>
                    </div>

                    {(item.type === "choix_unique" || item.type === "choix_multiple") && (
                      <div className="space-y-1.5">
                        <label className={labelClass}>Options (séparées par une virgule)</label>
                        <input
                          type="text"
                          defaultValue={(item.options || []).join(", ")}
                          onBlur={(e) => modifierItem(si, ii, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                          className={inputClass}
                        />
                      </div>
                    )}

                    {item.type === "echelle" && (
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" defaultValue={item.echelleMin || ""} onBlur={(e) => modifierItem(si, ii, { echelleMin: e.target.value })} placeholder="Libellé sous 1 (ex. Pas satisfait)" className={inputClass} />
                        <input type="text" defaultValue={item.echelleMax || ""} onBlur={(e) => modifierItem(si, ii, { echelleMax: e.target.value })} placeholder="Libellé sous 5 (ex. Très satisfait)" className={inputClass} />
                      </div>
                    )}

                    {item.type !== "texte_intro" && (
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-[10px] font-bold uppercase text-[#404040]/50 shrink-0">Afficher seulement si</span>
                        <select
                          value={item.conditionSurQuestionId || ""}
                          onChange={(e) => modifierItem(si, ii, { conditionSurQuestionId: e.target.value || undefined, conditionValeur: undefined })}
                          className="max-w-full px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none"
                        >
                          <option value="">(toujours affichée)</option>
                          {toutesQuestions.filter((q) => q.id !== item.id).map((q) => <option key={q.id} value={q.id}>{q.enonce || q.id}</option>)}
                        </select>
                        {item.conditionSurQuestionId && (() => {
                          const ref = toutesQuestions.find((q) => q.id === item.conditionSurQuestionId);
                          if (!ref) return null;
                          if (ref.type === "echelle") {
                            return (
                              <select value={item.conditionValeur || ""} onChange={(e) => modifierItem(si, ii, { conditionValeur: e.target.value })} className="max-w-full px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none">
                                <option value="">— choisir —</option>
                                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={String(n)}>vaut {n}</option>)}
                              </select>
                            );
                          }
                          return (
                            <select value={item.conditionValeur || ""} onChange={(e) => modifierItem(si, ii, { conditionValeur: e.target.value })} className="max-w-full px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none">
                              <option value="">— choisir —</option>
                              {(ref.options || []).map((opt) => <option key={opt} value={opt}>vaut « {opt} »</option>)}
                            </select>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => supprimerItem(si, ii)} className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer shrink-0">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {section.items.length === 0 && <p className="text-xs text-[#404040]/50 italic">Aucune question dans cette section.</p>}
            <button type="button" onClick={() => ajouterItem(si)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F3F2] hover:bg-[#005259]/10 text-[#005259] rounded-xl text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer">
              <PlusIcon className="w-3.5 h-3.5" /> Question
            </button>
          </div>
        </div>
      ))}
      {config.sections.length === 0 && <p className="text-xs text-[#404040]/50 italic text-center py-6">Aucune section pour le moment.</p>}
    </div>
  );
}

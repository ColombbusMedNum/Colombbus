"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import { PlusIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useToast } from "@/components/ToastProvider";
import { ConfigPositionnement, ItemPositionnement, SectionPositionnement, TypeItemPositionnement, nouvelleConfigPositionnementVide } from "@/lib/positionnement";

const TYPES_ITEM: { valeur: TypeItemPositionnement; label: string }[] = [
  { valeur: "qcm", label: "QCM" },
  { valeur: "texte_libre", label: "Réponse libre" },
  { valeur: "texte_intro", label: "Bloc de texte (non noté)" },
];

const inputClass = "w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] placeholder-[#404040]/40 outline-none font-medium transition-colors";
const labelClass = "block text-[11px] font-bold text-[#404040]/70 uppercase tracking-wide mb-1";

// Éditeur générique de la configuration d'un test de positionnement — même
// idiome que l'éditeur de schema.questions sur app/mediation/actions-
// collectives/inscription/[slug]/parametres/page.tsx (ajouter/déplacer/
// supprimer), avec un niveau de groupement en plus (section > items).
export default function EditeurPositionnement({ programmeId }: { programmeId: string }) {
  const { showToast } = useToast();
  const [config, setConfig] = useState<ConfigPositionnement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const snap = await getDoc(doc(db, "positionnement", programmeId));
      setConfig(snap.exists() ? (snap.data() as ConfigPositionnement) : nouvelleConfigPositionnementVide("Test de positionnement"));
      setLoading(false);
    };
    charger();
  }, [programmeId]);

  const enregistrer = async (suivant: ConfigPositionnement) => {
    setConfig(suivant);
    try {
      await setDoc(doc(db, "positionnement", programmeId), suivant);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du test de positionnement :", error);
      showToast("Erreur lors de l'enregistrement.", "error");
    }
  };

  if (loading || !config) {
    return <div className={`${quicksand.className} text-xs font-bold uppercase tracking-widest text-[#404040]/50 animate-pulse`}>Chargement...</div>;
  }

  const majConfig = (patch: Partial<ConfigPositionnement>) => enregistrer({ ...config, ...patch });

  const ajouterSection = () => {
    const nouvelle: SectionPositionnement = { id: `section_${Date.now()}`, titre: "Nouvelle section", items: [] };
    majConfig({ sections: [...config.sections, nouvelle] });
  };
  const modifierSection = (index: number, patch: Partial<SectionPositionnement>) => {
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
    const nouvel: ItemPositionnement = { id: `item_${Date.now()}`, type: "qcm", enonce: "Nouvelle question", options: ["Option 1", "Option 2"], bonneReponseIndex: 0 };
    modifierSection(sectionIndex, { items: [...section.items, nouvel] });
  };
  const modifierItem = (sectionIndex: number, itemIndex: number, patch: Partial<ItemPositionnement>) => {
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

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Informations générales</h2>
        <div>
          <label className={labelClass}>Titre du test</label>
          <input type="text" defaultValue={config.titre} onBlur={(e) => majConfig({ titre: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description (facultative)</label>
          <textarea defaultValue={config.description} onBlur={(e) => majConfig({ description: e.target.value })} rows={3} className={inputClass} />
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
              <input type="text" defaultValue={section.titre} onBlur={(e) => modifierSection(si, { titre: e.target.value })} placeholder="Titre de la section (ex. Test de Français)" className={inputClass} />
              <input type="text" defaultValue={section.sousTitre || ""} onBlur={(e) => modifierSection(si, { sousTitre: e.target.value })} placeholder="Sous-titre (ex. Durée conseillée : 35 min)" className={inputClass} />
            </div>
            <button type="button" onClick={() => supprimerSection(si)} className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer shrink-0">
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 pl-6">
            {section.items.map((item, ii) => (
              <div key={item.id} className="border border-[#404040]/10 rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button type="button" onClick={() => deplacerItem(si, ii, -1)} disabled={ii === 0} className="text-[#404040]/40 hover:text-[#005259] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                      <ChevronUpIcon className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => deplacerItem(si, ii, 1)} disabled={ii === section.items.length - 1} className="text-[#404040]/40 hover:text-[#005259] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <select value={item.type} onChange={(e) => modifierItem(si, ii, { type: e.target.value as TypeItemPositionnement })} className={`${inputClass} w-48`}>
                        {TYPES_ITEM.map((t) => <option key={t.valeur} value={t.valeur}>{t.label}</option>)}
                      </select>
                    </div>
                    {item.type === "texte_intro" ? (
                      <textarea defaultValue={item.contenu || ""} onBlur={(e) => modifierItem(si, ii, { contenu: e.target.value })} placeholder="Texte à afficher (ex. un texte à lire avant les questions suivantes)" rows={4} className={inputClass} />
                    ) : (
                      <>
                        <textarea defaultValue={item.enonce || ""} onBlur={(e) => modifierItem(si, ii, { enonce: e.target.value })} placeholder="Énoncé de la question" rows={2} className={inputClass} />
                        {item.type === "texte_libre" && (
                          <div>
                            <label className={labelClass}>Réponse indicative (facultative — aide le correcteur, jamais montrée au candidat)</label>
                            <input type="text" defaultValue={item.reponseIndicative || ""} onBlur={(e) => modifierItem(si, ii, { reponseIndicative: e.target.value })} placeholder="Ex : 62" className={inputClass} />
                          </div>
                        )}
                        {item.type === "qcm" && (
                          <div className="space-y-1.5">
                            <label className={labelClass}>Options (la bonne réponse est cochée)</label>
                            {(item.options || []).map((option, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`bonne-reponse-${item.id}`}
                                  checked={item.bonneReponseIndex === oi}
                                  onChange={() => modifierItem(si, ii, { bonneReponseIndex: oi })}
                                  className="w-4 h-4 accent-[#005259] cursor-pointer shrink-0"
                                />
                                <input
                                  type="text"
                                  defaultValue={option}
                                  onBlur={(e) => modifierItem(si, ii, { options: (item.options || []).map((o, x) => (x === oi ? e.target.value : o)) })}
                                  className={`${inputClass} flex-1`}
                                />
                                <button
                                  type="button"
                                  onClick={() => modifierItem(si, ii, { options: (item.options || []).filter((_, x) => x !== oi), bonneReponseIndex: item.bonneReponseIndex === oi ? 0 : item.bonneReponseIndex })}
                                  className="p-1.5 text-[#EF736A] hover:bg-[#EF736A]/10 rounded-lg cursor-pointer shrink-0"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => modifierItem(si, ii, { options: [...(item.options || []), `Option ${(item.options?.length || 0) + 1}`] })}
                              className="text-[11px] font-bold text-[#005259] hover:text-[#EA601F] cursor-pointer"
                            >
                              + Ajouter une option
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <button type="button" onClick={() => supprimerItem(si, ii)} className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer shrink-0">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {section.items.length === 0 && <p className="text-xs text-[#404040]/50 italic">Aucun élément dans cette section.</p>}
            <button type="button" onClick={() => ajouterItem(si)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F3F2] hover:bg-[#005259]/10 text-[#005259] rounded-xl text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer">
              <PlusIcon className="w-3.5 h-3.5" /> Élément
            </button>
          </div>
        </div>
      ))}
      {config.sections.length === 0 && <p className="text-xs text-[#404040]/50 italic text-center py-6">Aucune section pour le moment.</p>}
    </div>
  );
}

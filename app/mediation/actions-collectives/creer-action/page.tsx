"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, PlusIcon, Cog6ToothIcon, SparklesIcon, TrashIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { useToast } from "@/components/ToastProvider";
import { ActionSchema, CategorieAccueil, SLUGS_RESERVES, nouveauSchemaVide, slugifier } from "@/lib/dynamicActions/types";
import { ecouterActionsDynamiques, sauvegarderSchema, supprimerActionDynamique } from "@/lib/dynamicActions/store";
import { MODELES_DUPLICATION } from "@/lib/dynamicActions/modelesDuplicationAction";

const inputClass = "w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] placeholder-[#404040]/40 outline-none font-medium transition-colors";
const labelClass = "block text-[11px] font-bold text-[#404040]/70 uppercase tracking-wide mb-1";

// Mêmes 3 dossiers que ceux utilisés par les programmes historiques dans
// NAV_TREE (app/page.tsx) — la tuile de l'action y est ajoutée automatiquement
// une fois cette catégorie choisie (voir fusionnerActionsDynamiques).
const CATEGORIES_ACCUEIL: { valeur: CategorieAccueil; label: string }[] = [
  { valeur: "inclusion-numerique", label: "Inclusion Numérique" },
  { valeur: "insertion-pro", label: "Insertion Professionnelle" },
  { valeur: "decouvertes-metiers", label: "Découvertes Métiers" },
];

export default function CreerActionPage() {
  const router = useRouter();
  const { role, loading: loadingPermissions } = usePermissions();
  const { showToast } = useToast();
  const [actions, setActions] = useState<ActionSchema[]>([]);
  const [chargement, setChargement] = useState(true);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nomAction, setNomAction] = useState("");
  const [modeleId, setModeleId] = useState(MODELES_DUPLICATION[MODELES_DUPLICATION.length - 1].id);
  const [categorieAccueil, setCategorieAccueil] = useState<CategorieAccueil>("inclusion-numerique");
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null);

  useEffect(() => {
    const unsub = ecouterActionsDynamiques((liste) => {
      setActions(liste.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setChargement(false);
    });
    return () => unsub();
  }, []);

  const creerAction = async () => {
    const label = nomAction.trim();
    if (!label) {
      showToast("Merci de donner un nom à cette nouvelle action.", "error");
      return;
    }
    let slug = slugifier(label);
    if (SLUGS_RESERVES.includes(slug) || actions.some((a) => a.slug === slug)) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    setCreationEnCours(true);
    try {
      const schema = nouveauSchemaVide(slug, label);
      schema.categorieAccueil = categorieAccueil;
      const modele = MODELES_DUPLICATION.find((m) => m.id === modeleId);
      if (modele && modele.questions.length > 0) {
        schema.questions = modele.questions.map((q, i) => ({ ...q, id: `q_${Date.now()}_${i}`, etape: i }));
        schema.dupliqueDepuis = modele.id;
      }
      await sauvegarderSchema(schema);
      showToast("Action créée avec succès.", "success");
      router.push(`/mediation/actions-collectives/inscription/${slug}/parametres`);
    } catch (e) {
      console.error(e);
      showToast("Erreur lors de la création de l'action.", "error");
      setCreationEnCours(false);
    }
  };

  const supprimerAction = async (action: ActionSchema) => {
    const confirmation = window.prompt(
      `Cette suppression est définitive : le schéma, le questionnaire, la configuration ET TOUTES les inscriptions reçues pour "${action.label}" seront perdus. Tape le nom de l'action pour confirmer : ${action.label}`
    );
    if (confirmation !== action.label) return;
    setSuppressionEnCours(action.slug);
    try {
      await supprimerActionDynamique(action.slug);
      showToast(`"${action.label}" a été supprimée.`, "success");
    } catch (e) {
      console.error(e);
      showToast("Erreur lors de la suppression de l'action.", "error");
    } finally {
      setSuppressionEnCours(null);
    }
  };

  if (chargement || loadingPermissions) {
    return <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>Chargement...</div>;
  }
  return (
    <PageGuard pageId="page_access_action_dynamique">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="max-w-4xl mx-auto relative z-10 space-y-6">

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">Actions <span className="text-[#EA601F] font-semibold">personnalisées</span></h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Créer et gérer de nouvelles actions collectives directement depuis la plateforme</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link href="/mediation/actions-collectives" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Actions Collectives</span>
            </Link>
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>
        </div>

        {role !== "admin" ? (
          <p className="text-[11px] text-[#404040]/50 italic">Seul un administrateur peut créer une nouvelle action personnalisée.</p>
        ) : !formulaireOuvert ? (
          <button type="button" onClick={() => setFormulaireOuvert(true)} className="w-full flex items-center justify-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-2xl p-5 text-sm font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">
            <PlusIcon className="w-5 h-5" /> Nouvelle action
          </button>
        ) : (
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-[#EA601F]" />
              <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Nouvelle action</h2>
            </div>
            <div>
              <label className={labelClass}>Nom de l'action</label>
              <input type="text" value={nomAction} onChange={(e) => setNomAction(e.target.value)} placeholder="Ex : Coup de Pouce Numérique" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Dupliquer le questionnaire depuis...</label>
              <select value={modeleId} onChange={(e) => setModeleId(e.target.value)} className={inputClass}>
                {MODELES_DUPLICATION.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-[#404040]/50">Le socle commun (identité, adresse, QPV, date de naissance, niveau d'études, parkours/territoire/session) est toujours inclus — ce choix ne porte que sur les questions complémentaires, librement modifiables ensuite.</p>
            </div>
            <div>
              <label className={labelClass}>Tuile visible sur l'accueil, dans...</label>
              <select value={categorieAccueil} onChange={(e) => setCategorieAccueil(e.target.value as CategorieAccueil)} className={inputClass}>
                {CATEGORIES_ACCUEIL.map((c) => <option key={c.valeur} value={c.valeur}>{c.label}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-[#404040]/50">Modifiable ensuite depuis la page Paramètres de l'action.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#404040]/10">
              <button type="button" onClick={() => setFormulaireOuvert(false)} className="px-4 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">Annuler</button>
              <button type="button" onClick={creerAction} disabled={creationEnCours} className="px-5 py-2 bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">
                {creationEnCours ? "Création..." : "Créer l'action"}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Actions existantes ({actions.length})</h2>
          {actions.length === 0 ? (
            <p className="text-xs text-[#404040]/50 italic text-center py-8">Aucune action personnalisée créée pour le moment.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {actions.map((a) => (
                <div key={a.slug} className="bg-white border border-[#404040]/10 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: a.accentColor }}></div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#005259] truncate">{a.label}</p>
                      <p className="text-[10px] text-[#404040]/50">{a.actif ? "Active" : "Désactivée"} · {a.questions.length} question(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link href={`/mediation/actions-collectives/reponses/${a.slug}`} className="p-2 bg-[#F3F3F2] hover:bg-[#005259] hover:text-white text-[#005259] rounded-lg transition-colors" title="Réponses">
                      <ArrowLeftIcon className="w-4 h-4 rotate-180" />
                    </Link>
                    <Link href={`/mediation/actions-collectives/inscription/${a.slug}/parametres`} className="p-2 bg-[#F3F3F2] hover:bg-[#005259] hover:text-white text-[#005259] rounded-lg transition-colors" title="Paramètres">
                      <Cog6ToothIcon className="w-4 h-4" />
                    </Link>
                    {role === "admin" && (
                      <button
                        type="button"
                        onClick={() => supprimerAction(a)}
                        disabled={suppressionEnCours === a.slug}
                        className="p-2 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        title="Supprimer définitivement cette action"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
    </PageGuard>
  );
}

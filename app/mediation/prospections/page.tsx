"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowUpTrayIcon, PlusIcon, MagnifyingGlassIcon, ChatBubbleLeftRightIcon, ChevronUpIcon, ChevronDownIcon, UsersIcon, CheckCircleIcon, ClockIcon, SparklesIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { PermissionGuard } from "@/components/PermissionGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { ecouterProspects, creerProspect, ajouterAnnotation, definirContacte, type Prospect } from "@/lib/prospections";
import { useRouter } from "next/navigation";

function normaliser(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function ThTriable({ label, colonne, tri, onClick }: { label: string; colonne: string; tri: { colonne: string; direction: "asc" | "desc" }; onClick: (colonne: string) => void }) {
  const actif = tri.colonne === colonne;
  return (
    <th
      onClick={() => onClick(colonne)}
      className={`text-left font-extrabold uppercase tracking-wide px-4 py-2.5 whitespace-nowrap cursor-pointer select-none transition-colors ${actif ? "text-[#EA601F]" : "text-[#005259] hover:text-[#EA601F]"}`}
    >
      <span className="flex items-center gap-1">
        {label}
        {actif && (tri.direction === "asc" ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />)}
      </span>
    </th>
  );
}

function StatTile({ icon: Icon, valeur, label, accent }: { icon: React.ComponentType<{ className?: string }>; valeur: number; label: string; accent: "teal" | "orange" }) {
  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 shadow-sm flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent === "teal" ? "bg-[#005259]/10 text-[#005259]" : "bg-[#EA601F]/10 text-[#EA601F]"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className={`text-xl font-bold leading-tight ${accent === "teal" ? "text-[#005259]" : "text-[#EA601F]"}`}>{valeur}</p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#404040]/50 truncate">{label}</p>
      </div>
    </div>
  );
}

export default function ProspectionsPage() {
  const router = useRouter();
  const { user } = usePermissions();
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [panelAnnotationOuvert, setPanelAnnotationOuvert] = useState(false);
  const [texteBulk, setTexteBulk] = useState("");
  const [auteurBulk, setAuteurBulk] = useState("");
  const [envoiBulkEnCours, setEnvoiBulkEnCours] = useState(false);

  useEffect(() => ecouterProspects(setProspects), []);
  useEffect(() => { if (user) setAuteurBulk(user.displayName || user.email || ""); }, [user]);

  // Colonnes affichées dans la table — fixées sur mesure pour le fichier
  // Hauts-de-Seine (voir scripts/import-prospections-hds.js), affichées
  // seulement si présentes dans les données. La fiche détaillée reste le
  // seul endroit qui montre tous les champs importés.
  const colonnes = useMemo(() => {
    const voulues = ["Adresse (établissement)", "Ville (établissement)", "Téléphone (gestionnaire)"];
    const presentes = new Set<string>();
    (prospects || []).forEach((p) => Object.keys(p.champs || {}).forEach((cle) => presentes.add(cle)));
    return voulues.filter((c) => presentes.has(c));
  }, [prospects]);

  const stats = useMemo(() => {
    const liste = prospects || [];
    const total = liste.length;
    const contactees = liste.filter((p) => p.contacte).length;
    const ilYA7Jours = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const annotationsRecentes = liste.reduce((n, p) => n + (p.annotations || []).filter((a) => new Date(a.date).getTime() >= ilYA7Jours).length, 0);
    return { total, contactees, aProspecter: total - contactees, annotationsRecentes };
  }, [prospects]);

  // Répartition par ville — compte le nombre d'acteurs (structures) par
  // ville d'implantation, triée du plus grand au plus petit nombre.
  const repartitionVilles = useMemo(() => {
    const compte = new Map<string, number>();
    (prospects || []).forEach((p) => {
      const ville = (p.champs?.["Ville (établissement)"] || "").trim() || "Ville inconnue";
      compte.set(ville, (compte.get(ville) || 0) + 1);
    });
    return Array.from(compte.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
  }, [prospects]);

  const filtres = useMemo(() => {
    const q = normaliser(recherche.trim());
    if (!prospects) return [];
    if (!q) return prospects;
    return prospects.filter((p) => {
      const texte = normaliser([p.nom, ...Object.values(p.champs || {})].join(" "));
      return texte.includes(q);
    });
  }, [prospects, recherche]);

  const [tri, setTri] = useState<{ colonne: string; direction: "asc" | "desc" }>({ colonne: "nom", direction: "asc" });
  const basculerTri = (colonne: string) => setTri((prev) => prev.colonne === colonne ? { colonne, direction: prev.direction === "asc" ? "desc" : "asc" } : { colonne, direction: "asc" });

  const tries = useMemo(() => {
    const valeur = (p: Prospect): string | number => {
      if (tri.colonne === "nom") return p.nom;
      if (tri.colonne === "annotations") return p.annotations?.length || 0;
      if (tri.colonne === "contacte") return p.contacte ? 1 : 0;
      return p.champs?.[tri.colonne] || "";
    };
    return [...filtres].sort((a, b) => {
      const va = valeur(a), vb = valeur(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fr", { sensitivity: "base" });
      return tri.direction === "asc" ? cmp : -cmp;
    });
  }, [filtres, tri]);

  const toutesSelectionnees = filtres.length > 0 && filtres.every((p) => selection.has(p.id));
  const basculerTout = () => setSelection(toutesSelectionnees ? new Set() : new Set(filtres.map((p) => p.id)));
  const basculerUn = (id: string) => setSelection((prev) => {
    const suivant = new Set(prev);
    if (suivant.has(id)) suivant.delete(id); else suivant.add(id);
    return suivant;
  });

  const creer = async () => {
    const nom = nouveauNom.trim();
    if (!nom || creationEnCours) return;
    setCreationEnCours(true);
    try {
      const id = await creerProspect(nom);
      router.push(`/mediation/prospections/${id}`);
    } finally {
      setCreationEnCours(false);
    }
  };

  const marquerSelectionContactee = async (contacte: boolean) => {
    await Promise.all(Array.from(selection).map((id) => definirContacte(id, contacte)));
    setSelection(new Set());
  };

  const envoyerAnnotationBulk = async () => {
    const texte = texteBulk.trim();
    const nomAuteur = auteurBulk.trim();
    if (!texte || !nomAuteur || envoiBulkEnCours || selection.size === 0 || !prospects) return;
    setEnvoiBulkEnCours(true);
    try {
      const cibles = prospects.filter((p) => selection.has(p.id));
      await Promise.all(cibles.map((p) => ajouterAnnotation(p.id, texte, nomAuteur, p)));
      setTexteBulk("");
      setPanelAnnotationOuvert(false);
      setSelection(new Set());
    } finally {
      setEnvoiBulkEnCours(false);
    }
  };

  return (
    <PageGuard pageId="page_access_prospections">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-6xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Prospect<span className="text-[#EA601F] font-semibold">ions</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">{prospects ? `${prospects.length} fiche${prospects.length > 1 ? "s" : ""}` : "Chargement..."}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <PermissionGuard actionId="prosp_import">
                <Link href="/mediation/prospections/importer" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                  <ArrowUpTrayIcon className="w-4 h-4 text-[#EA601F]" />
                  <span>Importer un fichier</span>
                </Link>
              </PermissionGuard>
              <button onClick={() => setCreationOuverte((v) => !v)} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer">
                <PlusIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Nouvelle fiche</span>
              </button>
              <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

          {creationOuverte && (
            <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-2.5">
              <input
                autoFocus
                value={nouveauNom}
                onChange={(e) => setNouveauNom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && creer()}
                placeholder="Nom du prospect..."
                className="flex-1 min-w-[200px] px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none focus:border-[#005259]/40"
              />
              <button onClick={creer} disabled={!nouveauNom.trim() || creationEnCours} className="px-3.5 py-2 bg-[#005259] hover:bg-[#EA601F] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
                Créer la fiche
              </button>
            </div>
          )}

          {prospects !== null && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile icon={UsersIcon} valeur={stats.total} label="Référencés" accent="teal" />
              <StatTile icon={CheckCircleIcon} valeur={stats.contactees} label="Contactées" accent="teal" />
              <StatTile icon={SparklesIcon} valeur={stats.aProspecter} label="À contacter" accent="orange" />
              <StatTile icon={ClockIcon} valeur={stats.annotationsRecentes} label="Annotations (7 j.)" accent="orange" />
            </div>
          )}

          {repartitionVilles.length > 0 && (
            <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 shadow-sm space-y-2.5">
              <h2 className="text-[10px] font-extrabold uppercase tracking-wide text-[#404040]/50">Répartition par ville ({repartitionVilles.length})</h2>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {repartitionVilles.map(([ville, nb]) => (
                  <button
                    key={ville}
                    onClick={() => setRecherche((r) => normaliser(r.trim()) === normaliser(ville) ? "" : ville)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${normaliser(recherche.trim()) === normaliser(ville) ? "bg-[#005259] text-white" : "bg-[#F3F3F2] text-[#404040]/80 hover:bg-[#005259]/10"}`}
                  >
                    {ville}
                    <span className={normaliser(recherche.trim()) === normaliser(ville) ? "text-white/70" : "text-[#EA601F]"}>{nb}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-[#404040]/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un prospect (nom, structure, email...)"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#404040]/10 rounded-xl text-xs outline-none focus:border-[#005259]/40 shadow-sm"
            />
          </div>

          {selection.size > 0 && (
            <div className="bg-white border border-[#005259]/20 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-[#005259]">{selection.size} fiche{selection.size > 1 ? "s" : ""} sélectionnée{selection.size > 1 ? "s" : ""}</span>
                <PermissionGuard actionId="prosp_add_annotation">
                  <button onClick={() => setPanelAnnotationOuvert((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#005259] hover:bg-[#EA601F] text-white rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer">
                    <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                    Annoter la sélection
                  </button>
                </PermissionGuard>
                <PermissionGuard actionId="prosp_add_annotation">
                  <button onClick={() => marquerSelectionContactee(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#404040]/15 text-[#005259] rounded-lg text-[10px] font-bold uppercase tracking-wide hover:border-[#005259]/40 transition-colors cursor-pointer">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    Marquer contactée
                  </button>
                </PermissionGuard>
                <PermissionGuard actionId="prosp_add_annotation">
                  <button onClick={() => marquerSelectionContactee(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#404040]/15 text-[#404040]/60 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:border-[#404040]/30 transition-colors cursor-pointer">
                    Marquer non contactée
                  </button>
                </PermissionGuard>
                <button onClick={() => setSelection(new Set())} className="px-3 py-1.5 bg-[#F3F3F2] text-[#404040]/70 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:text-[#404040] transition-colors cursor-pointer">
                  Désélectionner
                </button>
              </div>

              {panelAnnotationOuvert && (
                <div className="bg-[#F3F3F2] rounded-xl p-3.5 space-y-2.5">
                  <textarea
                    value={texteBulk}
                    onChange={(e) => setTexteBulk(e.target.value)}
                    placeholder={`Note appliquée aux ${selection.size} fiches sélectionnées... Ex. Contacté le 01/10 par mail, en attente de retour`}
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-[#404040]/15 rounded-lg text-xs outline-none focus:border-[#005259]/40 resize-none"
                  />
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      value={auteurBulk}
                      onChange={(e) => setAuteurBulk(e.target.value)}
                      placeholder="Ton nom..."
                      className="px-3 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-xs outline-none focus:border-[#005259]/40 w-40"
                    />
                    <button onClick={envoyerAnnotationBulk} disabled={!texteBulk.trim() || !auteurBulk.trim() || envoiBulkEnCours} className="ml-auto px-3.5 py-1.5 bg-[#005259] hover:bg-[#EA601F] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
                      {envoiBulkEnCours ? "Envoi..." : `Ajouter à ${selection.size} fiche${selection.size > 1 ? "s" : ""}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
            {prospects === null ? (
              <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-[#404040]/40 animate-pulse">Chargement...</div>
            ) : filtres.length === 0 ? (
              <div className="p-8 text-center text-xs font-medium text-[#404040]/50">
                {prospects.length === 0 ? "Aucun prospect pour le moment — importe un fichier ou crée une fiche." : "Aucun résultat pour cette recherche."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#404040]/10 bg-[#F3F3F2]">
                      <th className="px-4 py-2.5 w-8">
                        <input type="checkbox" checked={toutesSelectionnees} onChange={basculerTout} className="w-3.5 h-3.5 cursor-pointer accent-[#005259]" />
                      </th>
                      <ThTriable label="Nom" colonne="nom" tri={tri} onClick={basculerTri} />
                      <ThTriable label="Contacté" colonne="contacte" tri={tri} onClick={basculerTri} />
                      {colonnes.map((c) => (
                        <ThTriable key={c} label={c} colonne={c} tri={tri} onClick={basculerTri} />
                      ))}
                      <ThTriable label="Annotations" colonne="annotations" tri={tri} onClick={basculerTri} />
                    </tr>
                  </thead>
                  <tbody>
                    {tries.map((p) => (
                      <tr key={p.id} onClick={() => router.push(`/mediation/prospections/${p.id}`)} className="border-b border-[#404040]/5 last:border-0 hover:bg-[#005259]/5 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selection.has(p.id)} onChange={() => basculerUn(p.id)} className="w-3.5 h-3.5 cursor-pointer accent-[#005259]" />
                        </td>
                        <td className="px-4 py-2.5 font-bold text-[#005259] whitespace-nowrap">{p.nom}</td>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <PermissionGuard actionId="prosp_add_annotation" fallback={p.contacte ? <CheckCircleIcon className="w-4 h-4 text-[#005259]" /> : <span className="text-[#404040]/30">—</span>}>
                            <input type="checkbox" checked={!!p.contacte} onChange={() => definirContacte(p.id, !p.contacte)} className="w-3.5 h-3.5 cursor-pointer accent-[#005259]" />
                          </PermissionGuard>
                        </td>
                        {colonnes.map((c) => (
                          <td key={c} className="px-4 py-2.5 text-[#404040]/80 whitespace-nowrap max-w-[200px] truncate">{p.champs?.[c] || "—"}</td>
                        ))}
                        <td className="px-4 py-2.5 text-[#404040]/60 whitespace-nowrap">
                          {p.annotations?.length > 0 ? (
                            <span className="flex items-center gap-1">
                              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-[#EA601F]" />
                              {p.annotations.length}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </PageGuard>
  );
}

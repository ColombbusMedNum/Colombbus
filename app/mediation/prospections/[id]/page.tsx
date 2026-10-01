"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, TrashIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { PermissionGuard } from "@/components/PermissionGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { ecouterProspect, ajouterAnnotation, supprimerAnnotation, supprimerProspect, mettreAJourChampsProspect, type Prospect } from "@/lib/prospections";

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function FicheProspectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = usePermissions();

  const [prospect, setProspect] = useState<Prospect | null | undefined>(undefined);
  const [auteur, setAuteur] = useState("");
  const [texteAnnotation, setTexteAnnotation] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [editionNom, setEditionNom] = useState(false);
  const [nomEdite, setNomEdite] = useState("");

  useEffect(() => {
    if (!id) return;
    return ecouterProspect(id, setProspect);
  }, [id]);

  useEffect(() => {
    if (user) setAuteur(user.displayName || user.email || "");
  }, [user]);

  if (prospect === undefined) {
    return <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>Chargement...</div>;
  }
  if (prospect === null) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-center p-8 antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#EF736A]">Fiche introuvable</p>
        <Link href="/mediation/prospections" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
          <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
          <span>Retour</span>
        </Link>
      </div>
    );
  }

  const annotationsTriees = [...prospect.annotations].sort((a, b) => b.date.localeCompare(a.date));

  const envoyerAnnotation = async () => {
    const texte = texteAnnotation.trim();
    const nomAuteur = auteur.trim();
    if (!texte || !nomAuteur || envoiEnCours) return;
    setEnvoiEnCours(true);
    try {
      await ajouterAnnotation(prospect.id, texte, nomAuteur, prospect);
      setTexteAnnotation("");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const supprimer = async () => {
    if (!confirm(`Supprimer définitivement la fiche "${prospect.nom}" ?`)) return;
    await supprimerProspect(prospect.id);
    router.push("/mediation/prospections");
  };

  const enregistrerNom = async () => {
    const nom = nomEdite.trim();
    if (!nom) return;
    await mettreAJourChampsProspect(prospect.id, nom, prospect.champs);
    setEditionNom(false);
  };

  return (
    <PageGuard pageId="page_access_prospections">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-3xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)] shrink-0"></div>
              <div className="min-w-0">
                {editionNom ? (
                  <div className="flex items-center gap-2">
                    <input autoFocus value={nomEdite} onChange={(e) => setNomEdite(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enregistrerNom()} className="px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-sm font-bold text-[#005259] outline-none" />
                    <button onClick={enregistrerNom} className="px-2.5 py-1.5 bg-[#005259] text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer">OK</button>
                  </div>
                ) : (
                  <h1 onClick={() => { setNomEdite(prospect.nom); setEditionNom(true); }} className="text-xl md:text-2xl font-bold uppercase text-[#005259] tracking-tight truncate cursor-pointer hover:text-[#EA601F] transition-colors" title="Cliquer pour modifier">
                    {prospect.nom}
                  </h1>
                )}
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Fiche prospect — créée le {formaterDate(prospect.creeLe)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
              <Link href="/mediation/prospections" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Retour</span>
              </Link>
              <PermissionGuard actionId="prosp_delete">
                <button onClick={supprimer} className="flex items-center gap-2 bg-white hover:bg-[#EF736A] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#EF736A] transition-all text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </PermissionGuard>
              <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

          {Object.keys(prospect.champs || {}).length > 0 && (
            <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm">
              <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259] mb-3">Informations</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {Object.entries(prospect.champs).filter(([, v]) => v).map(([cle, valeur]) => (
                  <div key={cle} className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-[#404040]/50">{cle}</dt>
                    <dd className="text-xs text-[#404040] break-words">{valeur}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259] flex items-center gap-1.5">
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
              Annotations ({prospect.annotations.length})
            </h2>

            <PermissionGuard actionId="prosp_add_annotation">
              <div className="bg-[#F3F3F2] rounded-xl p-3.5 space-y-2.5">
                <textarea
                  value={texteAnnotation}
                  onChange={(e) => setTexteAnnotation(e.target.value)}
                  placeholder="Ex. Contacté le 01/10 par téléphone, rappeler jeudi prochain..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-[#404040]/15 rounded-lg text-xs outline-none focus:border-[#005259]/40 resize-none"
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    value={auteur}
                    onChange={(e) => setAuteur(e.target.value)}
                    placeholder="Ton nom..."
                    className="px-3 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-xs outline-none focus:border-[#005259]/40 w-40"
                  />
                  <button onClick={envoyerAnnotation} disabled={!texteAnnotation.trim() || !auteur.trim() || envoiEnCours} className="ml-auto px-3.5 py-1.5 bg-[#005259] hover:bg-[#EA601F] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
                    Ajouter
                  </button>
                </div>
              </div>
            </PermissionGuard>

            {annotationsTriees.length === 0 ? (
              <p className="text-xs text-[#404040]/50 text-center py-4">Aucune annotation pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {annotationsTriees.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 bg-[#F3F3F2] rounded-xl px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#EA601F]">{formaterDate(a.date)} — {a.auteur}</p>
                      <p className="text-xs text-[#404040] mt-0.5 break-words whitespace-pre-wrap">{a.texte}</p>
                    </div>
                    <PermissionGuard actionId="prosp_delete">
                      <button onClick={() => supprimerAnnotation(prospect.id, a.id, prospect)} className="shrink-0 text-[#404040]/30 hover:text-[#EF736A] transition-colors cursor-pointer">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </PermissionGuard>
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

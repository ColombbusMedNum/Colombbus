"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, LinkIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { listerActionsDynamiques } from "@/lib/dynamicActions/store";
import { ActionSchema } from "@/lib/dynamicActions/types";

// Formulaires publics fixes (programmes historiques) — liste courte et
// stable, à jour à la main si un nouveau programme historique voit le jour
// (rare). Les éléments "créables" (actions dynamiques, tests de
// positionnement, questionnaires de satisfaction) sont eux relus depuis
// Firestore à chaque chargement, donc toujours à jour sans y retoucher.
const FORMULAIRES_FIXES = [
  { label: "Numérik'UP — Inscription", chemin: "/inscription/numerik-up" },
  { label: "NUMERIK PRO — Inscription", chemin: "/inscription/numerik-up-pro" },
  { label: "NUMERIK PRO — Test de langue", chemin: "/inscription/numerik-up-pro-test-langue" },
  { label: "Digital'UP — Inscription", chemin: "/inscription/digital-up" },
  { label: "DIGITAL UP 96H — Inscription", chemin: "/inscription/digital-up-pro" },
  { label: "DIGITAL UP 96H — Test de langue", chemin: "/inscription/digital-up-pro-test-langue" },
  { label: "DIGITAL UP 96H — Collecte Tech", chemin: "/inscription/digital-up-pro-collecte-tech" },
  { label: "PRFE — Inscription", chemin: "/inscription/prfe" },
  { label: "PRFE — Test de positionnement", chemin: "/inscription/prfe-positionnement" },
];

interface LienPublic {
  label: string;
  chemin: string;
}

function Section({ titre, liens, origine }: { titre: string; liens: LienPublic[]; origine: string }) {
  if (liens.length === 0) return null;
  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">{titre} ({liens.length})</h2>
      <div className="space-y-2">
        {liens.map((lien) => (
          <LigneLien key={lien.chemin} lien={lien} origine={origine} />
        ))}
      </div>
    </div>
  );
}

function LigneLien({ lien, origine }: { lien: LienPublic; origine: string }) {
  const [copie, setCopie] = useState(false);
  const url = `${origine}${lien.chemin}`;
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch (error) {
      console.error("Erreur lors de la copie du lien :", error);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 bg-[#F3F3F2] rounded-xl px-3 py-2.5">
      <span className="text-xs font-bold text-[#005259] shrink-0">{lien.label}</span>
      <code className="flex-1 min-w-0 truncate text-[11px] font-mono text-[#404040]">{url}</code>
      <div className="flex items-center gap-2 shrink-0">
        <a href={lien.chemin} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 bg-white border border-[#404040]/15 text-[#005259] rounded-lg text-[10px] font-bold uppercase tracking-wide hover:border-[#005259]/40 transition-colors">
          Ouvrir
        </a>
        <button onClick={copier} className="flex items-center gap-1 px-2.5 py-1 bg-[#005259] hover:bg-[#EA601F] text-white rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer">
          <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" />
          {copie ? "Copié !" : "Copier"}
        </button>
      </div>
    </div>
  );
}

export default function LiensPublicsPage() {
  const [origine, setOrigine] = useState("");
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<ActionSchema[]>([]);
  const [positionnementIds, setPositionnementIds] = useState<string[]>([]);
  const [satisfactionIds, setSatisfactionIds] = useState<string[]>([]);

  useEffect(() => {
    setOrigine(window.location.origin);
    const charger = async () => {
      const [actionsListe, snapPositionnement, snapSatisfaction] = await Promise.all([
        listerActionsDynamiques(),
        getDocs(collection(db, "positionnement")),
        getDocs(collection(db, "satisfaction")),
      ]);
      setActions(actionsListe.filter((a) => a.actif));
      setPositionnementIds(snapPositionnement.docs.map((d) => d.id));
      setSatisfactionIds(snapSatisfaction.docs.map((d) => d.id));
      setLoading(false);
    };
    charger();
  }, []);

  if (loading) {
    return <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>Chargement...</div>;
  }

  const slugsActions = new Set(actions.map((a) => a.slug));

  const liensActions: LienPublic[] = actions.flatMap((a) => {
    const liens: LienPublic[] = [{ label: `${a.label} — Inscription`, chemin: `/inscription/${a.slug}` }];
    if (a.testLangueActif) liens.push({ label: `${a.label} — Test de langue`, chemin: `/inscription/${a.slug}/test-langue` });
    if (a.collecteTechActif) liens.push({ label: `${a.label} — Collecte Tech`, chemin: `/inscription/${a.slug}/collecte-tech` });
    if (a.positionnementActif) liens.push({ label: `${a.label} — Test de positionnement`, chemin: `/inscription/${a.slug}/positionnement` });
    if (a.satisfactionActif) liens.push({ label: `${a.label} — Satisfaction`, chemin: `/inscription/${a.slug}/satisfaction` });
    return liens;
  });

  // Ne montre ici que les tests/questionnaires des programmes historiques
  // (pas déjà listés ci-dessus au sein de leur propre action dynamique).
  const liensPositionnementHistoriques: LienPublic[] = positionnementIds
    .filter((id) => !slugsActions.has(id))
    .map((id) => ({ label: `${id} — Test de positionnement`, chemin: id === "prfe" ? "/inscription/prfe-positionnement" : `/inscription/${id}/positionnement` }));

  const liensSatisfactionHistoriques: LienPublic[] = satisfactionIds
    .filter((id) => !slugsActions.has(id))
    .map((id) => ({ label: `${id} — Satisfaction`, chemin: `/inscription/${id}/satisfaction` }));

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-4xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Liens <span className="text-[#EA601F] font-semibold">publics</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Tous les formulaires accessibles sans connexion</p>
              </div>
            </div>
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>

          <p className="text-[11px] text-[#404040]/50 font-medium flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5" />
            Les actions personnalisées et les tests/questionnaires créés depuis l'interface apparaissent ici automatiquement, sans rien à mettre à jour.
          </p>

          <Section titre="Formulaires historiques" liens={FORMULAIRES_FIXES} origine={origine} />
          <Section titre="Actions personnalisées" liens={liensActions} origine={origine} />
          <Section titre="Tests de positionnement (programmes historiques)" liens={liensPositionnementHistoriques} origine={origine} />
          <Section titre="Questionnaires de satisfaction (programmes historiques)" liens={liensSatisfactionHistoriques} origine={origine} />
        </div>
      </main>
    </PageGuard>
  );
}

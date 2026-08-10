"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { ROLES } from "@/lib/roles";
import { PAGES_CATALOG, DEFAULT_PERMISSIONS, ALL_ACTION_IDS, ActionItem, resolvePermission } from "@/lib/permissionsCatalog";
import PageGuard from "@/components/PageGuard";
import {
  ShieldCheckIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentDuplicateIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Icônes d'affichage par page (purement cosmétique, ne fait pas partie du
// catalogue partagé lib/permissionsCatalog.ts).
const ICONS_BY_PAGE_ID: Record<string, React.ElementType> = {
  page_access_home: BuildingOfficeIcon,
  page_access_login: ShieldCheckIcon,
  page_access_liste_beneficiaires: UserGroupIcon,
  page_access_fiche_beneficiaire: UserGroupIcon,
  page_access_diagnosticform: DocumentDuplicateIcon,
  page_access_actions_collectives: DocumentDuplicateIcon,
  page_access_agenda: ShieldCheckIcon,
  page_access_suivi_collecte: DocumentDuplicateIcon,
  page_access_suresnes: ShieldCheckIcon,
  page_access_equipe: UserGroupIcon,
};
const DEFAULT_ICON = Squares2X2Icon;

// Ligne synthétique représentant l'accès à la page entière (consommée par
// <PageGuard>), affichée en plus des actions détaillées de chaque page.
function pageAccessRow(pageId: string): ActionItem {
  return {
    id: pageId,
    nom: "Accès à la page",
    type: "Link",
    description: "Autorise l'ouverture de cette page dans son ensemble",
  };
}

export default function AnalyseDroitsPage() {
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [matrixLoaded, setMatrixLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPageFilter, setSelectedPageFilter] = useState("all");
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "configuration_droits"),
      (snap) => {
        const data: Record<string, Record<string, boolean>> = {};
        snap.docs.forEach((d) => {
          data[d.id] = d.data() as Record<string, boolean>;
        });
        setMatrix(data);
        setMatrixLoaded(true);
      },
      (err) => {
        console.error("Impossible de lire la matrice de droits :", err);
        setMatrixLoaded(true);
      }
    );
    return () => unsub();
  }, []);

  const writeMatrixToFirestore = async (newMatrix: Record<string, Record<string, boolean>>) => {
    const batch = writeBatch(db);
    ALL_ACTION_IDS.forEach((actionId) => {
      const roleValues = newMatrix[actionId] || {};
      batch.set(doc(db, "configuration_droits", actionId), roleValues, { merge: false });
    });
    await batch.commit();
    setSaveStatus("💾 Modifications enregistrées");
    setTimeout(() => setSaveStatus(""), 2500);
  };

  const handleCheckboxChange = async (actionId: string, roleId: string, isChecked: boolean) => {
    try {
      await setDoc(doc(db, "configuration_droits", actionId), { [roleId]: isChecked }, { merge: true });
      setSaveStatus("💾 Modifications enregistrées");
      setTimeout(() => setSaveStatus(""), 2500);
    } catch (err) {
      console.error("Erreur lors de la mise à jour du droit :", err);
      alert("La mise à jour a échoué (droits insuffisants ou erreur réseau).");
    }
  };

  const handleResetDefaults = async () => {
    if (window.confirm("Voulez-vous réinitialiser tous les droits aux valeurs recommandées ?")) {
      await writeMatrixToFirestore(DEFAULT_PERMISSIONS);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(matrix, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "matrice_droits_analyse.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        const isValid = ROLES.every((role) => importedData[role.id] === undefined || typeof importedData[role.id] === "object");
        if (isValid) {
          // Le fichier importé est organisé par rôle (roleId -> actionId -> bool),
          // comme l'export ; on le transpose vers la forme actionId -> roleId -> bool
          // attendue par configuration_droits.
          const byAction: Record<string, Record<string, boolean>> = {};
          Object.entries(importedData).forEach(([roleId, actions]) => {
            Object.entries(actions as Record<string, boolean>).forEach(([actionId, value]) => {
              byAction[actionId] = { ...(byAction[actionId] || {}), [roleId]: !!value };
            });
          });
          await writeMatrixToFirestore(byAction);
          alert("✅ Import réussi avec succès !");
        } else {
          alert("❌ Format de fichier invalide.");
        }
      } catch (err) {
        console.error(err);
        alert("❌ Erreur lors de la lecture du fichier JSON.");
      }
    };
    reader.readAsText(file);
  };

  const filteredPages = PAGES_CATALOG.map((page) => {
    if (selectedPageFilter !== "all" && page.pageName !== selectedPageFilter) {
      return null;
    }

    const rows = [pageAccessRow(page.pageId), ...page.actions];
    const filteredActions = rows.filter(
      (action) =>
        action.nom.toLowerCase().includes(search.toLowerCase()) ||
        action.description.toLowerCase().includes(search.toLowerCase()) ||
        action.id.toLowerCase().includes(search.toLowerCase())
    );

    if (filteredActions.length === 0) return null;

    return { ...page, actions: filteredActions };
  }).filter(Boolean) as (typeof PAGES_CATALOG[number])[];

  return (
    <PageGuard pageId="page_access_analyse">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE ET BOUTONS DE NAVIGATION */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Matrice des droits <span className="text-[#EA601F] font-semibold">d'accès</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Analyse exhaustive des pages et des éléments d'interface par rôle utilisateur — enregistré en direct dans Firestore
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {saveStatus && (
              <span className="text-[#EA601F] font-bold text-xs mr-2 animate-pulse">{saveStatus}</span>
            )}

            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>

            <Link
              href="/admin/droits"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <UserGroupIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Gestion des Droits</span>
            </Link>

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer"
            >
              <ArrowPathIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Réinitialiser</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer"
            >
              <ArrowDownTrayIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Exporter</span>
            </button>

            <label className="flex items-center gap-1.5 bg-[#EA601F] hover:bg-[#EF736A] text-white px-3.5 py-2 rounded-xl transition-all text-xs font-bold uppercase tracking-wider shadow-md cursor-pointer active:scale-95">
              <ArrowUpTrayIcon className="w-4 h-4" />
              <span>Importer</span>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>
        </div>

        {/* CARTES RÔLES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {ROLES.map((role) => (
            <div key={role.id} className="bg-white border border-[#404040]/10 p-4 rounded-2xl shadow-sm">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-white bg-[#005259] px-2.5 py-1 rounded-lg mb-2 shadow-sm">
                {role.nom}
              </span>
              <p className="text-xs text-[#404040]/80 leading-relaxed font-medium">{role.desc}</p>
            </div>
          ))}
        </div>

        {/* BARRE DE RECHERCHE ET FILTRES DE PAGE */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-4 w-4 text-[#404040]/40 group-focus-within:text-[#EA601F] transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Rechercher une action ou un bouton..."
              className="block w-full pl-10 pr-4 py-2.5 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl text-xs text-[#404040] placeholder-[#404040]/50 focus:outline-none focus:border-[#EA601F] focus:ring-1 focus:ring-[#EA601F] transition-all font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-[10px] font-bold text-[#005259] uppercase tracking-widest shrink-0">
              Filtrer par page :
            </span>
            <select
              value={selectedPageFilter}
              onChange={(e) => setSelectedPageFilter(e.target.value)}
              className="bg-[#F3F3F2] border border-[#404040]/10 rounded-xl px-3 py-2 text-xs font-bold text-[#005259] outline-none focus:border-[#EA601F] transition-all cursor-pointer w-full md:w-64"
            >
              <option value="all">Toutes les pages</option>
              {PAGES_CATALOG.map((page) => (
                <option key={page.pageName} value={page.pageName}>{page.pageName}</option>
              ))}
            </select>
          </div>
        </div>

        {!matrixLoaded ? (
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-12 text-center text-[#404040]/70 text-xs font-bold uppercase tracking-wider shadow-sm">
            Chargement de la matrice de droits...
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPages.length > 0 ? (
              filteredPages.map((page) => {
                const PageIcon = ICONS_BY_PAGE_ID[page.pageId] || DEFAULT_ICON;
                return (
                  <div key={page.pageName} className="bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
                    {/* En-tête de Section Carte */}
                    <div className="p-4 border-b border-[#404040]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F3F3F2]/60">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl border border-[#005259]/20 bg-white text-[#EA601F]">
                          <PageIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold uppercase text-[#005259] tracking-tight">
                            {page.pageName}
                          </h2>
                          <span className="text-[11px] font-mono text-[#404040]/70">{page.route} • {page.filePath}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tableau du Contenu */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                            <th className="py-3 px-6 w-1/3">Élément / Action</th>
                            <th className="py-3 px-4 text-center w-28">Type</th>
                            {ROLES.map((role) => (
                              <th key={role.id} className="py-3 px-4 text-center w-24">{role.nom}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#404040]/10">
                          {page.actions.map((action) => (
                            <tr key={action.id} className="hover:bg-[#F3F3F2]/50 transition-colors group">
                              <td className="py-3.5 px-6">
                                <span className="block text-xs font-bold text-[#005259] group-hover:text-[#EA601F] transition-colors">{action.nom}</span>
                                <span className="block text-xs text-[#404040]/80 font-medium mt-0.5">{action.description}</span>
                                <span className="inline-block text-[10px] font-mono text-[#404040]/50 mt-1">{action.id}</span>
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                <span className="inline-block text-[10px] font-mono font-bold bg-[#005259]/10 border border-[#005259]/20 px-2.5 py-1 rounded-md text-[#005259] uppercase">
                                  {action.type}
                                </span>
                              </td>

                              {ROLES.map((role) => {
                                const estCoche = resolvePermission(matrix, role.id, action.id);
                                return (
                                  <td key={role.id} className="py-3.5 px-4 text-center">
                                    <button
                                      type="button"
                                      disabled={role.id === "admin"}
                                      onClick={() => handleCheckboxChange(action.id, role.id, !estCoche)}
                                      className={`p-1.5 rounded-xl border transition-all inline-flex items-center justify-center ${
                                        role.id === "admin" ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                                      } ${
                                        estCoche
                                          ? "bg-[#EA601F]/15 border-[#EA601F]/40 text-[#EA601F] hover:bg-[#EA601F]/25"
                                          : "bg-[#F3F3F2] border-[#404040]/10 text-[#404040]/30 hover:text-[#404040]/60"
                                      }`}
                                    >
                                      {estCoche ? (
                                        <CheckCircleIcon className="w-5 h-5" />
                                      ) : (
                                        <XCircleIcon className="w-5 h-5" />
                                      )}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white border border-[#404040]/10 rounded-2xl p-12 text-center text-[#404040]/70 text-xs font-bold uppercase tracking-wider shadow-sm">
                🔍 Aucun résultat pour ce filtre ou cette recherche.
              </div>
            )}
          </div>
        )}

      </div>
    </main>
    </PageGuard>
  );
}

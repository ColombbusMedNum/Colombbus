"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { parserCSV, devinerColonneNom, importerProspects } from "@/lib/prospections";

export default function ImporterProspectionsPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomFichier, setNomFichier] = useState("");
  const [entetes, setEntetes] = useState<string[]>([]);
  const [lignes, setLignes] = useState<Record<string, string>[]>([]);
  const [colonneNom, setColonneNom] = useState("");
  const [erreur, setErreur] = useState("");
  const [importEnCours, setImportEnCours] = useState(false);

  const lireFichier = (fichier: File) => {
    setErreur("");
    setNomFichier(fichier.name);
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const texte = String(lecteur.result || "");
      const { entetes: e, lignes: l } = parserCSV(texte);
      if (e.length === 0 || l.length === 0) {
        setErreur("Le fichier semble vide ou n'a pas pu être lu comme un CSV.");
        return;
      }
      setEntetes(e);
      setLignes(l);
      setColonneNom(devinerColonneNom(e));
    };
    lecteur.onerror = () => setErreur("Impossible de lire ce fichier.");
    lecteur.readAsText(fichier, "utf-8");
  };

  const confirmer = async () => {
    if (!colonneNom || lignes.length === 0 || importEnCours) return;
    setImportEnCours(true);
    try {
      await importerProspects(lignes, colonneNom);
      router.push("/mediation/prospections");
    } catch {
      setErreur("Une erreur est survenue pendant l'import — réessaie.");
    } finally {
      setImportEnCours(false);
    }
  };

  return (
    <PageGuard pageId="page_access_prospections">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-4xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Importer des <span className="text-[#EA601F] font-semibold">prospects</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Fichier CSV — une ligne par prospect, toutes les colonnes sont conservées</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <Link href="/mediation/prospections" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Retour</span>
              </Link>
              <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

          {entetes.length === 0 ? (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full bg-white border-2 border-dashed border-[#404040]/20 hover:border-[#005259]/40 rounded-2xl p-12 flex flex-col items-center gap-3 text-center transition-colors cursor-pointer"
            >
              <ArrowUpTrayIcon className="w-8 h-8 text-[#005259]" />
              <span className="text-sm font-bold text-[#005259]">Choisir un fichier CSV</span>
              <span className="text-[11px] text-[#404040]/50">La première ligne doit contenir les en-têtes de colonnes</span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && lireFichier(e.target.files[0])}
              />
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
                <p className="text-xs font-bold text-[#005259]">{nomFichier} — {lignes.length} ligne{lignes.length > 1 ? "s" : ""}, {entetes.length} colonne{entetes.length > 1 ? "s" : ""}</p>
                <label className="flex items-center gap-2 text-xs font-medium text-[#404040]/70">
                  Colonne à utiliser comme nom du prospect :
                  <select value={colonneNom} onChange={(e) => setColonneNom(e.target.value)} className="px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none">
                    {entetes.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </label>
              </div>

              <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#F3F3F2]">
                      <tr className="border-b border-[#404040]/10">
                        {entetes.map((e) => (
                          <th key={e} className={`text-left font-extrabold uppercase tracking-wide px-3 py-2 whitespace-nowrap ${e === colonneNom ? "text-[#EA601F]" : "text-[#005259]"}`}>{e}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.slice(0, 20).map((ligne, i) => (
                        <tr key={i} className="border-b border-[#404040]/5 last:border-0">
                          {entetes.map((e) => (
                            <td key={e} className="px-3 py-2 text-[#404040]/80 whitespace-nowrap max-w-[220px] truncate">{ligne[e] || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {lignes.length > 20 && (
                  <p className="text-center text-[10px] text-[#404040]/40 py-2 border-t border-[#404040]/5">… et {lignes.length - 20} ligne{lignes.length - 20 > 1 ? "s" : ""} de plus</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button onClick={confirmer} disabled={!colonneNom || importEnCours} className="flex items-center gap-2 bg-[#005259] hover:bg-[#EA601F] disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
                  {importEnCours ? "Import en cours..." : `Importer ${lignes.length} fiche${lignes.length > 1 ? "s" : ""}`}
                </button>
                <button onClick={() => { setEntetes([]); setLignes([]); setNomFichier(""); }} className="px-4 py-2.5 bg-white border border-[#404040]/10 text-[#404040]/70 rounded-xl text-xs font-bold uppercase tracking-wide hover:border-[#404040]/30 transition-colors cursor-pointer">
                  Changer de fichier
                </button>
              </div>
            </div>
          )}

          {erreur && <p className="text-xs font-bold text-[#EF736A]">{erreur}</p>}
        </div>
      </main>
    </PageGuard>
  );
}

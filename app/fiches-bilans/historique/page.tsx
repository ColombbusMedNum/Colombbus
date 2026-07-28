"use client";

import { useEffect, useState, Suspense } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  ChevronLeftIcon, 
  MapPinIcon, 
  CalendarIcon, 
  FolderIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserIcon
} from "@heroicons/react/24/outline";

interface InterventionDetail {
  date: string;
  mediateur: string;
  details: string;
}

interface FicheBilanSaved {
  id: string;
  lieu: string;
  mois: string;
  atelier: string;
  intervenant?: string;
  commentaireGeneral: string;
  interventions?: InterventionDetail[];
  savedAt?: string;
}

function HistoriqueContent() {
  const searchParams = useSearchParams();
  const paramLieu = searchParams.get("lieu");
  const paramMois = searchParams.get("mois");

  const [fiches, setFiches] = useState<FicheBilanSaved[]>([]);
  const [loading, setLoading] = useState(true);

  const [fichesOuvertes, setFichesOuvertes] = useState<Record<string, boolean>>({});

  // Filtres initialisés avec les paramètres d'URL s'ils existent
  const [recherche, setRecherche] = useState("");
  const [lieuFiltre, setLieuFiltre] = useState(paramLieu || "Tous");
  const [moisFiltre, setMoisFiltre] = useState(paramMois || "Tous");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "fiches_bilans"), (snapshot) => {
      const data: FicheBilanSaved[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<FicheBilanSaved, "id">)
      }));

      data.sort((a, b) => (b.mois || "").localeCompare(a.mois || ""));

      setFiches(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const toggleDetails = (ficheId: string) => {
    setFichesOuvertes((prev) => ({
      ...prev,
      [ficheId]: !prev[ficheId]
    }));
  };

  const listeLieux = Array.from(new Set(fiches.map((f) => f.lieu || "Non spécifié"))).sort();
  const listeMois = Array.from(new Set(fiches.map((f) => f.mois || ""))).sort().reverse();

  const fichesFiltrees = fiches.filter((f) => {
    const terme = recherche.toLowerCase();
    
    const matchInterventions = f.interventions?.some(i => 
      (i.details || "").toLowerCase().includes(terme) ||
      (i.mediateur || "").toLowerCase().includes(terme)
    );

    const matchTexte = 
      (f.lieu || "").toLowerCase().includes(terme) ||
      (f.intervenant || "").toLowerCase().includes(terme) ||
      (f.atelier || "").toLowerCase().includes(terme) ||
      (f.commentaireGeneral || "").toLowerCase().includes(terme) ||
      Boolean(matchInterventions);

    const matchLieu = lieuFiltre === "Tous" || f.lieu === lieuFiltre;
    const matchMois = moisFiltre === "Tous" || f.mois === moisFiltre;

    return matchTexte && matchLieu && matchMois;
  });

  const formatMoisTexte = (moisStr: string) => {
    if (!moisStr) return "";
    const [year, month] = moisStr.split("-");
    if (!year || !month) return moisStr;
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold animate-pulse">
        Chargement de l'historique des fiches...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* NAV & ENTÊTE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <Link 
              href={`/fiches-bilans${lieuFiltre !== "Tous" || moisFiltre !== "Tous" ? `?lieu=${encodeURIComponent(lieuFiltre)}&mois=${moisFiltre}` : ""}`}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors group text-xs font-bold uppercase tracking-widest mb-2"
            >
              <ChevronLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Retour à l'édition des fiches</span>
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic flex items-center gap-3">
              <FolderIcon className="w-8 h-8 text-emerald-500 not-italic" />
              <span>Archives <span className="text-emerald-500 not-italic">Fiches Bilans</span></span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Retrouvez l'ensemble des fiches sauvegardées et le détail complet de chaque intervention.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800 self-start sm:self-auto">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sauvegardées :</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{fichesFiltrees.length}</span>
            <span className="text-xs text-slate-500">Fiche(s)</span>
          </div>
        </div>

        {/* BARRE DE RECHERCHE ET FILTRES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Chercher médiateur, détails, atelier, lieu..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 outline-none transition-all"
            />
          </div>

          <div className="relative">
            <CalendarIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={moisFiltre}
              onChange={(e) => setMoisFiltre(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 outline-none transition-all appearance-none"
            >
              <option value="Tous">📅 Tous les mois ({listeMois.length})</option>
              {listeMois.map((m) => (
                <option key={m} value={m}>
                  {formatMoisTexte(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <FunnelIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={lieuFiltre}
              onChange={(e) => setLieuFiltre(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 outline-none transition-all appearance-none"
            >
              <option value="Tous">📍 Tous les lieux ({listeLieux.length})</option>
              {listeLieux.map((lieu) => (
                <option key={lieu} value={lieu}>
                  {lieu}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* LISTE DES FICHES */}
        {fichesFiltrees.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 font-mono text-xs">
            Aucune fiche bilan enregistrée ne correspond à vos critères.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {fichesFiltrees.map((fiche) => {
              const detailsOuverts = fichesOuvertes[fiche.id] || false;
              const nbInterventions = fiche.interventions?.length || 0;

              return (
                <article 
                  key={fiche.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">
                          {fiche.lieu}
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono font-bold bg-slate-950 border border-slate-800 text-emerald-400 px-3 py-1 rounded-full capitalize">
                        {formatMoisTexte(fiche.mois)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                      <p className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold uppercase text-[10px] w-24">Atelier :</span>
                        <span className="font-semibold text-slate-200">{fiche.atelier || "Permanence Numérique"}</span>
                      </p>
                      {fiche.intervenant && (
                        <p className="flex items-center gap-2">
                          <span className="text-slate-500 font-bold uppercase text-[10px] w-24">Intervenant :</span>
                          <span className="font-semibold text-slate-200">{fiche.intervenant}</span>
                        </p>
                      )}
                    </div>

                    {fiche.commentaireGeneral && (
                      <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Commentaire général :</p>
                        <p className="text-xs text-slate-300 italic leading-relaxed">
                          « {fiche.commentaireGeneral} »
                        </p>
                      </div>
                    )}

                    {nbInterventions > 0 && (
                      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
                        <button
                          onClick={() => toggleDetails(fiche.id)}
                          className="w-full flex items-center justify-between p-3 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                        >
                          <span className="flex items-center gap-2 uppercase text-[10px] tracking-wider text-emerald-400">
                            <UserIcon className="w-4 h-4" />
                            Voir les interventions ({nbInterventions})
                          </span>
                          {detailsOuverts ? (
                            <ChevronUpIcon className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {detailsOuverts && (
                          <div className="border-t border-slate-800 overflow-x-auto p-3">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                  <th className="py-2 px-3 w-20 border-r border-slate-800/60">Date</th>
                                  <th className="py-2 px-3 w-36 border-r border-slate-800/60">Médiateur</th>
                                  <th className="py-2 px-3">Détails / Commentaires</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {fiche.interventions?.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400 whitespace-nowrap border-r border-slate-800/60 align-top">
                                      {formatShortDate(item.date)}
                                    </td>
                                    <td className="py-2.5 px-3 font-semibold text-indigo-300 whitespace-nowrap border-r border-slate-800/60 align-top">
                                      {item.mediateur}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-300 leading-relaxed align-top">
                                      {item.details}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-mono text-[10px]">
                      {fiche.savedAt ? `Sauvegardé le ${new Date(fiche.savedAt).toLocaleDateString('fr-FR')}` : ""}
                    </span>

                    <Link 
                      href={`/fiches-bilans?lieu=${encodeURIComponent(fiche.lieu)}&mois=${fiche.mois}`}
                      className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider text-[10px] transition-colors"
                    >
                      <span>Ouvrir dans l'éditeur</span>
                      <DocumentTextIcon className="w-4 h-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}

export default function HistoriqueFichesBilansPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold">Chargement...</div>}>
      <HistoriqueContent />
    </Suspense>
  );
}
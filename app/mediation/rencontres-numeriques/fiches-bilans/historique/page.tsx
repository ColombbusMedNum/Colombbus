"use client";

import { useEffect, useState, Suspense } from "react";
import { db } from "@/lib/firebase";
import PageGuard from "@/components/PageGuard";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { quicksand } from "@/lib/fonts";
import {
  ArrowLeftIcon,
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

  // Chargement unique : vue d'archive/historique en lecture seule, une
  // écoute temps réel permanente n'apporte rien ici.
  useEffect(() => {
    getDocs(collection(db, "fiches_bilans")).then((snapshot) => {
      const data: FicheBilanSaved[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<FicheBilanSaved, "id">)
      }));

      data.sort((a, b) => (b.mois || "").localeCompare(a.mois || ""));

      setFiches(data);
      setLoading(false);
    });
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
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement de l'historique des fiches...
      </div>
    );
  }

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      
      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        
        {/* NAV & ENTÊTE */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <Link
                href={`/mediation/rencontres-numeriques/fiches-bilans${lieuFiltre !== "Tous" || moisFiltre !== "Tous" ? `?lieu=${encodeURIComponent(lieuFiltre)}&mois=${moisFiltre}` : ""}`}
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm mb-0.5"
              >
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Retour à l'édition des fiches</span>
              </Link>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Archives <span className="text-[#EA601F] font-normal">Fiches Bilans</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5">
                Retrouvez l'ensemble des fiches sauvegardées et le détail complet de chaque intervention
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-[#404040]/10 shadow-sm self-start lg:self-auto">
            <span className="text-xs font-bold text-[#404040]/70 uppercase tracking-wider">Sauvegardées :</span>
            <span className="text-base font-bold text-[#005259]">{fichesFiltrees.length}</span>
            <span className="text-xs font-medium text-[#404040]/60">Fiche(s)</span>
          </div>
        </div>

        {/* BARRE DE RECHERCHE ET FILTRES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-[#404040]/10 shadow-sm">
          <div className="relative group">
            <MagnifyingGlassIcon className="w-4 h-4 text-[#404040]/40 group-focus-within:text-[#005259] transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Chercher médiateur, détails, atelier, lieu..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-full bg-white border border-[#404040]/15 rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all font-medium shadow-sm"
            />
          </div>

          <div className="relative">
            <CalendarIcon className="w-4 h-4 text-[#EA601F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={moisFiltre}
              onChange={(e) => setMoisFiltre(e.target.value)}
              className="w-full bg-white border border-[#404040]/15 rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#404040] focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all font-medium shadow-sm cursor-pointer"
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
            <FunnelIcon className="w-4 h-4 text-[#EA601F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={lieuFiltre}
              onChange={(e) => setLieuFiltre(e.target.value)}
              className="w-full bg-white border border-[#404040]/15 rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#404040] focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all font-medium shadow-sm cursor-pointer"
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
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-12 text-center text-[#404040]/60 text-xs font-bold uppercase tracking-wider">
            🔍 Aucune fiche bilan enregistrée ne correspond à vos critères.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {fichesFiltrees.map((fiche) => {
              const detailsOuverts = fichesOuvertes[fiche.id] || false;
              const nbInterventions = fiche.interventions?.length || 0;

              return (
                <article 
                  key={fiche.id}
                  className="bg-white border border-[#404040]/10 rounded-2xl p-5 md:p-6 shadow-sm hover:border-[#005259]/30 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start border-b border-[#404040]/10 pb-3">
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="w-5 h-5 text-[#EA601F] shrink-0" />
                        <h3 className="text-base md:text-lg font-bold text-[#005259] uppercase tracking-tight">
                          {fiche.lieu}
                        </h3>
                      </div>
                      <span className="text-[11px] font-bold bg-[#005259]/10 text-[#005259] border border-[#005259]/20 px-3 py-1 rounded-xl capitalize">
                        {formatMoisTexte(fiche.mois)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#404040]">
                      <p className="flex items-center gap-2">
                        <span className="text-[#404040]/60 font-bold uppercase text-[10px] w-24">Atelier :</span>
                        <span className="font-semibold text-[#005259]">{fiche.atelier || "Permanence Numérique"}</span>
                      </p>
                      {fiche.intervenant && (
                        <p className="flex items-center gap-2">
                          <span className="text-[#404040]/60 font-bold uppercase text-[10px] w-24">Intervenant :</span>
                          <span className="font-semibold text-[#404040]">{fiche.intervenant}</span>
                        </p>
                      )}
                    </div>

                    {fiche.commentaireGeneral && (
                      <div className="bg-[#F3F3F2] border border-[#404040]/10 p-3.5 rounded-xl">
                        <p className="text-[10px] font-bold text-[#005259] uppercase tracking-wider mb-1">Commentaire général :</p>
                        <p className="text-xs text-[#404040] italic leading-relaxed">
                          « {fiche.commentaireGeneral} »
                        </p>
                      </div>
                    )}

                    {nbInterventions > 0 && (
                      <div className="border border-[#404040]/10 rounded-xl overflow-hidden bg-[#F3F3F2]/40">
                        <button
                          onClick={() => toggleDetails(fiche.id)}
                          className="w-full flex items-center justify-between p-3 text-xs font-bold text-[#005259] hover:bg-[#F3F3F2] transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2 uppercase text-[10px] tracking-wider text-[#005259]">
                            <UserIcon className="w-4 h-4 text-[#EA601F]" />
                            Voir les interventions ({nbInterventions})
                          </span>
                          {detailsOuverts ? (
                            <ChevronUpIcon className="w-4 h-4 text-[#404040]/60" />
                          ) : (
                            <ChevronDownIcon className="w-4 h-4 text-[#404040]/60" />
                          )}
                        </button>

                        {detailsOuverts && (
                          <div className="border-t border-[#404040]/10 overflow-x-auto p-3 bg-white">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-[#404040]/10 bg-[#F3F3F2] text-[#005259] uppercase tracking-widest text-[10px] font-bold">
                                  <th className="py-2.5 px-3 w-20 border-r border-[#404040]/10">Date</th>
                                  <th className="py-2.5 px-3 w-36 border-r border-[#404040]/10">Médiateur</th>
                                  <th className="py-2.5 px-3">Détails / Commentaires</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#404040]/5">
                                {fiche.interventions?.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-[#F3F3F2]/60 transition-colors">
                                    <td className="py-2.5 px-3 font-bold text-[#005259] whitespace-nowrap border-r border-[#404040]/10 align-top">
                                      {formatShortDate(item.date)}
                                    </td>
                                    <td className="py-2.5 px-3 font-semibold text-[#404040] whitespace-nowrap border-r border-[#404040]/10 align-top">
                                      {item.mediateur}
                                    </td>
                                    <td className="py-2.5 px-3 text-[#404040] leading-relaxed align-top">
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

                  <div className="pt-3 border-t border-[#404040]/10 flex items-center justify-between text-[11px]">
                    <span className="text-[#404040]/60 font-medium text-[10px]">
                      {fiche.savedAt ? `Sauvegardé le ${new Date(fiche.savedAt).toLocaleDateString('fr-FR')}` : ""}
                    </span>

                    <Link 
                      href={`/mediation/rencontres-numeriques/fiches-bilans?lieu=${encodeURIComponent(fiche.lieu)}&mois=${fiche.mois}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#005259] hover:bg-[#EA601F] text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      <span>Ouvrir dans l'éditeur</span>
                      <DocumentTextIcon className="w-3.5 h-3.5" />
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
    <PageGuard pageId="page_access_fiches_bilans_historique">
    <Suspense fallback={
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold uppercase tracking-widest text-xs`}>
        Chargement...
      </div>
    }>
      <HistoriqueContent />
    </Suspense>
    </PageGuard>
  );
}
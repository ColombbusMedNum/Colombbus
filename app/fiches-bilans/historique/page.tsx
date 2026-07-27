"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { 
  ChevronLeftIcon, 
  MapPinIcon, 
  CalendarIcon, 
  FolderIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  UserIcon
} from "@heroicons/react/24/outline";

interface FicheBilanSaved {
  id: string; // Ex: "NomDuLieu_2026-01"
  lieu: string;
  mois: string; // Ex: "2026-01"
  atelier: string;
  intervenant: string;
  commentaireGeneral: string;
  savedAt?: string;
}

export default function HistoriqueFichesBilansPage() {
  const [fiches, setFiches] = useState<FicheBilanSaved[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [recherche, setRecherche] = useState("");
  const [lieuFiltre, setLieuFiltre] = useState("Tous");
  const [moisFiltre, setMoisFiltre] = useState("Tous");

  // Écoute directe de la collection `fiches_bilans`
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "fiches_bilans"), (snapshot) => {
      const data: FicheBilanSaved[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<FicheBilanSaved, "id">)
      }));

      // Tri par mois décroissant (du plus récent au plus ancien)
      data.sort((a, b) => (b.mois || "").localeCompare(a.mois || ""));

      setFiches(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Liste des filtres uniques
  const listeLieux = Array.from(new Set(fiches.map((f) => f.lieu || "Non spécifié"))).sort();
  const listeMois = Array.from(new Set(fiches.map((f) => f.mois || ""))).sort().reverse();

  // Application des filtres
  const fichesFiltrees = fiches.filter((f) => {
    const terme = recherche.toLowerCase();
    const matchTexte = 
      (f.lieu || "").toLowerCase().includes(terme) ||
      (f.intervenant || "").toLowerCase().includes(terme) ||
      (f.atelier || "").toLowerCase().includes(terme) ||
      (f.commentaireGeneral || "").toLowerCase().includes(terme);

    const matchLieu = lieuFiltre === "Tous" || f.lieu === lieuFiltre;
    const matchMois = moisFiltre === "Tous" || f.mois === moisFiltre;

    return matchTexte && matchLieu && matchMois;
  });

  // Formater le mois "YYYY-MM" en texte lisible (Ex: "Janvier 2026")
  const formatMoisTexte = (moisStr: string) => {
    if (!moisStr) return "";
    const [year, month] = moisStr.split("-");
    if (!year || !month) return moisStr;
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
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
              href="/fiches-bilans" 
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
              Retrouvez l'ensemble des fiches sauvegardées au fil des mois.
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
          {/* Recherche textuelle */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Chercher intervenant, atelier, lieu..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 outline-none transition-all"
            />
          </div>

          {/* Filtre par Mois */}
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

          {/* Filtre par Lieu */}
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

        {/* LISTE DES FICHES RETROUVÉES */}
        {fichesFiltrees.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 font-mono text-xs">
            Aucune fiche bilan enregistrée ne correspond à vos critères.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fichesFiltrees.map((fiche) => (
              <article 
                key={fiche.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Header Carte */}
                  <div className="flex justify-between items-start border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                      <h3 className="text-base font-black text-white uppercase tracking-tight">
                        {fiche.lieu}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-emerald-400 px-2.5 py-1 rounded-full capitalize">
                      {formatMoisTexte(fiche.mois)}
                    </span>
                  </div>

                  {/* Métadonnées de la fiche */}
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <p className="flex items-center gap-2">
                      <span className="text-slate-500 font-bold uppercase text-[10px] w-24">Atelier :</span>
                      <span className="font-semibold text-slate-200">{fiche.atelier || "Permanence Numérique"}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-slate-500 font-bold uppercase text-[10px] w-24">Intervenant :</span>
                      <span className="font-semibold text-slate-200">{fiche.intervenant || "Non précisé"}</span>
                    </p>
                  </div>

                  {/* Commentaire général */}
                  {fiche.commentaireGeneral && (
                    <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Commentaire général :</p>
                      <p className="text-xs text-slate-300 italic leading-relaxed">
                        « {fiche.commentaireGeneral} »
                      </p>
                    </div>
                  )}
                </div>

                {/* Pied de carte avec lien direct pour ouvrir/éditer */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-mono text-[10px]">
                    {fiche.savedAt ? `Sauvegardé le ${new Date(fiche.savedAt).toLocaleDateString('fr-FR')}` : ""}
                  </span>

                  <Link 
                    href={`/fiches-bilans?lieu=${encodeURIComponent(fiche.lieu)}&mois=${fiche.mois}`}
                    className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider text-[10px] transition-colors"
                  >
                    <span>Ouvrir la fiche</span>
                    <DocumentTextIcon className="w-4 h-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
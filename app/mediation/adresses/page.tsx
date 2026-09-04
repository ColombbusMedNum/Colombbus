"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import { 
  MapPinIcon, 
  ArrowLeftIcon, 
  ClockIcon, 
  CalendarDaysIcon, 
  ArrowTopRightOnSquareIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import PageGuard from "@/components/PageGuard";

export default function ListeAdresses() {
  const [lieuxUniques, setLieuxUniques] = useState<string[]>([]);
  const [toutesLesAdresses, setToutesLesAdresses] = useState<any[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [loadingAdresses, setLoadingAdresses] = useState(true);

  // 1. Écouter les actions planifiées chez les médiateurs pour la semaine en cours
  useEffect(() => {
    // Calculer le lundi (début) et le dimanche (fin) de la semaine en cours
    const aujourdhui = new Date();

    // Trouver le lundi de la semaine actuelle
    const jourCourant = aujourdhui.getDay();
    const differenceLundi = jourCourant === 0 ? -6 : 1 - jourCourant;
    const lundi = new Date(aujourdhui);
    lundi.setDate(aujourdhui.getDate() + differenceLundi);
    lundi.setHours(0, 0, 0, 0);

    // Trouver le dimanche de la semaine actuelle
    const dimanche = new Date(lundi);
    dimanche.setDate(lundi.getDate() + 6);
    dimanche.setHours(23, 59, 59, 999);

    // Formater au format standard YYYY-MM-DD utilisé dans 'planning_mediateurs'
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const dateDebutStr = formatDate(lundi);
    const dateFinStr = formatDate(dimanche);

    const qActions = query(
      collection(db, "planning_mediateurs"),
      where("date", ">=", dateDebutStr),
      where("date", "<=", dateFinStr)
    );

    const unsubActions = onSnapshot(qActions, (snapActions) => {
      const listeLieuxPlanifies = snapActions.docs.map(d => d.data().lieu).filter(Boolean);
      setLieuxUniques(Array.from(new Set(listeLieuxPlanifies)));
      setLoadingActions(false);
    });

    return () => unsubActions();
  }, []);

  // 2. Écouter le référentiel des adresses (activites_types), indépendamment du planning
  useEffect(() => {
    const unsubAdresses = onSnapshot(collection(db, "activites_types"), (snapActs) => {
      setToutesLesAdresses(snapActs.docs.map(d => ({ id: d.id, ...d.data() as any })));
      setLoadingAdresses(false);
    });

    return () => unsubAdresses();
  }, []);

  const loading = loadingActions || loadingAdresses;

  // 3. Ne garder que les modèles dont le lieu est actif dans le planning de la semaine
  const lieuxSemaine = React.useMemo(() => {
    if (lieuxUniques.length === 0) return [];

    const adressesFiltrees = toutesLesAdresses.filter(act =>
      lieuxUniques.some(lieuPlanifie => lieuPlanifie.toLowerCase().trim() === act.lieu?.toLowerCase().trim())
    );

    adressesFiltrees.sort((a, b) => a.lieu.localeCompare(b.lieu));
    return adressesFiltrees;
  }, [lieuxUniques, toutesLesAdresses]);

  return (
    <PageGuard pageId="page_access_adresses">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-3xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE AVEC RETOUR VERS L'AGENDA */}
        <div className="flex items-center justify-between pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#EA601F] rounded-full shadow-[0_0_15px_rgba(234,96,31,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-black uppercase text-[#005259] tracking-tight">
                Lieux de la <span className="text-[#EA601F] font-bold">semaine</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 flex items-center gap-1.5 font-medium">
                <CalendarDaysIcon className="w-3.5 h-3.5 text-[#EA601F]" />
                Adresses des activités planifiées sur le planning général cette semaine
              </p>
            </div>
          </div>

          <Link
            href="/agenda"
            className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
          >
            <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
            <span className="hidden sm:inline">Retour à l'Agenda</span>
          </Link>
        </div>

        {/* LISTE DES LIEUX FILTRÉS */}
        {loading ? (
          <div className="text-center py-16 text-[#EA601F] font-bold text-xs animate-pulse uppercase tracking-widest">
            Chargement des adresses de la semaine...
          </div>
        ) : (
          <div className="grid gap-4">
            {lieuxSemaine.map((act) => {
              const aUneAdresseValide = act.adresse && act.adresse !== "-";
              
              // N'utilise que l'adresse exacte (sans le nom du lieu devant) : le nom
              // fausse parfois la géolocalisation vers un point différent de la
              // véritable adresse postale.
              const googleMapsUrl = aUneAdresseValide
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.adresse)}`
                : null;

              return (
                <div 
                  key={act.id} 
                  className="p-5 bg-white border border-[#404040]/10 rounded-2xl flex items-start gap-4 shadow-sm hover:border-[#005259] transition-all group"
                >
                  {/* ICON ÉPINGLE UNIQUE OU CLIQUABLE GOOGLE MAPS */}
                  {googleMapsUrl ? (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ouvrir dans Google Maps"
                      className="p-3 bg-[#F3F3F2] border border-[#404040]/10 hover:border-[#EA601F] rounded-xl text-[#EA601F] shrink-0 transition-all active:scale-95 relative group/icon shadow-inner cursor-pointer"
                    >
                      <MapPinIcon className="w-6 h-6 shrink-0 group-hover/icon:scale-110 transition-transform" />
                      {/* Petit badge d'indication au survol de l'icône */}
                      <span className="absolute -top-1 -right-1 bg-white border border-[#404040]/15 text-[#005259] p-0.5 rounded-md opacity-0 group-hover/icon:opacity-100 transition-opacity scale-75 shadow-sm">
                        <ArrowTopRightOnSquareIcon className="w-2.5 h-2.5 text-[#EA601F]" />
                      </span>
                    </a>
                  ) : (
                    <div 
                      className="p-3 bg-[#F3F3F2] border border-[#404040]/10 text-[#404040]/40 rounded-xl shrink-0"
                    >
                      <MapPinIcon className="w-6 h-6 shrink-0" />
                    </div>
                  )}
                  
                  {/* TEXTES ET INFOS */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3 className="font-extrabold text-base text-[#005259] uppercase tracking-wide group-hover:text-[#EA601F] transition-colors truncate">
                        {act.lieu}
                        {act.territoire && (
                          <span className="ml-2 font-bold text-[10px] lowercase bg-[#F3F3F2] border border-[#404040]/10 px-2 py-0.5 rounded-lg text-[#404040]/70">
                            dept {act.territoire}
                          </span>
                        )}
                      </h3>
                      
                      {act.debut && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#EA601F] bg-[#F3F3F2] border border-[#404040]/10 px-2.5 py-1 rounded-lg uppercase tracking-wider self-start sm:self-center font-mono">
                          <ClockIcon className="w-3.5 h-3.5 text-[#EA601F] shrink-0" /> 
                          <span>{act.debut} — {act.fin}</span>
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-[#404040]/70 font-medium mt-1.5 leading-relaxed">
                      {aUneAdresseValide ? act.adresse : "Aucune adresse postale enregistrée pour ce modèle"}
                    </p>
                  </div>

                </div>
              );
            })}

            {/* CAS VIDE : AUCUN LIEU CETTE SEMAINE */}
            {lieuxSemaine.length === 0 && (
              <div className="text-center py-16 border border-dashed border-[#404040]/15 rounded-2xl text-xs font-bold uppercase tracking-wider text-[#404040]/60 bg-white shadow-sm">
                🔍 Aucun lieu d'activité n'est assigné dans le planning pour la semaine en cours.
              </div>
            )}
          </div>
        )}

      </div>
    </main>
    </PageGuard>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { useMediateurs } from "@/lib/MediateursProvider";
import { estActionDuMediateur } from "@/lib/matchMediateur";
import { getJoursFeries } from "@/lib/activitesTypes";
import type { Mediateur, ActionPlanning } from "@/lib/types";

const JOURS_SEMAINE = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Vue mensuelle complète du planning d'un seul médiateur, choisi dans un
// sélecteur — complémentaire à la grille hebdomadaire de /agenda, qui montre
// tout le monde mais une semaine à la fois.
export default function VueMoisAgendaPage() {
  const { mediateurs: mediateursBruts } = useMediateurs();
  const { role, user } = usePermissions();
  // Un compte en rôle ACI (consultation uniquement) ne doit voir que son
  // propre planning mensuel, jamais celui des autres — même restriction que
  // /mediation/statistiques pour les rôles non-admin.
  const estModeACI = role === "aci";

  const mediateurs = useMemo(() => {
    return ([...(mediateursBruts as Mediateur[])])
      .filter((m) => m.actif !== false && (m.prenom || m.nom) && m.statut !== "Formateur")
      .sort((a, b) => `${a.prenom || ""} ${a.nom || ""}`.localeCompare(`${b.prenom || ""} ${b.nom || ""}`, "fr"));
  }, [mediateursBruts]);

  const [selectedMedId, setSelectedMedId] = useState<string>("");
  const [viewDate, setViewDate] = useState(new Date());
  const [actions, setActions] = useState<ActionPlanning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mediateurs.length === 0 || selectedMedId) return;

    if (estModeACI) {
      const maFiche = mediateurs.find((m) => m.email?.toLowerCase() === user?.email?.toLowerCase());
      if (maFiche) setSelectedMedId(maFiche.id);
      return;
    }

    setSelectedMedId(mediateurs[0].id);
  }, [mediateurs, selectedMedId, estModeACI, user]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  useEffect(() => {
    const debut = new Date(year, month, 1).toLocaleDateString("en-CA");
    const fin = new Date(year, month + 1, 0).toLocaleDateString("en-CA");
    const q = query(collection(db, "planning_mediateurs"), where("date", ">=", debut), where("date", "<=", fin));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setActions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setLoading(false);
      },
      (error) => {
        console.error("Erreur de chargement du planning mensuel :", error);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [year, month]);

  const selectedMed = mediateurs.find((m) => m.id === selectedMedId);

  const actionsDuMediateur = useMemo(() => {
    if (!selectedMed) return [];
    return actions.filter((a) => estActionDuMediateur(a, selectedMed));
  }, [actions, selectedMed]);

  const joursFeries = useMemo(() => getJoursFeries(year), [year]);

  // Grille du mois, semaines de lundi à dimanche, avec cases vides en tête/fin.
  const premierJour = new Date(year, month, 1);
  const nbJoursMois = new Date(year, month + 1, 0).getDate();
  const decalage = (premierJour.getDay() + 6) % 7;

  const cellules: (Date | null)[] = useMemo(() => {
    const arr: (Date | null)[] = [
      ...Array.from({ length: decalage }, () => null),
      ...Array.from({ length: nbJoursMois }, (_, i) => new Date(year, month, i + 1)),
    ];
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month, decalage, nbJoursMois]);

  const actionsParJour = useMemo(() => {
    const map: Record<string, ActionPlanning[]> = Object.create(null);
    actionsDuMediateur.forEach((a) => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => (a.moment === "Matin" ? 0 : 1) - (b.moment === "Matin" ? 0 : 1))
    );
    return map;
  }, [actionsDuMediateur]);

  const aujourdHuiStr = new Date().toLocaleDateString("en-CA");

  return (
    <PageGuard pageId="page_access_agenda_mois">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-6xl mx-auto relative z-10 space-y-6">
          {/* EN-TÊTE */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#EA601F] rounded-full shadow-[0_0_15px_rgba(234,96,31,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-black uppercase text-[#005259] tracking-tight">
                  Vue <span className="text-[#EA601F] font-bold">Mois</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 flex items-center gap-1.5 font-medium">
                  <CalendarDaysIcon className="w-3.5 h-3.5 text-[#EA601F]" />
                  Planning complet d'un médiateur sur le mois
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/agenda"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span className="hidden sm:inline">Retour à l'Agenda</span>
              </Link>
              <Link
                href="/"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

          {/* SÉLECTEUR MÉDIATEUR + NAVIGATION MOIS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#404040]/10 rounded-xl p-3 shadow-sm">
            {estModeACI ? (
              <div className="px-3 py-2 bg-[#F3F3F2] border border-[#404040]/10 rounded-lg text-xs font-mono font-semibold text-[#005259] shadow-inner">
                🔒 {selectedMed ? `${selectedMed.prenom} ${selectedMed.nom}` : "Mon planning"}
              </div>
            ) : (
              <select
                value={selectedMedId}
                onChange={(e) => setSelectedMedId(e.target.value)}
                className="px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs font-bold text-[#005259] outline-none focus:border-[#005259] cursor-pointer"
              >
                {mediateurs.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.prenom} {m.nom}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="p-1.5 hover:bg-[#F3F3F2] rounded-lg text-[#005259] transition-all cursor-pointer border border-[#404040]/10"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="text-sm font-extrabold text-[#005259] uppercase tracking-wide min-w-[150px] text-center capitalize">
                {viewDate.toLocaleString("fr-FR", { month: "long", year: "numeric" })}
              </span>
              <button
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="p-1.5 hover:bg-[#F3F3F2] rounded-lg text-[#005259] transition-all cursor-pointer border border-[#404040]/10"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewDate(new Date())}
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#EA601F] hover:bg-[#F3F3F2] rounded-lg transition-all cursor-pointer"
              >
                Aujourd'hui
              </button>
            </div>
          </div>

          {/* GRILLE DU MOIS */}
          {loading ? (
            <div className="text-center py-16 text-[#EA601F] font-bold text-xs animate-pulse uppercase tracking-widest">
              Chargement...
            </div>
          ) : !selectedMed ? (
            <div className="text-center py-16 text-xs font-bold uppercase tracking-wider text-[#404040]/60">
              Aucun médiateur disponible.
            </div>
          ) : (
            <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-7 border-b-2 border-[#005259]">
                {JOURS_SEMAINE.map((j) => (
                  <div key={j} className="p-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#005259]">
                    {j}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cellules.map((date, index) => {
                  if (!date) {
                    return <div key={index} className="min-h-[110px] border-b border-r border-[#F3F3F2] bg-[#F3F3F2]/30"></div>;
                  }
                  const dateStr = date.toLocaleDateString("en-CA");
                  const estFerie = joursFeries.has(dateStr);
                  const estWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const estAujourdhui = dateStr === aujourdHuiStr;
                  const actionsJour = actionsParJour[dateStr] || [];

                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[110px] border-b border-r border-[#F3F3F2] p-1.5 flex flex-col gap-1 ${
                        estFerie ? "bg-[#EF736A]/5" : estWeekend ? "bg-[#F3F3F2]/40" : "bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[11px] font-bold ${
                            estAujourdhui
                              ? "bg-[#005259] text-white rounded-full w-5 h-5 flex items-center justify-center"
                              : estFerie
                              ? "text-[#EF736A]"
                              : "text-[#404040]/70"
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        {estFerie && <span className="text-[7px] font-black uppercase text-[#EF736A]">Férié</span>}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {actionsJour.map((a) => {
                          const hexColor = a.couleur || "#005259";
                          return (
                            <div
                              key={a.id}
                              title={`${a.moment || ""} — ${a.lieu || ""}${a.debut ? ` (${a.debut}-${a.fin})` : ""}`}
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded truncate border"
                              style={{ backgroundColor: `${hexColor}1A`, borderColor: hexColor, color: hexColor }}
                            >
                              {a.lieu}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </PageGuard>
  );
}

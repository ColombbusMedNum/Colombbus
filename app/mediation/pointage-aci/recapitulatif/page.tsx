"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, CalendarDaysIcon, ChevronDownIcon, ExclamationTriangleIcon, ClockIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { useMediateurs } from "@/lib/MediateursProvider";
import { estActionDuMediateur, type ActionAvecMediateur } from "@/lib/matchMediateur";
import {
  ecouterPointagesPeriode, ecouterGrillesHorairesACI, horairesNormauxDuJour,
  minutesRetard, minutesEnTrop, minutesReellementEnTrop, formaterMinutes,
  type PointageACI, type GrillesHorairesParSite,
} from "@/lib/pointageAci";

interface CreneauJour extends ActionAvecMediateur {
  date: string;
  lieu?: string;
}

function versISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parDefautDebut(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return versISODate(d);
}

interface DetailJour { date: string; arrivee?: string; depart?: string; retard: number; enTrop: number; netEnTrop: number; mission: string }
interface RecapAci { id: string; nom: string; prenom: string; joursPointes: number; totalRetard: number; totalEnTrop: number; totalNetEnTrop: number; details: DetailJour[] }

export default function RecapitulatifPointageAciPage() {
  const { mediateurs, loading: loadingMediateurs } = useMediateurs();
  const [dateDebut, setDateDebut] = useState(parDefautDebut());
  const [dateFin, setDateFin] = useState(versISODate(new Date()));
  const [pointages, setPointages] = useState<PointageACI[] | null>(null);
  const [grilles, setGrilles] = useState<GrillesHorairesParSite>({});
  const [creneauxPeriode, setCreneauxPeriode] = useState<CreneauJour[]>([]);
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());

  useEffect(() => ecouterPointagesPeriode(dateDebut, dateFin, setPointages), [dateDebut, dateFin]);
  useEffect(() => ecouterGrillesHorairesACI(setGrilles), []);
  useEffect(() => {
    const q = query(collection(db, "planning_mediateurs"), where("date", ">=", dateDebut), where("date", "<=", dateFin));
    return onSnapshot(q, (snap) => setCreneauxPeriode(snap.docs.map((d) => d.data() as CreneauJour)));
  }, [dateDebut, dateFin]);

  const aciActifs = useMemo(
    () => mediateurs.filter((m) => m.statut === "ACI").sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr")),
    [mediateurs]
  );

  const recap = useMemo<RecapAci[]>(() => {
    if (!pointages) return [];
    const parUid: Record<string, PointageACI[]> = {};
    pointages.forEach((p) => { (parUid[p.uid] ||= []).push(p); });

    return aciActifs
      .map((aci): RecapAci => {
        const siens = (parUid[aci.id] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
        const site = aci.rattachementHoraireACI || "Paris";
        const details: DetailJour[] = siens.map((p) => {
          const normal = horairesNormauxDuJour(grilles, site, p.date);
          const retard = minutesRetard(normal, p.arrivee);
          const enTrop = minutesEnTrop(normal, p.depart);
          const lieuxDuJour = Array.from(new Set(
            creneauxPeriode
              .filter((c) => c.date === p.date && estActionDuMediateur(c, aci))
              .map((c) => c.lieu)
              .filter(Boolean) as string[]
          ));
          return {
            date: p.date,
            arrivee: p.arrivee,
            depart: p.depart,
            retard,
            enTrop,
            netEnTrop: minutesReellementEnTrop(retard, enTrop),
            mission: lieuxDuJour.length > 0 ? lieuxDuJour.join(" / ") : "—",
          };
        });
        return {
          id: aci.id,
          nom: aci.nom || "",
          prenom: aci.prenom || "",
          joursPointes: siens.length,
          totalRetard: details.reduce((n, d) => n + d.retard, 0),
          totalEnTrop: details.reduce((n, d) => n + d.enTrop, 0),
          totalNetEnTrop: details.reduce((n, d) => n + d.netEnTrop, 0),
          details,
        };
      })
      .filter((r) => r.joursPointes > 0)
      .sort((a, b) => b.totalRetard - a.totalRetard || b.totalEnTrop - a.totalEnTrop);
  }, [pointages, aciActifs, grilles, creneauxPeriode]);

  const loading = loadingMediateurs || pointages === null;

  return (
    <PageGuard pageId="page_access_pointage_aci">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-4xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Récapitulatif <span className="text-[#EA601F] font-semibold">Pointage ACI</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Retards et heures en trop, par période de paie</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <Link href="/mediation/pointage-aci" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm w-fit">
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Pointage du jour</span>
              </Link>
              <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm w-fit">
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" />
              <label className="text-[10px] font-bold uppercase tracking-wide text-[#404040]/60">Du</label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs font-bold text-[#005259] outline-none focus:border-[#005259]/40" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-[#404040]/60">Au</label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs font-bold text-[#005259] outline-none focus:border-[#005259]/40" />
            </div>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-[#404040]/40 animate-pulse">Chargement...</div>
            ) : recap.length === 0 ? (
              <div className="p-8 text-center text-xs font-medium text-[#404040]/50">Aucun pointage enregistré sur cette période.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#404040]/10 bg-[#F3F3F2]">
                      <th className="px-2 py-2.5 w-6"></th>
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Nom</th>
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Jours pointés</th>
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Total retard</th>
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Total heures en trop</th>
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Réellement en trop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.map((r) => {
                      const estOuvert = ouverts.has(r.id);
                      return (
                        <Fragment key={r.id}>
                          <tr
                            onClick={() => r.details.length > 0 && setOuverts((prev) => { const s = new Set(prev); s.has(r.id) ? s.delete(r.id) : s.add(r.id); return s; })}
                            className={`border-b border-[#404040]/5 hover:bg-[#F3F3F2]/60 transition-colors ${r.details.length > 0 ? "cursor-pointer" : ""}`}
                          >
                            <td className="px-2 py-2.5">
                              {r.details.length > 0 && <ChevronDownIcon className={`w-3.5 h-3.5 text-[#404040]/40 transition-transform ${estOuvert ? "rotate-180" : ""}`} />}
                            </td>
                            <td className="px-4 py-2.5 font-bold text-[#005259] whitespace-nowrap">
                              <span className="font-normal text-[#404040]/70 mr-1">{r.prenom}</span>
                              {r.nom}
                            </td>
                            <td className="px-4 py-2.5 text-[#404040]/70">{r.joursPointes}</td>
                            <td className={`px-4 py-2.5 font-bold whitespace-nowrap ${r.totalRetard > 0 ? "text-[#EF736A]" : "text-[#404040]/40"}`}>{formaterMinutes(r.totalRetard)}</td>
                            <td className={`px-4 py-2.5 font-bold whitespace-nowrap ${r.totalEnTrop > 0 ? "text-[#005259]" : "text-[#404040]/40"}`}>{formaterMinutes(r.totalEnTrop)}</td>
                            <td className={`px-4 py-2.5 font-bold whitespace-nowrap ${r.totalNetEnTrop > 0 ? "text-[#005259]" : "text-[#404040]/40"}`} title="Heures en trop moins le retard du même jour">{formaterMinutes(r.totalNetEnTrop)}</td>
                          </tr>
                          {estOuvert && (
                            <tr>
                              <td colSpan={6} className="bg-[#F3F3F2]/60 px-4 py-3">
                                <div className="space-y-1">
                                  {r.details.map((d) => (
                                    <div key={d.date} className="flex items-center gap-3 text-[11px] bg-white rounded-lg px-3 py-1.5 border border-[#404040]/10">
                                      <span className="font-bold text-[#005259] w-24 shrink-0">{new Date(`${d.date}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                                      <span className="text-[#404040]/60 font-mono shrink-0">{d.arrivee || "—"} → {d.depart || "—"}</span>
                                      <span className="text-[#404040]/50 truncate" title={d.mission}>{d.mission}</span>
                                      {d.retard > 0 && <span className="flex items-center gap-1 text-[#EF736A] font-bold ml-auto"><ExclamationTriangleIcon className="w-3 h-3" />Retard {formaterMinutes(d.retard)}</span>}
                                      {d.enTrop > 0 && <span className="flex items-center gap-1 text-[#005259] font-bold"><ClockIcon className="w-3 h-3" />+{formaterMinutes(d.enTrop)}</span>}
                                      {d.netEnTrop > 0 && <span className="text-[#404040]/50 font-bold">(réel : {formaterMinutes(d.netEnTrop)})</span>}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-[11px] text-[#404040]/50 font-medium">
            Comparaison entre les heures réellement pointées et la grille Paris/Massy de chacun·e (réglages Paramètres Généraux) — clique une ligne pour voir le détail jour par jour.
          </p>
        </div>
      </main>
    </PageGuard>
  );
}

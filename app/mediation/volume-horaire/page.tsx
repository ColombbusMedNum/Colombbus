"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { useMediateurs } from "@/lib/MediateursProvider";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import {
  HomeIcon,
  ClockIcon,
  CurrencyEuroIcon,
  UserGroupIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  Cog6ToothIcon
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { calculerDureeHeures, calculerHeuresComplementairesACI } from "@/lib/planningHours";
import { identifiantMediateur } from "@/lib/matchMediateur";
import { getTerritoryColor } from "@/lib/territoryColor";

// Police Quicksand pour toute la page
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const MOIS = [
  { value: "01", label: "Janvier" }, { value: "02", label: "Février" }, { value: "03", label: "Mars" },
  { value: "04", label: "Avril" }, { value: "05", label: "Mai" }, { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" }, { value: "08", label: "Août" }, { value: "09", label: "Septembre" },
  { value: "10", label: "Octobre" }, { value: "11", label: "Novembre" }, { value: "12", label: "Décembre" },
];

export default function VolumeHoraireComplet() {
  const { mediateurs: mediateursListe } = useMediateurs();
  const [planningRaw, setPlanningRaw] = useState<any[]>([]);
  
  const [statsMediateurs, setStatsMediateurs] = useState<any[]>([]);
  const [statsActions, setStatsActions] = useState<any[]>([]);
  const [statsTerritoires, setStatsTerritoires] = useState<any[]>([]);
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [loading, setLoading] = useState(true);

  const [anneeFiltre, setAnneeFiltre] = useState("toutes");
  const [moisFiltre, setMoisFiltre] = useState("tous");

  const { role } = usePermissions();
  const peutConfigurerSeuils = role === "admin" || role === "coordinateur";

  // Seuils d'alerte sur les heures complémentaires ACI, configurables
  // manuellement en heures et/ou en pourcentage (les deux peuvent être actifs
  // en même temps ; 0 = seuil désactivé). Stockés à côté des autres réglages
  // globaux de l'équipe (voir app/mediation/equipe/page.tsx).
  const [seuilHeures, setSeuilHeures] = useState(0);
  const [seuilPourcentage, setSeuilPourcentage] = useState(0);
  const [seuilsOuvert, setSeuilsOuvert] = useState(false);
  const [seuilHeuresInput, setSeuilHeuresInput] = useState("0");
  const [seuilPourcentageInput, setSeuilPourcentageInput] = useState("0");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configuration_equipe", "parametres_configuration"), (snap) => {
      const data = snap.data();
      const seuils = data?.seuilsComplementairesACI || {};
      setSeuilHeures(Number(seuils.heures) || 0);
      setSeuilPourcentage(Number(seuils.pourcentage) || 0);
      setSeuilHeuresInput(String(Number(seuils.heures) || 0));
      setSeuilPourcentageInput(String(Number(seuils.pourcentage) || 0));
    });
    return () => unsub();
  }, []);

  const enregistrerSeuils = async () => {
    const heures = Math.max(0, Number(seuilHeuresInput) || 0);
    const pourcentage = Math.max(0, Number(seuilPourcentageInput) || 0);
    try {
      await setDoc(doc(db, "configuration_equipe", "parametres_configuration"), {
        seuilsComplementairesACI: { heures, pourcentage }
      }, { merge: true });
      setSeuilsOuvert(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Années réellement présentes dans les données, pour ne proposer que des
  // choix pertinents plutôt qu'une plage arbitraire.
  const anneesDisponibles = useMemo(() => {
    const annees = new Set<string>();
    planningRaw.forEach((a: any) => { if (a.date) annees.add(a.date.slice(0, 4)); });
    return Array.from(annees).sort().reverse();
  }, [planningRaw]);

  const planningFiltre = useMemo(() => {
    return planningRaw.filter((a: any) => {
      if (!a.date) return anneeFiltre === "toutes" && moisFiltre === "tous";
      if (anneeFiltre !== "toutes" && a.date.slice(0, 4) !== anneeFiltre) return false;
      if (moisFiltre !== "tous" && a.date.slice(5, 7) !== moisFiltre) return false;
      return true;
    });
  }, [planningRaw, anneeFiltre, moisFiltre]);

  // MOTEUR DE CALCUL DES HEURES ET DÉBORDEMENTS ACI, basé sur les fonctions
  // partagées de lib/planningHours.ts (mêmes règles que statistiques/mediateurs,
  // notamment la déduction systématique de la pause déjeuner du total).
  const calculerAnalyseAction = (action: any, medInfo: any) => {
    const total = calculerDureeHeures(action.debut, action.fin);
    const comp = calculerHeuresComplementairesACI(action, medInfo, total);
    return { total, comp };
  };

  // Table de correspondance par id ET par nom complet, dérivée du cache
  // partagé de liste_mediateurs (lib/MediateursProvider.tsx).
  const mediateursRaw = useMemo(() => {
    return mediateursListe.reduce((acc: any, data: any) => {
      const nomComplet = `${data.prenom || ""} ${data.nom || ""}`.trim();
      acc[data.id] = data;
      if (nomComplet) acc[nomComplet] = data;
      return acc;
    }, Object.create(null) as Record<string, any>);
  }, [mediateursListe]);

  // ÉCOUTEUR : S'aligne sur la collection "planning_mediateurs"
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "planning_mediateurs"), (snap) => {
      const plan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlanningRaw(plan);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // CRUNCHING DES DONNÉES EN TEMPS RÉEL
  useEffect(() => {
    // Object.create(null) plutôt que {} : ces objets servent de dictionnaires
    // indexés par du texte non contrôlé (nom de médiateur, lieu, territoire),
    // donc sans prototype pour qu'une clé "__proto__" reste une clé normale
    // au lieu de polluer Object.prototype (voir alerte Snyk).
    const mStats: Record<string, any> = Object.create(null);
    const aStats: Record<string, any> = Object.create(null);
    // Ventilation par territoire : basée sur le champ territoire renseigné
    // sur l'activité elle-même (ex "75", "92", visible en badge dans le
    // sidebar de l'agenda), pas sur les sites affectés à la fiche du
    // médiateur (Équipe) — les deux notions ne coïncident pas forcément.
    const tStats: Record<string, { territoire: string; h: number; cout: number }> = Object.create(null);
    let grandTotal = 0;

    planningFiltre.forEach((action: any) => {
      const identifiantMed = identifiantMediateur(action);
      if (!identifiantMed) return;

      const medInfo = mediateursRaw[identifiantMed] || { statut: "Permanent", poste: "Médiateur", taux: 0 };
      const nomAffichage = action.mediateurNom || identifiantMed;

      const { total, comp } = calculerAnalyseAction(action, medInfo);
      const tauxHoraire = Number(medInfo.taux) || (medInfo.statut === "ACI" ? 13.5 : 22.0);
      const cout = total * tauxHoraire;

      grandTotal += total;

      // Aggregations par Médiateur
      if (!mStats[nomAffichage]) {
        mStats[nomAffichage] = {
          nom: nomAffichage,
          poste: medInfo.poste || "Médiateur",
          statut: medInfo.statut || "Permanent",
          h: 0,
          comp: 0,
          cout: 0
        };
      }
      mStats[nomAffichage].h += total;
      mStats[nomAffichage].comp += comp;
      mStats[nomAffichage].cout += cout;

      // Aggregations par type de Lieu / Activité
      const titre = action.lieu || "Activité non spécifiée";
      if (!aStats[titre]) {
        aStats[titre] = { titre, h: 0, cout: 0, details: Object.create(null) };
      }
      aStats[titre].h += total;
      aStats[titre].cout += cout;

      if (!aStats[titre].details[nomAffichage]) {
        aStats[titre].details[nomAffichage] = { h: 0 };
      }
      aStats[titre].details[nomAffichage].h += total;

      // Aggregations par Territoire
      const territoire = action.territoire || "Sans territoire";
      if (!tStats[territoire]) tStats[territoire] = { territoire, h: 0, cout: 0 };
      tStats[territoire].h += total;
      tStats[territoire].cout += cout;
    });

    setTotalGeneral(grandTotal);
    setStatsMediateurs(Object.values(mStats).sort((a: any, b: any) => b.h - a.h));
    setStatsActions(Object.values(aStats).sort((a: any, b: any) => b.h - a.h));
    setStatsTerritoires(Object.values(tStats).sort((a: any, b: any) => b.h - a.h));
  }, [planningFiltre, mediateursRaw]);

  // % de dépassement = heures complémentaires rapportées aux heures
  // effectivement travaillées dans le cadre du contrat sur la période
  // (m.h - m.comp) — pas besoin d'un volume contractuel déclaré à part,
  // ce sont déjà les deux composantes calculées par calculerAnalyseAction.
  const pourcentageDepassement = (m: any) => {
    const heuresContrat = m.h - m.comp;
    if (heuresContrat <= 0) return m.comp > 0 ? 100 : 0;
    return (m.comp / heuresContrat) * 100;
  };

  const estEnAlerte = (m: any) => {
    if (m.statut !== "ACI") return false;
    if (seuilHeures > 0 && m.comp > seuilHeures) return true;
    if (seuilPourcentage > 0 && pourcentageDepassement(m) > seuilPourcentage) return true;
    return false;
  };

  const exporterCSV = () => {
    if (statsMediateurs.length === 0) return;
    const headers = "Collaborateur;Poste;Statut;Volume Total (h);Heures Complémentaires ACI (h);Coût Estimé (€)\n";
    const rows = statsMediateurs.map((m: any) =>
      `${m.nom};${m.poste};${m.statut};${m.h.toFixed(1)};${m.comp.toFixed(1)};${m.cout.toFixed(2)}`
    );
    const blob = new Blob([headers + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const suffixe = anneeFiltre !== "toutes" ? `_${anneeFiltre}${moisFiltre !== "tous" ? `-${moisFiltre}` : ""}` : "";
    link.setAttribute("download", `volume_horaire${suffixe}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#EA601F] font-bold animate-pulse text-xs uppercase tracking-widest`}>
        Analyse des plannings d'équipe en cours...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_volume_horaire">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        
        {/* EN-TÊTE ET BOUTON RETOUR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Analyse <span className="text-[#EA601F] font-semibold">Volumétrique</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Calcul automatisé des heures et coûts RH à partir de l'agenda pro
              </p>
            </div>
          </div>

          <Link 
            href="/" 
            className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm w-fit"
          >
            <HomeIcon className="w-4 h-4 text-[#EA601F]" />
            <span>Accueil</span>
          </Link>
        </div>

        {/* FILTRE DE PÉRIODE */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
          <div className="flex items-center gap-2 text-[#005259] shrink-0">
            <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Période</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={anneeFiltre}
              onChange={e => setAnneeFiltre(e.target.value)}
              className="px-3 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-xs font-bold outline-none focus:border-[#005259] cursor-pointer"
            >
              <option value="toutes">Toutes les années</option>
              {anneesDisponibles.map(annee => (
                <option key={annee} value={annee}>{annee}</option>
              ))}
            </select>
            <select
              value={moisFiltre}
              onChange={e => setMoisFiltre(e.target.value)}
              className="px-3 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-xs font-bold outline-none focus:border-[#005259] cursor-pointer"
            >
              <option value="tous">Tous les mois</option>
              {MOIS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {(anneeFiltre !== "toutes" || moisFiltre !== "tous") && (
              <button
                onClick={() => { setAnneeFiltre("toutes"); setMoisFiltre("tous"); }}
                className="px-3 py-1.5 bg-[#F3F3F2] hover:bg-[#EF736A] hover:text-white border border-[#404040]/10 text-[#404040]/70 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Réinitialiser
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            {peutConfigurerSeuils && (
              <button
                onClick={() => setSeuilsOuvert(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  seuilsOuvert ? "bg-[#005259] text-white" : "bg-[#F3F3F2] hover:bg-[#005259] hover:text-white border border-[#404040]/10 text-[#404040]/70"
                }`}
              >
                <Cog6ToothIcon className="w-4 h-4" />
                <span>Seuils d'alerte ACI</span>
              </button>
            )}
            <button
              onClick={exporterCSV}
              disabled={statsMediateurs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#005259] hover:bg-[#EA601F] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>Exporter (.csv)</span>
            </button>
          </div>
        </div>

        {peutConfigurerSeuils && seuilsOuvert && (
          <div className="bg-white border border-[#005259]/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-end gap-3 shadow-sm">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Seuil en heures complémentaires</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={seuilHeuresInput}
                  onChange={e => setSeuilHeuresInput(e.target.value)}
                  className="w-24 p-2 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-xs font-mono outline-none focus:border-[#005259]"
                />
                <span className="text-[11px] text-[#404040]/60 font-bold">h (0 = désactivé)</span>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Seuil en % du volume contractuel</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={seuilPourcentageInput}
                  onChange={e => setSeuilPourcentageInput(e.target.value)}
                  className="w-24 p-2 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-xs font-mono outline-none focus:border-[#005259]"
                />
                <span className="text-[11px] text-[#404040]/60 font-bold">% (0 = désactivé)</span>
              </div>
            </div>
            <button
              onClick={enregistrerSeuils}
              className="px-4 py-2 bg-[#005259] hover:bg-[#EA601F] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Enregistrer
            </button>
            <p className="text-[10px] text-[#404040]/60 italic sm:ml-auto">
              Un ACI est signalé dès qu'il dépasse l'un OU l'autre des deux seuils.
            </p>
          </div>
        )}

        {/* CARTES DE SYNTHÈSE DES CHIFFRES KIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#005259] tracking-widest block">Cumul Heures Globales</span>
              <div className="text-3xl font-bold font-mono text-[#005259] mt-1">{totalGeneral.toFixed(1)}h</div>
            </div>
            <div className="p-3 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl text-[#EA601F]">
              <ClockIcon className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#005259] tracking-widest block">Budget Engagé Estimé</span>
              <div className="text-3xl font-bold font-mono text-[#EA601F] mt-1">
                {statsMediateurs.reduce((acc, curr) => acc + curr.cout, 0).toFixed(2)}€
              </div>
            </div>
            <div className="p-3 bg-[#EA601F]/10 border border-[#EA601F]/20 rounded-xl text-[#EA601F]">
              <CurrencyEuroIcon className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* TABLEAU DE REPARTITION COLLABORATEURS */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#404040]/10 flex items-center gap-3 bg-[#F3F3F2]/60">
            <div className="p-2.5 rounded-xl border border-[#005259]/20 bg-white text-[#EA601F]">
              <UserGroupIcon className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold uppercase text-[#005259] tracking-tight">
              Suivi Individuel du Temps de Travail par Collaborateur
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="py-3 px-6">Collaborateur</th>
                  <th className="py-3 px-4">Volume Total</th>
                  <th className="py-3 px-4">Heures Complémentaires (ACI)</th>
                  <th className="py-3 px-6 text-right">Coût Estimé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/10">
                {statsMediateurs.map((m, i) => {
                  const enAlerte = estEnAlerte(m);
                  return (
                  <tr key={i} className={`hover:bg-[#F3F3F2]/50 transition-colors ${enAlerte ? "bg-[#EF736A]/5" : ""}`}>
                    <td className={`py-3.5 px-6 ${enAlerte ? "border-l-2 border-[#EF736A]" : ""}`}>
                      <div className="font-bold text-xs text-[#005259] uppercase flex items-center gap-1.5">
                        {m.nom}
                        {enAlerte && (
                          <ExclamationTriangleIcon className="w-3.5 h-3.5 text-[#EF736A] shrink-0" title="Dépasse le seuil d'heures complémentaires configuré" />
                        )}
                      </div>
                      <div className="text-[11px] text-[#404040]/70 mt-0.5 flex items-center gap-1.5 font-medium">
                        <span className={`w-1.5 h-1.5 rounded-full ${m.statut === 'ACI' ? 'bg-[#EA601F]' : 'bg-[#005259]'}`}></span>
                        {m.poste}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#005259] font-mono text-xs">{m.h.toFixed(1)}h</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-mono font-bold border ${
                        enAlerte
                          ? 'bg-[#EF736A]/15 border-[#EF736A]/40 text-[#EF736A]'
                          : m.comp > 0
                          ? 'bg-[#EA601F]/15 border-[#EA601F]/40 text-[#EA601F]'
                          : 'bg-[#F3F3F2] border-[#404040]/10 text-[#404040]/50'
                      }`}>
                        +{m.comp.toFixed(1)}h{m.statut === "ACI" && ` (${pourcentageDepassement(m).toFixed(0)}%)`}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-bold text-[#EA601F] font-mono text-xs">{m.cout.toFixed(2)}€</td>
                  </tr>
                  );
                })}
                {statsMediateurs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-[#404040]/60 font-bold uppercase text-xs italic tracking-widest">
                      {anneeFiltre !== "toutes" || moisFiltre !== "tous"
                        ? "Aucune action enregistrée sur cette période."
                        : "Aucune action enregistrée pour le moment dans l'agenda."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CARTES PAR TERRITOIRE (site du médiateur, ex Paris/Massy) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#005259] text-white">
              <MapPinIcon className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-xs uppercase tracking-wider text-[#005259]">
              Ventilation par Territoire
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {statsTerritoires.map((t, i) => (
              <div key={i} className={`border p-4 rounded-2xl flex items-center justify-between shadow-sm ${getTerritoryColor(t.territoire)}`}>
                <div>
                  <div className="font-bold uppercase text-xs tracking-tight">{t.territoire}</div>
                  <div className="text-[11px] font-mono mt-0.5 opacity-80">{t.h.toFixed(1)}h</div>
                </div>
                <div className="font-mono font-bold text-xs bg-white/60 px-2.5 py-1 rounded-lg">
                  {t.cout.toFixed(2)}€
                </div>
              </div>
            ))}
            {statsTerritoires.length === 0 && (
              <div className="sm:col-span-2 md:col-span-3 p-8 text-center text-[#404040]/60 font-bold uppercase text-xs italic tracking-widest bg-white border border-[#404040]/10 rounded-2xl">
                Aucune donnée pour cette période.
              </div>
            )}
          </div>
        </div>

        {/* CARTES PAR THÉMATIQUE DE LIEU ET DE TERRAIN */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#005259] text-white">
              <BriefcaseIcon className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-xs uppercase tracking-wider text-[#005259]">
              Ventilation Financière et Horaire par Activité / Lieu
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {statsActions.map((a, i) => (
              <div key={i} className="bg-white border border-[#404040]/10 p-5 rounded-2xl flex flex-col justify-between hover:border-[#EA601F]/40 transition-all shadow-sm">
                <div className="flex justify-between items-start mb-4 border-b border-[#404040]/10 pb-3">
                  <div>
                    <div className="font-bold uppercase text-[#005259] tracking-tight text-xs">{a.titre}</div>
                    <div className="text-[11px] text-[#404040]/70 font-mono mt-0.5">Volume Global : {a.h.toFixed(1)}h</div>
                  </div>
                  <div className="font-mono font-bold text-[#EA601F] bg-[#EA601F]/10 border border-[#EA601F]/20 px-2.5 py-1 rounded-lg text-xs">
                    {a.cout.toFixed(2)}€
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {Object.entries(a.details).map(([nom, d]: any) => (
                    <span key={nom} className="bg-[#F3F3F2] border border-[#404040]/10 px-2.5 py-1 rounded-lg text-xs font-bold text-[#404040] flex items-center gap-1.5">
                      <span className="text-[#005259] uppercase text-[10px]">{nom}</span>
                      <span className="text-[#EA601F] font-mono">{d.h.toFixed(1)}h</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
    </PageGuard>
  );
}
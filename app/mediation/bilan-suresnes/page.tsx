"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, collectionGroup, getDocs } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import {
  HomeIcon,
  ArrowLeftIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  MapPinIcon,
  ClockIcon
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import Accordion from "@/components/Accordion";

// Police Quicksand pour toute la page
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

interface GrandTotal {
  hommes: number;
  femmes: number;
  total: number;
}

interface MoisStats {
  nom: string;
  hommes: number;
  femmes: number;
  total: number;
}

const SITE_GLOBAL = "__global__";

// Le champ "site" d'un créneau peut avoir été saisi à la main dans Firebase
// (ex "RN - 91" au lieu de la clé interne "rn91") : on canonicalise ici selon
// la même règle que app/mediation/rencontres-numeriques/suresnes, pour qu'un
// site tapé différemment ne crée pas une seconde entrée en double.
function normaliserSiteId(site: string | undefined): string {
  const s = (site || "suresnes").trim();
  const upper = s.toUpperCase();
  if (upper === "SURESNES") return "suresnes";
  // "Suresnes - à domicile" reste le même service que le lieu principal, à
  // la différence de "Suresnes - Collecte.Tech" qui garde son propre onglet.
  if (upper.includes("SURESNES") && upper.includes("DOMICILE")) return "suresnes";
  const estRN = upper.includes("RN");
  if (estRN && (upper.includes("91") || upper.includes("ESSONNE"))) return "rn91";
  if (estRN) return "suresnes";
  return s;
}

// Libellés des sites connus — tout site absent de cette table s'affiche
// avec son propre texte (voir liste-beneficiaires → "Mettre à jour
// l'agenda", qui nomme chaque nouveau site d'après le lieu importé).
const LABELS_SITES: Record<string, string> = {
  suresnes: "Suresnes",
  rn91: "RN - 91",
};

const TERRITOIRES_BENEF = ["Paris", "Suresnes", "Autre"];
const TRANCHES_AGE = ["0-17", "18-25", "26-40", "41-60", "61-75", "76+", "Non renseigné"];
const TRANCHES_VENUES = ["1", "2-5", "6-10", "11+"];
// Une visite compte pour 1h30 dans les totaux d'heures (durée moyenne d'un
// accompagnement individuel).
const HEURES_PAR_VISITE = 1.5;

function territoireDeVille(ville: string): string {
  const v = (ville || "").toLowerCase();
  if (v.includes("paris")) return "Paris";
  if (v.includes("suresnes")) return "Suresnes";
  return "Autre";
}

function trancheVenues(nb: number): string {
  if (nb <= 1) return "1";
  if (nb <= 5) return "2-5";
  if (nb <= 10) return "6-10";
  return "11+";
}

export default function BilanSuresnesPage() {
  const [loading, setLoading] = useState(true);
  const [rawCreneaux, setRawCreneaux] = useState<any[]>([]);
  const [listeUsagers, setListeUsagers] = useState<{ nom: string; prenom: string; genreBrut: string }[]>([]);
  const [siteFiltre, setSiteFiltre] = useState<string>("suresnes");
  // Fiches complètes + visites, pour les analyses par territoire (tranches
  // d'âge, genre, nombre de venues) — indépendantes de l'agenda Suresnes,
  // basées directement sur le profil des bénéficiaires (champ Ville).
  const [beneficiairesComplet, setBeneficiairesComplet] = useState<any[]>([]);
  const [visitesParUtilisateur, setVisitesParUtilisateur] = useState<Map<string, any[]>>(new Map());
  const [ageOuvert, setAgeOuvert] = useState(false);
  const [genreOuvert, setGenreOuvert] = useState(false);
  const [venuesOuvert, setVenuesOuvert] = useState(false);
  const [absentsOuvert, setAbsentsOuvert] = useState(false);

  useEffect(() => {
    const chargerDonnees = async () => {
      try {
        // planning_suresnes héberge désormais Suresnes, RN-91 et tous les
        // autres lieux reconstitués depuis un import (voir liste-beneficiaires
        // → "Mettre à jour l'agenda"), distingués par le champ "site" — on
        // récupère tout ici, le filtre par site se fait ensuite côté calcul.
        const [agendaSnap, usersSnap, visitesSnap] = await Promise.all([
          getDocs(collection(db, "planning_suresnes")),
          getDocs(collection(db, "utilisateurs")),
          getDocs(collectionGroup(db, "visites")).catch(() => null),
        ]);

        setRawCreneaux(agendaSnap.docs.map(d => d.data()));

        setListeUsagers(usersSnap.docs.map(d => {
          const data = d.data();
          // Récupère TOUTES les variantes possibles de clés utilisées pour le genre
          const genreExtrait = data.Genre || data.genre || data.Sexe || data.sexe || data.civility || data.civilite || "";
          return {
            nom: (data.Nom || data.nom || "").trim().toLowerCase().replace(/\s+/g, " "),
            prenom: (data.Prénom || data.prenom || "").trim().toLowerCase().replace(/\s+/g, " "),
            genreBrut: genreExtrait.toString().toLowerCase().trim(),
          };
        }));

        setBeneficiairesComplet(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const visitesMap = new Map<string, any[]>();
        visitesSnap?.docs.forEach((docSnap) => {
          const userId = docSnap.ref.parent.parent?.id;
          if (!userId) return;
          if (!visitesMap.has(userId)) visitesMap.set(userId, []);
          visitesMap.get(userId)!.push(docSnap.data());
        });
        setVisitesParUtilisateur(visitesMap);
      } catch (error) {
        console.error("Erreur de récupération des données du bilan Suresnes :", error);
      } finally {
        setLoading(false);
      }
    };

    chargerDonnees();
  }, []);

  // Liste des sites réellement présents dans les créneaux, pour peupler le
  // sélecteur — toujours en tête Suresnes/RN-91 s'ils existent, puis les
  // autres lieux par ordre alphabétique.
  const sitesDisponibles = useMemo(() => {
    const ids = Array.from(new Set(rawCreneaux.map(c => normaliserSiteId(c.site))));
    const connus = ids.filter(id => id === "suresnes" || id === "rn91").sort();
    const autres = ids.filter(id => id !== "suresnes" && id !== "rn91").sort((a, b) => a.localeCompare(b, 'fr'));
    return [...connus, ...autres].map(id => ({ id, label: LABELS_SITES[id] || id }));
  }, [rawCreneaux]);

  const { totalSuresnes, trimestres, moisDetail } = useMemo(() => {
    const creneauxDuSite = siteFiltre === SITE_GLOBAL
      ? rawCreneaux
      : rawCreneaux.filter(c => normaliserSiteId(c.site) === siteFiltre);

    const cohorteUniques: Record<string, { date: Date; genre: string }> = {};

    creneauxDuSite.forEach((rdvData) => {
      const nomUsagerAgenda = (rdvData.usager || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (!nomUsagerAgenda) return;

      const ficheUsager = listeUsagers.find(u => {
        const combinPrenomNom = `${u.prenom} ${u.nom}`;
        const combinNomPrenom = `${u.nom} ${u.prenom}`;
        return nomUsagerAgenda === combinPrenomNom || nomUsagerAgenda === combinNomPrenom;
      });

      if (!rdvData.date) return;
      const rdvDate = new Date(rdvData.date);

      let genreFinal = "non_specifie";
      if (ficheUsager && ficheUsager.genreBrut) {
        const g = ficheUsager.genreBrut;
        if (g.startsWith("h") || g.includes("monsieur") || g === "m" || g.startsWith("mr") || g === "1") {
          genreFinal = "homme";
        } else if (g.startsWith("f") || g.includes("madame") || g.startsWith("mme") || g === "2") {
          genreFinal = "femme";
        }
      }

      const cleUnique = nomUsagerAgenda;
      if (!cohorteUniques[cleUnique]) {
        cohorteUniques[cleUnique] = { date: rdvDate, genre: genreFinal };
      } else if (rdvDate.getTime() < cohorteUniques[cleUnique].date.getTime()) {
        cohorteUniques[cleUnique].date = rdvDate;
      }
    });

    const structureTrimestres = {
      T1: { hommes: 0, femmes: 0, total: 0 },
      T2: { hommes: 0, femmes: 0, total: 0 },
      T3: { hommes: 0, femmes: 0, total: 0 },
      T4: { hommes: 0, femmes: 0, total: 0 },
    };
    const structureMois = Array(12).fill(null).map(() => ({ hommes: 0, femmes: 0, total: 0 }));
    let totalCompteur = 0;

    Object.values(cohorteUniques).forEach(({ date, genre }) => {
      totalCompteur++;
      const mois = date.getMonth();

      structureMois[mois].total += 1;
      if (genre === "homme") structureMois[mois].hommes += 1;
      if (genre === "femme") structureMois[mois].femmes += 1;

      let triKey = "T1";
      if (mois >= 3 && mois <= 5) triKey = "T2";
      else if (mois >= 6 && mois <= 8) triKey = "T3";
      else if (mois >= 9 && mois <= 11) triKey = "T4";

      structureTrimestres[triKey as keyof typeof structureTrimestres].total += 1;
      if (genre === "homme") structureTrimestres[triKey as keyof typeof structureTrimestres].hommes += 1;
      if (genre === "femme") structureTrimestres[triKey as keyof typeof structureTrimestres].femmes += 1;
    });

    const nomsMois = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    const detailFormate: MoisStats[] = nomsMois.map((nom, index) => ({
      nom,
      hommes: structureMois[index].hommes,
      femmes: structureMois[index].femmes,
      total: structureMois[index].total,
    }));

    return { totalSuresnes: totalCompteur, trimestres: structureTrimestres, moisDetail: detailFormate };
  }, [rawCreneaux, listeUsagers, siteFiltre]);

  // Bénéficiaires ayant réellement une visite enregistrée mais absents du
  // planning (site sélectionné) — écart entre "Bénéficiaires reçus" (basé
  // sur l'historique de visites) et "Bénéficiaires distincts de l'agenda"
  // (basé sur planning_suresnes). Vient surtout des créneaux jamais créés
  // faute de place lors de l'ancienne reconstruction (2 créneaux max par
  // médiateur/jour/moment) ou d'un nom écrit différemment dans l'agenda.
  const beneficiairesAbsentsDeLAgenda = useMemo(() => {
    const creneauxDuSite = siteFiltre === SITE_GLOBAL
      ? rawCreneaux
      : rawCreneaux.filter(c => normaliserSiteId(c.site) === siteFiltre);

    const usagersDansAgenda = new Set(
      creneauxDuSite
        .map(c => (c.usager || "").trim().toLowerCase().replace(/\s+/g, " "))
        .filter(Boolean)
    );

    return beneficiairesComplet
      .map((b) => {
        const docsVisites = visitesParUtilisateur.get(b.id) || [];
        const nbVisites = docsVisites.filter((v) => v.statut !== "Absent" && v.statut !== "Annulé").length;
        return { b, nbVisites };
      })
      .filter(({ nbVisites }) => nbVisites > 0)
      .filter(({ b }) => {
        const nom = (b.Nom || b.nom || "").trim().toLowerCase().replace(/\s+/g, " ");
        const prenom = (b.Prénom || b.prenom || "").trim().toLowerCase().replace(/\s+/g, " ");
        const combinPrenomNom = `${prenom} ${nom}`.trim();
        const combinNomPrenom = `${nom} ${prenom}`.trim();
        return !usagersDansAgenda.has(combinPrenomNom) && !usagersDansAgenda.has(combinNomPrenom);
      })
      .map(({ b, nbVisites }) => ({
        id: b.id,
        nom: b.Nom || b.nom || "",
        prenom: b.Prénom || b.prenom || "",
        ville: b.Ville || "",
        nbVisites,
      }))
      .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", 'fr', { sensitivity: 'base' }));
  }, [rawCreneaux, beneficiairesComplet, visitesParUtilisateur, siteFiltre]);

  // Répartition des tranches d'âge par territoire : l'âge n'est pas stocké
  // tel quel (seul Date_Naissance existe), donc on le déduit à la volée.
  // Basé sur le profil des bénéficiaires (champ Ville), indépendamment de
  // l'agenda et du site sélectionné ci-dessus.
  const repartitionAgesTerritoire = useMemo(() => {
    const table: Record<string, Record<string, number>> = {};
    TERRITOIRES_BENEF.forEach(t => { table[t] = {}; TRANCHES_AGE.forEach(tr => { table[t][tr] = 0; }); });

    beneficiairesComplet.forEach((b) => {
      const territoire = territoireDeVille(b.Ville || "");

      let age: number | null = null;
      if (b.Date_Naissance) {
        const annee = parseInt(String(b.Date_Naissance).slice(0, 4), 10);
        if (!isNaN(annee)) age = new Date().getFullYear() - annee;
      }

      let tranche: string;
      if (age === null || isNaN(age)) tranche = "Non renseigné";
      else if (age <= 17) tranche = "0-17";
      else if (age <= 25) tranche = "18-25";
      else if (age <= 40) tranche = "26-40";
      else if (age <= 60) tranche = "41-60";
      else if (age <= 75) tranche = "61-75";
      else tranche = "76+";

      table[territoire][tranche]++;
    });

    return table;
  }, [beneficiairesComplet]);

  // Répartition par territoire/genre et par nombre de venues, ainsi que les
  // KPI globaux (bénéficiaires reçus, visites, heures) — ne compte que les
  // bénéficiaires ayant au moins une visite effective (hors Absent/Annulé).
  const { parGenreTerritoire, parVenuesTerritoire, totalBeneficiairesRecus, totalVisitesGlobal } = useMemo(() => {
    const genreTable: Record<string, { hommes: number; femmes: number; nonRenseigne: number; visitesHommes: number; visitesFemmes: number; visitesNonRenseigne: number }> = {};
    TERRITOIRES_BENEF.forEach(t => { genreTable[t] = { hommes: 0, femmes: 0, nonRenseigne: 0, visitesHommes: 0, visitesFemmes: 0, visitesNonRenseigne: 0 }; });

    const venuesTable: Record<string, Record<string, number>> = {};
    TERRITOIRES_BENEF.forEach(t => { venuesTable[t] = {}; TRANCHES_VENUES.forEach(tr => { venuesTable[t][tr] = 0; }); });

    let totalBenef = 0;
    let totalVis = 0;

    beneficiairesComplet.forEach((b) => {
      const docsVisites = visitesParUtilisateur.get(b.id) || [];
      const nbVisites = docsVisites.filter((v) => v.statut !== "Absent" && v.statut !== "Annulé").length;
      if (nbVisites === 0) return;

      totalBenef++;
      totalVis += nbVisites;

      const territoire = territoireDeVille(b.Ville || "");
      const sexe = (b.Sexe || b.sexe || "").toLowerCase();
      const estHomme = sexe.startsWith("h") || sexe.includes("monsieur") || sexe === "m";
      const estFemme = sexe.startsWith("f") || sexe.includes("madame") || sexe.startsWith("mme");

      if (estHomme) { genreTable[territoire].hommes++; genreTable[territoire].visitesHommes += nbVisites; }
      else if (estFemme) { genreTable[territoire].femmes++; genreTable[territoire].visitesFemmes += nbVisites; }
      else { genreTable[territoire].nonRenseigne++; genreTable[territoire].visitesNonRenseigne += nbVisites; }

      venuesTable[territoire][trancheVenues(nbVisites)]++;
    });

    return {
      parGenreTerritoire: genreTable,
      parVenuesTerritoire: venuesTable,
      totalBeneficiairesRecus: totalBenef,
      totalVisitesGlobal: totalVis,
    };
  }, [beneficiairesComplet, visitesParUtilisateur]);

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase`}>
        Génération du bilan d'impact Suresnes (Agenda Global)...
      </div>
    );
  }

  const libelleSiteActif = siteFiltre === SITE_GLOBAL
    ? "Global Colombbus"
    : (sitesDisponibles.find(s => s.id === siteFiltre)?.label || siteFiltre);

  return (
    <PageGuard pageId="page_access_bilan_suresnes">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Bilan Territorial <span className="text-[#EA601F] font-semibold">{libelleSiteActif}</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Cohorte Unique basée sur le planning global — Sans Doublons
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <div className="relative">
              <select
                value={siteFiltre}
                onChange={(e) => setSiteFiltre(e.target.value)}
                className="appearance-none bg-white hover:bg-[#F3F3F2] border border-[#404040]/10 pl-3.5 pr-9 py-2 rounded-xl text-[#005259] text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer outline-none focus:border-[#005259]"
              >
                <option value={SITE_GLOBAL}>🌍 Global Colombbus</option>
                {sitesDisponibles.map(site => (
                  <option key={site.id} value={site.id}>{site.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#EA601F]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>

            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>

            <Link
              href="/mediation/rencontres-numeriques/suresnes"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Retour au Planning</span>
            </Link>
          </div>
        </div>

        {/* INDICATEUR MAÎTRE */}
        <div className="p-6 bg-white border border-[#404040]/10 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#005259]/10 rounded-xl text-[#005259] border border-[#005259]/20">
              <BuildingOfficeIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-[#005259]">Bénéficiaires Distincts de l'Agenda</span>
              <span className="text-xs text-[#404040]/70 mt-0.5 block font-medium">Chaque personne inscrite dans le planning n'est comptée qu'une fois</span>
            </div>
          </div>
          <span className="text-4xl font-mono font-black text-[#EA601F]">{totalSuresnes}</span>
        </div>

        {/* VUE TRIMESTRIELLE */}
        <div className="space-y-3">
          <h2 className="font-bold text-xs uppercase tracking-wider text-[#005259] flex items-center gap-2 px-1">
            <UserGroupIcon className="w-4 h-4 text-[#EA601F]" />
            Synthèse par Trimestre de premier rendez-vous
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(trimestres).map(([tri, data]) => (
              <div key={tri} className="bg-white border border-[#404040]/10 p-4 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-2 border-b border-[#404040]/10 pb-2">
                  <span className="font-bold text-xs text-[#EA601F] uppercase tracking-wider">{tri}</span>
                  <span className="font-mono font-black text-[#005259] text-lg">{data.total}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-[#404040]/80 font-mono">
                  <span>H: <strong className="text-[#005259]">{data.hommes}</strong></span>
                  <span>F: <strong className="text-[#EA601F]">{data.femmes}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VUE MENSUELLE */}
        <div className="space-y-3">
          <h2 className="font-bold text-xs uppercase tracking-wider text-[#005259] flex items-center gap-2 px-1">
            <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" />
            Ventilation Mensuelle Réelle
          </h2>

          <div className="bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-4 bg-[#F3F3F2] border-b border-[#404040]/10 p-3 text-[10px] font-bold uppercase tracking-widest text-[#005259] text-center">
              <div className="text-left pl-4">Mois de visite</div>
              <div>Hommes</div>
              <div>Femmes</div>
              <div className="text-[#EA601F]">Total Unique</div>
            </div>

            <div className="divide-y divide-[#404040]/10">
              {moisDetail.map((m) => (
                <div key={m.nom} className="grid grid-cols-4 p-3.5 text-center text-xs font-medium items-center hover:bg-[#F3F3F2]/50 transition-colors">
                  <div className="text-left font-bold text-[#005259] uppercase tracking-wider pl-4">{m.nom}</div>
                  <div className="font-mono text-[#404040]">{m.hommes}</div>
                  <div className="font-mono text-[#EA601F] font-semibold">{m.femmes}</div>
                  <div className="font-mono font-bold text-[#005259] bg-[#005259]/10 py-1 rounded-lg border border-[#005259]/20 max-w-[80px] mx-auto w-full">
                    {m.total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KPI GLOBAUX BÉNÉFICIAIRES (basés sur le profil, pas l'agenda) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 bg-white border border-[#404040]/10 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-[#005259]/10 rounded-xl text-[#005259] border border-[#005259]/20">
              <UserGroupIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#005259]">Bénéficiaires reçus (≥1 visite)</span>
              <span className="text-2xl font-mono font-black text-[#EA601F]">{totalBeneficiairesRecus}</span>
            </div>
          </div>
          <div className="p-5 bg-white border border-[#404040]/10 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-[#005259]/10 rounded-xl text-[#005259] border border-[#005259]/20">
              <ClockIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#005259]">Heures d'accompagnement ({totalVisitesGlobal} visites)</span>
              <span className="text-2xl font-mono font-black text-[#EA601F]">{(totalVisitesGlobal * HEURES_PAR_VISITE).toLocaleString('fr-FR')} h</span>
              <span className="block text-[9px] text-[#404040]/50 mt-0.5">1 visite = 1h30</span>
            </div>
          </div>
        </div>

        {/* BÉNÉFICIAIRES REÇUS MAIS ABSENTS DE L'AGENDA (site sélectionné) */}
        <Accordion
          title={`Bénéficiaires reçus mais absents de l'agenda (${beneficiairesAbsentsDeLAgenda.length})`}
          open={absentsOuvert}
          onToggle={() => setAbsentsOuvert(!absentsOuvert)}
        >
          {beneficiairesAbsentsDeLAgenda.length === 0 ? (
            <p className="text-xs text-[#404040]/60 py-2">Aucun écart : tous les bénéficiaires reçus apparaissent dans l'agenda de ce site.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#404040]/10">
                    <th className="text-left py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">Nom</th>
                    <th className="text-left py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">Prénom</th>
                    <th className="text-left py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">Ville</th>
                    <th className="text-center py-2 px-2 font-bold text-[#005259] uppercase tracking-wider text-[10px]">Visites</th>
                    <th className="text-right py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">Fiche</th>
                  </tr>
                </thead>
                <tbody>
                  {beneficiairesAbsentsDeLAgenda.map((b) => (
                    <tr key={b.id} className="border-b border-[#404040]/5 last:border-0">
                      <td className="py-2 px-2 font-bold text-[#404040] uppercase">{b.nom || "—"}</td>
                      <td className="py-2 px-2 text-[#404040]">{b.prenom || "—"}</td>
                      <td className="py-2 px-2 text-[#404040]/70">{b.ville || "—"}</td>
                      <td className="text-center py-2 px-2 font-bold text-[#005259]">{b.nbVisites}</td>
                      <td className="text-right py-2 px-2">
                        <Link
                          href={`/mediation/rencontres-numeriques/liste-beneficiaires/${b.id}`}
                          className="text-[#EA601F] hover:underline font-bold text-[10px] uppercase tracking-wide"
                        >
                          Ouvrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Accordion>

        {/* RÉPARTITION DES TRANCHES D'ÂGE PAR TERRITOIRE */}
        <Accordion title="Répartition des tranches d'âge par territoire" open={ageOuvert} onToggle={() => setAgeOuvert(!ageOuvert)}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#404040]/10">
                  <th className="text-left py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">Territoire</th>
                  {TRANCHES_AGE.map((tranche) => (
                    <th key={tranche} className="text-center py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">{tranche}</th>
                  ))}
                  <th className="text-center py-2 px-2 font-bold text-[#005259] uppercase tracking-wider text-[10px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {TERRITOIRES_BENEF.map((territoire) => {
                  const ligne = repartitionAgesTerritoire[territoire];
                  const total = TRANCHES_AGE.reduce((s, tr) => s + ligne[tr], 0);
                  return (
                    <tr key={territoire} className="border-b border-[#404040]/5 last:border-0">
                      <td className="py-2 px-2 font-bold text-[#404040]">{territoire}</td>
                      {TRANCHES_AGE.map((tranche) => (
                        <td key={tranche} className="text-center py-2 px-2 text-[#404040]/80">{ligne[tranche] || "—"}</td>
                      ))}
                      <td className="text-center py-2 px-2 font-bold text-[#005259]">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Accordion>

        {/* RÉPARTITION PAR TERRITOIRE ET GENRE */}
        <Accordion title="Répartition par territoire et genre" open={genreOuvert} onToggle={() => setGenreOuvert(!genreOuvert)}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#404040]/10">
                  <th className="text-left py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">Territoire</th>
                  <th className="text-center py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">Hommes</th>
                  <th className="text-center py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">Femmes</th>
                  <th className="text-center py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">Non renseigné</th>
                  <th className="text-center py-2 px-2 font-bold text-[#EA601F] uppercase tracking-wider text-[10px]">Total bénéf.</th>
                  <th className="text-center py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">Visites</th>
                  <th className="text-center py-2 px-2 font-bold text-[#005259] uppercase tracking-wider text-[10px]">Heures (×1,5)</th>
                </tr>
              </thead>
              <tbody>
                {TERRITOIRES_BENEF.map((territoire) => {
                  const ligne = parGenreTerritoire[territoire];
                  const totalBenef = ligne.hommes + ligne.femmes + ligne.nonRenseigne;
                  const totalVis = ligne.visitesHommes + ligne.visitesFemmes + ligne.visitesNonRenseigne;
                  return (
                    <tr key={territoire} className="border-b border-[#404040]/5 last:border-0">
                      <td className="py-2 px-2 font-bold text-[#404040]">{territoire}</td>
                      <td className="text-center py-2 px-2 text-[#404040]/80">{ligne.hommes || "—"}</td>
                      <td className="text-center py-2 px-2 text-[#404040]/80">{ligne.femmes || "—"}</td>
                      <td className="text-center py-2 px-2 text-[#404040]/50">{ligne.nonRenseigne || "—"}</td>
                      <td className="text-center py-2 px-2 font-bold text-[#EA601F]">{totalBenef}</td>
                      <td className="text-center py-2 px-2 text-[#404040]/80">{totalVis}</td>
                      <td className="text-center py-2 px-2 font-bold text-[#005259]">{(totalVis * HEURES_PAR_VISITE).toLocaleString('fr-FR')} h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Accordion>

        {/* RÉPARTITION PAR NOMBRE DE VENUES */}
        <Accordion title="Répartition par nombre de venues" open={venuesOuvert} onToggle={() => setVenuesOuvert(!venuesOuvert)}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#404040]/10">
                  <th className="text-left py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">Territoire</th>
                  {TRANCHES_VENUES.map((tr) => (
                    <th key={tr} className="text-center py-2 px-2 font-bold text-[#404040]/60 uppercase tracking-wider text-[10px]">{tr} venue{tr !== "1" ? "s" : ""}</th>
                  ))}
                  <th className="text-center py-2 px-2 font-bold text-[#EA601F] uppercase tracking-wider text-[10px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {TERRITOIRES_BENEF.map((territoire) => {
                  const ligne = parVenuesTerritoire[territoire] || {};
                  const total = TRANCHES_VENUES.reduce((s, tr) => s + (ligne[tr] || 0), 0);
                  return (
                    <tr key={territoire} className="border-b border-[#404040]/5 last:border-0">
                      <td className="py-2 px-2 font-bold text-[#404040]">{territoire}</td>
                      {TRANCHES_VENUES.map((tr) => (
                        <td key={tr} className="text-center py-2 px-2 text-[#404040]/80">{ligne[tr] || "—"}</td>
                      ))}
                      <td className="text-center py-2 px-2 font-bold text-[#EA601F]">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Accordion>

      </div>
    </main>
    </PageGuard>
  );
}

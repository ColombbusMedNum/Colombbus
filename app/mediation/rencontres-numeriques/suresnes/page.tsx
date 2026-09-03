"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import PageGuard from "@/components/PageGuard";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useToast } from "@/components/ToastProvider";
import { useMediateurs } from "@/lib/MediateursProvider";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import Accordion from "@/components/Accordion";
import {
  collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, deleteDoc, collectionGroup, serverTimestamp, getDocs, where
} from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { 
  ExclamationTriangleIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  CalendarDaysIcon, 
  UserIcon, 
  ClockIcon, 
  XMarkIcon,
  CheckCircleIcon,
  HomeIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
  TagIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleBottomCenterTextIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";

// Initialisation de la police Quicksand
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Vocabulaire fixe du <select> Thématique ci-dessous — une valeur importée
// (texte libre du fichier Google Forms) qui n'y figure pas doit être ajoutée
// comme option supplémentaire, sinon le <select> l'affiche vide alors que la
// donnée est bien présente en base.
const THEMATIQUES_CONNUES = [
  "", "Ordinateur", "Smartphone", "Premiers pas vers le numérique", "Gestion documentaire",
  "Communiquer par internet", "Utilisation sécurisée d’internet", "Le numérique au quotidien",
  "Accès aux droits et aux offres de soin", "Les outils pour la vie professionnelle",
  "Recherche d’emploi sur internet", "Choisir ses logiciels informatiques", "Création multimédia",
  "Outils informatiques pour la fabrication", "Collecte Tech", "Collecte Tech - Remise de matériel",
  "Collecte Tech - Tests de positionnement",
];

interface Beneficiaire {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  sexe?: string;
  statutBlacklist?: string;
  lieuRDV?: string;
}

// Rapproche le lieu d'accueil renseigné sur une fiche bénéficiaire (champ
// Lieu_RDV, choisi dans la même liste de localisations que l'onglet) du
// libellé d'un onglet Résidence Autonomie — comparaison exacte d'abord, puis
// un repli tolérant (accents/casse/tirets ignorés, inclusion dans un sens ou
// l'autre) si les deux textes ne sont pas rigoureusement identiques.
function estMemeLieu(lieuBeneficiaire: string | undefined, labelSite: string): boolean {
  const a = (lieuBeneficiaire || "").trim();
  const b = (labelSite || "").trim();
  if (!a || !b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const simplifier = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const sa = simplifier(a);
  const sb = simplifier(b);
  return sa.length > 3 && sb.length > 3 && (sa.includes(sb) || sb.includes(sa));
}

// Le champ "site" d'un créneau peut avoir été saisi à la main dans Firebase
// (ex "RN - 91" au lieu de la clé interne "rn91") : on canonicalise ici selon
// la même règle que liste-beneficiaires → "Mettre à jour l'agenda", pour
// qu'un site tapé différemment ne crée pas un second onglet en double.
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

export default function PlanningSuresnes() {
  const [creneaux, setCreneaux] = useState<any[]>([]);
  const { mediateurs: mediateursBruts } = useMediateurs();
  const mediateursActifs = React.useMemo(() => {
    return mediateursBruts.map((data: any) => {
      const prenom = (data.prenom || "").trim();
      const nom = (data.nom || "").trim();
      return `${prenom} ${nom}`.trim().toLowerCase();
    });
  }, [mediateursBruts]);
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [reassignCreneau, setReassignCreneau] = useState<{ id: string; currentName: string; site: string; isRND: boolean } | null>(null);
  const [reassignSearch, setReassignSearch] = useState("");
  const { showToast } = useToast();
  const [viewDate, setViewDate] = useState(new Date());
  const [miniMoisOuvert, setMiniMoisOuvert] = useState(false);
  const [filterTodayOnly, setFilterTodayOnly] = useState(false);
  // Un même agenda héberge plusieurs sites, distingués par le champ "site"
  // posé à la création du créneau (voir lib/activitesTypes.ts et
  // app/agenda/page.tsx) — absent sur les anciens créneaux, qui sont donc
  // considérés "suresnes" par défaut. Suresnes/RN-91 sont les deux sites
  // historiques (toujours affichés) ; tout autre lieu reconstitué depuis un
  // import (voir liste-beneficiaires → "Mettre à jour l'agenda") ajoute son
  // propre onglet, nommé d'après le lieu lui-même.
  const [siteActif, setSiteActif] = useState<string>("suresnes");
  const SITES = React.useMemo(() => {
    const base = [
      { id: "suresnes", label: "Suresnes" },
      { id: "rn91", label: "RN - 91" },
    ];
    // Les onglets "Collecte.Tech" (Paris et Suresnes) ne concernent pas ce
    // planning et sont masqués ici — les créneaux existants restent en base,
    // seul l'onglet disparaît du sélecteur.
    const autres = Array.from(new Set(
      creneaux.map(c => normaliserSiteId(c.site)).filter(id => id !== "suresnes" && id !== "rn91")
    )).filter(id => !id.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes("collecte"))
      .sort((a, b) => a.localeCompare(b, 'fr'));
    return [...base, ...autres.map(id => ({ id, label: id }))];
  }, [creneaux]);
  const creneauxDuSite = React.useMemo(
    () => creneaux.filter(c => normaliserSiteId(c.site) === siteActif),
    [creneaux, siteActif]
  );

  // Certains lieux reconstitués depuis un import (ex : plusieurs "Paris
  // Résidence Autonomie ...") partagent un même préfixe et encombreraient le
  // sélecteur avec un onglet chacun — on les regroupe sous un seul menu
  // déroulant, le reste des sites restant affiché en onglets directs.
  // Les libellés réels utilisent des tirets ("Paris - Résidence Autonomie -
  // Ave Maria") : on cherche donc la mention n'importe où dans le texte,
  // pas un préfixe strict.
  const normaliserTexteSite = (s: string) => (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const MARQUEUR_GROUPE_PRA = "residence autonomie";
  const { sitesPrincipaux, sitesGroupePRA } = React.useMemo(() => {
    const autresSites = SITES.filter(s => s.id !== "suresnes" && s.id !== "rn91");
    const groupePRA = autresSites.filter(s => normaliserTexteSite(s.label).includes(MARQUEUR_GROUPE_PRA));
    const principaux = [
      ...SITES.filter(s => s.id === "suresnes" || s.id === "rn91"),
      ...autresSites.filter(s => !normaliserTexteSite(s.label).includes(MARQUEUR_GROUPE_PRA)),
    ];
    return { sitesPrincipaux: principaux, sitesGroupePRA: groupePRA };
  }, [SITES]);

  // Un onglet Résidence Autonomie n'affiche plus de créneaux : la liste des
  // bénéficiaires qui lui sont rattachés vient directement de leur fiche
  // (Lieu_RDV), pas d'un planning saisi à la main.
  const estSiteResidenceAutonomie = sitesGroupePRA.some(s => s.id === siteActif);
  const siteActifLabel = SITES.find(s => s.id === siteActif)?.label || siteActif;
  const beneficiairesDeLaResidence = React.useMemo(() => {
    if (!estSiteResidenceAutonomie) return [];
    return beneficiaires
      .filter(b => estMemeLieu(b.lieuRDV, siteActifLabel))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
  }, [beneficiaires, estSiteResidenceAutonomie, siteActifLabel]);

  const [groupePRAOuvert, setGroupePRAOuvert] = useState(false);
  const groupePRARef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (groupePRARef.current && !groupePRARef.current.contains(event.target as Node)) {
        setGroupePRAOuvert(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // États synchronisés en temps réel depuis les fiches de visites
  const [rawVisites, setRawVisites] = useState<any[]>([]);
  const [totalVisitesPresents, setTotalVisitesPresents] = useState<{ [key: string]: number }>({});
  const [thematiquesVisitees, setThematiquesVisitees] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "planning_suresnes"), orderBy("horaire", "asc")), (snap) => {
      setCreneaux(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubBenef = onSnapshot(collection(db, "utilisateurs"), (snap) => {
      setBeneficiaires(
        snap.docs.map(d => {
          const data = d.data();
          const phone = data.Téléphone || data.telephone || data.Telephone || "Non renseigné";
          return {
            id: d.id,
            nom: (data.Nom || "").trim(),
            prenom: (data.Prénom || data.prenom || "").trim(),
            telephone: phone,
            sexe: data.Sexe || data.sexe || "Non renseigné",
            statutBlacklist: data.Statut_Blacklist || "Non",
            lieuRDV: data.Lieu_RDV || data.lieuRDV || ""
          };
        })
      );
    });

    const unsubVisites = onSnapshot(collectionGroup(db, "visites"), (snap) => {
      const totauxPresents: { [key: string]: number } = {};
      const mapThematiquesUsagers: { [key: string]: string[] } = {};
      const listeVisites: any[] = [];

      snap.docs.forEach(d => {
        const data = d.data();
        const userId = d.ref.parent.parent?.id;
        if (!userId) return;

        listeVisites.push({
          userId,
          date: data.date,
          moment: data.moment,
          statut: data.statut || "Présent",
          thematique: data.thematique,
          lieu: data.lieu || ""
        });

        if (data.statut === "Présent") {
          totauxPresents[userId] = (totauxPresents[userId] || 0) + 1;
        }

        if (data.statut === "Présent" || data.moment === "Diagnostic Initial") {
          if (data.thematique) {
            if (!mapThematiquesUsagers[userId]) mapThematiquesUsagers[userId] = [];
            mapThematiquesUsagers[userId].push(data.thematique);
          }
        }
      });

      setTotalVisitesPresents(totauxPresents);
      setThematiquesVisitees(mapThematiquesUsagers);
      setRawVisites(listeVisites);
    });

    return () => { unsub(); unsubBenef(); unsubVisites(); };
  }, []);

  // Une résidence autonomie n'a pas de planning saisi à la main (voir plus
  // haut) : la seule date exploitable est celle de la dernière visite
  // réellement effectuée, retrouvée dans les fiches de visites du
  // bénéficiaire plutôt que dans un créneau à venir.
  // Quota légal : 4 visites à domicile (RND) maximum par bénéficiaire et par
  // année civile — sert à faire apparaître son nom en orange sur un créneau
  // "92 - RND Suresnes" une fois ce quota atteint (voir UsagerInput). Même
  // logique de repérage du lieu que normaliserSiteId ci-dessus.
  const ANNEE_COURANTE = new Date().getFullYear();
  const QUOTA_DOMICILE_PAR_AN = 4;
  const visitesDomicileAnneeParBeneficiaire = React.useMemo(() => {
    const map: Record<string, number> = {};
    rawVisites.forEach((v) => {
      if (v.statut !== "Présent" || !v.date || !v.date.startsWith(String(ANNEE_COURANTE))) return;
      const lieuNorm = (v.lieu || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      if (lieuNorm.includes("suresnes") && lieuNorm.includes("domicile")) {
        map[v.userId] = (map[v.userId] || 0) + 1;
      }
    });
    return map;
  }, [rawVisites, ANNEE_COURANTE]);

  const derniereVisiteParBeneficiaire = React.useMemo(() => {
    const map: Record<string, string> = {};
    rawVisites.forEach((v) => {
      if (v.statut !== "Présent" || !v.date) return;
      if (!map[v.userId] || v.date > map[v.userId]) map[v.userId] = v.date;
    });
    return map;
  }, [rawVisites]);

  // Liste chronologique de toutes les visites de la résidence sur le mois
  // sélectionné (même sélecteur de mois — viewDate — que le reste de la
  // page), pas seulement la dernière par bénéficiaire.
  const visitesDuMoisResidence = React.useMemo(() => {
    if (!estSiteResidenceAutonomie) return [];
    const idsResidence = new Set(beneficiairesDeLaResidence.map((b) => b.id));
    const beneficiairesParId = new Map(beneficiairesDeLaResidence.map((b) => [b.id, b]));
    const prefixeMois = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}`;
    return rawVisites
      .filter((v) => v.statut === "Présent" && v.date?.startsWith(prefixeMois) && idsResidence.has(v.userId))
      .map((v) => ({ ...v, beneficiaire: beneficiairesParId.get(v.userId) }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [rawVisites, beneficiairesDeLaResidence, estSiteResidenceAutonomie, viewDate]);

  // Dérivé pur de creneaux/beneficiaires/rawVisites : plus besoin d'un
  // useEffect+setState (qui provoquait un rendu supplémentaire à chaque
  // changement d'une de ces trois sources).
  const statutsVisitesRealtime = React.useMemo(() => {
    const etatsVisites: { [key: string]: string } = {};

    for (const c of creneaux) {
      if (!c.usager) continue;

      const bTrouve = beneficiaires.find(
        b => `${b.prenom.trim()} ${b.nom.trim()}`.toLowerCase() === c.usager.trim().toLowerCase()
      );

      if (bTrouve && c.date && c.moment) {
        const uniqueKey = `${c.id}_${c.date}`;

        const visiteTrouvee = rawVisites.find(v =>
          v.userId === bTrouve.id &&
          v.date === c.date &&
          v.moment === c.moment
        );

        etatsVisites[uniqueKey] = visiteTrouvee ? visiteTrouvee.statut : "Non suivi";
      }
    }
    return etatsVisites;
  }, [creneaux, beneficiaires, rawVisites]);

  // --- DÉCLENCHEMENT D'ALERTE POUR LES COLLECTES MANQUANTES DU JOUR MÊME ---
  useEffect(() => {
    const testerEtEnvoyerAlerteJourMeme = async () => {
      const todayStr = new Date().toLocaleDateString('en-CA');

      // Recherche des créneaux d'aujourd'hui réservés mais restés non suivis
      const manquantsDuJour = creneaux.filter(c => {
        if (c.date !== todayStr || !c.usager) return false;
        const uniqueKey = `${c.id}_${c.date}`;
        const statut = statutsVisitesRealtime[uniqueKey];
        return !statut || statut === "Non suivi";
      });

      if (manquantsDuJour.length > 0) {
        try {
          // Vérification si une alerte n'a pas déjà été enregistrée aujourd'hui
          const notifsRef = collection(db, "notifications");
          const qNotif = query(
            notifsRef,
            where("type", "==", "collectes_manquantes"),
            where("dateJour", "==", todayStr)
          );
          const existingNotifs = await getDocs(qNotif);

          if (existingNotifs.empty) {
            await addDoc(notifsRef, {
              message: "Attention collectes manquantes à compléter SVP",
              type: "collectes_manquantes",
              dateJour: todayStr,
              createdAt: serverTimestamp(),
              cible: "tous_mediateurs",
              lu: false
            });
          }
        } catch (error) {
          console.error("Erreur lors de l'envoi de l'alerte :", error);
        }
      }
    };

    if (creneaux.length > 0 && Object.keys(statutsVisitesRealtime).length > 0) {
      testerEtEnvoyerAlerteJourMeme();
    }
  }, [creneaux, statutsVisitesRealtime]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = React.useMemo(
    () => Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => new Date(year, month, i + 1)),
    [year, month]
  );

  // Analytique du mois affiché : recalculée uniquement quand une de ses
  // dépendances change, plutôt qu'à chaque rendu (frappe clavier ailleurs
  // sur la page, écho Firestore d'une écriture optimiste, etc.)
  const {
    filteredCreneauxDuMois,
    totalCreneauxOuverts,
    totalOuvertsRN,
    totalOuvertsDomicile,
    totalCreneauxRemplis,
    totalRemplisRN,
    totalRemplisRND,
    totalCollecteTech,
    tauxOccupation,
    tauxParticipation,
    usagersDuMoisUniques,
    rnHommesUniques,
    rnFemmesUniques,
    rndHommesUniques,
    rndFemmesUniques,
    collTechHommesUniques,
    collTechFemmesUniques,
  } = React.useMemo(() => {
    const filteredCreneauxDuMois = creneauxDuSite.filter(c => {
      if (!c.date) return false;
      const parts = c.date.split("-");
      return parseInt(parts[0]) === year && (parseInt(parts[1]) - 1) === month;
    });

    const totalCreneauxOuverts = filteredCreneauxDuMois.length;
    const creneauxDuMoisRemplis = filteredCreneauxDuMois.filter(c => c.usager && c.usager.trim() !== "");
    const totalCreneauxRemplis = creneauxDuMoisRemplis.length;

    // Détail RN (sur place) / à Domicile parmi les créneaux ouverts. En
    // pratique, un créneau à domicile est posé depuis l'agenda des médiateurs
    // via le suffixe "(RND)" sur le nom du médiateur (même détection que
    // "isRND" plus bas, utilisée par la carte "Créneaux réservés") ; le champ
    // "site" brut contenant "domicile" ne concerne que d'anciens créneaux
    // importés et reste vérifié en repli.
    let totalOuvertsDomicile = 0;
    let totalOuvertsRN = 0;
    filteredCreneauxDuMois.forEach(c => {
      const estDomicile = c.mediateurNom?.includes("(RND)") || (c.site || "").toUpperCase().includes("DOMICILE");
      if (estDomicile) totalOuvertsDomicile++;
      else totalOuvertsRN++;
    });

    let totalRemplisRN = 0;
    let totalRemplisRND = 0;
    let totalCollecteTech = 0;

    creneauxDuMoisRemplis.forEach(c => {
      const nomNettoye = (c.mediateurNom || "").replace(" (RND)", "").replace(" (RN91)", "").replace(" (RN)", "").trim().toLowerCase();
      const isOrphan = !mediateursActifs.includes(nomNettoye);

      if (!isOrphan) {
        if (c.mediateurNom?.includes("(RND)")) {
          totalRemplisRND++;
        } else {
          totalRemplisRN++;
        }
      }

      if (c.thematique && c.thematique.startsWith("Collecte Tech")) {
        totalCollecteTech++;
      }
    });

    const tauxOccupation = totalCreneauxOuverts > 0 ? Math.round((totalCreneauxRemplis / totalCreneauxOuverts) * 100) : 0;

    const creneauxPointes = filteredCreneauxDuMois.filter(c => {
      const uniqueKey = `${c.id}_${c.date}`;
      return statutsVisitesRealtime[uniqueKey] === "Présent";
    }).length;
    const tauxParticipation = totalCreneauxRemplis > 0 ? Math.round((creneauxPointes / totalCreneauxRemplis) * 100) : 0;

    const usagersDuMoisUniques = Array.from(new Set(
      filteredCreneauxDuMois
        .map(c => (c.usager || "").trim().toLowerCase())
        .filter(Boolean)
    ));

    let rnHommesUniques = 0;
    let rnFemmesUniques = 0;
    let rndHommesUniques = 0;
    let rndFemmesUniques = 0;
    let collTechHommesUniques = 0;
    let collTechFemmesUniques = 0;

    usagersDuMoisUniques.forEach(usagerNom => {
      const prof = beneficiaires.find(b => `${b.prenom.trim()} ${b.nom.trim()}`.toLowerCase() === usagerNom);

      const aEuCollecteTech = filteredCreneauxDuMois.some(c =>
        (c.usager || "").trim().toLowerCase() === usagerNom && (c.thematique || "").startsWith("Collecte Tech")
      );
      const aEuRND = filteredCreneauxDuMois.some(c =>
        (c.usager || "").trim().toLowerCase() === usagerNom && c.mediateurNom?.includes("(RND)")
      );

      if (prof && prof.sexe) {
        const g = prof.sexe.toLowerCase();
        const isH = g.startsWith("h") || g.includes("homme");
        const isF = g.startsWith("f") || g.includes("femme");

        if (aEuCollecteTech) {
          if (isH) collTechHommesUniques++;
          if (isF) collTechFemmesUniques++;
        } else if (aEuRND) {
          if (isH) rndHommesUniques++;
          if (isF) rndFemmesUniques++;
        } else {
          if (isH) rnHommesUniques++;
          if (isF) rnFemmesUniques++;
        }
      }
    });

    return {
      filteredCreneauxDuMois,
      totalCreneauxOuverts,
      totalOuvertsRN,
      totalOuvertsDomicile,
      totalCreneauxRemplis,
      totalRemplisRN,
      totalRemplisRND,
      totalCollecteTech,
      tauxOccupation,
      tauxParticipation,
      usagersDuMoisUniques,
      rnHommesUniques,
      rnFemmesUniques,
      rndHommesUniques,
      rndFemmesUniques,
      collTechHommesUniques,
      collTechFemmesUniques,
    };
  }, [creneauxDuSite, year, month, mediateursActifs, beneficiaires, statutsVisitesRealtime]);

  // Disponibilité par jour pour la mini-vue mois ci-dessous : rouge si aucun
  // créneau libre ce jour-là (qu'il n'y ait aucun créneau du tout — "pas de
  // RN" — ou qu'ils soient tous occupés), vert dès qu'il en reste au moins un
  // — le nombre affiché est celui des créneaux encore libres.
  const disponibiliteParJour = React.useMemo(() => {
    const map: Record<string, number> = {};
    days.forEach((day) => {
      const dateStr = day.toLocaleDateString('en-CA');
      map[dateStr] = filteredCreneauxDuMois.filter((c) => c.date === dateStr && (!c.usager || c.usager.trim() === "")).length;
    });
    return map;
  }, [days, filteredCreneauxDuMois]);

  const allerAuJour = (dateStr: string) => {
    document.getElementById(`jour-${dateStr}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleThematiqueChange = async (creneauId: string, nouvelleThematique: string) => {
    try {
      await updateDoc(doc(db, "planning_suresnes", creneauId), { thematique: nouvelleThematique });
    } catch (error) {
      console.error("Erreur thématique :", error);
    }
  };

  // Debounce (500ms) : évite un updateDoc Firestore à chaque caractère tapé.
  // demandeSpecifiqueLocal garde l'affichage réactif pendant la frappe, en
  // attendant que l'écriture (différée) soit effective.
  const [demandeSpecifiqueLocal, setDemandeSpecifiqueLocal] = useState<Record<string, string>>({});
  const demandeSpecifiqueTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = demandeSpecifiqueTimers.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  const handleDemandeSpecifiqueChange = (creneauId: string, valeur: string) => {
    setDemandeSpecifiqueLocal(prev => ({ ...prev, [creneauId]: valeur }));

    if (demandeSpecifiqueTimers.current[creneauId]) {
      clearTimeout(demandeSpecifiqueTimers.current[creneauId]);
    }

    demandeSpecifiqueTimers.current[creneauId] = setTimeout(async () => {
      try {
        await updateDoc(doc(db, "planning_suresnes", creneauId), { demandeSpecifique: valeur });
      } catch (error) {
        console.error("Erreur demande spécifique :", error);
      } finally {
        setDemandeSpecifiqueLocal(prev => {
          const { [creneauId]: _omit, ...rest } = prev;
          return rest;
        });
      }
    }, 500);
  };

  const toggleTodayFilter = () => {
    if (!filterTodayOnly) setViewDate(new Date());
    setFilterTodayOnly(!filterTodayOnly);
  };

  const supprimerCreneauLibre = async (id: string, usager: string) => {
    if (usager && usager.trim() !== "") {
      showToast("Impossible de supprimer : un usager est inscrit sur ce créneau.", "error");
      return;
    }
    if (!confirm("Supprimer ce créneau ?")) return;
    await deleteDoc(doc(db, "planning_suresnes", id));
  };

  return (
    <PageGuard pageId="page_access_suresnes">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                {SITES.find(s => s.id === siteActif)?.label} <span className="text-[#EA601F] font-normal">— Rencontres Numériques</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5">
                Suivi des rendez-vous, thématiques et présence des médiateurs
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Link 
              href="/" 
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>

            <PermissionGuard actionId="suresnes_filter_today">
              <button
                onClick={toggleTodayFilter}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer shadow-sm ${
                  filterTodayOnly
                    ? "bg-[#005259] text-white border-[#005259]"
                    : "bg-white hover:bg-[#005259] hover:text-white border-[#404040]/10 text-[#005259]"
                }`}
              >
                <ClockIcon className={`w-4 h-4 ${filterTodayOnly ? "text-white" : "text-[#EA601F]"}`} />
                <span>Aujourd'hui</span>
              </button>
            </PermissionGuard>

            <PermissionGuard actionId="suresnes_nav_beneficiaires">
              <Link
                href="/mediation/rencontres-numeriques/liste-beneficiaires"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <UsersIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Bénéficiaires</span>
              </Link>
            </PermissionGuard>

            <PermissionGuard actionId="suresnes_nav_agenda_med">
              <Link
                href="/agenda"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Agenda Médiateurs</span>
              </Link>
            </PermissionGuard>

            {/* SÉLECTEUR DE MOIS */}
            <PermissionGuard actionId="suresnes_month_nav">
              <div className="flex bg-white border border-[#404040]/10 rounded-xl p-1 items-center gap-1 shadow-sm">
                <button onClick={() => { setViewDate(new Date(year, month - 1, 1)); setFilterTodayOnly(false); }} className="p-1.5 hover:bg-[#F3F3F2] rounded-lg text-[#404040] transition-all cursor-pointer">
                  <ChevronLeftIcon className="w-4 h-4"/>
                </button>
                <span className="text-xs font-bold text-[#005259] uppercase tracking-wider min-w-32 text-center">
                  {viewDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => { setViewDate(new Date(year, month + 1, 1)); setFilterTodayOnly(false); }} className="p-1.5 hover:bg-[#F3F3F2] rounded-lg text-[#404040] transition-all cursor-pointer">
                  <ChevronRightIcon className="w-4 h-4"/>
                </button>
              </div>
            </PermissionGuard>
          </div>
        </div>

        {/* SÉLECTEUR DE SITE */}
        <div className="flex items-center flex-wrap gap-1.5 bg-white p-1.5 rounded-2xl border border-[#404040]/10 shadow-sm w-fit max-w-full">
          {sitesPrincipaux.map(site => (
            <button
              key={site.id}
              onClick={() => setSiteActif(site.id)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                siteActif === site.id ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/70 hover:text-[#005259] hover:bg-[#F3F3F2]"
              }`}
            >
              {site.label}
            </button>
          ))}

          {sitesGroupePRA.length > 0 && (
            <div ref={groupePRARef} className="relative">
              <button
                onClick={() => setGroupePRAOuvert(v => !v)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  sitesGroupePRA.some(s => s.id === siteActif) ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/70 hover:text-[#005259] hover:bg-[#F3F3F2]"
                }`}
              >
                <span>{sitesGroupePRA.find(s => s.id === siteActif)?.label || "Paris Résidence Autonomie"}</span>
                <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform ${groupePRAOuvert ? "rotate-90" : ""}`} />
              </button>
              {groupePRAOuvert && (
                <div className="absolute left-0 top-full mt-1 min-w-[220px] bg-white border border-[#404040]/15 rounded-xl shadow-xl z-[100] overflow-hidden divide-y divide-[#404040]/5">
                  {sitesGroupePRA.map(site => (
                    <button
                      key={site.id}
                      onClick={() => { setSiteActif(site.id); setGroupePRAOuvert(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                        siteActif === site.id ? "bg-[#005259]/10 text-[#005259]" : "text-[#404040] hover:bg-[#F3F3F2]"
                      }`}
                    >
                      {site.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {estSiteResidenceAutonomie ? (
        /* AGENDA RÉSIDENCE AUTONOMIE — construit directement depuis les fiches
           bénéficiaires (champ Lieu d'accueil) plutôt que depuis des créneaux
           saisis à la main : simple liste des personnes rattachées à ce lieu,
           puis liste chronologique de leurs visites du mois sélectionné. */
        <div className="space-y-4">
        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#F3F3F2] px-5 py-3 border-b border-[#404040]/10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#005259]">
              Bénéficiaires rattachés à ce lieu d'accueil ({beneficiairesDeLaResidence.length})
            </span>
          </div>
          {beneficiairesDeLaResidence.length > 0 ? (
            <div className="divide-y divide-[#404040]/5">
              {beneficiairesDeLaResidence.map(b => (
                <div key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[#005259] uppercase truncate">{b.nom || "SANS NOM"}</div>
                    <div className="text-xs text-[#404040]">{b.prenom || "Sans prénom"}</div>
                  </div>
                  <div className="text-xs text-[#404040]/70 shrink-0 hidden sm:block">{b.telephone}</div>
                  <div className="text-xs shrink-0 text-center min-w-[110px] hidden md:block">
                    <div className="text-[9px] font-bold uppercase text-[#404040]/50">Dernière visite</div>
                    <div className={derniereVisiteParBeneficiaire[b.id] ? "text-[#005259] font-bold" : "text-[#404040]/40 italic"}>
                      {derniereVisiteParBeneficiaire[b.id]
                        ? new Date(derniereVisiteParBeneficiaire[b.id]).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "Aucune"}
                    </div>
                  </div>
                  <Link
                    href={`/mediation/rencontres-numeriques/liste-beneficiaires/${b.id}`}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#005259] hover:bg-[#EA601F] text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all"
                  >
                    Ouvrir
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/50">
              Aucun bénéficiaire n'a ce lieu d'accueil renseigné sur sa fiche.
            </div>
          )}
        </div>

        {/* VISITES DU MOIS — même sélecteur de mois (viewDate) que le reste
            de la page, liste chaque visite individuellement plutôt que la
            seule dernière par personne. */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#F3F3F2] px-5 py-3 border-b border-[#404040]/10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#005259]">
              Visites de {viewDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })} ({visitesDuMoisResidence.length})
            </span>
          </div>
          {visitesDuMoisResidence.length > 0 ? (
            <div className="divide-y divide-[#404040]/5">
              {visitesDuMoisResidence.map((v, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="text-xs font-bold text-[#005259] min-w-[90px]">
                    {new Date(v.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-sm text-[#404040] uppercase truncate">{v.beneficiaire?.nom || "SANS NOM"}</span>{" "}
                    <span className="text-xs text-[#404040]/70">{v.beneficiaire?.prenom}</span>
                  </div>
                  {v.moment && (
                    <span className="text-[9px] font-bold uppercase text-[#404040]/50 shrink-0">{v.moment}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/50">
              Aucune visite enregistrée ce mois-ci.
            </div>
          )}
        </div>
        </div>
        ) : (
        <>

        {/* MINI VUE MOIS — repère rapide des jours avec/sans disponibilité,
            pour éviter de dérouler toute la liste ci-dessous. Un clic sur un
            jour y fait défiler directement (voir allerAuJour/id="jour-..."). */}
        <Accordion
          title={`Disponibilités du mois — ${viewDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`}
          open={miniMoisOuvert}
          onToggle={() => setMiniMoisOuvert((v) => !v)}
          headerClassName="bg-[#F9C44E]/25 hover:bg-[#F9C44E]/35"
        >
            <div className="flex items-center justify-end gap-3 text-[9px] font-bold uppercase text-[#404040]/50 mb-1">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#A9E0C9]" /> Disponible</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#EF736A]" /> Complet</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 max-w-[380px] mx-auto">
              {["L", "M", "M", "J", "V", "S", "D"].map((j, idx) => (
                <div key={idx} className="text-center text-[9px] font-bold uppercase text-[#404040]/40">{j}</div>
              ))}
              {Array.from({ length: (days[0].getDay() + 6) % 7 }, (_, i) => <div key={`vide-${i}`} />)}
              {days.map((day) => {
                const dateStr = day.toLocaleDateString('en-CA');
                const nbDisponibles = disponibiliteParJour[dateStr] || 0;
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => allerAuJour(dateStr)}
                    title={nbDisponibles > 0 ? `${nbDisponibles} créneau(x) disponible(s)` : "Complet / aucun créneau"}
                    className={`aspect-square max-w-12 mx-auto w-full rounded-lg flex flex-col items-center justify-center leading-tight transition-transform hover:scale-110 cursor-pointer ${
                      nbDisponibles > 0 ? "bg-[#A9E0C9]/40 text-[#005259]" : "bg-[#EF736A]/20 text-[#EF736A]"
                    }`}
                  >
                    <span className="text-base font-bold">{day.getDate()}</span>
                    {nbDisponibles > 0 && <span className="text-xs font-black">{nbDisponibles}</span>}
                  </button>
                );
              })}
            </div>
          </Accordion>

        {/* ANALYTICS / KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-white border border-[#404040]/10 rounded-2xl flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] uppercase font-bold tracking-widest text-[#404040]/70">Créneaux ouverts ({viewDate.toLocaleString('fr-FR', { month: 'short' })})</span>
            {siteActif === "suresnes" ? (
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-[#005259]">{totalCreneauxOuverts} <span className="text-xs text-[#404040]/50 font-normal">dispos</span></span>
                <div className="flex gap-2 text-right">
                  <div>
                    <span className="text-[8px] text-[#404040]/60 block font-bold uppercase">RN</span>
                    <span className="text-[11px] font-bold text-[#005259]">{totalOuvertsRN}</span>
                  </div>
                  <div className="w-px bg-[#404040]/10 self-stretch my-0.5"></div>
                  <div>
                    <span className="text-[8px] text-[#404040]/60 block font-bold uppercase">Domicile</span>
                    <span className="text-[11px] font-bold text-[#F9C44E]">{totalOuvertsDomicile}</span>
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-2xl font-bold text-[#005259] mt-2">{totalCreneauxOuverts} <span className="text-xs text-[#404040]/50 font-normal">dispos</span></span>
            )}
          </div>
          
          <div className="p-4 bg-white border border-[#404040]/10 rounded-2xl flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] uppercase font-bold tracking-widest text-[#404040]/70">Créneaux réservés</span>
            <div className="flex items-center justify-between mt-2">
              <div>
                <span className="text-2xl font-bold text-[#EA601F]">{totalCreneauxRemplis}</span>
                <span className="text-[9px] text-[#EA601F] font-bold block mt-1 bg-[#EA601F]/10 border border-[#EA601F]/30 rounded px-1.5 py-0.5 w-max uppercase">
                  COLL TECH: {totalCollecteTech}
                </span>
              </div>
              <div className="flex gap-2 text-right">
                <div>
                  <span className="text-[8px] text-[#404040]/60 block font-bold uppercase">{siteActif === "rn91" ? "RN91" : siteActif === "suresnes" ? "RN" : SITES.find(s => s.id === siteActif)?.label}</span>
                  <span className="text-[11px] font-bold text-[#005259]">{totalRemplisRN}</span>
                </div>
                {siteActif === "suresnes" && (
                  <>
                    <div className="w-px bg-[#404040]/10 self-stretch my-0.5"></div>
                    <div>
                      <span className="text-[8px] text-[#404040]/60 block font-bold uppercase">RND</span>
                      <span className="text-[11px] font-bold text-[#EA601F]">{totalRemplisRND}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-white border border-[#404040]/10 rounded-2xl flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] uppercase font-bold tracking-widest text-[#404040]/70">Taux de remplissage</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-[#005259]">{tauxOccupation}%</span>
              <div className="w-16 bg-[#F3F3F2] border border-[#404040]/10 h-2 rounded-full overflow-hidden hidden sm:block">
                <div className="bg-[#005259] h-full rounded-full transition-all duration-500" style={{ width: `${tauxOccupation}%` }}></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-[#404040]/10 rounded-2xl flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] uppercase font-bold tracking-widest text-[#404040]/70">Taux participation</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-[#F9945D]">{tauxParticipation}%</span>
              <div className="w-16 bg-[#F3F3F2] border border-[#404040]/10 h-2 rounded-full overflow-hidden hidden sm:block">
                <div className="bg-[#F9945D] h-full rounded-full transition-all duration-500" style={{ width: `${tauxParticipation}%` }}></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-[#404040]/10 rounded-2xl col-span-2 md:col-span-1 flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] uppercase font-bold tracking-widest text-[#005259]">Public unique (Mois)</span>
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#404040]/70 font-bold uppercase text-[9px] tracking-wide">{siteActif === "rn91" ? "RN91 :" : siteActif === "suresnes" ? "RN :" : `${SITES.find(s => s.id === siteActif)?.label} :`}</span>
                <div className="flex gap-2 text-[#404040]">
                  <span>H:<b className="text-[#005259]">{rnHommesUniques}</b></span>
                  <span>F:<b className="text-[#EA601F]">{rnFemmesUniques}</b></span>
                </div>
              </div>
              {siteActif === "suresnes" && (
                <>
                  <div className="h-px bg-[#404040]/10"></div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#EA601F] font-bold uppercase text-[9px] tracking-wide">RND :</span>
                    <div className="flex gap-2 text-[#404040]">
                      <span>H:<b className="text-[#005259]">{rndHommesUniques}</b></span>
                      <span>F:<b className="text-[#EA601F]">{rndFemmesUniques}</b></span>
                    </div>
                  </div>
                </>
              )}
              <div className="h-px bg-[#404040]/10"></div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#F9945D] font-bold uppercase text-[9px] tracking-wide">Coll. Tech :</span>
                <div className="flex gap-2 text-[#404040]">
                  <span>H:<b className="text-[#005259]">{collTechHommesUniques}</b></span>
                  <span>F:<b className="text-[#EA601F]">{collTechFemmesUniques}</b></span>
                </div>
              </div>
              <div className="h-px bg-[#404040]/10"></div>
              <div className="text-right text-[10px] text-[#404040]/60 font-medium">
                Total : <span className="text-[#005259] font-bold text-xs">{usagersDuMoisUniques.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* AGENDA DU MOIS */}
        <div className="space-y-6">
          {days.map((day, i) => {
            const dateStr = day.toLocaleDateString('en-CA'); 
            const todayStr = new Date().toLocaleDateString('en-CA');

            if (filterTodayOnly && dateStr !== todayStr) return null;

            const entries = creneauxDuSite.filter(c => c.date === dateStr);
            if (entries.length === 0) return null;

            return (
              <div id={`jour-${dateStr}`} key={i} className={`bg-white border rounded-2xl shadow-sm overflow-hidden scroll-mt-4 ${dateStr === todayStr ? 'border-[#005259] ring-1 ring-[#005259]' : 'border-[#404040]/10'}`}>
                
                <div className="bg-[#F3F3F2] px-5 py-3 border-b border-[#404040]/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" />
                    <span className={`text-xs font-bold uppercase tracking-wider ${dateStr === todayStr ? 'text-[#005259]' : 'text-[#404040]'}`}>
                      {day.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' })}
                      {dateStr === todayStr && " (Aujourd'hui)"}
                    </span>
                  </div>
                </div>
                
                <div className="divide-y divide-[#404040]/5">
                  {["Matin", "Après-midi"].map(moment => {
                    const sessionEntries = entries.filter(e => e.moment === moment);
                    if (sessionEntries.length === 0) return null;

                    return (
                      <div key={moment} className="p-4">
                        <div className="px-1 pb-3 text-[10px] font-bold uppercase tracking-widest text-[#404040]/60 flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${moment === 'Matin' ? 'bg-[#EA601F]' : 'bg-[#005259]'}`}></span>
                          Session {moment}
                        </div>
                        
                        <div className="space-y-2">
                          {sessionEntries.map(c => {
                            const nomNettoye = (c.mediateurNom || "").replace(" (RND)", "").replace(" (RN91)", "").replace(" (RN)", "").trim().toLowerCase();
                            // Un créneau historique sans médiateur assigné (ancien ajout
                            // manuel) n'a volontairement aucun médiateur — à distinguer d'un
                            // vrai créneau orphelin (nom d'agenda qui ne correspond à personne).
                            const creneauLibre = nomNettoye === "";
                            const isOrphan = !creneauLibre && !mediateursActifs.includes(nomNettoye);
                            const isRND = c.mediateurNom?.includes("(RND)");
                            // Suresnes et "Suresnes - à domicile" partagent le même onglet
                            // (voir normaliserSiteId) : le champ "site" brut (non normalisé)
                            // garde la mention "domicile", utilisée ici pour distinguer
                            // visuellement ces créneaux du reste de la grille.
                            const estDomicile = (c.site || "").toUpperCase().includes("DOMICILE");
                            const nomAffiche = creneauLibre ? "Créneau libre" : c.mediateurNom?.replace(" (RND)", "").replace(" (RN91)", "").replace(" (RN)", "");
                            
                            const bTrouve = beneficiaires.find(
                              b => `${b.prenom.trim()} ${b.nom.trim()}`.toLowerCase() === (c.usager || "").trim().toLowerCase()
                            );

                            const uniqueKey = `${c.id}_${c.date}`;
                            const currentStatutFiche = statutsVisitesRealtime[uniqueKey] || "Non suivi";
                            const totalPresentsUsager = bTrouve ? (totalVisitesPresents[bTrouve.id] || 0) : 0;

                            const thématiqueMatériel = c.thematique === "Ordinateur" || c.thematique === "Smartphone";
                            const aDejaFaitCetteThematique = bTrouve && thematiquesVisitees[bTrouve.id]?.includes(c.thematique);
                            const trendBesoinDiagnostic = bTrouve && thématiqueMatériel && !aDejaFaitCetteThematique;

                            return (
                              <div key={c.id} className={`grid grid-cols-1 xl:grid-cols-12 items-center gap-4 p-3 rounded-xl border transition-all ${isOrphan ? 'bg-[#EF736A]/10 border-[#EF736A]/30' : estDomicile ? 'bg-[#F9C44E]/[0.12] border-[#F9C44E]/40 hover:border-[#F9C44E]' : isRND ? 'bg-[#EA601F]/5 border-[#EA601F]/20 hover:border-[#EA601F]/40' : 'bg-[#F3F3F2]/50 border-[#404040]/10 hover:border-[#005259]/30 hover:bg-[#F3F3F2]'}`}>

                                <div className="xl:col-span-2 flex items-center gap-3 min-w-0">
                                  <div className="p-2 rounded-lg bg-white border border-[#404040]/10 text-[#005259] shrink-0 shadow-sm">
                                    <UserIcon className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-sm flex items-center gap-2 min-w-0">
                                      {isOrphan && <ExclamationTriangleIcon className="w-4 h-4 text-[#EF736A] shrink-0" />}
                                      <span className={`truncate min-w-0 ${isOrphan ? "text-[#EF736A]" : "text-[#005259]"}`}>{nomAffiche}</span>
                                      {isRND && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EA601F]/10 border border-[#EA601F]/30 text-[#EA601F] shrink-0">RND</span>}
                                      {estDomicile && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F9C44E]/20 border border-[#F9C44E] text-[#005259] shrink-0">Domicile</span>}
                                    </div>
                                    {creneauLibre && (
                                      <button
                                        onClick={() => supprimerCreneauLibre(c.id, c.usager)}
                                        title="Supprimer ce créneau"
                                        className="mt-1 px-2 py-0.5 bg-[#404040]/5 hover:bg-[#EF736A] text-[#404040]/60 hover:text-white border border-[#404040]/15 hover:border-[#EF736A] rounded-lg text-[9px] font-bold uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-1"
                                      >
                                        <TrashIcon className="w-3 h-3" />
                                        Supprimer
                                      </button>
                                    )}
                                    {isOrphan && (
                                      <PermissionGuard actionId="suresnes_reassign">
                                        <button onClick={() => {
                                          setReassignSearch("");
                                          setReassignCreneau({ id: c.id, currentName: nomAffiche || c.mediateurNom || "", site: normaliserSiteId(c.site), isRND });
                                        }} className="mt-1 px-2 py-0.5 bg-[#EF736A]/20 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/40 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-colors cursor-pointer">
                                          Réaffecter
                                        </button>
                                      </PermissionGuard>
                                    )}
                                  </div>
                                </div>

                                <div className="xl:col-span-1 flex items-center gap-2 text-[#404040]">
                                  <ClockIcon className="w-4 h-4 text-[#EA601F]" />
                                  <span className="text-xs font-bold">{c.horaire}</span>
                                </div>
                                
                                <div className="xl:col-span-3 w-full">
                                  <UsagerInput
                                    docId={c.id}
                                    initialValue={c.usager}
                                    beneficiairesListe={beneficiaires}
                                    afficherAlerteSuresnes={siteActif === "suresnes"}
                                    afficherChampVille={siteActif === "rn91"}
                                    estRND={isRND}
                                    visitesDomicileParBeneficiaire={visitesDomicileAnneeParBeneficiaire}
                                    quotaDomicile={QUOTA_DOMICILE_PAR_AN}
                                  />
                                </div>

                                <div className="xl:col-span-2 w-full">
                                  <PermissionGuard actionId="suresnes_slot_thematique_edit">
                                  <div className="flex items-center gap-2 bg-white border border-[#404040]/15 focus-within:border-[#005259] rounded-xl px-3 py-1.5 transition-all shadow-sm">
                                    <TagIcon className="w-3.5 h-3.5 text-[#404040]/40 shrink-0" />
                                    <select
                                      disabled={!c.usager}
                                      value={c.thematique || ""}
                                      onChange={(e) => handleThematiqueChange(c.id, e.target.value)}
                                      className="w-full bg-transparent border-none p-0 text-xs font-bold text-[#404040] outline-none focus:ring-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      <option value="" className="text-[#404040]/40">-- Thématique --</option>
                                      <option value="Ordinateur">💻 Ordinateur</option>
                                      <option value="Smartphone">📱 Smartphone</option>
                                      <option value="Premiers pas vers le numérique">🌱 Premiers pas vers le numérique</option>
                                      <option value="Gestion documentaire">📂 Gestion documentaire</option>
                                      <option value="Communiquer par internet">🌐 Communiquer par internet</option>
                                      <option value="Utilisation sécurisée d’internet">🔒 Utilisation sécurisée d’internet</option>
                                      <option value="Le numérique au quotidien">☀️ Le numérique au quotidien</option>
                                      <option value="Accès aux droits et aux offres de soin">🩺 Accès aux droits et aux offres de soin</option>
                                      <option value="Les outils pour la vie professionnelle">💼 Les outils pour la vie professionnelle</option>
                                      <option value="Recherche d’emploi sur internet">🔍 Recherche d’emploi sur internet</option>
                                      <option value="Choisir ses logiciels informatiques">⚙️ Choisir ses logiciels informatiques</option>
                                      <option value="Création multimédia">🎨 Création multimédia</option>
                                      <option value="Outils informatiques pour la fabrication">🛠️ Outils informatiques pour la fabrication</option>
                                      <option value="Collecte Tech" className="text-[#EA601F] font-bold">🧺 Collecte Tech</option>
                                      <option value="Collecte Tech - Remise de matériel" className="text-[#EA601F] font-bold">🧺 Collecte Tech - Remise de matériel</option>
                                      <option value="Collecte Tech - Tests de positionnement" className="text-[#EA601F] font-bold">🧺 Collecte Tech - Tests de positionnement</option>
                                      {c.thematique && !THEMATIQUES_CONNUES.includes(c.thematique) && (
                                        <option value={c.thematique}>{c.thematique}</option>
                                      )}
                                    </select>
                                  </div>
                                  </PermissionGuard>
                                </div>

                                <div className="xl:col-span-1.5 flex items-center justify-start xl:justify-center">
                                  {trendBesoinDiagnostic ? (
                                    <Link href={`/mediation/rencontres-numeriques/liste-beneficiaires/${bTrouve.id}`} className="inline-flex items-center gap-1.5 bg-[#EA601F] hover:bg-[#EF736A] text-white px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm group w-full justify-center">
                                      <PlusIcon className="w-3 h-3 stroke-[3] group-hover:scale-125 transition-transform" />
                                      <span>Diagnostic</span>
                                    </Link>
                                  ) : bTrouve && thématiqueMatériel && aDejaFaitCetteThematique ? (
                                    <span className="inline-flex items-center justify-center gap-1 text-[10px] font-bold text-[#404040]/50 bg-white px-2 py-1 rounded border border-[#404040]/10 w-full text-center">
                                      <ClipboardDocumentCheckIcon className="w-3 h-3 opacity-60" /> Déjà diag.
                                    </span>
                                  ) : (
                                    <span className="text-[#404040]/30 text-xs hidden xl:block">—</span>
                                  )}
                                </div>

                                <div className="xl:col-span-1 flex items-center justify-start xl:justify-center gap-1.5 text-[#404040]">
                                  {bTrouve ? (
                                    <div className="flex items-center gap-1 bg-white border border-[#404040]/10 px-2 py-1 rounded-xl text-xs w-full justify-center shadow-sm" title="Total des visites">
                                      <ChartBarIcon className="w-3.5 h-3.5 text-[#005259]" />
                                      <span className="font-bold text-[#005259]">{totalPresentsUsager}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-[#404040]/30 hidden xl:block">—</span>
                                  )}
                                </div>

                                <div className="xl:col-span-2 w-full">
                                  <PermissionGuard actionId="suresnes_slot_demande_edit">
                                  <div className="flex items-center gap-1.5 bg-[#FFFFFF] border border-[#404040]/15 focus-within:border-[#005259] rounded-xl px-3 py-1.5 transition-all shadow-sm">
                                    <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5 text-[#404040]/40 shrink-0" />
                                    <input
                                      type="text"
                                      disabled={!c.usager}
                                      value={demandeSpecifiqueLocal[c.id] ?? c.demandeSpecifique ?? ""}
                                      onChange={(e) => handleDemandeSpecifiqueChange(c.id, e.target.value)}
                                      placeholder="Demande (ex: photos...)"
                                      className="w-full bg-transparent border-none p-0 text-xs text-[#404040] placeholder-[#404040]/40 outline-none focus:ring-0 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                                    />
                                  </div>
                                  </PermissionGuard>
                                </div>
                                
                                <div className="xl:col-span-1 text-left xl:text-right shrink-0">
                                  {!bTrouve ? (
                                    <span className="inline-block text-center w-full text-[#404040]/50 bg-white border border-[#404040]/10 px-2 py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase shadow-sm">
                                      À attribuer
                                    </span>
                                  ) : currentStatutFiche === "Présent" ? (
                                    <Link 
                                      href={`/mediation/rencontres-numeriques/liste-beneficiaires/${bTrouve.id}`}
                                      className="inline-flex items-center justify-center gap-1 w-full text-[#005259] bg-[#A9E0C9]/30 border border-[#A9E0C9] hover:bg-[#A9E0C9]/50 px-2 py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all shadow-sm"
                                    >
                                      <CheckCircleIcon className="w-3 h-3 text-[#005259]" />
                                      Présent
                                    </Link>
                                  ) : currentStatutFiche === "Absent" ? (
                                    <Link 
                                      href={`/mediation/rencontres-numeriques/liste-beneficiaires/${bTrouve.id}`}
                                      className="inline-flex items-center justify-center gap-1 w-full text-[#EF736A] bg-[#EF736A]/15 border border-[#EF736A]/30 hover:bg-[#EF736A]/25 px-2 py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all shadow-sm"
                                    >
                                      <XCircleIcon className="w-3 h-3" />
                                      Absent
                                    </Link>
                                  ) : (
                                    <Link 
                                      href={`/mediation/rencontres-numeriques/liste-beneficiaires/${bTrouve.id}`}
                                      className="inline-flex items-center justify-center gap-1 w-full text-[#EA601F] bg-[#F9945D]/15 border border-[#F9945D]/30 hover:bg-[#F9945D]/25 px-2 py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase transition-all shadow-sm"
                                    >
                                      <span className="text-[10px] leading-none">⏳</span>
                                      Fiche de suivi
                                    </Link>
                                  )}
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        </>
        )}

      </div>

      {/* MODALE DE RÉAFFECTATION — recherche dans la vraie liste des
          médiateurs plutôt qu'un prompt() en texte libre, pour éviter de
          retaper un nom orphelin qui redéclencherait l'alerte. */}
      {reassignCreneau && (() => {
        const suggestions = mediateursBruts
          .map((m: any) => `${(m.prenom || "").trim()} ${(m.nom || "").trim()}`.trim())
          .filter((nom: string) => nom && nom.toLowerCase().includes(reassignSearch.toLowerCase()));

        const confirmerReaffectation = async (nomChoisi: string) => {
          const nomComplet = reassignCreneau.isRND
            ? `${nomChoisi} (RND)`
            : reassignCreneau.site === "rn91"
              ? `${nomChoisi} (RN91)`
              : reassignCreneau.site === "suresnes"
                ? `${nomChoisi} (RN)`
                : nomChoisi;
          try {
            await updateDoc(doc(db, "planning_suresnes", reassignCreneau.id), { mediateurNom: nomComplet });
          } catch (e) { console.error(e); }
          setReassignCreneau(null);
        };

        return (
          <div className="fixed inset-0 bg-[#404040]/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white border border-[#404040]/10 p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
              <h3 className="font-bold text-sm text-[#005259] uppercase tracking-wide">Réaffecter le créneau</h3>

              <div className="bg-[#EF736A]/10 border border-[#EF736A]/30 rounded-xl p-3 text-xs">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#EF736A]/70">Actuellement affecté à</span>
                <span className="font-bold text-[#EF736A]">{reassignCreneau.currentName || "—"}</span>
              </div>

              <div>
                <label className="text-[10px] text-[#404040]/70 font-bold uppercase tracking-wider block mb-1">Nouveau médiateur</label>
                <input
                  autoFocus
                  type="text"
                  value={reassignSearch}
                  onChange={(e) => setReassignSearch(e.target.value)}
                  placeholder="Rechercher un médiateur..."
                  className="w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-xs text-[#404040] placeholder-[#404040]/40 outline-none font-medium"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border border-[#404040]/10 rounded-xl divide-y divide-[#404040]/5">
                {suggestions.length > 0 ? suggestions.map((nom: string) => (
                  <button
                    key={nom}
                    onClick={() => confirmerReaffectation(nom)}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-[#404040] hover:bg-[#F3F3F2] hover:text-[#005259] transition-colors cursor-pointer"
                  >
                    {nom}
                  </button>
                )) : (
                  <div className="px-3 py-4 text-center text-[11px] text-[#404040]/50 font-medium">Aucun médiateur trouvé.</div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setReassignCreneau(null)}
                  className="text-[#404040]/60 hover:text-[#404040] text-xs px-3 cursor-pointer transition-colors font-bold"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <ScrollToTopButton />
    </main>
    </PageGuard>
  );
}

// --- COMPO INPUT RECHERCHE AVEC ALERTE DE BLACKLIST INTERNE ---
function UsagerInput({ docId, initialValue, beneficiairesListe, afficherAlerteSuresnes, afficherChampVille, estRND = false, visitesDomicileParBeneficiaire, quotaDomicile }: {
  docId: string;
  initialValue: string;
  beneficiairesListe: Beneficiaire[];
  afficherAlerteSuresnes: boolean;
  afficherChampVille: boolean;
  estRND?: boolean;
  visitesDomicileParBeneficiaire?: Record<string, number>;
  quotaDomicile?: number;
}) {
  const { showToast } = useToast();
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<Beneficiaire[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNom, setNewNom] = useState("");
  const [newPrenom, setNewPrenom] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSexe, setNewSexe] = useState("Homme");
  const [newVille, setNewVille] = useState("");

  useEffect(() => { setValue(initialValue); }, [initialValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const matchingBeneficiaire = beneficiairesListe.find(
    b => `${b.prenom.trim()} ${b.nom.trim()}`.toLowerCase() === (value || "").trim().toLowerCase()
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    if (val.trim().length > 1) {
      setSuggestions(beneficiairesListe.filter(b => `${b.prenom} ${b.nom}`.toLowerCase().includes(val.toLowerCase())).slice(0, 5));
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const handleSelect = async (b: Beneficiaire) => {
    if (b.statutBlacklist === "Oui") {
      showToast(`🚫 IMPOSSIBLE : Le bénéficiaire "${b.prenom} ${b.nom.toUpperCase()}" est actuellement BLACKLISTÉ. Il ne peut pas être ajouté au planning.`, "error");
      setValue("");
      setShowDropdown(false);
      return;
    }

    const nomComplet = `${b.prenom.trim()} ${b.nom.trim().toUpperCase()}`;
    setValue(nomComplet);
    setShowDropdown(false);
    try {
      await updateDoc(doc(db, "planning_suresnes", docId), { usager: nomComplet });
    } catch(e) { console.error(e); }
  };

  const handleClear = async () => {
    setValue("");
    try {
      await updateDoc(doc(db, "planning_suresnes", docId), { usager: "", thematique: "", demandeSpecifique: "" });
    } catch(e) { console.error(e); }
  };

  const g = (matchingBeneficiaire?.sexe || "").toLowerCase();
  const isHomme = g.startsWith("h") || g.includes("homme");
  const isFemme = g.startsWith("f") || g.includes("femme");

  // Quota de 4 visites à domicile (RND) par an atteint ou dépassé — voir
  // visitesDomicileAnneeParBeneficiaire dans le composant parent.
  const nbVisitesDomicile = estRND && matchingBeneficiaire ? (visitesDomicileParBeneficiaire?.[matchingBeneficiaire.id] || 0) : 0;
  const quotaAtteint = estRND && quotaDomicile !== undefined && nbVisitesDomicile >= quotaDomicile;

  return (
    <div ref={containerRef} className="w-full relative">
      {matchingBeneficiaire ? (
        <div className="flex items-center justify-between bg-white border border-[#005259]/30 rounded-xl px-3 py-1.5 text-xs shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden w-full pr-1">
            {isHomme && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#005259]/10 border border-[#005259]/20 text-[#005259] font-bold shrink-0">H</span>
            )}
            {isFemme && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EA601F]/10 border border-[#EA601F]/20 text-[#EA601F] font-bold shrink-0">F</span>
            )}
            {!isHomme && !isFemme && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F3F3F2] border border-[#404040]/10 text-[#404040]/50 font-bold shrink-0">?</span>
            )}
            
            <span
              className={`font-bold truncate uppercase ${quotaAtteint ? "text-[#EA601F]" : "text-[#005259]"}`}
              title={quotaAtteint ? `⚠️ ${nbVisitesDomicile} visite(s) à domicile cette année — quota de ${quotaDomicile} atteint` : undefined}
            >
              <span className={`font-normal normal-case mr-1 ${quotaAtteint ? "text-[#EA601F]/80" : "text-[#404040]/70"}`}>{matchingBeneficiaire.prenom}</span>
              {matchingBeneficiaire.nom}
              {quotaAtteint && <ExclamationTriangleIcon className="w-3 h-3 inline-block ml-1 -mt-0.5" />}
            </span>
          </div>
          <PermissionGuard actionId="suresnes_slot_clear">
            <button onClick={handleClear} className="p-1 hover:bg-[#F3F3F2] rounded text-[#404040]/40 hover:text-[#EF736A] transition-colors cursor-pointer pl-2 border-l border-[#404040]/10 shrink-0">
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </PermissionGuard>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-white border border-[#404040]/15 focus-within:border-[#005259] rounded-xl px-3 py-1.5 transition-all gap-2 shadow-sm">
          <PermissionGuard actionId="suresnes_slot_assign">
            <input className="w-full bg-transparent border-none p-0 text-xs font-medium text-[#404040] placeholder-[#404040]/40 outline-none focus:ring-0" value={value || ""} placeholder="Rechercher un bénéficiaire..." onChange={handleInputChange} />
          </PermissionGuard>
          <PermissionGuard actionId="suresnes_create_slot">
            <button type="button" onClick={() => setIsModalOpen(true)} className="p-1 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-lg transition-colors shrink-0 cursor-pointer shadow-sm">
              <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </PermissionGuard>
        </div>
      )}

      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute left-0 top-full mt-1 w-full bg-white border border-[#404040]/15 rounded-xl shadow-xl z-[100] overflow-hidden divide-y divide-[#404040]/5">
          {suggestions.map(b => {
            const isSugFemme = (b.sexe || "").toLowerCase().startsWith("f");
            const isBanned = b.statutBlacklist === "Oui";

            return (
              <li key={b.id}>
                <button 
                  type="button" 
                  onClick={() => handleSelect(b)} 
                  className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 cursor-pointer group transition-colors ${
                    isBanned ? "hover:bg-[#EF736A]/20 bg-[#EF736A]/10 text-[#EF736A]" : "hover:bg-[#F3F3F2] text-[#404040]"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mr-1.5 ${
                      isSugFemme ? "bg-[#EA601F]/10 text-[#EA601F] border border-[#EA601F]/20" : "bg-[#005259]/10 text-[#005259] border border-[#005259]/20"
                    }`}>
                      {isSugFemme ? "F" : "H"}
                    </span>
                    <span className={isBanned ? "line-through opacity-70" : ""}>
                      {b.prenom} <span className="uppercase font-bold">{b.nom}</span>
                    </span>
                    {isBanned && <span className="ml-2 text-[9px] font-bold uppercase bg-[#EF736A] text-white px-1.5 py-0.5 rounded tracking-wide">🚫 Blacklisté</span>}
                  </div>
                  <div className="text-[10px] text-[#404040]/50">{b.telephone}</div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#404040]/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              await addDoc(collection(db, "utilisateurs"), {
                Nom: newNom.toUpperCase(),
                Prénom: newPrenom,
                Téléphone: newPhone || "Non renseigné",
                Sexe: newSexe,
                Statut_Blacklist: "Non",
                ...(afficherChampVille ? { Ville: newVille } : {}),
              });
              const label = `${newPrenom} ${newNom.toUpperCase()}`;
              await updateDoc(doc(db, "planning_suresnes", docId), { usager: label });
              setValue(label); setIsModalOpen(false);
            } catch(err) { console.error(err); }
          }} className="bg-white border border-[#404040]/10 p-6 rounded-2xl w-full max-w-xs space-y-4 shadow-2xl">
            
            {/* BANDEAU ROUGE D'ALERTE — ne concerne que le site Suresnes lui-même,
                pas RN-91 ni les Résidences Autonomie, qui accueillent des
                publics hors Suresnes par construction. */}
            {afficherAlerteSuresnes && (
              <div className="bg-[#EF736A]/10 border border-[#EF736A]/30 rounded-xl p-3 text-[#EF736A] text-xs flex items-center gap-2.5">
                <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-[#EF736A]" />
                <span className="font-bold leading-tight">
                  La personne habite-t-elle Suresnes ?
                </span>
              </div>
            )}

            <h3 className="font-bold text-sm text-[#005259] uppercase tracking-wide">Nouveau bénéficiaire</h3>
            <input placeholder="Prénom" value={newPrenom} className="w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-xs text-[#404040] placeholder-[#404040]/40 outline-none font-medium" required onChange={e => setNewPrenom(e.target.value)} />
            <input placeholder="Nom" value={newNom} className="w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-xs text-[#404040] placeholder-[#404040]/40 outline-none font-medium" required onChange={e => setNewNom(e.target.value)} />
            <input placeholder="Téléphone" value={newPhone} className="w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-xs text-[#404040] placeholder-[#404040]/40 outline-none font-medium" onChange={e => setNewPhone(e.target.value)} />
            {afficherChampVille && (
              <input placeholder="Ville" value={newVille} className="w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-xs text-[#404040] placeholder-[#404040]/40 outline-none font-medium" onChange={e => setNewVille(e.target.value)} />
            )}
            
            <div className="space-y-1">
              <label className="text-[10px] text-[#404040]/70 font-bold uppercase tracking-wider block">Genre</label>
              <select value={newSexe} onChange={e => setNewSexe(e.target.value)} className="w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-xs text-[#404040] outline-none font-medium">
                <option value="Homme">Homme</option>
                <option value="Femme">Femme</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-[#EA601F] hover:bg-[#EF736A] text-white py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow-md">Créer</button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-[#404040]/60 hover:text-[#404040] text-xs px-3 cursor-pointer transition-colors font-bold">Annuler</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
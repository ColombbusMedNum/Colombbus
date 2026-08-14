"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import PageGuard from "@/components/PageGuard";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useToast } from "@/components/ToastProvider";
import { useMediateurs } from "@/lib/MediateursProvider";
import {
  collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, collectionGroup, serverTimestamp, getDocs, where
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

interface Beneficiaire {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  sexe?: string;
  statutBlacklist?: string;
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
  const [viewDate, setViewDate] = useState(new Date());
  const [filterTodayOnly, setFilterTodayOnly] = useState(false);
  
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
            statutBlacklist: data.Statut_Blacklist || "Non"
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
          thematique: data.thematique
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
    const filteredCreneauxDuMois = creneaux.filter(c => {
      if (!c.date) return false;
      const parts = c.date.split("-");
      return parseInt(parts[0]) === year && (parseInt(parts[1]) - 1) === month;
    });

    const totalCreneauxOuverts = filteredCreneauxDuMois.length;
    const creneauxDuMoisRemplis = filteredCreneauxDuMois.filter(c => c.usager && c.usager.trim() !== "");
    const totalCreneauxRemplis = creneauxDuMoisRemplis.length;

    let totalRemplisRN = 0;
    let totalRemplisRND = 0;
    let totalCollecteTech = 0;

    creneauxDuMoisRemplis.forEach(c => {
      const nomNettoye = (c.mediateurNom || "").replace(" (RND)", "").replace(" (RN)", "").trim().toLowerCase();
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
  }, [creneaux, year, month, mediateursActifs, beneficiaires, statutsVisitesRealtime]);

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
                Suresnes <span className="text-[#EA601F] font-normal">— Rencontres Numériques</span>
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

        {/* ANALYTICS / KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-white border border-[#404040]/10 rounded-2xl flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] uppercase font-bold tracking-widest text-[#404040]/70">Créneaux ouverts ({viewDate.toLocaleString('fr-FR', { month: 'short' })})</span>
            <span className="text-2xl font-bold text-[#005259] mt-2">{totalCreneauxOuverts} <span className="text-xs text-[#404040]/50 font-normal">dispos</span></span>
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
                  <span className="text-[8px] text-[#404040]/60 block font-bold uppercase">RN</span>
                  <span className="text-[11px] font-bold text-[#005259]">{totalRemplisRN}</span>
                </div>
                <div className="w-px bg-[#404040]/10 self-stretch my-0.5"></div>
                <div>
                  <span className="text-[8px] text-[#404040]/60 block font-bold uppercase">RND</span>
                  <span className="text-[11px] font-bold text-[#EA601F]">{totalRemplisRND}</span>
                </div>
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
                <span className="text-[#404040]/70 font-bold uppercase text-[9px] tracking-wide">RN :</span>
                <div className="flex gap-2 text-[#404040]">
                  <span>H:<b className="text-[#005259]">{rnHommesUniques}</b></span>
                  <span>F:<b className="text-[#EA601F]">{rnFemmesUniques}</b></span>
                </div>
              </div>
              <div className="h-px bg-[#404040]/10"></div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#EA601F] font-bold uppercase text-[9px] tracking-wide">RND :</span>
                <div className="flex gap-2 text-[#404040]">
                  <span>H:<b className="text-[#005259]">{rndHommesUniques}</b></span>
                  <span>F:<b className="text-[#EA601F]">{rndFemmesUniques}</b></span>
                </div>
              </div>
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

            const entries = creneaux.filter(c => c.date === dateStr);
            if (entries.length === 0) return null;

            return (
              <div key={i} className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${dateStr === todayStr ? 'border-[#005259] ring-1 ring-[#005259]' : 'border-[#404040]/10'}`}>
                
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
                            const nomNettoye = (c.mediateurNom || "").replace(" (RND)", "").replace(" (RN)", "").trim().toLowerCase();
                            const isOrphan = !mediateursActifs.includes(nomNettoye);
                            const isRND = c.mediateurNom?.includes("(RND)");
                            const nomAffiche = c.mediateurNom?.replace(" (RND)", "").replace(" (RN)", "");
                            
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
                              <div key={c.id} className={`grid grid-cols-1 xl:grid-cols-12 items-center gap-4 p-3 rounded-xl border transition-all ${isOrphan ? 'bg-[#EF736A]/10 border-[#EF736A]/30' : isRND ? 'bg-[#EA601F]/5 border-[#EA601F]/20 hover:border-[#EA601F]/40' : 'bg-[#F3F3F2]/50 border-[#404040]/10 hover:border-[#005259]/30 hover:bg-[#F3F3F2]'}`}>

                                <div className="xl:col-span-2 flex items-center gap-3 min-w-0">
                                  <div className="p-2 rounded-lg bg-white border border-[#404040]/10 text-[#005259] shrink-0 shadow-sm">
                                    <UserIcon className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-sm flex items-center gap-2 min-w-0">
                                      {isOrphan && <ExclamationTriangleIcon className="w-4 h-4 text-[#EF736A] shrink-0" />}
                                      <span className={`truncate min-w-0 ${isOrphan ? "text-[#EF736A]" : "text-[#005259]"}`}>{nomAffiche}</span>
                                      {isRND && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EA601F]/10 border border-[#EA601F]/30 text-[#EA601F] shrink-0">RND</span>}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="xl:col-span-1 flex items-center gap-2 text-[#404040]">
                                  <ClockIcon className="w-4 h-4 text-[#EA601F]" />
                                  <span className="text-xs font-bold">{c.horaire}</span>
                                </div>
                                
                                <div className="xl:col-span-3 w-full">
                                  <UsagerInput docId={c.id} initialValue={c.usager} beneficiairesListe={beneficiaires} />
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
                                  {isOrphan ? (
                                    <PermissionGuard actionId="suresnes_reassign">
                                      <button onClick={() => {
                                        const n = prompt("Attribuer à un autre médiateur ?");
                                        if(n) updateDoc(doc(db, "planning_suresnes", c.id), { mediateurNom: n });
                                      }} className="px-2.5 py-1 bg-[#EF736A]/20 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/40 rounded-xl text-[11px] font-bold transition-colors cursor-pointer w-full text-center">
                                        Réaffecter
                                      </button>
                                    </PermissionGuard>
                                  ) : !bTrouve ? (
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
                                      Non suivi
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

      </div>
    </main>
    </PageGuard>
  );
}

// --- COMPO INPUT RECHERCHE AVEC ALERTE DE BLACKLIST INTERNE ---
function UsagerInput({ docId, initialValue, beneficiairesListe }: { docId: string; initialValue: string; beneficiairesListe: Beneficiaire[] }) {
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
            
            <span className="font-bold text-[#005259] truncate uppercase">
              <span className="text-[#404040]/70 font-normal normal-case mr-1">{matchingBeneficiaire.prenom}</span>
              {matchingBeneficiaire.nom}
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
                Statut_Blacklist: "Non"
              });
              const label = `${newPrenom} ${newNom.toUpperCase()}`;
              await updateDoc(doc(db, "planning_suresnes", docId), { usager: label });
              setValue(label); setIsModalOpen(false);
            } catch(err) { console.error(err); }
          }} className="bg-white border border-[#404040]/10 p-6 rounded-2xl w-full max-w-xs space-y-4 shadow-2xl">
            
            {/* BANDEAU ROUGE D'ALERTE */}
            <div className="bg-[#EF736A]/10 border border-[#EF736A]/30 rounded-xl p-3 text-[#EF736A] text-xs flex items-center gap-2.5">
              <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-[#EF736A]" />
              <span className="font-bold leading-tight">
                La personne habite-t-elle Suresnes ?
              </span>
            </div>

            <h3 className="font-bold text-sm text-[#005259] uppercase tracking-wide">Nouveau bénéficiaire</h3>
            <input placeholder="Prénom" value={newPrenom} className="w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-xs text-[#404040] placeholder-[#404040]/40 outline-none font-medium" required onChange={e => setNewPrenom(e.target.value)} />
            <input placeholder="Nom" value={newNom} className="w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-xs text-[#404040] placeholder-[#404040]/40 outline-none font-medium" required onChange={e => setNewNom(e.target.value)} />
            <input placeholder="Téléphone" value={newPhone} className="w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-xs text-[#404040] placeholder-[#404040]/40 outline-none font-medium" onChange={e => setNewPhone(e.target.value)} />
            
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
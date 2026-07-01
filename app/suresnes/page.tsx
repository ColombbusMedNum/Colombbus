"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "../../lib/firebase";
import { 
  collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, collectionGroup
} from "firebase/firestore";
import Link from "next/link";
import { 
  ExclamationTriangleIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  CalendarDaysIcon, 
  UserIcon, 
  ClockIcon, 
  PhoneIcon, 
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  HomeIcon,
  PlusIcon,
  UsersIcon,
  TagIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleBottomCenterTextIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";

interface Beneficiaire {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  sexe?: string;
  statutBlacklist?: string; // Ajout du champ pour suivre le statut banni
}

export default function PlanningSuresnes() {
  const [creneaux, setCreneaux] = useState<any[]>([]);
  const [mediateursActifs, setMediateursActifs] = useState<string[]>([]);
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [filterTodayOnly, setFilterTodayOnly] = useState(false);
  
  // États synchronisés en temps réel depuis les fiches de visites
  const [rawVisites, setRawVisites] = useState<any[]>([]);
  const [statutsVisitesRealtime, setStatutsVisitesRealtime] = useState<{ [key: string]: string }>({});
  const [totalVisitesPresents, setTotalVisitesPresents] = useState<{ [key: string]: number }>({});
  const [thematiquesVisitees, setThematiquesVisitees] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "planning_suresnes"), orderBy("horaire", "asc")), (snap) => {
      setCreneaux(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubMed = onSnapshot(collection(db, "liste_mediateurs"), (snap) => {
      const nomsComplets = snap.docs.map(d => {
        const data = d.data();
        const prenom = (data.prenom || "").trim();
        const nom = (data.nom || "").trim();
        return `${prenom} ${nom}`.trim().toLowerCase();
      });
      setMediateursActifs(nomsComplets);
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
            statutBlacklist: data.Statut_Blacklist || "Non" // Récupération du statut blacklist
          };
        })
      );
    });

    // ÉCOUTEUR EN TEMPS RÉEL SUR TOUTES LES FICHES DE VISITES (collectionGroup)
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

    return () => { unsub(); unsubMed(); unsubBenef(); unsubVisites(); };
  }, []);

  // Calcule automatiquement le statut exact (Présent, Absent ou Non suivi) par créneau
  useEffect(() => {
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
    setStatutsVisitesRealtime(etatsVisites);
  }, [creneaux, beneficiaires, rawVisites]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => new Date(year, month, i + 1));

  // --- STATISTIQUES MENSUELLES ---
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

    if (c.thematique === "Collecte Tech") {
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
      (c.usager || "").trim().toLowerCase() === usagerNom && c.thematique === "Collecte Tech"
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

  const handleThematiqueChange = async (creneauId: string, nouvelleThematique: string) => {
    try {
      await updateDoc(doc(db, "planning_suresnes", creneauId), { thematique: nouvelleThematique });
    } catch (error) {
      console.error("Erreur thématique :", error);
    }
  };

  const handleDemandeSpecifiqueChange = async (creneauId: string, valeur: string) => {
    try {
      await updateDoc(doc(db, "planning_suresnes", creneauId), { demandeSpecifique: valeur });
    } catch (error) {
      console.error("Erreur demande spécifique :", error);
    }
  };

  const toggleTodayFilter = () => {
    if (!filterTodayOnly) setViewDate(new Date());
    setFilterTodayOnly(!filterTodayOnly);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans antialiased">
      <div className="max-w-[95%] mx-auto px-2">
        
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-5 border-b border-slate-900 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-1 bg-emerald-500 rounded-full"></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Suresnes — Relais Numérique</h1>
              <p className="text-xs text-slate-500 font-medium">Suivi des rendez-vous, thématiques et présence des médiateurs</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 px-3.5 py-2 rounded-xl text-slate-400 hover:text-white transition-all text-xs font-bold uppercase tracking-wider">
                <HomeIcon className="w-4 h-4" />
                <span>Accueil</span>
              </Link>
              <button onClick={toggleTodayFilter} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer ${filterTodayOnly ? "bg-emerald-950/60 border-emerald-500 text-emerald-400" : "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white"}`}>
                <ClockIcon className={`w-4 h-4 ${filterTodayOnly ? "text-emerald-400" : "text-slate-400"}`} />
                <span>Aujourd'hui</span>
              </button>
              <Link href="/liste-beneficiaires" className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 px-3.5 py-2 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-bold uppercase tracking-wider">
                <UsersIcon className="w-4 h-4 text-slate-400" />
                <span>Bénéficiaires</span>
              </Link>
            </div>

            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 items-center gap-1">
              <button onClick={() => { setViewDate(new Date(year, month - 1, 1)); setFilterTodayOnly(false); }} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer">
                <ChevronLeftIcon className="w-4 h-4"/>
              </button>
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider min-w-36 text-center">
                {viewDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => { setViewDate(new Date(year, month + 1, 1)); setFilterTodayOnly(false); }} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer">
                <ChevronRightIcon className="w-4 h-4"/>
              </button>
            </div>
          </div>
        </header>

        {/* ANALYTICS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-md">
            <span className="block text-[9px] uppercase font-black tracking-widest text-slate-500">Créneaux ouverts ({viewDate.toLocaleString('fr-FR', { month: 'short' })})</span>
            <span className="text-2xl font-mono font-black text-white mt-1">{totalCreneauxOuverts} <span className="text-xs font-sans text-slate-500 font-normal">dispos</span></span>
          </div>
          
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-md">
            <span className="block text-[9px] uppercase font-black tracking-widest text-slate-500 font-bold">Créneaux réservés</span>
            <div className="flex items-center justify-between mt-1">
              <div>
                <span className="text-2xl font-mono font-black text-emerald-400">{totalCreneauxRemplis}</span>
                <span className="text-[9px] text-amber-500 font-mono font-bold block mt-1 bg-amber-950/40 border border-amber-900/30 rounded px-1 w-max">
                  COLL TECH: {totalCollecteTech}
                </span>
              </div>
              <div className="flex gap-2 text-right">
                <div>
                  <span className="text-[8px] text-slate-500 block font-bold uppercase">RN</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-500">{totalRemplisRN}</span>
                </div>
                <div className="w-px bg-slate-800 self-stretch my-0.5"></div>
                <div>
                  <span className="text-[8px] text-slate-500 block font-bold uppercase">RND</span>
                  <span className="text-[11px] font-mono font-bold text-sky-400">{totalRemplisRND}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-md">
            <span className="block text-[9px] uppercase font-black tracking-widest text-slate-400">Taux de remplissage</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-mono font-black text-blue-400">{tauxOccupation}%</span>
              <div className="w-16 bg-slate-950 border border-slate-850 h-1.5 rounded-full overflow-hidden hidden sm:block">
                <div className="bg-blue-500 h-full" style={{ width: `${tauxOccupation}%` }}></div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-md">
            <span className="block text-[9px] uppercase font-black tracking-widest text-slate-400">Taux participation</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-mono font-black text-amber-400">{tauxParticipation}%</span>
              <div className="w-16 bg-slate-950 border border-slate-850 h-1.5 rounded-full overflow-hidden hidden sm:block">
                <div className="bg-amber-500 h-full" style={{ width: `${tauxParticipation}%` }}></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl col-span-2 md:col-span-1 flex flex-col justify-between shadow-md bg-gradient-to-br from-slate-900 to-indigo-950/20">
            <span className="block text-[9px] uppercase font-black tracking-widest text-indigo-400">Public unique (Mois)</span>
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-bold uppercase text-[9px] tracking-wide">RN :</span>
                <div className="flex gap-2 font-mono">
                  <span>H:<b className="text-slate-200">{rnHommesUniques}</b></span>
                  <span>F:<b className="text-fuchsia-400/90">{rnFemmesUniques}</b></span>
                </div>
              </div>
              <div className="h-px bg-slate-800/40"></div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-sky-400 font-bold uppercase text-[9px] tracking-wide">RND :</span>
                <div className="flex gap-2 font-mono">
                  <span>H:<b className="text-slate-200">{rndHommesUniques}</b></span>
                  <span>F:<b className="text-fuchsia-400/90">{rndFemmesUniques}</b></span>
                </div>
              </div>
              <div className="h-px bg-slate-800/40"></div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-500 font-bold uppercase text-[9px] tracking-wide">Coll. Tech :</span>
                <div className="flex gap-2 font-mono">
                  <span>H:<b className="text-slate-200">{collTechHommesUniques}</b></span>
                  <span>F:<b className="text-fuchsia-400/90">{collTechFemmesUniques}</b></span>
                </div>
              </div>
              <div className="h-px bg-slate-800/80"></div>
              <div className="text-right text-[10px] text-slate-400 font-medium">
                Total : <span className="font-mono text-white font-black text-xs">{usagersDuMoisUniques.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* AGENDA */}
        <div className="space-y-6">
          {days.map((day, i) => {
            const dateStr = day.toLocaleDateString('en-CA'); 
            const todayStr = new Date().toLocaleDateString('en-CA');

            if (filterTodayOnly && dateStr !== todayStr) return null;

            const entries = creneaux.filter(c => c.date === dateStr);
            if (entries.length === 0) return null;

            return (
              <div key={i} className={`bg-slate-900/60 border rounded-xl overflow-hidden shadow-xl backdrop-blur-sm transition-all ${dateStr === todayStr ? 'border-emerald-500/40 shadow-emerald-950/10' : 'border-slate-800'}`}>
                
                <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDaysIcon className={`w-4 h-4 ${dateStr === todayStr ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${dateStr === todayStr ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {day.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' })}
                      {dateStr === todayStr && " (Aujourd'hui)"}
                    </span>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-800">
                  {["Matin", "Après-midi"].map(moment => {
                    const sessionEntries = entries.filter(e => e.moment === moment);
                    if (sessionEntries.length === 0) return null;

                    return (
                      <div key={moment} className="p-4">
                        <div className="px-1 pb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${moment === 'Matin' ? 'bg-amber-500/60' : 'bg-indigo-500/60'}`}></span>
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
                              <div key={c.id} className={`grid grid-cols-1 xl:grid-cols-12 items-center gap-4 p-3 rounded-xl border transition-all ${isOrphan ? 'bg-slate-900/60 border-amber-900/40 hover:border-amber-800/60' : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'}`}>
                                
                                <div className="xl:col-span-2 flex items-center gap-3 min-w-0">
                                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                                    <UserIcon className="w-4 h-4" />
                                  </div>
                                  <div className="truncate">
                                    <div className="font-semibold text-slate-200 text-sm truncate flex items-center gap-2">
                                      {isOrphan && <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0" />}
                                      <span className={isOrphan ? "text-amber-400" : "text-slate-200"}>{nomAffiche}</span>
                                      {isRND && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-sky-950/50 border border-sky-900/40 text-sky-400 shrink-0">RND</span>}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="xl:col-span-1 flex items-center gap-2 text-slate-400">
                                  <ClockIcon className="w-4 h-4 text-slate-500" />
                                  <span className="text-xs font-mono font-medium">{c.horaire}</span>
                                </div>
                                
                                <div className="xl:col-span-3 w-full">
                                  <UsagerInput docId={c.id} initialValue={c.usager} beneficiairesListe={beneficiaires} />
                                </div>

                                <div className="xl:col-span-2 w-full">
                                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 focus-within:border-slate-700 rounded-lg px-2 py-1 transition-all">
                                    <TagIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <select
                                      disabled={!c.usager}
                                      value={c.thematique || ""}
                                      onChange={(e) => handleThematiqueChange(c.id, e.target.value)}
                                      className="w-full bg-transparent border-none p-0 text-xs font-medium text-slate-300 outline-none focus:ring-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                      <option value="" className="bg-slate-900 text-slate-500">-- Thématique --</option>
                                      <option value="Ordinateur" className="bg-slate-900 text-slate-100">💻 Ordinateur</option>
                                      <option value="Smartphone" className="bg-slate-900 text-slate-100">📱 Smartphone</option>
                                      <option value="Accès aux droits" className="bg-slate-900 text-slate-100">⚖️ Accès aux droits</option>
                                      <option value="Insertion Pro" className="bg-slate-900 text-slate-100">💼 Insertion Pro</option>
                                      <option value="Logement" className="bg-slate-900 text-slate-100">🏠 Logement</option>
                                      <option value="Santé" className="bg-slate-900 text-slate-100">🩺 Accompagnement Santé</option>
                                      <option value="Collecte Tech" className="bg-slate-900 text-amber-400 font-bold">🧺 Collecte Tech</option>
                                      <option value="Autre" className="bg-slate-900 text-slate-100">✨ Autre thématique</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="xl:col-span-1.5 flex items-center justify-start xl:justify-center">
                                  {trendBesoinDiagnostic ? (
                                    <Link href={`/liste-beneficiaires/${bTrouve.id}`} className="inline-flex items-center gap-1.5 bg-purple-950/40 border border-purple-800/50 hover:border-purple-600 px-2.5 py-1 rounded-lg text-[10px] font-bold text-purple-400 hover:text-purple-300 uppercase tracking-wider transition-all cursor-pointer shadow-sm group w-full justify-center">
                                      <PlusIcon className="w-3 h-3 stroke-[3] group-hover:scale-125 transition-transform" />
                                      <span>Diagnostic</span>
                                    </Link>
                                  ) : bTrouve && thématiqueMatériel && aDejaFaitCetteThematique ? (
                                    <span className="inline-flex items-center justify-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-900/30 px-2 py-0.5 rounded border border-slate-800/40 w-full text-center">
                                      <ClipboardDocumentCheckIcon className="w-3 h-3 opacity-40" /> Déjà diag.
                                    </span>
                                  ) : (
                                    <span className="text-slate-700 text-xs hidden xl:block">—</span>
                                  )}
                                </div>

                                <div className="xl:col-span-1 flex items-center justify-start xl:justify-center gap-1.5 text-slate-400">
                                  {bTrouve ? (
                                    <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800/80 px-2 py-1 rounded-lg text-xs w-full justify-center" title="Total des visites">
                                      <ChartBarIcon className="w-3.5 h-3.5 text-indigo-400" />
                                      <span className="font-mono font-bold text-slate-200">{totalPresentsUsager}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-600 font-mono hidden xl:block">—</span>
                                  )}
                                </div>

                                <div className="xl:col-span-2 w-full">
                                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 focus-within:border-slate-700 rounded-lg px-2 py-1 transition-all">
                                    <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <input 
                                      type="text"
                                      disabled={!c.usager}
                                      value={c.demandeSpecifique || ""}
                                      onChange={(e) => handleDemandeSpecifiqueChange(c.id, e.target.value)}
                                      placeholder="Demande (ex: photos...)"
                                      className="w-full bg-transparent border-none p-0 text-xs font-medium text-slate-200 placeholder:text-slate-600 outline-none focus:ring-0 disabled:opacity-30 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                </div>
                                
                                <div className="xl:col-span-1 text-left xl:text-right shrink-0">
                                  {isOrphan ? (
                                    <button onClick={() => {
                                      const n = prompt("Attribuer à un autre médiateur ?");
                                      if(n) updateDoc(doc(db, "planning_suresnes", c.id), { mediateurNom: n });
                                    }} className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg text-[11px] font-medium transition-colors cursor-pointer w-full text-center">
                                      Réaffecter
                                    </button>
                                  ) : !bTrouve ? (
                                    <span className="inline-block text-center w-full text-slate-500 bg-slate-950 border border-slate-800 px-2 py-1 rounded-md text-[9px] font-bold tracking-wider uppercase">
                                      À attribuer
                                    </span>
                                  ) : currentStatutFiche === "Présent" ? (
                                    <Link 
                                      href={`/liste-beneficiaires/${bTrouve.id}`}
                                      className="inline-flex items-center justify-center gap-1 w-full text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-500 px-2 py-1 rounded-md text-[9px] font-bold tracking-wider uppercase transition-all shadow-sm"
                                    >
                                      <CheckCircleIcon className="w-3 h-3" />
                                      Présent
                                    </Link>
                                  ) : currentStatutFiche === "Absent" ? (
                                    <Link 
                                      href={`/liste-beneficiaires/${bTrouve.id}`}
                                      className="inline-flex items-center justify-center gap-1 w-full text-red-400 bg-red-950/30 border border-red-500/30 hover:border-red-500 px-2 py-1 rounded-md text-[9px] font-bold tracking-wider uppercase transition-all shadow-sm"
                                    >
                                      <XCircleIcon className="w-3 h-3" />
                                      Absent
                                    </Link>
                                  ) : (
                                    <Link 
                                      href={`/liste-beneficiaires/${bTrouve.id}`}
                                      className="inline-flex items-center justify-center gap-1 w-full text-amber-500 bg-amber-950/20 border border-amber-900/30 hover:border-amber-500/50 px-2 py-1 rounded-md text-[9px] font-bold tracking-wider uppercase transition-all shadow-sm"
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
  );
}

// --- COMPO INPUT RECHERCHE AVEC ALERTE DE BLACKLIST INTERNE ---
function UsagerInput({ docId, initialValue, beneficiairesListe }: { docId: string; initialValue: string; beneficiairesListe: Beneficiaire[] }) {
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

  // VÉRIFICATION DU STATUT LORS DE LA SÉLECTION
  const handleSelect = async (b: Beneficiaire) => {
    if (b.statutBlacklist === "Oui") {
      alert(`🚫 IMPOSSIBLE : Le bénéficiaire "${b.prenom} ${b.nom.toUpperCase()}" est actuellement BLACKLISTÉ.\nIl ne peut pas être ajouté au planning.`);
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
        <div className="flex items-center justify-between bg-blue-950/30 border border-blue-900/40 rounded-lg px-2.5 py-1.5 text-xs">
          <div className="flex items-center gap-1.5 overflow-hidden w-full pr-1">
            {isHomme && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-400 font-extrabold font-mono shrink-0">H</span>
            )}
            {isFemme && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-400 font-extrabold font-mono shrink-0">F</span>
            )}
            {!isHomme && !isFemme && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-bold shrink-0">?</span>
            )}
            
            <span className="font-semibold text-slate-200 truncate">
              {matchingBeneficiaire.prenom} {matchingBeneficiaire.nom.toUpperCase()}
            </span>
          </div>
          <button onClick={handleClear} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-red-400 transition-colors cursor-pointer pl-2 border-l border-slate-800 shrink-0">
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800 focus-within:border-slate-600 rounded-lg px-3 py-1.5 transition-all gap-2">
          <input className="w-full bg-transparent border-none p-0 text-xs font-medium text-slate-200 placeholder:text-slate-600 outline-none focus:ring-0" value={value || ""} placeholder="Rechercher un bénéficiaire..." onChange={handleInputChange} />
          <button type="button" onClick={() => setIsModalOpen(true)} className="p-1 bg-slate-800 hover:bg-emerald-600 border border-slate-700 text-slate-400 hover:text-white rounded transition-colors shrink-0 cursor-pointer">
            <PlusIcon className="w-3 h-3 stroke-[2.5]" />
          </button>
        </div>
      )}

      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute left-0 top-full mt-2 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden divide-y divide-slate-800">
          {suggestions.map(b => {
            const isSugFemme = (b.sexe || "").toLowerCase().startsWith("f");
            const isBanned = b.statutBlacklist === "Oui";

            return (
              <li key={b.id}>
                <button 
                  type="button" 
                  onClick={() => handleSelect(b)} 
                  className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 cursor-pointer group transition-colors ${
                    isBanned ? "hover:bg-red-950/40 bg-red-950/10 text-red-400" : "hover:bg-blue-600 text-slate-300 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded mr-1.5 ${
                      isSugFemme ? "bg-fuchsia-950 text-fuchsia-400 border border-fuchsia-900" : "bg-blue-950 text-blue-400 border border-blue-900"
                    }`}>
                      {isSugFemme ? "F" : "H"}
                    </span>
                    <span className={isBanned ? "line-through opacity-60" : ""}>
                      {b.prenom} <span className="uppercase font-bold">{b.nom}</span>
                    </span>
                    {isBanned && <span className="ml-2 text-[9px] font-black uppercase bg-red-600 text-white px-1 rounded tracking-wide">🚫 Blacklisté</span>}
                  </div>
                  <div className="text-[10px] opacity-60 font-mono">{b.telephone}</div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
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
          }} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl w-full max-w-xs space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-white">Nouveau bénéficiaire</h3>
            <input placeholder="Prénom" value={newPrenom} className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white" required onChange={e => setNewPrenom(e.target.value)} />
            <input placeholder="Nom" value={newNom} className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white" required onChange={e => setNewNom(e.target.value)} />
            <input placeholder="Téléphone" value={newPhone} className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white" onChange={e => setNewPhone(e.target.value)} />
            
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Genre</label>
              <select value={newSexe} onChange={e => setNewSexe(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none">
                <option value="Homme">Homme</option>
                <option value="Femme">Femme</option>
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 bg-emerald-600 text-white py-1.5 rounded-xl text-xs font-bold cursor-pointer">Créer</button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 text-xs px-2 cursor-pointer">Annuler</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
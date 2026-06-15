"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy, updateDoc, doc, getDocs, where, addDoc } from "firebase/firestore";
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
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  HomeIcon,
  PlusIcon,
  UsersIcon,
  TagIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon
} from "@heroicons/react/24/outline";

interface Beneficiaire {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
}

export default function PlanningSuresnes() {
  const [creneaux, setCreneaux] = useState<any[]>([]);
  const [mediateursActifs, setMediateursActifs] = useState<string[]>([]);
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  
  // États de suivi calculés depuis les fiches bénéficiaires
  const [visitesValidees, setVisitesValidees] = useState<{ [key: string]: boolean }>({});
  const [totalVisitesPresents, setTotalVisitesPresents] = useState<{ [key: string]: number }>({});
  // Stocke la liste des thématiques déjà validées ou diagnostiquées par bénéficiaire
  const [thematiquesVisitees, setThematiquesVisitees] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    // 1. Récupération des créneaux
    const unsub = onSnapshot(query(collection(db, "planning_suresnes"), orderBy("horaire", "asc")), (snap) => {
      setCreneaux(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Récupération des médiateurs
    const unsubMed = onSnapshot(collection(db, "liste_mediateurs"), (snap) => {
      const nomsComplets = snap.docs.map(d => {
        const data = d.data();
        const prenom = (data.prenom || "").trim();
        const nom = (data.nom || "").trim();
        return `${prenom} ${nom}`.trim().toLowerCase();
      });
      setMediateursActifs(nomsComplets);
    });

    // 3. Récupération des bénéficiaires
    const unsubBenef = onSnapshot(collection(db, "utilisateurs"), (snap) => {
      setBeneficiaires(
        snap.docs.map(d => {
          const data = d.data();
          const phone = data.Téléphone || data.telephone || data.Telephone || "Non renseigné";
          return {
            id: d.id,
            nom: (data.Nom || "").trim(),
            prenom: (data.Prénom || data.prenom || "").trim(),
            telephone: phone
          };
        })
      );
    });

    return () => { unsub(); unsubMed(); unsubBenef(); };
  }, []);

  // 4. Vérification et calcul des statistiques des visites depuis les fiches individuelles
  useEffect(() => {
    const checkVisites = async () => {
      const etatsVisites: { [key: string]: boolean } = {};
      const totauxPresents: { [key: string]: number } = {};
      const mapThematiquesUsagers: { [key: string]: string[] } = {};

      for (const c of creneaux) {
        if (!c.usager) continue;

        const bTrouve = beneficiaires.find(
          b => `${b.prenom.trim()} ${b.nom.trim()}`.toLowerCase() === c.usager.trim().toLowerCase()
        );

        if (bTrouve) {
          const uniqueKey = `${c.id}_${c.date}`;

          // On optimise en évitant de refaire l'appel si l'usager est présent plusieurs fois dans la boucle actuelle
          if (totauxPresents[bTrouve.id] === undefined) {
            try {
              const visitesRef = collection(db, "utilisateurs", bTrouve.id, "visites");
              const allSnap = await getDocs(visitesRef);
              
              // On cible les visites validées ("Présent") OU les diagnostics initiaux déjà créés/faits
              const visitesValides = allSnap.docs.filter(
                d => d.data().statut === "Présent" || d.data().moment === "Diagnostic Initial"
              );
              
              totauxPresents[bTrouve.id] = allSnap.docs.filter(d => d.data().statut === "Présent").length;
              
              // Extraction des thématiques déjà traitées pour cet usager
              mapThematiquesUsagers[bTrouve.id] = visitesValides.map(d => d.data().thematique).filter(Boolean);
            } catch (error) {
              console.error("Erreur check visite:", error);
              totauxPresents[bTrouve.id] = 0;
              mapThematiquesUsagers[bTrouve.id] = [];
            }
          }

          // Vérification spécifique pour ce créneau précis (Même date et même moment)
          if (c.date && c.moment) {
            try {
              const visitesRef = collection(db, "utilisateurs", bTrouve.id, "visites");
              const q = query(
                visitesRef, 
                where("date", "==", c.date),
                where("moment", "==", c.moment)
              );
              const snap = await getDocs(q);
              etatsVisites[uniqueKey] = !snap.empty;
            } catch (error) {
              etatsVisites[uniqueKey] = false;
            }
          }
        }
      }
      setVisitesValidees(etatsVisites);
      setTotalVisitesPresents(totauxPresents);
      setThematiquesVisitees(mapThematiquesUsagers);
    };

    if (creneaux.length > 0 && beneficiaires.length > 0) {
      checkVisites();
    }
  }, [creneaux, beneficiaires]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => new Date(year, month, i + 1));

  const handleThematiqueChange = async (creneauId: string, nouvelleThematique: string) => {
    try {
      await updateDoc(doc(db, "planning_suresnes", creneauId), {
        thematique: nouvelleThematique
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la thématique :", error);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans antialiased">
      <div className="max-w-[95%] mx-auto px-2">
        
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-5 border-b border-slate-900 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-1 bg-emerald-500 rounded-full"></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Suresnes — Relais Numérique</h1>
              <p className="text-xs text-slate-500 font-medium">Suivi des rendez-vous, thématiques et présence des médiateurs</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <Link 
                href="/" 
                className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 px-3.5 py-2 rounded-xl text-slate-400 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
              >
                <HomeIcon className="w-4 h-4" />
                <span>Accueil</span>
              </Link>

              <Link 
                href="/liste-beneficiaires" 
                className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 px-3.5 py-2 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
              >
                <UsersIcon className="w-4 h-4 text-slate-400" />
                <span>Bénéficiaires</span>
              </Link>
            </div>

            {/* NAVIGATION DU MOIS */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 items-center gap-1">
              <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer">
                <ChevronLeftIcon className="w-4 h-4"/>
              </button>
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider min-w-36 text-center">
                {viewDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer">
                <ChevronRightIcon className="w-4 h-4"/>
              </button>
            </div>
          </div>
        </header>

        {/* LISTE DES JOURS */}
        <div className="space-y-6">
          {days.map((day, i) => {
            const dateStr = day.toLocaleDateString('en-CA'); 
            const entries = creneaux.filter(c => c.date === dateStr);
            if (entries.length === 0) return null;

            return (
              <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl backdrop-blur-sm">
                
                {/* EN-TÊTE DU JOUR */}
                <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center gap-2">
                  <CalendarDaysIcon className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {day.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' })}
                  </span>
                </div>
                
                {/* LISTE DES SESSIONS */}
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
                            const nomNettoye = (c.mediateurNom || "")
                              .replace(" (RND)", "")
                              .replace(" (RN)", "")
                              .trim()
                              .toLowerCase();

                            const isOrphan = !mediateursActifs.includes(nomNettoye);
                            const isRND = c.mediateurNom?.includes("(RND)");
                            const nomAffiche = c.mediateurNom?.replace(" (RND)", "").replace(" (RN)", "");
                            
                            const bTrouve = beneficiaires.find(
                              b => `${b.prenom.trim()} ${b.nom.trim()}`.toLowerCase() === (c.usager || "").trim().toLowerCase()
                            );

                            const uniqueKey = `${c.id}_${c.date}`;
                            const estEnregistreDansLaFiche = visitesValidees[uniqueKey] || false;
                            const totalPresentsUsager = bTrouve ? (totalVisitesPresents[bTrouve.id] || 0) : 0;

                            const thématiqueMatériel = c.thematique === "Ordinateur" || c.thematique === "Smartphone";
                            
                            // Vérification si la thématique actuelle est présente dans l'historique de l'usager
                            const aDejaFaitCetteThematique = bTrouve && thematiquesVisitees[bTrouve.id]?.includes(c.thematique);
                            
                            // Affiche le badge si thématique matériel et qu'aucune séance passée/diagnostic n'existe pour cette thématique
                            const trendBesoinDiagnostic = bTrouve && thématiqueMatériel && !aDejaFaitCetteThematique;

                            return (
                              <div 
                                key={c.id} 
                                className={`grid grid-cols-1 xl:grid-cols-12 items-center gap-4 p-3 rounded-xl border transition-all ${
                                  isOrphan 
                                    ? 'bg-slate-900/60 border-amber-900/40 hover:border-amber-800/60' 
                                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                                }`}
                              >
                                {/* 1. MÉDIATEUR */}
                                <div className="xl:col-span-2 flex items-center gap-3 min-w-0">
                                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                                    <UserIcon className="w-4 h-4" />
                                  </div>
                                  <div className="truncate">
                                    <div className="font-semibold text-slate-200 text-sm truncate flex items-center gap-2">
                                      {isOrphan && <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0" />}
                                      <span className={isOrphan ? "text-amber-400" : "text-slate-200"}>{nomAffiche}</span>
                                      {isRND && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-sky-950/50 border border-sky-900/40 text-sky-400 shrink-0">
                                          RND
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* 2. HORAIRE */}
                                <div className="xl:col-span-1 flex items-center gap-2 text-slate-400">
                                  <ClockIcon className="w-4 h-4 text-slate-500" />
                                  <span className="text-xs font-mono font-medium">{c.horaire}</span>
                                </div>
                                
                                {/* 3. USAGER INPUT */}
                                <div className="xl:col-span-3 w-full">
                                  <UsagerInput 
                                    docId={c.id} 
                                    initialValue={c.usager} 
                                    beneficiairesListe={beneficiaires} 
                                  />
                                </div>

                                {/* 4. THÉMATIQUE */}
                                <div className="xl:col-span-2.5 w-full">
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
                                      <option value="Autre" className="bg-slate-900 text-slate-100">✨ Autre thématique</option>
                                    </select>
                                  </div>
                                </div>

                                {/* 5. DIAGNOSTIC LINK (BOUTON MODIFIÉ ICI) */}
                                <div className="xl:col-span-1.5 flex items-center justify-start xl:justify-center">
                                  {trendBesoinDiagnostic ? (
                                    <Link 
                                      href={`/diagnostic/${bTrouve.id}`}
                                      className="inline-flex items-center gap-1.5 bg-purple-950/40 border border-purple-800/50 hover:border-purple-600 px-2.5 py-1 rounded-lg text-[10px] font-bold text-purple-400 hover:text-purple-300 uppercase tracking-wider transition-all cursor-pointer shadow-sm group w-full justify-center"
                                    >
                                      <PlusIcon className="w-3 h-3 stroke-[3] group-hover:scale-125 transition-transform" />
                                      <span>Diagnostic à faire</span>
                                    </Link>
                                  ) : bTrouve && thématiqueMatériel && aDejaFaitCetteThematique ? (
                                    <span className="inline-flex items-center justify-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-900/30 px-2 py-0.5 rounded border border-slate-800/40 w-full text-center">
                                      <ClipboardDocumentCheckIcon className="w-3 h-3 opacity-40" />
                                      Déjà diagnostiqué
                                    </span>
                                  ) : (
                                    <span className="text-slate-700 text-xs hidden xl:block">—</span>
                                  )}
                                </div>

                                {/* 6. NB VISITES PRÉSENTES */}
                                <div className="xl:col-span-1 flex items-center justify-start xl:justify-center gap-1.5 text-slate-400">
                                  {bTrouve ? (
                                    <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800/80 px-2 py-1 rounded-lg text-xs w-full justify-center" title="Total des visites marquées 'Présent' pour cet usager">
                                      <ChartBarIcon className="w-3.5 h-3.5 text-indigo-400" />
                                      <span className="font-mono font-bold text-slate-200">{totalPresentsUsager}</span>
                                      <span className="text-[10px] text-slate-500 font-medium">vis.</span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-600 font-mono hidden xl:block">—</span>
                                  )}
                                </div>
                                
                                {/* 7. STATUT Pointage */}
                                <div className="xl:col-span-1 text-left xl:text-right shrink-0">
                                  {isOrphan ? (
                                    <button onClick={() => {
                                      const n = prompt("Attribuer à un autre médiateur ?");
                                      if(n) updateDoc(doc(db, "planning_suresnes", c.id), { mediateurNom: n });
                                    }} className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg text-[11px] font-medium transition-colors cursor-pointer w-full text-center">
                                      Réaffecter
                                    </button>
                                  ) : !bTrouve ? (
                                    <span className="inline-block text-center w-full text-slate-500 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase">
                                      À attribuer
                                    </span>
                                  ) : estEnregistreDansLaFiche ? (
                                    <span className="inline-flex items-center justify-center gap-1 w-full text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase">
                                      <CheckCircleIcon className="w-3 h-3" />
                                      Pointé
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center gap-1 w-full text-amber-500 bg-amber-950/20 border border-amber-900/30 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase">
                                      <ExclamationCircleIcon className="w-3 h-3" />
                                      Non suivi
                                    </span>
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

// --- SOUS-COMPOSANT INPUT RECHERCHE & CRÉATION RAPIDE ---
function UsagerInput({ 
  docId, 
  initialValue, 
  beneficiairesListe 
}: { 
  docId: string; 
  initialValue: string; 
  beneficiairesListe: Beneficiaire[] 
}) {
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<Beneficiaire[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNom, setNewNom] = useState("");
  const [newPrenom, setNewPrenom] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

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
      const filtered = beneficiairesListe.filter(b => 
        `${b.prenom} ${b.nom}`.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowDropdown(true);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const handleSelect = async (b: Beneficiaire) => {
    const nomComplet = `${b.prenom.trim()} ${b.nom.trim().toUpperCase()}`;
    setValue(nomComplet);
    setShowDropdown(false);
    try {
      await updateDoc(doc(db, "planning_suresnes", docId), { usager: nomComplet });
    } catch (error) {
      console.error("Erreur Firebase :", error);
    }
  };

  const handleClear = async () => {
    setValue("");
    try {
      await updateDoc(doc(db, "planning_suresnes", docId), { usager: "", thematique: "" });
    } catch (error) {
      console.error("Erreur Firebase :", error);
    }
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNom.trim() || !newPrenom.trim()) return;

    const formattedNom = newNom.trim().toUpperCase();
    const formattedPrenom = newPrenom.trim();
    const nomCompletSession = `${formattedPrenom} ${formattedNom}`;

    try {
      await addDoc(collection(db, "utilisateurs"), {
        Nom: formattedNom,
        Prénom: formattedPrenom,
        Téléphone: newPhone.trim() || "Non renseigné"
      });

      await updateDoc(doc(db, "planning_suresnes", docId), { 
        usager: nomCompletSession 
      });

      setValue(nomCompletSession);
      setIsModalOpen(false);
      setNewNom("");
      setNewPrenom("");
      setNewPhone("");
    } catch (error) {
      console.error("Erreur lors de la création rapide de l'usager :", error);
    }
  };

  return (
    <div ref={containerRef} className="w-full relative">
      {matchingBeneficiaire ? (
        <div className="flex items-center justify-between bg-blue-950/30 border border-blue-900/40 rounded-lg px-2.5 py-1.5 text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex items-center gap-1.5 text-blue-400 font-semibold truncate">
              <UserIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{matchingBeneficiaire.prenom} {matchingBeneficiaire.nom.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
              <PhoneIcon className="w-3 h-3 text-slate-500 shrink-0" />
              <span>{matchingBeneficiaire.telephone}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 pl-2 border-l border-slate-800 shrink-0">
            <Link 
              href={`/liste-beneficiaires/${matchingBeneficiaire.id}`}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-blue-400 rounded transition-colors flex items-center gap-1 text-[10px]"
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Fiche</span>
            </Link>
            
            <button onClick={handleClear} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-red-400 transition-colors cursor-pointer">
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800 focus-within:border-slate-600 rounded-lg px-3 py-1.5 transition-all gap-2">
          <div className="flex items-center gap-2 flex-1">
            <UserIcon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <input 
              className="w-full bg-transparent border-none p-0 text-xs font-medium text-slate-200 placeholder:text-slate-600 outline-none focus:ring-0" 
              value={value || ""}
              placeholder="Rechercher un bénéficiaire..."
              onChange={handleInputChange}
            />
          </div>
          
          <button
            type="button"
            onClick={() => {
              if (value) {
                const parts = value.trim().split(" ");
                setNewPrenom(parts[0] || "");
                setNewNom(parts.slice(1).join(" ") || "");
              }
              setIsModalOpen(true);
            }}
            className="p-1 bg-slate-800 hover:bg-emerald-600 border border-slate-700 text-slate-400 hover:text-white rounded transition-colors cursor-pointer shrink-0"
            title="Créer un nouveau bénéficiaire"
          >
            <PlusIcon className="w-3 h-3 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* DROPDOWN SUGGESTIONS */}
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute left-0 top-full mt-2 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden divide-y divide-slate-800">
          {suggestions.map(b => (
            <li key={b.id}>
              <button type="button" onClick={() => handleSelect(b)} className="w-full px-3 py-2 text-left hover:bg-blue-600 transition-colors flex items-center justify-between gap-2 cursor-pointer group/item">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-slate-300 group-hover/item:text-white">{b.prenom} <span className="uppercase">{b.nom}</span></span>
                  <span className="text-[10px] text-slate-500 group-hover/item:text-blue-200">Public inscrit</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 group-hover/item:text-white bg-slate-950/40 px-1.5 py-0.5 rounded border border-slate-800/60 shrink-0">
                  <PhoneIcon className="w-2.5 h-2.5 opacity-60" />
                  {b.telephone}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* MODALE POP-UP */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <form 
            onSubmit={handleQuickCreate} 
            className="bg-slate-900 border border-slate-800 p-5 rounded-2xl w-full max-w-xs space-y-4 shadow-2xl"
          >
            <div>
              <h3 className="font-bold text-sm text-white">Nouveau bénéficiaire</h3>
              <p className="text-[11px] text-slate-500">Ajouter au profil général et au créneau</p>
            </div>

            <div className="space-y-2">
              <input 
                placeholder="Prénom" 
                value={newPrenom} 
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-slate-700 transition-colors" 
                required 
                onChange={e => setNewPrenom(e.target.value)} 
              />
              <input 
                placeholder="Nom" 
                value={newNom} 
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-slate-700 transition-colors" 
                required 
                onChange={e => setNewNom(e.target.value)} 
              />
              <input 
                placeholder="Téléphone" 
                value={newPhone} 
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-slate-700 transition-colors" 
                onChange={e => setNewPhone(e.target.value)} 
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button 
                type="submit" 
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Créer & Lier
              </button>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-white text-xs px-2 cursor-pointer transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
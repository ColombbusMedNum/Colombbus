"use client";

import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, addDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { 
  UserPlusIcon, 
  PencilSquareIcon, 
  ArchiveBoxIcon,
  ChevronLeftIcon,
  ClockIcon,
  UserIcon,
  XMarkIcon,
  EnvelopeIcon,      
  Squares2X2Icon,  
  ListBulletIcon,
  MapPinIcon,
  PlusIcon,
  ChevronDownIcon,
  CalendarDaysIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";

const JOURS_SEMAINE = [
  { key: "lundi", label: "Lundi" },
  { key: "mardi", label: "Mardi" },
  { key: "mercredi", label: "Mercredi" },
  { key: "jeudi", label: "Jeudi" },
  { key: "vendredi", label: "Vendredi" }
];

const HORAIRES_PAR_DEFAUT = {
  lundi: { debut: "09:30", fin: "17:00" },
  mardi: { debut: "09:30", fin: "17:00" },
  mercredi: { debut: "09:30", fin: "17:00" },
  jeudi: { debut: "09:30", fin: "17:00" },
  vendredi: { debut: "09:30", fin: "17:00" }
};

const getTerritoryColor = (territory: string) => {
  const t = territory.toLowerCase().trim();
  if (t === "paris") return "bg-blue-950/40 border-blue-800/60 text-blue-400";
  if (t === "massy") return "bg-orange-950/40 border-orange-800/60 text-orange-400";
  
  const hash = t.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    "bg-emerald-950/40 border-emerald-800/60 text-emerald-400",
    "bg-purple-950/40 border-purple-800/60 text-purple-400",
    "bg-cyan-950/40 border-cyan-800/60 text-cyan-400",
    "bg-pink-950/40 border-pink-800/60 text-pink-400",
    "bg-amber-950/40 border-amber-800/60 text-amber-400",
    "bg-indigo-950/40 border-indigo-800/60 text-indigo-400",
  ];
  return colors[hash % colors.length];
};

export default function GestionEquipe() {
  const [mediateurs, setMediateurs] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<any | null>(null);
  
  const [currentTab, setCurrentTab] = useState<"actifs" | "archives">("actifs");
  const [displayMode, setDisplayMode] = useState<"cartes" | "liste">("cartes");

  const [grillesHorairesACI, setGrillesHorairesACI] = useState<{ [site: string]: any }>({
    Paris: { ...HORAIRES_PAR_DEFAUT },
    Massy: { ...HORAIRES_PAR_DEFAUT }
  });

  const [accordionOpen, setAccordionOpen] = useState<{ [site: string]: boolean }>({
    Paris: false,
    Massy: false
  });

  const [listeTerritoires, setListeTerritoires] = useState<string[]>(["Paris", "Massy"]);
  const [nouveauTerritoireInput, setNouveauTerritoireInput] = useState("");

  const [formData, setFormData] = useState({
    prenom: "",      
    nom: "",         
    trigramme: "",   
    email: "",
    telephone: "",
    poste: "Médiateur Numérique",
    statut: "Permanent", 
    sites: [] as string[], 
    rattachementHoraireACI: "Paris", 
    taux: 0,
    actif: true
  });

  useEffect(() => {
    const unsubMediateurs = onSnapshot(collection(db, "liste_mediateurs"), (snapshot) => {
      const data = snapshot.docs
        .filter(doc => doc.id !== "parametres_configuration" && doc.id !== "parametres_horaires")
        .map(doc => ({ id: doc.id, ...doc.data() }));
      setMediateurs(data);
    });

    const unsubConfig = onSnapshot(doc(db, "liste_mediateurs", "parametres_configuration"), (snapshot) => {
      if (snapshot.exists() && snapshot.data().territoires) {
        setListeTerritoires(snapshot.data().territoires.sort());
      } else {
        setDoc(doc(db, "liste_mediateurs", "parametres_configuration"), { territoires: ["Paris", "Massy"] });
      }
    });

    const unsubHoraires = onSnapshot(doc(db, "liste_mediateurs", "parametres_horaires"), (snapshot) => {
      if (snapshot.exists()) {
        setGrillesHorairesACI(snapshot.data());
      } else {
        setDoc(doc(db, "liste_mediateurs", "parametres_horaires"), {
          Paris: { ...HORAIRES_PAR_DEFAUT },
          Massy: { ...HORAIRES_PAR_DEFAUT }
        });
      }
    });

    return () => {
      unsubMediateurs();
      unsubConfig();
      unsubHoraires();
    };
  }, []);

  const handleAddTerritoire = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomNettoye = nouveauTerritoireInput.trim();
    if (!nomNettoye) return;
    
    if (listeTerritoires.some(t => t.toLowerCase() === nomNettoye.toLowerCase())) {
      alert("Ce territoire existe déjà !");
      return;
    }

    const nouvelleListe = [...listeTerritoires, nomNettoye].sort();
    setListeTerritoires(nouvelleListe);
    setNouveauTerritoireInput("");
    
    try {
      await setDoc(doc(db, "liste_mediateurs", "parametres_configuration"), { territoires: nouvelleListe });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSupprimerTerritoire = async (nom: string) => {
    if (nom === "Paris" || nom === "Massy") {
      alert("Les territoires pivots 'Paris' et 'Massy' ne peuvent pas être supprimés.");
      return;
    }
    if (!confirm(`Supprimer le territoire "${nom}" ?`)) return;

    const nouvelleListe = listeTerritoires.filter(t => t !== nom).sort();
    setListeTerritoires(nouvelleListe);
    try {
      await setDoc(doc(db, "liste_mediateurs", "parametres_configuration"), { territoires: nouvelleListe });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGlobalHoraireChange = async (site: "Paris" | "Massy", jour: string, type: "debut" | "fin", val: string) => {
    const updated = {
      ...grillesHorairesACI,
      [site]: {
        ...grillesHorairesACI[site],
        [jour]: { ...grillesHorairesACI[site][jour], [type]: val }
      }
    };
    setGrillesHorairesACI(updated);
    try {
      await setDoc(doc(db, "liste_mediateurs", "parametres_horaires"), updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckboxTerritoireChange = (territoryName: string) => {
    setFormData(prev => {
      const dejaSelectionne = prev.sites.includes(territoryName);
      return {
        ...prev,
        sites: dejaSelectionne ? prev.sites.filter(t => t !== territoryName) : [...prev.sites, territoryName]
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.prenom || !formData.nom) return;

    // Protection pour s'assurer que le taux transmis est un nombre valide
    const netPayload = {
      ...formData,
      taux: Number(formData.taux) || 0
    };

    try {
      if (editingMed) {
        await updateDoc(doc(db, "liste_mediateurs", editingMed.id), netPayload);
      } else {
        await addDoc(collection(db, "liste_mediateurs"), netPayload);
      }
      closeModal();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleArchive = async (m: any) => {
    try {
      await updateDoc(doc(db, "liste_mediateurs", m.id), { actif: !m.actif });
    } catch (err) {
      console.error(err);
    }
  };

  const openModal = (med: any = null) => {
    if (med) {
      setEditingMed(med);
      setFormData({
        prenom: med.prenom || "",
        nom: med.nom || "",
        trigramme: med.trigramme || "",
        email: med.email || "",
        telephone: med.telephone || "",
        poste: med.poste || "Médiateur Numérique",
        statut: med.statut || "Permanent",
        sites: med.sites ? med.sites : (med.sitePrincipal ? [med.sitePrincipal] : []),
        rattachementHoraireACI: med.rattachementHoraireACI || "Paris",
        taux: med.taux !== undefined ? Number(med.taux) : 0,
        actif: med.actif !== undefined ? med.actif : true
      });
    } else {
      setEditingMed(null);
      setFormData({
        prenom: "",
        nom: "",
        trigramme: "",
        email: "",
        telephone: "",
        poste: "Médiateur Numérique",
        statut: "Permanent",
        sites: [],
        rattachementHoraireACI: "Paris",
        taux: 0,
        actif: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMed(null);
  };

  const filteredMediateurs = mediateurs
    .filter(m => (currentTab === "actifs" ? m.actif !== false : m.actif === false))
    .sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      
      {/* HEADER */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 border-b border-slate-900 pb-6">
        <div className="flex items-center gap-3">
          <Link 
            href="/" 
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer flex items-center justify-center"
            title="Retour à l'accueil"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Gestion de l'Équipe & Territoires
            </h1>
            <p className="text-xs text-slate-500 font-medium">Configurez vos territoires et ajustez les grilles horaires fixes de vos ACI</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <Link 
            href="/activites_types" 
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-5 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all cursor-pointer flex-1 md:flex-none"
          >
            <CalendarDaysIcon className="w-5 h-5" /> 
            <span>Agenda Médiateurs</span>
          </Link>

          <button 
            onClick={() => openModal()} 
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all cursor-pointer flex-1 md:flex-none"
          >
            <UserPlusIcon className="w-5 h-5" /> 
            <span>Ajouter un membre</span>
          </button>
        </div>
      </div>

      {/* REFERENTIEL DES TERRITOIRES */}
      <div className="max-w-7xl mx-auto mb-8 p-5 bg-slate-950/40 border border-slate-900 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MapPinIcon className="w-5 h-5 text-emerald-400" />
          <div>
            <span className="text-xs font-black uppercase text-slate-300 block">Référentiel des Territoires</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {listeTerritoires.map(t => (
                <span key={t} className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-[11px] font-bold ${getTerritoryColor(t)}`}>
                  {t}
                  {t !== "Paris" && t !== "Massy" && (
                    <button type="button" onClick={() => handleSupprimerTerritoire(t)} className="opacity-60 hover:opacity-100 font-normal ml-0.5 cursor-pointer">×</button>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleAddTerritoire} className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <input 
            type="text" 
            placeholder="Nouveau territoire (ex: Lyon, Lille)..." 
            className="p-2.5 bg-black border border-slate-800 focus:border-emerald-500 text-white rounded-xl text-xs font-bold outline-none w-full md:w-56"
            value={nouveauTerritoireInput}
            onChange={e => setNouveauTerritoireInput(e.target.value)}
          />
          <button type="submit" className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer">
            <PlusIcon className="w-4 h-4 text-emerald-500" /> Créer
          </button>
        </form>
      </div>

      {/* GRILLES HORAIRES Fixed */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {(["Paris", "Massy"] as const).map(site => {
          const isOpen = accordionOpen[site];
          return (
            <div key={site} className="bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
              <div 
                onClick={() => setAccordionOpen(prev => ({ ...prev, [site]: !prev[site] }))}
                className="p-4 bg-slate-900/20 hover:bg-slate-900/40 cursor-pointer flex items-center justify-between transition-all select-none"
              >
                <div className="flex items-center gap-2.5">
                  <ClockIcon className="w-4 h-4 text-orange-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                    Grille Horaires ACI — {site}
                  </h3>
                </div>
                <ChevronDownIcon className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180 text-orange-400" : ""}`} />
              </div>

              {isOpen && (
                <div className="p-5 border-t border-slate-900/60 space-y-2.5 bg-black/10">
                  {JOURS_SEMAINE.map(j => (
                    <div key={j.key} className="flex items-center justify-between p-2 bg-slate-900/30 border border-slate-900/60 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide pl-1">{j.label}</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="time" 
                          className="p-1.5 bg-black border border-slate-800 text-white font-mono text-xs rounded text-center w-20 outline-none focus:border-orange-500/80"
                          value={grillesHorairesACI[site]?.[j.key]?.debut || "09:30"}
                          onChange={e => handleGlobalHoraireChange(site, j.key, "debut", e.target.value)}
                        />
                        <span className="text-slate-600 text-[10px] font-bold uppercase">à</span>
                        <input 
                          type="time" 
                          className="p-1.5 bg-black border border-slate-800 text-white font-mono text-xs rounded text-center w-20 outline-none focus:border-orange-500/80"
                          value={grillesHorairesACI[site]?.[j.key]?.fin || "17:00"}
                          onChange={e => handleGlobalHoraireChange(site, j.key, "fin", e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FILTRES */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 mb-6 bg-slate-950/40 p-1.5 rounded-xl border border-slate-900/60">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-900">
          <button onClick={() => setCurrentTab("actifs")} className={`px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${currentTab === "actifs" ? "bg-slate-900 text-emerald-400" : "text-slate-500"}`}>
            Membres actifs ({filteredMediateurs.length})
          </button>
          <button onClick={() => setCurrentTab("archives")} className={`px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${currentTab === "archives" ? "bg-slate-900 text-orange-400" : "text-slate-500"}`}>
            Archives
          </button>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-900">
          <button onClick={() => setDisplayMode("cartes")} className={`p-2 rounded-md cursor-pointer ${displayMode === "cartes" ? "bg-slate-900 text-white" : "text-slate-600"}`}><Squares2X2Icon className="w-4 h-4" /></button>
          <button onClick={() => setDisplayMode("liste")} className={`p-2 rounded-md cursor-pointer ${displayMode === "liste" ? "bg-slate-900 text-white" : "text-slate-600"}`}><ListBulletIcon className="w-4 h-4" /></button>
        </div>
      </div>

      {/* LISTING COLLABORATEURS */}
      <div className="max-w-7xl mx-auto">
        {filteredMediateurs.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
            <p className="text-slate-500 text-sm font-medium">Aucun collaborateur trouvé.</p>
          </div>
        ) : displayMode === "cartes" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMediateurs.map((m) => {
              const localSites = m.sites || [];
              return (
                <div key={m.id} className="group relative bg-slate-950/90 border-2 border-slate-700 hover:border-emerald-500/50 rounded-2xl p-5 shadow-2xl flex flex-col justify-between min-h-[190px] transition-all duration-200">
                  <div className="absolute top-0 right-0 px-4 py-1.5 rounded-bl-xl rounded-tr-2xl text-[10px] font-black uppercase border-l-2 border-b-2 border-slate-700 bg-slate-900">
                    {m.statut}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 font-black text-xs">
                        {m.trigramme || `${m.prenom?.[0] || ""}${m.nom?.[0] || ""}`}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white">{m.prenom} <span className="uppercase text-slate-300 font-extrabold">{m.nom}</span></h3>
                        <p className="text-[11px] text-slate-500 font-semibold">{m.poste}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 border-t border-slate-900/60 pt-3 text-[11px] text-slate-400">
                      {m.email && <p className="truncate"><EnvelopeIcon className="w-3.5 h-3.5 inline mr-1 text-slate-600" /> {m.email}</p>}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MapPinIcon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        {localSites.length === 0 ? (
                          <span className="text-[10px] italic text-slate-600">Aucun territoire affecté</span>
                        ) : (
                          localSites.map((s: string) => (
                            <span key={s} className={`px-2 py-0.5 border text-[10px] font-bold rounded-md transition-colors ${getTerritoryColor(s)}`}>
                              {s}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-900/60 pt-3 mt-4">
                    <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-2">
                      <span className="bg-slate-900 px-2 py-1 rounded border border-slate-800 text-slate-300">Taux : {m.taux || 0}€</span>
                      {m.statut === "ACI" && (
                        <span className="text-orange-400 bg-orange-950/20 border border-orange-900/30 px-2 py-1 rounded flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5" /> Référence : {m.rattachementHoraireACI || "Paris"}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => openModal(m)} className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"><PencilSquareIcon className="w-4 h-4" /></button>
                      <button onClick={() => toggleArchive(m)} className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 cursor-pointer"><ArchiveBoxIcon className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* VERSION TABLEAU */
          <div className="w-full bg-slate-950/40 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 text-[10px] font-black uppercase text-slate-500 border-b-2 border-slate-700">
                  <th className="p-4 pl-6">Collaborateur</th>
                  <th className="p-4">Poste</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4">Territoire(s) affecté(s)</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                {filteredMediateurs.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-950/50">
                    <td className="p-4 pl-6 font-bold text-white">{m.prenom} <span className="uppercase text-slate-400 ml-0.5">{m.nom}</span></td>
                    <td className="p-4 text-slate-400">{m.poste}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase border border-slate-800 bg-slate-900">{m.statut}</span>
                        {m.statut === "ACI" && <span className="text-[10px] text-orange-400">({m.rattachementHoraireACI})</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {(m.sites || []).map((s: string) => (
                          <span key={s} className={`px-2 py-0.5 border text-[10px] font-semibold rounded ${getTerritoryColor(s)}`}>{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button onClick={() => openModal(m)} className="p-1 text-slate-500 hover:text-white mr-2 cursor-pointer"><PencilSquareIcon className="w-4 h-4" /></button>
                      <button onClick={() => toggleArchive(m)} className="p-1 text-slate-500 cursor-pointer"><ArchiveBoxIcon className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALE RECRUTEMENT / EDITION CORRIGÉE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-950 border-2 border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-5">
              <h2 className="text-base font-black uppercase text-white flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-emerald-500" />
                {editingMed ? "Modifier la fiche" : "Nouveau membre de l'équipe"}
              </h2>
              <button onClick={closeModal} className="p-1.5 bg-slate-900 border border-slate-800 text-slate-500 hover:text-white rounded-lg cursor-pointer"><XMarkIcon className="w-4 h-4" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Prénom *</label>
                  <input type="text" required className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none" value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Nom *</label>
                  <input type="text" required className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg outline-none uppercase" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Trigramme</label>
                  <input type="text" maxLength={3} className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg text-center uppercase" value={formData.trigramme} onChange={e => setFormData({...formData, trigramme: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Poste</label>
                  <input type="text" className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg" value={formData.poste} onChange={e => setFormData({...formData, poste: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-900/60 pt-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Statut contractuel</label>
                  <select className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-lg outline-none font-bold" value={formData.statut} onChange={e => setFormData({...formData, statut: e.target.value})}>
                    <option value="Permanent">Permanent</option>
                    <option value="Cadre">Cadre</option>
                    <option value="Stagiaire">Stagiaire</option>
                    <option value="ACI">ACI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Coût Horaire (€)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full p-3 bg-slate-900/50 border border-slate-800 text-white rounded-lg text-center font-bold" 
                    value={formData.taux || ""} 
                    placeholder="0"
                    onChange={e => setFormData({...formData, taux: e.target.value === "" ? 0 : Number(e.target.value)})} 
                  />
                </div>
              </div>

              {formData.statut === "ACI" && (
                <div className="p-3.5 bg-orange-950/20 border border-orange-900/40 rounded-xl">
                  <label className="block text-[10px] font-black uppercase text-orange-400 mb-1.5 flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5" /> Grille de référence ACI
                  </label>
                  <select 
                    className="w-full p-2.5 bg-black border border-orange-900/40 text-white rounded-lg outline-none font-bold text-xs"
                    value={formData.rattachementHoraireACI}
                    onChange={e => setFormData({...formData, rattachementHoraireACI: e.target.value})}
                  >
                    <option value="Paris">Suivre la grille de Paris</option>
                    <option value="Massy">Suivre la grille de Massy</option>
                  </select>
                </div>
              )}

              <div className="border-t border-slate-900/60 pt-4">
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Affectation Territoire(s)</label>
                <div className="bg-slate-900/30 border border-slate-850 rounded-xl p-2.5 grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {listeTerritoires.map(t => {
                    const estCoche = formData.sites.includes(t);
                    return (
                      <label key={t} className="flex items-center gap-2.5 p-2 bg-black/40 hover:bg-black border border-slate-800 rounded-lg cursor-pointer transition-colors select-none">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded accent-emerald-500 bg-slate-950 border-slate-800 cursor-pointer"
                          checked={estCoche}
                          onChange={() => handleCheckboxTerritoireChange(t)}
                        />
                        <span className={`text-xs ${estCoche ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>{t}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800/60 pt-5 mt-6">
                <button type="button" onClick={closeModal} className="px-5 py-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white cursor-pointer">Annuler</button>
                <button type="submit" className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-black uppercase cursor-pointer">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
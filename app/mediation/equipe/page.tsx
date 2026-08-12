"use client";

import React, { useEffect, useState } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db, firebaseConfig } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { Quicksand } from "next/font/google";
import { 
  UserPlusIcon, 
  PencilSquareIcon, 
  ArchiveBoxIcon,
  ChevronLeftIcon,
  ClockIcon,
  UserIcon,
  XMarkIcon,
  EnvelopeIcon,   
  PhoneIcon,   
  Squares2X2Icon,  
  ListBulletIcon,
  MapPinIcon,
  PlusIcon,
  ChevronDownIcon,
  CalendarDaysIcon,
  ShieldCheckIcon,
  AcademicCapIcon,
  KeyIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import PageGuard from "@/components/PageGuard";
import { useMediateurs } from "@/lib/MediateursProvider";
import { ROLES, normalizeRole } from "@/lib/roles";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { getTerritoryColor } from "@/lib/territoryColor";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

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

// Les deux fonctions ci-dessous acceptent aussi bien les ids canoniques
// (lib/roles.ts) que d'anciennes valeurs ("Mediateur", "CoordinateurProjet"...)
// encore présentes sur des fiches non ré-enregistrées, via normalizeRole().
const getRoleTextColor = (role: string) => {
  switch (normalizeRole(role)) {
    case 'admin': return 'text-[#EA601F] font-bold';
    case 'aci': return 'text-[#005259]/70';
    case 'coordinateur': return 'text-[#005259] font-bold';
    default: return 'text-[#404040]/80';
  }
};

const getRoleLabel = (role: string) => {
  return ROLES.find((r) => r.id === normalizeRole(role))?.nom || role;
};

export default function GestionEquipe() {
  const { mediateurs: mediateursBruts } = useMediateurs();
  const mediateurs = React.useMemo(() => {
    return mediateursBruts.filter(
      (m: any) => m.id !== "parametres_configuration" && m.id !== "parametres_horaires"
    );
  }, [mediateursBruts]);
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
  
  const [listeQualitesGlobales, setListeQualitesGlobales] = useState<string[]>([]);
  const [competenceInput, setCompetenceInput] = useState("");

  const [formData, setFormData] = useState({
    prenom: "",      
    nom: "",         
    trigramme: "",   
    email: "",
    telephone: "",
    poste: "Médiateur Numérique",
    statut: "Permanent", 
    role: "mediateur",
    sites: [] as string[],
    rattachementHoraireACI: "Paris", 
    taux: 0,
    actif: true,
    competences: [] as string[]
  });

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "liste_mediateurs", "parametres_configuration"), (snapshot) => {
      if (snapshot.exists()) {
        const configData = snapshot.data();
        if (configData.territoires) {
          setListeTerritoires(configData.territoires.sort());
        }
        if (configData.qualitesGlobales) {
          setListeQualitesGlobales(configData.qualitesGlobales.sort());
        } else {
          setListeQualitesGlobales([]);
        }
      } else {
        setDoc(doc(db, "liste_mediateurs", "parametres_configuration"), { 
          territoires: ["Paris", "Massy"],
          qualitesGlobales: ["Excel", "Word"]
        });
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
      await updateDoc(doc(db, "liste_mediateurs", "parametres_configuration"), { territoires: nouvelleListe });
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
      await updateDoc(doc(db, "liste_mediateurs", "parametres_configuration"), { territoires: nouvelleListe });
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

  const handleAddCompetence = async (qualitePreselectionnee?: string) => {
    const value = (qualitePreselectionnee || competenceInput).trim();
    if (!value) return;

    if (!formData.competences.includes(value)) {
      setFormData(prev => ({
        ...prev,
        competences: [...prev.competences, value]
      }));
    }

    if (!listeQualitesGlobales.some(q => q.toLowerCase() === value.toLowerCase())) {
      const nouveauCatalogue = [...listeQualitesGlobales, value].sort();
      setListeQualitesGlobales(nouveauCatalogue);
      try {
        await updateDoc(doc(db, "liste_mediateurs", "parametres_configuration"), {
          qualitesGlobales: nouveauCatalogue
        });
      } catch (err) {
        console.error("Erreur lors de la mise à jour du catalogue de qualités :", err);
      }
    }

    setCompetenceInput("");
  };

  const handleRemoveCompetence = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      competences: prev.competences.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.prenom || !formData.nom || !formData.email) {
      alert("Le prénom, le nom et l'adresse email sont obligatoires.");
      return;
    }

    const netPayload = {
      ...formData,
      email: formData.email.trim().toLowerCase(),
      telephone: formData.telephone.trim(),
      taux: Number(formData.taux) || 0
    };

    try {
      if (editingMed) {
        await updateDoc(doc(db, "liste_mediateurs", editingMed.id), netPayload);
      } else {
        // Créer la fiche seule, sans compte de connexion : certains
        // médiateurs ajoutés à la plateforme n'ont pas vocation à s'y
        // connecter. L'accès (compte Auth + email de configuration) se
        // déclenche séparément, à la demande, via le bouton clé
        // (handleCreateAccess) — jamais automatiquement à la création.
        await setDoc(doc(collection(db, "liste_mediateurs")), netPayload);
      }
      closeModal();
    } catch (err: any) {
      console.error(err);
      alert("Une erreur est survenue lors de la création du membre.");
    }
  };

  const toggleArchive = async (m: any) => {
    try {
      await updateDoc(doc(db, "liste_mediateurs", m.id), { actif: !m.actif });
    } catch (err) {
      console.error(err);
    }
  };

  // Pour une fiche créée avant l'automatisation ci-dessus (handleSubmit),
  // encore indexée par un ID Firestore aléatoire au lieu de l'UID Firebase
  // Auth : crée le compte manquant puis migre la fiche vers l'UID, avec la
  // même mécanique d'app Firebase secondaire (ne remplace pas la session de
  // l'admin en cours).
  const handleCreateAccess = async (m: any) => {
    if (!m.email) {
      alert("Cette fiche n'a pas d'adresse email, impossible de créer un accès.");
      return;
    }
    if (!confirm(`Créer l'accès de connexion pour ${m.prenom} ${m.nom} (${m.email}) ?`)) return;

    const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const tempPassword = crypto.randomUUID();
      const credential = await createUserWithEmailAndPassword(secondaryAuth, m.email, tempPassword);
      const { id, ...data } = m;
      await setDoc(doc(db, "liste_mediateurs", credential.user.uid), data);
      await deleteDoc(doc(db, "liste_mediateurs", m.id));
      await sendPasswordResetEmail(auth, m.email);
      alert("Compte créé et e-mail de configuration envoyé avec succès.");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        alert("Un compte existe déjà avec cette adresse email.");
      } else {
        alert("Erreur lors de la création de l'accès.");
      }
    } finally {
      await deleteApp(secondaryApp);
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
        role: normalizeRole(med.role),
        sites: med.sites ? med.sites : (med.sitePrincipal ? [med.sitePrincipal] : []),
        rattachementHoraireACI: med.rattachementHoraireACI || "Paris",
        taux: med.taux !== undefined ? Number(med.taux) : 0,
        actif: med.actif !== undefined ? med.actif : true,
        competences: med.competences || []
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
        role: "mediateur",
        sites: [],
        rattachementHoraireACI: "Paris",
        taux: 0,
        actif: true,
        competences: []
      });
    }
    setIsModalOpen(true);
    setCompetenceInput("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMed(null);
  };

  const filteredMediateurs = mediateurs
    .filter(m => (currentTab === "actifs" ? m.actif !== false : m.actif === false))
    .sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));

  return (
    <PageGuard pageId="page_access_equipe">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">

        {/* HEADER & NAVIGATION */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="p-2.5 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 text-[#005259] rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-sm"
              title="Retour à l'accueil"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Gestion de l'Équipe <span className="text-[#EA601F] font-normal">& Territoires</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5">
                  Configurez vos territoires, rôles applicatifs et grilles horaires
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <Link 
              href="/mediation/competences" 
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <AcademicCapIcon className="w-4 h-4 text-[#EA601F]" /> 
              <span>Compétences</span>
            </Link>

            <Link 
              href="/agenda" 
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" /> 
              <span>Agenda</span>
            </Link>

            <button 
              onClick={() => openModal()} 
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md active:scale-95 group"
            >
              <UserPlusIcon className="w-4 h-4 transition-transform group-hover:scale-110" /> 
              <span>Nouveau membre</span>
            </button>
          </div>
        </div>

        {/* REFERENTIEL DES TERRITOIRES */}
        <div className="p-4 bg-white border border-[#404040]/10 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <MapPinIcon className="w-5 h-5 text-[#EA601F]" />
            <div>
              <span className="text-xs font-bold uppercase text-[#005259] block">Référentiel des Territoires</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
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
              className="p-2.5 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] text-[#404040] placeholder-[#404040]/40 rounded-xl text-xs font-medium outline-none w-full md:w-56 transition-all"
              value={nouveauTerritoireInput}
              onChange={e => setNouveauTerritoireInput(e.target.value)}
            />
            <button type="submit" className="px-3.5 py-2.5 bg-[#005259] hover:bg-[#EA601F] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 cursor-pointer transition-all shadow-sm">
              <PlusIcon className="w-4 h-4" /> Créer
            </button>
          </form>
        </div>

        {/* GRILLES HORAIRES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["Paris", "Massy"] as const).map(site => {
            const isOpen = accordionOpen[site];
            return (
              <div key={site} className="bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
                <div 
                  onClick={() => setAccordionOpen(prev => ({ ...prev, [site]: !prev[site] }))}
                  className="p-4 bg-white hover:bg-[#F3F3F2]/60 cursor-pointer flex items-center justify-between transition-all select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <ClockIcon className="w-4 h-4 text-[#EA601F]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#005259]">
                      Grille Horaires ACI — {site}
                    </h3>
                  </div>
                  <ChevronDownIcon className={`w-4 h-4 text-[#404040]/50 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#EA601F]" : ""}`} />
                </div>

                {isOpen && (
                  <div className="p-4 border-t border-[#404040]/10 space-y-2 bg-[#F3F3F2]/40">
                    {JOURS_SEMAINE.map(j => (
                      <div key={j.key} className="flex items-center justify-between p-2 bg-white border border-[#404040]/10 rounded-xl shadow-xs">
                        <span className="text-[11px] font-bold text-[#005259] uppercase tracking-wide pl-1">{j.label}</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="time" 
                            className="p-1 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] font-mono text-xs rounded text-center w-20 outline-none focus:border-[#005259]"
                            value={grillesHorairesACI[site]?.[j.key]?.debut || "09:30"}
                            onChange={e => handleGlobalHoraireChange(site, j.key, "debut", e.target.value)}
                          />
                          <span className="text-[#404040]/50 text-[10px] font-bold uppercase">à</span>
                          <input 
                            type="time" 
                            className="p-1 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] font-mono text-xs rounded text-center w-20 outline-none focus:border-[#005259]"
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

        {/* FILTRES & VUES */}
        <div className="flex items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-[#404040]/10 shadow-sm">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setCurrentTab("actifs")} 
              className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                currentTab === "actifs" ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/70 hover:text-[#005259] hover:bg-[#F3F3F2]"
              }`}
            >
              Membres actifs ({filteredMediateurs.length})
            </button>
            <button 
              onClick={() => setCurrentTab("archives")} 
              className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                currentTab === "archives" ? "bg-[#EF736A] text-white shadow-sm" : "text-[#404040]/70 hover:text-[#EF736A] hover:bg-[#F3F3F2]"
              }`}
            >
              Archives
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#F3F3F2] p-1 rounded-xl border border-[#404040]/10">
            <button 
              onClick={() => setDisplayMode("cartes")} 
              className={`p-1.5 rounded-lg cursor-pointer transition-all ${displayMode === "cartes" ? "bg-white text-[#005259] shadow-xs font-bold" : "text-[#404040]/50 hover:text-[#404040]"}`}
            >
              <Squares2X2Icon className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setDisplayMode("liste")} 
              className={`p-1.5 rounded-lg cursor-pointer transition-all ${displayMode === "liste" ? "bg-white text-[#005259] shadow-xs font-bold" : "text-[#404040]/50 hover:text-[#404040]"}`}
            >
              <ListBulletIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* LISTING COLLABORATEURS */}
        <div>
          {filteredMediateurs.length === 0 ? (
            <div className="text-center py-16 border border-[#404040]/10 rounded-2xl bg-white shadow-sm">
              <p className="text-[#404040]/60 text-xs font-bold uppercase tracking-wider">Aucun collaborateur trouvé.</p>
            </div>
          ) : displayMode === "cartes" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMediateurs.map((m) => {
                const localSites = m.sites || [];
                const userRole = normalizeRole(m.role);
                return (
                  <div key={m.id} className="group relative bg-white border border-[#404040]/10 hover:border-[#005259]/30 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[200px]">
                    <div className="absolute top-0 right-0 flex divide-x divide-[#404040]/10 rounded-bl-xl rounded-tr-2xl border-l border-b border-[#404040]/10 bg-[#F3F3F2] text-[10px] font-bold uppercase">
                      <span className="px-2.5 py-1 text-[#404040]">{m.statut}</span>
                      <span className={`px-2.5 py-1 ${getRoleTextColor(userRole)}`}>
                        {getRoleLabel(userRole)}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#005259]/10 border border-[#005259]/20 flex items-center justify-center text-[#005259] font-bold text-xs">
                          {m.trigramme || `${m.prenom?.[0] || ""}${m.nom?.[0] || ""}`}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-[#005259] group-hover:text-[#EA601F] transition-colors">{m.prenom} <span className="uppercase">{m.nom}</span></h3>
                          <p className="text-[11px] text-[#404040]/70 font-medium">{m.poste}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5 border-t border-[#404040]/10 pt-3 text-[11px] text-[#404040]/80">
                        {m.email && <p className="truncate"><EnvelopeIcon className="w-3.5 h-3.5 inline mr-1 text-[#EA601F]" /> {m.email}</p>}
                        {m.telephone && (
                          <p className="truncate">
                            <PhoneIcon className="w-3.5 h-3.5 inline mr-1 text-[#EA601F]" /> {formatPhoneNumber(m.telephone)}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <MapPinIcon className="w-3.5 h-3.5 text-[#EA601F] shrink-0" />
                          {localSites.length === 0 ? (
                            <span className="text-[10px] italic text-[#404040]/40">Aucun territoire affecté</span>
                          ) : (
                            localSites.map((s: string) => (
                              <span key={s} className={`px-2 py-0.5 border text-[10px] font-bold rounded-md ${getTerritoryColor(s)}`}>
                                {s}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#404040]/10 pt-3 mt-4">
                      <div className="text-[10px] text-[#404040]/70 font-bold uppercase flex items-center gap-2">
                        <span className="bg-[#F3F3F2] px-2 py-1 rounded border border-[#404040]/10 text-[#005259]">Taux : {m.taux || 0}€</span>
                        {m.statut === "ACI" && (
                          <span className="text-[#EA601F] bg-[#F9945D]/15 border border-[#F9945D]/30 px-2 py-1 rounded flex items-center gap-1">
                            <ClockIcon className="w-3.5 h-3.5" /> Réf : {m.rattachementHoraireACI || "Paris"}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleCreateAccess(m)} title="Créer l'accès de connexion" className="p-2 rounded-xl bg-[#F3F3F2] text-[#404040]/70 border border-[#404040]/10 hover:text-[#EA601F] hover:bg-[#EA601F]/10 transition-colors cursor-pointer"><KeyIcon className="w-4 h-4" /></button>
                        <button onClick={() => openModal(m)} title="Modifier" className="p-2 rounded-xl bg-[#F3F3F2] text-[#404040]/70 border border-[#404040]/10 hover:text-[#005259] hover:bg-[#005259]/10 transition-colors cursor-pointer"><PencilSquareIcon className="w-4 h-4" /></button>
                        <button onClick={() => toggleArchive(m)} title="Archiver" className="p-2 rounded-xl bg-[#F3F3F2] text-[#404040]/70 border border-[#404040]/10 hover:text-[#EF736A] hover:bg-[#EF736A]/10 transition-colors cursor-pointer"><ArchiveBoxIcon className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VERSION TABLEAU */
            <div className="w-full bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                      <th className="px-6 py-4">Collaborateur</th>
                      <th className="px-6 py-4">Email Login</th>
                      <th className="px-6 py-4">Rôle Applicatif</th>
                      <th className="px-6 py-4">Territoire(s) affecté(s)</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]/5 text-xs text-[#404040]">
                    {filteredMediateurs.map((m) => {
                      const userRole = normalizeRole(m.role);
                      return (
                        <tr key={m.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                          <td className="px-6 py-4 font-bold text-[#005259] uppercase">{m.prenom} <span className="text-[#404040]">{m.nom}</span></td>
                          <td className="px-6 py-4 text-[#404040]/80 font-mono text-[11px]">{m.email || "-"}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border border-[#404040]/10 bg-[#F3F3F2] ${getRoleTextColor(userRole)}`}>
                              {getRoleLabel(userRole)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {(m.sites || []).map((s: string) => (
                                <span key={s} className={`px-2 py-0.5 border text-[10px] font-semibold rounded ${getTerritoryColor(s)}`}>{s}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleCreateAccess(m)} title="Créer l'accès de connexion" className="p-1.5 text-[#404040]/60 hover:text-[#EA601F] mr-1 cursor-pointer"><KeyIcon className="w-4 h-4" /></button>
                            <button onClick={() => openModal(m)} className="p-1.5 text-[#404040]/60 hover:text-[#005259] mr-1 cursor-pointer"><PencilSquareIcon className="w-4 h-4" /></button>
                            <button onClick={() => toggleArchive(m)} className="p-1.5 text-[#404040]/60 hover:text-[#EF736A] cursor-pointer"><ArchiveBoxIcon className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODALE RECRUTEMENT / EDITION */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-[#005259]/20 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-[#404040]/10 w-full max-w-lg rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#404040]/10 pb-4 mb-5">
                <h2 className="text-base font-bold uppercase text-[#005259] flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-[#EA601F]" />
                  {editingMed ? "Modifier la fiche" : "Nouveau membre de l'équipe"}
                </h2>
                <button onClick={closeModal} className="p-1.5 bg-[#F3F3F2] border border-[#404040]/10 text-[#404040]/60 hover:text-[#404040] rounded-lg cursor-pointer"><XMarkIcon className="w-4 h-4" /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Prénom *</label>
                    <input type="text" required className="w-full p-3 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl outline-none focus:border-[#005259] focus:ring-1 focus:ring-[#005259]" value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Nom *</label>
                    <input type="text" required className="w-full p-3 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl outline-none uppercase focus:border-[#005259] focus:ring-1 focus:ring-[#005259]" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Trigramme</label>
                    <input type="text" maxLength={3} className="w-full p-3 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-center uppercase outline-none focus:border-[#005259] focus:ring-1 focus:ring-[#005259]" value={formData.trigramme} onChange={e => setFormData({...formData, trigramme: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Email *</label>
                    <input type="email" required placeholder="nom@colombbus.org" className="w-full p-3 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] placeholder-[#404040]/40 rounded-xl font-mono outline-none focus:border-[#005259] focus:ring-1 focus:ring-[#005259]" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Poste</label>
                    <input type="text" className="w-full p-3 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl outline-none focus:border-[#005259] focus:ring-1 focus:ring-[#005259]" value={formData.poste} onChange={e => setFormData({...formData, poste: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Téléphone</label>
                    <input type="tel" placeholder="06..." className="w-full p-3 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] placeholder-[#404040]/40 rounded-xl outline-none focus:border-[#005259] focus:ring-1 focus:ring-[#005259]" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 border-t border-[#404040]/10 pt-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Type Contrat</label>
                    <select className="w-full p-3 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl outline-none font-bold" value={formData.statut} onChange={e => setFormData({...formData, statut: e.target.value})}>
                      <option value="Permanent">Permanent</option>
                      <option value="Cadre">Cadre</option>
                      <option value="Stagiaire">Stagiaire</option>
                      <option value="ACI">ACI</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#EA601F] mb-1.5 flex items-center gap-1">
                      <ShieldCheckIcon className="w-3.5 h-3.5" /> Droits / Rôle
                    </label>
                    <select className="w-full p-3 bg-[#F3F3F2] border border-[#EA601F]/30 text-[#EA601F] rounded-xl outline-none font-bold" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                      {ROLES.map((r) => (
                        <option key={r.id} value={r.id}>{r.nom}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Coût Horaire (€)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full p-3 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-center font-bold outline-none focus:border-[#005259] focus:ring-1 focus:ring-[#005259]" 
                      value={formData.taux || ""} 
                      placeholder="0"
                      onChange={e => setFormData({...formData, taux: e.target.value === "" ? 0 : Number(e.target.value)})} 
                    />
                  </div>
                </div>

                {formData.statut === "ACI" && (
                  <div className="p-3.5 bg-[#F9945D]/10 border border-[#F9945D]/30 rounded-xl">
                    <label className="block text-[10px] font-bold uppercase text-[#EA601F] mb-1.5 flex items-center gap-1">
                      <ClockIcon className="w-3.5 h-3.5" /> Grille de référence ACI
                    </label>
                    <select 
                      className="w-full p-2.5 bg-white border border-[#F9945D]/40 text-[#404040] rounded-lg outline-none font-bold text-xs"
                      value={formData.rattachementHoraireACI}
                      onChange={e => setFormData({...formData, rattachementHoraireACI: e.target.value})}
                    >
                      <option value="Paris">Suivre la grille de Paris</option>
                      <option value="Massy">Suivre la grille de Massy</option>
                    </select>
                  </div>
                )}

                {/* SECTION GESTION DES QUALITÉS */}
                <div className="border-t border-[#404040]/10 pt-4">
                  <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5 flex items-center gap-1">
                    <AcademicCapIcon className="w-4 h-4 text-[#EA601F]" /> Qualités & Compétences (Excel, Word...)
                  </label>
                  
                  <div className="flex gap-2 mb-3">
                    <input 
                      type="text"
                      placeholder="Saisir ou choisir une qualité ci-dessous..."
                      value={competenceInput}
                      onChange={e => setCompetenceInput(e.target.value)}
                      onKeyDown={e => {
                        if(e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCompetence();
                        }
                      }}
                      className="flex-1 p-2.5 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] placeholder-[#404040]/40 rounded-xl outline-none focus:border-[#005259] focus:ring-1 focus:ring-[#005259]"
                    />
                    <button 
                      type="button" 
                      onClick={() => handleAddCompetence()}
                      className="px-3 bg-[#005259] hover:bg-[#EA601F] text-white font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {listeQualitesGlobales.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] text-[#404040]/70 uppercase font-bold mb-1">Qualités enregistrées (cliquer pour ajouter) :</p>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-[#F3F3F2] rounded-xl border border-[#404040]/10">
                        {listeQualitesGlobales.map((qualite) => {
                          const dejàAttribuee = formData.competences.includes(qualite);
                          return (
                            <button
                              key={qualite}
                              type="button"
                              disabled={dejàAttribuee}
                              onClick={() => handleAddCompetence(qualite)}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                                dejàAttribuee 
                                ? "bg-white border-[#404040]/10 text-[#404040]/30 cursor-not-allowed" 
                                : "bg-white border-[#005259]/20 text-[#005259] hover:border-[#005259] cursor-pointer"
                              }`}
                            >
                              {qualite}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-[#404040]/70 uppercase font-bold mb-1">Qualités retenues pour ce profil :</p>
                  <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl">
                    {formData.competences.length === 0 ? (
                      <span className="text-[10px] text-[#404040]/40 italic self-center">Aucune qualité sélectionnée</span>
                    ) : (
                      formData.competences.map((comp, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 bg-[#005259]/10 border border-[#005259]/20 text-[#005259] px-2 py-0.5 rounded-md font-medium text-[11px]">
                          {comp}
                          <button 
                            type="button" 
                            onClick={() => handleRemoveCompetence(idx)}
                            className="text-[#404040]/50 hover:text-[#EF736A] font-bold ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-[#404040]/10 pt-4">
                  <label className="block text-[10px] font-bold uppercase text-[#005259] mb-2">Affectation Territoire(s)</label>
                  <div className="bg-[#F3F3F2] border border-[#404040]/10 rounded-xl p-2.5 grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {listeTerritoires.map(t => {
                      const estCoche = formData.sites.includes(t);
                      return (
                        <label key={t} className="flex items-center gap-2.5 p-2 bg-white hover:bg-[#F3F3F2]/60 border border-[#404040]/10 rounded-lg cursor-pointer transition-colors select-none">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded accent-[#005259] bg-[#F3F3F2] border-[#404040]/20 cursor-pointer"
                            checked={estCoche}
                            onChange={() => handleCheckboxTerritoireChange(t)}
                          />
                          <span className={`text-xs ${estCoche ? 'text-[#005259] font-bold' : 'text-[#404040]/70'}`}>{t}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-[#404040]/10 pt-4 mt-6">
                  <button type="button" onClick={closeModal} className="px-4 py-2.5 rounded-xl border border-[#404040]/10 text-[#404040]/70 hover:text-[#404040] cursor-pointer font-bold uppercase text-xs">Annuler</button>
                  <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#EA601F] hover:bg-[#EF736A] text-white font-bold uppercase tracking-wider cursor-pointer transition-all shadow-md text-xs">Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </main>
    </PageGuard>
  );
}
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { 
  doc, 
  collection, 
  setDoc,
  query, 
  orderBy, 
  serverTimestamp, 
  updateDoc, 
  onSnapshot,
  addDoc,
  deleteDoc
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ChevronLeftIcon, 
  UserIcon, 
  PhoneIcon, 
  EnvelopeIcon, 
  MapPinIcon, 
  BriefcaseIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  NoSymbolIcon
} from "@heroicons/react/24/outline";

// --- TYPES & INTERFACES ---
interface Beneficiaire {
  Civilité?: string;
  Nom: string;
  Prénom: string;
  Age?: number | string;
  Date_Naissance?: string;
  Date_Adhesion?: string;
  Téléphone?: string;
  email?: string;
  Adresse_Rue?: string;
  Ville?: string;
  Code_Postal?: string;
  Situation_Socio_Pro?: string;
  Situation_Handicap?: string;
  RQTH?: string;
  QPV?: string;
  Lieu_RDV?: string;
  lieuRDV?: string;
  Statut_Blacklist?: string; // "Oui" ou "Non"
}

interface Visite {
  id: string;
  mediateur: string;
  thematique: string;
  lieu: string;
  details: string;
  satisfaction: any; 
  date: string;
  moment: string;
  statut: "Présent" | "Absent";
  dateAction?: string;
  score?: string; 
  reponses?: any; 
}

interface Mediateur {
  id: string;
  nom: string;
}

interface LieuGlobal {
  id: string;
  nomCourt: string;
  nomComplet: string;
}

export default function FicheBeneficiaire() {
  const { id } = useParams();
  const userId = id as string;
  const router = useRouter();

  const [user, setUser] = useState<Beneficiaire | null>(null);
  const [rdvs, setRdvs] = useState<Visite[]>([]);
  const [loading, setLoading] = useState(true);
  const [userExists, setUserExists] = useState(true);
  
  const [listeMediateurs, setListeMediateurs] = useState<Mediateur[]>([]);
  
  // Gestion des lieux depuis la collection "liste_lieux"
  const [lieuxGlobaux, setLieuxGlobaux] = useState<LieuGlobal[]>([]);

  // Pop-up Profil
  const [isModalProfilOpen, setIsModalProfilOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState("");
  
  // Formulaire profil
  const [profilFormData, setProfilFormData] = useState<Required<Beneficiaire>>({
    Civilité: "M.", Nom: "", Prénom: "", Age: "", Date_Naissance: "", Date_Adhesion: "",
    Téléphone: "", email: "", Adresse_Rue: "", Ville: "", Code_Postal: "",
    Situation_Socio_Pro: "", Situation_Handicap: "Non", RQTH: "Non",
    QPV: "Non", Lieu_RDV: "", lieuRDV: "", Statut_Blacklist: "Non"
  });

  // Édition en ligne d'une visite
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Visite | null>(null);

  // Sécurisation de la date du jour sur le fuseau de Paris
  const aujourdhuiStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

  // Formulaire d'ajout d'action
  const [formData, setFormData] = useState({
    mediateur: "", 
    thematique: "Accès aux droits",
    lieu: "",
    details: "",
    satisfaction: "5",
    dateChoisie: aujourdhuiStr,
    momentChoisi: "Matin",
    statut: "Présent"
  });

  // Statistiques calculées
  const [stats, setStats] = useState({
    totalPresents: 0, tauxAssiduite: 100, satisfactionMoyenne: 0, thematiquePhare: "—"
  });

  // Liste des thématiques nécessitant une évaluation
  const [thematiquesAAlerter, setThematiquesAAlerter] = useState<string[]>([]);

  const isProfilIncomplet = user ? (!user.Téléphone || !user.email || !user.Situation_Socio_Pro) : false;

  const calculerAgeEnDirect = (dateNaissanceStr: string): string => {
    if (!dateNaissanceStr) return "—";
    
    const aujourdhui = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
    const naissance = new Date(dateNaissanceStr);
    
    let ageCalcul = aujourdhui.getFullYear() - naissance.getFullYear();
    const moisDiff = aujourdhui.getMonth() - naissance.getMonth();
    
    if (moisDiff < 0 || (moisDiff === 0 && aujourdhui.getDate() < naissance.getDate())) { 
      ageCalcul--; 
    }
    
    return isNaN(ageCalcul) || ageCalcul < 0 ? "—" : `${ageCalcul} ans`;
  };

  // ÉCOUTE DES MÉDIATEURS
  useEffect(() => {
    const unsubEquipe = onSnapshot(collection(db, "liste_mediateurs"), (snap) => {
      const equipe = snap.docs
        .filter(d => d.id !== "parametres_configuration" && d.id !== "parametres_horaires")
        .map(d => {
          const data = d.data();
          const nomComplet = `${data.prenom || ""} ${data.nom || ""}`.trim() || "Sans nom"; 
          return { id: d.id, nom: nomComplet } as Mediateur;
        });
      
      setListeMediateurs(equipe);
      
      if (equipe.length > 0) {
        setFormData(prev => {
          const mediateurExiste = equipe.some(m => m.nom === prev.mediateur);
          if (!prev.mediateur || !mediateurExiste) {
            return { ...prev, mediateur: equipe[0].nom };
          }
          return prev;
        });
      }
    });
    return () => unsubEquipe();
  }, []);

  // Écoute Profil, Visites & Lieux Globaux (depuis "liste_lieux")
  useEffect(() => {
    if (!userId) return;

    // 1. Profil utilisateur
    const userRef = doc(db, "utilisateurs", userId);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Beneficiaire;
        setUser(data);
        setProfilFormData({
          Civilité: data.Civilité || "M.", Nom: data.Nom || "", Prénom: data.Prénom || "", Age: data.Age ?? "",
          Date_Naissance: data.Date_Naissance || "", Date_Adhesion: data.Date_Adhesion || "",
          Téléphone: data.Téléphone || "", email: data.email || "", Adresse_Rue: data.Adresse_Rue || "",
          Ville: data.Ville || "", Code_Postal: data.Code_Postal || "", Situation_Socio_Pro: data.Situation_Socio_Pro || "",
          Situation_Handicap: data.Situation_Handicap || "Non", RQTH: data.RQTH || "Non",
          QPV: data.QPV || "Non", 
          Lieu_RDV: data.Lieu_RDV || "", lieuRDV: data.lieuRDV || "",
          Statut_Blacklist: data.Statut_Blacklist || "Non"
        });
        setUserExists(true);
        setLoading(false);
      } else {
        setUserExists(false);
        setIsModalProfilOpen(true);
        setLoading(false);
      }
    });

    // 2. Visites du bénéficiaire
    const rdvRef = collection(db, "utilisateurs", userId, "visites");
    const q = query(rdvRef, orderBy("date", "desc"));
    const unsubVisites = onSnapshot(q, (querySnapshot) => {
      const rdvList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Visite));
      setRdvs(rdvList);
    });

    // 3. Écoute de la liste des lieux depuis la collection "liste_lieux"
    const unsubLieux = onSnapshot(collection(db, "liste_lieux"), (snap) => {
      const lieuxEnregistres = snap.docs
        .map(d => {
          const data = d.data();
          const raccourci = (data.nomRaccourci || data.nomCourt || data.nom || d.id) as string;
          const complet = (data.nomComplet || data.nom || raccourci) as string;
          const estActif = data.actif !== false;

          return {
            id: d.id,
            nomCourt: raccourci,
            nomComplet: complet,
            actif: estActif
          };
        })
        .filter(l => l.actif);

      setLieuxGlobaux(lieuxEnregistres);

      if (lieuxEnregistres.length > 0) {
        setFormData(prev => ({
          ...prev,
          lieu: prev.lieu || lieuxEnregistres[0].nomCourt
        }));
      }
    });

    return () => { 
      unsubUser(); 
      unsubVisites(); 
      unsubLieux(); 
    };
  }, [userId]);

  // Calcul stats et alertes thématiques
  useEffect(() => {
    if (rdvs.length === 0) {
      setStats({ totalPresents: 0, tauxAssiduite: 100, satisfactionMoyenne: 0, thematiquePhare: "—" });
      setThematiquesAAlerter([]);
      return;
    }
    const presents = rdvs.filter(r => r.statut === "Présent" && r.moment !== "Diagnostic Initial" && r.moment !== "Diagnostic Final" && r.moment !== "Questionnaire de satisfaction" && r.moment !== "Collecte Tech");
    const totalPresentsCount = presents.length;
    const totalActionsStandard = rdvs.filter(r => r.moment !== "Diagnostic Initial" && r.moment !== "Diagnostic Final" && r.moment !== "Questionnaire de satisfaction" && r.moment !== "Collecte Tech").length;
    
    const taux = totalActionsStandard > 0 ? Math.round((totalPresentsCount / totalActionsStandard) * 100) : 100;
    
    const sommeSatisfaction = presents.reduce((acc, curr) => {
      let scoreSat = 0;
      if (curr.satisfaction && typeof curr.satisfaction === "object") {
        scoreSat = Number(curr.satisfaction.evaluationGlobale || 0);
      } else {
        scoreSat = typeof curr.satisfaction === 'string' ? Number(curr.satisfaction) : curr.satisfaction || 0;
      }
      return acc + scoreSat;
    }, 0);
    
    const moyenneSat = totalPresentsCount > 0 ? parseFloat((sommeSatisfaction / totalPresentsCount).toFixed(1)) : 0;

    const compteurs: Record<string, number> = {};
    presents.forEach(r => { 
      if (r.thematique && r.thematique.trim() !== "") { 
        compteurs[r.thematique] = (compteurs[r.thematique] || 0) + 1; 
      } 
    });

    const keys = Object.keys(compteurs);
    const topThematique = keys.length === 0 ? "—" : keys.reduce((a, b) => compteurs[a] > compteurs[b] ? a : b);
    
    const alertes = keys.filter(thematique => compteurs[thematique] > 0 && compteurs[thematique] % 5 === 0);
    
    setThematiquesAAlerter(alertes);
    setStats({ totalPresents: totalPresentsCount, tauxAssiduite: taux, satisfactionMoyenne: moyenneSat, thematiquePhare: topThematique });
  }, [rdvs]);

  const handleSaveProfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profilFormData.Nom.trim() || !profilFormData.Prénom.trim()) return alert("Nom/Prénom requis");
    setModalStatus("Enregistrement en cours...");
    let ageCalcule = null;
    if (profilFormData.Date_Naissance) {
      const ageStr = calculerAgeEnDirect(profilFormData.Date_Naissance);
      if (ageStr !== "—") ageCalcule = parseInt(ageStr, 10);
    }
    try {
      await setDoc(doc(db, "utilisateurs", userId), {
        ...profilFormData, Nom: profilFormData.Nom.trim().toUpperCase(), Prénom: profilFormData.Prénom.trim(), Age: ageCalcule
      }, { merge: true });
      setModalStatus("✅ Profil enregistré avec succès !");
      setTimeout(() => { setIsModalProfilOpen(false); setModalStatus(""); }, 1000);
      setUserExists(true);
    } catch (error) { setModalStatus("❌ Erreur"); }
  };

  const handleAddRDV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userExists) return alert("Créez d'abord le profil.");
    
    let lieuFinal = formData.lieu;
    if (formData.momentChoisi === "Collecte Tech") {
      lieuFinal = "92 - Collecte Tech";
    }

    if (!lieuFinal || !formData.mediateur) return alert("Champs obligatoires manquants.");

    try {
      await addDoc(collection(db, "utilisateurs", userId, "visites"), {
        mediateur: formData.mediateur,
        thematique: formData.statut === "Absent" ? "" : formData.thematique,
        lieu: lieuFinal,
        details: formData.statut === "Absent" ? "" : formData.details.trim(),
        statut: formData.statut,
        satisfaction: formData.statut === "Absent" ? 0 : Number(formData.satisfaction),
        date: formData.dateChoisie,
        moment: formData.momentChoisi,
        createdAt: serverTimestamp()
      });

      if (formData.momentChoisi === "Collecte Tech") {
        await updateDoc(doc(db, "utilisateurs", userId), {
          Lieu_RDV: "92 - Collecte Tech",
          lieuRDV: "92 - Collecte Tech"
        });
      }

      if (formData.statut === "Présent" && formData.thematique) {
        const visitesMemeThematique = rdvs.filter(
          r => r.statut === "Présent" && 
          r.thematique === formData.thematique &&
          !["Diagnostic Initial", "Diagnostic Final", "Questionnaire de satisfaction", "Collecte Tech"].includes(r.moment)
        );
        
        const nouveauTotal = visitesMemeThematique.length + 1;

        if (nouveauTotal % 5 === 0) {
          const reponse = window.confirm(
            `🚨 Alerte : Ce bénéficiaire vient d'atteindre ${nouveauTotal} rendez-vous sur la thématique "${formData.thematique}".\n\nSouhaitez-vous le rediriger immédiatement vers le formulaire pour passer un nouveau diagnostic ?`
          );
          if (reponse) {
            router.push(`/diagnosticform?id=${userId}`);
          }
        }
      }

      setFormData(prev => ({ 
        ...prev, 
        details: "", 
        satisfaction: "5", 
        statut: "Présent", 
        lieu: formData.momentChoisi === "Collecte Tech" ? "92 - Collecte Tech" : lieuFinal
      }));
    } catch (error) { console.error(error); }
  };

  const handleUpdateRDV = async (rdvId: string) => {
    if (!editFormData) return;
    try {
      let lieuFinal = editFormData.lieu;
      if (editFormData.moment === "Collecte Tech") {
        lieuFinal = "92 - Collecte Tech";
      }

      await updateDoc(doc(db, "utilisateurs", userId, "visites", rdvId), { 
        ...editFormData, 
        lieu: lieuFinal,
        thematique: editFormData.statut === "Absent" ? "" : editFormData.thematique,
        details: editFormData.statut === "Absent" ? "" : editFormData.details,
        satisfaction: editFormData.statut === "Absent" ? 0 : Number(editFormData.satisfaction)
      });

      if (editFormData.moment === "Collecte Tech") {
        await updateDoc(doc(db, "utilisateurs", userId), {
          Lieu_RDV: "92 - Collecte Tech",
          lieuRDV: "92 - Collecte Tech"
        });
      }

      setEditingId(null); setEditFormData(null);
    } catch (error) { console.error(error); }
  };

  const handleDeleteRDV = async (rdvId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce rendez-vous ?")) {
      try {
        await deleteDoc(doc(db, "utilisateurs", userId, "visites", rdvId));
      } catch (error) {
        console.error("Erreur lors de la suppression :", error);
      }
    }
  };

  const startEditing = (rdv: Visite) => {
    setEditingId(rdv.id);
    setEditFormData({ ...rdv });
  };

  const rencontresStandards = rdvs.filter(r => r.moment !== "Diagnostic Initial" && r.moment !== "Diagnostic Final" && r.moment !== "Questionnaire de satisfaction" && r.moment !== "Collecte Tech");
  const evaluationsDiagnostics = rdvs.filter(r => r.moment === "Diagnostic Initial" || r.moment === "Diagnostic Final" || r.moment === "Questionnaire de satisfaction" || r.moment === "Collecte Tech");

  const inputClass = "w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 outline-none transition-all";

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold animate-pulse">Chargement...</div>;

  const verifierRenouvellementAdhesion = (dateAdhesionStr?: string) => {
    if (!dateAdhesionStr) return { estAdherent: false, aRenouveler: false };
    const aujourdhui = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
    const adhesion = new Date(dateAdhesionStr);
    const dateExpiration = new Date(adhesion);
    dateExpiration.setFullYear(dateExpiration.getFullYear() + 1);
    const dateAlerteDebut = new Date(dateExpiration);
    dateAlerteDebut.setDate(dateAlerteDebut.getDate() - 14);
    
    if (aujourdhui > dateExpiration) return { estAdherent: false, aRenouveler: false };
    if (aujourdhui >= dateAlerteDebut && aujourdhui <= dateExpiration) return { estAdherent: true, aRenouveler: true };
    return { estAdherent: true, aRenouveler: false };
  };

  const statutAdhesion = verifierRenouvellementAdhesion(user?.Date_Adhesion);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased relative">
      <div className="max-w-6xl mx-auto">
        
        {/* NAV HAUTE */}
        <div className="flex justify-between items-center mb-6">
          <Link href="/liste-beneficiaires" className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors group">
            <ChevronLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-widest">Retour à la liste</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <Link href="/suresnes" className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-emerald-400 transition-all shadow-md">
              <CalendarDaysIcon className="w-4 h-4" />
              <span>Agenda Suresnes</span>
            </Link>
            <Link href="/equipe" className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-blue-400 transition-all shadow-md">
              <UserGroupIcon className="w-4 h-4" />
              <span>Gérer l'équipe RH</span>
            </Link>
          </div>
        </div>

        {/* ALERTE SÉCURITÉ BLACKLIST GLOBALE */}
        {user?.Statut_Blacklist === "Oui" && (
          <div className="mb-6 p-4 bg-red-600/20 border-2 border-red-600 rounded-2xl flex items-center gap-3 shadow-2xl">
            <NoSymbolIcon className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <h3 className="text-sm font-black text-red-400 uppercase tracking-wide">⚠️ ACCÈS RESTREINT / BLACKLIST</h3>
              <p className="text-xs text-slate-300 mt-0.5">Ce bénéficiaire est actuellement inscrit sur la liste noire de la structure.</p>
            </div>
          </div>
        )}

        {/* HEADER PROFIL */}
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`h-10 w-1.5 rounded-full ${user?.Statut_Blacklist === "Oui" ? "bg-red-600" : "bg-emerald-500"}`}></div>
                <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
                  {user?.Civilité} {user?.Nom} <span className="text-emerald-500 not-italic">&nbsp;{user?.Prénom}</span>
                  {user?.Date_Naissance && <span className="text-sm font-mono text-slate-500 font-normal normal-case not-italic ml-3">({calculerAgeEnDirect(user.Date_Naissance)})</span>}
                </h1>
                <div className="ml-2 flex gap-2 flex-wrap">
                  {user?.Statut_Blacklist === "Oui" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600/20 border border-red-600 text-red-400">
                      🚫 BLACKLISTÉ
                    </span>
                  )}
                  {statutAdhesion.estAdherent ? (
                    statutAdhesion.aRenouveler ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/40 text-amber-500 animate-pulse">
                        ⚠️ Adhésion à renouveler
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        ✅ Adhérent
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-500">
                      ⚠️ Non adhérent
                    </span>
                  )}
                  {user?.QPV === "Oui" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                      📍 QPV
                    </span>
                  )}
                  {(user?.Lieu_RDV === "92 - Collecte Tech" || user?.lieuRDV === "92 - Collecte Tech") && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/10 border border-teal-500/30 text-teal-400">
                      🔧 Collecte Tech
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setIsModalProfilOpen(true)} className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg ${isProfilIncomplet ? "bg-amber-500/10 border border-amber-500/30 text-amber-400" : "bg-slate-800 text-slate-300"}`}>
                <PencilSquareIcon className="w-4 h-4" />
                <span>{isProfilIncomplet ? "Compléter le profil" : "Éditer le profil"}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50"><PhoneIcon className="w-5 h-5 text-slate-500" /><span className="text-sm font-mono text-slate-300">{user?.Téléphone || "—"}</span></div>
              <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50"><EnvelopeIcon className="w-5 h-5 text-slate-500" /><span className="text-sm truncate text-slate-300">{user?.email || "Non renseigné"}</span></div>
              <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50"><MapPinIcon className="w-5 h-5 text-slate-500" /><span className="text-sm text-slate-300 truncate">{user?.Ville || "—"} ({user?.Code_Postal || "—"})</span></div>
              <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50"><BriefcaseIcon className="w-5 h-5 text-slate-500" /><span className="text-sm text-slate-300">{user?.Situation_Socio_Pro || "—"}</span></div>
            </div>
          </div>
        </header>

        {/* ALERTE ÉVALUATION */}
        {thematiquesAAlerter.length > 0 && (
          <div className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/40 rounded-2xl flex items-start gap-3 animate-pulse shadow-xl">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-black text-red-400 uppercase tracking-wide">Évaluation des progrès requise !</h3>
              <p className="text-xs text-slate-300 mt-1">
                Ce bénéficiaire est actuellement sur un multiple de <span className="font-bold text-white">5 rendez-vous</span> sur : <span className="text-red-400 font-bold">{thematiquesAAlerter.join(", ")}</span>. Un nouveau diagnostic est recommandé.
              </p>
            </div>
          </div>
        )}

        {/* STATS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Actions Présentes</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{stats.totalPresents} <span className="text-xs text-slate-600 font-normal">rdvs</span></p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Taux d'Assiduité</p>
            <p className="text-2xl font-black text-blue-400 mt-1">{stats.tauxAssiduite}%</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Satisfaction Moyenne</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{stats.satisfactionMoyenne} <span className="text-xs text-slate-600">/ 5</span></p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Thématique Phare</p>
            <p className="text-sm font-bold text-indigo-400 mt-2 truncate">{stats.thematiquePhare}</p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-4">
            {/* AUTO EVALS */}
            <section className="bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-800/40 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <AcademicCapIcon className="w-5 h-5 text-purple-400 shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Auto-évaluations</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Lancer un diagnostic initial, final ou de satisfaction.</p>
                </div>
              </div>
              <Link href={`/diagnosticform?id=${userId}`} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-xl text-xs uppercase tracking-wider transition-all">
                <PlusCircleIcon className="w-4 h-4" />
                <span>Remplir un questionnaire</span>
              </Link>
            </section>

            {/* FORM NOUVELLE ACTION */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
                <PlusCircleIcon className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white">Nouvelle Action</h2>
              </div>

              <form onSubmit={handleAddRDV} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Médiateur Référent</label>
                  <select 
                    value={formData.mediateur} 
                    onChange={e => setFormData({...formData, mediateur: e.target.value})} 
                    className={inputClass}
                  >
                    {listeMediateurs.length === 0 && (
                      <option value="">Chargement de l'équipe...</option>
                    )}
                    {listeMediateurs.map(m => <option key={m.id} value={m.nom}>{m.nom}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Thématique</label>
                  <select value={formData.thematique} onChange={e => setFormData({...formData, thematique: e.target.value})} className={inputClass}>
                    <option value="Accès aux droits">Accès aux droits</option>
                    <option value="Insertion Pro">Insertion Professionnelle</option>
                    <option value="Numérique">Atelier Numérique</option>
                    <option value="Ordinateur">💻 Ordinateur</option>
                    <option value="Smartphone">📱 Smartphone</option>
                    <option value="Logement">Logement</option>
                    <option value="Santé">Accompagnement Santé</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Lieu de la rencontre</label>
                    <Link 
                      href="/localisations" 
                      className="text-[9px] text-emerald-400 font-bold underline uppercase hover:text-emerald-300 transition-colors"
                    >
                      + Ajouter un lieu
                    </Link>
                  </div>

                  {/* DÉROULANTE LIEU AVEC LE CHAMP nomRaccourci */}
                  <select 
                    value={formData.momentChoisi === "Collecte Tech" ? "92 - Collecte Tech" : formData.lieu} 
                    disabled={formData.momentChoisi === "Collecte Tech"}
                    onChange={e => setFormData({...formData, lieu: e.target.value})} 
                    className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {formData.momentChoisi === "Collecte Tech" && (
                      <option value="92 - Collecte Tech">92 - Collecte Tech</option>
                    )}
                    {lieuxGlobaux.length === 0 ? (
                      <option value="">Aucun lieu disponible</option>
                    ) : (
                      lieuxGlobaux.map((l) => (
                        <option key={l.id} value={l.nomCourt}>
                          {l.nomCourt}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                    <input type="date" value={formData.dateChoisie} onChange={e => setFormData({...formData, dateChoisie: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Moment</label>
                    <select value={formData.momentChoisi} onChange={e => setFormData({...formData, momentChoisi: e.target.value})} className={inputClass}>
                      <option value="Matin">Matin</option>
                      <option value="Après-midi">Après-midi</option>
                      <option value="Collecte Tech">🔧 Collecte Tech</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Statut</label>
                    <select value={formData.statut} onChange={e => setFormData({...formData, statut: e.target.value})} className="bg-slate-900 text-xs text-white border border-slate-800 rounded p-1 w-full outline-none">
                      <option value="Présent">Présent</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>
                  {formData.statut === "Présent" && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Satisfaction</label>
                      <select value={formData.satisfaction} onChange={e => setFormData({...formData, satisfaction: e.target.value})} className="bg-slate-900 text-xs text-amber-400 border border-slate-800 rounded p-1 w-full outline-none font-bold">
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>⭐ {n}/5</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {formData.statut === "Présent" && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Compte-rendu</label>
                    <textarea value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} rows={3} className={`${inputClass} resize-none`} placeholder="Écrire les détails de l'entretien..."></textarea>
                  </div>
                )}

                <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg">
                  Enregistrer l'action
                </button>
              </form>
            </section>
          </div>

          {/* COLONNE DE DROITE */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* LISTE RDV */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
                <ClockIcon className="w-5 h-5 text-indigo-400" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white">Suivi des rendez-vous ({rencontresStandards.length})</h2>
              </div>

              {rencontresStandards.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl text-slate-600 font-mono text-xs">Aucun rendez-vous standard enregistré.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                        <th className="py-3 px-2">Date / Moment</th>
                        <th className="py-3 px-2">Intervenant & Axe</th>
                        <th className="py-3 px-2">Lieu / Détails</th>
                        <th className="py-3 px-2 text-center">Statut / Avis</th>
                        <th className="py-3 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {rencontresStandards.map((rdv) => {
                        const isEditing = editingId === rdv.id;
                        const rdvSatisfactionNode = rdv.satisfaction && typeof rdv.satisfaction === "object" ? rdv.satisfaction.evaluationGlobale : rdv.satisfaction;

                        return (
                          <tr key={rdv.id} className="hover:bg-slate-950/40 transition-colors">
                            <td className="py-3 px-2">
                              {isEditing && editFormData ? (
                                <div className="space-y-1">
                                  <input type="date" value={editFormData.date} onChange={e => setEditFormData({...editFormData, date: e.target.value})} className="bg-slate-950 border border-slate-700 text-[11px] p-1 rounded text-white outline-none w-full" />
                                  <select value={editFormData.moment} onChange={e => setEditFormData({...editFormData, moment: e.target.value})} className="bg-slate-950 border border-slate-700 text-[11px] p-1 rounded text-white outline-none w-full">
                                    <option value="Matin">Matin</option>
                                    <option value="Après-midi">Après-midi</option>
                                    <option value="Collecte Tech">Collecte Tech</option>
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <p className="font-mono font-bold text-white">{new Date(rdv.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'})}</p>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{rdv.moment}</p>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-2">
                              {isEditing && editFormData ? (
                                <div className="space-y-1">
                                  <select value={editFormData.mediateur} onChange={e => setEditFormData({...editFormData, mediateur: e.target.value})} className="bg-slate-950 border border-slate-700 text-[11px] p-1 rounded text-white outline-none w-full">
                                    {listeMediateurs.map(m => <option key={m.id} value={m.nom}>{m.nom}</option>)}
                                  </select>
                                  <select value={editFormData.thematique} onChange={e => setEditFormData({...editFormData, thematique: e.target.value})} className="bg-slate-950 border border-slate-700 text-[11px] p-1 rounded text-white outline-none w-full">
                                    <option value="Accès aux droits">Accès aux droits</option>
                                    <option value="Insertion Pro">Insertion Pro</option>
                                    <option value="Numérique">Numérique</option>
                                    <option value="Ordinateur">💻 Ordinateur</option>
                                    <option value="Smartphone">📱 Smartphone</option>
                                    <option value="Logement">Logement</option>
                                    <option value="Santé">Santé</option>
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-slate-300 font-medium">{rdv.mediateur}</p>
                                  <p className="text-[10px] font-bold text-indigo-400 tracking-wide">{rdv.statut === "Absent" ? "—" : rdv.thematique}</p>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-2 max-w-[200px]">
                              {isEditing && editFormData ? (
                                <div className="space-y-1">
                                  {/* ÉDITION LIEU AVEC LE CHAMP nomRaccourci */}
                                  <select 
                                    value={editFormData.moment === "Collecte Tech" ? "92 - Collecte Tech" : editFormData.lieu} 
                                    disabled={editFormData.moment === "Collecte Tech"}
                                    onChange={e => setEditFormData({...editFormData, lieu: e.target.value})} 
                                    className="bg-slate-950 border border-slate-700 text-[11px] p-1 rounded text-white outline-none w-full disabled:opacity-60"
                                  >
                                    {lieuxGlobaux.map((l) => (
                                      <option key={l.id} value={l.nomCourt}>
                                        {l.nomCourt}
                                      </option>
                                    ))}
                                    {editFormData.lieu && !lieuxGlobaux.some(l => l.nomCourt === editFormData.lieu) && (
                                      <option value={editFormData.lieu}>{editFormData.lieu}</option>
                                    )}
                                  </select>
                                  {editFormData.statut === "Présent" && (
                                    <textarea value={editFormData.details} onChange={e => setEditFormData({...editFormData, details: e.target.value})} rows={2} className="bg-slate-950 border border-slate-700 text-[11px] p-1 rounded text-white outline-none w-full resize-none" />
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <p className="text-slate-400 font-serif italic text-[11px] truncate">{rdv.lieu}</p>
                                  <p className="text-slate-500 line-clamp-2 text-[11px] leading-relaxed mt-0.5">{rdv.statut === "Absent" ? "— (Absent)" : (rdv.details || "Aucune note rédigée.")}</p>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-2 text-center">
                              {isEditing && editFormData ? (
                                <div className="space-y-1 inline-block text-left">
                                  <select value={editFormData.statut} onChange={e => setEditFormData({...editFormData, statut: e.target.value as "Présent" | "Absent"})} className="bg-slate-950 border border-slate-700 text-[11px] p-1 rounded text-white outline-none">
                                    <option value="Présent">Présent</option>
                                    <option value="Absent">Absent</option>
                                  </select>
                                  {editFormData.statut === "Présent" && (
                                    <select value={editFormData.satisfaction} onChange={e => setEditFormData({...editFormData, satisfaction: e.target.value})} className="bg-slate-950 border border-slate-700 text-[11px] p-1 rounded text-amber-400 outline-none block w-full">
                                      {[1,2,3,4,5].map(n => <option key={n} value={n}>⭐ {n}</option>)}
                                    </select>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  {rdv.statut === "Présent" ? (
                                    <>
                                      <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold">Présent</span>
                                      <span className="text-[11px] font-mono font-bold text-amber-400">⭐ {rdvSatisfactionNode}/5</span>
                                    </>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold">Absent</span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-2 text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-1.5">
                                  <button onClick={() => handleUpdateRDV(rdv.id)} className="p-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded shadow">
                                    <CheckIcon className="w-4 h-4 stroke-[3]" />
                                  </button>
                                  <button onClick={() => { setEditingId(null); setEditFormData(null); }} className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded">
                                    <XMarkIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => startEditing(rdv)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
                                    <PencilSquareIcon className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDeleteRDV(rdv.id)} className="p-1.5 bg-red-950/40 hover:bg-red-900 text-red-400 rounded-lg transition-colors">
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* DIAGS & EVALS */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
                <ClipboardDocumentCheckIcon className="w-5 h-5 text-purple-400" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white">Diagnostics & Auto-évaluations ({evaluationsDiagnostics.length})</h2>
              </div>

              {evaluationsDiagnostics.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-800 rounded-xl text-slate-600 font-mono text-xs">Aucun questionnaire ou diagnostic passé.</div>
              ) : (
                <div className="space-y-3">
                  {evaluationsDiagnostics.map((diag) => {
                    const exactSatisfactionNode = diag.satisfaction && typeof diag.satisfaction === "object" ? diag.satisfaction.evaluationGlobale : diag.satisfaction;

                    return (
                      <div key={diag.id} className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                diag.moment === "Diagnostic Initial" ? "bg-amber-950/40 border border-amber-900 text-amber-400" :
                                diag.moment === "Diagnostic Final" ? "bg-emerald-950/40 border border-emerald-900 text-emerald-400" :
                                diag.moment === "Collecte Tech" ? "bg-purple-950/40 border border-purple-900 text-purple-400" :
                                "bg-sky-950/40 border border-sky-900 text-sky-400"
                              }`}>
                                {diag.moment}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-400">
                                {new Date(diag.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'})}
                              </span>
                            </div>
                            {diag.thematique && <p className="text-[11px] text-slate-500 mt-1">Axe évalué : <span className="text-slate-300 font-medium">{diag.thematique}</span></p>}
                          </div>

                          <div className="w-full sm:w-auto text-left sm:text-right flex items-center justify-end gap-3">
                            {/* Bouton Bilan Tech présent uniquement si la carte est "Collecte Tech" */}
                            {diag.moment === "Collecte Tech" && (
                              <Link 
  href={`/bilan_tech?id=${userId}`}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl transition-all shadow-md shrink-0"
>
  <ClipboardDocumentCheckIcon className="w-4 h-4 shrink-0" />
  <span>Bilan Tech</span>
</Link>
                            )}

                            {diag.score ? (
                              <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg inline-block text-center">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                                  Score / Résultat
                                </span>
                                <span className="text-sm font-black text-purple-400 font-mono">
                                  {diag.score}
                                </span>
                              </div>
                            ) : exactSatisfactionNode ? (
                              <div className="text-xs font-bold text-amber-400 bg-amber-950/20 border border-amber-900/50 px-2.5 py-1 rounded-lg inline-block">
                                Note globale : ⭐ {exactSatisfactionNode}/5
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </div>
                        </div>

                        {diag.details && (
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 text-[11px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
                            {diag.details}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

        </div>

        {/* MODALE PROFIL */}
        {isModalProfilOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full p-6 md:p-8 relative">
              <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-800/60">
                <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-emerald-400" />
                  <span>{userExists ? "Édition du Dossier" : "Création d'une nouvelle fiche"}</span>
                </h2>
                {userExists && (
                  <button onClick={() => { setIsModalProfilOpen(false); setModalStatus(""); }} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveProfil} className="space-y-4">
                
                {/* BLOC ZONE DE DANGER : BLACKLIST */}
                <div className="bg-red-950/20 border border-red-900/60 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <NoSymbolIcon className="w-5 h-5 text-red-500 shrink-0" />
                    <div>
                      <label className="block text-xs font-black text-red-400 uppercase tracking-wide">Mettre sur Liste Noire (Blacklist)</label>
                      <span className="text-[11px] text-slate-400 block mt-0.5">Restreindre temporairement ou définitivement ce profil.</span>
                    </div>
                  </div>
                  <select 
                    value={profilFormData.Statut_Blacklist} 
                    onChange={e => setProfilFormData({...profilFormData, Statut_Blacklist: e.target.value})} 
                    className="bg-slate-950 border border-red-900/50 rounded-xl p-2 text-xs font-bold text-red-400 outline-none focus:ring-1 focus:ring-red-600 transition-all"
                  >
                    <option value="Non" className="text-slate-300">Non (Actif)</option>
                    <option value="Oui" className="text-red-500">Oui (Blacklisté)</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Civilité</label>
                    <select value={profilFormData.Civilité} onChange={e => setProfilFormData({...profilFormData, Civilité: e.target.value})} className={inputClass}>
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Prénom</label>
                    <input type="text" value={profilFormData.Prénom} onChange={e => setProfilFormData({...profilFormData, Prénom: e.target.value})} className={inputClass} placeholder="Prénom..." required />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nom de famille</label>
                  <input type="text" value={profilFormData.Nom} onChange={e => setProfilFormData({...profilFormData, Nom: e.target.value})} className={inputClass} placeholder="Nom..." required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date de Naissance</label>
                    <input type="date" value={profilFormData.Date_Naissance} onChange={e => setProfilFormData({...profilFormData, Date_Naissance: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date d'Adhésion (Optionnel)</label>
                    <input type="date" value={profilFormData.Date_Adhesion} onChange={e => setProfilFormData({...profilFormData, Date_Adhesion: e.target.value})} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Téléphone</label>
                    <input type="tel" value={profilFormData.Téléphone} onChange={e => setProfilFormData({...profilFormData, Téléphone: e.target.value})} className={inputClass} placeholder="06..." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Adresse Email</label>
                    <input type="email" value={profilFormData.email} onChange={e => setProfilFormData({...profilFormData, email: e.target.value})} className={inputClass} placeholder="exemple@mail.com" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rue / Adresse</label>
                    <input type="text" value={profilFormData.Adresse_Rue} onChange={e => setProfilFormData({...profilFormData, Adresse_Rue: e.target.value})} className={inputClass} placeholder="Adresse..." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Code Postal</label>
                    <input type="text" value={profilFormData.Code_Postal} onChange={e => setProfilFormData({...profilFormData, Code_Postal: e.target.value})} className={inputClass} placeholder="92150" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ville</label>
                    <input type="text" value={profilFormData.Ville} onChange={e => setProfilFormData({...profilFormData, Ville: e.target.value})} className={inputClass} placeholder="Suresnes..." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quartier QPV</label>
                    <select value={profilFormData.QPV} onChange={e => setProfilFormData({...profilFormData, QPV: e.target.value})} className={inputClass}>
                      <option value="Non">Non</option>
                      <option value="Oui">Oui</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Situation Socio-Pro</label>
                    <select value={profilFormData.Situation_Socio_Pro} onChange={e => setProfilFormData({...profilFormData, Situation_Socio_Pro: e.target.value})} className={inputClass}>
                      <option value="">-- Sélectionner --</option>
                      <option value="Salarie">Salarié(e)</option>
                      <option value="Demandeur emploi">Demandeur d'emploi</option>
                      <option value="Retraite">Retraité(e)</option>
                      <option value="Etudiant">Étudiant(e)</option>
                      <option value="Sans activite">Sans activité</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Situation de Handicap</label>
                    <select value={profilFormData.Situation_Handicap} onChange={e => setProfilFormData({...profilFormData, Situation_Handicap: e.target.value})} className="bg-slate-900 border border-slate-800 text-xs text-white rounded p-1 w-full outline-none">
                      <option value="Non">Non</option>
                      <option value="Oui">Oui</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reconnaissance RQTH</label>
                    <select value={profilFormData.RQTH} onChange={e => setProfilFormData({...profilFormData, RQTH: e.target.value})} className="bg-slate-900 border border-slate-800 text-xs text-white rounded p-1 w-full outline-none">
                      <option value="Non">Non</option>
                      <option value="Oui">Oui</option>
                    </select>
                  </div>
                </div>

                {/* Rattachement Événementnel principal */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rattachement Événementnel principal</label>
                  <select 
                    value={profilFormData.Lieu_RDV} 
                    onChange={e => setProfilFormData({...profilFormData, Lieu_RDV: e.target.value, lieuRDV: e.target.value})} 
                    className="bg-slate-900 border border-slate-800 text-xs text-white rounded p-1 w-full outline-none"
                  >
                    <option value="">-- Aucun ou Standard --</option>
                    <option value="92 - Collecte Tech">92 - Collecte Tech</option>
                  </select>
                </div>

                <div className="pt-4 space-y-3">
                  {modalStatus && <div className="p-3 rounded-xl text-xs font-bold text-center border bg-slate-950 text-emerald-400 border-slate-800">{modalStatus}</div>}
                  <div className="flex justify-end gap-3 border-t border-slate-800/60 pt-4">
                    {userExists && (
                      <button type="button" onClick={() => { setIsModalProfilOpen(false); setModalStatus(""); }} className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-slate-950 border border-slate-800 text-slate-400">Annuler</button>
                    )}
                    <button type="submit" className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-emerald-500 text-slate-950 shadow-lg">Enregistrer</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
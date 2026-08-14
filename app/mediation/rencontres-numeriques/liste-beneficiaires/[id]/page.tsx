"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useMediateurs } from "@/lib/MediateursProvider";
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
import { Quicksand } from "next/font/google";
import {
  ArrowLeftIcon,
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
import PageGuard from "@/components/PageGuard";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { formatPhoneNumber } from "@/lib/formatPhone";
import type { Mediateur } from "@/lib/types";

// Initialisation de la police Quicksand
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Fonction pour formater le numéro de téléphone en 00 00 00 00 00
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
  Statut_Blacklist?: string;
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
  absencePar?: "Bénéficiaire" | "Colombbus" | string;
  dateAction?: string;
  score?: string; 
  reponses?: any; 
}

interface LieuGlobal {
  id: string;
  nomCourt: string;
  nomComplet: string;
}

export default function FicheBeneficiaire() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { id } = useParams();
  const userId = id as string;
  const router = useRouter();

  const [user, setUser] = useState<Beneficiaire | null>(null);
  const [rdvs, setRdvs] = useState<Visite[]>([]);
  const [loading, setLoading] = useState(true);
  const [userExists, setUserExists] = useState(true);
  
  const { mediateurs: mediateursBruts } = useMediateurs();
  const [lieuxGlobaux, setLieuxGlobaux] = useState<LieuGlobal[]>([]);

  // Modales
  const [isModalProfilOpen, setIsModalProfilOpen] = useState(false);
  const [isModalRdvOpen, setIsModalRdvOpen] = useState(false);
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

  const aujourdhuiStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

  // Formulaire d'ajout d'action
  const [formData, setFormData] = useState({
    mediateur: "", 
    thematique: "",
    lieu: "",
    details: "",
    satisfaction: "5",
    dateChoisie: aujourdhuiStr,
    momentChoisi: "Matin",
    statut: "Présent" as "Présent" | "Absent",
    absencePar: "Bénéficiaire" as "Bénéficiaire" | "Colombbus"
  });

  // Statistiques calculées
  const [stats, setStats] = useState({
    totalPresents: 0, tauxAssiduite: 100, satisfactionMoyenne: 0, thematiquePhare: "—"
  });

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

  const formatCompteRendu = (texte: string) => {
    if (!texte) return "";
    return texte.replace(/\s+(Q\d+:)/g, "\n$1");
  };

  // Composant réutilisable pour rendre la liste des options de thématiques
  const ThematiqueOptions = () => (
    <>
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
    </>
  );

  // MÉDIATEURS : dérivés du cache partagé (lib/MediateursProvider.tsx)
  const listeMediateurs = useMemo<Mediateur[]>(() => {
    return mediateursBruts
      .filter((d: any) => d.id !== "parametres_configuration" && d.id !== "parametres_horaires")
      .map((d: any) => {
        const nomComplet = `${d.prenom || ""} ${d.nom || ""}`.trim() || "Sans nom";
        return { id: d.id, nom: nomComplet } as Mediateur;
      });
  }, [mediateursBruts]);

  useEffect(() => {
    if (listeMediateurs.length === 0) return;

    setFormData(prev => {
      const mediateurExiste = listeMediateurs.some(m => m.nom === prev.mediateur);
      if (!prev.mediateur || !mediateurExiste) {
        return { ...prev, mediateur: listeMediateurs[0].nom || "" };
      }
      return prev;
    });
  }, [listeMediateurs]);

  // Écoute Profil, Visites & Lieux Globaux
  useEffect(() => {
    if (!userId) return;

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

    const rdvRef = collection(db, "utilisateurs", userId, "visites");
    const q = query(rdvRef, orderBy("date", "desc"));
    const unsubVisites = onSnapshot(q, (querySnapshot) => {
      const rdvList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Visite));
      setRdvs(rdvList);
    });

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

  // Calcul stats et alertes
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
    if (!profilFormData.Nom.trim() || !profilFormData.Prénom.trim()) return showToast("Nom/Prénom requis", "error");
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

  const handleCloseModal = () => {
    setIsModalProfilOpen(false);
    setModalStatus("");
    if (!userExists) {
      router.push("/mediation/rencontres-numeriques/liste-beneficiaires");
    }
  };

  const handleAddRDV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userExists) return showToast("Créez d'abord le profil.", "error");

    if (!formData.lieu || !formData.mediateur) return showToast("Champs obligatoires manquants.", "error");

    try {
      await addDoc(collection(db, "utilisateurs", userId, "visites"), {
        mediateur: formData.mediateur,
        thematique: formData.statut === "Absent" ? "" : formData.thematique,
        lieu: formData.lieu,
        details: formData.statut === "Absent" ? "" : formData.details.trim(),
        statut: formData.statut,
        absencePar: formData.statut === "Absent" ? formData.absencePar : "",
        satisfaction: formData.statut === "Absent" ? 0 : Number(formData.satisfaction),
        date: formData.dateChoisie,
        moment: formData.momentChoisi,
        createdAt: serverTimestamp()
      });

      setIsModalRdvOpen(false);

      if (formData.statut === "Présent" && formData.thematique) {
        const visitesMemeThematique = rdvs.filter(
          r => r.statut === "Présent" && 
          r.thematique === formData.thematique &&
          !["Diagnostic Initial", "Diagnostic Final", "Questionnaire de satisfaction", "Collecte Tech"].includes(r.moment)
        );
        
        const nouveauTotal = visitesMemeThematique.length + 1;

        if (nouveauTotal % 5 === 0) {
          const reponse = await confirm(
            `🚨 Alerte : Ce bénéficiaire vient d'atteindre ${nouveauTotal} rendez-vous sur la thématique "${formData.thematique}".\n\nSouhaitez-vous le rediriger immédiatement vers le formulaire pour passer un nouveau diagnostic ?`
          );
          if (reponse) {
            router.push(`/mediation/rencontres-numeriques/diagnosticform?id=${userId}`);
          }
        }
      }

      setFormData(prev => ({ 
        ...prev, 
        details: "", 
        satisfaction: "5", 
        statut: "Présent",
        absencePar: "Bénéficiaire"
      }));
    } catch (error) { console.error(error); }
  };

  const handleUpdateRDV = async (rdvId: string) => {
    if (!editFormData) return;
    try {
      await updateDoc(doc(db, "utilisateurs", userId, "visites", rdvId), { 
        ...editFormData, 
        thematique: editFormData.statut === "Absent" ? "" : editFormData.thematique,
        details: editFormData.statut === "Absent" ? "" : editFormData.details,
        absencePar: editFormData.statut === "Absent" ? (editFormData.absencePar || "Bénéficiaire") : "",
        satisfaction: editFormData.statut === "Absent" ? 0 : Number(editFormData.satisfaction)
      });

      setEditingId(null); setEditFormData(null);
    } catch (error) { console.error(error); }
  };

  const handleDeleteRDV = async (rdvId: string) => {
    if (await confirm("Êtes-vous sûr de vouloir supprimer définitivement ce rendez-vous ?")) {
      try {
        await deleteDoc(doc(db, "utilisateurs", userId, "visites", rdvId));
      } catch (error) {
        console.error("Erreur lors de la suppression :", error);
        showToast("Erreur lors de la suppression.", "error");
      }
    }
  };

  const startEditing = (rdv: Visite) => {
    setEditingId(rdv.id);
    setEditFormData({ 
      ...rdv,
      absencePar: rdv.absencePar || "Bénéficiaire"
    });
  };

  const rencontresStandards = rdvs.filter(r => r.moment !== "Diagnostic Initial" && r.moment !== "Diagnostic Final" && r.moment !== "Questionnaire de satisfaction" && r.moment !== "Collecte Tech");
  const evaluationsDiagnostics = rdvs.filter(r => r.moment === "Diagnostic Initial" || r.moment === "Diagnostic Final" || r.moment === "Questionnaire de satisfaction" || r.moment === "Collecte Tech");

  const inputClass = "w-full bg-white border border-[#404040]/15 rounded-xl p-2.5 text-xs text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all shadow-sm font-medium";

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold uppercase tracking-widest text-xs animate-pulse antialiased`}>
        Chargement de la fiche...
      </div>
    );
  }

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
    <PageGuard pageId="page_access_fiche_beneficiaire">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* NAV HAUTE */}
        <div className="flex justify-between items-center mb-6">
          <Link href="/mediation/rencontres-numeriques/liste-beneficiaires" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
            <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
            <span>Retour à la liste</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <PermissionGuard actionId="fiche_nav_agenda_suresnes">
              <Link href="/mediation/rencontres-numeriques/suresnes" className="inline-flex items-center gap-2 bg-white border border-[#404040]/10 hover:border-[#005259] hover:bg-[#005259] hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-[#005259] transition-all shadow-sm">
                <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Agenda Suresnes</span>
              </Link>
            </PermissionGuard>
            <PermissionGuard actionId="fiche_nav_equipe">
              <Link href="/mediation/equipe" className="inline-flex items-center gap-2 bg-white border border-[#404040]/10 hover:border-[#005259] hover:bg-[#005259] hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-[#005259] transition-all shadow-sm">
                <UserGroupIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Gérer l'équipe RH</span>
              </Link>
            </PermissionGuard>
          </div>
        </div>

        {/* ALERTE BLACKLIST */}
        {user?.Statut_Blacklist === "Oui" && (
          <div className="mb-6 p-4 bg-[#EF736A]/10 border border-[#EF736A]/30 rounded-2xl flex items-center gap-3 shadow-sm">
            <NoSymbolIcon className="w-6 h-6 text-[#EF736A] shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-[#EF736A] uppercase tracking-wide">⚠️ ACCÈS RESTREINT / BLACKLIST</h3>
              <p className="text-xs text-[#404040]/80 mt-0.5">Ce bénéficiaire est actuellement inscrit sur la liste noire de la structure.</p>
            </div>
          </div>
        )}

        {/* HEADER PROFIL */}
        <header className="bg-white border border-[#404040]/10 rounded-2xl p-6 mb-6 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`h-10 w-1 rounded-full ${user?.Statut_Blacklist === "Oui" ? "bg-[#EF736A]" : "bg-[#005259] shadow-[0_0_15px_rgba(0,82,89,0.3)]"}`}></div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#005259] uppercase">
                  {user?.Civilité} {user?.Nom} <span className="text-[#EA601F] font-normal">&nbsp;{user?.Prénom}</span>
                  {user?.Date_Naissance && <span className="text-sm text-[#404040]/60 font-normal normal-case ml-3">({calculerAgeEnDirect(user.Date_Naissance)})</span>}
                </h1>
                <div className="ml-2 flex gap-2 flex-wrap">
                  {user?.Statut_Blacklist === "Oui" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-[#EF736A]/15 border border-[#EF736A]/30 text-[#EF736A]">
                      🚫 BLACKLISTÉ
                    </span>
                  )}
                  {statutAdhesion.estAdherent ? (
                    statutAdhesion.aRenouveler ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-[#EA601F]/15 border border-[#EA601F]/30 text-[#EA601F] animate-pulse">
                        ⚠️ Adhésion à renouveler
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-[#A9E0C9]/30 border border-[#A9E0C9] text-[#005259]">
                        ✅ Adhérent
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-[#F9945D]/15 border border-[#F9945D]/30 text-[#EA601F]">
                      ⚠️ Non adhérent
                    </span>
                  )}
                  {user?.QPV === "Oui" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-[#F3F3F2] border border-[#404040]/10 text-[#404040]">
                      📍 QPV
                    </span>
                  )}
                  {(user?.Lieu_RDV === "92 - Collecte Tech" || user?.lieuRDV === "92 - Collecte Tech") && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-[#F9945D]/15 border border-[#F9945D]/30 text-[#EA601F]">
                      🔧 Collecte Tech
                    </span>
                  )}
                </div>
              </div>
              <PermissionGuard actionId="fiche_edit_profil">
                <button
                  onClick={() => setIsModalProfilOpen(true)}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 ${
                    isProfilIncomplet
                      ? "bg-[#F9945D]/15 border border-[#F9945D] text-[#EA601F] hover:bg-[#F9945D]/30"
                      : "bg-[#EA601F] hover:bg-[#EF736A] text-white"
                  }`}
                >
                  <PencilSquareIcon className="w-4 h-4" />
                  <span>{isProfilIncomplet ? "Compléter le profil" : "Éditer le profil"}</span>
                </button>
              </PermissionGuard>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <div className="flex items-center gap-3 bg-[#F3F3F2] p-3 rounded-xl border border-[#404040]/10"><PhoneIcon className="w-4 h-4 text-[#EA601F]" /><span className="text-xs text-[#404040] font-medium">{formatPhoneNumber(user?.Téléphone)}</span></div>
              <div className="flex items-center gap-3 bg-[#F3F3F2] p-3 rounded-xl border border-[#404040]/10"><EnvelopeIcon className="w-4 h-4 text-[#EA601F]" /><span className="text-xs truncate text-[#404040] font-medium">{user?.email || "Non renseigné"}</span></div>
              <div className="flex items-center gap-3 bg-[#F3F3F2] p-3 rounded-xl border border-[#404040]/10"><MapPinIcon className="w-4 h-4 text-[#EA601F]" /><span className="text-xs text-[#404040] font-medium truncate">{user?.Ville || "—"} ({user?.Code_Postal || "—"})</span></div>
              <div className="flex items-center gap-3 bg-[#F3F3F2] p-3 rounded-xl border border-[#404040]/10"><BriefcaseIcon className="w-4 h-4 text-[#EA601F]" /><span className="text-xs text-[#404040] font-medium">{user?.Situation_Socio_Pro || "—"}</span></div>
            </div>
          </div>
        </header>

        {/* ALERTE ÉVALUATION */}
        {thematiquesAAlerter.length > 0 && (
          <div className="mb-6 p-4 bg-[#EF736A]/10 border border-[#EF736A]/30 rounded-2xl flex items-start gap-3 animate-pulse shadow-sm">
            <ExclamationTriangleIcon className="w-6 h-6 text-[#EF736A] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-[#EF736A] uppercase tracking-wide">Évaluation des progrès requise !</h3>
              <p className="text-xs text-[#404040] mt-1">
                Ce bénéficiaire est actuellement sur un multiple de <span className="font-bold text-[#005259]">5 rendez-vous</span> sur : <span className="text-[#EF736A] font-bold">{thematiquesAAlerter.join(", ")}</span>. Un nouveau diagnostic est recommandé.
              </p>
            </div>
          </div>
        )}

        {/* STATS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-[#404040]/10 p-4 rounded-2xl shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#404040]/60">Actions Présentes</p>
            <p className="text-2xl font-bold text-[#005259] mt-1">{stats.totalPresents} <span className="text-xs text-[#404040]/60 font-normal">rdvs</span></p>
          </div>
          <div className="bg-white border border-[#404040]/10 p-4 rounded-2xl shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#404040]/60">Taux d'Assiduité</p>
            <p className="text-2xl font-bold text-[#EA601F] mt-1">{stats.tauxAssiduite}%</p>
          </div>
          <div className="bg-white border border-[#404040]/10 p-4 rounded-2xl shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#404040]/60">Satisfaction Moyenne</p>
            <p className="text-2xl font-bold text-[#005259] mt-1">{stats.satisfactionMoyenne} <span className="text-xs text-[#404040]/60 font-normal">/ 5</span></p>
          </div>
          <div className="bg-white border border-[#404040]/10 p-4 rounded-2xl shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#404040]/60">Thématique Phare</p>
            <p className="text-xs font-bold text-[#EA601F] mt-2 truncate">{stats.thematiquePhare}</p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-4">
            
            {/* BOUTON D'OUVERTURE DE LA POP-UP NOUVELLE ACTION */}
            <section className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <PlusCircleIcon className="w-5 h-5 text-[#EA601F] shrink-0" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#005259]">Action & Suivi</h3>
                  <p className="text-[11px] text-[#404040]/70 mt-0.5">Enregistrer une nouvelle séance ou un entretien.</p>
                </div>
              </div>
              <PermissionGuard actionId="fiche_add_action">
                <button
                  onClick={() => setIsModalRdvOpen(true)}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  <PlusCircleIcon className="w-4 h-4" />
                  <span>Enregistrer un RDV</span>
                </button>
              </PermissionGuard>
            </section>

            {/* AUTO EVALS */}
            <section className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <AcademicCapIcon className="w-5 h-5 text-[#005259] shrink-0" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#005259]">Médiation Numérique</h3>
                  <p className="text-[11px] text-[#404040]/70 mt-0.5">Lancer un diagnostic initial, final ou de satisfaction.</p>
                </div>
              </div>
              <PermissionGuard actionId="fiche_nav_diagnostic">
                <Link href={`/mediation/rencontres-numeriques/diagnosticform?id=${userId}`} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#005259] hover:bg-[#EA601F] text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95">
                  <PlusCircleIcon className="w-4 h-4" />
                  <span>Remplir un questionnaire</span>
                </Link>
              </PermissionGuard>
            </section>

          </div>

          {/* COLONNE DE DROITE */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* LISTE RDV */}
            <section className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#404040]/10">
                <ClockIcon className="w-5 h-5 text-[#005259]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#005259]">Suivi des rendez-vous ({rencontresStandards.length})</h2>
              </div>

              {rencontresStandards.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#404040]/15 rounded-xl text-[#404040]/50 text-xs uppercase tracking-wider font-bold">Aucun rendez-vous standard enregistré.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] uppercase tracking-widest text-[10px] font-bold">
                        <th className="py-3 px-3">Date / Moment</th>
                        <th className="py-3 px-3">Intervenant & Axe</th>
                        <th className="py-3 px-3">Lieu / Détails</th>
                        <th className="py-3 px-3 text-center">Statut / Avis</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#404040]/5">
                      {rencontresStandards.map((rdv) => {
                        const isEditing = editingId === rdv.id;
                        const rdvSatisfactionNode = rdv.satisfaction && typeof rdv.satisfaction === "object" ? rdv.satisfaction.evaluationGlobale : rdv.satisfaction;

                        return (
                          <tr key={rdv.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                            <td className="py-3 px-3">
                              {isEditing && editFormData ? (
                                <div className="space-y-1">
                                  <input type="date" value={editFormData.date} onChange={e => setEditFormData({...editFormData, date: e.target.value})} className="bg-white border border-[#404040]/15 text-[11px] p-1 rounded text-[#404040] outline-none w-full" />
                                  <select value={editFormData.moment} onChange={e => setEditFormData({...editFormData, moment: e.target.value})} className="bg-white border border-[#404040]/15 text-[11px] p-1 rounded text-[#404040] outline-none w-full">
                                    <option value="Matin">Matin</option>
                                    <option value="Après-midi">Après-midi</option>
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <p className="font-bold text-[#005259]">{new Date(rdv.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'})}</p>
                                  <p className="text-[10px] text-[#404040]/60 uppercase tracking-wider font-bold">{rdv.moment}</p>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              {isEditing && editFormData ? (
                                <div className="space-y-1">
                                  <select value={editFormData.mediateur} onChange={e => setEditFormData({...editFormData, mediateur: e.target.value})} className="bg-white border border-[#404040]/15 text-[11px] p-1 rounded text-[#404040] outline-none w-full">
                                    {listeMediateurs.map(m => <option key={m.id} value={m.nom}>{m.nom}</option>)}
                                  </select>
                                  <select value={editFormData.thematique} onChange={e => setEditFormData({...editFormData, thematique: e.target.value})} className="bg-white border border-[#404040]/15 text-[11px] p-1 rounded text-[#404040] outline-none w-full">
                                    <ThematiqueOptions />
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-[#404040] font-bold">{rdv.mediateur}</p>
                                  <p className="text-[10px] font-bold text-[#EA601F] tracking-wide">{rdv.statut === "Absent" ? "—" : rdv.thematique}</p>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3 max-w-[200px]">
                              {isEditing && editFormData ? (
                                <div className="space-y-1">
                                  <select 
                                    value={editFormData.lieu} 
                                    onChange={e => setEditFormData({...editFormData, lieu: e.target.value})} 
                                    className="bg-white border border-[#404040]/15 text-[11px] p-1 rounded text-[#404040] outline-none w-full"
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
                                    <textarea value={editFormData.details} onChange={e => setEditFormData({...editFormData, details: e.target.value})} rows={2} className="bg-white border border-[#404040]/15 text-[11px] p-1 rounded text-[#404040] outline-none w-full resize-none" />
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <p className="text-[#404040]/60 italic text-[11px] truncate uppercase font-bold">{rdv.lieu}</p>
                                  <p className="text-[#404040] line-clamp-2 text-[11px] leading-relaxed mt-0.5">{rdv.statut === "Absent" ? "— (Absent)" : (rdv.details || "Aucune note rédigée.")}</p>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              {isEditing && editFormData ? (
                                <div className="space-y-1 inline-block text-left">
                                  <select value={editFormData.statut} onChange={e => setEditFormData({...editFormData, statut: e.target.value as "Présent" | "Absent"})} className="bg-white border border-[#404040]/15 text-[11px] p-1 rounded text-[#404040] outline-none">
                                    <option value="Présent">Présent</option>
                                    <option value="Absent">Absent</option>
                                  </select>

                                  {editFormData.statut === "Présent" ? (
                                    <select value={editFormData.satisfaction} onChange={e => setEditFormData({...editFormData, satisfaction: e.target.value})} className="bg-white border border-[#404040]/15 text-[11px] p-1 rounded text-[#EA601F] outline-none block w-full font-bold">
                                      {[1,2,3,4,5].map(n => <option key={n} value={n}>⭐ {n}</option>)}
                                    </select>
                                  ) : (
                                    <div className="space-y-1 pt-1">
                                      <label className="text-[10px] font-bold text-[#EF736A] block uppercase">Absence de :</label>
                                      <div className="flex flex-col gap-1 text-[10px]">
                                        <label className="flex items-center gap-1 cursor-pointer">
                                          <input 
                                            type="radio" 
                                            name={`absencePar_${rdv.id}`} 
                                            value="Bénéficiaire" 
                                            checked={editFormData.absencePar === "Bénéficiaire"} 
                                            onChange={() => setEditFormData({...editFormData, absencePar: "Bénéficiaire"})}
                                          />
                                          <span>Bénéficiaire</span>
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer">
                                          <input 
                                            type="radio" 
                                            name={`absencePar_${rdv.id}`} 
                                            value="Colombbus" 
                                            checked={editFormData.absencePar === "Colombbus"} 
                                            onChange={() => setEditFormData({...editFormData, absencePar: "Colombbus"})}
                                          />
                                          <span>Colombbus</span>
                                        </label>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  {rdv.statut === "Présent" ? (
                                    <>
                                      <span className="inline-flex items-center gap-1 bg-[#A9E0C9]/30 border border-[#A9E0C9] text-[#005259] px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Présent</span>
                                      <span className="text-[11px] font-bold text-[#EA601F]">⭐ {rdvSatisfactionNode}/5</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="inline-flex items-center gap-1 bg-[#EF736A]/15 border border-[#EF736A]/30 text-[#EF736A] px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                                        Absent
                                      </span>
                                      <span className="text-[10px] font-bold text-[#EF736A]/90">
                                        ({rdv.absencePar || "Bénéficiaire"})
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-1.5">
                                  <PermissionGuard actionId="fiche_action_save_rdv">
                                    <button onClick={() => handleUpdateRDV(rdv.id)} className="p-1 bg-[#005259] text-white hover:bg-[#EA601F] rounded shadow-sm">
                                      <CheckIcon className="w-4 h-4 stroke-[3]" />
                                    </button>
                                  </PermissionGuard>
                                  <button onClick={() => { setEditingId(null); setEditFormData(null); }} className="p-1 bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] hover:bg-[#404040]/10 rounded">
                                    <XMarkIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <PermissionGuard actionId="fiche_action_edit_rdv">
                                    <button onClick={() => startEditing(rdv)} className="p-1.5 bg-[#F3F3F2] border border-[#404040]/10 hover:border-[#005259] text-[#005259] hover:bg-[#005259] hover:text-white rounded-lg transition-colors">
                                      <PencilSquareIcon className="w-4 h-4" />
                                    </button>
                                  </PermissionGuard>
                                  <PermissionGuard actionId="fiche_action_delete_rdv">
                                    <button onClick={() => handleDeleteRDV(rdv.id)} className="p-1.5 bg-[#EF736A]/10 border border-[#EF736A]/30 hover:bg-[#EF736A] hover:text-white text-[#EF736A] rounded-lg transition-colors">
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  </PermissionGuard>
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
            <section className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#404040]/10">
                <ClipboardDocumentCheckIcon className="w-5 h-5 text-[#EA601F]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#005259]">Diagnostics & Auto-évaluations ({evaluationsDiagnostics.length})</h2>
              </div>

              {evaluationsDiagnostics.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-[#404040]/15 rounded-xl text-[#404040]/50 text-xs uppercase tracking-wider font-bold">Aucun questionnaire ou diagnostic passé.</div>
              ) : (
                <div className="space-y-4">
                  {evaluationsDiagnostics.map((diag) => {
                    const exactSatisfactionNode = diag.satisfaction && typeof diag.satisfaction === "object" ? diag.satisfaction.evaluationGlobale : diag.satisfaction;

                    return (
                      <div key={diag.id} className="bg-[#F3F3F2] border border-[#404040]/10 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-[#404040]/10 pb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              diag.moment === "Diagnostic Initial" ? "bg-[#EA601F]/15 border border-[#EA601F]/30 text-[#EA601F]" :
                              diag.moment === "Diagnostic Final" ? "bg-[#A9E0C9]/40 border border-[#A9E0C9] text-[#005259]" :
                              diag.moment === "Collecte Tech" ? "bg-[#EA601F]/15 border border-[#EA601F]/30 text-[#EA601F]" :
                              "bg-white border border-[#404040]/10 text-[#005259]"
                            }`}>
                              {diag.moment}
                            </span>
                            <span className="text-xs font-bold text-[#404040]/70">
                              {new Date(diag.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'})}
                            </span>
                          </div>

                          {diag.moment === "Collecte Tech" && (
                            <PermissionGuard actionId="fiche_nav_bilan_tech">
                              <Link
                                href={`/mediation/rencontres-numeriques/bilan_tech?id=${userId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 bg-[#EA601F] hover:bg-[#EF736A] text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-all shadow-sm shrink-0"
                              >
                                <ClipboardDocumentCheckIcon className="w-4 h-4 shrink-0" />
                                <span>Bilan Tech</span>
                              </Link>
                            </PermissionGuard>
                          )}
                        </div>

                        {diag.thematique && (
                          <p className="text-[11px] text-[#404040]/70">
                            Axe évalué : <span className="text-[#005259] font-bold">{diag.thematique}</span>
                          </p>
                        )}

                        <div>
                          {diag.score ? (
                            <div className="bg-white border border-[#404040]/10 px-3 py-1.5 rounded-lg inline-block shadow-sm">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-[#404040]/60 block">
                                Score / Résultat
                              </span>
                              <span className="text-sm font-bold text-[#005259]">
                                {diag.score}
                              </span>
                            </div>
                          ) : exactSatisfactionNode ? (
                            <div className="text-xs font-bold text-[#EA601F] bg-[#EA601F]/10 border border-[#EA601F]/20 px-2.5 py-1 rounded-lg inline-block">
                              Note globale : ⭐ {exactSatisfactionNode}/5
                            </div>
                          ) : (
                            <span className="text-xs text-[#404040]/50">—</span>
                          )}
                        </div>

                        {diag.details && (
                          <div className="bg-white p-3 rounded-lg border border-[#404040]/10 text-[11px] text-[#404040] leading-relaxed mt-1 whitespace-pre-wrap font-sans">
                            {formatCompteRendu(diag.details)}
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

        {/* MODALE ENREGISTRER UN RDV / NOUVELLE ACTION */}
        {isModalRdvOpen && (
          <div className="fixed inset-0 bg-[#005259]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white border border-[#404040]/10 rounded-3xl shadow-2xl max-w-lg w-full p-6 md:p-8 relative text-[#404040]">
              
              <div className="flex justify-between items-center mb-6 pb-2 border-b border-[#404040]/10">
                <div className="flex items-center gap-2">
                  <PlusCircleIcon className="w-5 h-5 text-[#005259]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#005259]">Nouvelle Action</h2>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsModalRdvOpen(false)} 
                  className="text-[#404040]/50 hover:text-[#005259] p-1 rounded-lg hover:bg-[#F3F3F2] transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddRDV} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Médiateur Référent</label>
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
                  <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Thématique</label>
                  <select value={formData.thematique} onChange={e => setFormData({...formData, thematique: e.target.value})} className={inputClass}>
                    <ThematiqueOptions />
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-[#404040]/70 uppercase">Lieu de la rencontre</label>
                    <PermissionGuard actionId="fiche_action_change_lieu">
                      <Link
                        href="/mediation/localisations"
                        className="text-[9px] text-[#005259] font-bold underline uppercase hover:text-[#EA601F] transition-colors"
                      >
                        + Ajouter un lieu
                      </Link>
                    </PermissionGuard>
                  </div>

                  <select 
                    value={formData.lieu} 
                    onChange={e => setFormData({...formData, lieu: e.target.value})} 
                    className={inputClass}
                  >
                    {lieuxGlobaux.length === 0 ? (
                      <option value="">Aucun lieu disponible</option>
                    ) : (
                      lieuxGlobaux.map((l) => (
                        <option key={l.id} value={l.nomCourt}>
                          {l.nomCourt}
                        </option>
                      ))
                    )}
                    {formData.lieu && !lieuxGlobaux.some(l => l.nomCourt === formData.lieu) && (
                      <option value={formData.lieu}>{formData.lieu}</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Date</label>
                    <input type="date" value={formData.dateChoisie} onChange={e => setFormData({...formData, dateChoisie: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Moment</label>
                    <select value={formData.momentChoisi} onChange={e => setFormData({...formData, momentChoisi: e.target.value})} className={inputClass}>
                      <option value="Matin">Matin</option>
                      <option value="Après-midi">Après-midi</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#F3F3F2] p-3 rounded-xl border border-[#404040]/10 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Statut</label>
                      <select 
                        value={formData.statut} 
                        onChange={e => setFormData({...formData, statut: e.target.value as "Présent" | "Absent"})} 
                        className="bg-white text-xs text-[#404040] border border-[#404040]/15 rounded p-1.5 w-full outline-none font-medium"
                      >
                        <option value="Présent">Présent</option>
                        <option value="Absent">Absent</option>
                      </select>
                    </div>

                    {formData.statut === "Présent" && (
                      <div>
                        <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Satisfaction</label>
                        <select value={formData.satisfaction} onChange={e => setFormData({...formData, satisfaction: e.target.value})} className="bg-white text-xs text-[#EA601F] border border-[#404040]/15 rounded p-1.5 w-full outline-none font-bold">
                          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>⭐ {n}/5</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {formData.statut === "Absent" && (
                    <div className="border-t border-[#404040]/10 pt-2.5">
                      <label className="block text-[10px] font-bold text-[#EF736A] uppercase mb-1.5">Origine de l'absence :</label>
                      <div className="flex items-center gap-6">
                        <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-[#404040]">
                          <input 
                            type="radio" 
                            name="absencePar" 
                            value="Bénéficiaire" 
                            checked={formData.absencePar === "Bénéficiaire"} 
                            onChange={() => setFormData({...formData, absencePar: "Bénéficiaire"})}
                            className="text-[#005259] focus:ring-[#005259]"
                          />
                          <span>Bénéficiaire</span>
                        </label>

                        <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-[#404040]">
                          <input 
                            type="radio" 
                            name="absencePar" 
                            value="Colombbus" 
                            checked={formData.absencePar === "Colombbus"} 
                            onChange={() => setFormData({...formData, absencePar: "Colombbus"})}
                            className="text-[#005259] focus:ring-[#005259]"
                          />
                          <span>Colombbus</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {formData.statut === "Présent" && (
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Compte-rendu</label>
                    <textarea value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} rows={3} className={`${inputClass} resize-none`} placeholder="Écrire les détails de l'entretien..."></textarea>
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t border-[#404040]/10 pt-4 mt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsModalRdvOpen(false)} 
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-white border border-[#404040]/10 text-[#404040] hover:bg-[#F3F3F2] transition-colors"
                  >
                    Annuler
                  </button>
                  <PermissionGuard actionId="fiche_add_action">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-[#EA601F] hover:bg-[#EF736A] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                    >
                      Enregistrer l'action
                    </button>
                  </PermissionGuard>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODALE PROFIL */}
        {isModalProfilOpen && (
          <div className="fixed inset-0 bg-[#005259]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white border border-[#404040]/10 rounded-3xl shadow-2xl max-w-2xl w-full p-6 md:p-8 relative text-[#404040]">
              <div className="flex justify-between items-center mb-6 pb-2 border-b border-[#404040]/10">
                <h2 className="text-base font-bold uppercase tracking-wider text-[#005259] flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-[#005259]" />
                  <span>{userExists ? "Édition du Dossier" : "Création d'une nouvelle fiche"}</span>
                </h2>
                
                <button 
                  type="button" 
                  onClick={handleCloseModal} 
                  className="text-[#404040]/50 hover:text-[#005259] p-1 rounded-lg hover:bg-[#F3F3F2] transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfil} className="space-y-4">
                
                {/* BLACKLIST */}
                <div className="bg-[#EF736A]/10 border border-[#EF736A]/30 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <NoSymbolIcon className="w-5 h-5 text-[#EF736A] shrink-0" />
                    <div>
                      <label className="block text-xs font-bold text-[#EF736A] uppercase tracking-wide">Mettre sur Liste Noire (Blacklist)</label>
                      <span className="text-[11px] text-[#404040]/70 block mt-0.5">Restreindre temporairement ou définitivement ce profil.</span>
                    </div>
                  </div>
                  <PermissionGuard actionId="fiche_modal_toggle_blacklist">
                    <select
                      value={profilFormData.Statut_Blacklist}
                      onChange={e => setProfilFormData({...profilFormData, Statut_Blacklist: e.target.value})}
                      className="bg-white border border-[#EF736A]/40 rounded-xl p-2 text-xs font-bold text-[#EF736A] outline-none focus:ring-1 focus:ring-[#EF736A] transition-all"
                    >
                      <option value="Non" className="text-[#404040]">Non (Actif)</option>
                      <option value="Oui" className="text-[#EF736A]">Oui (Blacklisté)</option>
                    </select>
                  </PermissionGuard>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Civilité</label>
                    <select value={profilFormData.Civilité} onChange={e => setProfilFormData({...profilFormData, Civilité: e.target.value})} className={inputClass}>
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Prénom</label>
                    <input type="text" value={profilFormData.Prénom} onChange={e => setProfilFormData({...profilFormData, Prénom: e.target.value})} className={inputClass} placeholder="Prénom..." required />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Nom de famille</label>
                  <input type="text" value={profilFormData.Nom} onChange={e => setProfilFormData({...profilFormData, Nom: e.target.value})} className={inputClass} placeholder="Nom..." required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Date de Naissance</label>
                    <input type="date" value={profilFormData.Date_Naissance} onChange={e => setProfilFormData({...profilFormData, Date_Naissance: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Date d'Adhésion (Optionnel)</label>
                    <input type="date" value={profilFormData.Date_Adhesion} onChange={e => setProfilFormData({...profilFormData, Date_Adhesion: e.target.value})} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Téléphone</label>
                    <input type="tel" value={profilFormData.Téléphone} onChange={e => setProfilFormData({...profilFormData, Téléphone: e.target.value})} className={inputClass} placeholder="06..." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Adresse Email</label>
                    <input type="email" value={profilFormData.email} onChange={e => setProfilFormData({...profilFormData, email: e.target.value})} className={inputClass} placeholder="exemple@mail.com" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Rue / Adresse</label>
                    <input type="text" value={profilFormData.Adresse_Rue} onChange={e => setProfilFormData({...profilFormData, Adresse_Rue: e.target.value})} className={inputClass} placeholder="Adresse..." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Code Postal</label>
                    <input type="text" value={profilFormData.Code_Postal} onChange={e => setProfilFormData({...profilFormData, Code_Postal: e.target.value})} className={inputClass} placeholder="92150" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Ville</label>
                    <input type="text" value={profilFormData.Ville} onChange={e => setProfilFormData({...profilFormData, Ville: e.target.value})} className={inputClass} placeholder="Suresnes..." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Quartier QPV</label>
                    <select value={profilFormData.QPV} onChange={e => setProfilFormData({...profilFormData, QPV: e.target.value})} className={inputClass}>
                      <option value="Non">Non</option>
                      <option value="Oui">Oui</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Situation Socio-Pro</label>
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

                <div className="grid grid-cols-2 gap-3 bg-[#F3F3F2] p-3 rounded-2xl border border-[#404040]/10">
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Situation de Handicap</label>
                    <select value={profilFormData.Situation_Handicap} onChange={e => setProfilFormData({...profilFormData, Situation_Handicap: e.target.value})} className="bg-white border border-[#404040]/15 text-xs text-[#404040] rounded p-1.5 w-full outline-none font-medium">
                      <option value="Non">Non</option>
                      <option value="Oui">Oui</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Reconnaissance RQTH</label>
                    <select value={profilFormData.RQTH} onChange={e => setProfilFormData({...profilFormData, RQTH: e.target.value})} className="bg-white border border-[#404040]/15 text-xs text-[#404040] rounded p-1.5 w-full outline-none font-medium">
                      <option value="Non">Non</option>
                      <option value="Oui">Oui</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#F3F3F2] p-3 rounded-2xl border border-[#404040]/10">
                  <label className="block text-[10px] font-bold text-[#404040]/70 uppercase mb-1">Rattachement Événementnel principal</label>
                  <select 
                    value={profilFormData.Lieu_RDV} 
                    onChange={e => setProfilFormData({...profilFormData, Lieu_RDV: e.target.value, lieuRDV: e.target.value})} 
                    className="bg-white border border-[#404040]/15 text-xs text-[#404040] rounded p-1.5 w-full outline-none font-medium"
                  >
                    <option value="">-- Aucun ou Standard --</option>
                    <option value="92 - Collecte Tech">92 - Collecte Tech</option>
                  </select>
                </div>

                <div className="pt-4 space-y-3">
                  {modalStatus && <div className="p-3 rounded-xl text-xs font-bold text-center border bg-[#F3F3F2] text-[#005259] border-[#404040]/10">{modalStatus}</div>}
                  
                  <div className="flex justify-end gap-3 border-t border-[#404040]/10 pt-4">
                    <button 
                      type="button" 
                      onClick={handleCloseModal} 
                      className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-white border border-[#404040]/10 text-[#404040] hover:bg-[#F3F3F2] transition-colors"
                    >
                      Annuler
                    </button>
                    
                    <PermissionGuard actionId="fiche_modal_submit">
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl text-xs font-bold uppercase bg-[#005259] text-white shadow-md hover:bg-[#EA601F] transition-colors active:scale-95"
                      >
                        Enregistrer
                      </button>
                    </PermissionGuard>
                  </div>
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
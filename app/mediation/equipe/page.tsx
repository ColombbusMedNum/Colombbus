"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, getDoc, updateDoc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { Quicksand } from "next/font/google";
import { 
  UserPlusIcon,
  PencilSquareIcon,
  ArchiveBoxIcon,
  HomeIcon,
  ClockIcon,
  UserIcon,
  XMarkIcon,
  EnvelopeIcon,   
  PhoneIcon,   
  Squares2X2Icon,  
  ListBulletIcon,
  MapPinIcon,
  PlusIcon,
  ShieldCheckIcon,
  AcademicCapIcon,
  ArrowDownTrayIcon,
  KeyIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import PageGuard from "@/components/PageGuard";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useMediateurs } from "@/lib/MediateursProvider";
import { ROLES, normalizeRole } from "@/lib/roles";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { getTerritoryColor } from "@/lib/territoryColor";
import Accordion from "@/components/Accordion";
import { regrouperParCategorie } from "@/lib/equipeCategories";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

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
  const { showToast } = useToast();
  const confirm = useConfirm();
  // Depuis la migration vers la collection configuration_equipe, liste_mediateurs
  // ne contient plus que des fiches de médiateurs : plus besoin de filtrer
  // les anciens documents de configuration au passage.
  const { mediateurs } = useMediateurs();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<any | null>(null);
  
  const [currentTab, setCurrentTab] = useState<"actifs" | "archives">("actifs");
  const [displayMode, setDisplayMode] = useState<"cartes" | "liste">("cartes");
  const [categoriesOuvertes, setCategoriesOuvertes] = useState<{ [key: string]: boolean }>({
    cadres: true, permanents: true, aci_massy: true, aci_paris: true, stagiaires: true, autres: true,
  });


  const [listeTerritoires, setListeTerritoires] = useState<string[]>(["Paris", "Massy"]);
  const [nouveauTerritoireInput, setNouveauTerritoireInput] = useState("");
  
  // Comptes signalés par app/login/page.tsx dont la fiche liste_mediateurs
  // vit encore sous un ancien ID Firestore aléatoire au lieu de leur UID —
  // voir handleCorrigerAcces et firestore.rules /migrations_uid_requises.
  const [migrationsRequises, setMigrationsRequises] = useState<any[]>([]);
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
    dureeHebdoACI: "26h" as "26h" | "35h",
    taux: 0,
    actif: true,
    exclureAgenda: false,
    competences: [] as string[]
  });

  useEffect(() => {
    let unsubConfig = () => {};
    let annule = false;

    const configRef = doc(db, "configuration_equipe", "parametres_configuration");
    // Ancien emplacement : ce document vivait par erreur dans liste_mediateurs
    // (qui ne devrait contenir que des fiches de médiateurs indexées par UID),
    // provoquant des "médiateurs fantômes" dans toute page listant
    // liste_mediateurs sans filtre dédié. La grille horaire ACI (Paris/Massy),
    // qui vivait au même endroit, est migrée séparément par
    // /mediation/parametres, qui en a désormais la charge exclusive.
    const ancienConfigRef = doc(db, "liste_mediateurs", "parametres_configuration");

    const demarrer = async () => {
      // Migration transparente, une seule fois : si le nouvel emplacement est
      // vide mais que l'ancien contient encore des données, on les reprend
      // telles quelles (au lieu de repartir sur les valeurs par défaut) puis
      // on nettoie l'ancien document. La suppression exige d'être admin (voir
      // firestore.rules) : un coordinateur copie sans supprimer, un admin
      // finira le nettoyage à sa prochaine visite de la page.
      try {
        const nouveauConfig = await getDoc(configRef);

        if (!nouveauConfig.exists()) {
          const ancien = await getDoc(ancienConfigRef);
          if (ancien.exists()) {
            await setDoc(configRef, ancien.data());
            await deleteDoc(ancienConfigRef).catch(() => {});
          }
        }
      } catch (err) {
        console.error("Erreur lors de la migration de la configuration équipe :", err);
      }

      if (annule) return;

      unsubConfig = onSnapshot(configRef, (snapshot) => {
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
          setDoc(configRef, {
            territoires: ["Paris", "Massy"],
            qualitesGlobales: ["Excel", "Word"]
          });
        }
      });
    };

    demarrer();

    return () => {
      annule = true;
      unsubConfig();
    };
  }, []);

  useEffect(() => {
    // Lecture réservée au coordinateur+ par firestore.rules — pour un rôle
    // sans ce droit, l'écoute échoue silencieusement (onSnapshot n'appelle
    // jamais son callback de succès), migrationsRequises reste vide.
    const unsub = onSnapshot(
      collection(db, "migrations_uid_requises"),
      (snap) => setMigrationsRequises(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => unsub();
  }, []);

  // Corrige le décalage d'ID pour un compte signalé par app/login/page.tsx :
  // recopie la fiche sous l'UID réel, supprime l'ancienne et le signalement.
  // Ne crée ni compte Auth ni e-mail — juste le repositionnement Firestore
  // (voir scripts/migrate-mediateurs-to-uid.js pour l'équivalent en masse).
  const handleCorrigerAcces = async (migration: any) => {
    if (!(await confirm(`Corriger l'accès pour ${migration.email} ?`))) return;
    try {
      const ancienSnap = await getDoc(doc(db, "liste_mediateurs", migration.ancienDocId));
      if (!ancienSnap.exists()) {
        showToast("La fiche d'origine est introuvable (déjà corrigée ou supprimée).", "error");
        await deleteDoc(doc(db, "migrations_uid_requises", migration.id));
        return;
      }
      const batch = writeBatch(db);
      batch.set(doc(db, "liste_mediateurs", migration.id), ancienSnap.data());
      batch.delete(doc(db, "liste_mediateurs", migration.ancienDocId));
      batch.delete(doc(db, "migrations_uid_requises", migration.id));
      await batch.commit();
      showToast("Accès corrigé avec succès.");
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la correction de l'accès.", "error");
    }
  };

  const handleAddTerritoire = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomNettoye = nouveauTerritoireInput.trim();
    if (!nomNettoye) return;
    
    if (listeTerritoires.some(t => t.toLowerCase() === nomNettoye.toLowerCase())) {
      showToast("Ce territoire existe déjà !", "error");
      return;
    }

    const nouvelleListe = [...listeTerritoires, nomNettoye].sort();
    setListeTerritoires(nouvelleListe);
    setNouveauTerritoireInput("");
    
    try {
      await updateDoc(doc(db, "configuration_equipe", "parametres_configuration"), { territoires: nouvelleListe });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSupprimerTerritoire = async (nom: string) => {
    if (nom === "Paris" || nom === "Massy") {
      showToast("Les territoires pivots 'Paris' et 'Massy' ne peuvent pas être supprimés.", "error");
      return;
    }
    if (!(await confirm(`Supprimer le territoire "${nom}" ?`))) return;

    const nouvelleListe = listeTerritoires.filter(t => t !== nom).sort();
    setListeTerritoires(nouvelleListe);
    try {
      await updateDoc(doc(db, "configuration_equipe", "parametres_configuration"), { territoires: nouvelleListe });
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
        await updateDoc(doc(db, "configuration_equipe", "parametres_configuration"), {
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
      showToast("Le prénom, le nom et l'adresse email sont obligatoires.", "error");
      return;
    }

    const emailNormalise = formData.email.trim().toLowerCase();

    // Sécurité : bloque la création d'une deuxième fiche avec le même e-mail
    // qu'une fiche existante (ex. faute de frappe créant "Nouveau membre" au
    // lieu de mettre à jour la fiche en cours d'édition) — sans ça, deux
    // fiches distinctes peuvent coexister pour la même personne.
    const doublon = mediateurs.find(
      (m: any) => m.email?.trim().toLowerCase() === emailNormalise && m.id !== editingMed?.id
    );
    if (doublon) {
      showToast(`Une fiche existe déjà avec cet e-mail : ${doublon.prenom} ${doublon.nom}. Modifiez cette fiche existante plutôt que d'en créer une nouvelle.`, "error");
      return;
    }

    const netPayload = {
      ...formData,
      email: emailNormalise,
      telephone: formData.telephone.trim(),
      taux: Number(formData.taux) || 0
    };

    try {
      if (editingMed) {
        await updateDoc(doc(db, "liste_mediateurs", editingMed.id), netPayload);
      } else {
        // Créer la fiche seule, sans compte de connexion : certains
        // médiateurs ajoutés à la plateforme n'ont pas vocation à s'y
        // connecter. La création du compte Auth et l'envoi des identifiants
        // se font désormais manuellement (Firebase Console), pas depuis
        // cette page.
        await setDoc(doc(collection(db, "liste_mediateurs")), netPayload);
      }
      closeModal();
    } catch (err: any) {
      console.error(err);
      showToast("Une erreur est survenue lors de la création du membre.", "error");
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
        role: normalizeRole(med.role),
        sites: med.sites ? med.sites : (med.sitePrincipal ? [med.sitePrincipal] : []),
        rattachementHoraireACI: med.rattachementHoraireACI || "Paris",
        dureeHebdoACI: med.dureeHebdoACI || "26h",
        taux: med.taux !== undefined ? Number(med.taux) : 0,
        actif: med.actif !== undefined ? med.actif : true,
        exclureAgenda: med.exclureAgenda || false,
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
        dureeHebdoACI: "26h",
        taux: 0,
        actif: true,
        exclureAgenda: false,
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

  // Les Formateurs ont leur propre bloc ici, mais sans jamais rejoindre
  // CATEGORIES_EQUIPE (lib/equipeCategories.ts) : cette liste est partagée
  // avec l'agenda des médiateurs, qui ne doit jamais afficher ce statut.
  const groupesMediateurs = React.useMemo(() => {
    const formateurs = filteredMediateurs.filter((m) => m.statut === "Formateur");
    const groupes = regrouperParCategorie(filteredMediateurs.filter((m) => m.statut !== "Formateur"));
    if (formateurs.length > 0) {
      const groupeFormateurs = { key: "formateurs", label: "Formateurs", filtre: () => false, membres: formateurs };
      // Juste au-dessus du bloc CIP, quel que soit l'ordre déclaré dans
      // CATEGORIES_EQUIPE.
      const indexCip = groupes.findIndex((g) => g.key === "cip");
      if (indexCip === -1) groupes.push(groupeFormateurs);
      else groupes.splice(indexCip, 0, groupeFormateurs);
    }
    return groupes;
  }, [filteredMediateurs]);

  // Champ CSV toujours entre guillemets (plus simple et sûr que de ne
  // guillemetter qu'au besoin) — norme attendue par l'import Google Contacts.
  const echapperCSV = (valeur: string) => `"${(valeur || "").replace(/"/g, '""')}"`;

  // Format "Google CSV" (celui que Google Contacts sait importer nativement) :
  // seul le staff actif est exporté, et Group Membership combine territoire(s)
  // + statut pour que l'import crée déjà des groupes exploitables côté Google.
  const handleExportContacts = () => {
    const actifs = mediateurs
      .filter((m: any) => m.actif !== false && m.email)
      .sort((a: any, b: any) => (a.nom || "").localeCompare(b.nom || ""));
    const entetes = ["Name", "Given Name", "Family Name", "E-mail 1 - Value", "Phone 1 - Value", "Organization Name", "Organization Title", "Group Membership"];
    const lignes = actifs.map((m: any) => {
      const nomComplet = `${m.prenom || ""} ${m.nom || ""}`.trim();
      const groupes = [...(m.sites || []), m.statut].filter(Boolean).join(" ::: ");
      return [
        nomComplet,
        m.prenom || "",
        m.nom || "",
        m.email || "",
        formatPhoneNumber(m.telephone || "") || "",
        "Colombbus",
        m.poste || "",
        groupes
      ].map(echapperCSV).join(",");
    });
    const contenu = "﻿" + entetes.map(echapperCSV).join(",") + "\n" + lignes.join("\n");
    const blob = new Blob([contenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "contacts_equipe_colombbus.csv");
    link.click();
    URL.revokeObjectURL(url);
  };

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
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              title="Retour à l'accueil"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
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
            <PermissionGuard actionId="equipe_nav_competences">
              <Link
                href="/mediation/competences"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <AcademicCapIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Compétences</span>
              </Link>
            </PermissionGuard>

            <PermissionGuard actionId="equipe_export_contacts">
              <button
                onClick={handleExportContacts}
                title="Télécharge le staff actif au format d'import Google Contacts"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer"
              >
                <ArrowDownTrayIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Exporter (Contacts Google)</span>
              </button>
            </PermissionGuard>

            <PermissionGuard actionId="equipe_add_member">
              <button
                onClick={() => openModal()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md active:scale-95 group"
              >
                <UserPlusIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>Nouveau membre</span>
              </button>
            </PermissionGuard>
          </div>
        </div>

        {/* ACCÈS À CORRIGER — comptes connectés dont la fiche n'est pas encore
            indexée par leur UID (voir handleCorrigerAcces) */}
        <PermissionGuard actionId="equipe_fix_access">
          {migrationsRequises.length > 0 && (
            <div className="p-4 bg-[#F9945D]/10 border border-[#F9945D]/30 rounded-2xl space-y-2 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#EA601F]">
                <KeyIcon className="w-4 h-4" />
                <span>{migrationsRequises.length} accès à corriger</span>
              </div>
              <div className="space-y-1.5">
                {migrationsRequises.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 bg-white border border-[#F9945D]/30 rounded-xl px-3 py-2">
                    <span className="text-xs text-[#404040] font-mono">{m.email}</span>
                    <button
                      onClick={() => handleCorrigerAcces(m)}
                      className="px-3 py-1 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors shrink-0"
                    >
                      Corriger l'accès
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PermissionGuard>

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
                      <PermissionGuard actionId="equipe_territory_manage">
                        <button type="button" onClick={() => handleSupprimerTerritoire(t)} className="opacity-60 hover:opacity-100 font-normal ml-0.5 cursor-pointer">×</button>
                      </PermissionGuard>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <PermissionGuard actionId="equipe_territory_manage">
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
          </PermissionGuard>
        </div>

        {/* GRILLES HORAIRES ACI — éditées depuis /mediation/parametres, avec les
            autres réglages globaux susceptibles de changer d'une année sur l'autre. */}
        <PermissionGuard actionId="equipe_horaires_aci_edit">
          <Link
            href="/mediation/parametres"
            className="flex items-center gap-2.5 bg-white hover:bg-[#F3F3F2]/60 border border-[#404040]/10 rounded-2xl p-4 shadow-sm transition-all w-fit"
          >
            <ClockIcon className="w-4 h-4 text-[#EA601F]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#005259]">Grilles Horaires ACI (Paris / Massy)</span>
            <span className="text-[10px] text-[#404040]/50 font-medium normal-case">→ Paramètres Généraux</span>
          </Link>
        </PermissionGuard>

        {/* FILTRES & VUES */}
        <PermissionGuard actionId="equipe_display_toggles">
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
        </PermissionGuard>

        {/* LISTING COLLABORATEURS, PAR BLOCS RÉTRACTABLES */}
        <div className="space-y-3">
          {filteredMediateurs.length === 0 ? (
            <div className="text-center py-16 border border-[#404040]/10 rounded-2xl bg-white shadow-sm">
              <p className="text-[#404040]/60 text-xs font-bold uppercase tracking-wider">Aucun collaborateur trouvé.</p>
            </div>
          ) : (
            groupesMediateurs.map((groupe) => (
              <Accordion
                key={groupe.key}
                title={`${groupe.label} (${groupe.membres.length})`}
                open={categoriesOuvertes[groupe.key] ?? true}
                onToggle={() => setCategoriesOuvertes(prev => ({ ...prev, [groupe.key]: !(prev[groupe.key] ?? true) }))}
              >
                {groupe.membres.length === 0 ? (
                  <p className="text-[11px] italic text-[#404040]/40 py-2">Aucun collaborateur dans cette catégorie.</p>
                ) : displayMode === "cartes" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupe.membres.map((m: any) => {
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
                                  <ClockIcon className="w-3.5 h-3.5" /> Réf : {m.rattachementHoraireACI || "Paris"} · {m.dureeHebdoACI === "35h" ? "35h" : "26h"}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <PermissionGuard actionId="equipe_member_actions">
                                <button onClick={() => openModal(m)} title="Modifier" className="p-2 rounded-xl bg-[#F3F3F2] text-[#404040]/70 border border-[#404040]/10 hover:text-[#005259] hover:bg-[#005259]/10 transition-colors cursor-pointer"><PencilSquareIcon className="w-4 h-4" /></button>
                              </PermissionGuard>
                              <PermissionGuard actionId="equipe_member_actions">
                                <button onClick={() => toggleArchive(m)} title="Archiver" className="p-2 rounded-xl bg-[#F3F3F2] text-[#404040]/70 border border-[#404040]/10 hover:text-[#EF736A] hover:bg-[#EF736A]/10 transition-colors cursor-pointer"><ArchiveBoxIcon className="w-4 h-4" /></button>
                              </PermissionGuard>
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
                          {groupe.membres.map((m: any) => {
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
                                  <PermissionGuard actionId="equipe_member_actions">
                                    <button onClick={() => openModal(m)} className="p-1.5 text-[#404040]/60 hover:text-[#005259] mr-1 cursor-pointer"><PencilSquareIcon className="w-4 h-4" /></button>
                                  </PermissionGuard>
                                  <PermissionGuard actionId="equipe_member_actions">
                                    <button onClick={() => toggleArchive(m)} className="p-1.5 text-[#404040]/60 hover:text-[#EF736A] cursor-pointer"><ArchiveBoxIcon className="w-4 h-4" /></button>
                                  </PermissionGuard>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Accordion>
            ))
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
                      <option value="CIP">CIP</option>
                      <option value="Prestataire">Prestataire</option>
                      <option value="Stagiaire">Stagiaire</option>
                      <option value="ACI">ACI</option>
                      <option value="Formateur">Formateur</option>
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

                <label className="flex items-center gap-2 text-xs text-[#404040] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.exclureAgenda}
                    onChange={e => setFormData({ ...formData, exclureAgenda: e.target.checked })}
                    className="w-4 h-4 accent-[#EF736A] cursor-pointer"
                  />
                  Compte générique — exclure entièrement de l'agenda (n'apparaît jamais comme ligne à planifier)
                </label>

                {formData.statut === "ACI" && (
                  <div className="p-3.5 bg-[#F9945D]/10 border border-[#F9945D]/30 rounded-xl space-y-3">
                    <div>
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
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#EA601F] mb-1.5 flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" /> Durée hebdomadaire
                      </label>
                      <select
                        className="w-full p-2.5 bg-white border border-[#F9945D]/40 text-[#404040] rounded-lg outline-none font-bold text-xs"
                        value={formData.dureeHebdoACI}
                        onChange={e => setFormData({...formData, dureeHebdoACI: e.target.value as "26h" | "35h"})}
                      >
                        <option value="26h">26h (mercredi non travaillé, en heures complémentaires)</option>
                        <option value="35h">35h (travaille le mercredi normalement)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* SECTION GESTION DES QUALITÉS */}
                <div className="border-t border-[#404040]/10 pt-4">
                  <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5 flex items-center gap-1">
                    <AcademicCapIcon className="w-4 h-4 text-[#EA601F]" /> Qualités & Compétences (Excel, Word...)
                  </label>
                  
                  <PermissionGuard actionId="equipe_modal_competence">
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
                  </PermissionGuard>

                  {listeQualitesGlobales.length > 0 && (
                    <PermissionGuard actionId="equipe_modal_competence">
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
                    </PermissionGuard>
                  )}

                  <p className="text-[10px] text-[#404040]/70 uppercase font-bold mb-1">Qualités retenues pour ce profil :</p>
                  <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl">
                    {formData.competences.length === 0 ? (
                      <span className="text-[10px] text-[#404040]/40 italic self-center">Aucune qualité sélectionnée</span>
                    ) : (
                      formData.competences.map((comp, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 bg-[#005259]/10 border border-[#005259]/20 text-[#005259] px-2 py-0.5 rounded-md font-medium text-[11px]">
                          {comp}
                          <PermissionGuard actionId="equipe_modal_competence">
                            <button
                              type="button"
                              onClick={() => handleRemoveCompetence(idx)}
                              className="text-[#404040]/50 hover:text-[#EF736A] font-bold ml-1 cursor-pointer"
                            >
                              ×
                            </button>
                          </PermissionGuard>
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
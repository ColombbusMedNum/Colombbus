"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { 
  ShieldCheckIcon, 
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentDuplicateIcon,
  BuildingOfficeIcon,
  UserGroupIcon
} from "@heroicons/react/24/outline";

// Police Quicksand pour toute la page
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Interfaces
interface ActionItem {
  id: string;
  nom: string;
  type: "button" | "Link" | "a" | "select" | "checkbox" | "input" | "submit";
  description: string;
}

interface PageGroup {
  pageName: string;
  route: string;
  filePath: string;
  icon: React.ElementType;
  actions: ActionItem[];
}

// Rôles
const ROLES = [
  { id: "admin", nom: "Administrateur", desc: "Tous les droits d'administration" },
  { id: "mediateur", nom: "Médiateur", desc: "Opérations courantes d'accompagnement" },
  { id: "lecteur", nom: "Lecteur", desc: "Consultation uniquement (lecture seule)" },
  { id: "coordinateur", nom: "Coordinateur", desc: "Suivi global et gestion d'équipe" }
];

// Liste complète des pages et de leurs actions
const PAGES_AND_ACTIONS_DATA: PageGroup[] = [
  {
    pageName: "Accueil",
    route: "/",
    filePath: "app/page.tsx",
    icon: BuildingOfficeIcon,
    actions: [
      { id: "home_logout", nom: "Bouton Déconnexion", type: "button", description: "Déconnecte l'utilisateur et détruit sa session" },
      { id: "home_nav_agenda_med", nom: "Lien Agenda des Médiateurs", type: "Link", description: "Accède au calendrier général du staff" },
      { id: "home_folder_rencontres", nom: "Badge Rencontres Numériques", type: "button", description: "Déploie le dossier des rencontres de terrain" },
      { id: "home_folder_stats", nom: "Badge Statistiques & Bilans", type: "button", description: "Déploie le dossier analytique" },
      { id: "home_nav_liste_benef", nom: "Lien Liste des Bénéficiaires", type: "Link", description: "Accède au répertoire principal des usagers" },
      { id: "home_nav_collectes", nom: "Lien Suivi Collectes Tech", type: "Link", description: "Ouvre le tableau Excel de Collectes Tech" },
      { id: "home_nav_agenda_suresnes", nom: "Lien Agenda Suresnes", type: "Link", description: "Accède à l'agenda du Relais Numérique" },
      { id: "home_nav_emargement_docs", nom: "Lien Émargements & Doc. internes", type: "Link", description: "Accède aux feuilles archivées" },
      { id: "home_nav_emargement_gen", nom: "Lien Générateur d'Émargements", type: "Link", description: "Ouvre l'éditeur de feuilles d'émargement" },
      { id: "home_nav_actions_coll", nom: "Lien Actions Collectives", type: "Link", description: "Accède à la saisie d'ateliers de groupe" },
      { id: "home_nav_stats_glob", nom: "Lien Bilan & Stats Globaux", type: "Link", description: "Accède aux analyses croisées" },
      { id: "home_nav_bilan_suresnes", nom: "Lien Analyse Actions Suresnes", type: "Link", description: "Accède à l'étude d'impact de Suresnes" },
      { id: "home_nav_volume_horaire", nom: "Lien Volume Horaire", type: "Link", description: "Consulte les heures travaillées et coûts RH" },
      { id: "home_nav_admin_droits", nom: "Lien Gérer les Droits", type: "Link", description: "Accède à la configuration de la sécurité (Admin)" }
    ]
  },
  {
    pageName: "Connexion",
    route: "/login",
    filePath: "app/login/page.tsx",
    icon: ShieldCheckIcon,
    actions: [
      { id: "login_submit", nom: "Bouton Valider (Soumettre)", type: "submit", description: "Lance la requête d'authentification Firebase" },
      { id: "login_forgot_password", nom: "Bouton Mot de passe oublié ?", type: "button", description: "Déclenche l'e-mail de réinitialisation" }
    ]
  },
  {
    pageName: "Liste des Bénéficiaires",
    route: "/liste-beneficiaires",
    filePath: "app/liste-beneficiaires/page.tsx",
    icon: UserGroupIcon,
    actions: [
      { id: "benef_search", nom: "Barre de recherche", type: "input", description: "Recherche textuelle dynamique par nom/prénom" },
      { id: "benef_nav_agenda_suresnes", nom: "Lien Agenda Suresnes", type: "Link", description: "Redirection vers l'agenda de Suresnes" },
      { id: "benef_create_new", nom: "Bouton Nouveau Bénéficiaire", type: "button", description: "Génère un profil temporaire et redirige" },
      { id: "benef_filter_alphabet", nom: "Filtres alphabétiques (A-Z)", type: "button", description: "Filtre par première lettre du nom" },
      { id: "benef_filter_today", nom: "Badge Filtre Aujourd'hui", type: "button", description: "Affiche uniquement les inscrits du jour" },
      { id: "benef_filter_suresnes", nom: "Badge Filtre Suresnes", type: "button", description: "Affiche les habitants de Suresnes" },
      { id: "benef_filter_de", nom: "Badge Filtre France Travail (DE)", type: "button", description: "Affiche les demandeurs d'emploi" },
      { id: "benef_filter_blacklist", nom: "Badge Filtre Blacklistés", type: "button", description: "Affiche les profils bloqués" },
      { id: "benef_action_toggle_blacklist", nom: "Bouton Blacklist/Reclasser direct", type: "button", description: "Modifie l'état de blacklistage dans la liste" },
      { id: "benef_action_open", nom: "Bouton Ouvrir Fiche", type: "Link", description: "Navigue vers le profil du bénéficiaire" }
    ]
  },
  {
    pageName: "Fiche Bénéficiaire (Détails)",
    route: "/liste-beneficiaires/[id]",
    filePath: "app/liste-beneficiaires/[id]/page.tsx",
    icon: UserGroupIcon,
    actions: [
      { id: "fiche_edit_profil", nom: "Bouton Éditer/Compléter le profil", type: "button", description: "Ouvre la modale des infos personnelles" },
      { id: "fiche_nav_diagnostic", nom: "Lien Remplir un questionnaire", type: "Link", description: "Accède au formulaire d'évaluation/diagnostic" },
      { id: "fiche_add_action", nom: "Bouton Enregistrer l'action", type: "submit", description: "Ajoute une visite de suivi (formulaire)" },
      { id: "fiche_action_change_lieu", nom: "Boutons Corriger/Ajouter un lieu", type: "button", description: "Gère les lieux de rencontre" },
      { id: "fiche_action_edit_rdv", nom: "Bouton Modifier RDV (ligne)", type: "button", description: "Active l'édition inline d'une visite" },
      { id: "fiche_action_delete_rdv", nom: "Bouton Supprimer RDV (ligne)", type: "button", description: "Efface définitivement un rendez-vous" },
      { id: "fiche_modal_toggle_blacklist", nom: "Sélecteur Blacklist (Modale)", type: "select", description: "Bascule la blacklist dans l'édition" },
      { id: "fiche_modal_submit", nom: "Bouton Enregistrer profil (Modale)", type: "submit", description: "Sauvegarde les informations du profil" }
    ]
  },
  {
    pageName: "Formulaire Diagnostic",
    route: "/diagnosticform",
    filePath: "app/diagnosticform/page.tsx",
    icon: DocumentDuplicateIcon,
    actions: [
      { id: "diag_select_type", nom: "Boutons Choix Diagnostic (Initial/Final/Collecte)", type: "button", description: "Définit le type de grille de questions" },
      { id: "diag_start", nom: "Bouton Démarrer", type: "button", description: "Débute la session de questions" },
      { id: "diag_nav_questions", nom: "Boutons Précédent / Suivant", type: "button", description: "Navigue dans les étapes du QCM" },
      { id: "diag_choose_option", nom: "Boutons de choix de réponse (Option)", type: "button", description: "Valide une réponse et incrémente le score" },
      { id: "diag_rate_satisfaction", nom: "Boutons d'évaluation (1-5 étoiles)", type: "button", description: "Note la satisfaction d'accompagnement" },
      { id: "diag_submit", nom: "Bouton Terminer et Enregistrer", type: "submit", description: "Calcule les scores et stocke dans Firestore" }
    ]
  },
  {
    pageName: "Actions Collectives",
    route: "/actions-collectives",
    filePath: "app/actions-collectives/page.tsx",
    icon: DocumentDuplicateIcon,
    actions: [
      { id: "coll_toggle_form", nom: "Bouton Saisir un Atelier / Fermer", type: "button", description: "Affiche/masque le formulaire de saisie" },
      { id: "coll_submit", nom: "Bouton Valider l'action (Formulaire)", type: "submit", description: "Enregistre l'atelier collectif" },
      { id: "coll_edit", nom: "Boutons Modifier / Supprimer (Tableau)", type: "button", description: "Gère les lignes d'actions de groupe" }
    ]
  },
  {
    pageName: "Agenda des Médiateurs",
    route: "/activites_types",
    filePath: "app/activites_types/page.tsx",
    icon: ShieldCheckIcon,
    actions: [
      { id: "agenda_toggle_sidebar", nom: "Bouton Masquer/Afficher Sidebar", type: "button", description: "Gère la visibilité des modèles" },
      { id: "agenda_validate_week", nom: "Bouton Valider/Déverrouiller Semaine", type: "button", description: "Verrouille la grille hebdomadaire" },
      { id: "agenda_notif_panel", nom: "Boutons Notifications (Bell, Tout lire, Effacer)", type: "button", description: "Gère le mini-panneau des alertes" },
      { id: "agenda_week_nav", nom: "Boutons Semaine (Précédente / Suivante)", type: "button", description: "Décale le planning de 7 jours" },
      { id: "agenda_display_toggles", nom: "Boutons Filtres Affichage (Samedi, Masqués)", type: "button", description: "Modifie la structure de la grille de temps" },
      { id: "agenda_model_create", nom: "Bouton Créer un modèle", type: "button", description: "Ouvre l'éditeur d'activité type" },
      { id: "agenda_model_actions", nom: "Boutons Éditer/Supprimer Modèle", type: "button", description: "Gère les modèles dans la sidebar" },
      { id: "agenda_grid_interaction", nom: "Clics Grille (Ajouter, Supprimer, Commenter)", type: "button", description: "Modifie directement les cases horaires" },
      { id: "agenda_staff_mask", nom: "Bouton Masquer/Engrenage Staff", type: "button", description: "Masque un membre ou édite ses heures ACI" }
    ]
  },
  {
    pageName: "Suivi Collecte Tech",
    route: "/suivi-collecte",
    filePath: "app/suivi-collecte/page.tsx",
    icon: DocumentDuplicateIcon,
    actions: [
      { id: "collecte_export", nom: "Bouton Exporter au format Excel (.csv)", type: "button", description: "Télécharge le fichier de suivi centralisé" },
      { id: "collecte_change_year", nom: "Sélecteur d'Année (Ligne)", type: "select", description: "Modifie l'année fiscale de suivi d'un dossier" },
      { id: "collecte_toggle_step", nom: "Cases à cocher étapes (Drive, Devis, Facture...)", type: "checkbox", description: "Coche les avancées administratives" },
      { id: "collecte_comment_edit", nom: "Cellule Commentaires (Édition/Enregistrement)", type: "checkbox", description: "Clic pour éditer inline et Blur pour sauver" }
    ]
  },
  {
    pageName: "Agenda Suresnes",
    route: "/suresnes",
    filePath: "app/suresnes/page.tsx",
    icon: ShieldCheckIcon,
    actions: [
      { id: "suresnes_filter_today", nom: "Bouton Aujourd'hui uniquement", type: "button", description: "Isole les rendez-vous du jour" },
      { id: "suresnes_month_nav", nom: "Boutons Mois (Précédent / Suivant)", type: "button", description: "Navigation calendaire mensuelle" },
      { id: "suresnes_reassign", nom: "Bouton Réaffecter médiateur", type: "button", description: "Attribue un créneau orphelin à un staff" },
      { id: "suresnes_create_slot", nom: "Boutons Créer Créneau / Annuler (Modale)", type: "submit", description: "Sauvegarde un nouveau rendez-vous" }
    ]
  },
  {
    pageName: "Gestion de l'Équipe",
    route: "/equipe",
    filePath: "app/equipe/page.tsx",
    icon: UserGroupIcon,
    actions: [
      { id: "equipe_add_member", nom: "Bouton Ajouter un membre", type: "button", description: "Ouvre le formulaire d'inscription RH" },
      { id: "equipe_territory_manage", nom: "Boutons Ajouter / Supprimer Territoire", type: "button", description: "Configure les zones globales" },
      { id: "equipe_display_toggles", nom: "Boutons Onglets (Actifs/Archives) & Vues (Cartes/Listes)", type: "button", description: "Gère l'affichage du personnel" },
      { id: "equipe_member_actions", nom: "Boutons Éditer / Archiver (Membre)", type: "button", description: "Actions sur les fiches de staff" },
      { id: "equipe_modal_competence", nom: "Boutons + / Qualités Rapides / X (Modale)", type: "button", description: "Gère les tags de compétences du membre" }
    ]
  }
];

// Mapping par défaut des droits
const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin: PAGES_AND_ACTIONS_DATA.reduce((acc, page) => {
    page.actions.forEach(act => { acc[act.id] = true; });
    return acc;
  }, {} as Record<string, boolean>),
  
  mediateur: {
    "home_logout": true, "home_folder_rencontres": true, "home_folder_stats": true, "home_nav_liste_benef": true,
    "home_nav_collectes": true, "home_nav_agenda_suresnes": true, "home_nav_emargement_docs": true, 
    "home_nav_emargement_gen": true, "home_nav_actions_coll": true, "home_nav_stats_glob": true,
    "login_submit": true, "login_forgot_password": true,
    "benef_search": true, "benef_nav_agenda_suresnes": true, "benef_create_new": true, "benef_filter_alphabet": true,
    "benef_filter_today": true, "benef_filter_suresnes": true, "benef_filter_de": true, "benef_action_open": true,
    "fiche_edit_profil": true, "fiche_nav_diagnostic": true, "fiche_add_action": true, "fiche_action_change_lieu": true,
    "fiche_action_edit_rdv": true, "fiche_modal_submit": true,
    "diag_select_type": true, "diag_start": true, "diag_nav_questions": true, "diag_choose_option": true,
    "diag_rate_satisfaction": true, "diag_submit": true,
    "coll_toggle_form": true, "coll_submit": true, "coll_edit": true,
    "agenda_toggle_sidebar": true, "agenda_notif_panel": true, "agenda_week_nav": true, "agenda_display_toggles": true,
    "agenda_grid_interaction": true,
    "collecte_change_year": true, "collecte_toggle_step": true, "collecte_comment_edit": true,
    "suresnes_filter_today": true, "suresnes_month_nav": true, "suresnes_create_slot": true
  },

  lecteur: {
    "home_logout": true, "home_folder_rencontres": true, "home_folder_stats": true, "home_nav_liste_benef": true,
    "home_nav_collectes": true, "home_nav_agenda_suresnes": true, "home_nav_emargement_docs": true, 
    "home_nav_actions_coll": true, "home_nav_stats_glob": true, "home_nav_bilan_suresnes": true, "home_nav_volume_horaire": true,
    "login_submit": true,
    "benef_search": true, "benef_nav_agenda_suresnes": true, "benef_filter_alphabet": true,
    "benef_filter_today": true, "benef_filter_suresnes": true, "benef_filter_de": true, "benef_action_open": true,
    "suresnes_filter_today": true, "suresnes_month_nav": true
  },

  coordinateur: {
    "home_logout": true, "home_folder_rencontres": true, "home_folder_stats": true, "home_nav_liste_benef": true,
    "home_nav_collectes": true, "home_nav_agenda_suresnes": true, "home_nav_emargement_docs": true, 
    "home_nav_emargement_gen": true, "home_nav_actions_coll": true, "home_nav_stats_glob": true,
    "home_nav_bilan_suresnes": true, "home_nav_volume_horaire": true, "home_nav_agenda_med": true,
    "login_submit": true, "login_forgot_password": true,
    "benef_search": true, "benef_nav_agenda_suresnes": true, "benef_create_new": true, "benef_filter_alphabet": true,
    "benef_filter_today": true, "benef_filter_suresnes": true, "benef_filter_de": true, "benef_filter_blacklist": true,
    "benef_action_toggle_blacklist": true, "benef_action_open": true,
    "fiche_edit_profil": true, "fiche_nav_diagnostic": true, "fiche_add_action": true, "fiche_action_change_lieu": true,
    "fiche_action_edit_rdv": true, "fiche_action_delete_rdv": true, "fiche_modal_toggle_blacklist": true, "fiche_modal_submit": true,
    "diag_select_type": true, "diag_start": true, "diag_nav_questions": true, "diag_choose_option": true,
    "diag_rate_satisfaction": true, "diag_submit": true,
    "coll_toggle_form": true, "coll_submit": true, "coll_edit": true,
    "agenda_toggle_sidebar": true, "agenda_validate_week": true, "agenda_notif_panel": true, "agenda_week_nav": true, 
    "agenda_display_toggles": true, "agenda_model_create": true, "agenda_model_actions": true, "agenda_grid_interaction": true,
    "agenda_staff_mask": true,
    "collecte_export": true, "collecte_change_year": true, "collecte_toggle_step": true, "collecte_comment_edit": true,
    "suresnes_filter_today": true, "suresnes_month_nav": true, "suresnes_reassign": true, "suresnes_create_slot": true,
    "equipe_add_member": true, "equipe_territory_manage": true, "equipe_display_toggles": true, "equipe_member_actions": true, "equipe_modal_competence": true
  }
};

export default function AnalyseDroitsPage() {
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [search, setSearch] = useState("");
  const [selectedPageFilter, setSelectedPageFilter] = useState("all");
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    const savedMatrix = localStorage.getItem("matrix_droits_analyse");
    if (savedMatrix) {
      try {
        setMatrix(JSON.parse(savedMatrix));
      } catch (err) {
        setMatrix(DEFAULT_PERMISSIONS);
      }
    } else {
      setMatrix(DEFAULT_PERMISSIONS);
    }
  }, []);

  const saveMatrix = (newMatrix: Record<string, Record<string, boolean>>) => {
    setMatrix(newMatrix);
    localStorage.setItem("matrix_droits_analyse", JSON.stringify(newMatrix));
    setSaveStatus("💾 Modifications enregistrées");
    setTimeout(() => setSaveStatus(""), 2500);
  };

  const handleCheckboxChange = (actionId: string, roleId: string, isChecked: boolean) => {
    const updatedMatrix = {
      ...matrix,
      [roleId]: {
        ...(matrix[roleId] || {}),
        [actionId]: isChecked
      }
    };
    saveMatrix(updatedMatrix);
  };

  const handleResetDefaults = () => {
    if (window.confirm("Voulez-vous réinitialiser tous les droits aux valeurs recommandées ?")) {
      saveMatrix(DEFAULT_PERMISSIONS);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(matrix, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "matrice_droits_analyse.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        const isValid = ROLES.every(role => importedData[role.id] && typeof importedData[role.id] === "object");
        if (isValid) {
          saveMatrix(importedData);
          alert("✅ Import réussi avec succès !");
        } else {
          alert("❌ Format de fichier invalide.");
        }
      } catch (err) {
        alert("❌ Erreur lors de la lecture du fichier JSON.");
      }
    };
    reader.readAsText(file);
  };

  const filteredPages = PAGES_AND_ACTIONS_DATA.map(page => {
    if (selectedPageFilter !== "all" && page.pageName !== selectedPageFilter) {
      return null;
    }

    const filteredActions = page.actions.filter(action => 
      action.nom.toLowerCase().includes(search.toLowerCase()) ||
      action.description.toLowerCase().includes(search.toLowerCase()) ||
      action.id.toLowerCase().includes(search.toLowerCase())
    );

    if (filteredActions.length === 0) return null;

    return {
      ...page,
      actions: filteredActions
    };
  }).filter(Boolean) as PageGroup[];

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      
      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        
        {/* EN-TÊTE ET BOUTONS DE NAVIGATION */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Matrice des droits <span className="text-[#EA601F] font-semibold">d'accès</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Analyse exhaustive des éléments d'interface par rôle utilisateur
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {saveStatus && (
              <span className="text-[#EA601F] font-bold text-xs mr-2 animate-pulse">{saveStatus}</span>
            )}

            <Link 
              href="/" 
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>

            <button 
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer"
            >
              <ArrowPathIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Réinitialiser</span>
            </button>

            <button 
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer"
            >
              <ArrowDownTrayIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Exporter</span>
            </button>

            <label className="flex items-center gap-1.5 bg-[#EA601F] hover:bg-[#EF736A] text-white px-3.5 py-2 rounded-xl transition-all text-xs font-bold uppercase tracking-wider shadow-md cursor-pointer active:scale-95">
              <ArrowUpTrayIcon className="w-4 h-4" />
              <span>Importer</span>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>
        </div>

        {/* CARTES RÔLES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ROLES.map(role => (
            <div key={role.id} className="bg-white border border-[#404040]/10 p-4 rounded-2xl shadow-sm">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-white bg-[#005259] px-2.5 py-1 rounded-lg mb-2 shadow-sm">
                {role.nom}
              </span>
              <p className="text-xs text-[#404040]/80 leading-relaxed font-medium">{role.desc}</p>
            </div>
          ))}
        </div>

        {/* BARRE DE RECHERCHE ET FILTRES DE PAGE */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-4 w-4 text-[#404040]/40 group-focus-within:text-[#EA601F] transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Rechercher une action ou un bouton..."
              className="block w-full pl-10 pr-4 py-2.5 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl text-xs text-[#404040] placeholder-[#404040]/50 focus:outline-none focus:border-[#EA601F] focus:ring-1 focus:ring-[#EA601F] transition-all font-medium"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-[10px] font-bold text-[#005259] uppercase tracking-widest shrink-0">
              Filtrer par page :
            </span>
            <select
              value={selectedPageFilter}
              onChange={e => setSelectedPageFilter(e.target.value)}
              className="bg-[#F3F3F2] border border-[#404040]/10 rounded-xl px-3 py-2 text-xs font-bold text-[#005259] outline-none focus:border-[#EA601F] transition-all cursor-pointer w-full md:w-64"
            >
              <option value="all">Toutes les pages</option>
              {PAGES_AND_ACTIONS_DATA.map(page => (
                <option key={page.pageName} value={page.pageName}>{page.pageName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLES PAR PAGE */}
        <div className="space-y-6">
          {filteredPages.length > 0 ? (
            filteredPages.map((page) => {
              const PageIcon = page.icon;
              return (
                <div key={page.pageName} className="bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
                  {/* En-tête de Section Carte */}
                  <div className="p-4 border-b border-[#404040]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F3F3F2]/60">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl border border-[#005259]/20 bg-white text-[#EA601F]">
                        <PageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold uppercase text-[#005259] tracking-tight">
                          {page.pageName}
                        </h2>
                        <span className="text-[11px] font-mono text-[#404040]/70">{page.route} • {page.filePath}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tableau du Contenu */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                          <th className="py-3 px-6 w-1/3">Élément / Action</th>
                          <th className="py-3 px-4 text-center w-28">Type</th>
                          {ROLES.map(role => (
                            <th key={role.id} className="py-3 px-4 text-center w-28">{role.nom}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#404040]/10">
                        {page.actions.map((action) => (
                          <tr key={action.id} className="hover:bg-[#F3F3F2]/50 transition-colors group">
                            <td className="py-3.5 px-6">
                              <span className="block text-xs font-bold text-[#005259] group-hover:text-[#EA601F] transition-colors">{action.nom}</span>
                              <span className="block text-xs text-[#404040]/80 font-medium mt-0.5">{action.description}</span>
                              <span className="inline-block text-[10px] font-mono text-[#404040]/50 mt-1">{action.id}</span>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-block text-[10px] font-mono font-bold bg-[#005259]/10 border border-[#005259]/20 px-2.5 py-1 rounded-md text-[#005259] uppercase">
                                {action.type}
                              </span>
                            </td>

                            {ROLES.map(role => {
                              const estCoche = !!matrix[role.id]?.[action.id];
                              return (
                                <td key={role.id} className="py-3.5 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleCheckboxChange(action.id, role.id, !estCoche)}
                                    className={`p-1.5 rounded-xl border transition-all inline-flex items-center justify-center cursor-pointer ${
                                      estCoche
                                        ? "bg-[#EA601F]/15 border-[#EA601F]/40 text-[#EA601F] hover:bg-[#EA601F]/25"
                                        : "bg-[#F3F3F2] border-[#404040]/10 text-[#404040]/30 hover:text-[#404040]/60"
                                    }`}
                                  >
                                    {estCoche ? (
                                      <CheckCircleIcon className="w-5 h-5" />
                                    ) : (
                                      <XCircleIcon className="w-5 h-5" />
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white border border-[#404040]/10 rounded-2xl p-12 text-center text-[#404040]/70 text-xs font-bold uppercase tracking-wider shadow-sm">
              🔍 Aucun résultat pour ce filtre ou cette recherche.
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
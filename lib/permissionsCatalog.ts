// Catalogue centralisé des pages et des actions (boutons/liens) de la plateforme.
// C'est la SEULE source consommée par /analyse (édition de la matrice), par
// <PageGuard> (contrôle d'accès à une page entière) et par <PermissionGuard>
// (contrôle d'un bouton/lien précis). Avant cette centralisation, /analyse et
// /admin/droits avaient chacune leur propre catalogue divergent.

export interface ActionItem {
  id: string;
  nom: string;
  type: "button" | "Link" | "a" | "select" | "checkbox" | "input" | "submit";
  description: string;
}

export interface PageEntry {
  pageId: string; // actionId de niveau page, ex "page_access_home" — consommé par <PageGuard>
  pageName: string;
  route: string;
  filePath: string;
  actions: ActionItem[];
}

// Pages pour lesquelles l'inventaire détaillé des boutons/liens a été fait.
// Pour les autres routes de l'app (voir PAGE_ONLY_ROUTES plus bas), seul le
// contrôle d'accès à la page entière est catalogué pour l'instant — le détail
// des actions pourra être ajouté au même endroit au fil de l'eau.
const DETAILED_PAGES: PageEntry[] = [
  {
    pageId: "page_access_home",
    pageName: "Accueil",
    route: "/",
    filePath: "app/page.tsx",
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
      { id: "home_nav_admin_droits", nom: "Lien Gérer les Droits", type: "Link", description: "Accède à la configuration de la sécurité (Admin)" },
    ],
  },
  {
    pageId: "page_access_login",
    pageName: "Connexion",
    route: "/login",
    filePath: "app/login/page.tsx",
    actions: [
      { id: "login_submit", nom: "Bouton Valider (Soumettre)", type: "submit", description: "Lance la requête d'authentification Firebase" },
      { id: "login_forgot_password", nom: "Bouton Mot de passe oublié ?", type: "button", description: "Déclenche l'e-mail de réinitialisation" },
    ],
  },
  {
    pageId: "page_access_liste_beneficiaires",
    pageName: "Liste des Bénéficiaires",
    route: "/liste-beneficiaires",
    filePath: "app/liste-beneficiaires/page.tsx",
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
      { id: "benef_action_open", nom: "Bouton Ouvrir Fiche", type: "Link", description: "Navigue vers le profil du bénéficiaire" },
    ],
  },
  {
    pageId: "page_access_fiche_beneficiaire",
    pageName: "Fiche Bénéficiaire (Détails)",
    route: "/liste-beneficiaires/[id]",
    filePath: "app/liste-beneficiaires/[id]/page.tsx",
    actions: [
      { id: "fiche_edit_profil", nom: "Bouton Éditer/Compléter le profil", type: "button", description: "Ouvre la modale des infos personnelles" },
      { id: "fiche_nav_diagnostic", nom: "Lien Remplir un questionnaire", type: "Link", description: "Accède au formulaire d'évaluation/diagnostic" },
      { id: "fiche_add_action", nom: "Bouton Enregistrer l'action", type: "submit", description: "Ajoute une visite de suivi (formulaire)" },
      { id: "fiche_action_change_lieu", nom: "Boutons Corriger/Ajouter un lieu", type: "button", description: "Gère les lieux de rencontre" },
      { id: "fiche_action_edit_rdv", nom: "Bouton Modifier RDV (ligne)", type: "button", description: "Active l'édition inline d'une visite" },
      { id: "fiche_action_delete_rdv", nom: "Bouton Supprimer RDV (ligne)", type: "button", description: "Efface définitivement un rendez-vous" },
      { id: "fiche_modal_toggle_blacklist", nom: "Sélecteur Blacklist (Modale)", type: "select", description: "Bascule la blacklist dans l'édition" },
      { id: "fiche_modal_submit", nom: "Bouton Enregistrer profil (Modale)", type: "submit", description: "Sauvegarde les informations du profil" },
    ],
  },
  {
    pageId: "page_access_diagnosticform",
    pageName: "Formulaire Diagnostic",
    route: "/diagnosticform",
    filePath: "app/diagnosticform/page.tsx",
    actions: [
      { id: "diag_select_type", nom: "Boutons Choix Diagnostic (Initial/Final/Collecte)", type: "button", description: "Définit le type de grille de questions" },
      { id: "diag_start", nom: "Bouton Démarrer", type: "button", description: "Débute la session de questions" },
      { id: "diag_nav_questions", nom: "Boutons Précédent / Suivant", type: "button", description: "Navigue dans les étapes du QCM" },
      { id: "diag_choose_option", nom: "Boutons de choix de réponse (Option)", type: "button", description: "Valide une réponse et incrémente le score" },
      { id: "diag_rate_satisfaction", nom: "Boutons d'évaluation (1-5 étoiles)", type: "button", description: "Note la satisfaction d'accompagnement" },
      { id: "diag_submit", nom: "Bouton Terminer et Enregistrer", type: "submit", description: "Calcule les scores et stocke dans Firestore" },
    ],
  },
  {
    pageId: "page_access_actions_collectives",
    pageName: "Actions Collectives",
    route: "/actions-collectives",
    filePath: "app/actions-collectives/page.tsx",
    actions: [
      { id: "coll_toggle_form", nom: "Bouton Saisir un Atelier / Fermer", type: "button", description: "Affiche/masque le formulaire de saisie" },
      { id: "coll_submit", nom: "Bouton Valider l'action (Formulaire)", type: "submit", description: "Enregistre l'atelier collectif" },
      { id: "coll_edit", nom: "Boutons Modifier / Supprimer (Tableau)", type: "button", description: "Gère les lignes d'actions de groupe" },
    ],
  },
  {
    pageId: "page_access_agenda",
    pageName: "Agenda des Médiateurs",
    route: "/agenda",
    filePath: "app/agenda/page.tsx",
    actions: [
      { id: "agenda_toggle_sidebar", nom: "Bouton Masquer/Afficher Sidebar", type: "button", description: "Gère la visibilité des modèles" },
      { id: "agenda_validate_week", nom: "Bouton Valider/Déverrouiller Semaine", type: "button", description: "Verrouille la grille hebdomadaire" },
      { id: "agenda_notif_panel", nom: "Boutons Notifications (Bell, Tout lire, Effacer)", type: "button", description: "Gère le mini-panneau des alertes" },
      { id: "agenda_week_nav", nom: "Boutons Semaine (Précédente / Suivante)", type: "button", description: "Décale le planning de 7 jours" },
      { id: "agenda_display_toggles", nom: "Boutons Filtres Affichage (Samedi, Masqués)", type: "button", description: "Modifie la structure de la grille de temps" },
      { id: "agenda_model_create", nom: "Bouton Créer un modèle", type: "button", description: "Ouvre l'éditeur d'activité type" },
      { id: "agenda_model_actions", nom: "Boutons Éditer/Supprimer Modèle", type: "button", description: "Gère les modèles dans la sidebar" },
      { id: "agenda_grid_interaction", nom: "Clics Grille (Ajouter, Supprimer, Commenter)", type: "button", description: "Modifie directement les cases horaires" },
      { id: "agenda_staff_mask", nom: "Bouton Masquer/Engrenage Staff", type: "button", description: "Masque un membre ou édite ses heures ACI" },
    ],
  },
  {
    pageId: "page_access_suivi_collecte",
    pageName: "Suivi Collecte Tech",
    route: "/suivi-collecte",
    filePath: "app/suivi-collecte/page.tsx",
    actions: [
      { id: "collecte_export", nom: "Bouton Exporter au format Excel (.csv)", type: "button", description: "Télécharge le fichier de suivi centralisé" },
      { id: "collecte_change_year", nom: "Sélecteur d'Année (Ligne)", type: "select", description: "Modifie l'année fiscale de suivi d'un dossier" },
      { id: "collecte_toggle_step", nom: "Cases à cocher étapes (Drive, Devis, Facture...)", type: "checkbox", description: "Coche les avancées administratives" },
      { id: "collecte_comment_edit", nom: "Cellule Commentaires (Édition/Enregistrement)", type: "checkbox", description: "Clic pour éditer inline et Blur pour sauver" },
    ],
  },
  {
    pageId: "page_access_suresnes",
    pageName: "Agenda Suresnes",
    route: "/suresnes",
    filePath: "app/suresnes/page.tsx",
    actions: [
      { id: "suresnes_filter_today", nom: "Bouton Aujourd'hui uniquement", type: "button", description: "Isole les rendez-vous du jour" },
      { id: "suresnes_month_nav", nom: "Boutons Mois (Précédent / Suivant)", type: "button", description: "Navigation calendaire mensuelle" },
      { id: "suresnes_reassign", nom: "Bouton Réaffecter médiateur", type: "button", description: "Attribue un créneau orphelin à un staff" },
      { id: "suresnes_create_slot", nom: "Boutons Créer Créneau / Annuler (Modale)", type: "submit", description: "Sauvegarde un nouveau rendez-vous" },
    ],
  },
  {
    pageId: "page_access_equipe",
    pageName: "Gestion de l'Équipe",
    route: "/equipe",
    filePath: "app/equipe/page.tsx",
    actions: [
      { id: "equipe_add_member", nom: "Bouton Ajouter un membre", type: "button", description: "Ouvre le formulaire d'inscription RH" },
      { id: "equipe_territory_manage", nom: "Boutons Ajouter / Supprimer Territoire", type: "button", description: "Configure les zones globales" },
      { id: "equipe_display_toggles", nom: "Boutons Onglets (Actifs/Archives) & Vues (Cartes/Listes)", type: "button", description: "Gère l'affichage du personnel" },
      { id: "equipe_member_actions", nom: "Boutons Éditer / Archiver (Membre)", type: "button", description: "Actions sur les fiches de staff" },
      { id: "equipe_modal_competence", nom: "Boutons + / Qualités Rapides / X (Modale)", type: "button", description: "Gère les tags de compétences du membre" },
    ],
  },
];

// Routes restantes de l'app, cataloguées seulement au niveau page pour
// l'instant (pas encore d'inventaire détaillé des boutons). <PageGuard>
// fonctionne dès aujourd'hui pour elles ; le détail des actions pourra être
// ajouté ici au même titre que DETAILED_PAGES au fil de l'eau.
const PAGE_ONLY_ROUTES: Omit<PageEntry, "actions">[] = [
  { pageId: "page_access_analyse", pageName: "Matrice des droits (Analyse)", route: "/analyse", filePath: "app/analyse/page.tsx" },
  { pageId: "page_access_admin_droits", pageName: "Gestion des Droits (Admin)", route: "/admin/droits", filePath: "app/admin/droits/page.tsx" },
  { pageId: "page_access_beneficiaires", pageName: "Bénéficiaires (legacy)", route: "/beneficiaires", filePath: "app/beneficiaires/page.tsx" },
  { pageId: "page_access_mediateurs", pageName: "Médiateurs", route: "/mediateurs", filePath: "app/mediateurs/page.tsx" },
  { pageId: "page_access_diagnostic_detail", pageName: "Diagnostic (Détail)", route: "/diagnostic/[id]", filePath: "app/diagnostic/[id]/page.tsx" },
  { pageId: "page_access_localisations", pageName: "Localisations", route: "/localisations", filePath: "app/localisations/page.tsx" },
  { pageId: "page_access_rdv_par_lieu", pageName: "Rendez-vous par lieu", route: "/rendez-vous-par-lieu", filePath: "app/rendez-vous-par-lieu/page.tsx" },
  { pageId: "page_access_bilan_tech", pageName: "Bilan Tech", route: "/bilan_tech", filePath: "app/bilan_tech/page.tsx" },
  { pageId: "page_access_emargement", pageName: "Émargement", route: "/emargement", filePath: "app/emargement/page.tsx" },
  { pageId: "page_access_emargements", pageName: "Émargements", route: "/emargements", filePath: "app/emargements/page.tsx" },
  { pageId: "page_access_adresses", pageName: "Adresses", route: "/adresses", filePath: "app/adresses/page.tsx" },
  { pageId: "page_access_competences", pageName: "Compétences", route: "/competences", filePath: "app/competences/page.tsx" },
  { pageId: "page_access_statistiques", pageName: "Statistiques", route: "/statistiques", filePath: "app/statistiques/page.tsx" },
  { pageId: "page_access_bilan_suresnes", pageName: "Bilan Suresnes", route: "/bilan-suresnes", filePath: "app/bilan-suresnes/page.tsx" },
  { pageId: "page_access_volume_horaire", pageName: "Volume Horaire", route: "/volume-horaire", filePath: "app/volume-horaire/page.tsx" },
  { pageId: "page_access_fiches_bilans", pageName: "Fiches Bilans", route: "/fiches-bilans", filePath: "app/fiches-bilans/page.tsx" },
  { pageId: "page_access_fiches_bilans_historique", pageName: "Fiches Bilans (Historique)", route: "/fiches-bilans/historique", filePath: "app/fiches-bilans/historique/page.tsx" },
  { pageId: "page_access_notifications", pageName: "Notifications", route: "/notifications", filePath: "app/notifications/page.tsx" },
  { pageId: "page_access_bibliotheque_logos", pageName: "Bibliothèque de logos", route: "/bibliotheque-logos", filePath: "app/bibliotheque-logos/page.tsx" },
];

export const PAGES_CATALOG: PageEntry[] = [
  ...DETAILED_PAGES,
  ...PAGE_ONLY_ROUTES.map((p) => ({ ...p, actions: [] as ActionItem[] })),
];

// Tous les actionId connus (pages + boutons), utilisé pour initialiser une
// matrice complète dans Firestore et pour valider les imports/exports.
export const ALL_ACTION_IDS: string[] = PAGES_CATALOG.flatMap((page) => [
  page.pageId,
  ...page.actions.map((a) => a.id),
]);

// Droits par défaut, utilisés uniquement pour amorcer la matrice Firestore
// (configuration_droits) la première fois qu'elle est vide. Une fois créée,
// c'est la matrice Firestore qui fait foi et qui est éditable dans /analyse.
export const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin: ALL_ACTION_IDS.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {} as Record<string, boolean>),

  mediateur: {
    page_access_home: true, page_access_login: true, page_access_liste_beneficiaires: true,
    page_access_fiche_beneficiaire: true, page_access_diagnosticform: true, page_access_actions_collectives: true,
    page_access_agenda: true, page_access_suivi_collecte: true, page_access_suresnes: true,
    home_logout: true, home_folder_rencontres: true, home_folder_stats: true, home_nav_liste_benef: true,
    home_nav_collectes: true, home_nav_agenda_suresnes: true, home_nav_emargement_docs: true,
    home_nav_emargement_gen: true, home_nav_actions_coll: true, home_nav_stats_glob: true,
    login_submit: true, login_forgot_password: true,
    benef_search: true, benef_nav_agenda_suresnes: true, benef_create_new: true, benef_filter_alphabet: true,
    benef_filter_today: true, benef_filter_suresnes: true, benef_filter_de: true, benef_action_open: true,
    fiche_edit_profil: true, fiche_nav_diagnostic: true, fiche_add_action: true, fiche_action_change_lieu: true,
    fiche_action_edit_rdv: true, fiche_modal_submit: true,
    diag_select_type: true, diag_start: true, diag_nav_questions: true, diag_choose_option: true,
    diag_rate_satisfaction: true, diag_submit: true,
    coll_toggle_form: true, coll_submit: true, coll_edit: true,
    agenda_toggle_sidebar: true, agenda_notif_panel: true, agenda_week_nav: true, agenda_display_toggles: true,
    agenda_grid_interaction: true,
    collecte_change_year: true, collecte_toggle_step: true, collecte_comment_edit: true,
    suresnes_filter_today: true, suresnes_month_nav: true, suresnes_create_slot: true,
  },

  lecteur: {
    page_access_home: true, page_access_login: true, page_access_liste_beneficiaires: true, page_access_suresnes: true,
    home_logout: true, home_folder_rencontres: true, home_folder_stats: true, home_nav_liste_benef: true,
    home_nav_collectes: true, home_nav_agenda_suresnes: true, home_nav_emargement_docs: true,
    home_nav_actions_coll: true, home_nav_stats_glob: true, home_nav_bilan_suresnes: true, home_nav_volume_horaire: true,
    login_submit: true,
    benef_search: true, benef_nav_agenda_suresnes: true, benef_filter_alphabet: true,
    benef_filter_today: true, benef_filter_suresnes: true, benef_filter_de: true, benef_action_open: true,
    suresnes_filter_today: true, suresnes_month_nav: true,
  },

  coordinateur: {
    page_access_home: true, page_access_login: true, page_access_liste_beneficiaires: true,
    page_access_fiche_beneficiaire: true, page_access_diagnosticform: true, page_access_actions_collectives: true,
    page_access_agenda: true, page_access_suivi_collecte: true, page_access_suresnes: true, page_access_equipe: true,
    home_logout: true, home_folder_rencontres: true, home_folder_stats: true, home_nav_liste_benef: true,
    home_nav_collectes: true, home_nav_agenda_suresnes: true, home_nav_emargement_docs: true,
    home_nav_emargement_gen: true, home_nav_actions_coll: true, home_nav_stats_glob: true,
    home_nav_bilan_suresnes: true, home_nav_volume_horaire: true, home_nav_agenda_med: true,
    login_submit: true, login_forgot_password: true,
    benef_search: true, benef_nav_agenda_suresnes: true, benef_create_new: true, benef_filter_alphabet: true,
    benef_filter_today: true, benef_filter_suresnes: true, benef_filter_de: true, benef_filter_blacklist: true,
    benef_action_toggle_blacklist: true, benef_action_open: true,
    fiche_edit_profil: true, fiche_nav_diagnostic: true, fiche_add_action: true, fiche_action_change_lieu: true,
    fiche_action_edit_rdv: true, fiche_action_delete_rdv: true, fiche_modal_toggle_blacklist: true, fiche_modal_submit: true,
    diag_select_type: true, diag_start: true, diag_nav_questions: true, diag_choose_option: true,
    diag_rate_satisfaction: true, diag_submit: true,
    coll_toggle_form: true, coll_submit: true, coll_edit: true,
    agenda_toggle_sidebar: true, agenda_validate_week: true, agenda_notif_panel: true, agenda_week_nav: true,
    agenda_display_toggles: true, agenda_model_create: true, agenda_model_actions: true, agenda_grid_interaction: true,
    agenda_staff_mask: true,
    collecte_export: true, collecte_change_year: true, collecte_toggle_step: true, collecte_comment_edit: true,
    suresnes_filter_today: true, suresnes_month_nav: true, suresnes_reassign: true, suresnes_create_slot: true,
    equipe_add_member: true, equipe_territory_manage: true, equipe_display_toggles: true, equipe_member_actions: true, equipe_modal_competence: true,
  },

  // Rôles historiquement gérés par /admin/droits : droits de départ prudents
  // (alignés sur "lecteur"), à affiner ensuite dans /analyse.
  aci: {
    page_access_home: true, page_access_login: true, page_access_liste_beneficiaires: true, page_access_suresnes: true, page_access_agenda: true,
    home_logout: true, home_nav_liste_benef: true, home_nav_agenda_suresnes: true, login_submit: true,
    benef_search: true, benef_filter_alphabet: true, benef_action_open: true,
    suresnes_filter_today: true, suresnes_month_nav: true, agenda_week_nav: true,
  },

  charge_territoire: {
    page_access_home: true, page_access_login: true, page_access_liste_beneficiaires: true, page_access_suresnes: true, page_access_agenda: true,
    home_logout: true, home_nav_liste_benef: true, home_nav_agenda_suresnes: true, login_submit: true,
    benef_search: true, benef_filter_alphabet: true, benef_filter_suresnes: true, benef_action_open: true,
    suresnes_filter_today: true, suresnes_month_nav: true, suresnes_reassign: true, agenda_week_nav: true,
  },
};

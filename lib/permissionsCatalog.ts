// Catalogue centralisé des pages et des actions (boutons/liens) de la plateforme.
// C'est la SEULE source consommée par /mediation/analyse (édition de la matrice), par
// <PageGuard> (contrôle d'accès à une page entière) et par <PermissionGuard>
// (contrôle d'un bouton/lien précis). Avant cette centralisation, /mediation/analyse et
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
      { id: "home_folder_rencontres", nom: "Badge Agenda", type: "button", description: "Déploie le dossier Agenda" },
      { id: "home_folder_beneficiaires", nom: "Badge Bénéficiaires", type: "button", description: "Déploie le dossier Bénéficiaires" },
      { id: "home_folder_bilans", nom: "Badge Bilans", type: "button", description: "Déploie le dossier Bilans" },
      { id: "home_folder_lieux", nom: "Badge Lieux", type: "button", description: "Déploie le dossier Lieux" },
      { id: "home_folder_stats", nom: "Badge Statistiques & Bilans", type: "button", description: "Déploie le dossier analytique" },
      { id: "home_nav_liste_benef", nom: "Lien Liste des Bénéficiaires", type: "Link", description: "Accède au répertoire principal des usagers" },
      { id: "home_nav_collectes", nom: "Lien Suivi Collectes Tech", type: "Link", description: "Ouvre le tableau Excel de Collectes Tech" },
      { id: "home_nav_fiche_bilan", nom: "Lien Fiche Bilan", type: "Link", description: "Accède aux fiches de synthèses et bilans" },
      { id: "home_nav_bilan_tech", nom: "Lien Bilan Tech", type: "Link", description: "Accède à la page d'exécution et de suivi des bilans techniques" },
      { id: "home_nav_rdv_par_lieu", nom: "Lien Rendez-vous par lieu", type: "Link", description: "Consulte et planifie les rendez-vous selon les lieux" },
      { id: "home_nav_ajouter_lieu", nom: "Lien Ajouter un lieu", type: "Link", description: "Accède à la gestion des adresses et localisations prédéfinies" },
      { id: "home_nav_agenda_suresnes", nom: "Lien Agenda Suresnes", type: "Link", description: "Accède à l'agenda du Relais Numérique" },
      { id: "home_nav_emargement_docs", nom: "Lien Émargements & Doc. internes", type: "Link", description: "Accède aux feuilles archivées" },
      { id: "home_nav_emargement_gen", nom: "Lien Générateur d'Émargements", type: "Link", description: "Ouvre l'éditeur de feuilles d'émargement" },
      { id: "home_nav_actions_coll", nom: "Lien Actions Collectives", type: "Link", description: "Accède à la saisie d'ateliers de groupe" },
      { id: "home_nav_stats_glob", nom: "Lien Bilan & Stats Globaux", type: "Link", description: "Accède aux analyses croisées" },
      { id: "home_nav_bilan_suresnes", nom: "Lien Analyse Actions Suresnes", type: "Link", description: "Accède à l'étude d'impact de Suresnes" },
      { id: "home_nav_volume_horaire", nom: "Lien Volume Horaire", type: "Link", description: "Consulte les heures travaillées et coûts RH" },
      { id: "home_nav_admin_droits", nom: "Lien Gérer les Droits", type: "Link", description: "Accède à la configuration de la sécurité (Admin)" },
      { id: "home_nav_modeles", nom: "Lien Modèles d'Activités", type: "Link", description: "Accède à la gestion des modèles depuis le dossier Agenda" },
      { id: "home_nav_equipe", nom: "Lien Équipe", type: "Link", description: "Accède à la gestion de l'équipe depuis l'accueil" },
    ],
  },
  {
    pageId: "page_access_login",
    pageName: "Connexion",
    route: "/login",
    filePath: "app/login/page.tsx",
    // Pas d'actions : login_submit/login_forgot_password ont été retirés du
    // catalogue — ils ne peuvent structurellement jamais être appliqués par
    // <PermissionGuard>, qui dépend du rôle de l'utilisateur déjà authentifié
    // (usePermissions().can() renvoie toujours false tant que personne n'est
    // connecté). Les gater aurait empêché tout le monde de se connecter.
    actions: [],
  },
  {
    pageId: "page_access_liste_beneficiaires",
    pageName: "Liste des Bénéficiaires",
    route: "/mediation/rencontres-numeriques/liste-beneficiaires",
    filePath: "app/mediation/rencontres-numeriques/liste-beneficiaires/page.tsx",
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
      // benef_nav_localisations ("Lien Ajouter un lieu") retiré : ce lien
      // n'existe plus dans app/.../liste-beneficiaires/page.tsx (audit droits).
    ],
  },
  {
    pageId: "page_access_fiche_beneficiaire",
    pageName: "Fiche Bénéficiaire (Détails)",
    route: "/mediation/rencontres-numeriques/liste-beneficiaires/[id]",
    filePath: "app/mediation/rencontres-numeriques/liste-beneficiaires/[id]/page.tsx",
    actions: [
      { id: "fiche_edit_profil", nom: "Bouton Éditer/Compléter le profil", type: "button", description: "Ouvre la modale des infos personnelles" },
      { id: "fiche_nav_diagnostic", nom: "Lien Remplir un questionnaire", type: "Link", description: "Accède au formulaire d'évaluation/diagnostic" },
      { id: "fiche_add_action", nom: "Bouton Enregistrer l'action", type: "submit", description: "Ajoute une visite de suivi (formulaire)" },
      { id: "fiche_action_change_lieu", nom: "Lien Ajouter un lieu (modale RDV)", type: "Link", description: "Accède à la gestion des lieux depuis l'ajout de RDV" },
      { id: "fiche_action_edit_rdv", nom: "Bouton Modifier RDV (ligne)", type: "button", description: "Active l'édition inline d'une visite" },
      { id: "fiche_action_save_rdv", nom: "Bouton Confirmer RDV (ligne, ✓)", type: "submit", description: "Enregistre les modifications d'un rendez-vous en édition inline" },
      { id: "fiche_action_delete_rdv", nom: "Bouton Supprimer RDV (ligne)", type: "button", description: "Efface définitivement un rendez-vous" },
      { id: "fiche_modal_toggle_blacklist", nom: "Sélecteur Blacklist (Modale)", type: "select", description: "Bascule la blacklist dans l'édition" },
      { id: "fiche_modal_submit", nom: "Bouton Enregistrer profil (Modale)", type: "submit", description: "Sauvegarde les informations du profil" },
      { id: "fiche_nav_bilan_tech", nom: "Lien Bilan Tech", type: "Link", description: "Accède au bilan technique du diagnostic Collecte Tech" },
      { id: "fiche_nav_agenda_suresnes", nom: "Lien Agenda Suresnes", type: "Link", description: "Accède à l'agenda de Suresnes depuis la fiche" },
      { id: "fiche_nav_equipe", nom: "Lien Gérer l'équipe RH", type: "Link", description: "Accède à la gestion de l'équipe depuis la fiche" },
    ],
  },
  {
    pageId: "page_access_diagnosticform",
    pageName: "Formulaire Diagnostic",
    route: "/mediation/rencontres-numeriques/diagnosticform",
    filePath: "app/mediation/rencontres-numeriques/diagnosticform/page.tsx",
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
    route: "/mediation/rencontres-numeriques/actions-collectives",
    filePath: "app/mediation/rencontres-numeriques/actions-collectives/page.tsx",
    actions: [
      { id: "coll_toggle_form", nom: "Bouton Saisir un Atelier / Fermer", type: "button", description: "Affiche/masque le formulaire de saisie" },
      { id: "coll_submit", nom: "Bouton Valider l'action (Formulaire)", type: "submit", description: "Enregistre l'atelier collectif" },
      { id: "coll_save_edit", nom: "Bouton Enregistrer les modifications (ligne)", type: "submit", description: "Sauvegarde l'édition d'une action collective" },
      { id: "coll_delete", nom: "Bouton Supprimer (ligne)", type: "button", description: "Efface définitivement une action collective" },
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
      { id: "agenda_slot_create", nom: "Bouton Ajouter un créneau (case vide / + Autre)", type: "button", description: "Crée un nouveau créneau dans la grille" },
      { id: "agenda_slot_delete", nom: "Bouton Supprimer un créneau", type: "button", description: "Efface un créneau existant de la grille" },
      { id: "agenda_comment_view", nom: "Consulter une note/commentaire de créneau", type: "button", description: "Ouvre la note d'un créneau en lecture seule" },
      { id: "agenda_comment_edit", nom: "Ajouter/Modifier/Supprimer une note de créneau", type: "button", description: "Écrit ou efface le commentaire d'un créneau" },
      { id: "agenda_staff_mask", nom: "Bouton Masquer/Engrenage Staff", type: "button", description: "Masque un membre ou édite ses heures ACI" },
    ],
  },
  {
    pageId: "page_access_suivi_collecte",
    pageName: "Suivi Collecte Tech",
    route: "/mediation/rencontres-numeriques/suivi-collecte",
    filePath: "app/mediation/rencontres-numeriques/suivi-collecte/page.tsx",
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
    route: "/mediation/rencontres-numeriques/suresnes",
    filePath: "app/mediation/rencontres-numeriques/suresnes/page.tsx",
    actions: [
      { id: "suresnes_filter_today", nom: "Bouton Aujourd'hui uniquement", type: "button", description: "Isole les rendez-vous du jour" },
      { id: "suresnes_month_nav", nom: "Boutons Mois (Précédent / Suivant)", type: "button", description: "Navigation calendaire mensuelle" },
      { id: "suresnes_reassign", nom: "Bouton Réaffecter médiateur", type: "button", description: "Attribue un créneau orphelin à un staff" },
      { id: "suresnes_slot_assign", nom: "Autocomplétion Assigner un bénéficiaire", type: "select", description: "Affecte un bénéficiaire existant à un créneau vide" },
      { id: "suresnes_slot_clear", nom: "Bouton Vider le créneau (✕)", type: "button", description: "Retire le bénéficiaire/thématique/demande d'un créneau" },
      { id: "suresnes_slot_thematique_edit", nom: "Sélecteur Thématique (créneau)", type: "select", description: "Modifie la thématique associée à un rendez-vous" },
      { id: "suresnes_slot_demande_edit", nom: "Champ Demande spécifique (créneau)", type: "input", description: "Modifie la demande spécifique associée à un rendez-vous" },
      { id: "suresnes_create_slot", nom: "Boutons Créer / Annuler un nouveau bénéficiaire (Modale)", type: "submit", description: "Crée un profil bénéficiaire et l'assigne au créneau" },
      { id: "suresnes_nav_beneficiaires", nom: "Lien Bénéficiaires", type: "Link", description: "Accède à la liste des bénéficiaires depuis Suresnes" },
      { id: "suresnes_nav_agenda_med", nom: "Lien Agenda Médiateurs", type: "Link", description: "Accède à l'agenda des médiateurs depuis Suresnes" },
    ],
  },
  {
    pageId: "page_access_equipe",
    pageName: "Gestion de l'Équipe",
    route: "/mediation/equipe",
    filePath: "app/mediation/equipe/page.tsx",
    actions: [
      { id: "equipe_add_member", nom: "Bouton Ajouter un membre", type: "button", description: "Ouvre le formulaire d'inscription RH" },
      { id: "equipe_territory_manage", nom: "Boutons Ajouter / Supprimer Territoire", type: "button", description: "Configure les zones globales" },
      { id: "equipe_display_toggles", nom: "Boutons Onglets (Actifs/Archives) & Vues (Cartes/Listes)", type: "button", description: "Gère l'affichage du personnel" },
      { id: "equipe_member_actions", nom: "Boutons Éditer / Archiver (Membre)", type: "button", description: "Actions sur les fiches de staff" },
      { id: "equipe_modal_competence", nom: "Boutons + / Qualités Rapides / X (Modale)", type: "button", description: "Gère les tags de compétences du membre" },
      { id: "equipe_horaires_aci_edit", nom: "Grille Horaires ACI (Paris/Massy)", type: "input", description: "Modifie les horaires de référence utilisés pour la paie/planning ACI" },
      { id: "equipe_nav_competences", nom: "Lien Qualités", type: "Link", description: "Accède à la page des compétences depuis l'équipe" },
      // equipe_nav_agenda ("Lien Agenda") retiré : aucun lien correspondant
      // n'existe dans app/mediation/equipe/page.tsx (audit droits).
      { id: "equipe_create_access", nom: "Bouton Créer l'accès de connexion (clé)", type: "button", description: "Crée le compte Firebase Auth et envoie l'e-mail d'activation" },
    ],
  },
  {
    pageId: "page_access_modeles",
    pageName: "Modèles d'Activités",
    route: "/mediation/modeles",
    filePath: "app/mediation/modeles/page.tsx",
    actions: [
      { id: "modeles_create", nom: "Bouton Nouveau Modèle", type: "button", description: "Ouvre le formulaire de création d'un modèle" },
      { id: "modeles_edit", nom: "Bouton Éditer (Modèle)", type: "button", description: "Modifie un modèle existant et ses créneaux déjà posés" },
      { id: "modeles_delete", nom: "Bouton Supprimer (Modèle)", type: "button", description: "Efface définitivement un modèle" },
    ],
  },
];

// Routes restantes de l'app, cataloguées seulement au niveau page pour
// l'instant (pas encore d'inventaire détaillé des boutons). <PageGuard>
// fonctionne dès aujourd'hui pour elles ; le détail des actions pourra être
// ajouté ici au même titre que DETAILED_PAGES au fil de l'eau.
const PAGE_ONLY_ROUTES: Omit<PageEntry, "actions">[] = [
  { pageId: "page_access_analyse", pageName: "Matrice des droits (Analyse)", route: "/mediation/analyse", filePath: "app/mediation/analyse/page.tsx" },
  { pageId: "page_access_admin_droits", pageName: "Gestion des Droits (Admin)", route: "/admin/droits", filePath: "app/admin/droits/page.tsx" },
  { pageId: "page_access_mediateurs", pageName: "Médiateurs", route: "/mediation/mediateurs", filePath: "app/mediation/mediateurs/page.tsx" },
  { pageId: "page_access_localisations", pageName: "Localisations", route: "/mediation/localisations", filePath: "app/mediation/localisations/page.tsx" },
  { pageId: "page_access_rdv_par_lieu", pageName: "Rendez-vous par lieu", route: "/mediation/rencontres-numeriques/rendez-vous-par-lieu", filePath: "app/mediation/rencontres-numeriques/rendez-vous-par-lieu/page.tsx" },
  { pageId: "page_access_bilan_tech", pageName: "Bilan Tech", route: "/mediation/rencontres-numeriques/bilan_tech", filePath: "app/mediation/rencontres-numeriques/bilan_tech/page.tsx" },
  { pageId: "page_access_emargement", pageName: "Émargement", route: "/mediation/rencontres-numeriques/emargement", filePath: "app/mediation/rencontres-numeriques/emargement/page.tsx" },
  { pageId: "page_access_emargements", pageName: "Émargements", route: "/mediation/rencontres-numeriques/emargements", filePath: "app/mediation/rencontres-numeriques/emargements/page.tsx" },
  { pageId: "page_access_adresses", pageName: "Adresses", route: "/mediation/adresses", filePath: "app/mediation/adresses/page.tsx" },
  { pageId: "page_access_competences", pageName: "Compétences", route: "/mediation/competences", filePath: "app/mediation/competences/page.tsx" },
  { pageId: "page_access_statistiques", pageName: "Statistiques", route: "/mediation/statistiques", filePath: "app/mediation/statistiques/page.tsx" },
  { pageId: "page_access_bilan_suresnes", pageName: "Bilan Suresnes", route: "/mediation/bilan-suresnes", filePath: "app/mediation/bilan-suresnes/page.tsx" },
  { pageId: "page_access_volume_horaire", pageName: "Volume Horaire", route: "/mediation/volume-horaire", filePath: "app/mediation/volume-horaire/page.tsx" },
  { pageId: "page_access_fiches_bilans", pageName: "Fiches Bilans", route: "/mediation/rencontres-numeriques/fiches-bilans", filePath: "app/mediation/rencontres-numeriques/fiches-bilans/page.tsx" },
  { pageId: "page_access_fiches_bilans_historique", pageName: "Fiches Bilans (Historique)", route: "/mediation/rencontres-numeriques/fiches-bilans/historique", filePath: "app/mediation/rencontres-numeriques/fiches-bilans/historique/page.tsx" },
  { pageId: "page_access_notifications", pageName: "Notifications", route: "/mediation/notifications", filePath: "app/mediation/notifications/page.tsx" },
  { pageId: "page_access_bibliotheque_logos", pageName: "Bibliothèque de logos", route: "/mediation/bibliotheque-logos", filePath: "app/mediation/bibliotheque-logos/page.tsx" },
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

// Résout l'effectivité d'un droit pour un rôle donné : une valeur explicite
// dans la matrice Firestore prime, sinon on retombe sur le catalogue par
// défaut. Utilisé à la fois par PermissionsProvider.can() (ce qui est
// réellement autorisé) et par /mediation/analyse (ce qui est affiché comme coché) —
// les deux DOIVENT rester en phase, sans quoi un admin peut croire qu'un
// droit est désactivé alors qu'il est en fait actif par défaut, ou l'inverse.
export function resolvePermission(
  matrix: Record<string, Record<string, boolean>>,
  roleId: string,
  actionId: string
): boolean {
  if (roleId === "admin") return true;
  const explicit = matrix[actionId]?.[roleId];
  if (explicit !== undefined) return explicit;
  return !!DEFAULT_PERMISSIONS[roleId]?.[actionId];
}

// Droits par défaut, utilisés uniquement pour amorcer la matrice Firestore
// (configuration_droits) la première fois qu'elle est vide. Une fois créée,
// c'est la matrice Firestore qui fait foi et qui est éditable dans /mediation/analyse.
export const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin: ALL_ACTION_IDS.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {} as Record<string, boolean>),

  mediateur: {
    page_access_home: true, page_access_login: true, page_access_liste_beneficiaires: true,
    page_access_fiche_beneficiaire: true, page_access_diagnosticform: true, page_access_actions_collectives: true,
    page_access_agenda: true, page_access_suivi_collecte: true, page_access_suresnes: true,
    page_access_adresses: true, page_access_equipe: true, page_access_mediateurs: true,
    page_access_localisations: true, page_access_bilan_tech: true, page_access_emargement: true,
    page_access_emargements: true, page_access_fiches_bilans: true, page_access_fiches_bilans_historique: true,
    page_access_notifications: true, page_access_bibliotheque_logos: true,
    home_logout: true, home_folder_rencontres: true, home_folder_stats: true, home_nav_liste_benef: true,
    home_folder_beneficiaires: true, home_folder_bilans: true, home_folder_lieux: true,
    home_nav_fiche_bilan: true, home_nav_bilan_tech: true, home_nav_ajouter_lieu: true, home_nav_equipe: true,
    home_nav_collectes: true, home_nav_agenda_suresnes: true, home_nav_emargement_docs: true,
    home_nav_emargement_gen: true, home_nav_actions_coll: true, home_nav_stats_glob: true,
    benef_search: true, benef_nav_agenda_suresnes: true, benef_create_new: true, benef_filter_alphabet: true,
    benef_filter_today: true, benef_filter_suresnes: true, benef_filter_de: true, benef_action_open: true,
    fiche_edit_profil: true, fiche_nav_diagnostic: true, fiche_add_action: true, fiche_action_change_lieu: true,
    fiche_action_edit_rdv: true, fiche_action_save_rdv: true, fiche_modal_submit: true,
    fiche_nav_bilan_tech: true, fiche_nav_agenda_suresnes: true,
    diag_select_type: true, diag_start: true, diag_nav_questions: true, diag_choose_option: true,
    diag_rate_satisfaction: true, diag_submit: true,
    coll_toggle_form: true, coll_submit: true, coll_save_edit: true, coll_delete: true,
    agenda_toggle_sidebar: true, agenda_notif_panel: true, agenda_week_nav: true, agenda_display_toggles: true,
    agenda_slot_create: true, agenda_slot_delete: true, agenda_comment_view: true, agenda_comment_edit: true,
    collecte_change_year: true, collecte_toggle_step: true, collecte_comment_edit: true,
    suresnes_filter_today: true, suresnes_month_nav: true, suresnes_create_slot: true,
    suresnes_slot_assign: true, suresnes_slot_clear: true, suresnes_slot_thematique_edit: true, suresnes_slot_demande_edit: true,
    suresnes_nav_beneficiaires: true, suresnes_nav_agenda_med: true,
  },

  coordinateur: {
    page_access_home: true, page_access_login: true, page_access_liste_beneficiaires: true,
    page_access_fiche_beneficiaire: true, page_access_diagnosticform: true, page_access_actions_collectives: true,
    page_access_agenda: true, page_access_suivi_collecte: true, page_access_suresnes: true, page_access_equipe: true,
    page_access_adresses: true, page_access_mediateurs: true, page_access_localisations: true,
    page_access_rdv_par_lieu: true, page_access_bilan_tech: true, page_access_emargement: true,
    page_access_emargements: true, page_access_competences: true, page_access_statistiques: true,
    page_access_bilan_suresnes: true, page_access_volume_horaire: true, page_access_fiches_bilans: true,
    page_access_fiches_bilans_historique: true, page_access_notifications: true, page_access_bibliotheque_logos: true,
    page_access_modeles: true, modeles_create: true, modeles_edit: true, modeles_delete: true, home_nav_modeles: true,
    home_logout: true, home_folder_rencontres: true, home_folder_stats: true, home_nav_liste_benef: true,
    home_folder_beneficiaires: true, home_folder_bilans: true, home_folder_lieux: true,
    home_nav_fiche_bilan: true, home_nav_bilan_tech: true, home_nav_rdv_par_lieu: true, home_nav_ajouter_lieu: true, home_nav_equipe: true,
    home_nav_collectes: true, home_nav_agenda_suresnes: true, home_nav_emargement_docs: true,
    home_nav_emargement_gen: true, home_nav_actions_coll: true, home_nav_stats_glob: true,
    home_nav_bilan_suresnes: true, home_nav_volume_horaire: true, home_nav_agenda_med: true,
    benef_search: true, benef_nav_agenda_suresnes: true, benef_create_new: true, benef_filter_alphabet: true,
    benef_filter_today: true, benef_filter_suresnes: true, benef_filter_de: true, benef_filter_blacklist: true,
    benef_action_toggle_blacklist: true, benef_action_open: true,
    fiche_edit_profil: true, fiche_nav_diagnostic: true, fiche_add_action: true, fiche_action_change_lieu: true,
    fiche_action_edit_rdv: true, fiche_action_save_rdv: true, fiche_action_delete_rdv: true, fiche_modal_toggle_blacklist: true, fiche_modal_submit: true,
    fiche_nav_bilan_tech: true, fiche_nav_agenda_suresnes: true, fiche_nav_equipe: true,
    diag_select_type: true, diag_start: true, diag_nav_questions: true, diag_choose_option: true,
    diag_rate_satisfaction: true, diag_submit: true,
    coll_toggle_form: true, coll_submit: true, coll_save_edit: true, coll_delete: true,
    agenda_toggle_sidebar: true, agenda_validate_week: true, agenda_notif_panel: true, agenda_week_nav: true,
    agenda_display_toggles: true, agenda_model_create: true, agenda_model_actions: true,
    agenda_slot_create: true, agenda_slot_delete: true, agenda_comment_view: true, agenda_comment_edit: true,
    agenda_staff_mask: true,
    collecte_export: true, collecte_change_year: true, collecte_toggle_step: true, collecte_comment_edit: true,
    suresnes_filter_today: true, suresnes_month_nav: true, suresnes_reassign: true, suresnes_create_slot: true,
    suresnes_slot_assign: true, suresnes_slot_clear: true, suresnes_slot_thematique_edit: true, suresnes_slot_demande_edit: true,
    suresnes_nav_beneficiaires: true, suresnes_nav_agenda_med: true,
    equipe_add_member: true, equipe_territory_manage: true, equipe_display_toggles: true, equipe_member_actions: true, equipe_modal_competence: true,
    equipe_horaires_aci_edit: true, equipe_nav_competences: true, equipe_create_access: true,
  },

  // ACI reprend exactement les anciens droits du rôle "Lecteur" (fusionné),
  // complétés par un accès en consultation (lecture seule) à l'agenda des
  // médiateurs et à ses notes/commentaires — sans pouvoir créer/supprimer de
  // créneau ni modifier une note.
  aci: {
    page_access_home: true, page_access_login: true, page_access_liste_beneficiaires: true, page_access_suresnes: true,
    page_access_agenda: true, page_access_adresses: true, page_access_fiche_beneficiaire: true,
    page_access_diagnosticform: true, page_access_actions_collectives: true, page_access_mediateurs: true,
    page_access_localisations: true, page_access_notifications: true,
    home_logout: true, home_folder_rencontres: true, home_folder_stats: true, home_nav_liste_benef: true,
    home_folder_beneficiaires: true, home_folder_bilans: true, home_folder_lieux: true, home_nav_ajouter_lieu: true,
    home_nav_collectes: true, home_nav_agenda_suresnes: true, home_nav_agenda_med: true, home_nav_emargement_docs: true,
    home_nav_actions_coll: true, home_nav_stats_glob: true, home_nav_bilan_suresnes: true, home_nav_volume_horaire: true,
    benef_search: true, benef_nav_agenda_suresnes: true, benef_filter_alphabet: true,
    benef_filter_today: true, benef_filter_suresnes: true, benef_filter_de: true, benef_action_open: true,
    suresnes_filter_today: true, suresnes_month_nav: true,
    agenda_week_nav: true, agenda_comment_view: true,
  },
};

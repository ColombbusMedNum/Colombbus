"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "../../lib/firebase";
import PageGuard from "../../components/PageGuard";
import { useToast } from "../../components/ToastProvider";
import { usePermissions } from "../../lib/PermissionsProvider";
import { PermissionGuard } from "../../components/PermissionGuard";
import { useMediateurs } from "../../lib/MediateursProvider";
import {
  collection, onSnapshot, query, orderBy, addDoc,
  deleteDoc, doc, getDoc, getDocs, where, updateDoc, setDoc, writeBatch,
  DocumentData, Query, QueryDocumentSnapshot
} from "firebase/firestore";
import { 
  PlusIcon, TrashIcon, XMarkIcon,
  DocumentDuplicateIcon, PencilSquareIcon,
  UsersIcon, MapPinIcon, EyeIcon, EyeSlashIcon,
  CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon,
  LockClosedIcon, BellIcon,
  ChatBubbleLeftRightIcon, ExclamationTriangleIcon,
  ChevronDownIcon, HomeIcon, ClockIcon, WrenchScrewdriverIcon, DevicePhoneMobileIcon, ArrowPathIcon, Cog6ToothIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import type { Mediateur, ActionPlanning } from "../../lib/types";
import { useConfirm } from "../../components/ConfirmProvider";
import Accordion from "../../components/Accordion";
import ScrollToTopButton from "../../components/ScrollToTopButton";
import ModelesGantt from "../../components/ModelesGantt";
import {
  type ActiviteType, BLOCS_THEMATIQUES, getJoursFeries,
  genererCreneauxPourModele, estimerNombreCreneaux, estVisibleCetteSemaine, estModeleExpire,
  formatDateFrCourt, estModeleProtege, resoudreHoraireModele, resoudreHoraireAffichage, resoudreHoraireGrilleACI,
  horairesSuresnesPourSite,
} from "../../lib/activitesTypes";
import { regrouperParCategorie } from "../../lib/equipeCategories";
import { estAdminGoogleAgenda } from "../../lib/googleCalendarBeta";
import { estActionDuMediateur, identifiantMediateur } from "../../lib/matchMediateur";
import { calculerDureeHeures } from "../../lib/planningHours";

interface NotificationItem {
  id: string;
  message: string;
  createdAt: number;
  lue: boolean;
  destinataireId?: string;
}

// Utilitaire d'opacité dynamique Hex vers RGBA
function hexToRgba(hex: string, alpha: number) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) {
    return `rgba(0, 82, 89, ${alpha})`;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Détermine si une couleur hexadécimale est claire pour ajuster la lisibilité
function isLightColor(hex: string): boolean {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

// Fenêtres horaires standard d'une demi-journée — utilisées pour détecter
// qu'une action saisie sur une seule demi-journée déborde sur l'autre (ex.
// 09h30-17h00 saisi le matin) et composer le détail dans l'info-bulle de sa
// case (voir DayCell : detailHoraire). La case reste unique, pas de carte
// dupliquée sur l'autre demi-journée.
const FENETRES_DEMI_JOURNEE: Record<string, { debut: string; fin: string }> = {
  "Matin": { debut: "10:00", fin: "13:00" },
  "Après-midi": { debut: "14:00", fin: "17:00" },
};

function versMinutes(heure: string): number {
  const [h, m] = heure.split(":").map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

function versHeure(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Assombrit une couleur claire pour l'utiliser en texte sur fond blanc/quasi-blanc
// (ex: badges de bloc thématique) : la couleur d'origine reste utilisée telle
// quelle pour les pastilles/fonds, seul le texte a besoin de contraste suffisant.
function getReadableTextColor(hex: string): string {
  if (!isLightColor(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const factor = 0.55;
  const toHex = (n: number) => Math.round(n * factor).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getWeekIdentifier(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

// Noms de médiateur à rechercher dans planning_suresnes pour UN lieu RN
// donné : les créneaux y sont enregistrés avec le nom suffixé selon le
// département ("(RN91)" pour 91, "(RN)"/"(RND)" pour Suresnes 92 — RND
// n'étant que la variante "à domicile" du même département). Sans ce
// cloisonnement, un lieu "91 - RNUM" retrouvait aussi les inscriptions du 92
// (et inversement), bloquant/purgeant à tort une suppression ou un
// déplacement à cause d'usagers inscrits sur un tout autre département.
function variantesMediateurSuresnes(lieu: string, nomComplet: string): string[] {
  const upperLieu = (lieu || "").toUpperCase();
  if (upperLieu.includes("91")) return [nomComplet, `${nomComplet} (RN91)`];
  return [nomComplet, `${nomComplet} (RN)`, `${nomComplet} (RND)`];
}

// Regroupe deux lieux qui désignent en réalité la MÊME action (voir le
// filtre "Avec moi" plus bas, et le même besoin déjà résolu côté Agenda
// Mobile, familleSitePourEquipe) : "RN Observation" rejoint la permanence RN
// du même département, et "X Observation" (ACI en observation) rejoint "X"
// — sans ça, la personne en observation et celle en production sur le même
// créneau ne semblent jamais "ensemble".
function familleSitePourAvecMoi(lieu: string): string {
  const normalise = lieu.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
  const estRND = normalise.includes("RND");
  if (!estRND && normalise.includes("RN")) {
    const departement = lieu.match(/^(\d{2})\s*-/)?.[1] || "";
    return `RN_${departement}`;
  }
  return lieu.replace(/\s*observation\s*$/i, "").trim() || lieu;
}

// Lieux "grille horaire personnelle" (Terrage, Suresnes, Massy — voir
// estModeleProtege) : présents chez énormément de monde en même temps par
// construction, jamais un vrai "on travaille ensemble" au sens du filtre
// "Avec moi" — les compter y ferait remonter presque tout le monde. Exact
// (pas une inclusion) pour ne pas exclure au passage un vrai créneau RN
// Suresnes précis (ex "92 - RN - Suresnes"), qui lui reste pertinent.
function estLieuGeneriqueAvecMoi(lieu: string): boolean {
  const norm = (lieu || "").trim().toUpperCase();
  return norm === "TERRAGE" || norm === "SURESNES" || norm === "MASSY";
}

const ACTIVITE_VIDE: ActiviteType = {
  lieu: "", debutMatin: "09:00", finMatin: "12:00", debutApresMidi: "14:00", finApresMidi: "17:30",
  journeeComplete: false,
  adresse: "", territoire: "",
  couleur: "#005259", codeAnalytique: "", codeACI: "", codeInterne: "", dateDebut: "", dateFin: "",
  blocs: [], mediateursIds: [], generationMoment: "Les deux", datesActives: [],
  estProduction: false, observationACI: false, observationACIDateFin: "",
};

// Replie par défaut les sections avancées de la modale de modèle, sauf
// celles qui contiennent déjà des données (en édition) — évite une pop-up
// interminable tout en gardant visible ce qui a déjà été configuré.
function sectionsOuvertesInitiales(type: ActiviteType): Record<string, boolean> {
  return {
    horaires: !!type.journeeComplete || !!(type.debutMatin || type.debutApresMidi),
    apparence: (type.blocs || []).length > 0,
    periode: !!(type.dateDebut || type.dateFin || (type.datesActives || []).length > 0),
    mediateurs: (type.mediateursIds || []).length > 0,
  };
}

export default function PlanningExpertMix() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [actions, setActions] = useState<ActionPlanning[]>([]);
  const { mediateurs: mediateursBruts } = useMediateurs();
  const [activitesTypes, setActivitesTypes] = useState<ActiviteType[]>([]);
  // Couleur réellement active de chaque bloc thématique (éditable via le
  // sélecteur dans la barre latérale, persistée dans blocs_config/{blocId}).
  // Initialisée avec les couleurs par défaut le temps du premier chargement.
  const [blocsColors, setBlocsColors] = useState<Record<string, string>>(
    () => Object.fromEntries(BLOCS_THEMATIQUES.map(b => [b.id, b.couleur]))
  );
  const [localisations, setLocalisations] = useState<any[]>([]);
  const [semainesValidees, setSemainesValidees] = useState<Record<string, boolean>>({});
  // Grille horaire personnelle ACI (Paris/Massy), utilisée sur TERRAGE/MASSY
  // à la place des horaires fixes du modèle — voir processActionCreation.
  const [grillesHorairesACI, setGrillesHorairesACI] = useState<Record<string, Record<string, { debut: string; fin: string }>>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // États UI
  const [currentDate, setCurrentDate] = useState(new Date());
  // Arrivée depuis "Voir les dates" sur un modèle (/mediation/modeles) :
  // ?date=AAAA-MM-JJ&med=<id> positionne la semaine et prépare la mise en
  // évidence d'une ligne précise une fois les données chargées (effet plus
  // bas). Lu directement sur window.location plutôt que via useSearchParams,
  // pour ne pas avoir à englober toute cette page (très volumineuse) dans un
  // Suspense — cette page est de toute façon 100% côté client.
  const [medASurligner, setMedASurligner] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    if (dateParam) {
      const d = new Date(`${dateParam}T12:00:00`);
      if (!isNaN(d.getTime())) setCurrentDate(d);
    }
    const medParam = params.get("med");
    if (medParam) setMedASurligner(medParam);
  }, []);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isActiviteModalOpen, setIsActiviteModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ActiviteType | null>(null);
  // Action en cours de glisser-déposer d'une case vers une autre (voir
  // deplacerAction) — distinct du glisser-déposer interne à une case (pour
  // réordonner, géré localement dans DayCell).
  const [actionEnGlisse, setActionEnGlisse] = useState<ActionPlanning | null>(null);
  const [voirMasques, setVoirMasques] = useState(false);
  // "Avec moi" : ne garde que soi-même et les médiateur·rice·s qui
  // partagent au moins un créneau (même lieu/jour/demi-journée, voir
  // familleSitePourAvecMoi) avec le compte connecté cette semaine — pour
  // repérer d'un coup d'œil son équipe du jour sans chercher dans toute la
  // grille.
  const [avecMoiUniquement, setAvecMoiUniquement] = useState(false);
  // Jour précis (YYYY-MM-DD) sur lequel restreindre "Avec moi" — vide =
  // toute la semaine. Réinitialisé à chaque changement de semaine pour ne
  // pas garder une date qui n'appartient plus à la semaine affichée.
  const [jourAvecMoi, setJourAvecMoi] = useState("");
  // Pour les admins : mêmes filtre/case "Avec moi", mais avec un ou
  // plusieurs autres médiateur·rice·s pris comme référence plutôt que
  // (ou en plus de) soi-même — utile pour vérifier l'équipe de quelqu'un
  // d'autre sans devoir se connecter avec son compte.
  const [avecMediateursIds, setAvecMediateursIds] = useState<string[]>([]);
  const [avecMediateursPanelOuvert, setAvecMediateursPanelOuvert] = useState(false);
  const avecMediateursPanelRef = useRef<HTMLDivElement>(null);
  // Bascule d'affichage en plus de la grille d'édition habituelle : deux
  // vues GANTT en lecture seule (barres pleine largeur par demi-journée au
  // lieu de cases), pour repérer d'un coup d'œil les trous/chevauchements —
  // par activité (qui couvre quel lieu, quand) ou par médiateur·rice (mêmes
  // lignes que l'édition, sans les actions d'édition).
  const [vueAgenda, setVueAgenda] = useState<"edition" | "gantt-activite" | "gantt-detaille">("edition");
  // Période affichée par la vue GANTT (indépendante de la navigation
  // semaine par semaine ci-dessus, utilisée uniquement pour l'édition) —
  // voir actionsGantt ci-dessous.
  const [ganttMoisDebut, setGanttMoisDebut] = useState(() => new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [ganttNombreMois, setGanttNombreMois] = useState(2);
  const [actionsGantt, setActionsGantt] = useState<ActionPlanning[]>([]);
  // Même distingo Tout / Production que /mediation/volume-horaire (voir
  // filtreProduction là-bas) — sur le champ estProduction (lib/types.ts).
  const [ganttFiltreProduction, setGanttFiltreProduction] = useState<"tous" | "production">("tous");
  // Filtre optionnel sur une ou plusieurs médiateur·rice·s — vide = tout le
  // monde. Une fois filtré sur au moins une personne, chacune obtient sa
  // propre ligne journalière (voir GanttActiviteContinu, une instance par
  // personne sélectionnée) plutôt que des lignes par activité.
  const [ganttMediateurIds, setGanttMediateurIds] = useState<string[]>([]);
  const [medSelectPanelOuvert, setMedSelectPanelOuvert] = useState(false);
  const medSelectPanelRef = useRef<HTMLDivElement>(null);
  // Filtre sur les lieux "Absence" (congés, RTT...) configurés dans
  // Paramètres Généraux (configuration_equipe/parametres_configuration.
  // lieuxAbsence), plutôt qu'une liste codée en dur — indépendant du
  // distingo Tout/Production (une absence n'est ni l'un ni l'autre).
  // "isoler" garde les absences ET toutes les actions des personnes qui en
  // ont au moins une sur la période (pas les autres) : sert à comparer les
  // congés qui se chevauchent entre plusieurs médiateur·rice·s ET à repérer
  // une vraie action posée pendant le congé de l'une d'elles, sans avoir à
  // choisir entre les deux.
  const [ganttFiltreAbsences, setGanttFiltreAbsences] = useState<"tous" | "isoler">("tous");
  const [lieuxAbsenceConfig, setLieuxAbsenceConfig] = useState<string[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configuration_equipe", "parametres_configuration"), (snap) => {
      const data = snap.data();
      setLieuxAbsenceConfig(Array.isArray(data?.lieuxAbsence) ? data.lieuxAbsence : []);
    });
    return () => unsub();
  }, []);
  const [openBlocs, setOpenBlocs] = useState<Record<string, boolean>>({ inclusion: false, decouverte: false, insertion: false, divers: false, "sans-bloc": false }); 
  // Par défaut, le samedi est affiché uniquement si la semaine affichée a
  // effectivement un créneau ce jour-là (ex. généré en masse sur une période
  // qui déborde sur un samedi) — pas de case invisible tant que "+ Samedi"
  // n'est pas cliqué, mais pas de samedi vide affiché sans raison non plus.
  const samediADesActions = React.useMemo(() => {
    const d = new Date(currentDate);
    const jour = d.getDay();
    const diffLundi = d.getDate() - jour + (jour === 0 ? -6 : 1);
    const lundi = new Date(d.setDate(diffLundi));
    const samedi = new Date(lundi);
    samedi.setDate(lundi.getDate() + 5);
    const samediStr = samedi.toLocaleDateString('en-CA');
    return actions.some((a) => a.date === samediStr);
  }, [actions, currentDate]);

  // Un clic manuel sur "+ Samedi"/"Masquer Samedi" prime sur la valeur par
  // défaut ci-dessus, mais uniquement pour la semaine affichée au moment du
  // clic — changer de semaine (ou revenir sur la page) réinitialise ce choix,
  // pour que le samedi se calcule à nouveau automatiquement sur la nouvelle
  // semaine plutôt que de garder un choix devenu obsolète.
  const [samediChoixManuel, setSamediChoixManuel] = useState<boolean | null>(null);
  useEffect(() => { setSamediChoixManuel(null); }, [currentDate]);
  useEffect(() => { setJourAvecMoi(""); }, [currentDate]);

  const voirSamedi = samediChoixManuel ?? samediADesActions;

  // Repliée par défaut à chaque arrivée sur la page — l'utilisateur la
  // déplie via la poignée quand il a besoin d'injecter un modèle.
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [filtrePersoUniquement] = useState(true);
  const [showNotifDeleteConfirm, setShowNotifDeleteConfirm] = useState(false);

  // Modale de confirmation de suppression d'une action
  const [deleteConfirmModalData, setDeleteConfirmModalData] = useState<{
    id: string;
    lieu: string;
    mediateurNom: string;
  } | null>(null);

  // État de la modale d'ajout d'action
  const [promptModalData, setPromptModalData] = useState<{
    mediatId: string;
    prenom: string;
    nom: string;
    moment: string;
    dateStr: string;
  } | null>(null);
  const [promptLieuInput, setPromptLieuInput] = useState("");
  // Heures optionnelles pour une action créée sans modèle — un modèle porte
  // déjà ses propres horaires (selectedModel.debut/fin), donc ces champs ne
  // servent qu'à cette création "libre".
  const [promptDebutInput, setPromptDebutInput] = useState("");
  const [promptFinInput, setPromptFinInput] = useState("");

  // Choix "Modifier / Commenter" proposé au clic sur une case déjà remplie,
  // puis état de la modale de modification (lieu + horaires d'une action
  // existante) si "Modifier" est choisi.
  const [choixActionData, setChoixActionData] = useState<ActionPlanning | null>(null);
  const [editActionData, setEditActionData] = useState<{ id: string; lieu: string; debut: string; fin: string } | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);

  // Panneau de resynchronisation Google Agenda (admin) — replié dans un
  // panneau (comme les notifications) plutôt qu'en ligne dans l'en-tête : ce
  // bloc ajoutait à lui seul assez de largeur pour faire passer "Agenda des
  // médiateurs" à la ligne et désaligner tous les boutons à sa droite sur
  // une fenêtre pas assez large.
  const [resyncPanelOuvert, setResyncPanelOuvert] = useState(false);
  const resyncPanelRef = useRef<HTMLDivElement>(null);

  const [activeCommentModal, setActiveCommentModal] = useState<{
    actionId: string;
    currentText: string;
    inputText: string;
    readOnly: boolean;
  } | null>(null);
  
  // Formulaires
  const [newMed, setNewMed] = useState({ prenom: "", nom: "", poste: "", statut: "Permanent", debutACI: "09:00", finACI: "17:00", masque: false });
  const [editingMed, setEditingMed] = useState<Mediateur | null>(null);
  
  const [editingActivite, setEditingActivite] = useState<ActiviteType | null>(null);
  const [selectedLieuPredefini, setSelectedLieuPredefini] = useState("");
  const [newActivite, setNewActivite] = useState<ActiviteType>(ACTIVITE_VIDE);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const [categoriesOuvertesAgenda, setCategoriesOuvertesAgenda] = useState<Record<string, boolean>>({
    cadres: true, permanents: true, cip: true, prestataires: true, aci_massy: true, aci_paris: true, stagiaires: true, autres: true,
  });
  // Case à cocher par catégorie pour masquer entièrement son bloc (en-tête
  // compris) — distinct du chevron d'Accordion qui ne fait que replier le
  // contenu en laissant l'en-tête visible.
  const [categoriesVisibles, setCategoriesVisibles] = useState<Record<string, boolean>>({});

  const currentWeekId = getWeekIdentifier(currentDate);
  const estSemaineValidee = !!semainesValidees[currentWeekId];
  const nonLuesCount = notifications.filter(n => !n.lue).length;

  const { can, user, statut, role } = usePermissions();
  // La collection "notifications" cible chaque destinataire par son UID
  // Firebase Auth (voir destinataireId posé dans processActionCreation et
  // lib/activitesTypes.ts) : longtemps codé en dur sur un texte de
  // substitution ("ID_DU_MEDIATEUR_CONNECTE"), ce qui faisait que la cloche
  // ne trouvait jamais aucune notification pour personne, alors que
  // /mediation/notifications (qui n'a pas ce filtre) les affichait toutes.
  const currentUserId = user?.uid || null;
  const canCreateSlot = can("agenda_slot_create");
  const canDeleteSlot = can("agenda_slot_delete");
  const canViewComment = can("agenda_comment_view");
  const canEditComment = can("agenda_comment_edit");

  const getStatusPriority = (statut: string) => {
    if (statut === "Cadre") return 1;
    if (statut === "Permanent") return 2;
    if (statut === "CIP") return 3;
    if (statut === "Prestataire") return 4;
    if (statut === "Stagiaire") return 5;
    if (statut === "ACI") return 6;
    return 7;
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
        setShowNotifDeleteConfirm(false);
      }
    }
    if (isNotifOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNotifOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (resyncPanelRef.current && !resyncPanelRef.current.contains(event.target as Node)) {
        setResyncPanelOuvert(false);
      }
    }
    if (resyncPanelOuvert) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [resyncPanelOuvert]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (medSelectPanelRef.current && !medSelectPanelRef.current.contains(event.target as Node)) {
        setMedSelectPanelOuvert(false);
      }
    }
    if (medSelectPanelOuvert) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [medSelectPanelOuvert]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (avecMediateursPanelRef.current && !avecMediateursPanelRef.current.contains(event.target as Node)) {
        setAvecMediateursPanelOuvert(false);
      }
    }
    if (avecMediateursPanelOuvert) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avecMediateursPanelOuvert]);

  // Le planning n'affiche qu'une semaine à la fois : on ne charge que les
  // actions de cette semaine (lundi à dimanche, indépendamment du toggle
  // "voir samedi") au lieu de toute la collection depuis toujours. Effet
  // séparé des autres écoutes ci-dessous pour ne les re-déclencher que
  // lorsque c'est réellement nécessaire (changement de semaine uniquement).
  //
  // Dépend de currentUserId (pas seulement currentDate) : sans ça, si ce
  // onSnapshot démarre avant que Firebase Auth ait fini de restaurer la
  // session (request.auth encore null côté règles), il essuie un
  // "permission-denied" et Firestore ne relance JAMAIS un listener après une
  // erreur de permission, même une fois la session bien reconnue — toutes
  // les cases de tous les médiateurs restent alors vides pour le reste de la
  // session, sans rapport avec le compte de la personne connectée (même
  // course déjà rencontrée et corrigée dans MediateursProvider/
  // PermissionsProvider). Le callback d'erreur permet de diagnostiquer un
  // futur cas similaire au lieu d'échouer en silence.
  useEffect(() => {
    if (!currentUserId) return;
    const monday = getMonday(currentDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const debutSemaineStr = monday.toLocaleDateString('en-CA');
    const finSemaineStr = sunday.toLocaleDateString('en-CA');

    const qActions = query(
      collection(db, "planning_mediateurs"),
      where("date", ">=", debutSemaineStr),
      where("date", "<=", finSemaineStr)
    );
    const unsubActions = onSnapshot(
      qActions,
      (snap) => {
        setActions(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActionPlanning)));
      },
      (err) => {
        console.error("Erreur chargement planning_mediateurs :", err);
      }
    );

    return () => unsubActions();
  }, [currentDate, currentUserId]);

  // Les vues GANTT couvrent plusieurs mois (voir ganttMoisDebut/ganttNombreMois
  // plus bas), une période bien plus large que la semaine éditée — chargée à
  // part, uniquement quand une vue GANTT est active, pour ne jamais peser sur
  // le chargement de la grille d'édition. Même filet contre la course au
  // démarrage Firebase Auth que l'effet ci-dessus (voir sa note).
  useEffect(() => {
    if (vueAgenda === "edition" || !currentUserId) return;
    const [an, mois] = ganttMoisDebut.split("-").map(Number);
    if (!an || !mois) return;
    const debut = new Date(an, mois - 1, 1);
    const fin = new Date(an, mois - 1 + ganttNombreMois, 0);
    const debutStr = debut.toLocaleDateString('en-CA');
    const finStr = fin.toLocaleDateString('en-CA');

    const qGantt = query(
      collection(db, "planning_mediateurs"),
      where("date", ">=", debutStr),
      where("date", "<=", finStr)
    );
    const unsubGantt = onSnapshot(
      qGantt,
      (snap) => {
        setActionsGantt(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActionPlanning)));
      },
      (err) => {
        console.error("Erreur chargement GANTT planning_mediateurs :", err);
      }
    );

    return () => unsubGantt();
  }, [vueAgenda, ganttMoisDebut, ganttNombreMois, currentUserId]);

  useEffect(() => {
    const unsubSemaines = onSnapshot(collection(db, "semaines_validees"), (snap) => {
      const vMap: Record<string, boolean> = {};
      snap.docs.forEach(doc => { vMap[doc.id] = doc.data().validee || false; });
      setSemainesValidees(vMap);
    });

    const unsubLocs = onSnapshot(collection(db, "liste_lieux"), (snap) => {
      setLocalisations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubHoraires = onSnapshot(doc(db, "configuration_equipe", "parametres_horaires"), (snap) => {
      setGrillesHorairesACI((snap.data() as any) || {});
    });

    let qNotifs: Query<DocumentData> = collection(db, "notifications");
    if (filtrePersoUniquement && currentUserId) {
      qNotifs = query(collection(db, "notifications"), where("destinataireId", "==", currentUserId));
    }

    const unsubNotifs = onSnapshot(qNotifs, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationItem));
      setNotifications(list.sort((a, b) => b.createdAt - a.createdAt));
    });

    const unsubActs = onSnapshot(query(collection(db, "activites_types"), orderBy("lieu", "asc")), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActiviteType));
      if (docs.length === 0 && snap.metadata.fromCache === false) {
        const initiales = [
          { lieu: "Atelier Numérique", debut: "10:00", fin: "12:00", adresse: "Centre social", territoire: "92", couleur: "#EA601F", codeAnalytique: "", dateDebut: "", dateFin: "" },
          { lieu: "RN Suresnes", debut: "10:00", fin: "17:00", adresse: "Hôtel de Ville, Suresnes", territoire: "92", couleur: "#005259", codeAnalytique: "", dateDebut: "", dateFin: "" },
          { lieu: "Permanence", debut: "09:00", fin: "17:00", adresse: "Siège", territoire: "", couleur: "#88ACEA", codeAnalytique: "", dateDebut: "", dateFin: "" },
          { lieu: "Réunion", debut: "14:00", fin: "16:00", adresse: "Salle Polyvalente", territoire: "", couleur: "#F9945D", codeAnalytique: "", dateDebut: "", dateFin: "" },
          { lieu: "Accompagnement", debut: "09:00", fin: "18:00", adresse: "Extérieur", territoire: "", couleur: "#A9E0C9", codeAnalytique: "", dateDebut: "", dateFin: "" },
          { lieu: "Congés", debut: "00:00", fin: "23:59", adresse: "-", territoire: "", couleur: "#EF736A", codeAnalytique: "", dateDebut: "", dateFin: "" }
        ];
        initiales.forEach(act => addDoc(collection(db, "activites_types"), act));
      } else {
        setActivitesTypes(docs);
        // Archivage automatique dès que dateFin est dépassée (voir
        // estModeleExpire) — même logique qu'app/mediation/modeles/page.tsx,
        // dupliquée ici pour que ça se déclenche même si personne ne visite
        // la page Modèles (l'agenda est ouvert bien plus souvent).
        docs.forEach(m => {
          if (m.id && estModeleExpire(m) && !m.archive) {
            updateDoc(doc(db, "activites_types", m.id), { archive: true }).catch(console.error);
          }
        });
      }
    });

    const unsubBlocs = onSnapshot(collection(db, "blocs_config"), (snap) => {
      if (snap.metadata.fromCache === false) {
        const idsExistants = new Set(snap.docs.map(d => d.id));
        BLOCS_THEMATIQUES
          .filter(b => !idsExistants.has(b.id))
          .forEach(b => setDoc(doc(db, "blocs_config", b.id), { nom: b.nom, couleur: b.couleur }));
      }
      setBlocsColors(prev => {
        const next = { ...prev };
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.couleur) next[d.id] = data.couleur;
        });
        return next;
      });
    });

    return () => { unsubActs(); unsubSemaines(); unsubNotifs(); unsubLocs(); unsubBlocs(); unsubHoraires(); };
  }, [filtrePersoUniquement, currentUserId]);

  const mediateurs = React.useMemo(() => {
    const data = mediateursBruts as Mediateur[];
    return [...data].sort((a, b) => {
      const priorityA = getStatusPriority(a.statut || "Permanent");
      const priorityB = getStatusPriority(b.statut || "Permanent");
      return priorityA !== priorityB ? priorityA - priorityB : (a.nom || "").localeCompare(b.nom || "");
    });
  }, [mediateursBruts]);

  // Identité de l'auteur des actions (créations/suppressions de créneaux),
  // pour l'historique de l'agenda — voir /agenda/historique.
  const currentUserMed = mediateurs.find(m => m.id === currentUserId);
  const currentUserNom = currentUserMed
    ? `${currentUserMed.prenom || ""} ${currentUserMed.nom || ""}`.trim()
    : (user?.email || "Utilisateur inconnu");

  const toggleValidationSemaine = async () => {
    try {
      const nouvelEtat = !estSemaineValidee;
      await setDoc(doc(db, "semaines_validees", currentWeekId), { validee: nouvelEtat });
      const dateSemaineStr = monday.toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
      await addDoc(collection(db, "notifications"), {
        message: nouvelEtat 
          ? `📅 Le planning de la semaine du ${dateSemaineStr} a été validé et verrouillé.`
          : `⚠️ Attention : Le planning de la semaine du ${dateSemaineStr} est en cours de modification.`,
        createdAt: Date.now(),
        lue: false
      });
    } catch (error) {
      console.error("Erreur de validation :", error);
    }
  };

  const marquerToutCommeLu = async () => {
    const batch = writeBatch(db);
    notifications.forEach(n => { if (!n.lue) batch.update(doc(db, "notifications", n.id), { lue: true }); });
    await batch.commit();
  };

  const effacerNotifications = async () => {
    const batch = writeBatch(db);
    notifications.forEach(n => batch.delete(doc(db, "notifications", n.id)));
    await batch.commit();
    setShowNotifDeleteConfirm(false);
    setIsNotifOpen(false);
  };

  const toggleMasqueMed = async (m: Mediateur) => {
    try {
      await updateDoc(doc(db, "liste_mediateurs", m.id), { masque: !m.masque });
    } catch (error) {
      console.error("Erreur de statut :", error);
    }
  };

  const handleSaveActiviteType = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!newActivite.lieu.trim()) return;
    
    const nbCreneauxEstimes = estimerNombreCreneaux(newActivite);
    if (nbCreneauxEstimes > 0) {
      const ok = await confirm(
        `Ce modèle va générer jusqu'à ${nbCreneauxEstimes} créneau(x) sur les jours ouvrés de la période choisie, pour ${newActivite.mediateursIds!.length} médiateur(s). Les cases déjà occupées seront ignorées. Continuer ?`
      );
      if (!ok) return;
    }

    try {
      const dataPayload = {
        lieu: newActivite.lieu.trim(),
        // Écrase l'ancien couple debut/fin (pré-scission matin/après-midi) :
        // sans ça, resoudreHoraireModele continuerait à y retomber dès que
        // l'un des 4 champs ci-dessous est vide, empêchant de vider
        // délibérément une demi-journée (voir handleOpenEditActivite).
        debut: "",
        fin: "",
        debutMatin: newActivite.debutMatin,
        finMatin: newActivite.finMatin,
        debutApresMidi: newActivite.debutApresMidi,
        finApresMidi: newActivite.finApresMidi,
        journeeComplete: newActivite.journeeComplete || false,
        adresse: newActivite.adresse.trim(),
        territoire: newActivite.territoire,
        couleur: newActivite.couleur,
        codeAnalytique: newActivite.codeAnalytique.trim(),
        codeACI: (newActivite.codeACI || "").trim(),
        codeInterne: (newActivite.codeInterne || "").trim(),
        dateDebut: newActivite.dateDebut,
        dateFin: newActivite.dateFin,
        blocs: newActivite.blocs || [],
        mediateursIds: newActivite.mediateursIds || [],
        generationMoment: newActivite.generationMoment || "Les deux",
        datesActives: newActivite.datesActives || [],
        estProduction: newActivite.estProduction || false,
        observationACI: newActivite.observationACI || false,
        observationACIDateFin: newActivite.observationACI ? (newActivite.observationACIDateFin || "") : ""
      };

      let idModele = editingActivite?.id;

      if (editingActivite?.id) {
        await updateDoc(doc(db, "activites_types", editingActivite.id), dataPayload);
        const qActions = query(collection(db, "planning_mediateurs"), where("lieu", "==", editingActivite.lieu));
        const snapActions = await getDocs(qActions);

        // Sur TERRAGE/MASSY/RN Observation, un ACI garde sa grille horaire
        // personnelle même quand le modèle est modifié : sans ça, cette
        // répercussion écraserait ses créneaux déjà posés avec l'horaire brut
        // du modèle (voir resoudreHoraireGrilleACI).
        const upperLieuEdite = (newActivite.lieu || "").toUpperCase();
        const concerneGrilleACI = upperLieuEdite.includes("TERRAGE") || upperLieuEdite.includes("MASSY") || upperLieuEdite.includes("OBSERVATION");
        let grillesHorairesACIPropagation: Record<string, Record<string, { debut: string; fin: string }>> | null = null;
        if (concerneGrilleACI) {
          const snapHoraires = await getDoc(doc(db, "configuration_equipe", "parametres_horaires"));
          grillesHorairesACIPropagation = snapHoraires.exists() ? (snapHoraires.data() as any) : null;
        }

        const updates = snapActions.docs.map((actionDoc) => {
          const data = actionDoc.data();
          const moment = data.moment === "Après-midi" ? "Après-midi" : "Matin";
          const med = mediateursBruts.find((m: any) => m.id === data.mediatId);
          const horaireACI = resoudreHoraireGrilleACI(newActivite.lieu, med, data.date, moment, grillesHorairesACIPropagation);
          const horaire = horaireACI || resoudreHoraireModele(newActivite, moment);
          return updateDoc(doc(db, "planning_mediateurs", actionDoc.id), {
            codeAnalytique: newActivite.codeAnalytique.trim(),
            codeACI: (newActivite.codeACI || "").trim(),
            codeInterne: (newActivite.codeInterne || "").trim(),
            couleur: newActivite.couleur,
            lieu: newActivite.lieu.trim(),
            ...(horaire ? { debut: horaire.debut, fin: horaire.fin } : {}),
            adresse: newActivite.adresse.trim(),
            territoire: newActivite.territoire,
            estProduction: newActivite.estProduction || false,
            observationACI: newActivite.observationACI || false,
            observationACIDateFin: newActivite.observationACI ? (newActivite.observationACIDateFin || "") : ""
          });
        });
        await Promise.all(updates);

        if (selectedModel?.id === editingActivite.id) {
          setSelectedModel({ id: editingActivite.id, ...dataPayload });
        }
      } else {
        const ref = await addDoc(collection(db, "activites_types"), dataPayload);
        idModele = ref.id;
      }

      if (nbCreneauxEstimes > 0) {
        const { crees, ignores } = await genererCreneauxPourModele({ ...dataPayload, id: idModele }, mediateurs);
        showToast(`${crees} créneau(x) généré(s)${ignores > 0 ? `, ${ignores} déjà occupé(s) ignoré(s)` : ""}.`);
      }

      setNewActivite(ACTIVITE_VIDE);
      setEditingActivite(null);
      setSelectedLieuPredefini("");
      setIsActiviteModalOpen(false);
    } catch (error) {
      console.error("Erreur sauvegarde modèle :", error);
    }
  };

  // Rattrape la synchro Google Agenda de TOUT planning_mediateurs — la Cloud
  // Function ne réagit qu'aux vraies écritures Firestore (voir
  // functions/src/index.ts), donc un simple horodatage "resyncGoogleDemande"
  // sur chaque créneau existant suffit à déclencher son passage en revue,
  // sans toucher à l'horaire/lieu réel. Ignoré silencieusement pour les
  // médiateurs qui n'ont toujours pas connecté leur compte (la fonction
  // s'arrête d'elle-même dans ce cas). Sert de filet de sécurité : la
  // connexion initiale (app/api/google-calendar/callback/route.ts) pose déjà
  // ce même horodatage sur tout l'historique de la personne dès qu'elle se
  // connecte pour la première fois. Écriture par lots de 450 (marge sous la
  // limite Firestore de 500 opérations par batch).
  const [resyncGlobalEnCours, setResyncGlobalEnCours] = useState(false);
  const forcerSyncGoogleAgendaGlobale = async () => {
    if (!(await confirm("Forcer la resynchronisation de TOUT l'agenda des médiateurs avec Google Agenda ? Cette opération peut prendre plusieurs minutes."))) return;
    setResyncGlobalEnCours(true);
    try {
      const snapActions = await getDocs(collection(db, "planning_mediateurs"));
      let batch = writeBatch(db);
      let opsDansBatch = 0;
      for (const actionDoc of snapActions.docs) {
        batch.update(actionDoc.ref, { resyncGoogleDemande: Date.now() });
        opsDansBatch++;
        if (opsDansBatch >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          opsDansBatch = 0;
        }
      }
      if (opsDansBatch > 0) await batch.commit();
      showToast(`Resynchronisation demandée pour ${snapActions.size} créneau(x).`);
    } catch (error) {
      console.error("Erreur lors de la resynchronisation globale Google Agenda :", error);
      showToast("Erreur lors de la resynchronisation.", "error");
    } finally {
      setResyncGlobalEnCours(false);
    }
  };

  // Même principe que forcerSyncGoogleAgendaGlobale, mais limité à un seul
  // mois (requête filtrée sur "date", au format YYYY-MM-DD) — permet de
  // rattraper progressivement plutôt que de forcer toute la collection d'un
  // coup, plus facile à vérifier mois par mois si des créneaux restent
  // absents de Google Agenda après coup.
  const [moisResync, setMoisResync] = useState(() => currentDate.toLocaleDateString('en-CA').slice(0, 7));
  const [resyncMoisEnCours, setResyncMoisEnCours] = useState(false);
  const forcerSyncGoogleAgendaMois = async () => {
    if (!moisResync) return;
    const [an, mois] = moisResync.split("-").map(Number);
    if (!an || !mois) return;
    const debutMoisStr = `${moisResync}-01`;
    const dernierJour = new Date(an, mois, 0).getDate();
    const finMoisStr = `${moisResync}-${String(dernierJour).padStart(2, "0")}`;
    if (!(await confirm(`Forcer la resynchronisation de l'agenda des médiateurs de ${moisResync} avec Google Agenda ?`))) return;
    setResyncMoisEnCours(true);
    try {
      const snapActions = await getDocs(query(
        collection(db, "planning_mediateurs"),
        where("date", ">=", debutMoisStr),
        where("date", "<=", finMoisStr)
      ));
      let batch = writeBatch(db);
      let opsDansBatch = 0;
      for (const actionDoc of snapActions.docs) {
        batch.update(actionDoc.ref, { resyncGoogleDemande: Date.now() });
        opsDansBatch++;
        if (opsDansBatch >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          opsDansBatch = 0;
        }
      }
      if (opsDansBatch > 0) await batch.commit();
      showToast(`Resynchronisation demandée pour ${snapActions.size} créneau(x) de ${moisResync}.`);
    } catch (error) {
      console.error("Erreur lors de la resynchronisation mensuelle Google Agenda :", error);
      showToast("Erreur lors de la resynchronisation.", "error");
    } finally {
      setResyncMoisEnCours(false);
    }
  };

  const handleOpenEditActivite = (type: ActiviteType, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingActivite(type);
    // resoudreHoraireAffichage (pas resoudreHoraireModele) : un modèle legacy
    // qui ne concernait déjà qu'une demi-journée (generationMoment "Matin" ou
    // "Après-midi") doit rouvrir avec l'autre champ vide, pas prérempli avec
    // le même horaire — sans quoi le vider et l'enregistrer ne "collait"
    // jamais (l'ancien debut/fin repartait dans les deux à la réédition).
    const hMatin = resoudreHoraireAffichage(type, "Matin");
    const hApresMidi = resoudreHoraireAffichage(type, "Après-midi");
    setNewActivite({
      lieu: type.lieu || "",
      debutMatin: hMatin?.debut || "",
      finMatin: hMatin?.fin || "",
      debutApresMidi: hApresMidi?.debut || "",
      finApresMidi: hApresMidi?.fin || "",
      journeeComplete: type.journeeComplete || false,
      adresse: type.adresse || "",
      territoire: type.territoire || "",
      couleur: type.couleur || "#005259",
      codeAnalytique: type.codeAnalytique || "",
      codeACI: type.codeACI || "",
      codeInterne: type.codeInterne || "",
      dateDebut: type.dateDebut || "",
      dateFin: type.dateFin || "",
      blocs: type.blocs || [],
      mediateursIds: type.mediateursIds || [],
      generationMoment: type.generationMoment || "Les deux",
      datesActives: type.datesActives || [],
      estProduction: type.estProduction || false,
      observationACI: type.observationACI || false,
      observationACIDateFin: type.observationACIDateFin || ""
    });
    // Retrouve, si possible, l'adresse prédéfinie correspondante pour que le
    // menu déroulant affiche la bonne sélection au lieu de retomber sur
    // "-- Choisir une adresse --" à chaque réouverture pour édition.
    const locMatch = localisations?.find(
      (l) => `${l.adresse || ""}, ${l.codePostal || ""} ${l.ville || ""}`.trim() === (type.adresse || "").trim()
    );
    setSelectedLieuPredefini(locMatch ? (locMatch.nomCourt || locMatch.nomRaccourci || locMatch.nomComplet) : "");
    setOpenSections(sectionsOuvertesInitiales(type));
    setIsActiviteModalOpen(true);
  };

  const handleDeleteActiviteType = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cible = activitesTypes.find(t => t.id === id);
    if (estModeleProtege(cible?.lieu)) {
      showToast("🔒 Ce modèle est protégé (Suresnes ou grille horaire ACI) et ne peut pas être supprimé.", "error");
      return;
    }
    await deleteDoc(doc(db, "activites_types", id));
    if (selectedModel?.id === id) setSelectedModel(null);
  };

  // Change la couleur d'un bloc thématique et la répercute sur tous les
  // modèles qui lui sont rattachés, ainsi que sur les créneaux déjà
  // positionnés sur le planning pour ces modèles (passés compris) — le bloc
  // devient la source de vérité de la couleur pour tout ce qui lui est
  // rattaché, jusqu'à ce que la couleur du bloc change à nouveau.
  const handleChangeBlocColor = async (blocId: string, newColor: string) => {
    setBlocsColors(prev => ({ ...prev, [blocId]: newColor }));
    try {
      await setDoc(doc(db, "blocs_config", blocId), { couleur: newColor }, { merge: true });

      const modelesAttaches = activitesTypes.filter(t => (t.blocs || []).includes(blocId));
      if (modelesAttaches.length === 0) return;

      const batchModeles = writeBatch(db);
      modelesAttaches.forEach(t => {
        if (t.id) batchModeles.update(doc(db, "activites_types", t.id), { couleur: newColor });
      });
      await batchModeles.commit();

      const lieuxConcernes = Array.from(new Set(modelesAttaches.map(t => t.lieu).filter(Boolean)));
      for (let i = 0; i < lieuxConcernes.length; i += 30) {
        const chunkLieux = lieuxConcernes.slice(i, i + 30);
        const qSlots = query(collection(db, "planning_mediateurs"), where("lieu", "in", chunkLieux));
        const snapSlots = await getDocs(qSlots);
        for (let j = 0; j < snapSlots.docs.length; j += 450) {
          const batchSlots = writeBatch(db);
          snapSlots.docs.slice(j, j + 450).forEach(d => batchSlots.update(d.ref, { couleur: newColor }));
          await batchSlots.commit();
        }
      }

      showToast(`Couleur mise à jour pour ${modelesAttaches.length} modèle(s) et leurs créneaux.`);
    } catch (err) {
      console.error("Erreur lors de la mise à jour de la couleur du bloc :", err);
      showToast("Erreur lors de la mise à jour de la couleur du bloc.", "error");
    }
  };

  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
    const mon = new Date(date.setDate(diff));
    mon.setHours(12, 0, 0, 0);
    return mon;
  };
  const monday = getMonday(currentDate);
  
  const totalDays = voirSamedi ? 6 : 5;
  const weekDays = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  // Jours fériés à bloquer/griser sur la semaine affichée (une semaine peut
  // chevaucher deux années civiles autour du 1er janvier).
  const joursFeries = new Set<string>();
  Array.from(new Set(weekDays.map(d => d.getFullYear()))).forEach(annee => {
    getJoursFeries(annee).forEach(dateStr => joursFeries.add(dateStr));
  });

  // Période de la vue GANTT (distincte de la semaine éditée ci-dessus —
  // voir ganttMoisDebut/ganttNombreMois et l'effet actionsGantt).
  const [ganttAn, ganttMoisNum] = ganttMoisDebut.split("-").map(Number);
  const premierJourGantt = (ganttAn && ganttMoisNum) ? new Date(ganttAn, ganttMoisNum - 1, 1) : null;
  const dernierJourGantt = (ganttAn && ganttMoisNum) ? new Date(ganttAn, ganttMoisNum - 1 + ganttNombreMois, 0) : null;
  const mediateursGanttSelectionnes = mediateurs.filter(m => ganttMediateurIds.includes(m.id));
  const normaliserPourComparaison = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const lieuxAbsenceNormalises = new Set(lieuxAbsenceConfig.map(normaliserPourComparaison));
  const estLieuAbsence = (lieu?: string) => !!lieu && lieuxAbsenceNormalises.has(normaliserPourComparaison(lieu));
  // "Isoler absences" : identifiants des personnes ayant au moins une
  // absence sur toute la période GANTT (indépendamment du filtre médiateur
  // ci-dessus, pour rester correct même filtré sur une seule personne).
  const medIdsAvecAbsenceGantt = new Set(
    ganttFiltreAbsences === "isoler"
      ? actionsGantt.filter(a => estLieuAbsence(a.lieu)).map(identifiantMediateur)
      : []
  );
  const actionsGanttFiltrees = actionsGantt
    .filter(a => ganttFiltreProduction !== "production" || a.estProduction)
    .filter(a => mediateursGanttSelectionnes.length === 0 || mediateursGanttSelectionnes.some(m => estActionDuMediateur(a, m)))
    .filter(a => ganttFiltreAbsences === "tous" || medIdsAvecAbsenceGantt.has(identifiantMediateur(a)));
  // Jours fériés sur toute la période GANTT (potentiellement plusieurs
  // années, contrairement à joursFeries ci-dessus qui ne couvre que la
  // semaine éditée).
  const joursFeriesGantt = new Set<string>();
  if (premierJourGantt && dernierJourGantt) {
    for (let an = premierJourGantt.getFullYear(); an <= dernierJourGantt.getFullYear(); an++) {
      getJoursFeries(an).forEach(dateStr => joursFeriesGantt.add(dateStr));
    }
  }

  // Jours ouvrés (ni week-end ni férié) de la période GANTT où chaque
  // médiateur·rice filtré·e (voir ganttMediateurIds) n'a AUCUNE action —
  // regroupés par mois, pour repérer d'un coup d'œil les trous de planning
  // sur plusieurs mois. Une entrée par personne sélectionnée.
  const joursSansRienParMediateur: { medId: string; medLabel: string; mois: { cle: string; label: string; jours: number[] }[] }[] = [];
  if (mediateursGanttSelectionnes.length > 0 && premierJourGantt && dernierJourGantt) {
    for (const m of mediateursGanttSelectionnes) {
      // Toujours basé sur TOUTES les actions de la personne, indépendamment
      // du distingo Tout/Production affiché sur la grille : un jour où elle
      // n'a qu'une action hors production (ex. congé, formation) n'est pas
      // un vrai jour vide, il ne doit jamais apparaître ici même filtré sur
      // "Production" seule.
      const datesAvecAction = new Set(
        actionsGantt.filter(a => estActionDuMediateur(a, m)).map(a => a.date)
      );
      const parMois = new Map<string, { label: string; jours: number[] }>();
      const curseur = new Date(premierJourGantt);
      while (curseur <= dernierJourGantt) {
        const jourSemaine = curseur.getDay();
        const dateStr = curseur.toLocaleDateString('en-CA');
        const estOuvre = jourSemaine !== 0 && jourSemaine !== 6 && !joursFeriesGantt.has(dateStr);
        if (estOuvre && !datesAvecAction.has(dateStr)) {
          const cleMois = `${curseur.getFullYear()}-${String(curseur.getMonth() + 1).padStart(2, "0")}`;
          if (!parMois.has(cleMois)) {
            parMois.set(cleMois, { label: curseur.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), jours: [] });
          }
          parMois.get(cleMois)!.jours.push(curseur.getDate());
        }
        curseur.setDate(curseur.getDate() + 1);
      }
      joursSansRienParMediateur.push({
        medId: m.id,
        medLabel: `${m.prenom || ""} ${m.nom || ""}`.trim(),
        mois: Array.from(parMois.entries()).map(([cle, v]) => ({ cle, ...v })).sort((a, b) => a.cle.localeCompare(b.cle)),
      });
    }
  }

  // Médiateurs réellement affichés dans la grille cette semaine (actifs,
  // avec une identité, jamais les Formateurs — statut réservé à la page
  // Équipe, sans créneaux à planifier ici — ni les fiches exclureAgenda
  // (comptes génériques non individuels) — et masqués uniquement s'ils
  // n'ont aucune action cette semaine ou si "voir les masqués" est activé)
  // — base commune du tri par catégorie ci-dessous.
  // Créneaux (jour + demi-journée + site) du compte connecté cette semaine —
  // sert au filtre "Avec moi" ci-dessous (expansion : soi-même + les
  // médiateur·rice·s qui partagent un créneau avec soi).
  const creneauxAvecMoi = new Set<string>();
  if (avecMoiUniquement && currentUserMed) {
    actions.forEach(a => {
      if (!a.lieu || !a.date || estLieuGeneriqueAvecMoi(a.lieu)) return;
      if (!weekDays.some(day => day.toLocaleDateString('en-CA') === a.date)) return;
      if (jourAvecMoi && a.date !== jourAvecMoi) return;
      if (!estActionDuMediateur(a, currentUserMed)) return;
      creneauxAvecMoi.add(`${a.date}_${a.moment || ""}_${familleSitePourAvecMoi(a.lieu)}`);
    });
  }

  // Réservé aux admins : sélection directe de médiateur·rice·s — masque
  // toutes les AUTRES lignes, sans expansion aux personnes qui partagent
  // leurs créneaux (contrairement à "Avec moi" ci-dessus).
  const avecMediateursSelectionnes = mediateurs.filter(m => avecMediateursIds.includes(m.id));

  const mediateursAffiches = mediateurs
    .filter(m => m.actif !== false && (m.prenom || m.nom) && m.statut !== "Formateur" && !m.exclureAgenda)
    .filter(m => {
      if (voirMasques) return true;
      if (!m.masque) return true;

      return actions.some((action) => {
        const estCetteSemaine = weekDays.some(day => day.toLocaleDateString('en-CA') === action.date);
        return estActionDuMediateur(action, m) && estCetteSemaine;
      });
    })
    .filter(m => {
      if (!avecMoiUniquement || !currentUserMed) return true;
      if (m.id === currentUserMed.id) return true;
      return actions.some(a => {
        if (!a.lieu || !a.date || estLieuGeneriqueAvecMoi(a.lieu) || !estActionDuMediateur(a, m)) return false;
        return creneauxAvecMoi.has(`${a.date}_${a.moment || ""}_${familleSitePourAvecMoi(a.lieu)}`);
      });
    })
    .filter(m => avecMediateursIds.length === 0 || avecMediateursIds.includes(m.id));

  // Tri par groupe ACI (les non-classés passent après), puis alphabétique par
  // nom de famille à l'intérieur d'un même groupe (ou entre non-classés) —
  // cohérent avec l'affichage Prénom / NOM de la case.
  const groupesMediateursAgenda = regrouperParCategorie(mediateursAffiches).map(groupe => ({
    ...groupe,
    membres: [...groupe.membres].sort((a, b) => {
      const ga = a.groupeACI ?? Number.MAX_SAFE_INTEGER;
      const gb = b.groupeACI ?? Number.MAX_SAFE_INTEGER;
      if (ga !== gb) return ga - gb;
      const nomA = `${a.nom || ""} ${a.prenom || ""}`.trim();
      const nomB = `${b.nom || ""} ${b.prenom || ""}`.trim();
      return nomA.localeCompare(nomB, "fr");
    })
  }));

  // Une fois la semaine et les médiateurs chargés, déplie la catégorie
  // contenant le médiateur ciblé (si elle avait été repliée), fait défiler
  // jusqu'à sa ligne et la surligne brièvement — voir l'effet de lecture de
  // ?date=/?med= plus haut. Léger délai pour laisser le DOM se peindre avant
  // de mesurer sa position.
  useEffect(() => {
    if (!medASurligner || mediateurs.length === 0) return;
    const groupeCible = groupesMediateursAgenda.find(g => g.membres.some(m => m.id === medASurligner));
    if (groupeCible && categoriesOuvertesAgenda[groupeCible.key] === false) {
      setCategoriesOuvertesAgenda(prev => ({ ...prev, [groupeCible.key]: true }));
    }
    const timer = setTimeout(() => {
      document.getElementById(`ligne-med-${medASurligner}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    const timerEffacement = setTimeout(() => setMedASurligner(null), 4000);
    return () => { clearTimeout(timer); clearTimeout(timerEffacement); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medASurligner, mediateurs.length, actions.length]);

  const processActionCreation = async (
    mediatId: string,
    prenom: string,
    nom: string,
    moment: string,
    dateStr: string,
    lieuInput: string,
    horaireManuel?: { debut: string; fin: string } | null,
    // Fournie par un glisser-déposer (deplacerAction) : l'action d'origine,
    // dont couleur/adresse/territoire/codeAnalytique/horaire priment sur le
    // modèle actuellement sélectionné (on relocalise l'action telle quelle,
    // on ne lui applique pas un modèle différent).
    actionSource?: ActionPlanning
  ) => {
    let lieu = lieuInput;
    if (!lieu) return;

    const upperLieu = lieu.toUpperCase();
    // "RN Observation" (accompagnement d'un médiateur en observation, pas de
    // permanence ouverte au public) ne doit pas générer de créneaux Suresnes.
    const isSuresnesAction = (upperLieu.includes("RN") || upperLieu.includes("RND")) && !upperLieu.includes("OBSERVATION");
    const nomCompletLiaison = `${prenom} ${nom}`.trim();
    const medObj = mediateurs.find(m => m.id === mediatId);
    const estACI = medObj?.statut === "ACI";

    // Sur TERRAGE/MASSY, un ACI travaille selon sa propre grille horaire
    // plutôt que selon les horaires fixes du modèle sélectionné — voir
    // genererCreneauxPourModele pour la même règle côté génération en masse.
    // RN Observation suit la même logique, mais son lieu ne désigne pas un
    // site physique précis : on utilise alors le rattachement personnel de
    // l'ACI (rattachementHoraireACI, "Paris" par défaut).
    const horaireOverride = resoudreHoraireGrilleACI(lieu, medObj, dateStr, moment === "Après-midi" ? "Après-midi" : "Matin", grillesHorairesACI);

    let dateFormatee = dateStr;
    try {
      const [yyyy, mm, dd] = dateStr.split("-");
      if (yyyy && mm && dd) dateFormatee = `${dd}/${mm}`;
    } catch (e) {}

    const qSuresnes = query(
      collection(db, "planning_suresnes"),
      where("date", "==", dateStr),
      where("moment", "==", moment),
      where("mediateurNom", "==", nomCompletLiaison)
    );
    const snapSuresnes = await getDocs(qSuresnes);
    const hasUsagers = snapSuresnes.docs.some(d => d.data().usager && d.data().usager.trim() !== "");

    if (hasUsagers && !isSuresnesAction) {
      showToast(`⚠️ IMPOSSIBLE DE SUPPRIMER/DÉPLACER : ${prenom} ${nom} a des usagers inscrits à Suresnes.`, "error");
      return;
    }

    const deletes = snapSuresnes.docs.map(d => (!d.data().usager ? deleteDoc(doc(db, "planning_suresnes", d.id)) : Promise.resolve()));
    await Promise.all(deletes);

    const aDejaAction = actions.some((a) => estActionDuMediateur(a, { id: mediatId, prenom, nom }) && a.date === dateStr && a.moment === moment);

    // Nouvelle action posée en dernière position de sa demi-journée (voir le
    // champ "ordre", réordonnable ensuite par glisser-déposer dans DayCell).
    const ordreMax = actions
      .filter((x) => estActionDuMediateur(x, { id: mediatId, prenom, nom }) && x.date === dateStr && x.moment === moment)
      .reduce((max, x) => Math.max(max, x.ordre ?? 0), -1);

    const horaireFinal = horaireManuel || horaireOverride
      || (actionSource?.debut && actionSource?.fin ? { debut: actionSource.debut, fin: actionSource.fin } : null)
      || (selectedModel ? resoudreHoraireModele(selectedModel, moment === "Après-midi" ? "Après-midi" : "Matin") : null);
    const adresseFinale = actionSource?.adresse || selectedModel?.adresse;
    const territoireFinal = actionSource?.territoire || selectedModel?.territoire;
    const codeAnalytiqueFinal = actionSource?.codeAnalytique || selectedModel?.codeAnalytique;
    const codeACIFinal = actionSource?.codeACI || selectedModel?.codeACI;
    const codeInterneFinal = actionSource?.codeInterne || selectedModel?.codeInterne;
    const estProductionFinal = actionSource?.estProduction ?? selectedModel?.estProduction ?? false;
    const observationACIFinal = actionSource?.observationACI ?? selectedModel?.observationACI ?? false;
    const observationACIDateFinFinal = actionSource?.observationACIDateFin ?? selectedModel?.observationACIDateFin;

    await addDoc(collection(db, "planning_mediateurs"), {
      mediatId: mediatId,
      mediateurNom: nomCompletLiaison,
      moment,
      date: dateStr,
      lieu,
      type: "Action",
      commentaire: "",
      ordre: ordreMax + 1,
      couleur: actionSource?.couleur || selectedModel?.couleur || "#005259",
      estProduction: estProductionFinal,
      ...(adresseFinale ? { adresse: adresseFinale } : {}),
      ...(horaireFinal ? { debut: horaireFinal.debut, fin: horaireFinal.fin } : {}),
      ...(territoireFinal ? { territoire: territoireFinal } : {}),
      ...(codeAnalytiqueFinal ? { codeAnalytique: codeAnalytiqueFinal } : {}),
      ...(codeACIFinal ? { codeACI: codeACIFinal } : {}),
      ...(codeInterneFinal ? { codeInterne: codeInterneFinal } : {}),
      ...(observationACIFinal ? { observationACI: true } : {}),
      ...(observationACIFinal && observationACIDateFinFinal ? { observationACIDateFin: observationACIDateFinFinal } : {})
    });

    // Historique de l'agenda ("qui a positionné quoi") — voir /agenda/historique.
    // Non bloquant : un souci sur ce journal (ex. règles pas encore
    // déployées) ne doit jamais empêcher la suite (notification, Suresnes).
    addDoc(collection(db, "historique_agenda"), {
      type: "creation",
      date: dateStr,
      moment,
      mediatId,
      mediateurNom: nomCompletLiaison,
      lieu,
      auteurUid: currentUserId,
      auteurNom: currentUserNom,
      horodatage: Date.now()
    }).catch((err) => console.error("Historique agenda (création) :", err));

    // Le mercredi compte intégralement en heures complémentaires pour un ACI
    // (voir calculerHeuresComplementairesACI) — signalé après coup, sans
    // bloquer la création du créneau.
    if (estACI && medObj?.dureeHebdoACI !== "35h" && new Date(`${dateStr}T00:00:00`).getDay() === 3) {
      showToast(`ℹ️ Mercredi : ce créneau de ${prenom} compte intégralement en heures complémentaires (ACI).`);
    }

    await addDoc(collection(db, "notifications"), {
      destinataireId: mediatId,
      message: aDejaAction 
        ? `🔄 Activité remplacée : Vous êtes planifié(e) sur "${lieu}" le ${dateFormatee} (${moment}).`
        : `📅 Nouvelle activité : Vous êtes planifié(e) sur "${lieu}" le ${dateFormatee} (${moment}).`,
      createdAt: Date.now(),
      lue: false
    });

    if (isSuresnesAction) {
      const isRND = upperLieu.includes("RND");
      // Même agenda planning_suresnes, plusieurs sites RN distingués par le
      // numéro de département dans le nom du lieu (voir genererCreneauxPourModele).
      const siteSuresnes = upperLieu.includes("91") ? "rn91" : "suresnes";
      const horaires = horairesSuresnesPourSite(siteSuresnes, moment === "Après-midi" ? "Après-midi" : "Matin");
      const nomAvecType = siteSuresnes === "rn91" ? `${nomCompletLiaison} (RN91)` : isRND ? `${nomCompletLiaison} (RND)` : `${nomCompletLiaison} (RN)`;

      for (const h of horaires) {
        await addDoc(collection(db, "planning_suresnes"), {
          mediateurNom: nomAvecType,
          date: dateStr,
          moment,
          horaire: h,
          usager: "",
          site: siteSuresnes
        });
      }
    }
  };

  // Déplace une action existante vers une autre case (jour/demi-journée/
  // médiateur·rice) par glisser-déposer entre cases : recrée l'action à
  // destination via processActionCreation (couleur/adresse/territoire/code
  // analytique/horaire d'origine préservés, sauf grille ACI applicable à
  // destination), puis supprime l'originale — même sécurité que la
  // suppression manuelle (jamais si un usager Suresnes est déjà inscrit sur
  // la case d'origine).
  const deplacerAction = async (action: ActionPlanning, mDest: Mediateur, momentDest: string, dateDest: string) => {
    if (!canCreateSlot || !canDeleteSlot) return;
    if (estSemaineValidee) {
      showToast("🔒 Semaine validée et verrouillée.", "error");
      return;
    }
    if (estActionDuMediateur(action, mDest) && action.moment === momentDest && action.date === dateDest) return;

    try {
      // Comme confirmDeleteAction : ne touche/ne bloque sur planning_suresnes
      // que si l'action déplacée est elle-même Suresnes/RN.
      const upperLieuAction = (action.lieu || "").toUpperCase();
      const estActionSuresnes = (upperLieuAction.includes("RN") || upperLieuAction.includes("RND")) && !upperLieuAction.includes("OBSERVATION");
      let docsDuMediateurSource: QueryDocumentSnapshot<DocumentData>[] = [];

      if (estActionSuresnes) {
        const qSuresnesSource = query(collection(db, "planning_suresnes"), where("date", "==", action.date), where("moment", "==", action.moment));
        const snapSuresnesSource = await getDocs(qSuresnesSource);
        const variantesSource = variantesMediateurSuresnes(action.lieu || "", action.mediateurNom || "");
        docsDuMediateurSource = snapSuresnesSource.docs.filter((d) => variantesSource.includes(d.data().mediateurNom || ""));
        if (docsDuMediateurSource.some((d) => d.data().usager && d.data().usager.trim() !== "")) {
          showToast("⚠️ Déplacement par glisser-déposer impossible : des bénéficiaires sont déjà inscrits sur ce créneau Suresnes. Utilisez \"Réaffecter médiateur\" depuis l'agenda Suresnes pour les conserver.", "error");
          return;
        }
      }

      await processActionCreation(mDest.id, mDest.prenom || "", mDest.nom || "", momentDest, dateDest, action.lieu || "", null, action);

      await Promise.all(docsDuMediateurSource.map((d) => deleteDoc(doc(db, "planning_suresnes", d.id))));
      await deleteDoc(doc(db, "planning_mediateurs", action.id));

      addDoc(collection(db, "historique_agenda"), {
        type: "suppression",
        date: action.date,
        moment: action.moment,
        mediatId: action.mediatId,
        mediateurNom: action.mediateurNom || "",
        lieu: action.lieu || "",
        auteurUid: currentUserId,
        auteurNom: currentUserNom,
        horodatage: Date.now()
      }).catch((err) => console.error("Historique agenda (déplacement, origine) :", err));
    } catch (err) {
      // Sans ce filet, une erreur ici (ex. droits insuffisants) restait une
      // promesse rejetée jamais attendue par deposerIci — invisible pour
      // l'utilisateur, qui ne voyait que le créneau ne pas bouger.
      console.error("Erreur lors du déplacement du créneau :", err);
      showToast("❌ Erreur lors du déplacement du créneau.", "error");
    }
  };

  const handleCaseClick = async (mediatId: string, prenom: string, nom: string, moment: string, dateStr: string) => {
    if (!canCreateSlot) return;
    if (estSemaineValidee) {
      showToast("🔒 Semaine validée et verrouillée.", "error");
      return;
    }

    if (selectedModel) {
      await processActionCreation(mediatId, prenom, nom, moment, dateStr, selectedModel.lieu);
    } else {
      setPromptLieuInput("");
      setPromptDebutInput("");
      setPromptFinInput("");
      setPromptModalData({ mediatId, prenom, nom, moment, dateStr });
    }
  };

  const handleConfirmActionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptModalData || !promptLieuInput.trim()) return;

    const { mediatId, prenom, nom, moment, dateStr } = promptModalData;
    const lieu = promptLieuInput.trim();
    const horaireManuel = promptDebutInput && promptFinInput ? { debut: promptDebutInput, fin: promptFinInput } : null;

    setPromptModalData(null);
    setPromptLieuInput("");
    setPromptDebutInput("");
    setPromptFinInput("");

    await processActionCreation(mediatId, prenom, nom, moment, dateStr, lieu, horaireManuel);
  };

  const handleEditCommentaire = (actionId: string, currentCommentaire: string) => {
    if (!canViewComment && !canEditComment) return;
    setActiveCommentModal({
      actionId,
      currentText: currentCommentaire || "",
      inputText: currentCommentaire || "",
      readOnly: estSemaineValidee || !canEditComment
    });
  };

  // Clic sur une case déjà remplie : propose de la modifier (lieu/horaires)
  // ou de la commenter, plutôt que d'ouvrir directement le commentaire comme
  // avant — les deux actions n'étaient pas différenciables au clic.
  const handleSlotClick = (action: ActionPlanning) => {
    if (!canCreateSlot && !canViewComment && !canEditComment) return;
    setChoixActionData(action);
  };

  const handleDemarrerEditionAction = () => {
    if (!choixActionData) return;
    setEditActionData({
      id: choixActionData.id,
      lieu: choixActionData.lieu || "",
      debut: choixActionData.debut || "",
      fin: choixActionData.fin || ""
    });
    setChoixActionData(null);
  };

  const handleConfirmEditAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editActionData || !editActionData.lieu.trim()) return;
    const { id, lieu, debut, fin } = editActionData;
    setEditActionData(null);
    const actionDoc = actions.find(a => a.id === id);
    const nouveauLieu = lieu.trim();
    const champs: { lieu: string; debut?: string; fin?: string } = { lieu: nouveauLieu };
    if (debut && fin) {
      champs.debut = debut;
      champs.fin = fin;
    }
    try {
      // Contrairement à processActionCreation (case vide/glisser-déposer),
      // cette modale ne fait qu'un updateDoc sur le lieu — sans ce qui suit,
      // remplacer un lieu non-RN (Terrage...) par un lieu RN via "Modifier
      // l'action" ne générait jamais les créneaux du planning Suresnes (et
      // inversement, en sortir n'en retirait jamais les créneaux devenus
      // orphelins).
      if (actionDoc) {
        const upperAncien = (actionDoc.lieu || "").toUpperCase();
        const upperNouveau = nouveauLieu.toUpperCase();
        const etaitSuresnes = (upperAncien.includes("RN") || upperAncien.includes("RND")) && !upperAncien.includes("OBSERVATION");
        const estSuresnesMaintenant = (upperNouveau.includes("RN") || upperNouveau.includes("RND")) && !upperNouveau.includes("OBSERVATION");
        const nomCompletLiaison = actionDoc.mediateurNom || "";
        // Les créneaux Suresnes sont enregistrés avec le nom du médiateur
        // suffixé selon le type ("(RN)", "(RN91)", "(RND)") — jamais le nom
        // brut — donc une égalité stricte sur nomCompletLiaison ne trouverait
        // jamais rien ; on teste les variantes possibles, scopées au lieu
        // concerné (voir variantesMediateurSuresnes) pour ne jamais confondre
        // le 91 et le 92.

        // Quitte Suresnes (RN -> autre chose) : vérifié AVANT de toucher au
        // lieu — sans quoi le changement était appliqué puis seulement
        // signalé après coup, laissant les créneaux Suresnes déjà réservés
        // orphelins (et bloquant ensuite, à tort, la suppression de CETTE
        // action désormais non-Suresnes — voir confirmDeleteAction, qui se
        // base sur date+moment+médiateur, pas sur le lieu).
        if (!estSuresnesMaintenant && etaitSuresnes) {
          const qExistant = query(
            collection(db, "planning_suresnes"),
            where("date", "==", actionDoc.date),
            where("moment", "==", actionDoc.moment),
            where("mediateurNom", "in", variantesMediateurSuresnes(actionDoc.lieu || "", nomCompletLiaison))
          );
          const snapExistant = await getDocs(qExistant);
          const hasUsagers = snapExistant.docs.some(d => d.data().usager && d.data().usager.trim() !== "");
          if (hasUsagers) {
            showToast("⚠️ Changement de lieu impossible : des usagers sont inscrits à Suresnes sur ce créneau.", "error");
            return;
          }
          await updateDoc(doc(db, "planning_mediateurs", id), champs);
          await Promise.all(snapExistant.docs.map(d => deleteDoc(doc(db, "planning_suresnes", d.id))));
          return;
        }

        await updateDoc(doc(db, "planning_mediateurs", id), champs);

        if (estSuresnesMaintenant && !etaitSuresnes) {
          const qExistant = query(
            collection(db, "planning_suresnes"),
            where("date", "==", actionDoc.date),
            where("moment", "==", actionDoc.moment),
            where("mediateurNom", "in", variantesMediateurSuresnes(nouveauLieu, nomCompletLiaison))
          );
          const snapExistant = await getDocs(qExistant);
          if (snapExistant.empty) {
            const isRND = upperNouveau.includes("RND");
            const siteSuresnes = upperNouveau.includes("91") ? "rn91" : "suresnes";
            const horaires = horairesSuresnesPourSite(siteSuresnes, actionDoc.moment === "Après-midi" ? "Après-midi" : "Matin");
            const nomAvecType = siteSuresnes === "rn91" ? `${nomCompletLiaison} (RN91)` : isRND ? `${nomCompletLiaison} (RND)` : `${nomCompletLiaison} (RN)`;
            for (const h of horaires) {
              await addDoc(collection(db, "planning_suresnes"), {
                mediateurNom: nomAvecType,
                date: actionDoc.date,
                moment: actionDoc.moment,
                horaire: h,
                usager: "",
                site: siteSuresnes
              });
            }
          }
        }
      } else {
        await updateDoc(doc(db, "planning_mediateurs", id), champs);
      }
    } catch (error) {
      console.error("Erreur lors de la modification de l'action :", error);
    }
  };

  const handleSaveCommentaire = async (supprimer = false) => {
    if (!activeCommentModal || activeCommentModal.readOnly) return;
    const { actionId, inputText } = activeCommentModal;
    
    try {
      const texteFinal = supprimer ? "" : inputText.trim();
      await updateDoc(doc(db, "planning_mediateurs", actionId), { commentaire: texteFinal });

      const actionCible = actions.find(a => a.id === actionId);
      if (actionCible) {
        let dateFormatee = actionCible.date;
        try {
          const [yyyy, mm, dd] = actionCible.date.split("-");
          if (yyyy && mm && dd) dateFormatee = `${dd}/${mm}`;
        } catch(e) {}

        const periode = actionCible.moment || "Présence";

        if (supprimer) {
          await addDoc(collection(db, "notifications"), {
            destinataireId: actionCible.mediatId,
            message: `🗑️ Note supprimée sur le créneau du ${dateFormatee} (${periode}).`,
            createdAt: Date.now(),
            lue: false
          });
        } else if (texteFinal !== "") {
          await addDoc(collection(db, "notifications"), {
            destinataireId: actionCible.mediatId,
            message: `📝 Note mise à jour sur le créneau du ${dateFormatee} (${periode}) : "${texteFinal}"`,
            createdAt: Date.now(),
            lue: false
          });
        }
      }
    } catch (error) {
      console.error("Erreur de commentaire :", error);
    } finally {
      setActiveCommentModal(null);
    }
  };

  const onRequestDeleteAction = (id: string) => {
    if (!canDeleteSlot) return;
    if (estSemaineValidee) {
      showToast("🔒 Semaine verrouillée.", "error");
      return;
    }
    const actionDoc = actions.find(a => a.id === id);
    if (!actionDoc) return;

    setDeleteConfirmModalData({
      id: actionDoc.id,
      lieu: actionDoc.lieu || "",
      mediateurNom: actionDoc.mediateurNom || ""
    });
  };

  const confirmDeleteAction = async () => {
    if (!deleteConfirmModalData) return;
    const id = deleteConfirmModalData.id;

    const actionDoc = actions.find(a => a.id === id);
    if (!actionDoc) {
      setDeleteConfirmModalData(null);
      return;
    }

    // Ne touche/ne bloque sur planning_suresnes QUE si l'action supprimée
    // est elle-même Suresnes/RN — sinon on risquerait de bloquer (ou de
    // supprimer) des créneaux Suresnes sans rapport, simplement parce qu'ils
    // partagent le même jour/moment/médiateur (ex. créneaux orphelins
    // laissés par un changement de lieu antérieur, voir
    // handleConfirmEditAction) : n'importe quelle action non-Suresnes du
    // médiateur devenait alors indélébile.
    const upperLieuAction = (actionDoc.lieu || "").toUpperCase();
    const estActionSuresnes = (upperLieuAction.includes("RN") || upperLieuAction.includes("RND")) && !upperLieuAction.includes("OBSERVATION");

    if (estActionSuresnes) {
      const qSuresnes = query(collection(db, "planning_suresnes"), where("date", "==", actionDoc.date), where("moment", "==", actionDoc.moment));
      const snapSuresnes = await getDocs(qSuresnes);
      const variantes = variantesMediateurSuresnes(actionDoc.lieu || "", actionDoc.mediateurNom || "");
      const docsDuMediateur = snapSuresnes.docs.filter(d => variantes.includes(d.data().mediateurNom || ""));

      if (docsDuMediateur.some(d => d.data().usager && d.data().usager.trim() !== "")) {
        showToast("⚠️ Suppression impossible : Des usagers sont inscrits à Suresnes.", "error");
        setDeleteConfirmModalData(null);
        return;
      }

      await Promise.all(docsDuMediateur.map(d => deleteDoc(doc(db, "planning_suresnes", d.id))));
    }

    await deleteDoc(doc(db, "planning_mediateurs", id));

    // Historique de l'agenda ("qui a positionné quoi") — voir /agenda/historique.
    // Non bloquant : voir la remarque équivalente dans processActionCreation.
    addDoc(collection(db, "historique_agenda"), {
      type: "suppression",
      date: actionDoc.date,
      moment: actionDoc.moment,
      mediatId: actionDoc.mediatId,
      mediateurNom: actionDoc.mediateurNom || "",
      lieu: actionDoc.lieu || "",
      auteurUid: currentUserId,
      auteurNom: currentUserNom,
      horodatage: Date.now()
    }).catch((err) => console.error("Historique agenda (suppression) :", err));

    setDeleteConfirmModalData(null);
  };

  // Nettoyage ponctuel : supprime dans toute la base (pas seulement la
  // semaine affichée) toutes les actions dont le lieu est "OFF" — comparaison
  // normalisée (espaces/casse) pour couvrir les variantes de saisie. Reprend
  // la même sécurité que les autres suppressions (jamais un créneau Suresnes
  // avec un usager inscrit).
  const supprimerActionsOFF = async () => {
    const snap = await getDocs(collection(db, "planning_mediateurs"));
    const actionsOFF = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as ActionPlanning))
      .filter((a) => (a.lieu || "").trim().toUpperCase() === "OFF");

    if (actionsOFF.length === 0) {
      showToast("Aucune action \"OFF\" trouvée.");
      return;
    }
    if (!(await confirm(`Supprimer les ${actionsOFF.length} action(s) "OFF" trouvée(s) dans toute la base ?`))) return;

    // "OFF" n'est jamais un lieu Suresnes/RN : pas besoin de vérifier/purger
    // planning_suresnes ici (voir confirmDeleteAction pour le principe).
    let supprimees = 0;
    const bloquees = 0;
    for (const actionDoc of actionsOFF) {
      await deleteDoc(doc(db, "planning_mediateurs", actionDoc.id));
      supprimees++;
    }

    if (bloquees > 0) {
      showToast(`${supprimees} action(s) "OFF" supprimée(s). ${bloquees} laissée(s) car un usager est inscrit à Suresnes.`, "error");
    } else {
      showToast(`${supprimees} action(s) "OFF" supprimée(s).`);
    }
  };

  // Rattrapage ponctuel : recalcule l'horaire des créneaux "RN Observation"
  // déjà posés (dans toute la base) pour les ACI, selon la même règle que
  // processActionCreation/genererCreneauxPourModele (grille horaire
  // personnelle rattachementHoraireACI plutôt que l'horaire fixe du modèle),
  // mais appliquée après coup — nécessaire car cette règle n'existait pas au
  // moment où ces créneaux ont été créés.
  const rattraperHorairesObservationACI = async () => {
    const snap = await getDocs(collection(db, "planning_mediateurs"));
    const joursParIndex = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    const candidats = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as ActionPlanning))
      .filter((a) => (a.lieu || "").toUpperCase().includes("OBSERVATION"));

    if (candidats.length === 0) {
      showToast("Aucun créneau \"RN Observation\" trouvé.");
      return;
    }

    const aCorriger = candidats
      .map((actionDoc) => {
        const medObj = mediateurs.find((m) => estActionDuMediateur(actionDoc, m));
        if (medObj?.statut !== "ACI" || !actionDoc.date) return null;
        const site = medObj.rattachementHoraireACI || "Paris";
        const jourKey = joursParIndex[new Date(`${actionDoc.date}T00:00:00`).getDay()];
        const h = grillesHorairesACI[site]?.[jourKey];
        if (!h?.debut || !h?.fin) return null;
        if (actionDoc.debut === h.debut && actionDoc.fin === h.fin) return null;
        return { actionDoc, horaire: h };
      })
      .filter((x): x is { actionDoc: ActionPlanning; horaire: { debut: string; fin: string } } => x !== null);

    if (aCorriger.length === 0) {
      showToast("Rien à rattraper : les créneaux ACI sont déjà à l'horaire de leur grille.");
      return;
    }
    if (!(await confirm(`Recalculer l'horaire de ${aCorriger.length} créneau(x) "RN Observation" selon la grille ACI de chacun·e ?`))) return;

    await Promise.all(aCorriger.map(({ actionDoc, horaire }) =>
      updateDoc(doc(db, "planning_mediateurs", actionDoc.id), { debut: horaire.debut, fin: horaire.fin })
    ));
    showToast(`${aCorriger.length} créneau(x) "RN Observation" recalculé(s) selon la grille ACI.`);
  };

  // Supprime en une fois toutes les actions d'un·e médiateur·rice sur la
  // semaine affichée — même règle de sécurité que la suppression au cas par
  // cas (jamais un créneau Suresnes avec un usager déjà inscrit) : les
  // actions bloquées sont laissées de côté et signalées plutôt que de tout
  // annuler à cause d'une seule d'entre elles.
  const supprimerToutesActionsDeLaLigne = async (m: Mediateur) => {
    if (!canDeleteSlot) return;
    if (estSemaineValidee) {
      showToast("🔒 Semaine verrouillée.", "error");
      return;
    }
    const datesSemaine = new Set(weekDays.map((d) => d.toLocaleDateString('en-CA')));
    const nomComplet = `${m.prenom || ""} ${m.nom || ""}`.trim();
    const actionsDeLaLigne = actions.filter((a) => estActionDuMediateur(a, m) && datesSemaine.has(a.date));

    if (actionsDeLaLigne.length === 0) {
      showToast("Aucune action à supprimer cette semaine pour cette personne.");
      return;
    }
    if (!(await confirm(`Supprimer les ${actionsDeLaLigne.length} action(s) de ${nomComplet} sur cette semaine ?`))) return;

    let supprimees = 0;
    let bloquees = 0;
    for (const actionDoc of actionsDeLaLigne) {
      // Comme confirmDeleteAction : ne bloque/ne purge planning_suresnes que
      // pour une action Suresnes/RN.
      const upperLieuAction = (actionDoc.lieu || "").toUpperCase();
      const estActionSuresnes = (upperLieuAction.includes("RN") || upperLieuAction.includes("RND")) && !upperLieuAction.includes("OBSERVATION");
      if (estActionSuresnes) {
        const qSuresnes = query(collection(db, "planning_suresnes"), where("date", "==", actionDoc.date), where("moment", "==", actionDoc.moment));
        const snapSuresnes = await getDocs(qSuresnes);
        const variantes = variantesMediateurSuresnes(actionDoc.lieu || "", nomComplet);
        const docsDuMediateur = snapSuresnes.docs.filter((d) => variantes.includes(d.data().mediateurNom || ""));
        if (docsDuMediateur.some((d) => d.data().usager && d.data().usager.trim() !== "")) {
          bloquees++;
          continue;
        }
        await Promise.all(docsDuMediateur.map((d) => deleteDoc(doc(db, "planning_suresnes", d.id))));
      }
      await deleteDoc(doc(db, "planning_mediateurs", actionDoc.id));
      addDoc(collection(db, "historique_agenda"), {
        type: "suppression",
        date: actionDoc.date,
        moment: actionDoc.moment,
        mediatId: actionDoc.mediatId,
        mediateurNom: actionDoc.mediateurNom || "",
        lieu: actionDoc.lieu || "",
        auteurUid: currentUserId,
        auteurNom: currentUserNom,
        horodatage: Date.now()
      }).catch((err) => console.error("Historique agenda (suppression) :", err));
      supprimees++;
    }

    if (bloquees > 0) {
      showToast(`${supprimees} action(s) supprimée(s). ${bloquees} laissée(s) car un usager est inscrit à Suresnes.`, "error");
    } else {
      showToast(`${supprimees} action(s) supprimée(s).`);
    }
  };

  // Injecte le modèle actuellement sélectionné (barre "Injection : ...") sur
  // toute la semaine affichée, matin ET après-midi, pour une ligne — même
  // mécanique que cliquer chaque case une par une (processActionCreation),
  // donc les mêmes règles s'appliquent (grille ACI, Suresnes, notifications).
  // Les jours fériés sont sautés, comme le "+" individuel de chaque case.
  const injecterModeleSurSemaine = async (m: Mediateur) => {
    if (!selectedModel || !canCreateSlot) return;
    if (estSemaineValidee) {
      showToast("🔒 Semaine validée et verrouillée.", "error");
      return;
    }
    // Un ACI à 26h n'est pas positionné le mercredi (jour de formation/heures
    // complémentaires, voir estMercrediACI plus bas) — un ACI à 35h l'est,
    // comme le reste de la semaine.
    const estACI26h = m.statut === 'ACI' && m.dureeHebdoACI !== '35h';
    const joursOuvres = weekDays.filter((d) => !joursFeries.has(d.toLocaleDateString('en-CA')) && !(estACI26h && d.getDay() === 3));
    const nomComplet = `${m.prenom || ""} ${m.nom || ""}`.trim();
    const messageMercredi = estACI26h ? " (hors mercredi, ACI 26h)" : "";
    if (!(await confirm(`Injecter "${selectedModel.lieu}" sur toute la semaine (matin et après-midi) pour ${nomComplet}${messageMercredi} ?`))) return;

    for (const day of joursOuvres) {
      const dateStr = day.toLocaleDateString('en-CA');
      for (const moment of ["Matin", "Après-midi"]) {
        await processActionCreation(m.id, m.prenom || "", m.nom || "", moment, dateStr, selectedModel.lieu);
      }
    }
    showToast(`"${selectedModel.lieu}" injecté sur la semaine pour ${nomComplet}${messageMercredi}.`);
  };

  const startOfWeekStr = weekDays[0].toLocaleDateString('en-CA');
  const endOfWeekStr = weekDays[weekDays.length - 1].toLocaleDateString('en-CA');

  return (
    <PageGuard pageId="page_access_agenda">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] pl-4 pt-[60px]`}>

      {/* HEADER */}
      {/* items-end plutôt que items-center : quand la fenêtre est trop
          étroite pour tenir "Agenda des médiateurs" sur une ligne, le fil
          d'Ariane passe sur 2 lignes et grandit — les boutons doivent alors
          suivre le bas de ce bloc plutôt que rester centrés (ce qui les
          faisait paraître plaqués en haut). Sans effet quand tout tient sur
          une seule ligne (tous les éléments ont alors la même hauteur). */}
      {/* gap-4 en plus de justify-between : sans lui, quand le contenu
          remplit presque toute la largeur, justify-between n'a plus
          d'espace à répartir et les deux groupes (gauche/droite) peuvent se
          toucher ("Semaine validée" collé au bouton de resynchronisation) —
          gap-4 garantit un écart minimal, que justify-between agrandit
          ensuite s'il reste de la place. */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-end gap-4 px-5 py-2.5 border-b border-[#003d42] bg-[#005259] text-white shadow-md">
        {/* items-end ici aussi : sinon "Semaine validée" reste centré sur la
            hauteur du titre passé à 2 lignes, donc plus haut que le bas du
            groupe — désaligné par rapport aux boutons de droite, alignés
            eux sur ce même bas via le header. */}
        <div className="flex items-end gap-3">
          {/* Le repli de la liste des modèles se fait désormais via la
              poignée ronde accolée à la barre elle-même (voir AGENCEMENT
              PRINCIPAL plus bas) — plus visible qu'une icône perdue ici
              parmi les nombreux boutons de l'en-tête. */}
          
          <Link
            href="/"
            className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
          >
            <HomeIcon className="w-4 h-4 text-[#EA601F]" />
            <span>Accueil</span>
          </Link>

          <span className="text-[#88ACEA]">/</span>
          <span className="text-white/90 font-medium">Agenda des médiateurs</span>

          {/* BOUTON VALIDATION SEMAINE */}
          <PermissionGuard actionId="agenda_validate_week">
            <button
              onClick={toggleValidationSemaine}
              className={`h-9 px-3.5 rounded-lg text-xs transition-all border flex items-center gap-2 cursor-pointer font-bold whitespace-nowrap shadow-sm ${
                estSemaineValidee
                  ? "bg-[#A9E0C9]/15 border-[#A9E0C9]/60 text-[#A9E0C9] hover:bg-[#A9E0C9]/25"
                  : "bg-[#F9C44E] border-[#F9C44E] text-[#005259] hover:bg-[#f8b930]"
              }`}
            >
              {estSemaineValidee ? (
                <><LockClosedIcon className="w-3.5 h-3.5 shrink-0"/> Semaine validée</>
              ) : (
                <>
                  <span className="relative flex w-2 h-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#005259]/50"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#005259]"></span>
                  </span>
                  En cours de validation
                </>
              )}
            </button>
          </PermissionGuard>
        </div>

        <div className="flex items-center gap-3">

          {/* Actions globales (agissent sur l'agenda de tout le monde)
              réservées aux comptes admin, indépendamment de qui peut
              connecter son propre agenda (voir lib/googleCalendarBeta.ts).
              Repliées dans un panneau (voir resyncPanelOuvert) plutôt qu'en
              ligne dans l'en-tête. */}
          {estAdminGoogleAgenda(user?.email) && (
            <div className="relative" ref={resyncPanelRef}>
              <button
                onClick={() => setResyncPanelOuvert(!resyncPanelOuvert)}
                className="p-2 bg-[#003d42] border border-[#002b2f] hover:bg-[#002b2f] rounded-lg text-white cursor-pointer flex items-center justify-center min-w-[36px] h-9"
                title="Resynchronisation Google Agenda (admin)"
              >
                <ArrowPathIcon className={`w-5 h-5 text-white ${resyncMoisEnCours || resyncGlobalEnCours ? "animate-spin" : ""}`} />
              </button>
              {resyncPanelOuvert && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-[#404040]/10 rounded-xl shadow-xl z-50 p-3 space-y-2.5 text-[#404040]">
                  <span className="text-xs font-bold text-[#005259] uppercase tracking-wide">Resynchronisation Google Agenda</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="month"
                      value={moisResync}
                      onChange={(e) => setMoisResync(e.target.value)}
                      disabled={resyncMoisEnCours}
                      className="flex-1 min-w-0 px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-[#404040] text-xs h-9 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      title="Mois à resynchroniser avec Google Agenda"
                    />
                    <button
                      onClick={forcerSyncGoogleAgendaMois}
                      disabled={resyncMoisEnCours || !moisResync}
                      className="h-9 px-3 rounded-lg text-xs font-bold whitespace-nowrap bg-[#005259] hover:bg-[#003d42] text-white cursor-pointer flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60 shrink-0"
                      title="Forcer la resynchronisation de ce mois avec Google Agenda"
                    >
                      <ArrowPathIcon className={`w-4 h-4 text-white shrink-0 ${resyncMoisEnCours ? "animate-spin" : ""}`} />
                      Ce mois
                    </button>
                  </div>
                  <button
                    onClick={forcerSyncGoogleAgendaGlobale}
                    disabled={resyncGlobalEnCours}
                    className="w-full h-9 px-3 rounded-lg text-xs font-bold whitespace-nowrap bg-[#EF736A]/10 border border-[#EF736A]/30 hover:bg-[#EF736A]/20 text-[#EF736A] cursor-pointer flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Forcer la resynchronisation de TOUT l'agenda avec Google Agenda"
                  >
                    <ArrowPathIcon className={`w-4 h-4 shrink-0 ${resyncGlobalEnCours ? "animate-spin" : ""}`} />
                    Tout resynchroniser
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CLOCHE NOTIFICATION — un peu de marge à gauche pour ne pas coller
              au bouton de validation de semaine, surtout quand la fenêtre est
              trop étroite pour que justify-between les écarte tout seul. */}
          <PermissionGuard actionId="agenda_notif_panel">
          <div className="relative ml-3" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="p-2 bg-[#003d42] border border-[#002b2f] hover:bg-[#002b2f] rounded-lg text-white relative cursor-pointer flex items-center justify-center min-w-[36px] h-9"
              title="Notifications"
            >
              <BellIcon className="w-5 h-5 text-white" />
              {nonLuesCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 bg-[#EF736A] text-[10px] font-extrabold text-white rounded-full flex items-center justify-center px-1 border border-white">
                  {nonLuesCount}
                </span>
              )}
            </button>

            {/* PANNEAU DES NOTIFICATIONS : Modale aperçu (5 plus récentes + lien complet) */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#404040]/10 rounded-xl shadow-xl z-50 p-3 space-y-2 text-[#404040]">
                <div className="flex justify-between items-center border-b border-[#F3F3F2] pb-2">
                  <span className="text-xs font-bold text-[#005259]">Notifications ({notifications.length})</span>
                  <div className="flex gap-2">
                    {nonLuesCount > 0 && (
                      <button onClick={marquerToutCommeLu} className="text-[10px] text-[#88ACEA] font-bold hover:underline">Tout lire</button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={() => setShowNotifDeleteConfirm(!showNotifDeleteConfirm)} className="text-[10px] text-[#EF736A] font-bold hover:underline">Effacer</button>
                    )}
                  </div>
                </div>

                {showNotifDeleteConfirm && (
                  <div className="p-2 bg-[#EF736A]/10 border border-[#EF736A] rounded-lg text-xs space-y-1.5 text-center">
                    <p className="text-[11px] font-bold text-[#EF736A]">Tout effacer ?</p>
                    <div className="flex justify-center gap-2">
                      <button onClick={effacerNotifications} className="bg-[#EF736A] text-white text-[10px] px-2 py-0.5 rounded font-bold">Oui</button>
                      <button onClick={() => setShowNotifDeleteConfirm(false)} className="bg-[#F3F3F2] text-[#404040] text-[10px] px-2 py-0.5 rounded font-bold">Non</button>
                    </div>
                  </div>
                )}

                {/* Liste des 5 notifications les plus récentes */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {notifications.length === 0 ? (
                    <div className="text-center py-5 text-[#404040]/60 text-[11px]">Aucune notification récente</div>
                  ) : (
                    notifications.slice(0, 5).map(n => (
                      <div key={n.id} className={`p-2.5 rounded-lg text-[11px] leading-tight border ${n.lue ? 'bg-[#F3F3F2] border-transparent text-[#404040]/70' : 'bg-[#88ACEA]/10 border-[#88ACEA] text-[#005259] font-semibold'}`}>
                        {n.message}
                      </div>
                    ))
                  )}
                </div>

                {/* Lien vers la page complète de gestion des notifications */}
                <div className="border-t border-[#F3F3F2] pt-2 text-center">
                  <Link 
                    href="/mediation/notifications" 
                    onClick={() => setIsNotifOpen(false)}
                    className="text-[11px] font-bold text-[#005259] hover:text-[#EA601F] transition-colors inline-block w-full py-1"
                  >
                    Voir toutes les notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>
          </PermissionGuard>

          {/* AUJOURD'HUI : retour direct à la semaine en cours */}
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 bg-[#003d42] border border-[#002b2f] hover:bg-[#002b2f] rounded-lg text-white cursor-pointer text-xs font-bold h-9"
            title="Revenir à la semaine en cours"
          >
            Aujourd'hui
          </button>

          {/* SÉLECTEUR SEMAINE */}
          <PermissionGuard actionId="agenda_week_nav">
            <div className="flex items-center gap-1.5 bg-[#003d42] border border-[#002b2f] rounded-lg px-2 h-9">
              <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-7); setCurrentDate(d); }} className="text-white hover:text-[#F9C44E] transition-colors cursor-pointer text-xs font-bold">←</button>
              <span className="text-xs font-semibold text-white min-w-36 text-center">Sem. du {monday.toLocaleDateString('fr-FR', {day:'numeric', month:'short', year:'numeric'})}</span>
              <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()+7); setCurrentDate(d); }} className="text-white hover:text-[#F9C44E] transition-colors cursor-pointer text-xs font-bold">→</button>
            </div>
          </PermissionGuard>

          {/* MODÈLE SÉLECTIONNÉ */}
          {selectedModel && (
            <div className="bg-[#EA601F] text-white px-2.5 py-1 rounded-md text-xs flex items-center gap-2 animate-pulse h-9 font-semibold">
              <span>Injection : {selectedModel.lieu}</span>
              <button onClick={() => setSelectedModel(null)} className="hover:opacity-80 p-0.5">
                <XMarkIcon className="w-3.5 h-3.5 stroke-[3]"/>
              </button>
            </div>
          )}

          {/* BOUTON SAMEDI */}
          <PermissionGuard actionId="agenda_display_toggles">
            <button
              onClick={() => setSamediChoixManuel(!voirSamedi)}
              className={`px-3 h-9 rounded-md text-xs transition-colors border flex items-center gap-1.5 cursor-pointer font-bold ${
                voirSamedi ? "bg-[#F9945D] border-[#F9945D] text-white" : "bg-[#003d42] border-[#002b2f] text-white hover:bg-[#002b2f]"
              }`}
            >
              <CalendarDaysIcon className="w-3.5 h-3.5"/>
              {voirSamedi ? "Masquer Samedi" : "+ Samedi"}
            </button>
          </PermissionGuard>

          {/* BOUTON MASQUÉS */}
          <PermissionGuard actionId="agenda_display_toggles">
            <button
              onClick={() => setVoirMasques(!voirMasques)}
              className={`px-3 h-9 rounded-md text-xs transition-colors border flex items-center gap-1.5 cursor-pointer font-bold ${
                voirMasques ? "bg-[#EF736A] border-[#EF736A] text-white" : "bg-[#003d42] border-[#002b2f] text-white hover:bg-[#002b2f]"
              }`}
            >
              {voirMasques ? <><EyeIcon className="w-3.5 h-3.5"/> Vue complète</> : <><EyeSlashIcon className="w-3.5 h-3.5"/> Masqués</>}
            </button>
          </PermissionGuard>

          {/* Bouton "Supprimer OFF" masqué de la vue à la demande de
              l'utilisateur — la fonction supprimerActionsOFF reste dans le
              code au cas où l'outil resserve plus tard. Décommenter le bloc
              ci-dessous pour le réafficher.
          <button
            onClick={supprimerActionsOFF}
            title="Supprime dans toute la base les actions dont le lieu est 'OFF'"
            className="bg-[#003d42] hover:bg-[#EF736A] text-white border border-[#002b2f] px-3 h-9 rounded-md text-xs flex items-center gap-1.5 font-bold cursor-pointer"
          >
            <WrenchScrewdriverIcon className="w-3.5 h-3.5"/> Supprimer OFF
          </button>
          */}

          {/* Bouton "Rattraper horaires Observation" masqué de la vue une fois
              utilisé — la fonction rattraperHorairesObservationACI reste dans
              le code au cas où l'outil resserve plus tard. Décommenter le
              bloc ci-dessous pour le réafficher.
          <button
            onClick={rattraperHorairesObservationACI}
            title="Recalcule l'horaire des créneaux 'RN Observation' déjà posés pour les ACI, selon la grille horaire de chacun·e (rattrapage ponctuel)"
            className="bg-[#003d42] hover:bg-[#EA601F] text-white border border-[#002b2f] px-3 h-9 rounded-md text-xs flex items-center gap-1.5 font-bold cursor-pointer"
          >
            <WrenchScrewdriverIcon className="w-3.5 h-3.5"/> Rattraper horaires Observation
          </button>
          */}

          <Link href="/mediation/localisations?vueRestreinte=1" className="bg-[#003d42] hover:bg-[#002b2f] text-white border border-[#002b2f] px-3 h-9 rounded-md text-xs flex items-center gap-1.5 font-bold">
            <MapPinIcon className="w-3.5 h-3.5 text-[#A9E0C9]"/> Adresses
          </Link>

          <Link href="/mediation/equipe" className="bg-[#003d42] hover:bg-[#002b2f] text-white border border-[#002b2f] px-3 h-9 rounded-md text-xs flex items-center gap-1.5 font-bold">
            <UsersIcon className="w-3.5 h-3.5 text-[#88ACEA]"/> Staff
          </Link>

          <Link 
            href="/mediation/rencontres-numeriques/suresnes"
            className="bg-[#88ACEA] hover:bg-[#779cdb] text-[#005259] border border-[#88ACEA] px-3 h-9 rounded-md text-xs transition-colors flex items-center gap-1.5 font-extrabold"
          >
            <CalendarDaysIcon className="w-3.5 h-3.5 text-[#005259]"/> Agenda RN
          </Link>
        </div>
      </header>

      {/* AGENCEMENT PRINCIPAL */}
      <div className="max-w-8xl mx-auto py-5 pr-4 flex gap-4 transition-all duration-300">

        {/* POIGNÉE DE REPLI + ACCÈS HISTORIQUE — accolées à la barre de
            modèles plutôt que perdues dans l'en-tête déjà chargé de cases. */}
        <div className="shrink-0 self-start sticky top-[68px] mt-8 flex flex-col items-center gap-2 z-10">
          <PermissionGuard actionId="agenda_toggle_sidebar">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white border-2 border-[#005259] text-[#005259] hover:bg-[#005259] hover:text-white shadow-md transition-all cursor-pointer"
              title={isSidebarOpen ? "Replier la liste des modèles" : "Afficher la liste des modèles"}
            >
              {isSidebarOpen ? <ChevronLeftIcon className="w-4 h-4"/> : <ChevronRightIcon className="w-4 h-4"/>}
            </button>
          </PermissionGuard>

          <PermissionGuard actionId="page_access_agenda_historique">
            <Link
              href="/agenda/historique"
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white border-2 border-[#005259] text-[#005259] hover:bg-[#005259] hover:text-white shadow-md transition-all cursor-pointer"
              title="Historique de l'agenda"
            >
              <ClockIcon className="w-3.5 h-3.5"/>
            </Link>
          </PermissionGuard>

          <PermissionGuard actionId="page_access_agenda_mois">
            <Link
              href="/agenda/mois"
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white border-2 border-[#005259] text-[#005259] hover:bg-[#005259] hover:text-white shadow-md transition-all cursor-pointer"
              title="Vue mois d'un médiateur"
            >
              <CalendarDaysIcon className="w-3.5 h-3.5"/>
            </Link>
          </PermissionGuard>

          <PermissionGuard actionId="page_access_agenda_mobile">
            <Link
              href="/agenda/mobile"
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white border-2 border-[#005259] text-[#005259] hover:bg-[#005259] hover:text-white shadow-md transition-all cursor-pointer"
              title="Mon planning (vue mobile)"
            >
              <DevicePhoneMobileIcon className="w-3.5 h-3.5"/>
            </Link>
          </PermissionGuard>
        </div>

        {/* SIDEBAR : MODÈLES D'ACTIVITÉS */}
        <aside className={`shrink-0 bg-white border border-[#404040]/10 rounded-xl p-3 space-y-2.5 self-start sticky top-[60px] max-h-[calc(100vh-76px)] overflow-y-auto shadow-sm transition-all duration-300 ${isSidebarOpen ? "w-56 opacity-100" : "w-0 p-0 border-0 opacity-0 pointer-events-none"}`}>
          <div className="flex items-center justify-between border-b border-[#F3F3F2] pb-2">
            <Link href="/mediation/modeles" className="text-xs font-extrabold text-[#005259] uppercase tracking-wider flex items-center gap-1.5 hover:text-[#EA601F] transition-colors" title="Voir tous les modèles">
              <DocumentDuplicateIcon className="w-4 h-4 text-[#EA601F]" /> Modèles
            </Link>
            <PermissionGuard actionId="agenda_model_create">
              <button
                onClick={() => { setEditingActivite(null); setNewActivite(ACTIVITE_VIDE); setSelectedLieuPredefini(""); setOpenSections({}); setIsActiviteModalOpen(true); }}
                className="p-1 bg-[#F3F3F2] hover:bg-[#005259] text-[#005259] hover:text-white rounded-md transition-colors cursor-pointer"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </PermissionGuard>
          </div>

          <div className="space-y-2">
            {(() => {
              const modelesSemaine = activitesTypes.filter(type => !type.archive && estVisibleCetteSemaine(type, startOfWeekStr, endOfWeekStr));

              // Rendu d'un modèle dans la liste. Dans un bloc thématique, la
              // couleur du bloc prime sur la couleur propre du modèle pour
              // ce badge (la couleur individuelle reste utilisée telle
              // quelle sur la grille du planning, non affectée par les blocs).
              const renderModeleItem = (type: ActiviteType, blocColor?: string) => {
                const colorTheme = blocColor || type.couleur || "#005259";
                const isSelected = selectedModel?.id === type.id;
                // Modèles fondateurs de la liaison Suresnes (leur suppression casserait
                // la génération automatique des créneaux planning_suresnes, voir
                // isSuresnesAction dans processActionCreation) ou dont les créneaux ACI
                // utilisent une grille horaire personnelle (TERRAGE/MASSY) : protégés
                // contre une suppression accidentelle.
                const isModeleProtege = estModeleProtege(type.lieu);

                const isLight = isLightColor(colorTheme);
                const textColor = isLight ? "#1A1A1A" : colorTheme;
                const bgColor = hexToRgba(colorTheme, isLight ? 0.35 : (isSelected ? 0.2 : 0.08));
                const hMatin = resoudreHoraireAffichage(type, "Matin");
                const hApresMidi = resoudreHoraireAffichage(type, "Après-midi");

                return (
                  <div
                    key={type.id || type.lieu}
                    onClick={() => !estSemaineValidee && setSelectedModel(type)}
                    style={{
                      backgroundColor: bgColor,
                      borderColor: colorTheme,
                      color: textColor
                    }}
                    className={`group/item w-full flex flex-col p-2 rounded-lg text-xs transition-all border ${estSemaineValidee ? 'opacity-50 cursor-not-allowed' : isSelected ? 'ring-2 ring-[#005259]' : 'hover:shadow-md cursor-pointer'}`}
                  >
                    <div className="w-full flex items-center gap-1.5 font-bold">
                      <span className="w-2 h-2 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: colorTheme }}></span>
                      <span className="truncate flex-1">{type.lieu}</span>
                    </div>
                    <div className="w-full mt-1 pl-3.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {type.territoire && <span className="text-[9px] bg-white px-1 rounded border border-current shrink-0">{type.territoire}</span>}
                          {type.codeInterne && <span className="text-[9px] bg-white px-1 rounded border border-current min-w-0 flex-1 break-words" title={type.codeInterne}>{type.codeInterne}</span>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <PermissionGuard actionId="agenda_model_actions">
                            <button onClick={(e) => handleOpenEditActivite(type, e)} className="hover:opacity-70 p-0.5">
                              <PencilSquareIcon className="w-3 h-3" />
                            </button>
                          </PermissionGuard>
                          {type.id && (
                            isModeleProtege ? (
                              <span className="p-0.5 opacity-60" title="Modèle protégé : lié à Suresnes, non supprimable">
                                <LockClosedIcon className="w-3 h-3" />
                              </span>
                            ) : (
                              <PermissionGuard actionId="agenda_model_actions">
                                <button onClick={(e) => handleDeleteActiviteType(type.id!, e)} className="hover:text-[#EF736A] p-0.5">
                                  <XMarkIcon className="w-3.5 h-3.5" />
                                </button>
                              </PermissionGuard>
                            )
                          )}
                        </div>
                      </div>
                      {/* Matin/après-midi toujours l'un sous l'autre, jamais
                          à côté du badge territoire — sinon l'horaire du
                          matin se fait tronquer par manque de place alors
                          que celui de l'après-midi passait déjà à la ligne,
                          rendant la mise en page incohérente d'une carte à
                          l'autre. */}
                      {hMatin && (
                        <div className="text-[8px] opacity-80 font-mono truncate mt-0.5">Matin {hMatin.debut}-{hMatin.fin}</div>
                      )}
                      {hApresMidi && (
                        <div className="text-[8px] opacity-80 font-mono truncate mt-0.5">Après-midi {hApresMidi.debut}-{hApresMidi.fin}</div>
                      )}
                    </div>
                  </div>
                );
              };

              const groupes = [
                ...BLOCS_THEMATIQUES.map(bloc => ({
                  ...bloc,
                  couleur: blocsColors[bloc.id] || bloc.couleur,
                  editable: true,
                  modeles: modelesSemaine.filter(type => (type.blocs || []).includes(bloc.id))
                })),
                {
                  id: "sans-bloc",
                  nom: "Sans bloc",
                  editable: false,
                  couleur: "#404040",
                  modeles: modelesSemaine.filter(type => !(type.blocs && type.blocs.length > 0))
                }
              ];

              return groupes.map(groupe => {
                if (groupe.modeles.length === 0) return null;
                const isOpen = openBlocs[groupe.id] !== false;
                return (
                  <div key={groupe.id} className="rounded-lg border overflow-hidden" style={{ borderColor: `${groupe.couleur}40` }}>
                    <div
                      className="cursor-pointer flex items-center gap-2 px-2 py-1.5 select-none"
                      style={{ backgroundColor: `${groupe.couleur}14` }}
                      onClick={() => setOpenBlocs(prev => ({ ...prev, [groupe.id]: !isOpen }))}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: groupe.couleur }}></span>
                      <span className="flex-1 text-[10px] font-extrabold uppercase tracking-wide truncate" style={{ color: getReadableTextColor(groupe.couleur) }}>
                        {groupe.nom}
                      </span>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ color: getReadableTextColor(groupe.couleur), backgroundColor: `${groupe.couleur}22` }}
                      >
                        {groupe.modeles.length}
                      </span>
                      {groupe.editable && (
                        <input
                          type="color"
                          value={groupe.couleur}
                          title="Changer la couleur du bloc"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleChangeBlocColor(groupe.id, e.target.value)}
                          className="w-4 h-4 rounded cursor-pointer border border-black/10 bg-transparent shrink-0"
                        />
                      )}
                      <ChevronDownIcon
                        className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        style={{ color: getReadableTextColor(groupe.couleur) }}
                      />
                    </div>
                    {isOpen && (
                      <div className="p-1.5 space-y-1.5">
                        {groupe.modeles.map(type => renderModeleItem(type, groupe.id === "sans-bloc" ? undefined : groupe.couleur))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </aside>

        {/* GRILLE DU TABLEAU DU PLANNING, PAR BLOCS RÉTRACTABLES */}
        {/* min-w-0 : sans ça, cet enfant flex ne se laisse jamais rétrécir
            en dessous de la largeur intrinsèque de son contenu le plus
            large (le quadrillage GANTT, ~4680px sur 6 mois) — même avec un
            overflow-x-auto interne sur ce dernier, toute LA COLONNE (donc
            aussi la légende, censée tenir sur l'écran) hérite de cette
            largeur et pousse un scroll horizontal sur toute la page plutôt
            que de laisser flex-wrap faire son travail. */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Bascule Édition / GANTT : la vue GANTT (voir GanttActiviteContinu
              plus bas) est en lecture seule, juste pour repérer d'un coup
              d'œil les trous/chevauchements — on continue d'éditer depuis la
              grille habituelle. Pas de GANTT par médiateur : ça ferait
              doublon avec cette grille d'édition, déjà organisée par
              médiateur·rice. */}
          <div className="flex items-center gap-1 bg-white border border-[#404040]/10 rounded-xl p-1.5 shadow-sm w-fit">
            {role === "admin" && (
              <button
                onClick={() => setVueAgenda("edition")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  vueAgenda === "edition" ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/60 hover:bg-[#F3F3F2]"
                }`}
              >
                Édition
              </button>
            )}
            {/* Vue GANTT réservée aux administrateurs. */}
            <PermissionGuard actionId="agenda_gantt_view">
              <button
                onClick={() => setVueAgenda("gantt-activite")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  vueAgenda === "gantt-activite" ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/60 hover:bg-[#F3F3F2]"
                }`}
              >
                GANTT par activité
              </button>
              <button
                onClick={() => setVueAgenda("gantt-detaille")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  vueAgenda === "gantt-detaille" ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/60 hover:bg-[#F3F3F2]"
                }`}
              >
                GANTT détaillé
              </button>
            </PermissionGuard>
          </div>

          {vueAgenda === "edition" && (
          <>
          {/* Barre des jours/dates unique, sortie des accordéons : sticky
              une seule fois pour toute la page au lieu d'une par catégorie
              (évite les répétitions et les chevauchements en défilant). */}
          <div className="sticky top-[60px] z-30 bg-white border border-[#404040]/10 rounded-xl px-4 pt-1 pb-2 shadow-sm grid text-xs" style={{ gridTemplateColumns: `160px repeat(${weekDays.length}, minmax(0, 1fr))` }}>
            <div className="text-left flex flex-col justify-end pb-1">
              <span className="text-[10px] font-bold uppercase text-[#404040]/50 tracking-wide">
                Semaine {getWeekIdentifier(weekDays[0]).split("-W")[1]}
              </span>
              <span className="text-[#005259] font-extrabold text-xs">Médiateur</span>
            </div>
            {weekDays.map(d => {
              const estFerie = joursFeries.has(d.toLocaleDateString('en-CA'));
              return (
                <div key={d.toString()} className={`text-center pb-1 px-1 ${estFerie ? "bg-[#EF736A]/10 rounded-t-md" : ""}`}>
                  <span className={`font-extrabold uppercase block ${estFerie ? "text-[#EF736A]" : "text-[#005259]"}`}>{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                  <span className={`text-[11px] font-medium ${estFerie ? "text-[#EF736A]/80" : "text-[#404040]/70"}`}>{d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  {estFerie && <span className="block text-[8px] font-black uppercase tracking-widest text-[#EF736A]">Férié</span>}
                </div>
              );
            })}
          </div>

          {/* Case à cocher par catégorie pour masquer entièrement son bloc
              (en-tête compris) — le chevron d'Accordion, lui, ne fait que
              replier le contenu en laissant l'en-tête visible. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-white border border-[#404040]/10 rounded-xl px-4 py-2 shadow-sm text-xs">
            <span className="font-extrabold uppercase text-[10px] text-[#404040]/50 tracking-wide">Afficher :</span>
            {groupesMediateursAgenda.filter(groupe => groupe.membres.length > 0).map(groupe => (
              <label key={groupe.key} className="flex items-center gap-1.5 font-bold text-[#404040] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={categoriesVisibles[groupe.key] ?? true}
                  onChange={() => setCategoriesVisibles(prev => ({ ...prev, [groupe.key]: !(prev[groupe.key] ?? true) }))}
                  className="cursor-pointer"
                />
                {groupe.label}
              </label>
            ))}
            {(currentUserMed || role === "admin") && (
              <div className="flex items-center gap-2 border-l border-[#404040]/10 pl-4 flex-wrap">
                {currentUserMed && (
                  <label className="flex items-center gap-1.5 font-bold text-[#EA601F] cursor-pointer select-none" title="N'affiche que vous et les médiateur·rice·s positionné·e·s avec vous sur un même créneau">
                    <input
                      type="checkbox"
                      checked={avecMoiUniquement}
                      onChange={() => setAvecMoiUniquement(prev => !prev)}
                      className="cursor-pointer"
                    />
                    Avec moi uniquement
                  </label>
                )}
                {/* Réservé aux admins : sélection directe d'un ou plusieurs
                    médiateur·rice·s — masque toutes les autres lignes, sans
                    expansion aux personnes qui partagent leurs créneaux
                    (contrairement à "Avec moi uniquement" ci-dessus). */}
                {role === "admin" && (
                  <div className="relative" ref={avecMediateursPanelRef}>
                    <button
                      onClick={() => setAvecMediateursPanelOuvert(prev => !prev)}
                      title="N'affiche que les médiateur·rice·s sélectionné·e·s, masque tous les autres"
                      className="px-2 py-1 bg-[#EA601F]/10 border border-[#EA601F]/30 rounded-md text-[10px] font-bold uppercase text-[#EA601F] cursor-pointer max-w-[200px] truncate"
                    >
                      {avecMediateursSelectionnes.length === 0
                        ? "Afficher seulement..."
                        : avecMediateursSelectionnes.length === 1
                          ? `Seulement ${avecMediateursSelectionnes[0].prenom || ""} ${avecMediateursSelectionnes[0].nom || ""}`.trim()
                          : `Seulement ${avecMediateursSelectionnes.length} médiateur·rice·s`}
                    </button>
                    {avecMediateursPanelOuvert && (
                      <div className="absolute left-0 mt-2 w-64 max-h-80 overflow-y-auto bg-white border border-[#404040]/10 rounded-xl shadow-xl z-50 p-2 space-y-0.5 text-[#404040] normal-case">
                        {avecMediateursIds.length > 0 && (
                          <button
                            onClick={() => setAvecMediateursIds([])}
                            className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-[#EF736A] hover:bg-[#EF736A]/10 cursor-pointer"
                          >
                            Tout désélectionner
                          </button>
                        )}
                        {mediateurs.filter(m => m.prenom || m.nom).map(m => (
                          <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-[#F3F3F2] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={avecMediateursIds.includes(m.id)}
                              onChange={() => setAvecMediateursIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                              className="cursor-pointer"
                            />
                            {m.prenom} {m.nom}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {avecMoiUniquement && (
                  <select
                    value={jourAvecMoi}
                    onChange={e => setJourAvecMoi(e.target.value)}
                    className="text-[10px] font-bold uppercase text-[#EA601F] bg-[#EA601F]/10 border border-[#EA601F]/30 rounded-md px-1.5 py-1 cursor-pointer outline-none"
                  >
                    <option value="">Toute la semaine</option>
                    {weekDays.map(d => (
                      <option key={d.toString()} value={d.toLocaleDateString('en-CA')}>
                        {d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {groupesMediateursAgenda.filter(groupe => groupe.membres.length > 0 && (categoriesVisibles[groupe.key] ?? true)).map(groupe => (
            <Accordion
              key={groupe.key}
              title={`${groupe.label} (${groupe.membres.length})`}
              open={categoriesOuvertesAgenda[groupe.key] ?? true}
              onToggle={() => setCategoriesOuvertesAgenda(prev => ({ ...prev, [groupe.key]: !(prev[groupe.key] ?? true) }))}
            >
              {groupe.membres.length === 0 ? (
                <p className="text-[11px] italic text-[#404040]/40 py-2">Aucun collaborateur dans cette catégorie.</p>
              ) : (
                <div className="bg-white border border-[#404040]/10 rounded-xl p-4 overflow-x-auto overflow-y-visible shadow-sm">
                  <div className="grid text-xs" style={{ gridTemplateColumns: `160px repeat(${weekDays.length}, minmax(0, 1fr))` }}>
                    {(() => {
                      let dernierGroupeACI: number | null | undefined = undefined;
                      let bandToggle = false;
                      return groupe.membres.map((m: Mediateur) => {
                      const pNom = m.prenom || "";
                      const fNom = m.nom || "";
                      const cleGroupe = m.groupeACI ?? null;
                      if (cleGroupe !== dernierGroupeACI) {
                        bandToggle = !bandToggle;
                        dernierGroupeACI = cleGroupe;
                      }
                      const rowBgClass = m.masque ? "bg-[#F3F3F2]" : (bandToggle ? "bg-[#F9C44E]/[0.08]" : "bg-white");
                      return (
                        <React.Fragment key={m.id}>
                          <div
                            id={`ligne-med-${m.id}`}
                            className={`pr-2 py-2 sticky left-0 z-10 border-b transition-colors ${
                              medASurligner === m.id ? "bg-[#F9C44E]/40 border-[#F9C44E] ring-2 ring-[#F9C44E] ring-inset" : `border-[#F3F3F2] hover:bg-[#F3F3F2]/60 ${rowBgClass}`
                            } ${m.masque ? 'opacity-40' : ''}`}
                          >
                              <div className="flex items-start justify-between gap-1">
                                <div className={`flex flex-col text-xs leading-tight select-none ${m.masque ? 'line-through text-[#404040]/50' : ''}`}>
                                  <span className="font-bold text-[#005259]">{pNom}</span>
                                  {fNom && <span className="font-extrabold text-[#404040] uppercase mt-0.5">{fNom}</span>}
                                </div>

                                <PermissionGuard actionId="agenda_staff_mask">
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button onClick={() => toggleMasqueMed(m)} className={`p-0.5 rounded hover:text-[#EF736A] ${m.masque ? 'text-[#EF736A]' : 'text-[#404040]/40'}`}>
                                      {m.masque ? <EyeSlashIcon className="w-3.5 h-3.5"/> : <EyeIcon className="w-3.5 h-3.5"/>}
                                    </button>
                                    <button onClick={() => { setEditingMed(m); setNewMed({ prenom: m.prenom || "", nom: m.nom || "", poste: m.poste || "", statut: m.statut || "Permanent", debutACI: m.debutACI || "09:00", finACI: m.finACI || "17:00", masque: m.masque || false }); setIsUserModalOpen(true); }} className="text-[#404040]/40 hover:text-[#005259] p-0.5">
                                      <PencilSquareIcon className="w-3.5 h-3.5"/>
                                    </button>
                                  </div>
                                </PermissionGuard>
                                {canCreateSlot && selectedModel && !estSemaineValidee && (
                                  <button
                                    onClick={() => injecterModeleSurSemaine(m)}
                                    title={`Injecter "${selectedModel.lieu}" sur toute la semaine (matin et après-midi)`}
                                    className="text-[#404040]/40 hover:text-[#EA601F] p-0.5 shrink-0"
                                  >
                                    <DocumentDuplicateIcon className="w-3.5 h-3.5"/>
                                  </button>
                                )}
                                {canDeleteSlot && !estSemaineValidee && (
                                  <button
                                    onClick={() => supprimerToutesActionsDeLaLigne(m)}
                                    title="Supprimer toutes les actions de cette ligne sur la semaine"
                                    className="text-[#404040]/40 hover:text-[#EF736A] p-0.5 shrink-0"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5"/>
                                  </button>
                                )}
                              </div>

                              {m.statut === 'ACI' && (
                                <div className="mt-1 flex items-center gap-1">
                                  <span className="inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#88ACEA]/20 text-[#005259] border border-[#88ACEA]">
                                    ACI
                                  </span>
                                  <PermissionGuard actionId="agenda_staff_mask" fallback={
                                    m.groupeACI ? (
                                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F9C44E]/20 text-[#005259] border border-[#F9C44E]">
                                        Groupe {m.groupeACI}
                                      </span>
                                    ) : null
                                  }>
                                    <select
                                      value={m.groupeACI || ""}
                                      onChange={(e) => updateDoc(doc(db, "liste_mediateurs", m.id), { groupeACI: e.target.value ? Number(e.target.value) : null })}
                                      className="text-[9px] font-black uppercase tracking-wider pl-1 pr-0.5 py-0.5 rounded bg-[#F9C44E]/20 text-[#005259] border border-[#F9C44E] outline-none cursor-pointer"
                                    >
                                      <option value="">Groupe ?</option>
                                      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                                        <option key={n} value={n}>Groupe {n}</option>
                                      ))}
                                    </select>
                                  </PermissionGuard>
                                </div>
                              )}
                          </div>

                          {weekDays.map(day => {
                            const dateStr = day.toLocaleDateString('en-CA');
                            const estFerie = joursFeries.has(dateStr);
                            // Repère visuellement le mercredi des ACI (jour de
                            // formation/heures complémentaires plutôt que de
                            // présence terrain habituelle — voir le rappel
                            // "heures complémentaires" posé à la création
                            // d'une action ce jour-là dans processActionCreation).
                            const estMercrediACI = m.statut === 'ACI' && m.dureeHebdoACI !== '35h' && day.getDay() === 3;
                            const fondJour = estFerie ? "bg-[#EF736A]/5" : estMercrediACI ? "bg-[#404040]/10" : rowBgClass;
                            return (
                              <div key={dateStr} className={`p-1 border-b border-l border-[#F3F3F2] align-top ${fondJour} ${m.masque ? 'opacity-40' : ''}`}>
                                <div className="grid grid-cols-2 gap-1 min-h-[38px]">
                                  <DayCell actions={actions} m={m} moment="Matin" date={dateStr} onAdd={() => handleCaseClick(m.id, pNom, fNom, "Matin", dateStr)} onDelete={onRequestDeleteAction} onEditCommentaire={handleEditCommentaire} onSlotClick={handleSlotClick} estSemaineValidee={estSemaineValidee} canCreateSlot={canCreateSlot && !estFerie} canDeleteSlot={canDeleteSlot} canOpenCommentaire={canViewComment || canEditComment} actionEnGlisse={actionEnGlisse} onDragStartAction={setActionEnGlisse} onDropAction={(a) => deplacerAction(a, m, "Matin", dateStr)} />
                                  <DayCell actions={actions} m={m} moment="Après-midi" date={dateStr} onAdd={() => handleCaseClick(m.id, pNom, fNom, "Après-midi", dateStr)} onDelete={onRequestDeleteAction} onEditCommentaire={handleEditCommentaire} onSlotClick={handleSlotClick} estSemaineValidee={estSemaineValidee} canCreateSlot={canCreateSlot && !estFerie} canDeleteSlot={canDeleteSlot} canOpenCommentaire={canViewComment || canEditComment} actionEnGlisse={actionEnGlisse} onDragStartAction={setActionEnGlisse} onDropAction={(a) => deplacerAction(a, m, "Après-midi", dateStr)} />
                                </div>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                      });
                    })()}
                  </div>
                </div>
              )}
            </Accordion>
          ))}
          </>
          )}

          {vueAgenda === "gantt-activite" && (
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex flex-wrap items-center gap-3 bg-white border border-[#404040]/10 rounded-xl px-3 py-2 shadow-sm text-xs w-fit">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold uppercase text-[10px] text-[#404040]/50 tracking-wide">Période :</span>
                  <input
                    type="month"
                    value={ganttMoisDebut}
                    onChange={(e) => setGanttMoisDebut(e.target.value)}
                    className="px-2 py-1 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-[#404040] text-xs cursor-pointer"
                  />
                  <span className="text-[#404040]/50">sur</span>
                  <select
                    value={ganttNombreMois}
                    onChange={(e) => setGanttNombreMois(Number(e.target.value))}
                    className="px-2 py-1 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-[#404040] text-xs cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} mois</option>)}
                  </select>
                </div>
                {/* Même distingo Tout / Production que /mediation/volume-horaire
                    (filtreProduction), sur le champ estProduction. */}
                <div className="flex items-center gap-1 bg-[#F3F3F2] border border-[#404040]/15 rounded-xl p-1">
                  <button
                    onClick={() => setGanttFiltreProduction("tous")}
                    title="Affiche toutes les actions"
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      ganttFiltreProduction === "tous" ? "bg-[#005259] text-white" : "text-[#404040]/70 hover:text-[#005259]"
                    }`}
                  >
                    Tout
                  </button>
                  <button
                    onClick={() => setGanttFiltreProduction("production")}
                    title="N'affiche que les actions marquées comme production Médiation Numérique"
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      ganttFiltreProduction === "production" ? "bg-[#EA601F] text-white" : "text-[#404040]/70 hover:text-[#EA601F]"
                    }`}
                  >
                    Production
                  </button>
                </div>
                <div className="relative" ref={medSelectPanelRef}>
                  <button
                    onClick={() => setMedSelectPanelOuvert(!medSelectPanelOuvert)}
                    title="Filtrer sur une ou plusieurs médiateur·rice·s"
                    className="px-3 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-[#404040] text-xs font-bold cursor-pointer max-w-[220px] truncate text-left"
                  >
                    {mediateursGanttSelectionnes.length === 0
                      ? "Tous les médiateurs"
                      : mediateursGanttSelectionnes.length === 1
                        ? `${mediateursGanttSelectionnes[0].prenom || ""} ${mediateursGanttSelectionnes[0].nom || ""}`.trim()
                        : `${mediateursGanttSelectionnes.length} médiateurs sélectionnés`}
                  </button>
                  {medSelectPanelOuvert && (
                    <div className="absolute left-0 mt-2 w-64 max-h-80 overflow-y-auto bg-white border border-[#404040]/10 rounded-xl shadow-xl z-50 p-2 space-y-0.5 text-[#404040]">
                      {ganttMediateurIds.length > 0 && (
                        <button
                          onClick={() => setGanttMediateurIds([])}
                          className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-[#EF736A] hover:bg-[#EF736A]/10 cursor-pointer"
                        >
                          Tout désélectionner
                        </button>
                      )}
                      {mediateurs.filter(m => m.prenom || m.nom).map(m => (
                        <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-[#F3F3F2] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ganttMediateurIds.includes(m.id)}
                            onChange={() => setGanttMediateurIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                            className="cursor-pointer"
                          />
                          {m.prenom} {m.nom}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {/* Liste des lieux "Absence" configurable dans Paramètres
                    Généraux (page_access_parametres), pas codée en dur —
                    voir lieuxAbsenceConfig. "Isoler" garde les absences ET
                    toutes les actions des personnes qui en ont (pas les
                    autres) : sert à la fois à comparer les congés qui se
                    chevauchent entre médiateur·rice·s et à repérer une
                    vraie action posée pendant le congé de l'une d'elles. */}
                <div className="flex items-center gap-1 bg-[#F3F3F2] border border-[#404040]/15 rounded-xl p-1">
                  <button
                    onClick={() => setGanttFiltreAbsences("tous")}
                    title="N'applique aucun filtre sur les absences"
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      ganttFiltreAbsences === "tous" ? "bg-[#005259] text-white" : "text-[#404040]/70 hover:text-[#005259]"
                    }`}
                  >
                    Toutes activités
                  </button>
                  <button
                    onClick={() => setGanttFiltreAbsences("isoler")}
                    title={lieuxAbsenceConfig.length === 0 ? "Aucun lieu \"Absence\" configuré — voir Paramètres Généraux" : "Isole les personnes ayant au moins une absence, avec toutes leurs actions — pour repérer des congés qui se chevauchent ou une action posée pendant un congé"}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      ganttFiltreAbsences === "isoler" ? "bg-[#EA601F] text-white" : "text-[#404040]/70 hover:text-[#EA601F]"
                    }`}
                  >
                    Isoler absences
                  </button>
                </div>
                <Link
                  href="/mediation/parametres"
                  title={'Configurer les lieux "Absence" dans Paramètres Généraux'}
                  className="p-2 bg-[#F3F3F2] border border-[#404040]/15 hover:bg-[#005259] hover:text-white hover:border-[#005259] rounded-lg text-[#404040]/70 cursor-pointer flex items-center justify-center min-w-[36px] h-9 transition-colors"
                >
                  <Cog6ToothIcon className="w-4 h-4" />
                </Link>
              </div>

              {/* Jours ouvrés sans aucune action, par mois — une carte par
                  personne sélectionnée. */}
              {joursSansRienParMediateur.map(j => (
                <div key={j.medId} className="flex-1 min-w-[260px] bg-white border border-[#404040]/10 rounded-xl px-3 py-2 shadow-sm text-xs">
                  <div className="flex items-center gap-1.5 text-[#EF736A] font-extrabold uppercase text-[10px] tracking-wide mb-1.5">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                    Jours ouvrés sans activité — {j.medLabel}
                  </div>
                  {j.mois.length === 0 ? (
                    <p className="text-[#404040]/50 italic">Aucun jour ouvré sans action sur cette période.</p>
                  ) : (
                    <div className="space-y-0.5">
                      {j.mois.map(m => (
                        <div key={m.cle} className="flex flex-wrap gap-x-1.5">
                          <span className="font-bold text-[#005259] capitalize shrink-0">{m.label} :</span>
                          <span className="text-[#404040]/70">{m.jours.join(", ")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Une instance par médiateur·rice sélectionné·e (chacune sa
              propre ligne journalière), ou une seule vue par activité
              (lignes = lieux) si personne n'est filtré. */}
          {vueAgenda === "gantt-activite" && premierJourGantt && dernierJourGantt && (
            mediateursGanttSelectionnes.length > 0 ? (
              <div className="space-y-3">
                {mediateursGanttSelectionnes.map(m => (
                  <GanttActiviteContinu
                    key={m.id}
                    actions={actionsGanttFiltrees.filter(a => estActionDuMediateur(a, m))}
                    premierJour={premierJourGantt}
                    dernierJour={dernierJourGantt}
                    mediateurLabel={`${m.prenom || ""} ${m.nom || ""}`.trim()}
                    joursFeries={joursFeriesGantt}
                    estLieuAbsence={ganttFiltreAbsences === "isoler" ? estLieuAbsence : undefined}
                  />
                ))}
              </div>
            ) : (
              <GanttActiviteContinu
                actions={actionsGanttFiltrees}
                premierJour={premierJourGantt}
                dernierJour={dernierJourGantt}
                joursFeries={joursFeriesGantt}
                estLieuAbsence={ganttFiltreAbsences === "isoler" ? estLieuAbsence : undefined}
              />
            )
          )}

          {/* GANTT "détaillé" (voir components/ModelesGantt.tsx, partagé
              avec la page Modèles) : une ligne par action/session récurrente
              basée sur les modèles (pas les créneaux posés), avec tronçons
              de dates réelles pour les activités ponctuelles et détail
              médiateurs/jours par ligne — vue plus proche du "programme"
              que le GANTT par activité ci-dessus, qui lit directement les
              créneaux posés dans la période choisie. */}
          {vueAgenda === "gantt-detaille" && (
            <ModelesGantt modeles={activitesTypes.filter(a => !a.archive)} />
          )}
        </div>
      </div>

      {/* POP-UP SUR-MESURE DE CONFIRMATION DE SUPPRESSION */}
      {deleteConfirmModalData && (
        <div className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[140] p-4">
          <div className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-sm space-y-4 shadow-2xl text-[#404040] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-[#EF736A]">
              <div className="p-2 bg-[#EF736A]/10 rounded-full">
                <ExclamationTriangleIcon className="w-6 h-6 text-[#EF736A]" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#005259]">Confirmer la suppression</h3>
                <p className="text-xs text-[#404040]/70">Cette action est irréversible.</p>
              </div>
            </div>

            <div className="p-3 bg-[#F3F3F2] rounded-lg border border-[#404040]/10 text-xs">
              Voulez-vous vraiment supprimer l'action <span className="font-bold text-[#005259]">"{deleteConfirmModalData.lieu}"</span> de <span className="font-bold text-[#005259]">{deleteConfirmModalData.mediateurNom}</span> ?
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#F3F3F2]">
              <button 
                type="button" 
                onClick={() => setDeleteConfirmModalData(null)} 
                className="px-3 py-1.5 text-xs font-bold text-[#404040]/70 hover:bg-[#F3F3F2] rounded-md transition-colors"
              >
                Annuler
              </button>
              <button 
                type="button" 
                onClick={confirmDeleteAction} 
                className="px-4 py-1.5 bg-[#EF736A] hover:bg-[#d95d54] text-white text-xs font-bold rounded-md shadow-sm transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE SAISIE DE NOUVELLE ACTION */}
      {promptModalData && (
        <div className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[130] p-4">
          <form 
            onSubmit={handleConfirmActionModal} 
            className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-xs space-y-3 shadow-2xl text-[#404040]"
          >
            <div className="flex justify-between items-center border-b border-[#F3F3F2] pb-2">
              <h3 className="font-bold text-sm text-[#005259]">
                Nouvelle action
              </h3>
              <button 
                type="button" 
                onClick={() => setPromptModalData(null)} 
                className="text-[#404040]/50 hover:text-[#404040]"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#404040]/80">
              Pour <span className="font-bold text-[#005259]">{promptModalData.prenom} {promptModalData.nom}</span> ({promptModalData.moment}) :
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#404040] font-bold uppercase">Nom ou lieu de l'action</label>
              <input
                autoFocus
                required
                placeholder="Ex: Permanence, RN Suresnes..."
                value={promptLieuInput}
                onChange={(e) => setPromptLieuInput(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none font-semibold focus:border-[#005259]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040] font-bold uppercase">Heure de début</label>
                <input
                  type="time"
                  value={promptDebutInput}
                  onChange={(e) => setPromptDebutInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none font-semibold focus:border-[#005259]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040] font-bold uppercase">Heure de fin</label>
                <input
                  type="time"
                  value={promptFinInput}
                  onChange={(e) => setPromptFinInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none font-semibold focus:border-[#005259]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#F3F3F2]">
              <button 
                type="button" 
                onClick={() => setPromptModalData(null)} 
                className="text-[#404040]/60 text-xs px-2 font-bold"
              >
                Annuler
              </button>
              <button 
                type="submit" 
                className="bg-[#005259] hover:bg-[#003d42] text-white px-4 py-1.5 rounded-lg text-xs font-bold"
              >
                Valider
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE CHOIX MODIFIER / COMMENTER (clic sur une case déjà remplie) */}
      {choixActionData && (
        <div className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[130] p-4" onClick={() => setChoixActionData(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-xs space-y-3 shadow-2xl text-[#404040]"
          >
            <div className="flex justify-between items-center border-b border-[#F3F3F2] pb-2">
              <h3 className="font-bold text-sm text-[#005259] truncate pr-2">{choixActionData.lieu}</h3>
              <button type="button" onClick={() => setChoixActionData(null)} className="text-[#404040]/50 hover:text-[#404040] shrink-0">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              {canCreateSlot && !estSemaineValidee && (
                <button
                  type="button"
                  onClick={handleDemarrerEditionAction}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#005259]/10 hover:bg-[#005259] hover:text-white text-[#005259] text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                  Modifier
                </button>
              )}
              {(canViewComment || canEditComment) && (
                <button
                  type="button"
                  onClick={() => { handleEditCommentaire(choixActionData.id, choixActionData.commentaire || ""); setChoixActionData(null); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#EA601F]/10 hover:bg-[#EA601F] hover:text-white text-[#EA601F] text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4" />
                  Commenter
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODALE MODIFICATION D'UNE ACTION EXISTANTE */}
      {editActionData && (
        <div className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[130] p-4">
          <form
            onSubmit={handleConfirmEditAction}
            className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-xs space-y-3 shadow-2xl text-[#404040]"
          >
            <div className="flex justify-between items-center border-b border-[#F3F3F2] pb-2">
              <h3 className="font-bold text-sm text-[#005259]">Modifier l'action</h3>
              <button type="button" onClick={() => setEditActionData(null)} className="text-[#404040]/50 hover:text-[#404040]">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#404040] font-bold uppercase">Nom ou lieu de l'action</label>
              <input
                autoFocus
                required
                value={editActionData.lieu}
                onChange={(e) => setEditActionData({ ...editActionData, lieu: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none font-semibold focus:border-[#005259]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040] font-bold uppercase">Heure de début</label>
                <input
                  type="time"
                  value={editActionData.debut}
                  onChange={(e) => setEditActionData({ ...editActionData, debut: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none font-semibold focus:border-[#005259]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040] font-bold uppercase">Heure de fin</label>
                <input
                  type="time"
                  value={editActionData.fin}
                  onChange={(e) => setEditActionData({ ...editActionData, fin: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none font-semibold focus:border-[#005259]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#F3F3F2]">
              <button type="button" onClick={() => setEditActionData(null)} className="text-[#404040]/60 text-xs px-2 font-bold">
                Annuler
              </button>
              <button type="submit" className="bg-[#005259] hover:bg-[#003d42] text-white px-4 py-1.5 rounded-lg text-xs font-bold">
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE COMMENTAIRES */}
      {activeCommentModal && (
        <div className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[120] p-4">
          <div className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-sm space-y-4 shadow-2xl text-[#404040]">
            <div className="flex justify-between items-center border-b border-[#F3F3F2] pb-2">
              <h3 className="font-bold text-sm text-[#005259] flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="w-4 h-4 text-[#EA601F]" /> 
                {activeCommentModal.readOnly ? "Note (Lecture seule)" : "Notes & Commentaires"}
              </h3>
              <button onClick={() => setActiveCommentModal(null)} className="text-[#404040]/50 hover:text-[#404040]">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#404040] font-bold">Précisions ou commentaires :</label>
              {activeCommentModal.readOnly ? (
                <div className="w-full bg-[#F3F3F2] border border-[#404040]/10 rounded-md text-xs text-[#404040] min-h-24 p-2.5 overflow-y-auto whitespace-pre-wrap">
                  {activeCommentModal.inputText || "Aucun commentaire."}
                </div>
              ) : (
                <textarea
                  rows={3}
                  className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none focus:border-[#005259] transition-colors resize-none h-24"
                  placeholder="Saisissez une note..."
                  value={activeCommentModal.inputText}
                  onChange={(e) => setActiveCommentModal({ ...activeCommentModal, inputText: e.target.value })}
                />
              )}
            </div>

            <div className="flex justify-between gap-2 pt-2 border-t border-[#F3F3F2]">
              {!activeCommentModal.readOnly && activeCommentModal.currentText ? (
                <button
                  type="button"
                  onClick={() => handleSaveCommentaire(true)}
                  className="bg-[#EF736A]/10 border border-[#EF736A] text-[#EF736A] hover:bg-[#EF736A] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <TrashIcon className="w-3.5 h-3.5" /> Supprimer
                </button>
              ) : <div />}
              
              <div className="flex gap-2">
                <button type="button" onClick={() => setActiveCommentModal(null)} className="text-[#404040]/60 text-xs px-2 font-bold">
                  {activeCommentModal.readOnly ? "Fermer" : "Annuler"}
                </button>
                {!activeCommentModal.readOnly && (
                  <button type="button" onClick={() => handleSaveCommentaire(false)} className="bg-[#005259] hover:bg-[#003d42] text-white px-4 py-1.5 rounded-lg text-xs font-bold">
                    Enregistrer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE STAFF */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[110] p-4">
          <form onSubmit={async (e) => {
            e.preventDefault();
            const payload = {
              prenom: newMed.prenom.trim(),
              nom: newMed.nom.trim(),
              poste: newMed.poste.trim() || "Médiateur",
              statut: newMed.statut,
              debutACI: newMed.debutACI,
              finACI: newMed.finACI,
              masque: newMed.masque,
              actif: true
            };

            if (editingMed) {
              await updateDoc(doc(db, "liste_mediateurs", editingMed.id), payload);
            } else {
              await addDoc(collection(db, "liste_mediateurs"), payload);
            }

            setNewMed({ prenom: "", nom: "", poste: "", statut: "Permanent", debutACI: "09:00", finACI: "17:00", masque: false });
            setEditingMed(null);
            setIsUserModalOpen(false);
          }} className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-xs space-y-3 shadow-2xl text-[#404040]">
            <h3 className="font-bold text-sm text-[#005259]">{editingMed ? "Modifier le membre" : "Nouveau médiateur"}</h3>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Prénom" value={newMed.prenom} className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none" required onChange={e => setNewMed({...newMed, prenom: e.target.value})} />
              <input placeholder="Nom" value={newMed.nom} className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none" required onChange={e => setNewMed({...newMed, nom: e.target.value})} />
            </div>
            <input placeholder="Poste" value={newMed.poste} className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none" onChange={e => setNewMed({...newMed, poste: e.target.value})} />
            <select className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none font-bold" value={newMed.statut} onChange={e => setNewMed({...newMed, statut: e.target.value})}>
              <option value="Cadre">Cadre</option>
              <option value="Permanent">Permanent</option>
              <option value="CIP">CIP</option>
              <option value="Prestataire">Prestataire</option>
              <option value="Stagiaire">Stagiaire</option>
              <option value="ACI">ACI</option>
            </select>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-[#005259] text-white py-1.5 rounded-md text-xs font-bold">Sauvegarder</button>
              <button type="button" onClick={() => { setIsUserModalOpen(false); setEditingMed(null); }} className="text-[#404040]/60 text-xs px-2 font-bold">Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE CRÉATION/ÉDITION MODÈLES */}
      {isActiviteModalOpen && (
        <div className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[110] p-4">
          <form onSubmit={handleSaveActiviteType} className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-xs space-y-3 shadow-2xl text-[#404040] max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold text-sm text-[#005259]">{editingActivite ? "Modifier le Modèle" : "Nouveau Modèle"}</h3>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#404040] font-bold uppercase">Nom de l'activité</label>
              <input 
                required
                placeholder="Ex: Atelier Numérique, RN Suresnes..." 
                value={newActivite.lieu} 
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none font-semibold" 
                onChange={e => setNewActivite({...newActivite, lieu: e.target.value})} 
              />
            </div>

            {localisations && localisations.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040]/70 font-semibold">Adresse prédéfinie (Optionnel)</label>
                <select 
                  className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none"
                  value={selectedLieuPredefini}
                  onChange={(e) => {
                    const selectedLieuNom = e.target.value;
                    setSelectedLieuPredefini(selectedLieuNom);
                    if (!selectedLieuNom) return;
                    const locFound = localisations?.find(l => (l.nomCourt || l.nomRaccourci) === selectedLieuNom || l.nomComplet === selectedLieuNom);
                    if (locFound) {
                      setNewActivite(prev => ({
                        ...prev,
                        adresse: `${locFound.adresse || ""}, ${locFound.codePostal || ""} ${locFound.ville || ""}`.trim(),
                        territoire: locFound.codePostal ? locFound.codePostal.substring(0, 2) : prev.territoire
                      }));
                    }
                  }}
                >
                  <option value="">-- Choisir une adresse --</option>
                  {localisations.map((loc) => (
                    <option key={loc.id} value={loc.nomCourt || loc.nomRaccourci || loc.nomComplet}>
                      {loc.nomCourt || loc.nomRaccourci || loc.nomComplet}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-[#404040] font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={!!newActivite.journeeComplete}
                onChange={e => {
                  const checked = e.target.checked;
                  setNewActivite({
                    ...newActivite,
                    journeeComplete: checked,
                    // Horaire par défaut d'une journée complète, à ajuster
                    // ensuite dans l'accordéon si besoin.
                    ...(checked ? { debutMatin: "09:30", finMatin: "13:00", debutApresMidi: "14:00", finApresMidi: "17:30" } : {}),
                  });
                  if (checked) setOpenSections(prev => ({ ...prev, horaires: true }));
                }}
                className="w-4 h-4 accent-[#005259] cursor-pointer"
              />
              Journée complète (horaire continu, ex. congés)
            </label>

            <Accordion title="Horaires (matin / après-midi)" open={!!openSections.horaires} onToggle={() => toggleSection("horaires")}>
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] text-[#404040]/50 font-bold uppercase tracking-wider">Matin</label>
                  <div className="grid grid-cols-2 gap-2 mt-0.5">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] text-[#404040]/70 font-bold uppercase">Heure début</label>
                      <input type="time" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.debutMatin || ""} onChange={e => setNewActivite({...newActivite, debutMatin: e.target.value})} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] text-[#404040]/70 font-bold uppercase">Heure fin</label>
                      <input type="time" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.finMatin || ""} onChange={e => setNewActivite({...newActivite, finMatin: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-[#404040]/50 font-bold uppercase tracking-wider">Après-midi</label>
                  <div className="grid grid-cols-2 gap-2 mt-0.5">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] text-[#404040]/70 font-bold uppercase">Heure début</label>
                      <input type="time" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.debutApresMidi || ""} onChange={e => setNewActivite({...newActivite, debutApresMidi: e.target.value})} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] text-[#404040]/70 font-bold uppercase">Heure fin</label>
                      <input type="time" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.finApresMidi || ""} onChange={e => setNewActivite({...newActivite, finApresMidi: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>
            </Accordion>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#404040]/70 font-semibold">Code Analytique BluePowder (Optionnel)</label>
              <input
                placeholder="Ex: 12345"
                value={newActivite.codeAnalytique}
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none"
                onChange={e => setNewActivite({...newActivite, codeAnalytique: e.target.value})}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#404040]/70 font-semibold">
                # ACI (Optionnel — ajouté en préfixe du titre dans Google Agenda)
              </label>
              <input
                placeholder="Ex: #accueil"
                value={newActivite.codeACI || ""}
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none"
                onChange={e => setNewActivite({...newActivite, codeACI: e.target.value})}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#404040]/70 font-semibold">
                Code interne Colombbus (Optionnel — sert à regrouper les heures dans Volume Horaire)
              </label>
              <input
                placeholder="Ex: REC"
                value={newActivite.codeInterne || ""}
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none"
                onChange={e => setNewActivite({...newActivite, codeInterne: e.target.value})}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#404040] font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={!!newActivite.estProduction}
                onChange={e => setNewActivite({...newActivite, estProduction: e.target.checked})}
                className="w-4 h-4 accent-[#005259] cursor-pointer"
              />
              Production Médiation Numérique
            </label>

            <div className="flex flex-col gap-1.5 p-2 rounded-md border border-[#404040]/10 bg-[#F3F3F2]">
              <label className="flex items-center gap-2 text-xs text-[#404040] font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!newActivite.observationACI}
                  onChange={e => setNewActivite({...newActivite, observationACI: e.target.checked})}
                  className="w-4 h-4 accent-[#005259] cursor-pointer"
                />
                Observation ACI (pas d'heures complémentaires)
              </label>
              {newActivite.observationACI && (
                <div className="flex flex-col gap-0.5 pl-6">
                  <label className="text-[9px] text-[#404040]/70 font-bold uppercase">Jusqu'au (optionnel — vide = indéfiniment)</label>
                  <input
                    type="date"
                    className="w-full px-2 py-1 bg-white border border-[#404040]/20 rounded text-xs text-[#404040]"
                    value={newActivite.observationACIDateFin || ""}
                    onChange={e => setNewActivite({...newActivite, observationACIDateFin: e.target.value})}
                  />
                </div>
              )}
            </div>


            <Accordion title="Apparence (bloc thématique, couleur)" open={!!openSections.apparence} onToggle={() => toggleSection("apparence")}>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040]/70 font-semibold">Bloc thématique (Optionnel, plusieurs possibles)</label>
                <div className="flex flex-col gap-1.5">
                  {BLOCS_THEMATIQUES.map(bloc => {
                    const isChecked = (newActivite.blocs || []).includes(bloc.id);
                    return (
                      <label
                        key={bloc.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer text-xs font-bold transition-all"
                        style={{
                          borderColor: bloc.couleur,
                          color: bloc.couleur,
                          backgroundColor: isChecked ? `${bloc.couleur}1F` : "transparent"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const current = newActivite.blocs || [];
                            const updated = isChecked ? current.filter(b => b !== bloc.id) : [...current, bloc.id];
                            setNewActivite({...newActivite, blocs: updated});
                          }}
                          className="w-3.5 h-3.5 cursor-pointer"
                          style={{ accentColor: bloc.couleur }}
                        />
                        {bloc.nom}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040] font-bold uppercase">Couleur Charte</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newActivite.couleur}
                    onChange={e => setNewActivite({...newActivite, couleur: e.target.value})}
                    className="w-8 h-8 rounded cursor-pointer border border-[#404040]/20 bg-transparent shrink-0"
                  />
                  <input
                    type="text"
                    value={newActivite.couleur}
                    onChange={e => setNewActivite({...newActivite, couleur: e.target.value})}
                    placeholder="#005259"
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs font-mono font-bold text-[#005259] outline-none"
                  />
                </div>
              </div>
            </Accordion>

            <Accordion title="Période & dates (visibilité dans la sidebar)" open={!!openSections.periode} onToggle={() => toggleSection("periode")}>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040]/70 font-semibold">Période de validité (Optionnel — sinon, toujours visible)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.dateDebut} onChange={e => setNewActivite({...newActivite, dateDebut: e.target.value})} />
                  <input type="date" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.dateFin} onChange={e => setNewActivite({...newActivite, dateFin: e.target.value})} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040]/70 font-semibold">Dates ponctuelles (Optionnel — pour une activité récurrente irrégulière, ex: Quintinie)</label>
                <div className="flex flex-wrap items-center gap-1 border border-[#404040]/10 rounded-md p-1.5">
                  {(newActivite.datesActives || []).slice().sort().map(d => (
                    <span key={d} className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#F3F3F2] border border-[#404040]/15 px-1.5 py-0.5 rounded-full text-[#404040]">
                      {formatDateFrCourt(d)}
                      <button
                        type="button"
                        onClick={() => setNewActivite({...newActivite, datesActives: (newActivite.datesActives || []).filter(x => x !== d)})}
                        className="text-[#404040]/50 hover:text-[#EF736A] cursor-pointer leading-none"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    type="date"
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) return;
                      const current = newActivite.datesActives || [];
                      if (!current.includes(val)) setNewActivite({...newActivite, datesActives: [...current, val]});
                    }}
                    title="Ajouter une date"
                    className="text-[10px] px-1.5 py-0.5 border border-dashed border-[#404040]/30 rounded-full bg-transparent text-[#404040]/60 cursor-pointer"
                  />
                </div>
              </div>
            </Accordion>

            {/* Section masquée temporairement (demande du 2026-09-15) — ne pas
                supprimer, juste décommenter pour la réafficher. Le modèle
                garde ses champs mediateursIds/generationMoment existants
                intacts (des modèles déjà configurés continuent de générer
                leurs créneaux normalement), seule cette UI d'édition est
                cachée.
            <Accordion title="Médiateurs & génération automatique" open={!!openSections.mediateurs} onToggle={() => toggleSection("mediateurs")}>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040]/70 font-semibold">Médiateurs concernés (Optionnel — sinon, modèle générique pour tous)</label>
                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto border border-[#404040]/10 rounded-md p-1.5">
                  {mediateurs.filter(m => m.actif !== false && (m.prenom || m.nom)).map(m => {
                    const isChecked = (newActivite.mediateursIds || []).includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 px-1 py-0.5 rounded text-xs font-semibold text-[#404040] cursor-pointer hover:bg-[#F3F3F2]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const current = newActivite.mediateursIds || [];
                            const updated = isChecked ? current.filter(id => id !== m.id) : [...current, m.id];
                            setNewActivite({...newActivite, mediateursIds: updated});
                          }}
                          className="w-3.5 h-3.5 cursor-pointer"
                        />
                        {m.prenom} {m.nom}
                      </label>
                    );
                  })}
                </div>
              </div>

              {(newActivite.mediateursIds || []).length > 0 && (
                <div className="flex flex-col gap-1 bg-[#EA601F]/5 border border-[#EA601F]/20 rounded-md p-2">
                  <label className="text-[10px] text-[#EA601F] font-bold uppercase">Génération automatique des créneaux</label>
                  {(!newActivite.dateDebut || !newActivite.dateFin) ? (
                    <p className="text-[10px] text-[#404040]/70">Renseignez une période ci-dessus pour générer automatiquement les créneaux de ces médiateurs sur les jours ouvrés.</p>
                  ) : (
                    <>
                      <p className="text-[10px] text-[#404040]/70">Un créneau sera posé automatiquement pour chaque médiateur choisi, sur chaque jour ouvré (hors jours fériés) de la période.</p>
                      <div className="flex gap-3 pt-0.5">
                        {(["Matin", "Après-midi", "Les deux"] as const).map(opt => (
                          <label key={opt} className="flex items-center gap-1 text-[10px] font-bold text-[#404040] cursor-pointer">
                            <input
                              type="radio"
                              name="generationMoment"
                              checked={(newActivite.generationMoment || "Les deux") === opt}
                              onChange={() => setNewActivite({...newActivite, generationMoment: opt})}
                              className="cursor-pointer"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Accordion>
            */}

            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-[#005259] text-white py-1.5 rounded-md text-xs font-bold">Valider</button>
              <button type="button" onClick={() => { setIsActiviteModalOpen(false); setEditingActivite(null); setSelectedLieuPredefini(""); }} className="text-[#404040]/60 text-xs px-2 font-bold">Annuler</button>
            </div>
          </form>
        </div>
      )}
      <ScrollToTopButton />
    </main>
    </PageGuard>
  );
}

// CELLULE INDIVIDUELLE DU PLANNING
interface DayCellProps {
  actions: ActionPlanning[];
  m: Mediateur;
  moment: string;
  date: string;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onEditCommentaire: (actionId: string, currentCommentaire: string) => void;
  onSlotClick: (action: ActionPlanning) => void;
  estSemaineValidee: boolean;
  canCreateSlot: boolean;
  canDeleteSlot: boolean;
  canOpenCommentaire: boolean;
  // Glisser-déposer D'UNE CASE À L'AUTRE (déplacement, distinct du
  // réordonnancement interne géré plus bas avec idGlisse) : actionEnGlisse
  // est l'action en cours de transport (state du composant parent, partagée
  // entre toutes les cases) ; onDragStartAction la démarre, onDropAction
  // déclenche le déplacement vers CETTE case précise.
  actionEnGlisse: ActionPlanning | null;
  onDragStartAction: (action: ActionPlanning | null) => void;
  onDropAction: (action: ActionPlanning) => void;
}

function DayCell({ actions, m, moment, date, onAdd, onDelete, onEditCommentaire, onSlotClick, estSemaineValidee, canCreateSlot, canDeleteSlot, canOpenCommentaire, actionEnGlisse, onDragStartAction, onDropAction }: DayCellProps) {
  const natifs = [...actions]
    .filter((a) => estActionDuMediateur(a, m) && a.date === date && a.moment === moment)
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));

  const [idGlisse, setIdGlisse] = useState<string | null>(null);
  // Réordonnancement interne (glisser une carte sur une autre, même case) :
  // seulement utile à partir de 2 actions. Le déplacement vers une AUTRE
  // case (peutDeplacer) n'a pas cette contrainte — une case avec une seule
  // action doit rester déplaçable.
  const peutGlisser = !estSemaineValidee && canCreateSlot && natifs.length > 1;
  const peutDeplacer = !estSemaineValidee && canDeleteSlot;
  const accepteDepot = canCreateSlot && !!actionEnGlisse;

  // Glisser-déposer pour réordonner librement les actions d'une même
  // demi-journée — remplace l'ordre d'arrivée Firestore par le champ "ordre",
  // recalculé pour toute la cellule à chaque dépôt afin de rester persistant.
  const deposer = async (idCible: string) => {
    if (!idGlisse || idGlisse === idCible) { setIdGlisse(null); return; }
    const indexSource = natifs.findIndex((a) => a.id === idGlisse);
    const indexCible = natifs.findIndex((a) => a.id === idCible);
    setIdGlisse(null);
    if (indexSource === -1 || indexCible === -1) return;
    const reordonnes = [...natifs];
    const [retire] = reordonnes.splice(indexSource, 1);
    reordonnes.splice(indexCible, 0, retire);
    await Promise.all(reordonnes.map((a, index) => (a.ordre === index ? Promise.resolve() : updateDoc(doc(db, "planning_mediateurs", a.id), { ordre: index }))));
  };

  // Dépose l'action transportée sur CETTE case (déplacement inter-cases) —
  // appelé aussi bien depuis le conteneur (case vide/espace libre) que
  // depuis une carte existante de la case de destination.
  const deposerIci = () => {
    if (!accepteDepot || !actionEnGlisse) return;
    onDropAction(actionEnGlisse);
    onDragStartAction(null);
  };

  return (
    <div
      className="flex flex-col relative group/cell h-full justify-start gap-1 min-h-[36px] bg-[#F3F3F2]/40 p-0.5 rounded border border-transparent hover:border-[#404040]/10 transition-colors"
      onDragOver={accepteDepot ? (e) => e.preventDefault() : undefined}
      onDrop={accepteDepot ? (e) => { e.preventDefault(); deposerIci(); } : undefined}
    >
      {natifs.map((a) => {
        const territorio = a.territoire || "";
        const hexColor = a.couleur || "#005259";
        const hasCommentaire = !!a.commentaire;

        const isLight = isLightColor(hexColor);
        const textColor = isLight ? "#1A1A1A" : hexColor;
        const cardBg = hexToRgba(hexColor, isLight ? 0.35 : 0.12);

        const peutCliquer = canOpenCommentaire || canCreateSlot;
        const peutGlisserCet = peutGlisser;
        const peutDeplacerCet = peutDeplacer;
        const horaireTexte = a.debut && a.fin ? `${a.debut} - ${a.fin}` : "";

        // Action réglée sur une journée complète (ex. 09h30-17h30) : la case
        // du matin garde l'heure de début réelle jusqu'à 13h00, celle de
        // l'après-midi va de 14h00 jusqu'à l'heure de fin réelle — chaque
        // case n'affiche que sa propre demi-journée, jamais l'autre.
        const fenetreMatin = FENETRES_DEMI_JOURNEE["Matin"];
        const fenetreApresMidi = FENETRES_DEMI_JOURNEE["Après-midi"];
        const chevaucheLesDeux = !!(a.debut && a.fin &&
          versMinutes(a.debut) < versMinutes(fenetreMatin.fin) &&
          versMinutes(a.fin) > versMinutes(fenetreApresMidi.debut));
        const detailHoraire = chevaucheLesDeux
          ? (moment === "Matin" ? `${a.debut} - ${fenetreMatin.fin}` : `${fenetreApresMidi.debut} - ${a.fin}`)
          : "";

        const infosBulle = [
          detailHoraire || horaireTexte,
          hasCommentaire ? `Note : ${a.commentaire}` : "",
          !hasCommentaire && peutCliquer ? "Cliquer pour modifier ou commenter" : "",
        ].filter(Boolean).join(" — ") || undefined;
        return (
          <div
            key={a.id}
            onClick={peutCliquer ? () => onSlotClick(a) : undefined}
            draggable={peutDeplacerCet}
            onDragStart={peutDeplacerCet ? (e) => { e.stopPropagation(); setIdGlisse(a.id); onDragStartAction(a); } : undefined}
            onDragEnd={peutDeplacerCet ? () => { setIdGlisse(null); onDragStartAction(null); } : undefined}
            onDragOver={peutGlisserCet || accepteDepot ? (e) => { e.preventDefault(); e.stopPropagation(); } : undefined}
            onDrop={peutGlisserCet || accepteDepot ? (e) => {
              e.preventDefault(); e.stopPropagation();
              if (idGlisse) { deposer(a.id); return; }
              deposerIci();
            } : undefined}
            style={{
              backgroundColor: cardBg,
              borderColor: hexColor,
              color: textColor,
              opacity: idGlisse === a.id ? 0.4 : 1
            }}
            className={`px-1.5 py-0.5 rounded border text-[10px] font-bold flex items-center justify-between w-full min-h-[24px] hover:shadow-sm transition-all relative ${peutCliquer ? "cursor-pointer" : ""} ${peutDeplacerCet ? "cursor-grab active:cursor-grabbing" : ""}`}
            title={infosBulle}
          >
            <span className="truncate pr-3" title={[`${moment} : ${a.lieu}`, detailHoraire || horaireTexte].filter(Boolean).join(" — ")}>
              {a.lieu} {territorio && <span className="text-[8px] opacity-70">[{territorio}]</span>}
            </span>

            {hasCommentaire && (
              canOpenCommentaire ? (
                <button
                  type="button"
                  title="Voir la note de ce créneau"
                  onClick={(e) => { e.stopPropagation(); onEditCommentaire(a.id, a.commentaire || ""); }}
                  className="absolute right-5 top-1 text-[#EA601F] hover:scale-125 transition-transform cursor-pointer z-10"
                >
                  <ChatBubbleLeftRightIcon className="w-2.5 h-2.5 fill-[#EA601F]/20" />
                </button>
              ) : (
                <span className="absolute right-5 top-1 text-[#EA601F]">
                  <ChatBubbleLeftRightIcon className="w-2.5 h-2.5 fill-[#EA601F]/20" />
                </span>
              )
            )}

            {!estSemaineValidee && canDeleteSlot && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}
                className="hover:text-[#EF736A] p-0.5 shrink-0 z-10"
                style={{ color: isLight ? "#404040" : undefined }}
              >
                <TrashIcon className="w-2.5 h-2.5"/>
              </button>
            )}
          </div>
        );
      })}

      {natifs.length === 0 ? (
        canCreateSlot && (
        <button
          onClick={onAdd}
          disabled={estSemaineValidee}
          className={`w-full h-full min-h-[26px] border border-dashed rounded flex items-center justify-center text-[10px] transition-all font-semibold ${
            estSemaineValidee
              ? "border-[#404040]/10 text-[#404040]/20 cursor-not-allowed"
              : "border-[#404040]/20 hover:border-[#005259] text-[#404040]/40 hover:text-[#005259] cursor-pointer"
          }`}
        >
          {moment === "Matin" ? "AM" : "PM"}
        </button>
        )
      ) : !estSemaineValidee && canCreateSlot ? (
        <button
          onClick={onAdd}
          className="opacity-0 group-hover/cell:opacity-100 transition-opacity w-full py-0.5 bg-white border border-dashed border-[#005259] rounded flex items-center justify-center text-[#005259] text-[8px] font-bold cursor-pointer"
        >
          + Autre
        </button>
      ) : null}
    </div>
  );
}

// Regroupe les lieux dont le nom normalisé (espaces/casse ignorés) est
// identique — ex. "91 - NK UP TECH" et "91 - NKUP TECH" — sous UN même
// libellé, sans jamais fondre les variantes ensemble : chacune garde sa
// propre ligne (voir le croquis fourni), avec sa propre barre continue sur
// sa vraie période d'activité plutôt qu'un total hebdomadaire agrégé.
function normaliserLieuGantt(lieu: string): string {
  return lieu.toLowerCase().replace(/\s+/g, "");
}

// Territoire d'une ligne : le préfixe avant le premier " - " du libellé
// (ex. "92" pour "92 - NK PRO TECH DEV", "ACI" pour "ACI - Attente avant A")
// — sert à reclasser chronologiquement les activités d'un même territoire
// entre elles (voir lignesBase plus bas), plutôt qu'à l'échelle de toute la
// liste. Un libellé sans " - " (ex. "INFOCOLL PRFE") forme son propre
// groupe à lui seul, sans effet.
function territoireDeLigne(label: string): string {
  const i = label.indexOf(" - ");
  return i >= 0 ? label.slice(0, i).trim() : label.trim();
}

// Libellé de groupe pour une ligne sans territoire renseigné (voir
// lignesBase/groupesTerritoire plus bas) — le champ territoire d'une action
// est le badge du modèle (ex. "75"), pas un texte extrait du lieu.
const SANS_TERRITOIRE = "Sans territoire";

// Regroupement d'affichage pour la légende de la vue GANTT par médiateur :
// les lieux du 75 sont soit des écoles, soit des résidences autonomie — trop
// nombreux pour lister chaque site un par un dans une légende, alors que
// leur famille (pas le site précis) est ce qui compte pour s'y retrouver.
// Les autres territoires (91, 92...) gardent leur libellé exact.
function etiquetteLegendeGantt(lieu: string): string {
  if (territoireDeLigne(lieu) !== "75") return lieu;
  return /[ée]cole/i.test(lieu) ? "Écoles" : "Résidence Autonomie";
}

function joursEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// Vue GANTT en lecture seule, axée activité : chaque variante de lieu a une
// seule barre positionnée et dimensionnée selon ses vraies dates de
// première/dernière occurrence sur la période — un vrai diagramme de Gantt
// plutôt qu'une grille de cases par semaine.
// Largeur d'une colonne-jour sur la vue GANTT continue — assez large pour
// afficher le numéro du jour en en-tête (voir jours/LARGEUR_JOUR plus bas).
const LARGEUR_JOUR = 26;

interface DetailBarreGantt {
  ligneLabel: string;
  texte: string;
  debut: Date;
  fin: Date;
  medDistincts: string[];
  nbSansMediateur: number;
  heures: number;
}

function GanttActiviteContinu({ actions, premierJour, dernierJour, mediateurLabel, joursFeries, estLieuAbsence }: { actions: ActionPlanning[]; premierJour: Date; dernierJour: Date; mediateurLabel?: string; joursFeries: Set<string>; estLieuAbsence?: (lieu?: string) => boolean }) {
  const [detailBarre, setDetailBarre] = useState<DetailBarreGantt | null>(null);
  const [detailJour, setDetailJour] = useState<{ date: Date; actions: ActionPlanning[] } | null>(null);
  // Territoires repliés dans la vue "par activité" (voir plus bas) : un Set
  // de clés, chacune togglée indépendamment des autres — pas un seul état
  // "territoire actif" façon accordéon classique, qui refermerait les autres
  // en ouvrant un nouveau (comportement explicitement rejeté par l'utilisateur).
  const [territoiresReplies, setTerritoiresReplies] = useState<Set<string>>(new Set());
  const toggleTerritoire = (territoire: string) => {
    setTerritoiresReplies(prev => {
      const suivant = new Set(prev);
      if (suivant.has(territoire)) suivant.delete(territoire); else suivant.add(territoire);
      return suivant;
    });
  };
  const totalJours = joursEntre(premierJour, dernierJour) + 1;
  const px = (date: Date) => joursEntre(premierJour, date) * LARGEUR_JOUR;
  const largeurTimeline = totalJours * LARGEUR_JOUR;

  // Barre de défilement horizontal dupliquée en haut, synchronisée avec le
  // défilement réel du corps — sinon, sur une période large (plusieurs
  // mois), la seule barre de défilement se trouve tout en bas de la page,
  // loin de l'en-tête des mois/jours (même mécanisme que les pages Réponses
  // à colonnes figées). La largeur exacte du contenu est déjà connue
  // (200 + largeurTimeline), pas besoin de la mesurer dans le DOM.
  const scrollHautRef = useRef<HTMLDivElement>(null);
  const scrollCorpsRef = useRef<HTMLDivElement>(null);
  const synchroniseEnCours = useRef(false);
  const surScrollHaut = () => {
    if (synchroniseEnCours.current) { synchroniseEnCours.current = false; return; }
    if (scrollHautRef.current && scrollCorpsRef.current) {
      synchroniseEnCours.current = true;
      scrollCorpsRef.current.scrollLeft = scrollHautRef.current.scrollLeft;
    }
  };
  const surScrollCorps = () => {
    if (synchroniseEnCours.current) { synchroniseEnCours.current = false; return; }
    if (scrollHautRef.current && scrollCorpsRef.current) {
      synchroniseEnCours.current = true;
      scrollHautRef.current.scrollLeft = scrollCorpsRef.current.scrollLeft;
    }
  };
  const barreScrollHaut = (
    <div ref={scrollHautRef} onScroll={surScrollHaut} className="sticky top-[60px] z-20 bg-white border-b border-[#404040]/10 overflow-x-auto overflow-y-hidden py-2 mb-2">
      <div style={{ width: `${200 + largeurTimeline}px`, height: 1 }} />
    </div>
  );

  const mois: { debut: Date; label: string }[] = [];
  let curseurMois = new Date(premierJour.getFullYear(), premierJour.getMonth(), 1);
  while (curseurMois <= dernierJour) {
    mois.push({ debut: new Date(curseurMois), label: curseurMois.toLocaleDateString('fr-FR', { month: 'short' }) });
    curseurMois = new Date(curseurMois.getFullYear(), curseurMois.getMonth() + 1, 1);
  }

  // Une case par jour (voir LARGEUR_JOUR) plutôt qu'un seul bloc par mois —
  // le quadrillage journalier sert de repère pour lire la position exacte
  // des barres, avec le numéro du jour en en-tête.
  const jours: Date[] = [];
  let curseurJour = new Date(premierJour);
  while (curseurJour <= dernierJour) {
    jours.push(new Date(curseurJour));
    curseurJour = new Date(curseurJour);
    curseurJour.setDate(curseurJour.getDate() + 1);
  }
  // Quadrillage journalier dessiné en un seul dégradé répété par ligne
  // (plutôt qu'une div par jour et par ligne, ~180 jours × N lignes) — bien
  // moins de nœuds DOM pour le même rendu visuel.
  const grilleJournaliere = `repeating-linear-gradient(to right, #F3F3F2 0px, #F3F3F2 1px, transparent 1px, transparent ${LARGEUR_JOUR}px)`;

  const estJourOff = (j: Date) => {
    const jourSemaine = j.getDay();
    return jourSemaine === 0 || jourSemaine === 6 || joursFeries.has(j.toLocaleDateString('en-CA'));
  };
  // Grisé week-ends/fériés : un unique dégradé à paliers nets (calculé une
  // fois, réutilisé pour toutes les lignes) plutôt qu'une div par jour off
  // et par ligne — même logique d'économie de nœuds DOM que grilleJournaliere.
  const ombreJoursOff = `linear-gradient(to right, ${jours
    .map((j, i) => {
      const couleur = estJourOff(j) ? "rgba(64,64,64,0.07)" : "transparent";
      return `${couleur} ${i * LARGEUR_JOUR}px, ${couleur} ${(i + 1) * LARGEUR_JOUR}px`;
    })
    .join(", ")})`;

  const enTeteMoisEtJours = (
    <>
      <div className="flex">
        <div className="w-[200px] shrink-0" />
        <div className="relative h-4" style={{ width: `${largeurTimeline}px` }}>
          {mois.map(mo => (
            <span key={mo.debut.toISOString()} className="absolute text-[10px] font-extrabold uppercase text-[#005259]" style={{ left: `${px(mo.debut)}px` }}>
              {mo.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex mb-2">
        <div className="w-[200px] shrink-0" />
        <div className="relative h-3" style={{ width: `${largeurTimeline}px`, backgroundImage: ombreJoursOff }}>
          {jours.map(j => {
            const dateStr = j.toLocaleDateString('en-CA');
            const estFerie = joursFeries.has(dateStr);
            const estWeekend = !estFerie && estJourOff(j);
            return (
              <span
                key={j.toISOString()}
                className={`absolute text-[8px] font-bold text-center ${estFerie ? "text-[#EF736A]" : estWeekend ? "text-[#404040]/50" : "text-[#404040]/40"}`}
                style={{ left: `${px(j)}px`, width: `${LARGEUR_JOUR}px` }}
              >
                {j.getDate()}
              </span>
            );
          })}
        </div>
      </div>
    </>
  );

  // Vue par médiateur·rice (voir le sélecteur au-dessus) : une seule ligne
  // pour la personne, une case par jour où elle a au moins une action — une
  // sous-ligne par action supplémentaire le même jour, plutôt que d'essayer
  // de tout résumer dans une seule case. Clic sur une case : le détail des
  // actions de ce jour (voir detailJour), pas juste un survol.
  if (mediateurLabel) {
    const parDate = new Map<string, ActionPlanning[]>();
    for (const a of actions) {
      if (!a.date) continue;
      if (!parDate.has(a.date)) parDate.set(a.date, []);
      parDate.get(a.date)!.push(a);
    }
    // Les absences (voir estLieuAbsence) occupent une bande de lignes à part,
    // toujours à la même hauteur d'un jour à l'autre — sans ça, leur lane
    // dépendait du nombre d'actions ce jour-là précis et sautait d'une place
    // à l'autre, rendant impossible de les repérer d'un coup d'œil au fil
    // des jours. La bande démarre juste sous la plus grande pile d'activités
    // réelles vue sur n'importe quel jour de la période.
    const nbLanesActivites = Math.max(0, ...Array.from(parDate.values(), acts => acts.filter(a => !estLieuAbsence?.(a.lieu)).length));
    const nbLanesAbsences = Math.max(0, ...Array.from(parDate.values(), acts => acts.filter(a => estLieuAbsence?.(a.lieu)).length));
    const nbLanes = Math.max(1, nbLanesActivites + nbLanesAbsences);

    // Légende lieu → couleur : les cases sont trop étroites (voir
    // LARGEUR_JOUR) pour porter le nom de l'activité, la couleur seule ne
    // suffit pas à s'y retrouver sans elle. Par lieu et non par couleur —
    // plusieurs lieux distincts peuvent partager la même couleur de modèle.
    const legende = new Map<string, string>();
    for (const a of actions) {
      if (!a.lieu) continue;
      const etiquette = etiquetteLegendeGantt(a.lieu);
      if (!legende.has(etiquette)) legende.set(etiquette, a.couleur || "#005259");
    }
    const legendeTriee = Array.from(legende.entries()).sort((a, b) => a[0].localeCompare(b[0], "fr"));

    return (
      <div className="bg-white border border-[#404040]/10 rounded-xl p-4 shadow-sm">
        {barreScrollHaut}
        <div ref={scrollCorpsRef} onScroll={surScrollCorps} className="overflow-x-auto overflow-y-visible">
          <div style={{ width: `${200 + largeurTimeline}px` }}>
            {enTeteMoisEtJours}
            <div className="flex border-b border-[#F3F3F2]">
              <div className="w-[200px] shrink-0 pr-2 py-2 sticky left-0 z-10 bg-white flex items-center">
                <span className="font-bold text-[#005259] text-xs">{mediateurLabel}</span>
              </div>
              <div
                className="relative"
                style={{ width: `${largeurTimeline}px`, minHeight: `${nbLanes * 24 + 8}px`, backgroundImage: `${grilleJournaliere}, ${ombreJoursOff}` }}
              >
                {mois.map(mo => (
                  <div key={mo.debut.toISOString()} className="absolute top-0 bottom-0 border-l border-[#404040]/20" style={{ left: `${px(mo.debut)}px` }} />
                ))}
                {/* Démarcation nette entre activités et absences : un trait
                    pointillé à la frontière des deux bandes, seulement si
                    les deux existent réellement sur la période. */}
                {nbLanesActivites > 0 && nbLanesAbsences > 0 && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-dashed border-[#EF736A]/40"
                    style={{ top: `${nbLanesActivites * 24 + 2}px` }}
                  />
                )}
                {jours.flatMap(j => {
                  const dateStr = j.toLocaleDateString('en-CA');
                  const actsJourBrut = parDate.get(dateStr) || [];
                  const activitesJour = actsJourBrut
                    .filter(a => !estLieuAbsence?.(a.lieu))
                    .sort((a, b) => (a.debut || "").localeCompare(b.debut || "") || (a.ordre ?? 0) - (b.ordre ?? 0));
                  const absencesJour = actsJourBrut.filter(a => estLieuAbsence?.(a.lieu));
                  const actsJour = [...activitesJour, ...absencesJour];
                  return actsJour.map((a, i) => {
                    const estAbsence = estLieuAbsence?.(a.lieu) ?? false;
                    const lane = estAbsence ? nbLanesActivites + absencesJour.indexOf(a) : activitesJour.indexOf(a);
                    const alerte = !(a.mediateurNom || "").trim();
                    return (
                      <button
                        key={`${dateStr}-${i}`}
                        type="button"
                        onClick={() => setDetailJour({ date: j, actions: actsJour })}
                        title={`${a.lieu || "?"}${a.debut && a.fin ? ` · ${a.debut}-${a.fin}` : ""}${alerte ? " · ⚠️ sans médiateur" : ""}`}
                        className={`absolute rounded shadow-sm cursor-pointer hover:brightness-110 ${alerte ? "ring-2 ring-[#EF736A] ring-offset-1" : ""} ${estAbsence ? "border-2 border-dashed border-white/70" : ""}`}
                        style={{
                          top: `${lane * 24 + 4}px`,
                          left: `${px(j) + 1}px`,
                          width: `${LARGEUR_JOUR - 2}px`,
                          height: "20px",
                          backgroundColor: a.couleur || "#005259",
                        }}
                      />
                    );
                  });
                })}
              </div>
            </div>
          </div>
        </div>

        {legendeTriee.length > 0 && (
          <div className="sticky top-[60px] z-20 mt-3 bg-white border border-[#404040]/10 rounded-xl p-3 shadow-sm flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {legendeTriee.map(([lieu, couleur]) => (
              <div key={lieu} className="flex items-center gap-1.5">
                <span className="rounded shrink-0" style={{ width: `${LARGEUR_JOUR - 2}px`, height: "20px", backgroundColor: couleur }} />
                <span className="text-[#404040]/70 font-medium">{lieu}</span>
              </div>
            ))}
          </div>
        )}

        {detailJour && (
          <div
            className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[140] p-4"
            onClick={() => setDetailJour(null)}
          >
            <div
              className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-sm space-y-3 shadow-2xl text-[#404040] animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-sm text-[#005259] capitalize">{detailJour.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                <button type="button" onClick={() => setDetailJour(null)} className="text-[#404040]/40 hover:text-[#005259] shrink-0">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <ul className="space-y-1.5">
                {detailJour.actions.map((a, i) => {
                  const sansMediateur = !(a.mediateurNom || "").trim();
                  return (
                    <li key={i} className="text-xs bg-[#F3F3F2] rounded-lg px-3 py-2 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.couleur || "#005259" }} />
                      <span className="flex-1">
                        <span className="font-bold text-[#404040]">{a.lieu || "?"}</span>
                        {a.debut && a.fin && <span className="text-[#404040]/60"> · {a.debut}-{a.fin}</span>}
                      </span>
                      {sansMediateur && <ExclamationTriangleIcon className="w-4 h-4 text-[#EF736A] shrink-0" />}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  const groupes = new Map<string, { label: string; estAbsences: boolean; frequence: Map<string, number>; territoireFrequence: Map<string, number>; variantes: Map<string, ActionPlanning[]> }>();
  for (const a of actions) {
    if (!a.lieu || !a.date) continue;
    // Tous les lieux "Absence" (voir estLieuAbsence) partagent une seule et
    // même ligne "Absences", quel que soit le type exact (congés, RTT...) —
    // chaque type garde sa propre barre à l'intérieur de cette ligne (voir
    // "variantes" plus bas, toujours indexées par texte de lieu réel).
    const estAbsenceLigne = estLieuAbsence?.(a.lieu) ?? false;
    const cle = estAbsenceLigne ? "__absences__" : normaliserLieuGantt(a.lieu);
    let g = groupes.get(cle);
    if (!g) {
      g = { label: estAbsenceLigne ? "Absences" : a.lieu, estAbsences: estAbsenceLigne, frequence: new Map(), territoireFrequence: new Map(), variantes: new Map() };
      groupes.set(cle, g);
    }
    g.frequence.set(a.lieu, (g.frequence.get(a.lieu) || 0) + 1);
    // Territoire réel du modèle/action (le petit badge affiché sur les
    // fiches modèle, ex. "75", "91"), PAS un préfixe extrait du libellé —
    // la plupart des lieux (ABSENCE, ACI, ERP, EVRY...) n'ont pas de "XX - "
    // dans leur nom alors qu'ils ont bien un territoire renseigné à part.
    // Recadré (espaces superflus) pour éviter que deux saisies équivalentes
    // ("75" et " 75 ") ne forment deux groupes distincts.
    const territoireAction = (a.territoire || "").trim();
    if (territoireAction) g.territoireFrequence.set(territoireAction, (g.territoireFrequence.get(territoireAction) || 0) + 1);
    if (!g.variantes.has(a.lieu)) g.variantes.set(a.lieu, []);
    g.variantes.get(a.lieu)!.push(a);
  }

  const lignesBase = Array.from(groupes.values()).map(g => {
    // Libellé partagé de la ligne : la variante la plus fréquente, pas
    // forcément la première rencontrée — sauf la ligne "Absences" (voir
    // estAbsences), qui garde toujours ce nom plutôt que celui du type
    // d'absence le plus fréquent.
    let label = g.label, max = 0;
    if (!g.estAbsences) {
      for (const [v, n] of g.frequence) if (n > max) { max = n; label = v; }
    }

    // Chaque variante de lieu peut elle-même produire PLUSIEURS barres : ses
    // occurrences ne sont pas forcément des jours calendaires consécutifs
    // (ex. Résidences Autonomie — des dates ponctuelles précises, pas une
    // présence continue). Une seule barre du premier au dernier jour aurait
    // caché les vrais trous entre deux dates espacées ; on ne relie donc que
    // des jours réellement à la suite, chaque rupture ouvrant une nouvelle
    // barre — toutes les barres d'une même variante partagent la même
    // ligne/lane pour rester groupées visuellement.
    const variantesEntrees = Array.from(g.variantes.entries());
    const barres: { texte: string; debut: Date; fin: Date; medDistincts: string[]; nbSansMediateur: number; heures: number; couleur?: string; lane: number }[] = [];
    variantesEntrees.forEach(([texte, acts], lane) => {
      const parDate = new Map<string, ActionPlanning[]>();
      for (const a of acts) {
        if (!parDate.has(a.date)) parDate.set(a.date, []);
        parDate.get(a.date)!.push(a);
      }
      const datesTriees = Array.from(parDate.keys()).sort().map(d => new Date(`${d}T12:00:00`));
      let debutTroncon = datesTriees[0];
      let finTroncon = datesTriees[0];
      const clorreTroncon = () => {
        const actsTroncon = datesTriees
          .filter(d => d.getTime() >= debutTroncon.getTime() && d.getTime() <= finTroncon.getTime())
          .flatMap(d => parDate.get(d.toLocaleDateString('en-CA'))!);
        // Une action sans médiateur assigné (mediateurNom vide) signale un
        // créneau probablement mal renseigné — jamais comptée comme un nom
        // dans medDistincts (voir l'alerte affichée dessus et dans la popup).
        const avecMediateur = actsTroncon.filter(a => (a.mediateurNom || "").trim());
        barres.push({
          texte,
          debut: debutTroncon,
          fin: finTroncon,
          medDistincts: Array.from(new Set(avecMediateur.map(a => a.mediateurNom as string))),
          nbSansMediateur: actsTroncon.length - avecMediateur.length,
          heures: actsTroncon.reduce((total, a) => total + calculerDureeHeures(a.debut || "", a.fin || "", a.lieu), 0),
          couleur: actsTroncon[0]?.couleur,
          lane,
        });
      };
      for (let i = 1; i < datesTriees.length; i++) {
        if (joursEntre(finTroncon, datesTriees[i]) === 1) {
          finTroncon = datesTriees[i];
        } else {
          clorreTroncon();
          debutTroncon = datesTriees[i];
          finTroncon = datesTriees[i];
        }
      }
      clorreTroncon();
    });

    // Territoire de la ligne : la valeur la plus fréquente parmi ses
    // actions (le badge de territoire du modèle, pas un texte extrait du
    // libellé) — "Sans territoire" quand aucune action de ce groupe n'en a
    // un renseigné. La ligne "Absences" garde son propre groupe à part
    // (elle peut mélanger des absences de plusieurs territoires).
    let territoire = SANS_TERRITOIRE, maxTerritoire = 0;
    if (g.estAbsences) {
      territoire = "Absences";
    } else {
      for (const [v, n] of g.territoireFrequence) if (n > maxTerritoire) { maxTerritoire = n; territoire = v; }
    }

    return { label, territoire, barres, nbLanes: variantesEntrees.length, estAbsences: g.estAbsences };
  }).sort((a, b) => {
    // La ligne "Absences" (voir estLieuAbsence — non fourni hors mode
    // "Isoler absences", donc estAbsences toujours faux) ne remonte en haut
    // qu'en mode isolé ; en affichage normal elle reste triée par territoire
    // comme les autres.
    if (estLieuAbsence) {
      const aAbsence = a.estAbsences ? 0 : 1;
      const bAbsence = b.estAbsences ? 0 : 1;
      if (aAbsence !== bAbsence) return aAbsence - bAbsence;
    }
    // "Sans territoire" toujours en dernier plutôt que mélangé
    // alphabétiquement au milieu des vrais codes territoire.
    const aVide = a.territoire === SANS_TERRITOIRE ? 1 : 0;
    const bVide = b.territoire === SANS_TERRITOIRE ? 1 : 0;
    if (aVide !== bVide) return aVide - bVide;
    if (a.territoire !== b.territoire) return a.territoire.localeCompare(b.territoire, "fr");
    return a.label.localeCompare(b.label, "fr");
  });

  // Au sein d'un même territoire, les activités s'enchaînent souvent dans le
  // temps plutôt que d'être indépendantes — les reclasser par date de début
  // plutôt qu'alphabétiquement rend cet enchaînement visible d'un coup
  // d'œil. Territoires eux-mêmes toujours dans leur ordre habituel (voir le
  // tri ci-dessus) : seules les VALEURS occupant les positions déjà tenues
  // par un même territoire sont réordonnées entre elles, sans déplacer les
  // autres lignes.
  const indicesParTerritoire = new Map<string, number[]>();
  lignesBase.forEach((l, i) => {
    const t = l.territoire;
    if (!indicesParTerritoire.has(t)) indicesParTerritoire.set(t, []);
    indicesParTerritoire.get(t)!.push(i);
  });
  const lignes = [...lignesBase];
  for (const indices of indicesParTerritoire.values()) {
    if (indices.length < 2) continue;
    const trieesParDate = indices
      .map(i => lignesBase[i])
      .sort((a, b) => Math.min(...a.barres.map(v => v.debut.getTime())) - Math.min(...b.barres.map(v => v.debut.getTime())));
    indices.forEach((idx, k) => { lignes[idx] = trieesParDate[k]; });
  }

  if (lignes.length === 0) {
    return <p className="text-xs italic text-[#404040]/40 py-6 text-center bg-white border border-[#404040]/10 rounded-xl shadow-sm">Aucune activité posée sur cette période.</p>;
  }

  // Regroupement par territoire réel (voir ligne.territoire) pour
  // l'accordéon — les lignes étant déjà triées par territoire, un même
  // territoire est toujours contigu dans "lignes", pas besoin de les re-trier.
  const groupesTerritoire: { territoire: string; lignes: typeof lignes }[] = [];
  for (const ligne of lignes) {
    const t = ligne.territoire;
    const dernier = groupesTerritoire[groupesTerritoire.length - 1];
    if (dernier && dernier.territoire === t) dernier.lignes.push(ligne);
    else groupesTerritoire.push({ territoire: t, lignes: [ligne] });
  }

  const renderLigneGantt = (ligne: typeof lignes[number], idx: number) => {
    // Ligne "Absences" nettement démarquée des vraies activités : fond
    // teinté et trait épais dessous, plutôt que la simple alternance
    // blanc/gris des autres lignes.
    const rowBg = ligne.estAbsences ? "bg-[#EF736A]/10" : (idx % 2 === 0 ? "bg-white" : "bg-[#F3F3F2]/40");
    // Équivalent opaque de rowBg, réservé à la colonne figée (voir plus
    // bas) : les teintes ci-dessus sont volontairement translucides pour la
    // ligne elle-même (posées sur le quadrillage), mais une colonne sticky
    // AVEC de la transparence laisse voir par transparence les barres de la
    // même ligne qui défilent en-dessous une fois détachée au scroll — il
    // lui faut la couleur "à plat", sans alpha.
    const rowBgSolide = ligne.estAbsences ? "bg-[#FDF1F0]" : (idx % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]");
    // Sur la ligne "Absences", le type exact (Congés, RTT...) de chaque lane
    // s'affiche dans la colonne d'en-tête, aligné avec sa barre — plutôt
    // qu'un seul libellé générique "Absences" centré sur toute la hauteur,
    // qui ne dit pas CE QUE c'est.
    const typesParLane = ligne.estAbsences
      ? Array.from(new Map(ligne.barres.map(v => [v.lane, v.texte])).entries()).sort(([a], [b]) => a - b)
      : [];
    return (
      <div key={ligne.label} className={`flex ${ligne.estAbsences ? "border-b-2 border-[#EF736A]/30" : "border-b border-[#F3F3F2]"} ${rowBg}`}>
        {/* Fond opaque obligatoire sur la colonne figée elle-même (pas
            seulement sur la ligne parente) : en position sticky, elle se
            détache visuellement du reste de la ligne au défilement
            horizontal — sans son propre fond, les barres de CETTE ligne
            qui défilent sous elle se voyaient par transparence. */}
        <div className={`w-[200px] shrink-0 pr-2 py-2 sticky left-0 z-10 ${rowBgSolide} ${ligne.estAbsences ? "relative" : "flex items-center"}`} style={ligne.estAbsences ? { minHeight: `${ligne.nbLanes * 24 + 8}px` } : undefined}>
          {ligne.estAbsences ? (
            typesParLane.map(([lane, texte]) => (
              <span
                key={lane}
                className="absolute left-0 right-2 h-5 flex items-center font-bold text-[11px] text-[#EF736A] truncate"
                style={{ top: `${lane * 24 + 4}px` }}
                title={texte}
              >
                {texte}
              </span>
            ))
          ) : (
            <span className={`font-bold text-xs ${rowBg} text-[#005259]`}>{ligne.label}</span>
          )}
        </div>
        <div
          className="relative"
          style={{ width: `${largeurTimeline}px`, minHeight: `${ligne.nbLanes * 24 + 8}px`, backgroundImage: `${grilleJournaliere}, ${ombreJoursOff}` }}
        >
          {mois.map(mo => (
            <div key={mo.debut.toISOString()} className="absolute top-0 bottom-0 border-l border-[#404040]/20" style={{ left: `${px(mo.debut)}px` }} />
          ))}
          {ligne.barres.map(v => {
            const largeur = Math.max(px(v.fin) - px(v.debut) + LARGEUR_JOUR, LARGEUR_JOUR);
            const effectifTexte = `${v.medDistincts.length} médiateur${v.medDistincts.length > 1 ? "s" : ""}`;
            const alerte = v.nbSansMediateur > 0;
            return (
              <button
                key={`${v.texte}-${v.debut.toISOString()}`}
                type="button"
                onClick={() => setDetailBarre({ ligneLabel: ligne.label, texte: v.texte, debut: v.debut, fin: v.fin, medDistincts: v.medDistincts, nbSansMediateur: v.nbSansMediateur, heures: v.heures })}
                title={`${v.texte} · ${v.debut.toLocaleDateString('fr-FR')} - ${v.fin.toLocaleDateString('fr-FR')} · ${v.medDistincts.join(", ")}${alerte ? ` · ⚠️ ${v.nbSansMediateur} sans médiateur` : ""}`}
                className={`absolute h-5 rounded px-1.5 flex items-center gap-1 text-[10px] font-bold truncate shadow-sm cursor-pointer hover:brightness-110 ${alerte ? "ring-2 ring-[#EF736A] ring-offset-1" : ""}`}
                style={{
                  top: `${v.lane * 24 + 4}px`,
                  left: `${px(v.debut)}px`,
                  width: `${largeur}px`,
                  backgroundColor: v.couleur || "#005259",
                  color: isLightColor(v.couleur || "#005259") ? "#1A1A1A" : "#FFFFFF",
                }}
              >
                {alerte && <ExclamationTriangleIcon className="w-3 h-3 shrink-0 text-[#EF736A]" />}
                {ligne.nbLanes > 1 ? `${v.lane + 1} · ` : ""}{effectifTexte}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-[#404040]/10 rounded-xl p-4 shadow-sm">
      {barreScrollHaut}
      <div ref={scrollCorpsRef} onScroll={surScrollCorps} className="overflow-x-auto overflow-y-visible">
      <div style={{ width: `${200 + largeurTimeline}px` }}>
        {enTeteMoisEtJours}
        {groupesTerritoire.map((groupe, gi) => {
          const replie = territoiresReplies.has(groupe.territoire);
          return (
            <div key={`${groupe.territoire}-${gi}`}>
              {/* Comme les lignes (voir renderLigneGantt), seule la colonne
                  de 200px est figée au défilement horizontal — un en-tête
                  "sticky" sur toute la largeur resterait figé en permanence
                  au lieu de défiler avec le reste, et son fond translucide
                  laissait voir les barres défiler derrière lui. */}
              <div className="flex border-b border-[#404040]/10">
                <button
                  type="button"
                  onClick={() => toggleTerritoire(groupe.territoire)}
                  className="w-[200px] shrink-0 flex items-center gap-1.5 py-1.5 pr-2 sticky left-0 z-10 bg-[#EAF1F1] hover:bg-[#DCEBEB] text-left"
                >
                  {replie ? <ChevronRightIcon className="w-3.5 h-3.5 text-[#005259] shrink-0" /> : <ChevronDownIcon className="w-3.5 h-3.5 text-[#005259] shrink-0" />}
                  <span className="font-extrabold text-[10px] uppercase tracking-wider text-[#005259] truncate">{groupe.territoire}</span>
                  <span className="text-[10px] text-[#404040]/50 shrink-0">({groupe.lignes.length})</span>
                </button>
                <div className="bg-[#EAF1F1]" style={{ width: `${largeurTimeline}px` }} />
              </div>
              {!replie && groupe.lignes.map((ligne) => {
                const idx = lignes.indexOf(ligne);
                return renderLigneGantt(ligne, idx);
              })}
            </div>
          );
        })}
      </div>
      </div>

      {detailBarre && (
        <div
          className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[140] p-4"
          onClick={() => setDetailBarre(null)}
        >
          <div
            className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-sm space-y-4 shadow-2xl text-[#404040] animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-[#005259]">{detailBarre.ligneLabel}</h3>
                {detailBarre.texte !== detailBarre.ligneLabel && (
                  <p className="text-[11px] text-[#404040]/60">{detailBarre.texte}</p>
                )}
                <p className="text-[11px] text-[#404040]/60 mt-0.5">
                  {detailBarre.debut.toLocaleDateString('fr-FR')} - {detailBarre.fin.toLocaleDateString('fr-FR')} · {Number.isInteger(detailBarre.heures) ? detailBarre.heures : detailBarre.heures.toFixed(1)}h
                </p>
              </div>
              <button type="button" onClick={() => setDetailBarre(null)} className="text-[#404040]/40 hover:text-[#005259] shrink-0">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {detailBarre.nbSansMediateur > 0 && (
              <div className="flex items-center gap-2.5 bg-[#EF736A]/10 border border-[#EF736A]/30 rounded-xl p-3 text-[#EF736A] text-xs font-bold">
                <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
                {detailBarre.nbSansMediateur} créneau{detailBarre.nbSansMediateur > 1 ? "x" : ""} sans médiateur·rice assigné·e
              </div>
            )}

            {detailBarre.medDistincts.length > 0 ? (
              <ul className="space-y-1">
                {detailBarre.medDistincts.map(nom => (
                  <li key={nom} className="text-xs font-bold text-[#404040] bg-[#F3F3F2] rounded-lg px-3 py-1.5">
                    {nom}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs italic text-[#404040]/40">Aucun médiateur nommé sur ce créneau.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

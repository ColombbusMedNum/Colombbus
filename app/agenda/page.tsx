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
  deleteDoc, doc, getDocs, where, updateDoc, setDoc, writeBatch,
  DocumentData, Query
} from "firebase/firestore";
import { 
  PlusIcon, TrashIcon, XMarkIcon,
  DocumentDuplicateIcon, PencilSquareIcon,
  UsersIcon, MapPinIcon, EyeIcon, EyeSlashIcon,
  CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon,
  CheckCircleIcon, LockClosedIcon, BellIcon,
  ChatBubbleLeftRightIcon, ExclamationTriangleIcon,
  ChevronDownIcon, HomeIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import type { Mediateur, ActionPlanning } from "../../lib/types";
import { useConfirm } from "../../components/ConfirmProvider";
import Accordion from "../../components/Accordion";
import {
  type ActiviteType, BLOCS_THEMATIQUES, getJoursFeries,
  genererCreneauxPourModele, estimerNombreCreneaux, estVisibleCetteSemaine,
  formatDateFrCourt,
} from "../../lib/activitesTypes";
import { regrouperParCategorie } from "../../lib/equipeCategories";
import { estActionDuMediateur } from "../../lib/matchMediateur";

// Police Quicksand conforme à la charte
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

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

const ACTIVITE_VIDE: ActiviteType = {
  lieu: "", debut: "09:00", fin: "17:00", adresse: "", territoire: "",
  couleur: "#005259", codeAnalytique: "", dateDebut: "", dateFin: "",
  blocs: [], mediateursIds: [], generationMoment: "Les deux", datesActives: [],
};

// Replie par défaut les sections avancées de la modale de modèle, sauf
// celles qui contiennent déjà des données (en édition) — évite une pop-up
// interminable tout en gardant visible ce qui a déjà été configuré.
function sectionsOuvertesInitiales(type: ActiviteType): Record<string, boolean> {
  return {
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  
  const [currentUserId] = useState<string | null>("ID_DU_MEDIATEUR_CONNECTE");
  
  // États UI
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isActiviteModalOpen, setIsActiviteModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ActiviteType | null>(null);
  const [voirMasques, setVoirMasques] = useState(false);
  const [openBlocs, setOpenBlocs] = useState<Record<string, boolean>>({ inclusion: false, decouverte: false, insertion: false, divers: false, "sans-bloc": false }); 
  const [voirSamedi, setVoirSamedi] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

  const notifRef = useRef<HTMLDivElement>(null);

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
    cadres: true, permanents: true, aci_massy: true, aci_paris: true, stagiaires: true, autres: true,
  });

  const currentWeekId = getWeekIdentifier(currentDate);
  const estSemaineValidee = !!semainesValidees[currentWeekId];
  const nonLuesCount = notifications.filter(n => !n.lue).length;

  const { can } = usePermissions();
  const canCreateSlot = can("agenda_slot_create");
  const canDeleteSlot = can("agenda_slot_delete");
  const canViewComment = can("agenda_comment_view");
  const canEditComment = can("agenda_comment_edit");

  const getStatusPriority = (statut: string) => {
    if (statut === "Cadre") return 1;
    if (statut === "Permanent") return 2;
    if (statut === "ACI") return 3;
    return 4;
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

  // Le planning n'affiche qu'une semaine à la fois : on ne charge que les
  // actions de cette semaine (lundi à dimanche, indépendamment du toggle
  // "voir samedi") au lieu de toute la collection depuis toujours. Effet
  // séparé des autres écoutes ci-dessous pour ne les re-déclencher que
  // lorsque c'est réellement nécessaire (changement de semaine uniquement).
  useEffect(() => {
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
    const unsubActions = onSnapshot(qActions, (snap) => {
      setActions(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActionPlanning)));
    });

    return () => unsubActions();
  }, [currentDate]);

  useEffect(() => {
    const unsubSemaines = onSnapshot(collection(db, "semaines_validees"), (snap) => {
      const vMap: Record<string, boolean> = {};
      snap.docs.forEach(doc => { vMap[doc.id] = doc.data().validee || false; });
      setSemainesValidees(vMap);
    });

    const unsubLocs = onSnapshot(collection(db, "liste_lieux"), (snap) => {
      setLocalisations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

    return () => { unsubActs(); unsubSemaines(); unsubNotifs(); unsubLocs(); unsubBlocs(); };
  }, [filtrePersoUniquement, currentUserId]);

  const mediateurs = React.useMemo(() => {
    const data = mediateursBruts as Mediateur[];
    return [...data].sort((a, b) => {
      const priorityA = getStatusPriority(a.statut || "Permanent");
      const priorityB = getStatusPriority(b.statut || "Permanent");
      return priorityA !== priorityB ? priorityA - priorityB : (a.nom || "").localeCompare(b.nom || "");
    });
  }, [mediateursBruts]);

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
        debut: newActivite.debut,
        fin: newActivite.fin,
        adresse: newActivite.adresse.trim(),
        territoire: newActivite.territoire,
        couleur: newActivite.couleur,
        codeAnalytique: newActivite.codeAnalytique.trim(),
        dateDebut: newActivite.dateDebut,
        dateFin: newActivite.dateFin,
        blocs: newActivite.blocs || [],
        mediateursIds: newActivite.mediateursIds || [],
        generationMoment: newActivite.generationMoment || "Les deux",
        datesActives: newActivite.datesActives || []
      };

      let idModele = editingActivite?.id;

      if (editingActivite?.id) {
        await updateDoc(doc(db, "activites_types", editingActivite.id), dataPayload);
        const qActions = query(collection(db, "planning_mediateurs"), where("lieu", "==", editingActivite.lieu));
        const snapActions = await getDocs(qActions);

        const updates = snapActions.docs.map(actionDoc =>
          updateDoc(doc(db, "planning_mediateurs", actionDoc.id), {
            codeAnalytique: newActivite.codeAnalytique.trim(),
            couleur: newActivite.couleur,
            lieu: newActivite.lieu.trim(),
            debut: newActivite.debut,
            fin: newActivite.fin,
            adresse: newActivite.adresse.trim(),
            territoire: newActivite.territoire
          })
        );
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

  const handleOpenEditActivite = (type: ActiviteType, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setEditingActivite(type);
    setNewActivite({
      lieu: type.lieu || "",
      debut: type.debut || "09:00",
      fin: type.fin || "17:00",
      adresse: type.adresse || "",
      territoire: type.territoire || "",
      couleur: type.couleur || "#005259",
      codeAnalytique: type.codeAnalytique || "",
      dateDebut: type.dateDebut || "",
      dateFin: type.dateFin || "",
      blocs: type.blocs || [],
      mediateursIds: type.mediateursIds || [],
      generationMoment: type.generationMoment || "Les deux",
      datesActives: type.datesActives || []
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
    if ((cible?.lieu || "").toUpperCase().includes("RN")) {
      showToast("🔒 Ce modèle est lié à Suresnes et ne peut pas être supprimé.", "error");
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

  // Médiateurs réellement affichés dans la grille cette semaine (actifs,
  // avec une identité, et masqués uniquement s'ils n'ont aucune action cette
  // semaine ou si "voir les masqués" est activé) — base commune du tri par
  // catégorie ci-dessous.
  const mediateursAffiches = mediateurs
    .filter(m => m.actif !== false && (m.prenom || m.nom))
    .filter(m => {
      if (voirMasques) return true;
      if (!m.masque) return true;

      return actions.some((action) => {
        const estCetteSemaine = weekDays.some(day => day.toLocaleDateString('en-CA') === action.date);
        return estActionDuMediateur(action, m) && estCetteSemaine;
      });
    });

  // Tri par groupe ACI (les non-classés passent après), puis alphabétique à
  // l'intérieur d'un même groupe (ou entre non-classés).
  const groupesMediateursAgenda = regrouperParCategorie(mediateursAffiches).map(groupe => ({
    ...groupe,
    membres: [...groupe.membres].sort((a, b) => {
      const ga = a.groupeACI ?? Number.MAX_SAFE_INTEGER;
      const gb = b.groupeACI ?? Number.MAX_SAFE_INTEGER;
      if (ga !== gb) return ga - gb;
      const nomA = `${a.prenom || ""} ${a.nom || ""}`.trim();
      const nomB = `${b.prenom || ""} ${b.nom || ""}`.trim();
      return nomA.localeCompare(nomB, "fr");
    })
  }));

  const processActionCreation = async (
    mediatId: string, 
    prenom: string, 
    nom: string, 
    moment: string, 
    dateStr: string, 
    lieuInput: string
  ) => {
    let lieu = lieuInput;
    if (!lieu) return;

    const upperLieu = lieu.toUpperCase();
    const isSuresnesAction = upperLieu.includes("RN") || upperLieu.includes("RND");
    const nomCompletLiaison = `${prenom} ${nom}`.trim();

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

    await addDoc(collection(db, "planning_mediateurs"), {
      mediatId: mediatId, 
      mediateurNom: nomCompletLiaison, 
      moment, 
      date: dateStr, 
      lieu, 
      type: "Action",
      commentaire: "",
      couleur: selectedModel?.couleur || "#005259",
      ...(selectedModel?.adresse ? { adresse: selectedModel.adresse } : {}),
      ...(selectedModel?.debut ? { debut: selectedModel.debut, fin: selectedModel.fin } : {}),
      ...(selectedModel?.territoire ? { territoire: selectedModel.territoire } : {}),
      ...(selectedModel?.codeAnalytique ? { codeAnalytique: selectedModel.codeAnalytique } : {}) 
    });

    await addDoc(collection(db, "notifications"), {
      destinataireId: mediatId,
      message: aDejaAction 
        ? `🔄 Activité remplacée : Vous êtes planifié(e) sur "${lieu}" le ${dateFormatee} (${moment}).`
        : `📅 Nouvelle activité : Vous êtes planifié(e) sur "${lieu}" le ${dateFormatee} (${moment}).`,
      createdAt: Date.now(),
      lue: false
    });

    if (isSuresnesAction) {
      const horaires = moment === "Matin" ? ["10h00 - 11h30", "11h30 - 13h00"] : ["14h00 - 15h30", "15h30 - 17h00"];
      const isRND = upperLieu.includes("RND");
      const nomAvecType = isRND ? `${nomCompletLiaison} (RND)` : `${nomCompletLiaison} (RN)`;

      for (const h of horaires) {
        await addDoc(collection(db, "planning_suresnes"), {
          mediateurNom: nomAvecType,
          date: dateStr, 
          moment, 
          horaire: h, 
          usager: ""
        });
      }
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
      setPromptModalData({ mediatId, prenom, nom, moment, dateStr });
    }
  };

  const handleConfirmActionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptModalData || !promptLieuInput.trim()) return;

    const { mediatId, prenom, nom, moment, dateStr } = promptModalData;
    const lieu = promptLieuInput.trim();
    
    setPromptModalData(null);
    setPromptLieuInput("");

    await processActionCreation(mediatId, prenom, nom, moment, dateStr, lieu);
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

    const qSuresnes = query(collection(db, "planning_suresnes"), where("date", "==", actionDoc.date), where("moment", "==", actionDoc.moment));
    const snapSuresnes = await getDocs(qSuresnes);
    const docsDuMediateur = snapSuresnes.docs.filter(d => {
      const mNom = d.data().mediateurNom || "";
      const cible = actionDoc.mediateurNom || "";
      return mNom === cible || mNom === `${cible} (RN)` || mNom === `${cible} (RND)`;
    });

    if (docsDuMediateur.some(d => d.data().usager && d.data().usager.trim() !== "")) {
      showToast("⚠️ Suppression impossible : Des usagers sont inscrits à Suresnes.", "error");
      setDeleteConfirmModalData(null);
      return; 
    }

    await Promise.all(docsDuMediateur.map(d => deleteDoc(doc(db, "planning_suresnes", d.id))));
    await deleteDoc(doc(db, "planning_mediateurs", id));
    setDeleteConfirmModalData(null);
  };

  const startOfWeekStr = weekDays[0].toLocaleDateString('en-CA');
  const endOfWeekStr = weekDays[weekDays.length - 1].toLocaleDateString('en-CA');

  return (
    <PageGuard pageId="page_access_agenda">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] pl-4 pt-[60px]`}>

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-5 py-2.5 border-b border-[#003d42] bg-[#005259] text-white shadow-md">
        <div className="flex items-center gap-3">
          <PermissionGuard actionId="agenda_toggle_sidebar">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 bg-[#003d42] hover:bg-[#002b2f] border border-[#005259] rounded-md text-white transition-all cursor-pointer"
            >
              {isSidebarOpen ? <ChevronLeftIcon className="w-4 h-4"/> : <ChevronRightIcon className="w-4 h-4"/>}
            </button>
          </PermissionGuard>
          
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
              className={`px-3 py-1 rounded-md text-xs transition-all border flex items-center gap-1.5 cursor-pointer font-bold ${
                estSemaineValidee
                  ? "bg-[#A9E0C9]/20 border-[#A9E0C9] text-[#A9E0C9]"
                  : "bg-[#F9C44E] border-[#F9C44E] text-[#005259] hover:bg-[#f8b930]"
              }`}
            >
              {estSemaineValidee ? (
                <><LockClosedIcon className="w-3.5 h-3.5"/> Semaine Validée</>
              ) : (
                <><CheckCircleIcon className="w-3.5 h-3.5"/> En cours de validation</>
              )}
            </button>
          </PermissionGuard>
        </div>

        <div className="flex items-center gap-3">
          
          {/* CLOCHE NOTIFICATION */}
          <PermissionGuard actionId="agenda_notif_panel">
          <div className="relative" ref={notifRef}>
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

          {/* SÉLECTEUR SEMAINE */}
          <PermissionGuard actionId="agenda_week_nav">
            <div className="flex items-center gap-1.5 bg-[#003d42] border border-[#002b2f] rounded-lg px-2 h-9">
              <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-7); setCurrentDate(d); }} className="text-white hover:text-[#F9C44E] transition-colors cursor-pointer text-xs font-bold">←</button>
              <span className="text-xs font-semibold text-white min-w-28 text-center">Sem. du {monday.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}</span>
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
              onClick={() => setVoirSamedi(!voirSamedi)}
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

          <Link href="/mediation/adresses" className="bg-[#003d42] hover:bg-[#002b2f] text-white border border-[#002b2f] px-3 h-9 rounded-md text-xs flex items-center gap-1.5 font-bold">
            <MapPinIcon className="w-3.5 h-3.5 text-[#A9E0C9]"/> Adresses
          </Link>

          <Link href="/mediation/equipe" className="bg-[#003d42] hover:bg-[#002b2f] text-white border border-[#002b2f] px-3 h-9 rounded-md text-xs flex items-center gap-1.5 font-bold">
            <UsersIcon className="w-3.5 h-3.5 text-[#88ACEA]"/> Staff
          </Link>

          <Link 
            href="/mediation/rencontres-numeriques/suresnes"
            className="bg-[#88ACEA] hover:bg-[#779cdb] text-[#005259] border border-[#88ACEA] px-3 h-9 rounded-md text-xs transition-colors flex items-center gap-1.5 font-extrabold"
          >
            <CalendarDaysIcon className="w-3.5 h-3.5 text-[#005259]"/> Suresnes
          </Link>
        </div>
      </header>

      {/* AGENCEMENT PRINCIPAL */}
      <div className="max-w-8xl mx-auto py-5 pr-4 flex gap-4 transition-all duration-300">
        
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
              const modelesSemaine = activitesTypes.filter(type => estVisibleCetteSemaine(type, startOfWeekStr, endOfWeekStr));

              // Rendu d'un modèle dans la liste. Dans un bloc thématique, la
              // couleur du bloc prime sur la couleur propre du modèle pour
              // ce badge (la couleur individuelle reste utilisée telle
              // quelle sur la grille du planning, non affectée par les blocs).
              const renderModeleItem = (type: ActiviteType, blocColor?: string) => {
                const colorTheme = blocColor || type.couleur || "#005259";
                const isSelected = selectedModel?.id === type.id;
                // Modèles fondateurs de la liaison Suresnes : leur suppression casserait
                // la génération automatique des créneaux planning_suresnes (voir isSuresnesAction
                // dans processActionCreation) — on les protège contre une suppression accidentelle.
                const isModeleProtege = (type.lieu || "").toUpperCase().includes("RN");

                const isLight = isLightColor(colorTheme);
                const textColor = isLight ? "#1A1A1A" : colorTheme;
                const bgColor = hexToRgba(colorTheme, isLight ? 0.35 : (isSelected ? 0.2 : 0.08));

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
                    <div className="w-full flex items-center justify-between mt-1 pl-3.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {type.territoire && <span className="text-[9px] bg-white px-1 rounded border border-current shrink-0">{type.territoire}</span>}
                        {type.debut && <span className="text-[8px] opacity-80 font-mono truncate">{type.debut} - {type.fin}</span>}
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
        <div className="flex-1 space-y-3">
          {groupesMediateursAgenda.map(groupe => (
            <Accordion
              key={groupe.key}
              title={`${groupe.label} (${groupe.membres.length})`}
              open={categoriesOuvertesAgenda[groupe.key] ?? true}
              onToggle={() => setCategoriesOuvertesAgenda(prev => ({ ...prev, [groupe.key]: !(prev[groupe.key] ?? true) }))}
            >
              {groupe.membres.length === 0 ? (
                <p className="text-[11px] italic text-[#404040]/40 py-2">Aucun collaborateur dans cette catégorie.</p>
              ) : (
                <div className="bg-white border border-[#404040]/10 rounded-xl p-4 overflow-x-auto shadow-sm">
                  <table className="border-collapse text-xs w-full table-fixed">
                    <thead>
                      <tr className="border-b-2 border-[#005259]">
                        <th className="text-left pr-2 pb-2 w-[160px] text-[#005259] font-extrabold text-xs">Médiateur</th>
                        {weekDays.map(d => {
                          const estFerie = joursFeries.has(d.toLocaleDateString('en-CA'));
                          return (
                            <th key={d.toString()} className={`text-center pb-2 px-1 ${estFerie ? "bg-[#EF736A]/10 rounded-t-md" : ""}`}>
                              <span className={`font-extrabold uppercase block ${estFerie ? "text-[#EF736A]" : "text-[#005259]"}`}>{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                              <span className={`text-[11px] font-medium ${estFerie ? "text-[#EF736A]/80" : "text-[#404040]/70"}`}>{d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                              {estFerie && <span className="block text-[8px] font-black uppercase tracking-widest text-[#EF736A]">Férié</span>}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F3F2]">
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
                          <tr key={m.id} className={`hover:bg-[#F3F3F2]/60 transition-colors ${rowBgClass} ${m.masque ? 'opacity-40' : ''}`}>
                            <td className={`pr-2 py-2 sticky left-0 z-10 w-[160px] ${rowBgClass}`}>
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
                            </td>

                            {weekDays.map(day => {
                              const dateStr = day.toLocaleDateString('en-CA');
                              const estFerie = joursFeries.has(dateStr);
                              return (
                                <td key={dateStr} className={`p-1 border-l border-[#F3F3F2] align-top ${estFerie ? "bg-[#EF736A]/5" : rowBgClass}`}>
                                  <div className="grid grid-cols-2 gap-1 min-h-[38px]">
                                    <DayCell actions={actions} m={m} moment="Matin" date={dateStr} onAdd={() => handleCaseClick(m.id, pNom, fNom, "Matin", dateStr)} onDelete={onRequestDeleteAction} onEditCommentaire={handleEditCommentaire} estSemaineValidee={estSemaineValidee} canCreateSlot={canCreateSlot && !estFerie} canDeleteSlot={canDeleteSlot} canOpenCommentaire={canViewComment || canEditComment} />
                                    <DayCell actions={actions} m={m} moment="Après-midi" date={dateStr} onAdd={() => handleCaseClick(m.id, pNom, fNom, "Après-midi", dateStr)} onDelete={onRequestDeleteAction} onEditCommentaire={handleEditCommentaire} estSemaineValidee={estSemaineValidee} canCreateSlot={canCreateSlot && !estFerie} canDeleteSlot={canDeleteSlot} canOpenCommentaire={canViewComment || canEditComment} />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </Accordion>
          ))}
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

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] text-[#404040]/70 font-bold uppercase">Heure début</label>
                <input type="time" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.debut} onChange={e => setNewActivite({...newActivite, debut: e.target.value})} />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] text-[#404040]/70 font-bold uppercase">Heure fin</label>
                <input type="time" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.fin} onChange={e => setNewActivite({...newActivite, fin: e.target.value})} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#404040]/70 font-semibold">Code Analytique BluePowder (Optionnel)</label>
              <input
                placeholder="Ex: 12345"
                value={newActivite.codeAnalytique}
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none"
                onChange={e => setNewActivite({...newActivite, codeAnalytique: e.target.value})}
              />
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

            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-[#005259] text-white py-1.5 rounded-md text-xs font-bold">Valider</button>
              <button type="button" onClick={() => { setIsActiviteModalOpen(false); setEditingActivite(null); setSelectedLieuPredefini(""); }} className="text-[#404040]/60 text-xs px-2 font-bold">Annuler</button>
            </div>
          </form>
        </div>
      )}
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
  estSemaineValidee: boolean;
  canCreateSlot: boolean;
  canDeleteSlot: boolean;
  canOpenCommentaire: boolean;
}

function DayCell({ actions, m, moment, date, onAdd, onDelete, onEditCommentaire, estSemaineValidee, canCreateSlot, canDeleteSlot, canOpenCommentaire }: DayCellProps) {
  const filtered = actions.filter((a) => estActionDuMediateur(a, m) && a.date === date && a.moment === moment);
  
  return (
    <div className="flex flex-col relative group/cell h-full justify-start gap-1 min-h-[36px] bg-[#F3F3F2]/40 p-0.5 rounded border border-transparent hover:border-[#404040]/10 transition-colors">
      {filtered.map((a) => {
        const territorio = a.territoire || "";
        const hexColor = a.couleur || "#005259";
        const hasCommentaire = !!a.commentaire;

        const isLight = isLightColor(hexColor);
        const textColor = isLight ? "#1A1A1A" : hexColor;
        const cardBg = hexToRgba(hexColor, isLight ? 0.35 : 0.12);

        return (
          <div
            key={a.id}
            onClick={canOpenCommentaire ? () => onEditCommentaire(a.id, a.commentaire || "") : undefined}
            style={{
              backgroundColor: cardBg,
              borderColor: hexColor,
              color: textColor
            }}
            className={`px-1.5 py-0.5 rounded border text-[10px] font-bold flex items-center justify-between w-full min-h-[24px] hover:shadow-sm transition-all relative ${canOpenCommentaire ? "cursor-pointer" : ""}`}
            title={canOpenCommentaire ? (hasCommentaire ? `Note : ${a.commentaire}` : "Cliquer pour ajouter une note") : (hasCommentaire ? `Note : ${a.commentaire}` : undefined)}
          >
            <span className="truncate pr-3" title={`${moment} : ${a.lieu}`}>
              {a.lieu} {territorio && <span className="text-[8px] opacity-70">[{territorio}]</span>}
            </span>

            {hasCommentaire && (
              <span className="absolute right-5 top-1 text-[#EA601F]">
                <ChatBubbleLeftRightIcon className="w-2.5 h-2.5 fill-[#EA601F]/20" />
              </span>
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

      {filtered.length === 0 ? (
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
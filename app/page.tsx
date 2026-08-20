"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Quicksand } from "next/font/google";
import type { ComponentType, SVGProps } from "react";
import { PermissionGuard } from "@/components/PermissionGuard";
import PageGuard from "@/components/PageGuard";
import {
  UsersIcon,
  ChartBarIcon,
  ChartPieIcon,
  CalendarDaysIcon,
  CpuChipIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ClockIcon,
  CalendarIcon,
  DocumentPlusIcon,
  XMarkIcon,
  ArrowLeftStartOnRectangleIcon,
  LockClosedIcon,
  WrenchScrewdriverIcon,
  MapPinIcon,
  BuildingOffice2Icon,
  DocumentDuplicateIcon,
  BookOpenIcon,
  GlobeAltIcon,
  AcademicCapIcon,
  RocketLaunchIcon,
  BriefcaseIcon,
  ChevronLeftIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

type Accent = "teal" | "orange";
type IconType = ComponentType<SVGProps<SVGSVGElement>>;
type Dot = "teal" | "orange" | "mint" | "orange-40";

interface BaseNode {
  id: string;
  title: string;
  subtitle: string;
  icon: IconType;
  accent: Accent;
  actionId: string;
  fallbackLocked?: boolean;
}
interface LeafNode extends BaseNode { kind: "leaf"; href: string; }
interface FolderNode extends BaseNode { kind: "folder"; children: NavNode[]; }
type NavNode = LeafNode | FolderNode;

// Arborescence complète de la page d'accueil — un seul endroit à modifier
// pour réorganiser, renommer ou déplacer une case, quel que soit son niveau.
const NAV_TREE: NavNode[] = [
  {
    id: "agenda", kind: "folder", accent: "teal", icon: CalendarDaysIcon,
    title: "Agenda", subtitle: "Médiateurs et Relais Numérique de Suresnes",
    actionId: "home_folder_rencontres",
    children: [
      { id: "agenda-med", kind: "leaf", accent: "teal", icon: CalendarDaysIcon, title: "Agenda des Médiateurs", subtitle: "Gérer l'équipe et le planning des actions", actionId: "home_nav_agenda_med", fallbackLocked: true, href: "/agenda" },
      { id: "agenda-suresnes", kind: "leaf", accent: "orange", icon: CalendarIcon, title: "Agenda Suresnes & Essonne", subtitle: "Consulter l'agenda du Relais Numérique", actionId: "home_nav_agenda_suresnes", fallbackLocked: true, href: "/mediation/rencontres-numeriques/suresnes" },
      { id: "modeles", kind: "leaf", accent: "teal", icon: DocumentDuplicateIcon, title: "Modèles d'Activités", subtitle: "Gérer les modèles utilisés dans l'agenda", actionId: "home_nav_modeles", fallbackLocked: true, href: "/mediation/modeles" },
    ],
  },
  {
    id: "inclusion-numerique", kind: "folder", accent: "teal", icon: GlobeAltIcon,
    title: "Inclusion Numérique", subtitle: "Rencontres numériques et programme Digital'UP",
    actionId: "home_folder_inclusion_numerique",
    children: [
      {
        id: "rencontres-numeriques", kind: "folder", accent: "teal", icon: UsersIcon,
        title: "Rencontres Numériques", subtitle: "Fiches, émargements et actions collectives",
        actionId: "home_folder_rencontres_numeriques",
        children: [
          {
            id: "beneficiaires", kind: "folder", accent: "orange", icon: UsersIcon,
            title: "Bénéficiaires", subtitle: "Fiches, émargements et actions collectives",
            actionId: "home_folder_beneficiaires",
            children: [
              { id: "liste-benef", kind: "leaf", accent: "teal", icon: UsersIcon, title: "Liste des bénéficiaires", subtitle: "Consulter et modifier les fiches existantes", actionId: "home_nav_liste_benef", href: "/mediation/rencontres-numeriques/liste-beneficiaires" },
              { id: "emargement-docs", kind: "leaf", accent: "teal", icon: ClipboardDocumentCheckIcon, title: "Émargements & Doc. internes", subtitle: "Accéder aux feuilles archivées", actionId: "home_nav_emargement_docs", href: "/mediation/rencontres-numeriques/emargements" },
              { id: "emargement-gen", kind: "leaf", accent: "orange", icon: DocumentPlusIcon, title: "Générateur d'Émargements", subtitle: "Éditer de nouvelles feuilles A4 prêtes à imprimer", actionId: "home_nav_emargement_gen", href: "/mediation/rencontres-numeriques/emargement" },
            ],
          },
        ],
      },
      { id: "actions-coll", kind: "leaf", accent: "teal", icon: UserGroupIcon, title: "Cafés Numériques", subtitle: "Saisir les bilans simplifiés d'ateliers", actionId: "home_nav_actions_coll", href: "/mediation/rencontres-numeriques/actions-collectives" },
      {
        id: "digital-up", kind: "folder", accent: "orange", icon: RocketLaunchIcon,
        title: "Digital'UP", subtitle: "Préinscriptions, apprenant·e·s et suivi Digital'UP",
        actionId: "home_nav_digital_up",
        children: [
          { id: "digitalup-inscription", kind: "leaf", accent: "orange", icon: DocumentPlusIcon, title: "Formulaire d'inscription Digital'UP", subtitle: "Inscription au programme Digital'UP", actionId: "home_nav_digitalup_inscription", href: "/mediation/rencontres-numeriques/actions-collectives/inscription/digital-up" },
          { id: "digitalup-reponses", kind: "leaf", accent: "teal", icon: ClipboardDocumentCheckIcon, title: "Réponses au formulaire Digital'UP", subtitle: "Préinscriptions reçues au programme Digital'UP", actionId: "home_nav_digitalup_reponses", href: "/mediation/rencontres-numeriques/actions-collectives/reponses/digital-up" },
          { id: "digitalup-suivi", kind: "leaf", accent: "orange", icon: UsersIcon, title: "Suivi de recrutement", subtitle: "Apprenant·e·s retenu·e·s, session par session", actionId: "home_nav_digitalup_suivi", href: "/mediation/rencontres-numeriques/actions-collectives/reponses/digital-up/suivi-recrutement" },
          { id: "digitalup-stats", kind: "leaf", accent: "teal", icon: ChartPieIcon, title: "Statistiques Digital'UP", subtitle: "Sexe, âge, diplôme et taux de présence par session", actionId: "home_nav_digitalup_stats", href: "/mediation/rencontres-numeriques/actions-collectives/reponses/digital-up/statistiques" },
          { id: "digitalup-parametres", kind: "leaf", accent: "orange", icon: Cog6ToothIcon, title: "Paramètres Digital'UP", subtitle: "Gérer les parcours, territoires et sessions", actionId: "home_nav_digitalup_parametres", href: "/mediation/rencontres-numeriques/actions-collectives/inscription/digital-up/parametres" },
        ],
      },
    ],
  },
  {
    id: "decouvertes-metiers", kind: "folder", accent: "orange", icon: AcademicCapIcon,
    title: "Découvertes Métiers", subtitle: "Programme Numérik'UP",
    actionId: "home_folder_decouvertes_metiers",
    children: [
      {
        id: "nkup", kind: "folder", accent: "teal", icon: CpuChipIcon,
        title: "NKUP", subtitle: "Préinscriptions, apprenant·e·s et suivi Numérik'UP",
        actionId: "home_nav_nkup",
        children: [
          { id: "nkup-inscription", kind: "leaf", accent: "teal", icon: DocumentPlusIcon, title: "Formulaire d'inscription Numérik'UP", subtitle: "Inscription au programme Numérik'UP", actionId: "home_nav_nkup_inscription", href: "/mediation/rencontres-numeriques/actions-collectives/inscription/numerik-up" },
          { id: "nkup-reponses", kind: "leaf", accent: "orange", icon: ClipboardDocumentCheckIcon, title: "Réponses au formulaire Numérik'UP", subtitle: "Préinscriptions reçues au programme Numérik'UP", actionId: "home_nav_nkup_reponses", href: "/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up" },
          { id: "nkup-suivi", kind: "leaf", accent: "teal", icon: UsersIcon, title: "Suivi de recrutement", subtitle: "Apprenant·e·s retenu·e·s, session par session", actionId: "home_nav_nkup_suivi", href: "/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up/suivi-recrutement" },
          { id: "nkup-stats", kind: "leaf", accent: "orange", icon: ChartPieIcon, title: "Statistiques Numérik'UP", subtitle: "Sexe, âge, diplôme et taux de présence par session", actionId: "home_nav_nkup_stats", href: "/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up/statistiques" },
          { id: "nkup-parametres", kind: "leaf", accent: "teal", icon: Cog6ToothIcon, title: "Paramètres Numérik'UP", subtitle: "Gérer les parcours, territoires et sessions", actionId: "home_nav_nkup_parametres", href: "/mediation/rencontres-numeriques/actions-collectives/inscription/numerik-up/parametres" },
        ],
      },
    ],
  },
  {
    id: "insertion-pro", kind: "folder", accent: "teal", icon: BriefcaseIcon,
    title: "Insertion Professionnelle", subtitle: "Programme Numérik'UP Pro",
    actionId: "home_folder_insertion_pro",
    children: [
      {
        id: "nkpro-tech", kind: "folder", accent: "orange", icon: BriefcaseIcon,
        title: "NKPRO Tech", subtitle: "Préinscriptions, apprenant·e·s et suivi Numérik'UP Pro",
        actionId: "home_nav_nkpro_tech",
        children: [
          { id: "nkpro-inscription", kind: "leaf", accent: "orange", icon: DocumentPlusIcon, title: "Formulaire d'inscription Numérik'UP Pro", subtitle: "Inscription au programme Numérik'UP Pro", actionId: "home_nav_nkpro_inscription", href: "/mediation/rencontres-numeriques/actions-collectives/inscription/numerik-up-pro" },
          { id: "nkpro-reponses", kind: "leaf", accent: "teal", icon: ClipboardDocumentCheckIcon, title: "Réponses au formulaire Numérik'UP Pro", subtitle: "Préinscriptions reçues au programme Numérik'UP Pro", actionId: "home_nav_nkpro_reponses", href: "/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro" },
          { id: "nkpro-suivi", kind: "leaf", accent: "teal", icon: UsersIcon, title: "Suivi de recrutement", subtitle: "Apprenant·e·s retenu·e·s, session par session", actionId: "home_nav_nkpro_suivi", href: "/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/suivi-recrutement" },
          { id: "nkpro-stats", kind: "leaf", accent: "orange", icon: ChartPieIcon, title: "Statistiques Numérik'UP Pro", subtitle: "Sexe, âge, diplôme et taux de présence par session", actionId: "home_nav_nkpro_stats", href: "/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/statistiques" },
          { id: "nkpro-parametres", kind: "leaf", accent: "orange", icon: Cog6ToothIcon, title: "Paramètres Numérik'UP Pro", subtitle: "Gérer les parcours, territoires et sessions", actionId: "home_nav_nkpro_parametres", href: "/mediation/rencontres-numeriques/actions-collectives/inscription/numerik-up-pro/parametres" },
        ],
      },
    ],
  },
  {
    // Réservée aux permanents (médiateurs + coordinateurs) — masquée pour les
    // ACI, cf. actionId non accordé à ce rôle dans permissionsCatalog.ts.
    id: "gestion-colombbus", kind: "folder", accent: "teal", icon: BuildingOfficeIcon,
    title: "Gestion Colombbus", subtitle: "Bilans, lieux, équipe et statistiques",
    actionId: "home_folder_gestion_colombbus",
    children: [
      {
        id: "bilans", kind: "folder", accent: "teal", icon: ClipboardDocumentCheckIcon,
        title: "Bilans", subtitle: "Fiches bilan, bilan tech et suivi collectes",
        actionId: "home_folder_bilans",
        children: [
          { id: "fiche-bilan", kind: "leaf", accent: "teal", icon: ClipboardDocumentCheckIcon, title: "Fiche Bilan", subtitle: "Accéder aux fiches de synthèses et bilans", actionId: "home_nav_fiche_bilan", href: "/mediation/rencontres-numeriques/fiches-bilans" },
          { id: "bilan-tech", kind: "leaf", accent: "orange", icon: WrenchScrewdriverIcon, title: "Bilan Tech", subtitle: "Effectuer et suivre les bilans techniques", actionId: "home_nav_bilan_tech", href: "/mediation/rencontres-numeriques/bilan_tech" },
          { id: "collectes", kind: "leaf", accent: "teal", icon: CpuChipIcon, title: "Suivi Collectes Tech", subtitle: "Tableau d'activité synchrone type Excel / IdF", actionId: "home_nav_collectes", href: "/mediation/rencontres-numeriques/suivi-collecte" },
        ],
      },
      {
        id: "lieux", kind: "folder", accent: "orange", icon: MapPinIcon,
        title: "Lieux", subtitle: "Rendez-vous par lieu et gestion des adresses",
        actionId: "home_folder_lieux",
        children: [
          { id: "rdv-par-lieu", kind: "leaf", accent: "orange", icon: MapPinIcon, title: "Rendez-vous par lieu", subtitle: "Consulter et planifier les rendez-vous selon les lieux", actionId: "home_nav_rdv_par_lieu", href: "/mediation/rencontres-numeriques/rendez-vous-par-lieu" },
          { id: "ajouter-lieu", kind: "leaf", accent: "orange", icon: BuildingOffice2Icon, title: "Ajouter un lieu", subtitle: "Gérer les adresses et localisations prédéfinies", actionId: "home_nav_ajouter_lieu", href: "/mediation/localisations" },
        ],
      },
      { id: "equipe", kind: "leaf", accent: "teal", icon: UserGroupIcon, title: "Équipe", subtitle: "Gérer et créer les fiches du staff", actionId: "home_nav_equipe", fallbackLocked: true, href: "/mediation/equipe" },
      {
        id: "stats", kind: "folder", accent: "teal", icon: ChartBarIcon,
        title: "Statistiques & Bilans", subtitle: "Rapports globaux et impact Suresnes",
        actionId: "home_folder_stats",
        children: [
          { id: "stats-glob", kind: "leaf", accent: "orange", icon: ChartBarIcon, title: "Bilan & Stats Globaux", subtitle: "Consulter les rapports et indicateurs transversaux de la plateforme", actionId: "home_nav_stats_glob", href: "/mediation/statistiques" },
          { id: "bilan-suresnes", kind: "leaf", accent: "teal", icon: BuildingOfficeIcon, title: "Analyse par Territoire", subtitle: "Édition et étude du bilan d'impact annuel du Relais Numérique", actionId: "home_nav_bilan_suresnes", href: "/mediation/bilan-suresnes" },
          { id: "volume-horaire", kind: "leaf", accent: "orange", icon: ClockIcon, title: "Volume Horaire", subtitle: "Analyser le temps de travail et coûts RH", actionId: "home_nav_volume_horaire", href: "/mediation/volume-horaire" },
          { id: "admin-droits", kind: "leaf", accent: "teal", icon: CpuChipIcon, title: "Gérer les Droits", subtitle: "Matrice de sécurité et modification des rôles de l'équipe", actionId: "home_nav_admin_droits", href: "/mediation/analyse" },
        ],
      },
    ],
  },
  { id: "faq", kind: "leaf", accent: "teal", icon: BookOpenIcon, title: "F.A.Q", subtitle: "Le guide de toutes les pages, page par page", actionId: "home_nav_guide", href: "/mediation/guide" },
];

function findChild(nodes: NavNode[], id: string): NavNode | undefined {
  return nodes.find((n) => n.id === id);
}

function resolvePath(path: string[]): { ancestors: FolderNode[]; current: NavNode[] } {
  let nodes: NavNode[] = NAV_TREE;
  const ancestors: FolderNode[] = [];
  for (const id of path) {
    const found = findChild(nodes, id);
    if (!found || found.kind !== "folder") break;
    ancestors.push(found);
    nodes = found.children;
  }
  return { ancestors, current: nodes };
}

const DOT_CLASS: Record<Dot, string> = {
  teal: "bg-[#005259]",
  orange: "bg-[#EA601F]",
  mint: "bg-[#A9E0C9]",
  "orange-40": "bg-[#EA601F]/40",
};

// Un point par case contenue dans le dossier, coloré selon son accent —
// reflète toujours le contenu réel, sans liste à maintenir à la main.
function dotsForFolder(node: FolderNode): Dot[] {
  return node.children.map((c) => c.accent);
}

function TileDots({ dots, compact }: { dots: Dot[]; compact?: boolean }) {
  if (dots.length === 0) return null;
  return (
    <div className={`flex ${compact ? "mt-2 gap-1 p-1" : "mt-4 gap-1.5 p-1.5"} rounded-lg bg-[#F3F3F2] border border-[#404040]/10`}>
      {dots.map((d, i) => (
        <div key={i} className={`${compact ? "w-1.5 h-1.5" : "w-2 h-2"} rounded-full ${DOT_CLASS[d]}`}></div>
      ))}
    </div>
  );
}

function LockedTile({ size, title }: { size: "lg" | "md"; title: string }) {
  if (size === "lg") {
    return (
      <div className="group bg-white/60 border border-[#404040]/10 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center min-h-[240px] pointer-events-none select-none opacity-60">
        <div className="bg-[#F3F3F2] w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-[#404040]/40 border border-[#404040]/10">
          <LockClosedIcon className="w-7 h-7" />
        </div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#404040]/50">{title}</h2>
        <p className="text-xs text-[#404040]/40 font-medium mt-2 leading-relaxed">Accès restreint par l'administrateur</p>
      </div>
    );
  }
  return (
    <div className="bg-[#F3F3F2]/50 border border-[#404040]/10 rounded-2xl p-4 flex flex-col items-center text-center pointer-events-none select-none opacity-50">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white text-[#404040]/40">
        <LockClosedIcon className="w-4 h-4" />
      </div>
      <h2 className="text-[11px] font-bold uppercase tracking-wide text-[#404040]/50">{title}</h2>
      <p className="text-[9px] text-[#404040]/40 font-medium mt-1 leading-relaxed">Accès restreint</p>
    </div>
  );
}

function FolderTile({ node, onOpen }: { node: FolderNode; onOpen: () => void }) {
  const Icon = node.icon;
  return (
    <button
      onClick={onOpen}
      className={`group bg-white border border-[#404040]/10 ${node.accent === "teal" ? "hover:border-[#005259]" : "hover:border-[#EA601F]"} rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center text-center active:scale-95 min-h-[240px] cursor-pointer`}
    >
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 shadow-sm bg-[#F3F3F2] border border-[#404040]/10 ${node.accent === "teal" ? "text-[#005259] group-hover:bg-[#005259]" : "text-[#EA601F] group-hover:bg-[#EA601F]"} group-hover:text-white`}>
        <Icon className="w-7 h-7 transition-colors" />
      </div>
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F] transition-colors">{node.title}</h2>
      <p className="text-xs text-[#404040]/70 font-medium mt-2 leading-relaxed">{node.subtitle}</p>
      <TileDots dots={dotsForFolder(node)} />
    </button>
  );
}

function LeafTile({ node }: { node: LeafNode }) {
  const Icon = node.icon;
  return (
    <Link
      href={node.href}
      className={`group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-4 ${node.accent === "teal" ? "hover:border-[#005259]" : "hover:border-[#EA601F]"} hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white border border-[#404040]/10 ${node.accent === "teal" ? "text-[#005259] group-hover:bg-[#005259]" : "text-[#EA601F] group-hover:bg-[#EA601F]"} group-hover:text-white transition-all`}>
        <Icon className="w-4 h-4" />
      </div>
      <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F]">{node.title}</h2>
      <p className="text-[9px] text-[#404040]/70 font-medium mt-1 leading-relaxed max-w-[200px]">{node.subtitle}</p>
    </Link>
  );
}

export default function HomePage() {
  const [path, setPath] = useState<string[]>([]);

  const handleLogout = () => {
    document.cookie = "session_token=; path=/; max-age=0; SameSite=Lax; Secure";
    document.cookie = "user_role=; path=/; max-age=0; SameSite=Lax; Secure";
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    window.location.href = "/login";
  };

  const { ancestors, current } = resolvePath(path);
  const activeFolder = ancestors[ancestors.length - 1] || null;

  function renderNode(node: NavNode, size: "lg" | "md") {
    if (node.kind === "folder") {
      const openThisFolder = () => setPath((p) => [...p.slice(0, ancestors.length), node.id]);
      const guarded = (
        <PermissionGuard key={node.id} actionId={node.actionId} fallback={node.fallbackLocked ? <LockedTile size={size} title={node.title} /> : null}>
          {size === "lg" ? <FolderTile node={node} onOpen={openThisFolder} /> : (
            // Case-dossier imbriquée (même gabarit visuel qu'une case simple).
            <button onClick={openThisFolder} className={`w-full h-full text-left group bg-[#F3F3F2] border border-[#404040]/10 rounded-2xl p-4 ${node.accent === "teal" ? "hover:border-[#005259]" : "hover:border-[#EA601F]"} hover:bg-white shadow-sm transition-all duration-300 flex flex-col items-center text-center active:scale-95 cursor-pointer`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white border border-[#404040]/10 ${node.accent === "teal" ? "text-[#005259] group-hover:bg-[#005259]" : "text-[#EA601F] group-hover:bg-[#EA601F]"} group-hover:text-white transition-all`}>
                <node.icon className="w-4 h-4" />
              </div>
              <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-[#005259] group-hover:text-[#EA601F]">{node.title}</h2>
              <p className="text-[9px] text-[#404040]/70 font-medium mt-1 leading-relaxed max-w-[200px]">{node.subtitle}</p>
              <TileDots dots={dotsForFolder(node)} compact />
            </button>
          )}
        </PermissionGuard>
      );
      return guarded;
    }
    return (
      <PermissionGuard key={node.id} actionId={node.actionId} fallback={node.fallbackLocked ? <LockedTile size={size} title={node.title} /> : null}>
        <LeafTile node={node} />
      </PermissionGuard>
    );
  }

  return (
    <PageGuard pageId="page_access_home">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden font-medium antialiased`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#005259]/5 blur-[140px] rounded-full pointer-events-none"></div>

      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-20">
        <PermissionGuard actionId="home_logout">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#EA601F] hover:text-white border border-[#404040]/15 rounded-xl text-[#EA601F] text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 group cursor-pointer"
          >
            <ArrowLeftStartOnRectangleIcon className="w-4 h-4 text-[#EA601F] group-hover:text-white transition-colors" />
            <span>Déconnexion</span>
          </button>
        </PermissionGuard>
      </div>

      <div className="max-w-7xl w-full relative z-10 flex flex-col items-center justify-center min-h-[80vh]">

        <div className="text-center mb-10 flex flex-col items-center">
          <div className="mb-3 relative w-16 h-16 md:w-20 md:h-20">
            <Image
              src="/logos/Logo_Colombbus_noir_trans.png"
              alt="Logo Colombbus"
              fill
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase text-[#005259]">
            Colombbus
          </h1>

          <div className="mt-2 flex flex-col items-center gap-1">
            <span className="inline-block px-3 py-1 rounded-full bg-[#EA601F]/10 border border-[#EA601F]/20 text-[#EA601F] text-xs font-black uppercase tracking-widest">
              Plateforme C.O.S.M.O.S.
            </span>
            <p className="text-[11px] md:text-xs text-[#404040]/70 font-semibold tracking-wide max-w-lg mt-0.5">
              Colombbus Orchestrateur de Suivi, Médiation et Orientation Solidaire
            </p>
          </div>

          <p className="text-[#404040]/50 text-[10px] font-bold uppercase tracking-widest mt-2">
            Gestion des bénéficiaires — 2026
          </p>
        </div>

        <div className="w-full max-w-6xl transition-all duration-300">

          {!activeFolder ? (
            /* ================= VUE FERMÉE (racine) ================= */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 w-full items-stretch">
              {current.map((node) => renderNode(node, "lg"))}
            </div>
          ) : (
            /* ================= VUE AGRANDIE (dossier courant) ================= */
            <div className={`bg-white border-2 ${activeFolder.accent === "teal" ? "border-[#005259]" : "border-[#EA601F]"} rounded-[2.5rem] p-6 md:p-8 shadow-md transition-all duration-300 animate-in fade-in zoom-in-95 duration-200 w-full max-w-4xl mx-auto`}>

              <div className="flex flex-wrap justify-between items-center gap-3 mb-8 border-b border-[#404040]/10 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {ancestors.length > 1 && (
                    <button
                      onClick={() => setPath((p) => p.slice(0, -1))}
                      className="text-[#404040] hover:bg-[#005259] hover:text-white bg-[#F3F3F2] p-2 rounded-xl border border-[#404040]/10 transition-all flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 mr-1 cursor-pointer"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                  )}
                  {ancestors.map((a, i) => (
                    <span key={a.id} className="flex items-center gap-2">
                      {i > 0 && <span className="text-[#404040]/30 text-xs">/</span>}
                      {i < ancestors.length - 1 ? (
                        <button
                          onClick={() => setPath((p) => p.slice(0, i + 1))}
                          className="text-xs font-bold uppercase tracking-wider text-[#404040]/50 hover:text-[#EA601F] transition-colors cursor-pointer"
                        >
                          {a.title}
                        </button>
                      ) : (
                        <span className={`text-sm font-extrabold uppercase tracking-wider ${a.accent === "teal" ? "text-[#005259]" : "text-[#EA601F]"} flex items-center gap-2`}>
                          <a.icon className="w-5 h-5" />
                          {a.title}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setPath([])}
                  className="text-[#404040] hover:bg-[#005259] hover:text-white bg-[#F3F3F2] p-2 rounded-xl border border-[#404040]/10 transition-all flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3 cursor-pointer"
                >
                  <XMarkIcon className="w-4 h-4" /> Fermer
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {current.map((node) => renderNode(node, "md"))}
              </div>
            </div>
          )}

        </div>

        <footer className="mt-12 w-full max-w-4xl bg-white border border-[#404040]/10 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="p-3 bg-[#F3F3F2] rounded-2xl border border-[#404040]/10 hidden sm:block text-[#005259]">
              <CpuChipIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#005259]">Infrastructure Cloud C.O.S.M.O.S.</h3>
              <p className="text-xs text-[#404040]/70 font-medium mt-0.5">
                Les données sont stockées de manière sécurisée et synchronisées en direct.
              </p>
            </div>
          </div>
          <div className="flex items-center bg-[#F3F3F2] px-5 py-3 rounded-2xl border border-[#404040]/10">
            <div className="text-center sm:text-right">
              <span className="block text-sm font-black uppercase tracking-tight italic text-[#005259]">
                Colombbus
              </span>
              <span className="text-[9px] uppercase tracking-widest font-bold text-[#EA601F] block mt-0.5">
                Médiation Numérique
              </span>
            </div>
          </div>
        </footer>

      </div>
    </main>
    </PageGuard>
  );
}

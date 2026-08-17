"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import {
  BookOpenIcon,
  HomeIcon,
  MapIcon,
  RocketLaunchIcon,
  CalendarDaysIcon,
  UsersIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  WrenchScrewdriverIcon,
  BellIcon,
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import Accordion from "@/components/Accordion";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

type RoleId = "admin" | "coordinateur" | "mediateur" | "aci";

const ROLE_STYLE: Record<RoleId, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-[#EA601F]/10 border-[#EA601F]/30 text-[#EA601F]" },
  coordinateur: { label: "Coordinateur", className: "bg-[#005259]/10 border-[#005259]/30 text-[#005259]" },
  mediateur: { label: "Médiateur", className: "bg-[#88ACEA]/20 border-[#88ACEA] text-[#005259]" },
  aci: { label: "ACI", className: "bg-[#F9945D]/15 border-[#F9945D]/40 text-[#EA601F]" },
};

function RoleChips({ roles, note }: { roles: RoleId[]; note?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      {roles.map((r) => (
        <span key={r} className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${ROLE_STYLE[r].className}`}>
          {ROLE_STYLE[r].label}
        </span>
      ))}
      {note && <span className="text-[10px] text-[#404040]/60 italic font-medium">{note}</span>}
    </div>
  );
}

interface GuideItem {
  key: string;
  title: string;
  path: string;
  roles: RoleId[];
  note?: string;
  description: string;
}

interface GuideGroup {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: GuideItem[];
}

const GROUPS: GuideGroup[] = [
  {
    id: "agenda",
    title: "Agenda & planning",
    icon: CalendarDaysIcon,
    items: [
      {
        key: "agenda-med",
        title: "Agenda des médiateurs",
        path: "/agenda",
        roles: ["admin", "coordinateur", "mediateur", "aci"],
        note: "ACI en lecture (navigation + commentaires uniquement)",
        description:
          "Le cœur de l'outil : le planning hebdomadaire de toute l'équipe, présenté en blocs rétractables par catégorie (Cadres, Permanents, ACI Paris, ACI Massy, Stagiaires). Chaque médiateur a une ligne, chaque jour deux cases (matin/après-midi). On y crée un créneau en cliquant sur une case vide et en choisissant un modèle d'activité ou en saisissant un lieu libre ; on peut laisser un commentaire sur un créneau, masquer un membre de l'affichage, naviguer semaine par semaine, et — pour un coordinateur — valider la semaine pour la verrouiller une fois stabilisée.",
      },
      {
        key: "modeles",
        title: "Modèles d'activités",
        path: "/mediation/modeles",
        roles: ["admin", "coordinateur"],
        description:
          "Un modèle décrit une activité récurrente (lieu, horaires, code analytique, médiateurs concernés) et permet de générer automatiquement les créneaux correspondants dans l'agenda, sur une période continue (date de début/fin) ou sur une liste de dates ponctuelles pour les activités irrégulières. Un bouton « Dupliquer » permet de reconduire un modèle sur une nouvelle période sans tout ressaisir.",
      },
      {
        key: "suresnes-agenda",
        title: "Agenda Suresnes (Relais Numérique)",
        path: "/mediation/rencontres-numeriques/suresnes",
        roles: ["admin", "coordinateur", "mediateur", "aci"],
        description:
          "Planning mensuel spécifique à l'activité du Relais Numérique de Suresnes : chaque créneau peut être assigné à un bénéficiaire, avec une thématique et une demande spécifique. Un créneau orphelin peut être réaffecté à un autre médiateur — action réservée au coordinateur et plus.",
      },
      {
        key: "adresses",
        title: "Adresses de la semaine",
        path: "/mediation/adresses",
        roles: ["admin", "coordinateur", "mediateur", "aci"],
        description:
          "Un aide-mémoire en lecture seule : les adresses des lieux effectivement planifiés cette semaine, avec un lien direct vers Google Maps. Pratique pour retrouver où se rendre sans naviguer dans l'agenda complet. À ne pas confondre avec Localisations, qui gère le référentiel permanent des lieux.",
      },
    ],
  },
  {
    id: "beneficiaires",
    title: "Bénéficiaires & suivi",
    icon: UsersIcon,
    items: [
      {
        key: "liste-benef",
        title: "Liste des bénéficiaires",
        path: "/mediation/rencontres-numeriques/liste-beneficiaires",
        roles: ["admin", "coordinateur", "mediateur", "aci"],
        description:
          "Le répertoire principal des usagers accompagnés : recherche par nom, filtres rapides (aujourd'hui, Suresnes, demandeurs d'emploi, blacklistés), et un bouton pour créer un nouveau profil à la volée. Basculer un profil en liste noire est réservé au coordinateur et plus.",
      },
      {
        key: "fiche-benef",
        title: "Fiche bénéficiaire",
        path: "/mediation/rencontres-numeriques/liste-beneficiaires/[id]",
        roles: ["admin", "coordinateur", "mediateur", "aci"],
        description:
          "Le dossier complet d'un usager : informations personnelles, historique des rendez-vous (chacun modifiable en ligne), accès rapide au diagnostic, au bilan technique et à l'agenda Suresnes. Un médiateur peut ajouter et modifier un rendez-vous ; seul un coordinateur et plus peut en supprimer un ou changer le statut de liste noire.",
      },
      {
        key: "diagnostic",
        title: "Formulaire diagnostic",
        path: "/mediation/rencontres-numeriques/diagnosticform",
        roles: ["admin", "coordinateur", "mediateur", "aci"],
        description:
          "Questionnaire d'évaluation numérique (diagnostic initial, final, ou collecte) : choix du type, série de questions à choix multiple, évaluation de satisfaction, puis calcul et enregistrement automatique du score.",
      },
      {
        key: "actions-coll",
        title: "Actions collectives",
        path: "/mediation/rencontres-numeriques/actions-collectives",
        roles: ["admin", "coordinateur", "mediateur", "aci"],
        description:
          "Saisie des ateliers de groupe (par opposition au suivi individuel) : un formulaire pour enregistrer un nouvel atelier, une liste modifiable des ateliers déjà saisis, avec édition et suppression.",
      },
      {
        key: "rdv-lieu",
        title: "Rendez-vous par lieu",
        path: "/mediation/rencontres-numeriques/rendez-vous-par-lieu",
        roles: ["admin", "coordinateur"],
        description:
          "Vue de pilotage : tous les entretiens individuels réels (diagnostics et QCM exclus), regroupés par lieu d'accueil, avec recherche et filtre par lieu. Sert à vérifier le volume d'activité, repérer les absences et contrôler que les comptes rendus sont bien renseignés.",
      },
    ],
  },
  {
    id: "bilans",
    title: "Bilans & documents",
    icon: ClipboardDocumentCheckIcon,
    items: [
      {
        key: "bilan-tech",
        title: "Bilan Tech — Diagnostic & ABC PIX",
        path: "/mediation/rencontres-numeriques/bilan_tech",
        roles: ["admin", "coordinateur", "mediateur"],
        description:
          "Le bilan détaillé de compétences numériques d'un bénéficiaire : dates de diagnostic et de test ABC PIX, scores sur 12 compétences numériques avec barres de progression, observations du médiateur. Un historique permet de rouvrir une fiche passée ; un bouton « Imprimer » produit un document propre à remettre au bénéficiaire.",
      },
      {
        key: "fiches-bilans",
        title: "Fiches bilans (mensuelles) & historique",
        path: "/mediation/rencontres-numeriques/fiches-bilans",
        roles: ["admin", "coordinateur", "mediateur"],
        description:
          "Le bilan officiel d'un lieu pour un mois donné : les rendez-vous « Présent » du mois se chargent automatiquement, il ne reste qu'à nommer l'atelier et ajouter un commentaire général avant impression. La page Historique permet de retrouver et rouvrir toute fiche déjà enregistrée.",
      },
      {
        key: "emargement",
        title: "Émargement — générateur & archives",
        path: "/mediation/rencontres-numeriques/emargement",
        roles: ["admin", "coordinateur", "mediateur"],
        description:
          "Le générateur compose une feuille de présence prête à imprimer pour un atelier (intitulé, date, lieu, logos partenaires, nombre de participants). Les archives ne stockent pas les feuilles signées elles-mêmes mais un répertoire de liens vers les registres Google Docs/Sheets tenus par site.",
      },
      {
        key: "logos",
        title: "Bibliothèque de logos",
        path: "/mediation/bibliotheque-logos",
        roles: ["admin", "coordinateur", "mediateur"],
        description:
          "Le dépôt des logos de partenaires (mairies, financeurs) réutilisés sur les feuilles d'émargement. On y ajoute une image avec un nom, on la retrouve ensuite directement dans le générateur d'émargement sans avoir à la re-téléverser.",
      },
      {
        key: "collecte",
        title: "Suivi collecte tech",
        path: "/mediation/rencontres-numeriques/suivi-collecte",
        roles: ["admin", "coordinateur", "mediateur"],
        description:
          "Tableau de suivi administratif d'un dossier de collecte de matériel informatique par année : étapes cochées (Drive, devis, facture, décharge, scan/archivage) et commentaires éditables en ligne. Export au format Excel (.csv) réservé au coordinateur et plus.",
      },
    ],
  },
  {
    id: "stats",
    title: "Statistiques & pilotage",
    icon: ChartBarIcon,
    items: [
      {
        key: "stats",
        title: "Statistiques & Médiateurs",
        path: "/mediation/statistiques",
        roles: ["admin", "coordinateur", "mediateur", "aci"],
        note: "médiateur/ACI : uniquement sa propre fiche",
        description:
          "Synthèse des heures travaillées par code analytique, à l'échelle d'un médiateur choisi ou de toute l'équipe (vue « Tous », réservée au coordinateur et plus). Un médiateur ou ACI n'accède ici qu'à sa propre fiche.",
      },
      {
        key: "volume-horaire",
        title: "Volume horaire",
        path: "/mediation/volume-horaire",
        roles: ["admin", "coordinateur"],
        description:
          "Le tableau de bord RH : heures travaillées et coût estimé par collaborateur et par activité, avec un filtre de période (année/mois), un export CSV, une ventilation par territoire, et des seuils d'alerte configurables (en heures et/ou en % du volume contractuel) qui signalent les ACI en dépassement d'heures complémentaires.",
      },
      {
        key: "bilan-suresnes",
        title: "Bilan territorial Suresnes",
        path: "/mediation/bilan-suresnes",
        roles: ["admin", "coordinateur"],
        description:
          "Un chiffre unique et fiable de fréquentation : chaque bénéficiaire n'est compté qu'une fois, à la date de son premier rendez-vous, même s'il est revenu plusieurs fois. Répartition par trimestre et par mois, hommes/femmes — utile pour les bilans d'activité et rapports aux financeurs.",
      },
    ],
  },
  {
    id: "equipe",
    title: "Équipe & administration",
    icon: WrenchScrewdriverIcon,
    items: [
      {
        key: "equipe",
        title: "Équipe",
        path: "/mediation/equipe",
        roles: ["admin", "coordinateur"],
        description:
          "La gestion RH de l'équipe : fiches classées en blocs rétractables (Cadres, Permanents, ACI Paris, ACI Massy, Stagiaires), ajout d'un membre, création de l'accès de connexion (compte + e-mail d'activation — le bouton disparaît une fois la personne connectée au moins une fois), édition des grilles horaires ACI par territoire avec confirmation visuelle à l'enregistrement, gestion des territoires et des qualités/compétences.",
      },
      {
        key: "competences",
        title: "Compétences",
        path: "/mediation/competences",
        roles: ["admin", "coordinateur"],
        description:
          "Répertoire des qualités et savoir-faire de chaque médiateur, filtrable par mot-clé ou par territoire — utile pour retrouver qui maîtrise un outil précis avant d'affecter une mission.",
      },
      {
        key: "localisations",
        title: "Localisations",
        path: "/mediation/localisations",
        roles: ["admin", "coordinateur"],
        description:
          "Le référentiel permanent des lieux d'intervention : création, édition, archivage. C'est la base de données que gère un coordinateur en amont ; Adresses n'en montre qu'une vue filtrée en lecture seule pour la semaine en cours.",
      },
      {
        key: "droits",
        title: "Droits & rôles",
        path: "/mediation/analyse",
        roles: ["admin"],
        description:
          "Matrice des droits (/mediation/analyse) : coche, page par page et bouton par bouton, ce que chaque rôle peut faire. Gestion des droits (/admin/droits) : attribue le rôle (Admin / Coordinateur / Médiateur / ACI) à chaque membre du staff. Deux pages complémentaires, réservées à l'administrateur.",
      },
    ],
  },
];

const MATRIX: { label: string; access: Record<RoleId, boolean | "perso"> }[] = [
  { label: "Accueil", access: { admin: true, coordinateur: true, mediateur: true, aci: true } },
  { label: "Agenda des médiateurs", access: { admin: true, coordinateur: true, mediateur: true, aci: true } },
  { label: "Modèles d'activités", access: { admin: true, coordinateur: true, mediateur: false, aci: false } },
  { label: "Agenda Suresnes", access: { admin: true, coordinateur: true, mediateur: true, aci: true } },
  { label: "Adresses", access: { admin: true, coordinateur: true, mediateur: true, aci: true } },
  { label: "Liste des bénéficiaires", access: { admin: true, coordinateur: true, mediateur: true, aci: true } },
  { label: "Fiche bénéficiaire", access: { admin: true, coordinateur: true, mediateur: true, aci: true } },
  { label: "Formulaire diagnostic", access: { admin: true, coordinateur: true, mediateur: true, aci: true } },
  { label: "Actions collectives", access: { admin: true, coordinateur: true, mediateur: true, aci: true } },
  { label: "Rendez-vous par lieu", access: { admin: true, coordinateur: true, mediateur: false, aci: false } },
  { label: "Bilan Tech / ABC PIX", access: { admin: true, coordinateur: true, mediateur: true, aci: false } },
  { label: "Fiches bilans", access: { admin: true, coordinateur: true, mediateur: true, aci: false } },
  { label: "Émargement (générateur + archives)", access: { admin: true, coordinateur: true, mediateur: true, aci: false } },
  { label: "Bibliothèque de logos", access: { admin: true, coordinateur: true, mediateur: true, aci: false } },
  { label: "Suivi collecte tech", access: { admin: true, coordinateur: true, mediateur: true, aci: false } },
  { label: "Statistiques / Médiateurs", access: { admin: true, coordinateur: true, mediateur: "perso", aci: "perso" } },
  { label: "Volume horaire", access: { admin: true, coordinateur: true, mediateur: false, aci: false } },
  { label: "Bilan territorial Suresnes", access: { admin: true, coordinateur: true, mediateur: false, aci: false } },
  { label: "Équipe", access: { admin: true, coordinateur: true, mediateur: false, aci: false } },
  { label: "Compétences", access: { admin: true, coordinateur: true, mediateur: false, aci: false } },
  { label: "Localisations", access: { admin: true, coordinateur: true, mediateur: true, aci: true } },
  { label: "Notifications", access: { admin: true, coordinateur: true, mediateur: true, aci: true } },
  { label: "Droits & rôles", access: { admin: true, coordinateur: false, mediateur: false, aci: false } },
];

function MatrixDot({ value }: { value: boolean | "perso" }) {
  if (value === "perso") {
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#F9945D]" title="Uniquement sa propre fiche" />;
  }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${value ? "bg-[#005259]" : "bg-[#404040]/15"}`} />;
}

export default function GuidePage() {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <PageGuard pageId="page_access_guide">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10 space-y-6">

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight text-[#005259] flex items-center gap-2">
                <BookOpenIcon className="w-6 h-6 text-[#EA601F]" /> Mode d'emploi
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Ce que chaque page de C.O.S.M.O.S. permet de faire, et qui y a accès</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
            <HomeIcon className="w-4 h-4 text-[#EA601F]" />
            <span>Accueil</span>
          </Link>
        </div>

        {/* INTRO */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
          <p className="text-xs leading-relaxed">
            C.O.S.M.O.S. est l'outil interne de Colombbus qui centralise toute l'activité de médiation numérique : planning de l'équipe, suivi des bénéficiaires, diagnostics et bilans de compétences, statistiques et pilotage RH. Une même plateforme, quatre niveaux d'accès selon le rôle de chacun dans l'équipe.
          </p>
          <RoleChips roles={["admin", "coordinateur", "mediateur", "aci"]} />
          <p className="text-xs leading-relaxed">
            Un <strong className="text-[#EA601F]">Admin</strong> a accès à tout, y compris la configuration des droits. Un <strong className="text-[#005259]">Coordinateur</strong> pilote l'équipe et les statistiques en plus de l'usage quotidien. Un <strong>Médiateur</strong> utilise l'outil au jour le jour : planning, fiches bénéficiaires, diagnostics. Un <strong>ACI</strong> (contrat aidé) a un accès plus restreint, principalement en consultation.
          </p>
          <div className="p-3 bg-[#F9945D]/10 border border-[#F9945D]/30 rounded-xl text-[11px] text-[#404040]/80">
            <strong className="text-[#EA601F]">À savoir :</strong> les droits précis de chaque rôle peuvent être ajustés à tout moment par un administrateur depuis la Matrice des droits. Ce guide décrit la configuration standard — la vôtre peut différer légèrement si elle a été personnalisée.
          </div>
        </div>

        {/* MATRICE */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#404040]/10 flex items-center gap-3 bg-[#F3F3F2]/60">
            <div className="p-2 rounded-lg bg-[#005259] text-white"><MapIcon className="w-4 h-4" /></div>
            <h2 className="font-bold text-xs uppercase tracking-wider text-[#005259]">Qui peut faire quoi</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[520px]">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="py-2.5 px-4">Page</th>
                  <th className="py-2.5 px-3 text-center">Admin</th>
                  <th className="py-2.5 px-3 text-center">Coord.</th>
                  <th className="py-2.5 px-3 text-center">Médiateur</th>
                  <th className="py-2.5 px-3 text-center">ACI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5 text-[11px]">
                {MATRIX.map((row) => (
                  <tr key={row.label} className="hover:bg-[#F3F3F2]/50">
                    <td className="py-2 px-4 font-bold text-[#404040]">{row.label}</td>
                    <td className="py-2 px-3 text-center"><MatrixDot value={row.access.admin} /></td>
                    <td className="py-2 px-3 text-center"><MatrixDot value={row.access.coordinateur} /></td>
                    <td className="py-2 px-3 text-center"><MatrixDot value={row.access.mediateur} /></td>
                    <td className="py-2 px-3 text-center"><MatrixDot value={row.access.aci} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DÉMARRAGE PAR RÔLE */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#005259] text-white"><RocketLaunchIcon className="w-4 h-4" /></div>
            <h2 className="font-bold text-xs uppercase tracking-wider text-[#005259]">Démarrage par rôle</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white border-t-4 border-t-[#88ACEA] border border-[#404040]/10 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-[#005259] uppercase mb-2">Médiateur — ma journée type</h3>
              <ol className="list-decimal list-inside text-[11px] space-y-1 text-[#404040]/80">
                <li>Je consulte l'Agenda pour voir mes créneaux du jour.</li>
                <li>Je vérifie l'adresse du lieu dans Adresses.</li>
                <li>J'ouvre la Fiche du bénéficiaire reçu et j'enregistre l'action.</li>
                <li>Si besoin, je lance un Diagnostic ou un Bilan Tech.</li>
                <li>Je surveille la cloche de notifications.</li>
              </ol>
            </div>
            <div className="bg-white border-t-4 border-t-[#F9945D] border border-[#404040]/10 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-[#005259] uppercase mb-2">ACI — mes accès</h3>
              <ol className="list-decimal list-inside text-[11px] space-y-1 text-[#404040]/80">
                <li>Je consulte l'Agenda (lecture des créneaux, pas de création).</li>
                <li>Je peux ouvrir une Fiche bénéficiaire et lancer un diagnostic.</li>
                <li>J'ai accès à Suresnes et à Adresses.</li>
                <li>Pour toute action bloquée, je me tourne vers un coordinateur.</li>
              </ol>
            </div>
            <div className="bg-white border-t-4 border-t-[#005259] border border-[#404040]/10 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-[#005259] uppercase mb-2">Coordinateur — piloter l'équipe</h3>
              <ol className="list-decimal list-inside text-[11px] space-y-1 text-[#404040]/80">
                <li>Je gère les fiches de l'équipe dans Équipe (ajout, horaires ACI, territoires).</li>
                <li>Je crée les Modèles d'activités qui alimentent l'agenda.</li>
                <li>Je valide la semaine une fois le planning stabilisé.</li>
                <li>Je consulte Statistiques, Volume Horaire et Bilan Suresnes.</li>
                <li>Je maintiens Localisations à jour.</li>
              </ol>
            </div>
            <div className="bg-white border-t-4 border-t-[#EA601F] border border-[#404040]/10 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-[#005259] uppercase mb-2">Admin — configuration</h3>
              <ol className="list-decimal list-inside text-[11px] space-y-1 text-[#404040]/80">
                <li>Je crée les comptes et fixe le rôle de chacun dans Droits &amp; rôles.</li>
                <li>J'ajuste finement ce que chaque rôle peut faire dans la Matrice des droits.</li>
                <li>J'ai accès à l'intégralité des pages listées dans ce guide.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* GROUPES DE FONCTIONNALITÉS */}
        {GROUPS.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#005259] text-white"><GroupIcon className="w-4 h-4" /></div>
                <h2 className="font-bold text-xs uppercase tracking-wider text-[#005259]">{group.title}</h2>
              </div>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <Accordion
                    key={item.key}
                    title={item.title}
                    open={!!openGroups[item.key]}
                    onToggle={() => toggle(item.key)}
                  >
                    <RoleChips roles={item.roles} note={item.note} />
                    <p className="text-xs leading-relaxed text-[#404040]/90">{item.description}</p>
                    <p className="text-[10px] font-mono text-[#404040]/40 mt-2">{item.path}</p>
                  </Accordion>
                ))}
              </div>
            </div>
          );
        })}

        {/* NOTIFICATIONS */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#005259] text-white"><BellIcon className="w-4 h-4" /></div>
            <h2 className="font-bold text-xs uppercase tracking-wider text-[#005259]">Notifications</h2>
          </div>
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 shadow-sm">
            <RoleChips roles={["admin", "coordinateur", "mediateur", "aci"]} />
            <p className="text-xs leading-relaxed text-[#404040]/90">
              La cloche visible depuis l'agenda donne un aperçu rapide des alertes récentes ; la page Notifications en est l'historique complet — marquer comme lu, supprimer, ou tout vider d'un coup.
            </p>
          </div>
        </div>

      </div>
    </main>
    </PageGuard>
  );
}

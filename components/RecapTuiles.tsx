"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { listerActionsDynamiques } from "@/lib/dynamicActions/store";
import { ActionSchema } from "@/lib/dynamicActions/types";

// Récapitulatif de l'arborescence de la page d'accueil (voir NAV_TREE dans
// app/page.tsx) — structure statique à mettre à jour à la main si
// l'organisation des tuiles change là-bas (pas de source commune, pour ne
// pas coupler cette page lecture-seule au code de l'accueil, gating par
// rôle et actions dynamiques injectées à la volée). Les actions
// personnalisées, elles, n'ont PAS besoin d'être codées en dur ici : voir
// injecterActionsPersonnalisees ci-dessous, qui les relit depuis Firestore
// à chaque chargement et les insère au même endroit que sur l'accueil réel.
export interface TuileRecap { titre: string; description: string; href?: string; enfants?: TuileRecap[] }

const RECAP_TUILES: TuileRecap[] = [
  {
    titre: "Agenda", description: "Planning du staff et du Relais Numérique de Suresnes",
    enfants: [
      { titre: "Agenda des Médiateurs", description: "Planning hebdomadaire de l'équipe (créneaux, modèles, validation de semaine)", href: "/agenda" },
      { titre: "Agenda des Rencontres Numériques", description: "Rendez-vous du Relais Numérique de Suresnes, par bénéficiaire", href: "/mediation/rencontres-numeriques/suresnes" },
      { titre: "Modèles d'Activités", description: "Modèles réutilisables de créneaux pour l'agenda", href: "/mediation/modeles" },
    ],
  },
  {
    titre: "Inclusion Numérique", description: "Rencontres numériques, Digital'UP et DIGITAL UP 96H",
    enfants: [
      {
        titre: "Rencontres Numériques", description: "Bénéficiaires, émargements et agenda",
        enfants: [
          {
            titre: "Bénéficiaires", description: "Fiches, suivi et émargements",
            enfants: [
              { titre: "Liste des bénéficiaires", description: "Consulter et modifier les fiches existantes", href: "/mediation/rencontres-numeriques/liste-beneficiaires" },
              { titre: "Suivi Visites à Domicile", description: "Suivi des bénéficiaires en visite à domicile (RND)", href: "/mediation/rencontres-numeriques/suivi-rnd" },
              { titre: "Générateur d'Émargements", description: "Éditer de nouvelles feuilles A4 prêtes à imprimer", href: "/mediation/rencontres-numeriques/emargement" },
            ],
          },
          { titre: "Émargements & Doc. internes", description: "Accéder aux feuilles archivées", href: "/mediation/rencontres-numeriques/emargements" },
          { titre: "Agenda RN", description: "Consulter l'agenda du Relais Numérique", href: "/mediation/rencontres-numeriques/suresnes" },
        ],
      },
      { titre: "Cafés Numériques", description: "Saisir les bilans simplifiés d'ateliers collectifs", href: "/mediation/actions-collectives" },
      {
        titre: "Digital'UP", description: "Préinscriptions, apprenant·e·s et suivi Digital'UP",
        enfants: [
          { titre: "Formulaire d'inscription", description: "Inscription au programme Digital'UP", href: "/mediation/actions-collectives/inscription/digital-up" },
          { titre: "Réponses au formulaire", description: "Préinscriptions reçues au programme Digital'UP", href: "/mediation/actions-collectives/reponses/digital-up" },
          { titre: "Suivi de recrutement", description: "Apprenant·e·s retenu·e·s, session par session", href: "/mediation/actions-collectives/reponses/digital-up/suivi-recrutement" },
          { titre: "Statistiques", description: "Sexe, âge, diplôme et taux de présence par session", href: "/mediation/actions-collectives/reponses/digital-up/statistiques" },
          { titre: "Paramètres", description: "Gérer les parcours, territoires et sessions", href: "/mediation/actions-collectives/inscription/digital-up/parametres" },
        ],
      },
      {
        titre: "DIGITAL UP 96H", description: "Préinscriptions, apprenant·e·s et suivi DIGITAL UP 96H",
        enfants: [
          { titre: "Formulaire d'inscription", description: "Inscription au programme DIGITAL UP 96H", href: "/mediation/actions-collectives/inscription/digital-up-pro" },
          { titre: "Test de langue", description: "Test B1 auto-corrigé, lien public et résultats", href: "/mediation/actions-collectives/reponses/digital-up-pro/test-langue" },
          { titre: "Diagnostic Collecte Tech", description: "Diagnostic public auto-corrigé, lien public et résultats", href: "/mediation/actions-collectives/reponses/digital-up-pro/collecte-tech" },
          { titre: "Réponses au formulaire", description: "Préinscriptions reçues au programme DIGITAL UP 96H", href: "/mediation/actions-collectives/reponses/digital-up-pro" },
          { titre: "Suivi de recrutement", description: "Apprenant·e·s retenu·e·s, session par session", href: "/mediation/actions-collectives/reponses/digital-up-pro/suivi-recrutement" },
          { titre: "Apprenant·e·s", description: "Suivi pédagogique et administratif, session par session", href: "/mediation/actions-collectives/reponses/digital-up-pro/apprenants" },
          { titre: "Suivi administratif", description: "Constitution du dossier, pièce par pièce, session par session", href: "/mediation/actions-collectives/reponses/digital-up-pro/suivi-administratif" },
          { titre: "Statistiques", description: "Sexe, âge, diplôme et taux de présence par session", href: "/mediation/actions-collectives/reponses/digital-up-pro/statistiques" },
          { titre: "Paramètres", description: "Gérer les parcours, territoires et sessions", href: "/mediation/actions-collectives/inscription/digital-up-pro/parametres" },
        ],
      },
    ],
  },
  {
    titre: "Découvertes Métiers", description: "Programme Numérik'UP",
    enfants: [
      {
        titre: "Numérik'UP", description: "Préinscriptions, apprenant·e·s et suivi Numérik'UP",
        enfants: [
          { titre: "Formulaire d'inscription", description: "Inscription au programme Numérik'UP", href: "/mediation/actions-collectives/inscription/numerik-up" },
          { titre: "Réponses au formulaire", description: "Préinscriptions reçues au programme Numérik'UP", href: "/mediation/actions-collectives/reponses/numerik-up" },
          { titre: "Suivi de recrutement", description: "Apprenant·e·s retenu·e·s, session par session", href: "/mediation/actions-collectives/reponses/numerik-up/suivi-recrutement" },
          { titre: "Apprenant·e·s", description: "Suivi pédagogique et administratif, session par session", href: "/mediation/actions-collectives/reponses/numerik-up/apprenants" },
          { titre: "Statistiques", description: "Sexe, âge, diplôme et taux de présence par session", href: "/mediation/actions-collectives/reponses/numerik-up/statistiques" },
          { titre: "Paramètres", description: "Gérer les parcours, territoires et sessions", href: "/mediation/actions-collectives/inscription/numerik-up/parametres" },
        ],
      },
    ],
  },
  {
    titre: "Insertion Professionnelle", description: "Programmes NUMERIK PRO et Préparation Parcours Métiers (PRFE)",
    enfants: [
      {
        titre: "NUMERIK PRO", description: "Préinscriptions, apprenant·e·s et suivi NUMERIK PRO",
        enfants: [
          { titre: "Formulaire d'inscription", description: "Inscription au programme NUMERIK PRO", href: "/mediation/actions-collectives/inscription/numerik-up-pro" },
          { titre: "Test de langue", description: "Test B1 auto-corrigé, lien public et résultats", href: "/mediation/actions-collectives/reponses/numerik-up-pro/test-langue" },
          { titre: "Réponses au formulaire", description: "Préinscriptions reçues au programme NUMERIK PRO", href: "/mediation/actions-collectives/reponses/numerik-up-pro" },
          { titre: "Suivi de recrutement", description: "Apprenant·e·s retenu·e·s, session par session", href: "/mediation/actions-collectives/reponses/numerik-up-pro/suivi-recrutement" },
          { titre: "Apprenant·e·s", description: "Suivi pédagogique et administratif, session par session", href: "/mediation/actions-collectives/reponses/numerik-up-pro/apprenants" },
          { titre: "Statistiques", description: "Sexe, âge, diplôme et taux de présence par session", href: "/mediation/actions-collectives/reponses/numerik-up-pro/statistiques" },
          { titre: "Paramètres", description: "Gérer les parcours, territoires et sessions", href: "/mediation/actions-collectives/inscription/numerik-up-pro/parametres" },
        ],
      },
      {
        titre: "Préparation Parcours Métiers (PRFE)", description: "Préinscriptions, apprenant·e·s et suivi",
        enfants: [
          { titre: "Formulaire d'inscription", description: "Inscription au parcours Préparation Parcours Métiers", href: "/mediation/actions-collectives/inscription/prfe" },
          { titre: "Test de positionnement", description: "Français, anglais, maths — lien public et résultats", href: "/mediation/actions-collectives/reponses/prfe/positionnement" },
          { titre: "Réponses au formulaire", description: "Préinscriptions reçues", href: "/mediation/actions-collectives/reponses/prfe" },
          { titre: "Suivi de recrutement", description: "Apprenant·e·s retenu·e·s, session par session", href: "/mediation/actions-collectives/reponses/prfe/suivi-recrutement" },
          { titre: "Statistiques", description: "Sexe, âge, diplôme et taux de présence par session", href: "/mediation/actions-collectives/reponses/prfe/statistiques" },
          { titre: "Paramètres", description: "Gérer les parcours, territoires et sessions", href: "/mediation/actions-collectives/inscription/prfe/parametres" },
        ],
      },
    ],
  },
  {
    titre: "Gestion Colombbus", description: "Réservé aux permanents (médiateurs et coordinateurs) — terrain, programmes, contenus, pilotage et administration",
    enfants: [
      {
        titre: "Terrain", description: "Bilans, lieux et suivi collectes",
        enfants: [
          {
            titre: "Bilans", description: "Fiches bilan, bilan tech et suivi collectes",
            enfants: [
              { titre: "Fiche Bilan", description: "Accéder aux fiches de synthèses et bilans", href: "/mediation/rencontres-numeriques/fiches-bilans" },
              { titre: "Bilan Tech", description: "Effectuer et suivre les bilans techniques", href: "/mediation/rencontres-numeriques/bilan_tech" },
              { titre: "Suivi Collectes Tech", description: "Tableau d'activité synchrone type Excel / IdF", href: "/mediation/rencontres-numeriques/suivi-collecte" },
            ],
          },
          {
            titre: "Lieux", description: "Rendez-vous par lieu et gestion des adresses",
            enfants: [
              { titre: "Rendez-vous par lieu", description: "Consulter et planifier les rendez-vous selon les lieux", href: "/mediation/rencontres-numeriques/rendez-vous-par-lieu" },
              { titre: "Ajouter un lieu", description: "Gérer les adresses et localisations prédéfinies", href: "/mediation/localisations" },
            ],
          },
        ],
      },
      {
        titre: "Programmes", description: "Participants, satisfaction et actions personnalisées, transversaux aux programmes",
        enfants: [
          { titre: "Participants & Prescripteurs", description: "Vue transversale des 3 programmes d'actions collectives", href: "/mediation/actions-collectives/participants" },
          { titre: "Prospections", description: "Fiches, vue tableau triable, statut \"contacté\" et annotations datées", href: "/mediation/prospections" },
          {
            titre: "Satisfaction", description: "Réponses aux questionnaires de satisfaction, par programme",
            enfants: [
              { titre: "Digital'UP", description: "Réponses au questionnaire de satisfaction", href: "/mediation/actions-collectives/reponses/digital-up/satisfaction" },
              { titre: "DIGITAL UP 96H", description: "Réponses au questionnaire de satisfaction", href: "/mediation/actions-collectives/reponses/digital-up-pro/satisfaction" },
              { titre: "Numérik'UP", description: "Réponses au questionnaire de satisfaction", href: "/mediation/actions-collectives/reponses/numerik-up/satisfaction" },
              { titre: "NUMERIK PRO", description: "Réponses au questionnaire de satisfaction", href: "/mediation/actions-collectives/reponses/numerik-up-pro/satisfaction" },
              { titre: "PRFE", description: "Réponses au questionnaire de satisfaction", href: "/mediation/actions-collectives/reponses/prfe/satisfaction" },
            ],
          },
          { titre: "Actions personnalisées", description: "Créer et gérer de nouvelles actions collectives", href: "/mediation/actions-collectives/creer-action" },
        ],
      },
      {
        titre: "Contenus & Formulaires", description: "Logos, liens publics et pages modifiables",
        enfants: [
          { titre: "Bibliothèque Logos", description: "Logos partenaires utilisés dans les émargements et formulaires publics", href: "/mediation/bibliotheque-logos" },
          { titre: "Liens publics", description: "Annuaire de tous les formulaires accessibles sans connexion, mis à jour automatiquement", href: "/mediation/liens-publics" },
          { titre: "Contenus modifiables", description: "Annuaire de toutes les pages d'édition — réservé admin", href: "/mediation/contenus-modifiables" },
        ],
      },
      {
        titre: "Pilotage", description: "Rapports globaux, impact territorial et volume horaire",
        enfants: [
          { titre: "Bilan & Stats Globaux", description: "Rapports et indicateurs transversaux de la plateforme", href: "/mediation/statistiques" },
          { titre: "Analyse par Territoire", description: "Bilan d'impact annuel du Relais Numérique", href: "/mediation/bilan-suresnes" },
          { titre: "Volume Horaire", description: "Temps de travail et coûts RH", href: "/mediation/volume-horaire" },
        ],
      },
      {
        titre: "Administration", description: "Équipe, connexions, signalements et droits",
        enfants: [
          { titre: "Équipe", description: "Fiches du staff (création, archivage, compétences, horaires ACI)", href: "/mediation/equipe" },
          {
            titre: "Paramètres", description: "Connexions, droits, signalements et réglages variables",
            enfants: [
              { titre: "Journal des Connexions", description: "Qui s'est connecté, quand, et combien de temps", href: "/mediation/journal-connexions" },
              { titre: "Signalements de Bugs", description: "Problèmes remontés via le bouton \"B\" (admin)", href: "/mediation/signalements" },
              { titre: "Gérer les Droits", description: "Matrice de sécurité et modification des rôles de l'équipe", href: "/mediation/analyse" },
              { titre: "Paramètres Généraux", description: "Quotas, seuils d'alerte et autres réglages variables", href: "/mediation/parametres" },
            ],
          },
        ],
      },
      { titre: "Récapitulatif", description: "Cette page — vue d'ensemble de toutes les tuiles de l'accueil", href: "/mediation/recapitulatif" },
    ],
  },
  { titre: "F.A.Q", description: "Guide de toutes les pages de la plateforme, page par page", href: "/mediation/guide" },
];

// Une action personnalisée avec categorieAccueil s'ajoute en tuile-dossier
// (5 sous-liens) dans le dossier racine correspondant — même gabarit que
// tuileActionDynamique() dans app/page.tsx.
const DOSSIER_PAR_CATEGORIE: Record<string, string> = {
  "inclusion-numerique": "Inclusion Numérique",
  "decouvertes-metiers": "Découvertes Métiers",
  "insertion-pro": "Insertion Professionnelle",
};

function tuileAction(a: ActionSchema): TuileRecap {
  return {
    titre: a.label, description: "Préinscriptions, apprenant·e·s et suivi (action personnalisée)",
    enfants: [
      { titre: "Formulaire d'inscription", description: `Inscription à ${a.label}`, href: `/mediation/actions-collectives/inscription/${a.slug}` },
      { titre: "Réponses au formulaire", description: "Préinscriptions reçues", href: `/mediation/actions-collectives/reponses/${a.slug}` },
      { titre: "Suivi de recrutement", description: "Apprenant·e·s retenu·e·s, session par session", href: `/mediation/actions-collectives/reponses/${a.slug}/suivi-recrutement` },
      { titre: "Statistiques", description: "Sexe, âge, diplôme et taux de présence par session", href: `/mediation/actions-collectives/reponses/${a.slug}/statistiques` },
      { titre: "Paramètres", description: "Questionnaire, parcours, territoires et sessions", href: `/mediation/actions-collectives/inscription/${a.slug}/parametres` },
    ],
  };
}

function injecterActionsParCategorie(arbre: TuileRecap[], actions: ActionSchema[]): TuileRecap[] {
  const actives = actions.filter((a) => a.actif && a.categorieAccueil);
  if (actives.length === 0) return arbre;
  return arbre.map((noeud) => {
    const categorie = Object.entries(DOSSIER_PAR_CATEGORIE).find(([, titre]) => titre === noeud.titre)?.[0];
    const pourCeDossier = categorie ? actives.filter((a) => a.categorieAccueil === categorie) : [];
    if (pourCeDossier.length === 0) return noeud;
    return { ...noeud, enfants: [...(noeud.enfants || []), ...pourCeDossier.map(tuileAction)] };
  });
}

function injecterSatisfactionActions(arbre: TuileRecap[], actions: ActionSchema[]): TuileRecap[] {
  const actives = actions.filter((a) => a.actif && a.satisfactionActif);
  if (actives.length === 0) return arbre;
  return arbre.map((noeud) => {
    if (noeud.titre === "Satisfaction" && noeud.enfants) {
      return {
        ...noeud,
        enfants: [
          ...noeud.enfants,
          ...actives.map((a): TuileRecap => ({ titre: a.label, description: "Réponses au questionnaire de satisfaction", href: `/mediation/actions-collectives/reponses/${a.slug}/satisfaction` })),
        ],
      };
    }
    if (noeud.enfants) return { ...noeud, enfants: injecterSatisfactionActions(noeud.enfants, actions) };
    return noeud;
  });
}

function NoeudRecap({ noeud, profondeur }: { noeud: TuileRecap; profondeur: number }) {
  const [ouvert, setOuvert] = useState(profondeur === 0 ? false : true);
  const aDesEnfants = !!noeud.enfants?.length;
  const titreClass = `font-bold ${profondeur === 0 ? "text-xs text-[#005259] uppercase tracking-wide" : "text-[11px] text-[#005259]"}`;

  return (
    <div className={profondeur > 0 ? "pl-4 border-l border-[#404040]/10" : ""}>
      {aDesEnfants ? (
        <button
          onClick={() => setOuvert((v) => !v)}
          className="flex items-start gap-2 py-1.5 text-left cursor-pointer select-none w-full"
        >
          <ChevronDownIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 text-[#404040]/40 transition-transform ${ouvert ? "rotate-180" : ""}`} />
          <div className="min-w-0">
            <p className={titreClass}>{noeud.titre}</p>
            <p className="text-[11px] text-[#404040]/60 leading-relaxed">{noeud.description}</p>
          </div>
        </button>
      ) : noeud.href ? (
        <Link href={noeud.href} className="flex items-start gap-2 py-1.5 pl-5 -ml-0 rounded-lg hover:bg-[#005259]/5 transition-colors group">
          <div className="min-w-0">
            <p className={`${titreClass} group-hover:text-[#EA601F] transition-colors`}>{noeud.titre}</p>
            <p className="text-[11px] text-[#404040]/60 leading-relaxed">{noeud.description}</p>
          </div>
        </Link>
      ) : (
        <div className="flex items-start gap-2 py-1.5 pl-5">
          <div className="min-w-0">
            <p className={titreClass}>{noeud.titre}</p>
            <p className="text-[11px] text-[#404040]/60 leading-relaxed">{noeud.description}</p>
          </div>
        </div>
      )}
      {aDesEnfants && ouvert && (
        <div className="space-y-0.5 pb-1">
          {noeud.enfants!.map((e) => <NoeudRecap key={e.titre} noeud={e} profondeur={profondeur + 1} />)}
        </div>
      )}
    </div>
  );
}

export default function RecapTuiles() {
  const [actions, setActions] = useState<ActionSchema[]>([]);

  useEffect(() => {
    listerActionsDynamiques().then(setActions).catch(() => setActions([]));
  }, []);

  const arbre = useMemo(
    () => injecterSatisfactionActions(injecterActionsParCategorie(RECAP_TUILES, actions), actions),
    [actions]
  );

  return (
    <div className="space-y-1">
      {arbre.map((n) => <NoeudRecap key={n.titre} noeud={n} profondeur={0} />)}
    </div>
  );
}

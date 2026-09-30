// Moteur générique de la "Fiche entretien diagnostic" (onglet de la fiche
// apprenant·e), à questions éditables depuis l'interface — voir
// components/EditeurFicheDiagnostic.tsx et components/FicheDiagnosticGenerique.tsx.
// Remplace 4 copies quasi identiques codées en dur (DIGITAL UP 96H, NUMERIK
// PRO, PRFE, actions dynamiques), qui ne différaient que par 2-3 libellés de
// marque. Stocké dans Firestore sous fiches_diagnostic/{programmeId} (voir
// firestore.rules) — programmeId est une chaîne libre, même principe que
// positionnement/{programmeId} (lib/positionnement.ts).

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export type TypeQuestionDiagnostic = "ligne" | "ligne_date" | "zone_texte" | "case_oui_non" | "case_unique" | "case_multiple";

export interface QuestionDiagnostic {
  id: string;
  type: TypeQuestionDiagnostic;
  label: string;
  sousLabel?: string; // zone_texte uniquement (aide contextuelle en italique)
  options?: string[]; // case_unique / case_multiple
  // Présent uniquement sur les questions du modèle par défaut (seed) : nom du
  // champ Firestore top-level déjà existant (ex. "Diagnostic_OrientePar",
  // "Niveau_Etudes", "RQTH"...) — préserve les données déjà saisies, aucune
  // migration. Absent sur une question ajoutée depuis l'éditeur : sa réponse
  // va alors dans DiagnosticReponsesCustom[id] sur le document d'inscription.
  champFirestore?: string;
  // Certains champs CORE partagés (RQTH, France_Travail) stockent "Oui"/"Non"
  // en texte plutôt qu'un booléen — uniquement pertinent pour case_oui_non.
  valeurCommeOuiNonTexte?: boolean;
  conditionSurQuestionId?: string;
  conditionValeur?: string | boolean;
}

export interface SectionDiagnostic {
  id: string;
  titre: string;
  questions: QuestionDiagnostic[];
}

export interface ConfigFicheDiagnostic {
  sections: SectionDiagnostic[];
}

export function refConfigFicheDiagnostic(programmeId: string) {
  return doc(db, "fiches_diagnostic", programmeId);
}

export async function chargerConfigFicheDiagnostic(programmeId: string): Promise<ConfigFicheDiagnostic | null> {
  const snap = await getDoc(refConfigFicheDiagnostic(programmeId));
  return snap.exists() ? (snap.data() as ConfigFicheDiagnostic) : null;
}

export async function sauvegarderConfigFicheDiagnostic(programmeId: string, config: ConfigFicheDiagnostic): Promise<void> {
  await setDoc(refConfigFicheDiagnostic(programmeId), config);
}

// Une question conditionnelle ("Si OUI, précisez"...) n'est affichée que si
// la question dont elle dépend a la valeur attendue — pour case_multiple
// (tableau), on vérifie que la valeur attendue en fait partie.
export function valeurCorrespond(valeur: unknown, attendue: unknown): boolean {
  if (Array.isArray(valeur)) return valeur.includes(attendue);
  return valeur === attendue;
}

export function nouvelleConfigFicheDiagnosticVide(): ConfigFicheDiagnostic {
  return { sections: [] };
}

function q(patch: Omit<QuestionDiagnostic, "id"> & { id: string }): QuestionDiagnostic {
  return patch;
}

// Modèle par défaut — reprend à l'identique les ~45 questions du formulaire
// papier "Fiche entretien diagnostic", tel que codé en dur jusqu'ici sur les
// 3 programmes historiques (DIGITAL UP 96H, NUMERIK PRO, PRFE). Libellés
// neutres (pas de nom de programme) : la personnalisation par marque se fait
// via l'éditeur ou le script d'amorçage (scripts/seed-fiches-diagnostic.js).
export const DEFAULT_CONFIG_FICHE_DIAGNOSTIC: ConfigFicheDiagnostic = {
  sections: [
    {
      id: "section_zone_colombbus",
      titre: "Ne pas remplir cette zone grise réservée à Colombbus",
      questions: [
        q({ id: "date_realisation", type: "ligne_date", label: "Date de réalisation", champFirestore: "Diagnostic_DateRealisation" }),
        q({ id: "mode_entretien_atelier", type: "case_oui_non", label: "Mode choisi : Entretien(s)/atelier(s)", champFirestore: "Diagnostic_ModeEntretienAtelier" }),
        q({ id: "mode_detail", type: "ligne", label: "Détail du mode", champFirestore: "Diagnostic_ModeDetail" }),
        q({ id: "nom_realisateur", type: "ligne", label: "Nom du réalisateur", champFirestore: "Diagnostic_NomRealisateur" }),
        q({ id: "fonction_realisateur", type: "ligne", label: "Fonction du réalisateur", champFirestore: "Diagnostic_FonctionRealisateur" }),
        q({ id: "lieu_realisation", type: "ligne", label: "Lieu de réalisation", champFirestore: "Diagnostic_LieuRealisation" }),
        q({ id: "periode_realisation", type: "case_unique", label: "Période réalisation", options: ["Accueil-recrutement", "Début de parcours"], champFirestore: "Diagnostic_PeriodeRealisation" }),
      ],
    },
    {
      id: "section_situation_administrative",
      titre: "Situation administrative",
      questions: [
        q({ id: "oriente_par", type: "ligne", label: "Orienté par", champFirestore: "Diagnostic_OrientePar" }),
        q({ id: "civilite", type: "case_unique", label: "Civilité", options: ["Mme", "M."], champFirestore: "Civilité" }),
        q({ id: "nom_naissance", type: "ligne", label: "Nom de naissance", champFirestore: "Nom" }),
        q({ id: "nom_usage", type: "ligne", label: "Nom d'usage", champFirestore: "Diagnostic_NomUsage" }),
        q({ id: "prenoms", type: "ligne", label: "Prénom(s)", champFirestore: "Prénom" }),
        q({ id: "date_naissance", type: "ligne_date", label: "Date de naissance", champFirestore: "Diagnostic_DateNaissance" }),
        q({ id: "age", type: "ligne", label: "Âge", champFirestore: "Age" }),
        q({ id: "tel_fixe", type: "ligne", label: "Tél. fixe", champFirestore: "Diagnostic_TelFixe" }),
        q({ id: "tel_portable", type: "ligne", label: "Tél. portable", champFirestore: "Téléphone" }),
        q({ id: "adresse", type: "ligne", label: "Adresse", champFirestore: "Diagnostic_Adresse" }),
        q({ id: "cp", type: "ligne", label: "CP", champFirestore: "Code_Postal" }),
        q({ id: "ville", type: "ligne", label: "Ville", champFirestore: "Ville" }),
        q({ id: "courriel", type: "ligne", label: "Courriel", champFirestore: "Email" }),
        q({ id: "num_secu", type: "ligne", label: "N° sécurité sociale", champFirestore: "Diagnostic_NumSecuriteSociale" }),
        q({ id: "num_cni", type: "ligne", label: "N° CNI", champFirestore: "Diagnostic_NumCNI" }),
        q({ id: "num_carte_sejour", type: "ligne", label: "N° carte de séjour", champFirestore: "Diagnostic_NumCarteSejour" }),
      ],
    },
    {
      id: "section_situation_sociale",
      titre: "Situation sociale",
      questions: [
        q({ id: "situation_familiale", type: "case_unique", label: "Quelle est votre situation familiale ?", options: ["Célibataire", "Vie maritale/concubinage", "Marié(e)", "Veuf(ve)", "Divorcé(e)"], champFirestore: "Diagnostic_SituationFamiliale" }),
        q({ id: "situation_particuliere", type: "case_multiple", label: "Situation particulière ?", options: ["Parent isolé", "Aidant familial", "Autre"], champFirestore: "Diagnostic_SituationParticuliere" }),
        q({ id: "situation_particuliere_autre", type: "ligne", label: "Précisez", champFirestore: "Diagnostic_SituationParticuliereAutre", conditionSurQuestionId: "situation_particuliere", conditionValeur: "Autre" }),
        q({ id: "chomage", type: "case_oui_non", label: "Êtes-vous au chômage ?", champFirestore: "Diagnostic_Chomage" }),
        q({ id: "duree_chomage", type: "ligne", label: "Durée de chômage (en année et mois)", champFirestore: "Diagnostic_DureeChomage" }),
        q({ id: "rqth", type: "case_oui_non", label: "Avez-vous une RQTH (Reconnaissance en Qualité de Travailleur Handicapé) ?", champFirestore: "RQTH", valeurCommeOuiNonTexte: true }),
        q({ id: "conge_parental", type: "case_oui_non", label: "Êtes-vous en congé parental ?", champFirestore: "Diagnostic_CongeParental" }),
        q({ id: "france_travail", type: "case_oui_non", label: "Êtes-vous inscrit(e) à France Travail ?", champFirestore: "France_Travail", valeurCommeOuiNonTexte: true }),
        q({ id: "france_travail_depuis", type: "ligne_date", label: "Si OUI, depuis quand ?", champFirestore: "Diagnostic_FranceTravailDepuis" }),
      ],
    },
    {
      id: "section_diplome",
      titre: "Diplôme obtenu / Niveau d'études",
      questions: [
        q({
          id: "niveau_etudes", type: "case_unique", label: "", champFirestore: "Niveau_Etudes",
          options: ["Sans diplôme", "Brevet des collèges", "CAP / BEP (autres diplômes techniques)", "Bac (général, pro ou technologique)", "Bac + 2 (BTS ou autre)", "Bac + 3/4 (Licence, Maîtrise)", "Bac + 5 (Master, Écoles d'ingénieur, École d'arts…)", "Bac + 7 (Doctorat, post-doc, thèse)"],
        }),
        q({ id: "formation_suivies", type: "ligne", label: "Formation/études suivies", champFirestore: "Diagnostic_FormationSuivies" }),
      ],
    },
    {
      id: "section_experience_pro",
      titre: "Expérience professionnelle récente",
      questions: [
        q({ id: "nature_contrat", type: "case_unique", label: "Nature du contrat de travail", options: ["CDI", "CDD", "CDDI", "Intérim", "Autre"], champFirestore: "Diagnostic_NatureContrat" }),
        q({ id: "nature_contrat_autre", type: "ligne", label: "Précisez", champFirestore: "Diagnostic_NatureContratAutre", conditionSurQuestionId: "nature_contrat", conditionValeur: "Autre" }),
        q({ id: "emploi_occupe", type: "case_unique", label: "Emploi occupé", options: ["Employé(e)", "Employé qualifié", "Technicien", "Agent de maîtrise", "Cadre moyen", "Cadre dirigeant"], champFirestore: "Diagnostic_EmploiOccupe" }),
      ],
    },
    {
      id: "section_equipement_competences",
      titre: "Votre future expérience professionnelle",
      questions: [
        q({ id: "equipement_info", type: "case_oui_non", label: "Disposez-vous d'un équipement informatique ?", champFirestore: "Diagnostic_EquipementInfo" }),
        q({ id: "equipement_info_precisions", type: "ligne", label: "Si OUI, précisez", champFirestore: "Diagnostic_EquipementInfoPrecisions", conditionSurQuestionId: "equipement_info", conditionValeur: true }),
        q({ id: "type_equipement", type: "case_multiple", label: "", options: ["Écran + unité centrale", "PC portable", "Box internet (ADSL)", "Box internet (Fibre Optique)", "Téléphone portable", "Téléphone portable + forfait internet"], champFirestore: "Diagnostic_TypeEquipement", conditionSurQuestionId: "equipement_info", conditionValeur: true }),
        q({ id: "type_connectivite", type: "ligne", label: "Précisez le type (PC, Mac, Linux…) et la connectivité (ADSL, fibre, etc.)", champFirestore: "Diagnostic_TypeConnectivite", conditionSurQuestionId: "equipement_info", conditionValeur: true }),
        q({
          id: "maitrise_info", type: "case_unique", label: "Comment évalueriez-vous votre maîtrise de l'informatique ?", champFirestore: "Diagnostic_MaitriseInfo",
          options: ["Débutant", "Amateur/autodidacte", "Initié professionnel", "Expert"],
        }),
        q({ id: "maitrise_info_expert_precisions", type: "ligne", label: "Précisez", champFirestore: "Diagnostic_MaitriseInfoExpertPrecisions", conditionSurQuestionId: "maitrise_info", conditionValeur: "Expert" }),
        q({ id: "actions_realisees", type: "case_oui_non", label: "Avez-vous déjà réalisé des actions telles que : installation de logiciels, utilisation de messageries, gestion de fichiers, utilisation de plateformes collaboratives ?", champFirestore: "Diagnostic_ActionsRealisees" }),
        q({ id: "actions_realisees_precisions", type: "ligne", label: "Précisez", champFirestore: "Diagnostic_ActionsRealiseesPrecisions", conditionSurQuestionId: "actions_realisees", conditionValeur: true }),
        q({ id: "aise_navigation", type: "case_oui_non", label: "Êtes-vous à l'aise avec la navigation, la maintenance de base, et la gestion d'un environnement informatique ?", champFirestore: "Diagnostic_AiseNavigation" }),
        q({ id: "aise_navigation_precisions", type: "ligne", label: "Précisez", champFirestore: "Diagnostic_AiseNavigationPrecisions", conditionSurQuestionId: "aise_navigation", conditionValeur: true }),
        q({ id: "experience_depannage", type: "case_oui_non", label: "Avez-vous déjà eu des expériences en dépannage informatique ou en support technique ?", champFirestore: "Diagnostic_ExperienceDepannage" }),
        q({ id: "experience_depannage_precisions", type: "ligne", label: "Précisez", champFirestore: "Diagnostic_ExperienceDepannagePrecisions", conditionSurQuestionId: "experience_depannage", conditionValeur: true }),
        q({
          id: "competences_a_renforcer", type: "case_multiple", label: "Quelles compétences souhaitez-vous renforcer ou acquérir dans le cadre de cette formation ?", champFirestore: "Diagnostic_CompetencesARenforcer",
          options: [
            "Renforcer mon socle de compétences numériques de base",
            "Découvrir et comprendre les fondamentaux de la cybersécurité",
            "Apprendre les bases de la maintenance informatique responsable",
            "Comprendre les principes de sobriété numérique et d'éco-conception",
            "Bénéficier d'un accompagnement socio-professionnel pour construire mon projet professionnel",
            "Autre",
          ],
        }),
        q({ id: "competences_a_renforcer_autre", type: "ligne", label: "Précisez", champFirestore: "Diagnostic_CompetencesARenforcerAutre", conditionSurQuestionId: "competences_a_renforcer", conditionValeur: "Autre" }),
      ],
    },
    {
      id: "section_objectifs_sortie",
      titre: "Que visez-vous à la sortie de la formation ?",
      questions: [
        q({ id: "obj_sortie_1_coche", type: "case_oui_non", label: "Quel métier souhaitez-vous exercer à l'issue de la formation ? (ex. Technicien HelpDesk, support informatique, analyste cybersécurité, etc.)", champFirestore: "Diagnostic_ObjSortie1_Coche" }),
        q({ id: "obj_sortie_1_reponse", type: "zone_texte", label: "Réponse", champFirestore: "Diagnostic_ObjSortie1_Reponse" }),
        q({ id: "obj_sortie_2_coche", type: "case_oui_non", label: "Quel métier souhaitez-vous exercer à l'issue de la formation ?", champFirestore: "Diagnostic_ObjSortie2_Coche" }),
        q({ id: "obj_sortie_2_reponse", type: "zone_texte", label: "Réponse", champFirestore: "Diagnostic_ObjSortie2_Reponse" }),
        q({ id: "obj_sortie_3_coche", type: "case_oui_non", label: "Pouvez-vous décrire brièvement votre projet professionnel et comment cette formation pourrait vous y aider ?", champFirestore: "Diagnostic_ObjSortie3_Coche" }),
        q({ id: "obj_sortie_3_reponse", type: "zone_texte", label: "Réponse", champFirestore: "Diagnostic_ObjSortie3_Reponse" }),
      ],
    },
    {
      id: "section_projet_pro",
      titre: "Quel est votre projet professionnel aujourd'hui ? Quel métier voulez-vous exercer ?",
      questions: [
        q({ id: "projet_professionnel_aujourdhui", type: "zone_texte", label: "", champFirestore: "Diagnostic_ProjetProfessionnelAujourdhui" }),
      ],
    },
    {
      id: "section_questions_complementaires",
      titre: "Questions complémentaires et besoins spécifiques",
      questions: [
        q({
          id: "problemes_specifiques", type: "zone_texte", champFirestore: "Diagnostic_ProblemesSpecifiques",
          label: "Sur quels problèmes spécifiques/urgents COLOMBBUS pourrait vous apporter des éléments de réponses ou solutions ?",
          sousLabel: "ex. : difficultés à utiliser certains logiciels, manque d'autonomie dans l'utilisation d'outils numériques, besoins en révision de compétences de base…",
        }),
        q({
          id: "contraintes_particulieres", type: "zone_texte", champFirestore: "Diagnostic_ContraintesParticulieres",
          label: "Avez-vous des contraintes particulières (mobilité, horaires, accessibilité) qui pourraient impacter votre participation à la formation ?",
          sousLabel: "ex. : temps de trajet maximal, équipements spécifiques, etc.",
        }),
      ],
    },
  ],
};

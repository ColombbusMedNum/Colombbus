// Script ponctuel (à exécuter une seule fois, en local) qui bascule les 3
// programmes historiques (DIGITAL UP 96H, NUMERIK PRO, PRFE) sur le modèle
// par défaut de la "Fiche entretien diagnostic" éditable (voir
// lib/ficheDiagnostic.ts) — reprend exactement les ~45 questions
// précédemment codées en dur, avec les mêmes champFirestore (aucune
// migration de données, les fiches déjà remplies restent identiques).
//
// Usage :
//   node scripts/seed-fiches-diagnostic.js            # dry-run (aucune écriture)
//   node scripts/seed-fiches-diagnostic.js --apply     # applique réellement
//
// Nécessite une clé de compte de service Firebase, voir scripts/normaliser-
// noms-planning.js pour l'obtenir :
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/seed-fiches-diagnostic.js --apply

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const APPLY = process.argv.includes("--apply");

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

let compteur = 0;
function q(patch) {
  compteur += 1;
  return { id: `q_default_${compteur}`, ...patch };
}

// Identique pour les 3 programmes — seules les 2 questions ci-dessous
// varient un peu par nature de formation, mais restent volontairement
// neutres pour rester correctes sur les 3 (éditable ensuite si besoin).
const config = {
  sections: [
    {
      id: "section_zone_colombbus",
      titre: "Ne pas remplir cette zone grise réservée à Colombbus",
      questions: [
        q({ type: "ligne_date", label: "Date de réalisation", champFirestore: "Diagnostic_DateRealisation" }),
        q({ type: "case_oui_non", label: "Mode choisi : Entretien(s)/atelier(s)", champFirestore: "Diagnostic_ModeEntretienAtelier" }),
        q({ type: "ligne", label: "Détail du mode", champFirestore: "Diagnostic_ModeDetail" }),
        q({ type: "ligne", label: "Nom du réalisateur", champFirestore: "Diagnostic_NomRealisateur" }),
        q({ type: "ligne", label: "Fonction du réalisateur", champFirestore: "Diagnostic_FonctionRealisateur" }),
        q({ type: "ligne", label: "Lieu de réalisation", champFirestore: "Diagnostic_LieuRealisation" }),
        q({ type: "case_unique", label: "Période réalisation", options: ["Accueil-recrutement", "Début de parcours"], champFirestore: "Diagnostic_PeriodeRealisation" }),
      ],
    },
    {
      id: "section_situation_administrative",
      titre: "Situation administrative",
      questions: [
        q({ type: "ligne", label: "Orienté par", champFirestore: "Diagnostic_OrientePar" }),
        q({ type: "case_unique", label: "Civilité", options: ["Mme", "M."], champFirestore: "Civilité" }),
        q({ type: "ligne", label: "Nom de naissance", champFirestore: "Nom" }),
        q({ type: "ligne", label: "Nom d'usage", champFirestore: "Diagnostic_NomUsage" }),
        q({ type: "ligne", label: "Prénom(s)", champFirestore: "Prénom" }),
        q({ type: "ligne_date", label: "Date de naissance", champFirestore: "Diagnostic_DateNaissance" }),
        q({ type: "ligne", label: "Âge", champFirestore: "Age" }),
        q({ type: "ligne", label: "Tél. fixe", champFirestore: "Diagnostic_TelFixe" }),
        q({ type: "ligne", label: "Tél. portable", champFirestore: "Téléphone" }),
        q({ type: "ligne", label: "Adresse", champFirestore: "Diagnostic_Adresse" }),
        q({ type: "ligne", label: "CP", champFirestore: "Code_Postal" }),
        q({ type: "ligne", label: "Ville", champFirestore: "Ville" }),
        q({ type: "ligne", label: "Courriel", champFirestore: "Email" }),
        q({ type: "ligne", label: "N° sécurité sociale", champFirestore: "Diagnostic_NumSecuriteSociale" }),
        q({ type: "ligne", label: "N° CNI", champFirestore: "Diagnostic_NumCNI" }),
        q({ type: "ligne", label: "N° carte de séjour", champFirestore: "Diagnostic_NumCarteSejour" }),
      ],
    },
    {
      id: "section_situation_sociale",
      titre: "Situation sociale",
      questions: [
        q({ type: "case_unique", label: "Quelle est votre situation familiale ?", options: ["Célibataire", "Vie maritale/concubinage", "Marié(e)", "Veuf(ve)", "Divorcé(e)"], champFirestore: "Diagnostic_SituationFamiliale" }),
        q({ type: "case_multiple", label: "Situation particulière ?", options: ["Parent isolé", "Aidant familial", "Autre"], champFirestore: "Diagnostic_SituationParticuliere" }),
        q({ type: "ligne", label: "Précisez", champFirestore: "Diagnostic_SituationParticuliereAutre", conditionSurQuestionId: "situation_particuliere_placeholder", conditionValeur: "Autre" }),
        q({ type: "case_oui_non", label: "Êtes-vous au chômage ?", champFirestore: "Diagnostic_Chomage" }),
        q({ type: "ligne", label: "Durée de chômage (en année et mois)", champFirestore: "Diagnostic_DureeChomage" }),
        q({ type: "case_oui_non", label: "Avez-vous une RQTH (Reconnaissance en Qualité de Travailleur Handicapé) ?", champFirestore: "RQTH", valeurCommeOuiNonTexte: true }),
        q({ type: "case_oui_non", label: "Êtes-vous en congé parental ?", champFirestore: "Diagnostic_CongeParental" }),
        q({ type: "case_oui_non", label: "Êtes-vous inscrit(e) à France Travail ?", champFirestore: "France_Travail", valeurCommeOuiNonTexte: true }),
        q({ type: "ligne_date", label: "Si OUI, depuis quand ?", champFirestore: "Diagnostic_FranceTravailDepuis" }),
      ],
    },
    {
      id: "section_diplome",
      titre: "Diplôme obtenu / Niveau d'études",
      questions: [
        q({
          type: "case_unique", label: "", champFirestore: "Niveau_Etudes",
          options: ["Sans diplôme", "Brevet des collèges", "CAP / BEP (autres diplômes techniques)", "Bac (général, pro ou technologique)", "Bac + 2 (BTS ou autre)", "Bac + 3/4 (Licence, Maîtrise)", "Bac + 5 (Master, Écoles d'ingénieur, École d'arts…)", "Bac + 7 (Doctorat, post-doc, thèse)"],
        }),
        q({ type: "ligne", label: "Formation/études suivies", champFirestore: "Diagnostic_FormationSuivies" }),
      ],
    },
    {
      id: "section_experience_pro",
      titre: "Expérience professionnelle récente",
      questions: [
        q({ type: "case_unique", label: "Nature du contrat de travail", options: ["CDI", "CDD", "CDDI", "Intérim", "Autre"], champFirestore: "Diagnostic_NatureContrat" }),
        q({ type: "ligne", label: "Précisez", champFirestore: "Diagnostic_NatureContratAutre", conditionSurQuestionId: "nature_contrat_placeholder", conditionValeur: "Autre" }),
        q({ type: "case_unique", label: "Emploi occupé", options: ["Employé(e)", "Employé qualifié", "Technicien", "Agent de maîtrise", "Cadre moyen", "Cadre dirigeant"], champFirestore: "Diagnostic_EmploiOccupe" }),
      ],
    },
    {
      id: "section_equipement_competences",
      titre: "Votre future expérience professionnelle",
      questions: [
        q({ type: "case_oui_non", label: "Disposez-vous d'un équipement informatique ?", champFirestore: "Diagnostic_EquipementInfo" }),
        q({ type: "ligne", label: "Si OUI, précisez", champFirestore: "Diagnostic_EquipementInfoPrecisions", conditionSurQuestionId: "equipement_info_placeholder", conditionValeur: true }),
        q({ type: "case_multiple", label: "", options: ["Écran + unité centrale", "PC portable", "Box internet (ADSL)", "Box internet (Fibre Optique)", "Téléphone portable", "Téléphone portable + forfait internet"], champFirestore: "Diagnostic_TypeEquipement", conditionSurQuestionId: "equipement_info_placeholder", conditionValeur: true }),
        q({ type: "ligne", label: "Précisez le type (PC, Mac, Linux…) et la connectivité (ADSL, fibre, etc.)", champFirestore: "Diagnostic_TypeConnectivite", conditionSurQuestionId: "equipement_info_placeholder", conditionValeur: true }),
        q({ type: "case_unique", label: "Comment évalueriez-vous votre maîtrise de l'informatique ?", champFirestore: "Diagnostic_MaitriseInfo", options: ["Débutant", "Amateur/autodidacte", "Initié professionnel", "Expert"] }),
        q({ type: "ligne", label: "Précisez", champFirestore: "Diagnostic_MaitriseInfoExpertPrecisions", conditionSurQuestionId: "maitrise_info_placeholder", conditionValeur: "Expert" }),
        q({ type: "case_oui_non", label: "Avez-vous déjà réalisé des actions telles que : installation de logiciels, utilisation de messageries, gestion de fichiers, utilisation de plateformes collaboratives ?", champFirestore: "Diagnostic_ActionsRealisees" }),
        q({ type: "ligne", label: "Précisez", champFirestore: "Diagnostic_ActionsRealiseesPrecisions", conditionSurQuestionId: "actions_realisees_placeholder", conditionValeur: true }),
        q({ type: "case_oui_non", label: "Êtes-vous à l'aise avec la navigation, la maintenance de base, et la gestion d'un environnement informatique ?", champFirestore: "Diagnostic_AiseNavigation" }),
        q({ type: "ligne", label: "Précisez", champFirestore: "Diagnostic_AiseNavigationPrecisions", conditionSurQuestionId: "aise_navigation_placeholder", conditionValeur: true }),
        q({ type: "case_oui_non", label: "Avez-vous déjà eu des expériences en dépannage informatique ou en support technique ?", champFirestore: "Diagnostic_ExperienceDepannage" }),
        q({ type: "ligne", label: "Précisez", champFirestore: "Diagnostic_ExperienceDepannagePrecisions", conditionSurQuestionId: "experience_depannage_placeholder", conditionValeur: true }),
        q({
          type: "case_multiple", label: "Quelles compétences souhaitez-vous renforcer ou acquérir dans le cadre de cette formation ?", champFirestore: "Diagnostic_CompetencesARenforcer",
          options: [
            "Renforcer mon socle de compétences numériques de base",
            "Découvrir et comprendre les fondamentaux de la cybersécurité",
            "Apprendre les bases de la maintenance informatique responsable",
            "Comprendre les principes de sobriété numérique et d'éco-conception",
            "Bénéficier d'un accompagnement socio-professionnel pour construire mon projet professionnel",
            "Autre",
          ],
        }),
        q({ type: "ligne", label: "Précisez", champFirestore: "Diagnostic_CompetencesARenforcerAutre", conditionSurQuestionId: "competences_a_renforcer_placeholder", conditionValeur: "Autre" }),
      ],
    },
    {
      id: "section_objectifs_sortie",
      titre: "Que visez-vous à la sortie de la formation ?",
      questions: [
        q({ type: "case_oui_non", label: "Quel métier souhaitez-vous exercer à l'issue de la formation ? (ex. Technicien HelpDesk, support informatique, analyste cybersécurité, etc.)", champFirestore: "Diagnostic_ObjSortie1_Coche" }),
        q({ type: "zone_texte", label: "Réponse", champFirestore: "Diagnostic_ObjSortie1_Reponse" }),
        q({ type: "case_oui_non", label: "Quel métier souhaitez-vous exercer à l'issue de la formation ?", champFirestore: "Diagnostic_ObjSortie2_Coche" }),
        q({ type: "zone_texte", label: "Réponse", champFirestore: "Diagnostic_ObjSortie2_Reponse" }),
        q({ type: "case_oui_non", label: "Pouvez-vous décrire brièvement votre projet professionnel et comment cette formation pourrait vous y aider ?", champFirestore: "Diagnostic_ObjSortie3_Coche" }),
        q({ type: "zone_texte", label: "Réponse", champFirestore: "Diagnostic_ObjSortie3_Reponse" }),
      ],
    },
    {
      id: "section_projet_pro",
      titre: "Quel est votre projet professionnel aujourd'hui ? Quel métier voulez-vous exercer ?",
      questions: [q({ type: "zone_texte", label: "", champFirestore: "Diagnostic_ProjetProfessionnelAujourdhui" })],
    },
    {
      id: "section_questions_complementaires",
      titre: "Questions complémentaires et besoins spécifiques",
      questions: [
        q({
          type: "zone_texte", champFirestore: "Diagnostic_ProblemesSpecifiques",
          label: "Sur quels problèmes spécifiques/urgents COLOMBBUS pourrait vous apporter des éléments de réponses ou solutions ?",
          sousLabel: "ex. : difficultés à utiliser certains logiciels, manque d'autonomie dans l'utilisation d'outils numériques, besoins en révision de compétences de base…",
        }),
        q({
          type: "zone_texte", champFirestore: "Diagnostic_ContraintesParticulieres",
          label: "Avez-vous des contraintes particulières (mobilité, horaires, accessibilité) qui pourraient impacter votre participation à la formation ?",
          sousLabel: "ex. : temps de trajet maximal, équipements spécifiques, etc.",
        }),
      ],
    },
  ],
};

// Les conditions ci-dessus référencent des ids "placeholder" (générés par
// section/position réelle inconnue à l'écriture) — on les résout maintenant
// que tous les ids définitifs (q_default_N) sont connus, en retrouvant
// chaque question par son champFirestore.
function resoudreConditions(cfg) {
  const parChampFirestore = new Map();
  cfg.sections.forEach((s) => s.questions.forEach((q) => { if (q.champFirestore) parChampFirestore.set(q.champFirestore, q.id); }));
  const CORRESPONDANCES = {
    situation_particuliere_placeholder: "Diagnostic_SituationParticuliere",
    nature_contrat_placeholder: "Diagnostic_NatureContrat",
    equipement_info_placeholder: "Diagnostic_EquipementInfo",
    maitrise_info_placeholder: "Diagnostic_MaitriseInfo",
    actions_realisees_placeholder: "Diagnostic_ActionsRealisees",
    aise_navigation_placeholder: "Diagnostic_AiseNavigation",
    experience_depannage_placeholder: "Diagnostic_ExperienceDepannage",
    competences_a_renforcer_placeholder: "Diagnostic_CompetencesARenforcer",
  };
  cfg.sections.forEach((s) => s.questions.forEach((q) => {
    if (q.conditionSurQuestionId && CORRESPONDANCES[q.conditionSurQuestionId]) {
      q.conditionSurQuestionId = parChampFirestore.get(CORRESPONDANCES[q.conditionSurQuestionId]);
    }
  }));
  return cfg;
}
resoudreConditions(config);

const PROGRAMMES = ["digital-up-pro", "numerik-up-pro", "prfe"];

async function main() {
  console.log(APPLY ? "Mode : APPLICATION RÉELLE" : "Mode : DRY-RUN (aucune écriture)");
  const totalQuestions = config.sections.reduce((n, s) => n + s.questions.length, 0);
  console.log(`${config.sections.length} sections, ${totalQuestions} questions, pour ${PROGRAMMES.length} programmes : ${PROGRAMMES.join(", ")}.`);

  for (const programmeId of PROGRAMMES) {
    const ref = db.collection("fiches_diagnostic").doc(programmeId);
    const existant = await ref.get();
    if (existant.exists) console.log(`fiches_diagnostic/${programmeId} existe déjà — sera écrasé si --apply.`);
    if (APPLY) {
      await ref.set(config);
      console.log(`Contenu inséré dans fiches_diagnostic/${programmeId}.`);
    }
  }

  if (!APPLY) console.log("Dry-run terminé, rien n'a été écrit. Relance avec --apply pour appliquer.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

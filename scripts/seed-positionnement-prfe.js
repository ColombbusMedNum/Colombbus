// Script ponctuel (à exécuter une seule fois, en local) qui insère le
// contenu initial du test de positionnement PRFE (Français/Anglais/Maths,
// fourni par l'utilisateur) dans Firestore, sous positionnement/prfe (voir
// lib/positionnement.ts). Une fois posé, ce contenu reste entièrement
// éditable depuis /mediation/actions-collectives/reponses/prfe/
// positionnement/editer — ce script ne sert qu'à amorcer les données au lieu
// de tout ressaisir à la main dans l'éditeur.
//
// Usage :
//   node scripts/seed-positionnement-prfe.js            # dry-run (aucune écriture)
//   node scripts/seed-positionnement-prfe.js --apply     # applique réellement
//
// Nécessite une clé de compte de service Firebase, voir scripts/normaliser-
// noms-planning.js pour l'obtenir :
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/seed-positionnement-prfe.js --apply

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const APPLY = process.argv.includes("--apply");

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

let compteur = 0;
function item(patch) {
  compteur += 1;
  return { id: `item_${compteur}`, ...patch };
}

const config = {
  titre: "2026 — Tests de positionnement Français - Anglais - Maths",
  description:
    "Tests de positionnement à l'entrée du parcours PRFE.\n\n" +
    "Merci de répondre à toutes les questions sans utiliser d'aide extérieure.\n\n" +
    "Les résultats permettront d'identifier les compétences déjà acquises et les besoins de remise à niveau.",
  sections: [
    {
      id: "section_francais",
      titre: "Test de Français",
      sousTitre: "Durée conseillée : 35 minutes – Niveau visé : B1 CECRL",
      items: [
        item({
          type: "texte_intro",
          contenu:
            "Compréhension écrite\nLis le texte suivant :\n\n" +
            "Bonjour Monsieur Diallo,\n" +
            "Nous vous confirmons votre rendez-vous avec votre conseillère le mardi 15 septembre à 10 h 30. Le rendez-vous aura lieu dans notre agence de Suresnes.\n" +
            "Merci d'apporter votre CV ainsi qu'une pièce d'identité.\n" +
            "Si vous ne pouvez pas venir, merci de nous prévenir au moins 24 heures à l'avance.\n" +
            "Cordialement,\nService accompagnement",
        }),
        item({ type: "qcm", enonce: "Quel jour a lieu le rendez-vous ?", options: ["Lundi 14 septembre", "Mardi 15 septembre", "Mercredi 16 septembre"], bonneReponseIndex: 1 }),
        item({ type: "texte_libre", enonce: "À quelle heure a lieu le rendez-vous ?", reponseIndicative: "10 h 30" }),
        item({ type: "texte_libre", enonce: "Où doit se rendre Monsieur Diallo ?", reponseIndicative: "Agence de Suresnes" }),
        item({ type: "texte_libre", enonce: "Quels sont les deux documents qu'il doit apporter ?", reponseIndicative: "CV et pièce d'identité" }),
        item({ type: "texte_libre", enonce: "Que doit-il faire s'il ne peut pas venir ?", reponseIndicative: "Prévenir 24h à l'avance" }),
        item({ type: "qcm", enonce: "Ce document est :", options: ["Une publicité", "Un message de confirmation", "Une offre d'emploi", "Une facture"], bonneReponseIndex: 1 }),
        item({ type: "texte_intro", contenu: "Maîtrise de la langue" }),
        item({ type: "qcm", enonce: "Hier, je ________ à mon rendez-vous.", options: ["vais", "suis allé(e)", "irai"], bonneReponseIndex: 1 }),
        item({ type: "qcm", enonce: "Demain, nous ________ le formateur à 9 heures.", options: ["avons rencontré", "rencontrerons", "rencontrions"], bonneReponseIndex: 1 }),
        item({ type: "qcm", enonce: "Choisis la phrase correcte.", options: ["Je cherche un emploi depuis trois mois.", "Je cherche un emploi il y a trois mois.", "Je cherche un emploi pendant trois mois demain."], bonneReponseIndex: 0 }),
        item({ type: "qcm", enonce: "Je n'ai pas pu venir ________ j'étais malade.", options: ["mais", "parce que", "donc"], bonneReponseIndex: 1 }),
        item({ type: "texte_libre", enonce: "Mets cette phrase au pluriel : « Le candidat prépare son entretien. »", reponseIndicative: "Les candidats préparent leurs entretiens." }),
        item({ type: "texte_libre", enonce: "Remets les mots dans l'ordre : demain / entretien / j'ai / un / important", reponseIndicative: "J'ai un entretien important demain." }),
        item({ type: "texte_libre", enonce: "Corrige la phrase : « Je suis arriver en retard parce que mon train été supprimé. »", reponseIndicative: "Je suis arrivé en retard parce que mon train a été supprimé." }),
        item({
          type: "texte_libre",
          enonce:
            "Production écrite : Tu as un rendez-vous professionnel demain à 14 h mais tu ne peux pas venir. Écris un message de 5 à 8 lignes pour expliquer la situation, donner une raison, t'excuser et demander un nouveau rendez-vous.",
        }),
      ],
    },
    {
      id: "section_anglais",
      titre: "Test d'Anglais",
      sousTitre: "Durée conseillée : 20 minutes – Niveau visé : A1 CECRL",
      items: [
        item({ type: "qcm", enonce: '"Good morning" means:', options: ["Bonsoir", "Bonjour", "Au revoir"], bonneReponseIndex: 1 }),
        item({ type: "qcm", enonce: '"Monday" is:', options: ["A month", "A day", "A number"], bonneReponseIndex: 1 }),
        item({ type: "qcm", enonce: "I ______ Paul.", options: ["am", "is", "are"], bonneReponseIndex: 0 }),
        item({ type: "qcm", enonce: "I work in ______.", options: ["an office", "Monday", "twenty"], bonneReponseIndex: 0 }),
        item({ type: "qcm", enonce: '"Thank you" means:', options: ["Merci", "Pardon", "Bonjour"], bonneReponseIndex: 0 }),
        item({
          type: "texte_intro",
          contenu: "Read the text\nHello! My name is Sarah. I am 26 years old. I live in Paris. I work in a restaurant. I start work at 9 a.m.",
        }),
        item({ type: "texte_libre", enonce: "What is her name?", reponseIndicative: "Sarah" }),
        item({ type: "texte_libre", enonce: "How old is she?", reponseIndicative: "26" }),
        item({ type: "texte_libre", enonce: "Where does she live?", reponseIndicative: "Paris" }),
        item({ type: "texte_libre", enonce: "Where does she work?", reponseIndicative: "In a restaurant" }),
        item({ type: "texte_libre", enonce: "What time does she start work?", reponseIndicative: "9 a.m." }),
        item({ type: "texte_libre", enonce: 'Write in numbers: "twenty-five"', reponseIndicative: "25" }),
        item({ type: "texte_libre", enonce: "Write 12 in English.", reponseIndicative: "twelve" }),
        item({ type: "qcm", enonce: "8:00 =", options: ["eight o'clock", "nine o'clock", "ten o'clock"], bonneReponseIndex: 0 }),
        item({ type: "qcm", enonce: "Which day comes after Monday?", options: ["Sunday", "Tuesday", "Friday"], bonneReponseIndex: 1 }),
        item({ type: "qcm", enonce: '"January" is:', options: ["A month", "A day", "A job"], bonneReponseIndex: 0 }),
        item({ type: "qcm", enonce: '"What is ______ name?"', options: ["you", "your", "yours"], bonneReponseIndex: 1 }),
        item({ type: "qcm", enonce: '"Where ______ you live?"', options: ["do", "is", "are"], bonneReponseIndex: 0 }),
        item({ type: "qcm", enonce: '"Can you help me, please?"', options: ["Yes, of course.", "I am Monday.", "Twenty euros."], bonneReponseIndex: 0 }),
        item({ type: "qcm", enonce: "You arrive at work in the morning. What can you say?", options: ["Good morning.", "Good night.", "Goodbye."], bonneReponseIndex: 0 }),
        item({ type: "qcm", enonce: '"I ______ speak a little English."', options: ["can", "am", "have"], bonneReponseIndex: 0 }),
      ],
    },
    {
      id: "section_maths",
      titre: "Test de Mathématiques",
      sousTitre: "Durée conseillée : 30 minutes – Compétences clés / CléA domaine 2",
      items: [
        item({ type: "texte_libre", enonce: "27 + 35 =", reponseIndicative: "62" }),
        item({ type: "texte_libre", enonce: "150 − 48 =", reponseIndicative: "102" }),
        item({ type: "texte_libre", enonce: "12 × 6 =", reponseIndicative: "72" }),
        item({ type: "texte_libre", enonce: "84 ÷ 7 =", reponseIndicative: "12" }),
        item({ type: "texte_libre", enonce: "12,50 + 3,75 =", reponseIndicative: "16,25" }),
        item({ type: "qcm", enonce: "Quel nombre est le plus grand ?", options: ["3,8", "3,18", "3,08"], bonneReponseIndex: 0 }),
        item({ type: "texte_libre", enonce: "Un article coûte 8 €. Tu en achètes 3. Combien paies-tu ?", reponseIndicative: "24 €" }),
        item({ type: "texte_libre", enonce: "Tu paies un achat de 36 € avec un billet de 50 €. Combien doit-on te rendre ?", reponseIndicative: "14 €" }),
        item({ type: "texte_libre", enonce: "Combien représentent 50 % de 80 € ?", reponseIndicative: "40 €" }),
        item({ type: "texte_libre", enonce: "Un article coûte 100 €. Le magasin applique une remise de 20 %. Quel est son nouveau prix ?", reponseIndicative: "80 €" }),
        item({ type: "texte_libre", enonce: "Pour 2 personnes, il faut 300 g de riz. Combien faut-il pour 4 personnes ?", reponseIndicative: "600 g" }),
        item({ type: "texte_libre", enonce: "Un salarié gagne 1 500 €. Son salaire augmente de 10 %. Quel est son nouveau salaire ?", reponseIndicative: "1 650 €" }),
        item({ type: "texte_libre", enonce: "Une formation commence à 9 h et se termine à 12 h 30. Combien de temps dure-t-elle ?", reponseIndicative: "3 h 30" }),
        item({ type: "texte_libre", enonce: "Tu commences à travailler à 8 h 30. Tu dois effectuer 7 heures de travail et tu prends une pause d'une heure. À quelle heure termines-tu ?", reponseIndicative: "16 h 30" }),
        item({ type: "texte_libre", enonce: "Un train part à 14 h 45 et arrive à 16 h 10. Combien de temps dure le trajet ?", reponseIndicative: "1 h 25" }),
        item({
          type: "texte_intro",
          contenu: "Observe le tableau\nLundi : 12 participants\nMardi : 15 participants\nMercredi : 10 participants\nJeudi : 18 participants\nVendredi : 15 participants",
        }),
        item({ type: "texte_libre", enonce: "Quel jour y a-t-il le plus de participants ?", reponseIndicative: "Jeudi" }),
        item({ type: "texte_libre", enonce: "Quel jour y en a-t-il le moins ?", reponseIndicative: "Mercredi" }),
        item({ type: "texte_libre", enonce: "Combien de personnes sont présentes lundi et mardi au total ?", reponseIndicative: "27" }),
        item({ type: "texte_libre", enonce: "Quelle est la différence entre jeudi et mercredi ?", reponseIndicative: "8" }),
      ],
    },
  ],
};

async function main() {
  console.log(APPLY ? "Mode : APPLICATION RÉELLE" : "Mode : DRY-RUN (aucune écriture)");
  const totalItems = config.sections.reduce((n, s) => n + s.items.length, 0);
  console.log(`${config.sections.length} sections, ${totalItems} éléments au total.`);

  const ref = db.collection("positionnement").doc("prfe");
  const existant = await ref.get();
  if (existant.exists) {
    console.log("Un document positionnement/prfe existe déjà — il sera écrasé si --apply est utilisé.");
  }

  if (APPLY) {
    await ref.set(config);
    console.log("Contenu inséré dans positionnement/prfe.");
  } else {
    console.log("Dry-run terminé, rien n'a été écrit. Relance avec --apply pour appliquer.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

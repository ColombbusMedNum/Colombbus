// Diagnostic "Collecte Tech" (23 questions, 44 pts) — repris tel quel du
// formulaire existant app/mediation/rencontres-numeriques/diagnosticform/page.tsx
// (mode "CollecteTech"), pour la version publique/autonome Digital Up 96H
// (app/inscription/digital-up-pro-collecte-tech).

export interface OptionCollecteTech {
  text: string;
  points: number;
}

export interface QuestionCollecteTech {
  id: string;
  question: string;
  options: OptionCollecteTech[];
}

export const QUESTIONS_COLLECTE_TECH: QuestionCollecteTech[] = [
  { id: "ct2", question: "Est-il obligatoire de posséder une souris pour utiliser l'ordinateur ?", options: [{ text: "Oui, sans souris l'ordinateur ne peut pas fonctionner.", points: 0 }, { text: "Non, on peut utiliser un pavé tactile, un écran tactile ou des raccourcis clavier.", points: 2 }, { text: "Je ne sais pas.", points: 0 }] },
  { id: "ct3", question: "Pouvez-vous décrire ce qu'est Internet de manière simple ?", options: [{ text: "C'est un logiciel installé sur mon ordinateur pour tapez des textes.", points: 0 }, { text: "C'est un immense réseau mondial qui connecte les ordinateurs entre eux pour s'échanger des informations.", points: 2 }, { text: "C'est juste une boîte pour recevoir des e-mails.", points: 0 }] },
  { id: "ct4", question: "Savez-vous de combien de caractères au minimum doit être composé un mot de passe sécurisé aujourd'hui ?", options: [{ text: "4 à 6 caractères simples.", points: 0 }, { text: "Au moins 12 caractères (mélangeant majuscules, minuscules, chiffres et symboles).", points: 2 }, { text: "Le nombre de caractères n'a aucune importance.", points: 0 }] },
  { id: "ct5", question: "Un clavier est-il obligatoire quand on veut utiliser un ordinateur ?", options: [{ text: "Oui, c'est le seul moyen de saisir du texte.", points: 0 }, { text: "Non, on peut utiliser un clavier visuel sur l'écran ou la dictée vocale.", points: 2 }] },
  { id: "ct6", question: "À quoi correspondent Windows, Linux et MacOs ?", options: [{ text: "Des marques d'ordinateurs portables.", points: 0 }, { text: "Des systèmes d'exploitation (le programme principal de la machine).", points: 2 }, { text: "Des moteurs de recherche pour aller sur Internet.", points: 0 }] },
  { id: "ct7", question: "Qu'est-ce que signifie le terme « session de connexion » ?", options: [{ text: "C'est mon espace personnel protégé par mot de passe qui charge mes fichiers.", points: 2 }, { text: "Ça veut dire que l'ordinateur est branché à l'électricité.", points: 0 }, { text: "C'est le moment où l'ordinateur s'éteint.", points: 0 }] },
  { id: "ct8", question: "Qu'est-ce que signifie le terme « navigateur web » ?", options: [{ text: "Un site pour réserver des vacances en bateau.", points: 0 }, { text: "Le logiciel qui permet d'ouvrir et de visiter des sites internet (ex: Chrome, Firefox).", points: 2 }, { text: "Le programme antivirus.", points: 0 }] },
  { id: "ct9", question: "Qu'est-ce que signifie le terme « moteur de recherche » ?", options: [{ text: "Un site (comme Google ou Bing) qui cherche des pages web à partir de mots-clés.", points: 2 }, { text: "Le composant qui fait du bruit dans l'ordinateur.", points: 0 }, { text: "Un modèle de clé USB.", points: 0 }] },
  { id: "ct10", question: "De quoi a-t-on besoin pour se connecter à sa boîte mail ?", options: [{ text: "Uniquement du nom de l'ordinateur.", points: 0 }, { text: "Une connexion Internet, son adresse e-mail et son mot de passe secret.", points: 2 }, { text: "Une carte bancaire.", points: 0 }] },
  { id: "ct11", question: "Qu'est-ce qu'un mot de passe et pourquoi est-il important d'en avoir un ?", options: [{ text: "C'est un code secret inutile.", points: 0 }, { text: "C'est une clé secrète qui protège mes données et mes comptes contre le piratage.", points: 2 }, { text: "C'est une phrase obligatoire à répéter devant l'écran.", points: 0 }] },
  { id: "ct12", question: "Quelles touches peut-on utiliser pour faire une majuscule ?", options: [{ text: "La touche Espace ou la touche Entrée.", points: 0 }, { text: "La touche Maj (flèche vers le haut) ou la touche Verr. Maj (cadenas).", points: 2 }] },
  { id: "ct13", question: "Répondez-vous à tous les e-mails que l'on vous envoie ?", options: [{ text: "Oui, par politesse il faut répondre à tout le monde.", points: 0 }, { text: "Non, je ne réponds pas aux publicités ni aux e-mails bizarres ou suspects.", points: 2 }] },
  { id: "ct14", question: "À quoi sert un dossier sur un ordinateur ?", options: [{ text: "À organiser et regrouper ses fichiers pour les retrouver facilement.", points: 2 }, { text: "À accélérer la connexion Internet.", points: 0 }, { text: "À nettoyer les virus.", points: 0 }] },
  { id: "ct15", question: "Où range-t-on les fichiers ?", options: [{ text: "Dans le moteur de recherche.", points: 0 }, { text: "Dans des dossiers sur le disque dur, sur le Bureau ou sur une clé USB.", points: 2 }] },
  { id: "ct16", question: "Savez-vous comment imprimer un document depuis un ordinateur ?", options: [{ text: "Non, je ne sais pas faire.", points: 0 }, { text: "Oui, j'ouvre le fichier et je fais Fichier > Imprimer (ou Ctrl + P).", points: 2 }] },
  { id: "ct17", question: "Quelle est la différence entre un clic gauche et un clic droit sur la souris ?", options: [{ text: "Ils font la même chose.", points: 0 }, { text: "Le clic gauche valide/sélectionne ; Le clic droit affiche un menu d'options (Copier, Supprimer...).", points: 2 }] },
  { id: "ct18", question: "Comment créez-vous un nouveau dossier sur le bureau de l'ordinateur ?", options: [{ text: "Je secoue la souris.", points: 0 }, { text: "Clic droit sur un espace vide du bureau > Nouveau > Dossier.", points: 2 }] },
  { id: "ct19", question: "Comment faites-vous pour copier un texte depuis une page web ?", options: [{ text: "Je le recopie sur un papier.", points: 0 }, { text: "Je le sélectionne à la souris, puis je fais Clic droit > Copier (ou Ctrl + C).", points: 2 }] },
  { id: "ct20", question: "Quelle est la fonction d'une barre de recherche sur un navigateur web ?", options: [{ text: "Elle sert à tapez des mots-clés ou l'adresse d'un site pour y aller directement.", points: 2 }, { text: "Elle sert à recharger la batterie.", points: 0 }] },
  { id: "ct21", question: "Savez-vous comment mettre à jour le système d'exploitation d'un ordinateur ?", options: [{ text: "Non, je ne sais pas.", points: 0 }, { text: "Oui, dans les Paramètres de l'ordinateur, section Mises à jour.", points: 2 }] },
  { id: "ct22", question: "Savez-vous ce qu'est une clé USB et à quoi ça sert ?", options: [{ text: "Un outil de stockage amovible pour transporter des fichiers d'un ordinateur à un autre.", points: 2 }, { text: "Un câble pour charger la batterie.", points: 0 }] },
  { id: "ct23", question: "Comment faites-vous pour supprimer un fichier inutile sur votre ordinateur ?", options: [{ text: "Je l'éteins et je l'allume.", points: 0 }, { text: "Clic droit sur le fichier puis 'Supprimer', ou je le glisse dans la Corbeille.", points: 2 }] },
];

export const SCORE_MAX_COLLECTE_TECH = 44;

export function calculerScoreCollecteTech(reponses: Record<string, number | undefined>): number {
  return QUESTIONS_COLLECTE_TECH.reduce((total, q) => {
    const index = reponses[q.id];
    return total + (index !== undefined && q.options[index] ? q.options[index].points : 0);
  }, 0);
}

export function profilCollecteTechDepuisScore(score: number): { label: string; description: string } {
  if (score <= 14) {
    return { label: "Débutant / Accompagnement renforcé", description: "Besoins critiques sur l'utilisation de la souris, du clavier et des notions réseau de base." };
  }
  if (score <= 30) {
    return { label: "Intermédiaire / En cours d'acquisition", description: "Possède des bases opérationnelles. Doit consolider la gestion de l'arborescence des fichiers et la sécurité." };
  }
  return { label: "Autonome / Compétences solides", description: "Excellente maîtrise globale des outils informatiques d'usage courant." };
}

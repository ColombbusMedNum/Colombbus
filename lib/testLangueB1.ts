// Test d'auto-positionnement B1 (CECR) — Digital Up 96H. Auto-corrigé : les
// 10 questions valent chacune 1 point, la note sur 10 détermine directement
// le niveau (voir le barème affiché sur le formulaire public).
export interface QuestionTestLangue {
  id: string;
  enonce: string;
  options: string[];
  bonneReponse: number; // index dans "options"
}

export const QUESTIONS_PARTIE_1: QuestionTestLangue[] = [
  {
    id: "q1",
    enonce: "Choisissez la forme correcte : « C'est l'outil [...] je me sers pour réparer mon vélo. »",
    options: ["que", "dont", "lequel", "où"],
    bonneReponse: 1,
  },
  {
    id: "q2",
    enonce: "Quelle expression complète correctement cette phrase ? « Dehors, il neige et les enfants [...] très froid aux mains. »",
    options: ["sont", "font", "vont", "ont"],
    bonneReponse: 3,
  },
  {
    id: "q3",
    enonce: "« Elle pense souvent à ses prochaines vacances. » Quelle est la reformulation correcte ?",
    options: ["Elle en pense souvent.", "Elle y pense souvent.", "Elle les pense souvent.", "Elle la pense souvent."],
    bonneReponse: 1,
  },
  {
    id: "q4",
    enonce: "« Marc a trouvé un vieux portefeuille et il l'a rendu à son propriétaire. » Quelle est la reformulation correcte ?",
    options: ["Marc le lui a rendu.", "Marc lui le a rendu.", "Marc l'en a rendu.", "Marc le l'y a rendu."],
    bonneReponse: 0,
  },
  {
    id: "q5",
    enonce: "Complétez la phrase avec le temps correct : « Quand je suis arrivé à la gare, le train [...]. »",
    options: ["était déjà parti", "est déjà parti", "parti déjà", "a été déjà parti"],
    bonneReponse: 0,
  },
  {
    id: "q6",
    enonce: "Choisissez la forme verbale appropriée : « Je souhaite que tu [...] beaucoup de chance cette année. »",
    options: ["avais", "auras", "as", "aies"],
    bonneReponse: 3,
  },
];

export const TEXTE_COMPREHENSION = `Cet après-midi, Hugo est allé se promener au parc avec sa petite-amie, Mathilde. Tout à coup, sans aucune explication, elle s'est retournée vers lui et lui a dit qu'elle ne voulait plus le revoir. Puis il s'est mis à pleuvoir des cordes. Hugo, l'âme en peine, est rentré chez lui sous la pluie.
Arrivé dans le salon, il allume la lampe et là... catastrophe ! Tout lui rappelle sa Mathilde bien-aimée : ses bibelots sur les étagères, le lapin rose en porcelaine, sa plante carnivore, ses romans policiers, sa bougie à la vanille... Et ce portrait d'elle accroché au mur qui le regarde droit dans les yeux ! C'en est trop pour Hugo qui décide de noyer sa tristesse dans un verre de vin. Assis sur le canapé, il prend la télécommande et allume le téléviseur pour se changer les idées. Mais la fatigue de la journée ne tarde pas à le rattraper et il s'endort profondément.
Pendant ce temps, Thomas, le voleur du quartier, qui avait observé toute la scène, décide de passer à l'action. Il entre dans la maison sur la pointe des pieds et se faufile jusqu'au salon. Mais Thomas n'est pas un voleur comme les autres et, le moins qu'on puisse dire, c'est qu'il n'est pas connu pour sa discrétion ! Arrivé à la table, il se prend les pieds dans le tapis et renverse une chaise qui tombe lourdement par terre. Hugo, que ce tapage n'a pas dérangé le moins du monde, continue à ronfler sans se douter de rien. Pauvre Hugo ! pense Thomas qui s'assoit quelques instants sur le fauteuil pour réfléchir. Comment pourrais-je l'aider ? Plongé dans ses pensées, il se sert à son tour un bon verre de vin. C'est alors que lui vient une brillante idée : il n'a qu'à voler tout ce qui appartient à Mathilde, comme ça Hugo n'aura plus à penser à elle ! Aussitôt dit, aussitôt fait. Thomas se met à la tâche. Il s'empare en premier lieu du collier et de la montre démodés de Mathilde, qu'il fait disparaître en un tour de main. Ensuite, ce sera le tour de ce lapin rose en porcelaine.`;

export const QUESTIONS_PARTIE_2: QuestionTestLangue[] = [
  {
    id: "q7",
    enonce: "Pourquoi Hugo est-il triste lorsqu'il rentre chez lui ?",
    options: [
      "Il a perdu ses clés sous la pluie.",
      "Sa petite-amie a rompu avec lui sans explication.",
      "Il a découvert que sa maison a été cambriolée.",
      "Il a oublié d'éteindre la lampe du salon.",
    ],
    bonneReponse: 1,
  },
  {
    id: "q8",
    enonce: "Selon le texte, quel objet présent dans le salon rappelle Mathilde à Hugo ?",
    options: ["Un téléviseur en noir et blanc", "Un lapin rose en porcelaine", "Un vieux tapis persan", "Une collection de timbres"],
    bonneReponse: 1,
  },
  {
    id: "q9",
    enonce: "Quelle est la principale caractéristique de Thomas, le voleur ?",
    options: ["Il est extrêmement agile et silencieux.", "Il vole uniquement de l'argent liquide.", "Il manque de discrétion et fait du bruit.", "Il déteste le vin rouge."],
    bonneReponse: 2,
  },
  {
    id: "q10",
    enonce: "Selon la fin du texte, quels sont les premiers objets que Thomas décide d'emporter ?",
    options: ["Le portrait et la plante carnivore", "Le collier et la montre démodée", "Le téléviseur et la télécommande", "Les bouteilles de vin"],
    bonneReponse: 1,
  },
];

export const TOUTES_QUESTIONS: QuestionTestLangue[] = [...QUESTIONS_PARTIE_1, ...QUESTIONS_PARTIE_2];

// Barème affiché sur le formulaire — 10 questions, 1 point chacune.
export function niveauB1DepuisScore(score: number): string {
  if (score <= 3) return "Niveau B1 non atteint";
  if (score <= 6) return "Niveau B1 en cours d'acquisition";
  return "Niveau B1 acquis";
}

export function calculerScoreTestLangue(reponses: Record<string, number | undefined>): number {
  return TOUTES_QUESTIONS.reduce((total, q) => total + (reponses[q.id] === q.bonneReponse ? 1 : 0), 0);
}

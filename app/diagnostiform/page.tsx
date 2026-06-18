"use client";

import React, { useState } from "react";
import { 
  ArrowPathIcon, 
  SparklesIcon, 
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";

interface Option {
  text: string;
  points: number;
}

interface Question {
  id: number;
  text: string;
  options: Option[];
  required?: boolean;
}

const QUESTIONS_DIAGNOSTIC: Question[] = [
  {
    id: 1,
    text: "Site de réalisation du diagnostic *",
    required: true,
    options: [
      { text: "BUISSON", points: 0 },
      { text: "PICPUS", points: 0 },
      { text: "SURESNES", points: 0 }
    ]
  },
  {
    id: 2,
    text: "Est-il obligatoire de posséder une souris pour utiliser l'ordinateur ?",
    options: [
      { text: "Oui, sans souris l'ordinateur ne peut pas fonctionner.", points: 0 },
      { text: "Non, on peut utiliser un pavé tactile, un écran tactile ou des raccourcis clavier.", points: 2 },
      { text: "Je ne sais pas.", points: 0 }
    ]
  },
  {
    id: 3,
    text: "Pouvez-vous décrire ce qu'est Internet de manière simple ?",
    options: [
      { text: "C'est un logiciel installé sur mon ordinateur pour taper des textes.", points: 0 },
      { text: "C'est un immense réseau mondial qui connecte les ordinateurs entre eux pour s'échanger des informations.", points: 2 },
      { text: "C'est juste une boîte pour recevoir des e-mails.", points: 0 }
    ]
  },
  {
    id: 4,
    text: "Savez-vous de combien de caractères au minimum doit être composé un mot de passe sécurisé aujourd'hui ? *",
    required: true,
    options: [
      { text: "4 à 6 caractères simples.", points: 0 },
      { text: "Au moins 12 caractères (mélangeant majuscules, minuscules, chiffres et symboles).", points: 2 },
      { text: "Le nombre de caractères n'a aucune importance.", points: 0 }
    ]
  },
  {
    id: 5,
    text: "Un clavier est-il obligatoire quand on veut utiliser un ordinateur ?",
    options: [
      { text: "Oui, c'est le seul moyen de saisir du texte.", points: 0 },
      { text: "Non, on peut utiliser un clavier visuel sur l'écran ou la dictée vocale.", points: 2 }
    ]
  },
  {
    id: 6,
    text: "À quoi correspondent Windows, Linux et MacOs ?",
    options: [
      { text: "Des marques d'ordinateurs portables.", points: 0 },
      { text: "Des systèmes d'exploitation (le programme principal de la machine).", points: 2 },
      { text: "Des moteurs de recherche pour aller sur Internet.", points: 0 }
    ]
  },
  {
    id: 7,
    text: "Qu'est-ce que signifie le terme « session de connexion » ?",
    options: [
      { text: "C'est mon espace personnel protégé par mot de passe qui charge mes fichiers.", points: 2 },
      { text: "Ça veut dire que l'ordinateur est branché à l'électricité.", points: 0 },
      { text: "C'est le moment où l'ordinateur s'éteint.", points: 0 }
    ]
  },
  {
    id: 8,
    text: "Qu'est-ce que signifie le terme « navigateur web » ?",
    options: [
      { text: "Un site pour réserver des vacances en bateau.", points: 0 },
      { text: "Le logiciel qui permet d'ouvrir et de visiter des sites internet (ex: Chrome, Firefox).", points: 2 },
      { text: "Le programme antivirus.", points: 0 }
    ]
  },
  {
    id: 9,
    text: "Qu'est-ce que signifie le terme « moteur de recherche » ?",
    options: [
      { text: "Un site (comme Google ou Bing) qui cherche des pages web à partir de mots-clés.", points: 2 },
      { text: "Le composant qui fait du bruit dans l'ordinateur.", points: 0 },
      { text: "Un modèle de clé USB.", points: 0 }
    ]
  },
  {
    id: 10,
    text: "De quoi a-t-on besoin pour se connecter à sa boîte mail ?",
    options: [
      { text: "Uniquement du nom de l'ordinateur.", points: 0 },
      { text: "Une connexion Internet, son adresse e-mail et son mot de passe secret.", points: 2 },
      { text: "Une carte bancaire.", points: 0 }
    ]
  },
  {
    id: 11,
    text: "Qu'est-ce qu'un mot de passe et pourquoi est-il important d'en avoir un ?",
    options: [
      { text: "C'est un code secret inutile.", points: 0 },
      { text: "C'est une clé secrète qui protège mes données et mes comptes contre le piratage.", points: 2 },
      { text: "C'est une phrase obligatoire à répéter devant l'écran.", points: 0 }
    ]
  },
  {
    id: 12,
    text: "Quelles touches peut-on utiliser pour faire une majuscule ?",
    options: [
      { text: "La touche Espace ou la touche Entrée.", points: 0 },
      { text: "La touche Maj (flèche vers le haut) ou la touche Verr. Maj (cadenas).", points: 2 }
    ]
  },
  {
    id: 13,
    text: "Répondez-vous à tous les e-mails que l'on vous envoie ?",
    options: [
      { text: "Oui, par politesse il faut répondre à tout le monde.", points: 0 },
      { text: "Non, je ne réponds pas aux publicités ni aux e-mails bizarres ou suspects.", points: 2 }
    ]
  },
  {
    id: 14,
    text: "À quoi sert un dossier sur un ordinateur ?",
    options: [
      { text: "À organiser et regrouper ses fichiers pour les retrouver facilement.", points: 2 },
      { text: "À accélérer la connexion Internet.", points: 0 },
      { text: "À nettoyer les virus.", points: 0 }
    ]
  },
  {
    id: 15,
    text: "Où range-t-on les fichiers ?",
    options: [
      { text: "Dans le moteur de recherche.", points: 0 },
      { text: "Dans des dossiers sur le disque dur, sur le Bureau ou sur une clé USB.", points: 2 }
    ]
  },
  {
    id: 16,
    text: "Savez-vous comment imprimer un document depuis un ordinateur ?",
    options: [
      { text: "Non, je ne sais pas faire.", points: 0 },
      { text: "Oui, j'ouvre le fichier et je fais Fichier > Imprimer (ou Ctrl + P).", points: 2 }
    ]
  },
  {
    id: 17,
    text: "Quelle est la différence entre un clic gauche et un clic droit sur la souris ?",
    options: [
      { text: "Ils font la même chose.", points: 0 },
      { text: "Le clic gauche valide/sélectionne ; Le clic droit affiche un menu d'options (Copier, Supprimer...).", points: 2 }
    ]
  },
  {
    id: 18,
    text: "Comment créez-vous un nouveau dossier sur le bureau de l'ordinateur ?",
    options: [
      { text: "Je secoue la souris.", points: 0 },
      { text: "Clic droit sur un espace vide du bureau > Nouveau > Dossier.", points: 2 }
    ]
  },
  {
    id: 19,
    text: "Comment faites-vous pour copier un texte depuis une page web ?",
    options: [
      { text: "Je le recopie sur un papier.", points: 0 },
      { text: "Je le sélectionne à la souris, puis je fais Clic droit > Copier (ou Ctrl + C).", points: 2 }
    ]
  },
  {
    id: 20,
    text: "Quelle est la fonction d'une barre de recherche sur un navigateur web ?",
    options: [
      { text: "Elle sert à tapez des mots-clés ou l'adresse d'un site pour y aller directement.", points: 2 },
      { text: "Elle sert à recharger la batterie.", points: 0 }
    ]
  },
  {
    id: 21,
    text: "Savez-vous comment mettre à jour le système d'exploitation d'un ordinateur ?",
    options: [
      { text: "Non, je ne sais pas.", points: 0 },
      { text: "Oui, dans les Paramètres de l'ordinateur, section Mises à jour.", points: 2 }
    ]
  },
  {
    id: 22,
    text: "Savez-vous ce qu'est une clé USB et à quoi ça sert ?",
    options: [
      { text: "Un outil de stockage amovible pour transporter des fichiers d'un ordinateur à un autre.", points: 2 },
      { text: "Un câble pour charger la batterie.", points: 0 }
    ]
  },
  {
    id: 23,
    text: "Comment faites-vous pour supprimer un fichier inutile sur votre ordinateur ?",
    options: [
      { text: "Je l'éteins et je l'allume.", points: 0 },
      { text: "Clic droit sur le fichier puis 'Supprimer', ou je le glisse dans la Corbeille.", points: 2 }
    ]
  }
];

export default function DiagnosticSlider() {
  const [nomPrenom, setNomPrenom] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0); // 0 = Identité, 1 à 23 = Questions, 24 = Score final
  const [reponses, setReponses] = useState<{ [key: number]: number }>({});
  const [scoreTotal, setScoreTotal] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const totalQuestions = QUESTIONS_DIAGNOSTIC.length;
  const totalSlides = totalQuestions + 1; // Slide identité + slides questions

  const handleNext = () => {
    setErrorMsg("");

    // Validation Étape Écran d'identité (Index 0)
    if (currentIndex === 0) {
      if (!nomPrenom.trim()) {
        setErrorMsg("Le NOM et le Prénom du bénéficiaire sont obligatoires.");
        return;
      }
      setCurrentIndex(1);
      return;
    }

    // Validation Étape Question en cours
    const questionActuelle = QUESTIONS_DIAGNOSTIC[currentIndex - 1];
    if (reponses[questionActuelle.id] === undefined) {
      setErrorMsg("Veuillez sélectionner une réponse pour passer à la suite.");
      return;
    }

    if (currentIndex === totalQuestions) {
      calculerResultatFinal();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setErrorMsg("");
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSelectOption = (questionId: number, points: number) => {
    setReponses(prev => ({ ...prev, [questionId]: points }));
    setErrorMsg("");
    
    // Petit effet d'attente de 250ms pour valider visuellement la sélection avant le slide automatique
    setTimeout(() => {
      if (currentIndex < totalQuestions) {
        setCurrentIndex(prev => prev + 1);
      } else {
        const copieReponses = { ...reponses, [questionId]: points };
        let total = 0;
        Object.values(copieReponses).forEach(pts => { total += pts; });
        setScoreTotal(total);
        setCurrentIndex(totalSlides);
      }
    }, 250);
  };

  const calculerResultatFinal = () => {
    let total = 0;
    Object.values(reponses).forEach(pts => { total += pts; });
    setScoreTotal(total);
    setCurrentIndex(totalSlides);
  };

  const recommencer = () => {
    setNomPrenom("");
    setReponses({});
    setScoreTotal(null);
    setCurrentIndex(0);
    setErrorMsg("");
  };

  const getProfilSynthese = (score: number) => {
    if (score <= 14) return { label: "Débutant / Accompagnement Renforcé", color: "bg-red-500/10 text-red-400 border-red-500/20", desc: "Besoins critiques sur l'utilisation de la souris, du clavier et des notions réseau de base." };
    if (score <= 30) return { label: "Intermédiaire / En cours d'acquisition", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", desc: "Possède des bases. Doit consolider l'organisation des fichiers (arborescence) et la sécurité numérique." };
    return { label: "Autonome / Compétences Solides", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", desc: "Excellente maîtrise globale des outils numériques de base." };
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4 py-8 font-sans overflow-x-hidden">
      <div className="w-full max-w-xl space-y-4">
        
        {/* TITRE ET COMPTEUR DES CARTES */}
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Évaluation Numérique</span>
            <span className="text-sm font-bold text-slate-300">Collect.Tech Suresnes</span>
          </div>
          {currentIndex > 0 && currentIndex <= totalQuestions && (
            <span className="text-xs font-mono bg-slate-900 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-md">
              {currentIndex} / {totalQuestions}
            </span>
          )}
        </div>

        {/* MESSAGES D'ERREUR FLOTTANTS */}
        {errorMsg && (
          <div className="p-3.5 bg-red-950/40 border border-red-900 text-red-400 rounded-xl text-xs flex items-center gap-2 font-medium animate-fade-in">
            <ExclamationTriangleIcon className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* --- CONTENEUR FENÊTRE (MASQUE LES CARTES ADJACENTES) --- */}
        <div className="w-full overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 shadow-2xl backdrop-blur-md">
          
          {/* LE RAIL HORIZONTAL DE TRANSLATION */}
          <div 
            className="flex transition-transform duration-500 ease-in-out will-change-transform"
            style={{ 
              width: `${(totalSlides + (scoreTotal !== null ? 1 : 0)) * 100}%`,
              transform: `translateX(-${(currentIndex / (totalSlides + (scoreTotal !== null ? 1 : 0))) * 100}%)` 
            }}
          >
            
            {/* ÉCRAN 0 : IDENTITÉ DU BÉNÉFICIAIRE */}
            <div className="w-full p-6 md:p-8 shrink-0" style={{ width: `${100 / (totalSlides + (scoreTotal !== null ? 1 : 0))}%` }}>
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-bold text-slate-200 uppercase tracking-wide">Fiche Diagnostic initial</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Saisie des informations indispensables avant de démarrer le test coulissant.</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    NOM + Prénom du bénéficiaire <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={nomPrenom}
                    onChange={(e) => setNomPrenom(e.target.value)}
                    placeholder="Saisir la réponse..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl text-xs text-white placeholder-slate-600 outline-none transition-all"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    <span>Suivant</span>
                    <ChevronRightIcon className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                </div>
              </div>
            </div>

            {/* ÉCRANS 1 À 23 : LES QUESTIONS EN LIGNE DROITE */}
            {QUESTIONS_DIAGNOSTIC.map((q, qIdx) => (
              <div 
                key={q.id} 
                className="w-full p-6 md:p-8 shrink-0 flex flex-col justify-between" 
                style={{ width: `${100 / (totalSlides + (scoreTotal !== null ? 1 : 0))}%` }}
              >
                <div className="space-y-5">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide leading-relaxed">
                    {q.text}
                  </h3>

                  <div className="space-y-2.5">
                    {q.options.map((opt, idx) => {
                      const estSelectionne = reponses[q.id] === opt.points;
                      return (
                        <div
                          key={idx}
                          onClick={() => handleSelectOption(q.id, opt.points)}
                          className={`w-full p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between group ${
                            estSelectionne 
                              ? "bg-indigo-950/30 border-indigo-500 text-indigo-300" 
                              : "bg-slate-950 border-slate-800/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900/30"
                          }`}
                        >
                          <span className="text-xs font-medium leading-relaxed pr-3">{opt.text}</span>
                          <div className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                            estSelectionne ? "border-indigo-500 bg-indigo-500" : "border-slate-700 group-hover:border-slate-500"
                          }`}>
                            {estSelectionne && <CheckCircleIcon className="w-3.5 h-3.5 text-white stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* BARRE D'ACTIONS INFÉRIEURE */}
                <div className="flex items-center justify-between pt-5 mt-6 border-t border-slate-800/50">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <ChevronLeftIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                    Retour
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    <span>{qIdx === totalQuestions - 1 ? "Envoyer" : "Suivant"}</span>
                    <ChevronRightIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            ))}

            {/* ÉCRAN 24 : SCORE FINAL ET ANALYSE */}
            {scoreTotal !== null && (
              <div className="w-full p-6 md:p-8 shrink-0 text-center space-y-5" style={{ width: `${100 / (totalSlides + 1)}%` }}>
                <div className="space-y-1.5">
                  <div className="inline-flex p-2.5 bg-indigo-500/10 rounded-full text-indigo-400 border border-indigo-500/20 mb-1">
                    <SparklesIcon className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold uppercase text-slate-200 tracking-wide">Évaluation Terminée</h2>
                  <p className="text-xs text-slate-500">Bénéficiaire : <span className="text-slate-300 font-bold">{nomPrenom}</span></p>
                </div>
                
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl py-5 max-w-[240px] mx-auto">
                  <span className="text-5xl font-black text-white font-mono tracking-tight">{scoreTotal}</span>
                  <span className="text-slate-600 text-xs font-bold block mt-0.5 uppercase tracking-widest">sur 44 points</span>
                </div>

                <div className={`p-4 border rounded-xl text-left max-w-sm mx-auto ${getProfilSynthese(scoreTotal).color}`}>
                  <p className="text-[9px] uppercase font-bold tracking-widest mb-0.5 opacity-60">Profil Synthèse :</p>
                  <p className="font-bold text-xs mb-1">{getProfilSynthese(scoreTotal).label}</p>
                  <p className="text-[11px] leading-relaxed opacity-80">{getProfilSynthese(scoreTotal).desc}</p>
                </div>

                <button
                  type="button"
                  onClick={recommencer}
                  className="w-full max-w-sm py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors border border-slate-700 shadow-sm"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5 inline-block mr-2" />
                  Saisir un autre questionnaire
                </button>
              </div>
            )}

          </div>
        </div>

        {/* PETITE BARRE DE PROGRESSION DISCRETE TOUT EN BAS */}
        {scoreTotal === null && currentIndex > 0 && (
          <div className="w-full bg-slate-900 border border-slate-800 h-1 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${(currentIndex / totalQuestions) * 100}%` }}
            ></div>
          </div>
        )}

      </div>
    </main>
  );
}
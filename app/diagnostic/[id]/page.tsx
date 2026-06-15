"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import Link from "next/link";
import { 
  ArrowLeftIcon, 
  CheckCircleIcon, 
  ClipboardDocumentCheckIcon, 
  SparklesIcon, 
  AcademicCapIcon,
  FaceSmileIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  DocumentTextIcon
} from "@heroicons/react/24/outline";

// --- RÉFÉRENTIEL DES QUESTIONS DU QCM ---
const QUESTIONS_BUREAUTIQUE = [
  {
    id: "q1",
    question: "Laquelle de ces propositions n'est pas une suite bureautique ?",
    options: ["Microsoft Office", "LibreOffice", "Google Workspace", "Adobe Creative Cloud"],
    correct: "Adobe Creative Cloud"
  },
  {
    id: "q2",
    question: "Laquelle de ces propositions n'est pas un logiciel de traitement de texte ?",
    options: ["Microsoft Word", "Google Sheets", "LibreOffice Writer", "Pages"],
    correct: "Google Sheets"
  },
  {
    id: "q3",
    question: "Qu'est-ce qu'un tableur ?",
    options: [
      "Un logiciel pour faire des montages vidéo",
      "Un logiciel de traitement de texte",
      "Un logiciel permettant de créer et manipuler des tableaux, des calculs et des graphiques",
      "Un outil de navigation internet"
    ],
    correct: "Un logiciel permettant de créer et manipuler des tableaux, des calculs et des graphiques"
  },
  {
    id: "q4",
    question: "Qu'est-il conseillé d'écrire au début d'un nom de fichier lorsqu'on le nomme ?",
    options: ["La date au format AAAAMMJJ (ex: 20260615)", "Son prénom", "Le mot 'Fichier'", "Des caractères spéciaux (@#?!)"],
    correct: "La date au format AAAAMMJJ (ex: 20260615)"
  },
  {
    id: "q5",
    question: "Qu'est-il important de faire lorsqu'on nomme un dossier ?",
    options: [
      "Mettre le nom le plus long possible",
      "Utiliser un nom clair, court et explicite sans accents ni espaces complexes",
      "Ajouter des émojis partout",
      "Ne jamais mettre de majuscules"
    ],
    correct: "Utiliser un nom clair, court et explicite sans accents ni espaces complexes"
  },
  {
    id: "q6",
    question: "Quel est l'un des avantages de Google Docs ou Google Sheets ?",
    options: [
      "Ils fonctionnent sans aucune connexion internet à la première ouverture",
      "Ils permettent la collaboration en temps réel et la sauvegarde automatique sur le Cloud",
      "Ils sont payants et réservés aux professionnels",
      "Ils s'installent obligatoirement par CD-ROM"
    ],
    correct: "Ils permettent la collaboration en temps réel et la sauvegarde automatique sur le Cloud"
  },
  {
    id: "q7",
    question: "Quelle icône dans une barre d'outils permet d'écrire du texte en gras ?",
    options: ["L'icône 'I' ", "L'icône 'G' ou 'B' ", "L'icône 'S' ", "L'icône du surligneur"],
    correct: "L'icône 'G' ou 'B' (Bold / Gras)"
  },
  {
    id: "q8",
    question: "Quelle icône permet de sauvegarder un document ?",
    options: ["Une disquette", "Un dossier ouvert", "Une imprimante", "Une loupe"],
    correct: "Une disquette"
  },
  {
    id: "q9",
    question: "Quelle est l'adresse d'une cellule dans un tableur ?",
    options: ["Le numéro de la ligne uniquement (ex: 12)", "La lettre de la colonne suivie du numéro de ligne (ex: B4)", "Le nom de l'onglet", "Une adresse URL"],
    correct: "La lettre de la colonne suivie du numéro de ligne (ex: B4)"
  },
  {
    id: "q10",
    question: "Pour quelle raison faut-il figer une ligne ou une colonne dans un tableur ?",
    options: [
      "Pour empêcher toute modification des données par un autre utilisateur",
      "Pour garder les entêtes visibles lorsque l'on fait défiler un grand tableau",
      "Pour changer la couleur de la police automatiquement",
      "Pour supprimer les lignes vides"
    ],
    correct: "Pour garder les entêtes visibles lorsque l'on fait défiler un grand tableau"
  }
];

export default function FormulaireDiagnostic() {
  const params = useParams();
  const router = useRouter();
  const idUsager = params.id as string;

  // Données de l'usager
  const [usager, setUsager] = useState<{ nom: string; prenom: string } | null>(null);
  
  // Étape générale (1 = Choix du type, 2 = Le questionnaire)
  const [etape, setEtape] = useState<number>(1);
  const [typeQuestionnaire, setTypeQuestionnaire] = useState<string>(""); 
  const [loading, setLoading] = useState<boolean>(false);

  // Index de la question courante pour le mode flottant
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);

  // Réponses du formulaire
  const [reponsesQCM, setReponsesQCM] = useState<{ [key: string]: string }>({});
  const [satisfactionGlobale, setSatisfactionGlobale] = useState<number>(5);
  const [satisfactionSupports, setSatisfactionSupports] = useState<number>(5);
  const [appreciations, setAppreciations] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string>("");
  const [commentairesPerso, setCommentairesPerso] = useState<string>("");

  // Récupération de l'identité de l'usager
  useEffect(() => {
    const fetchUsager = async () => {
      try {
        const docRef = doc(db, "utilisateurs", idUsager);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUsager({
            nom: (data.Nom || "").toUpperCase(),
            prenom: data.Prénom || data.prenom || ""
          });
        }
      } catch (err) {
        console.error("Erreur récupération usager:", err);
      }
    };
    if (idUsager) fetchUsager();
  }, [idUsager]);

  const handleCheckboxChange = (value: string) => {
    setAppreciations(prev => 
      prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
    );
  };

  // Soumission et calcul automatique du Score + Report sur la fiche
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let scoreFinal = 0;
      let compteRenduAutomatique = "";

      if (typeQuestionnaire !== "Satisfaction") {
        // 1. Calcul automatique des bonnes réponses
        QUESTIONS_BUREAUTIQUE.forEach((q, idx) => {
          const reponseUsager = reponsesQCM[q.id];
          const estCorrect = reponseUsager === q.correct;
          if (estCorrect) scoreFinal++;

          compteRenduAutomatique += `Q${idx + 1}: ${estCorrect ? "✅ Réussi" : "❌ Échoué"} (${reponseUsager || "Pas de réponse"})\n`;
        });
      }
      
      // 2. Construction des notes globales pour la fiche bénéficiaire
      let notesDetails = "";
      if (typeQuestionnaire !== "Satisfaction") {
        notesDetails = `*** BILAN AUTOMATIQUE DU QCM ***\nScore : ${scoreFinal} / ${QUESTIONS_BUREAUTIQUE.length}\n\n${compteRenduAutomatique}`;
        if (commentairesPerso.trim()) {
          notesDetails += `\nObservations du conseiller :\n${commentairesPerso}`;
        }
      } else {
        notesDetails = `*** SATISFACTION ***\nNote globale: ${satisfactionGlobale}/5\nSupports: ${satisfactionSupports}/5\nSuggestions: ${suggestions || "Aucune"}`;
      }

      const payload: any = {
        moment: typeQuestionnaire === "Initial" ? "Diagnostic Initial" : typeQuestionnaire === "Final" ? "Diagnostic Final" : "Questionnaire de satisfaction",
        date: new Date().toLocaleDateString('en-CA'),
        thematique: "Ordinateur & Bureautique",
        statut: "Présent",
        details: notesDetails.trim(), // Se déverse directement dans l'historique de la fiche
        timestamp: new Date()
      };

      if (typeQuestionnaire === "Initial" || typeQuestionnaire === "Final") {
        payload.reponses = reponsesQCM;
        payload.score = `${scoreFinal} / ${QUESTIONS_BUREAUTIQUE.length}`;
      } else {
        payload.satisfaction = {
          evaluationGlobale: satisfactionGlobale,
          clarteSupports: satisfactionSupports,
          pointsApprecies: appreciations,
          suggestions: suggestions
        };
      }

      await addDoc(collection(db, "utilisateurs", idUsager, "visites"), payload);

      alert("Formulaire enregistré et score calculé avec succès !");
      router.push("/suresnes"); 
    } catch (error) {
      console.error("Erreur lors de la sauvegarde :", error);
      alert("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  if (!usager) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center text-xs">Chargement du profil usager...</div>;
  }

  // Variables pour la barre de progression
  const totalQuestions = QUESTIONS_BUREAUTIQUE.length;
  const progressionPourcentage = typeQuestionnaire !== "Satisfaction" 
    ? ((currentQuestionIndex + 1) / totalQuestions) * 100 
    : 100;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans antialiased">
      <div className="max-w-xl mx-auto">
        
        {/* EN-TÊTE */}
        <div className="mb-6">
          <Link href="/suresnes" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mb-4">
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span>Retour au planning</span>
          </Link>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex justify-between items-center">
            <div>
              <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest bg-purple-950/40 border border-purple-900 px-2 py-0.5 rounded">
                {typeQuestionnaire ? `QCM : ${typeQuestionnaire}` : "Évaluation Bureautique"}
              </span>
              <h1 className="text-base font-bold mt-1 text-white">
                {usager.prenom} {usager.nom}
              </h1>
            </div>
            {typeQuestionnaire && typeQuestionnaire !== "Satisfaction" && etape === 2 && (
              <div className="text-right">
                <span className="text-xs font-mono text-purple-400 font-bold bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                  {currentQuestionIndex + 1} / {totalQuestions}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* FORMULAIRE ÉTAPE PAR ÉTAPE */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* ÉTAPE 1 : CHOIX DU TYPE */}
          {etape === 1 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Sélectionner le type d'évaluation
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {[
                  { id: "Initial", label: "Auto-diagnostic initial (Début)", desc: "Évaluer le niveau initial de l'usager.", icon: AcademicCapIcon },
                  { id: "Final", label: "Auto-diagnostic final (Fin)", desc: "Mesurer les compétences acquises.", icon: ClipboardDocumentCheckIcon },
                  { id: "Satisfaction", label: "Questionnaire de satisfaction", desc: "Recueillir le ressenti de l'usager.", icon: FaceSmileIcon }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTypeQuestionnaire(t.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      typeQuestionnaire === t.id 
                        ? "bg-purple-950/30 border-purple-600 ring-1 ring-purple-600" 
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <t.icon className={`w-5 h-5 ${typeQuestionnaire === t.id ? "text-purple-400" : "text-slate-500"}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-200">{t.label}</div>
                      <div className="text-[10px] text-slate-500">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={!typeQuestionnaire}
                  onClick={() => { setEtape(2); setCurrentQuestionIndex(0); }}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Démarrer le questionnaire
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 : REPRÉSENTATION FLOTTANTE */}
          {etape === 2 && (
            <div className="space-y-4">
              
              {/* BARRE DE PROGRESSION FLOTTANTE */}
              <div className="w-full bg-slate-900 rounded-full h-1.5 border border-slate-800 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-purple-600 to-indigo-500 h-1.5 transition-all duration-300" 
                  style={{ width: `${progressionPourcentage}%` }}
                />
              </div>

              {/* CAS DU DIAGNOSTIC INITIAL OU FINAL (Mode 1 Question à la fois) */}
              {(typeQuestionnaire === "Initial" || typeQuestionnaire === "Final") && (
                <div className="space-y-4">
                  {QUESTIONS_BUREAUTIQUE.map((q, qIndex) => {
                    // Masquer toutes les questions sauf celle en cours
                    if (qIndex !== currentQuestionIndex) return null;

                    return (
                      <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl min-h-[250px] flex flex-col justify-between">
                        <div className="space-y-3">
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Question en cours</span>
                          <h2 className="text-sm font-bold text-white leading-relaxed">
                            {q.question}
                          </h2>
                        </div>

                        <div className="grid grid-cols-1 gap-2 pt-2">
                          {q.options.map((option) => {
                            const isSelected = reponsesQCM[q.id] === option;
                            return (
                              <label 
                                key={option} 
                                className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected 
                                    ? "bg-purple-950/20 border-purple-500 text-white font-semibold ring-1 ring-purple-500" 
                                    : "bg-slate-950 border-slate-850 hover:bg-slate-900 text-slate-400"
                                }`}
                              >
                                <input 
                                  type="radio" 
                                  name={q.id} 
                                  checked={isSelected}
                                  onChange={() => setReponsesQCM(prev => ({ ...prev, [q.id]: option }))}
                                  className="text-purple-600 focus:ring-0 bg-slate-950 border-slate-800 w-4 h-4"
                                />
                                <span>{option}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* NAVIGATION DU MODE FLOTTANT */}
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      disabled={currentQuestionIndex === 0}
                      onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                      Précédent
                    </button>

                    {currentQuestionIndex < totalQuestions - 1 ? (
                      <button
                        type="button"
                        disabled={!reponsesQCM[QUESTIONS_BUREAUTIQUE[currentQuestionIndex].id]}
                        onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                        className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-40 transition-all cursor-pointer shadow"
                      >
                        Suivant
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>
                    ) : (
                      // Section finale une fois la dernière question atteinte : zone de commentaires libres du conseiller
                      <div className="w-full bg-slate-900/40 border border-slate-800 rounded-xl p-4 mt-2 space-y-3">
                        <label className="text-xs font-bold text-slate-300 block">
                          Observations complémentaires (Optionnel)
                        </label>
                        <textarea
                          value={commentairesPerso}
                          onChange={(e) => setCommentairesPerso(e.target.value)}
                          placeholder="Ajoutez vos notes d'entretien ici... Elles accompagneront le score automatiquement généré."
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-purple-600 transition-colors resize-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CAS COMPLÉMENTAIRE : SATISFACTION (Reste global car plus court) */}
              {typeQuestionnaire === "Satisfaction" && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
                  <div>
                    <label className="text-xs font-bold text-slate-200 block">Appréciation globale des ateliers</label>
                    <div className="flex gap-1.5 pt-2 justify-center">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSatisfactionGlobale(num)}
                          className={`w-9 h-9 rounded-xl border text-xs font-black transition-all ${
                            satisfactionGlobale === num ? "bg-purple-600 border-purple-500 text-white" : "bg-slate-950 border-slate-850 text-slate-400"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-200 block">Clarté des supports mémo</label>
                    <div className="flex gap-1.5 pt-2 justify-center">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSatisfactionSupports(num)}
                          className={`w-9 h-9 rounded-xl border text-xs font-black transition-all ${
                            satisfactionSupports === num ? "bg-purple-600 border-purple-500 text-white" : "bg-slate-950 border-slate-850 text-slate-400"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-200 block">Des suggestions ?</label>
                    <textarea
                      value={suggestions}
                      onChange={(e) => setSuggestions(e.target.value)}
                      placeholder="Vos suggestions d'amélioration..."
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-slate-700 transition-colors resize-none"
                    />
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS DE FIN (Affiché si QCM fini ou Satisfaction sélectionné) */}
              {(typeQuestionnaire === "Satisfaction" || currentQuestionIndex === totalQuestions - 1) && (
                <div className="pt-4 border-t border-slate-900 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setEtape(1)}
                    className="text-xs font-medium text-slate-500 hover:text-white transition-colors cursor-pointer"
                  >
                    Changer de questionnaire
                  </button>
                  
                  <button
                    type="submit"
                    disabled={loading || (typeQuestionnaire !== "Satisfaction" && !reponsesQCM[QUESTIONS_BUREAUTIQUE[currentQuestionIndex].id])}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/20"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>{loading ? "Calcul & Enregistrement..." : "Terminer et Enregistrer"}</span>
                  </button>
                </div>
              )}

            </div>
          )}

        </form>
      </div>
    </main>
  );
}
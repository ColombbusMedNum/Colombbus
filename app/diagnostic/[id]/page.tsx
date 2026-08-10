"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase"; 
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { 
  ArrowLeftIcon, 
  CheckCircleIcon, 
  ClipboardDocumentCheckIcon, 
  AcademicCapIcon,
  FaceSmileIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  WrenchScrewdriverIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

// Police Quicksand identique à la liste bénéficiaires
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// --- RÉFÉRENTIEL DES QUESTIONS DU QCM (BUREAUTIQUE STANDARD) ---
const QUESTIONS_BUREAUTIQUE = [
  { id: "q1", question: "Laquelle de ces propositions n'est pas une suite bureautique ?", options: ["Microsoft Office", "LibreOffice", "Google Workspace", "Adobe Creative Cloud"], correct: "Adobe Creative Cloud" },
  { id: "q2", question: "Laquelle de ces propositions n'est pas un logiciel de traitement de texte ?", options: ["Microsoft Word", "Google Sheets", "LibreOffice Writer", "Pages"], correct: "Google Sheets" },
  { id: "q3", question: "Qu'est-ce qu'un tableur ?", options: ["Un logiciel pour faire des montages vidéo", "Un logiciel de traitement de texte", "Un logiciel permettant de créer et manipuler des tableaux, des calculs et des graphiques", "Un outil de navigation internet"], correct: "Un logiciel permettant de créer et manipuler des tableaux, des calculs et des graphiques" },
  { id: "q4", question: "Qu'est-il conseillé d'écrire au début d'un nom de fichier lorsqu'on le nomme ?", options: ["La date au format AAAAMMJJ (ex: 20260615)", "Son prénom", "Le mot 'Fichier'", "Des caractères spéciaux (@#?!)"], correct: "La date au format AAAAMMJJ (ex: 20260615)" },
  { id: "q5", question: "Qu'est-il important de faire lorsqu'on nomme un dossier ?", options: ["Mettre le nom le plus long possible", "Utiliser un nom clair, court et explicite sans accents ni espaces complexes", "Ajouter des émojis partout", "Ne jamais mettre de majuscules"], correct: "Utiliser un nom clair, court et explicite sans accents ni espaces complexes" },
  { id: "q6", question: "Quel est l'un des avantages de Google Docs ou Google Sheets ?", options: ["Ils fonctionnent sans aucune connexion internet à la première ouverture", "Ils permettent la collaboration en temps réel et la sauvegarde automatique sur le Cloud", "Ils sont payants et réservés aux professionnels", "Ils s'installent obligatoirement par CD-ROM"], correct: "Ils permettent la collaboration en temps réel et la sauvegarde automatique sur le Cloud" },
  { id: "q7", question: "Quelle icône dans une barre d'outils permet d'écrire du texte en gras ?", options: ["L'icône 'I' ", "L'icône 'G' ou 'B' ", "L'icône 'S' ", "L'icône du surligneur"], correct: "L'icône 'G' ou 'B' " },
  { id: "q8", question: "Quelle icône permet de sauvegarder un document ?", options: ["Une disquette", "Un dossier ouvert", "Une imprimante", "Une loupe"], correct: "Une disquette" },
  { id: "q9", question: "Quelle est l'adresse d'une cellule dans un tableur ?", options: ["Le numéro de la ligne uniquement (ex: 12)", "La lettre de la colonne suivie du numéro de ligne (ex: B4)", "Le nom de l'onglet", "Une adresse URL"], correct: "La lettre de la colonne suivie du numéro de ligne (ex: B4)" },
  { id: "q10", question: "Pour quelle raison faut-il figer une ligne ou une colonne dans un tableur ?", options: ["Pour empêcher toute modification des données par un autre utilisateur", "Pour garder les entêtes visibles lorsque l'on fait défiler un grand tableau", "Pour changer la couleur de la police automatiquement", "Pour supprimer les lignes vides"], correct: "Pour garder les entêtes visibles lorsque l'on fait défiler un grand tableau" }
];

// --- RÉFÉRENTIEL DES 23 QUESTIONS DIAGNOSTIC COLLECTE TECH ---
interface OptionCollecte { text: string; points: number; }
interface QuestionCollecte { id: string; question: string; options: OptionCollecte[]; }

const QUESTIONS_COLLECTE_TECH: QuestionCollecte[] = [
  { id: "ct1", question: "Site de réalisation du diagnostic *", options: [{ text: "BUISSON", points: 0 }, { text: "PICPUS", points: 0 }, { text: "SURESNES", points: 0 }] },
  { id: "ct2", question: "Est-il obligatoire de posséder une souris pour utiliser l'ordinateur ?", options: [{ text: "Oui, sans souris l'ordinateur ne peut pas fonctionner.", points: 0 }, { text: "Non, on peut utiliser un pavé tactile, un écran tactile ou des raccourcis clavier.", points: 2 }, { text: "Je ne sais pas.", points: 0 }] },
  { id: "ct3", question: "Pouvez-vous décrire ce qu'est Internet de manière simple ?", options: [{ text: "C'est un logiciel installé sur mon ordinateur pour tapez des textes.", points: 0 }, { text: "C'est un immense réseau mondial qui connecte les ordinateurs entre eux pour s'échanger des informations.", points: 2 }, { text: "C'est juste une boîte pour recevoir des e-mails.", points: 0 }] },
  { id: "ct4", question: "Savez-vous de combien de caractères au minimum doit être composé un mot de passe sécurisé aujourd'hui ? *", options: [{ text: "4 à 6 caractères simples.", points: 0 }, { text: "Au moins 12 caractères (mélangeant majuscules, minuscules, chiffres et symboles).", points: 2 }, { text: "Le nombre de caractères n'a aucune importance.", points: 0 }] },
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
  { id: "ct23", question: "Comment faites-vous pour supprimer un fichier inutile sur votre ordinateur ?", options: [{ text: "Je l'éteins et je l'allume.", points: 0 }, { text: "Clic droit sur le fichier puis 'Supprimer', ou je le glisse dans la Corbeille.", points: 2 }] }
];

export default function FormulaireDiagnostic() {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  const idUsager = searchParams.get("id") as string; 

  const [usager, setUsager] = useState<{ nom: string; prenom: string } | null>(null);
  const [etape, setEtape] = useState<number>(1);
  const [typeQuestionnaire, setTypeQuestionnaire] = useState<string>(""); 
  const [loading, setLoading] = useState<boolean>(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);

  const [reponsesQCM, setReponsesQCM] = useState<{ [key: string]: string }>({});
  const [reponsesCollecte, setReponsesCollecte] = useState<{ [key: string]: number }>({});
  
  const [satisfactionGlobale, setSatisfactionGlobale] = useState<number>(5);
  const [satisfactionSupports, setSatisfactionSupports] = useState<number>(5);
  const [appreciations, setAppreciations] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string>("");
  const [commentairesPerso, setCommentairesPerso] = useState<string>("");

  useEffect(() => {
    const fetchUsager = async () => {
      if (!idUsager) return;
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
    fetchUsager();
  }, [idUsager]);

  const isModeQCMClassic = typeQuestionnaire === "Initial" || typeQuestionnaire === "Final";
  const isModeCollecteTech = typeQuestionnaire === "CollecteTech";

  let totalQuestions = 0;
  if (isModeQCMClassic) totalQuestions = QUESTIONS_BUREAUTIQUE.length;
  if (isModeCollecteTech) totalQuestions = QUESTIONS_COLLECTE_TECH.length;

  const progressionPourcentage = totalQuestions > 0 
    ? ((currentQuestionIndex + 1) / totalQuestions) * 100 
    : 100;

  const questionEnCoursA_Reponse = isModeQCMClassic
    ? !!reponsesQCM[QUESTIONS_BUREAUTIQUE[currentQuestionIndex]?.id]
    : isModeCollecteTech
      ? reponsesCollecte[QUESTIONS_COLLECTE_TECH[currentQuestionIndex]?.id] !== undefined
      : false;

  const handleDemarrer = () => {
    setCurrentQuestionIndex(0);
    if (isModeCollecteTech) setReponsesCollecte({});
    if (isModeQCMClassic) setReponsesQCM({});
    setCommentairesPerso("");
    setEtape(2);
  };

  const handleAnnulerOuRetour = () => {
    if (idUsager) {
      router.push(`/liste-beneficiaires/${idUsager}`);
    } else {
      router.push("/liste-beneficiaires");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idUsager) return alert("Erreur : Aucun bénéficiaire sélectionné.");
    setLoading(true);

    try {
      let notesDetails = "";
      let momentLabel = "";
      let payloadScore = "";

      if (isModeQCMClassic) {
        let scoreFinal = 0;
        let compteRenduAutomatique = "";

        QUESTIONS_BUREAUTIQUE.forEach((q, idx) => {
          const reponseUsager = reponsesQCM[q.id];
          const estCorrect = reponseUsager === q.correct;
          if (estCorrect) scoreFinal++;
          compteRenduAutomatique += `Q${idx + 1}: ${estCorrect ? "✅ Réussi" : "❌ Échoué"} (${reponseUsager || "Pas de réponse"})\n`;
        });

        momentLabel = typeQuestionnaire === "Initial" ? "Diagnostic Initial" : "Diagnostic Final";
        payloadScore = `${scoreFinal} / ${QUESTIONS_BUREAUTIQUE.length}`;
        notesDetails = `*** BILAN AUTOMATIQUE DU QCM ***\nScore : ${payloadScore}\n\n${compteRenduAutomatique}`;
        if (commentairesPerso.trim()) {
          notesDetails += `\nObservations du conseiller :\n${commentairesPerso}`;
        }

      } else if (isModeCollecteTech) {
        let pointsTotal = 0;
        Object.values(reponsesCollecte).forEach(pts => { pointsTotal += pts; });

        let profilLabel = "";
        let profilDesc = "";
        if (pointsTotal <= 14) {
          profilLabel = "Débutant / Accompagnement Renforcé";
          profilDesc = "Besoins critiques sur l'utilisation de la souris, du clavier et des notions réseau de base.";
        } else if (pointsTotal <= 30) {
          profilLabel = "Intermédiaire / En cours d'acquisition";
          profilDesc = "Possède des bases opérationnelles. Doit consolider la gestion de l'arborescence des fichiers et la sécurité.";
        } else {
          profilLabel = "Autonome / Compétences Solides";
          profilDesc = "Excellente maîtrise globale des outils informatiques d'usage courant.";
        }

        momentLabel = "Collecte Tech";
        payloadScore = `${pointsTotal} / 44`;
        notesDetails = `SYNTHÈSE DU DIAGNOSTIC COLLECTE TECH :\n• Profil déduit : ${profilLabel}\n• Analyse : ${profilDesc}\n• Score global : ${payloadScore}`;
        if (commentairesPerso.trim()) {
          notesDetails += `\n\nObservations du conseiller :\n${commentairesPerso}`;
        }

      } else if (typeQuestionnaire === "Satisfaction") {
        momentLabel = "Questionnaire de satisfaction";
        notesDetails = `*** SATISFACTION ***\nNote globale: ${satisfactionGlobale}/5\nSupports: ${satisfactionSupports}/5\nSuggestions: ${suggestions || "Aucune"}`;
      }

      const payload: any = {
        moment: momentLabel,
        date: new Date().toLocaleDateString('en-CA'),
        thematique: isModeCollecteTech ? "Numérique" : "Ordinateur & Bureautique",
        statut: "Présent",
        details: notesDetails.trim(), 
        timestamp: new Date()
      };

      if (isModeQCMClassic) {
        payload.reponses = reponsesQCM;
        payload.score = payloadScore;
      } else if (isModeCollecteTech) {
        payload.reponses = reponsesCollecte;
        payload.score = payloadScore;
      } else if (typeQuestionnaire === "Satisfaction") {
        payload.satisfaction = {
          evaluationGlobale: satisfactionGlobale,
          clarteSupports: satisfactionSupports,
          pointsApprecies: appreciations,
          suggestions: suggestions
        };
      }

      await addDoc(collection(db, "utilisateurs", idUsager, "visites"), payload);

      alert("Formulaire enregistré avec succès !");
      router.push(`/liste-beneficiaires/${idUsager}`); 
    } catch (error) {
      console.error("Erreur lors de la sauvegarde :", error);
      alert("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  if (!idUsager) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#00383d] flex items-center justify-center text-[#F9C44E] font-bold tracking-widest text-xs uppercase antialiased`}>
        Erreur : Aucun bénéficiaire fourni dans l'URL.
      </div>
    );
  }

  if (!usager) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#00383d] flex items-center justify-center text-[#F9C44E] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement du profil usager...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_diagnostic_detail">
    <main className={`${quicksand.className} min-h-screen bg-[#00383d] text-slate-100 p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      
      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#F9C44E]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-xl mx-auto relative z-10">
        
        {/* EN-TÊTE DE NAVIGATION & INFORMATIONS USAGER */}
        <div className="mb-6 space-y-4">
          <div className="flex justify-between items-center">
            <Link 
              href={`/liste-beneficiaires/${idUsager}`}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-[#F9C44E] transition-colors cursor-pointer uppercase tracking-wider"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#F9C44E]" />
              <span>Retour au profil</span>
            </Link>

            <button 
              type="button"
              onClick={handleAnnulerOuRetour}
              className="text-slate-400 hover:text-[#EF736A] p-1.5 rounded-xl bg-[#005259] hover:bg-[#005259]/80 border border-white/10 transition-all cursor-pointer"
              title="Annuler et quitter"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-[#005259] border border-[#404040]/40 rounded-2xl p-5 shadow-xl flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#F9C44E] rounded-full shadow-[0_0_15px_rgba(249,196,78,0.5)]"></div>
              <div>
                <span className="text-[10px] font-bold text-[#F9C44E] uppercase tracking-widest bg-[#00383d] border border-[#F9C44E]/30 px-2.5 py-0.5 rounded-full">
                  {typeQuestionnaire ? `Type : ${typeQuestionnaire}` : "Évaluation Colombbus"}
                </span>
                <h1 className="text-lg font-bold mt-1 text-white uppercase tracking-tight">
                  {usager.prenom} <span className="text-[#F9C44E]">{usager.nom}</span>
                </h1>
              </div>
            </div>
            {(isModeQCMClassic || isModeCollecteTech) && etape === 2 && totalQuestions > 0 && (
              <div className="text-right">
                <span className="text-xs font-bold text-[#00383d] bg-[#F9C44E] px-3 py-1 rounded-xl shadow-md">
                  {currentQuestionIndex + 1} / {totalQuestions}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* FORMULAIRE ÉTAPE PAR ÉTAPE */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* ÉTAPE 1 : CHOIX DU TYPE DE QUESTIONNAIRE */}
          {etape === 1 && (
            <div className="bg-[#005259] border border-[#404040]/40 rounded-2xl p-6 space-y-5 shadow-xl">
              <label className="block text-xs font-bold uppercase tracking-widest text-[#F9C44E]">
                Sélectionner le type d'évaluation
              </label>
              
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: "Initial", label: "Auto-diagnostic initial (Début)", desc: "Évaluer le niveau initial de l'usager.", icon: AcademicCapIcon },
                  { id: "Final", label: "Auto-diagnostic final (Fin)", desc: "Mesurer les compétences acquises.", icon: ClipboardDocumentCheckIcon },
                  { id: "Satisfaction", label: "Questionnaire de satisfaction", desc: "Recueillir le ressenti de l'usager.", icon: FaceSmileIcon },
                  { id: "CollecteTech", label: "Collecte Tech", desc: "Diagnostic d'inclusion numérique Collect.Tech (23 Questions - 44 Pts).", icon: WrenchScrewdriverIcon }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTypeQuestionnaire(t.id)}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      typeQuestionnaire === t.id 
                        ? "bg-[#00383d] border-[#F9C44E] shadow-md ring-1 ring-[#F9C44E]/50" 
                        : "bg-[#005259] border-white/10 hover:border-white/30 hover:bg-[#00383d]/40"
                    }`}
                  >
                    <t.icon className={`w-5 h-5 ${typeQuestionnaire === t.id ? "text-[#F9C44E]" : "text-slate-400"}`} />
                    <div>
                      <div className={`text-xs font-bold uppercase tracking-wider ${typeQuestionnaire === t.id ? "text-[#F9C44E]" : "text-slate-200"}`}>{t.label}</div>
                      <div className="text-[11px] text-slate-300 font-medium">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-3 flex justify-between items-center border-t border-white/10">
                <button
                  type="button"
                  onClick={handleAnnulerOuRetour}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white border border-white/10 hover:bg-[#00383d] transition-all cursor-pointer uppercase tracking-wider"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  disabled={!typeQuestionnaire}
                  onClick={handleDemarrer}
                  className="bg-[#F9945D] hover:bg-[#EF736A] text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-30 uppercase tracking-wider"
                >
                  Démarrer
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 : QUESTIONNAIRE EN ACTION */}
          {etape === 2 && (
            <div className="space-y-4">
              
              {/* BARRE DE PROGRESSION */}
              {(isModeQCMClassic || isModeCollecteTech) && totalQuestions > 0 && (
                <div className="w-full bg-[#00383d] rounded-full h-2.5 border border-white/10 p-0.5 overflow-hidden shadow-inner">
                  <div 
                    className="bg-[#F9C44E] h-full transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(249,196,78,0.5)]" 
                    style={{ width: `${progressionPourcentage}%` }}
                  />
                </div>
              )}

              {/* QCM BUREAUTIQUE STANDARD */}
              {isModeQCMClassic && (
                <div className="space-y-4">
                  {QUESTIONS_BUREAUTIQUE.map((q, qIndex) => {
                    if (qIndex !== currentQuestionIndex) return null;

                    return (
                      <div key={q.id} className="bg-[#005259] border border-[#404040]/40 rounded-2xl p-6 space-y-5 shadow-xl min-h-[260px] flex flex-col justify-between">
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-[#F9C44E] uppercase tracking-widest bg-[#00383d] px-2.5 py-1 rounded border border-[#F9C44E]/30">
                            Question en cours
                          </span>
                          <h2 className="text-sm font-bold text-white leading-relaxed pt-2">{q.question}</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 pt-2">
                          {q.options.map((option) => {
                            const isSelected = reponsesQCM[q.id] === option;
                            return (
                              <label 
                                key={option} 
                                className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected 
                                    ? "bg-[#00383d] border-[#F9C44E] text-[#F9C44E] font-bold ring-1 ring-[#F9C44E]/50 shadow-md" 
                                    : "bg-[#005259] border-white/10 hover:bg-[#00383d]/40 text-slate-200"
                                }`}
                              >
                                <input 
                                  type="radio" 
                                  name={q.id} 
                                  checked={isSelected}
                                  onChange={() => setReponsesQCM(prev => ({ ...prev, [q.id]: option }))}
                                  className="text-[#F9C44E] focus:ring-0 bg-[#00383d] border-white/20 w-4 h-4 accent-[#F9C44E]"
                                />
                                <span>{option}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* EVALUATION COMPLÈTE COLLECTE TECH (23 QUESTIONS) */}
              {isModeCollecteTech && (
                <div className="space-y-4">
                  {QUESTIONS_COLLECTE_TECH.map((q, qIndex) => {
                    if (qIndex !== currentQuestionIndex) return null;

                    return (
                      <div key={q.id} className="bg-[#005259] border border-[#404040]/40 rounded-2xl p-6 space-y-5 shadow-xl min-h-[260px] flex flex-col justify-between">
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-[#F9C44E] uppercase tracking-widest bg-[#00383d] px-2.5 py-1 rounded border border-[#F9C44E]/30">
                            Évaluation Collect.Tech
                          </span>
                          <h2 className="text-sm font-bold text-white leading-relaxed pt-2">{q.question}</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 pt-2">
                          {q.options.map((option, idx) => {
                            const isSelected = reponsesCollecte[q.id] === option.points;
                            return (
                              <label 
                                key={idx} 
                                className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected 
                                    ? "bg-[#00383d] border-[#F9C44E] text-[#F9C44E] font-bold ring-1 ring-[#F9C44E]/50 shadow-md" 
                                    : "bg-[#005259] border-white/10 hover:bg-[#00383d]/40 text-slate-200"
                                }`}
                              >
                                <input 
                                  type="radio" 
                                  name={q.id} 
                                  checked={isSelected}
                                  onChange={() => setReponsesCollecte(prev => ({ ...prev, [q.id]: option.points }))}
                                  className="text-[#F9C44E] focus:ring-0 bg-[#00383d] border-white/20 w-4 h-4 accent-[#F9C44E]"
                                />
                                <span>{option.text}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* OBSERVATIONS DE FIN DE PARCOURS */}
              {(isModeQCMClassic || isModeCollecteTech) && totalQuestions > 0 && currentQuestionIndex === (totalQuestions - 1) && (
                <div className="w-full bg-[#005259] border border-[#404040]/40 rounded-2xl p-5 space-y-3 shadow-xl">
                  <label className="text-xs font-bold text-[#F9C44E] uppercase tracking-wider block">
                    Observations du conseiller (Optionnel)
                  </label>
                  <textarea
                    value={commentairesPerso}
                    onChange={(e) => setCommentairesPerso(e.target.value)}
                    placeholder="Ajoutez vos notes de suivi ici..."
                    rows={3}
                    className="w-full px-4 py-3 bg-[#00383d] border border-white/20 rounded-xl text-xs text-white placeholder-slate-400 outline-none focus:border-[#F9C44E] focus:ring-1 focus:ring-[#F9C44E] transition-all resize-none font-medium"
                  />
                </div>
              )}

              {/* CONTRÔLES DE NAVIGATION */}
              {(isModeQCMClassic || isModeCollecteTech) && totalQuestions > 0 && (
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-[#F9C44E] disabled:opacity-30 transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    <ChevronLeftIcon className="w-4 h-4 text-[#F9C44E]" />
                    Précédent
                  </button>

                  {currentQuestionIndex < (totalQuestions - 1) && (
                    <button
                      type="button"
                      disabled={!questionEnCoursA_Reponse}
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                      className="flex items-center gap-1.5 bg-[#F9945D] hover:bg-[#EF736A] text-white text-xs font-bold px-5 py-2.5 rounded-xl disabled:opacity-30 transition-all cursor-pointer shadow-lg uppercase tracking-wider"
                    >
                      Suivant
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* SATISFACTION */}
              {typeQuestionnaire === "Satisfaction" && (
                <div className="bg-[#005259] border border-[#404040]/40 rounded-2xl p-6 space-y-5 shadow-xl">
                  <div>
                    <label className="text-xs font-bold text-[#F9C44E] uppercase tracking-wider block">Appréciation globale des ateliers</label>
                    <div className="flex gap-2 pt-3 justify-center">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSatisfactionGlobale(num)}
                          className={`w-10 h-10 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            satisfactionGlobale === num 
                              ? "bg-[#F9C44E] border-[#F9C44E] text-[#00383d] shadow-md" 
                              : "bg-[#00383d] border-white/10 text-slate-200 hover:border-[#F9C44E]"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#F9C44E] uppercase tracking-wider block">Clarté des supports mémo</label>
                    <div className="flex gap-2 pt-3 justify-center">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSatisfactionSupports(num)}
                          className={`w-10 h-10 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            satisfactionSupports === num 
                              ? "bg-[#F9C44E] border-[#F9C44E] text-[#00383d] shadow-md" 
                              : "bg-[#00383d] border-white/10 text-slate-200 hover:border-[#F9C44E]"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#F9C44E] uppercase tracking-wider block">Des suggestions ?</label>
                    <textarea
                      value={suggestions}
                      onChange={(e) => setSuggestions(e.target.value)}
                      placeholder="Vos suggestions..."
                      rows={2}
                      className="w-full px-4 py-3 bg-[#00383d] border border-white/20 rounded-xl text-xs text-white placeholder-slate-400 outline-none focus:border-[#F9C44E] focus:ring-1 focus:ring-[#F9C44E] transition-all resize-none font-medium"
                    />
                  </div>
                </div>
              )}

              {/* BOUTON D'ENREGISTREMENT FINAL */}
              {(typeQuestionnaire === "Satisfaction" || (totalQuestions > 0 && currentQuestionIndex === (totalQuestions - 1))) && (
                <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => { setEtape(1); setTypeQuestionnaire(""); }}
                    className="text-xs font-bold text-slate-300 hover:text-[#F9C44E] transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    Changer de type
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAnnulerOuRetour}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white border border-white/10 hover:bg-[#00383d] transition-all cursor-pointer uppercase tracking-wider"
                    >
                      Annuler
                    </button>

                    <button
                      type="submit"
                      disabled={loading || ((isModeQCMClassic || isModeCollecteTech) && !questionEnCoursA_Reponse)}
                      className="bg-[#F9945D] hover:bg-[#EF736A] disabled:opacity-30 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg uppercase tracking-wider"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>{loading ? "Enregistrement..." : "Terminer et Enregistrer"}</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </form>
      </div>
    </main>
    </PageGuard>
  );
}
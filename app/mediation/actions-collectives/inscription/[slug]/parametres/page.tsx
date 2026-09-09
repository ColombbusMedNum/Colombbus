"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, PlusIcon, XMarkIcon, TrashIcon, TagIcon, PhotoIcon, QuestionMarkCircleIcon, DocumentDuplicateIcon, ChevronUpIcon, ChevronDownIcon, LinkIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { useToast } from "@/components/ToastProvider";
import {
  chargerSchema,
  sauvegarderSchema,
  chargerConfiguration,
  sauvegarderParcours,
  sauvegarderTerritoires,
  sauvegarderNiveauxEtudes,
  sauvegarderSessions,
  sauvegarderLogos,
  sauvegarderProgrammes,
  Parcours,
} from "@/lib/dynamicActions/store";
import { ActionSchema, CATEGORIE_EVOLUTION_DEFAUT, CategorieAccueil, CategorieEvolution, QuestionDef, TypeQuestion, slugifier } from "@/lib/dynamicActions/types";
import { MODELES_DUPLICATION } from "@/lib/dynamicActions/modelesDuplicationAction";

const TYPES_QUESTION: { valeur: TypeQuestion; label: string }[] = [
  { valeur: "texte", label: "Texte court" },
  { valeur: "textarea", label: "Texte long" },
  { valeur: "email", label: "Email" },
  { valeur: "telephone", label: "Téléphone" },
  { valeur: "nombre", label: "Nombre" },
  { valeur: "oui_non", label: "Oui / Non" },
  { valeur: "select", label: "Liste déroulante" },
  { valeur: "tags_multiples", label: "Choix multiples (tags)" },
  { valeur: "checkbox", label: "Case à cocher" },
];

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function parseDateInput(valeur: string): Date | null {
  const m = valeur.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function formaterLibelleSession(debut: Date, fin: Date, creneau: string): string {
  const formater = (d: Date) => `${JOURS_FR[d.getDay()]} ${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
  return `Du ${formater(debut)} au ${formater(fin)} — ${creneau}`;
}
function extraireDatePourTri(texte: string): number | null {
  const regex = new RegExp(`(\\d{1,2})\\s+(${MOIS_FR.join("|")})\\s+(\\d{4})`, "i");
  const correspondance = texte.toLowerCase().match(regex);
  if (!correspondance) return null;
  const jour = parseInt(correspondance[1], 10);
  const mois = MOIS_FR.indexOf(correspondance[2].toLowerCase());
  const annee = parseInt(correspondance[3], 10);
  return new Date(annee, mois, jour).getTime();
}

const inputClass = "w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] placeholder-[#404040]/40 outline-none font-medium transition-colors";
const labelClass = "block text-[11px] font-bold text-[#404040]/70 uppercase tracking-wide mb-1";

// Mêmes 3 dossiers que ceux utilisés par les programmes historiques dans
// NAV_TREE (app/page.tsx) — la tuile de l'action y est ajoutée/déplacée
// automatiquement dès que cette catégorie est choisie ou changée.
const CATEGORIES_ACCUEIL: { valeur: CategorieAccueil; label: string }[] = [
  { valeur: "inclusion-numerique", label: "Inclusion Numérique" },
  { valeur: "insertion-pro", label: "Insertion Professionnelle" },
  { valeur: "decouvertes-metiers", label: "Découvertes Métiers" },
];

export default function ParametresActionDynamiquePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { role, loading: loadingPermissions } = usePermissions();
  const { showToast } = useToast();

  const [schema, setSchema] = useState<ActionSchema | null>(null);
  const [parcoursListe, setParcoursListe] = useState<Parcours[]>([]);
  const [nouveauParcoursLabel, setNouveauParcoursLabel] = useState("");
  const [territoiresListe, setTerritoiresListe] = useState<string[]>([]);
  const [nouveauTerritoire, setNouveauTerritoire] = useState("");
  const [niveauxEtudes, setNiveauxEtudes] = useState<string[]>([]);
  const [nouveauNiveau, setNouveauNiveau] = useState("");
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);

  const [nouvelleSessionParcours, setNouvelleSessionParcours] = useState("");
  const [nouvelleSessionTerritoire, setNouvelleSessionTerritoire] = useState("");
  const [nouvelleSessionDebut, setNouvelleSessionDebut] = useState("");
  const [nouvelleSessionFin, setNouvelleSessionFin] = useState("");
  const [nouvelleSessionCreneau, setNouvelleSessionCreneau] = useState("Matin");

  const [logosDisponibles, setLogosDisponibles] = useState<any[]>([]);
  const [logosParTerritoire, setLogosParTerritoire] = useState<Record<string, string[]>>({});
  const [territoireLogosActif, setTerritoireLogosActif] = useState("");

  const [programmes, setProgrammes] = useState<Record<string, { storagePath: string; url: string }[]>>({});
  const [televersementProgrammeEnCours, setTeleversementProgrammeEnCours] = useState<string | null>(null);

  useEffect(() => {
    const charger = async () => {
      const [s, config, snapLogos] = await Promise.all([
        chargerSchema(slug),
        chargerConfiguration(slug),
        getDocs(collection(db, "logos_emargement")),
      ]);
      if (!s) {
        setIntrouvable(true);
        setLoading(false);
        return;
      }
      setSchema(s);
      setLogosDisponibles(snapLogos.docs.map((d) => ({ id: d.id, ...d.data() })));
      setParcoursListe(config.parcoursListe);
      setTerritoiresListe(config.territoiresListe);
      setNiveauxEtudes(config.niveauxEtudes);
      setSessions(config.sessions);
      setCodes(config.codes);
      setLogosParTerritoire(config.logosParTerritoire);
      setProgrammes(config.programmes);
      setNouvelleSessionParcours(config.parcoursListe[0]?.id || "");
      setNouvelleSessionTerritoire(config.territoiresListe[0] || "");
      setTerritoireLogosActif(config.territoiresListe[0] || "");
      setLoading(false);
    };
    charger();
  }, [slug]);

  const majSchema = async (patch: Partial<ActionSchema>) => {
    if (!schema) return;
    // Firestore refuse toute valeur littéralement "undefined" (ex. en
    // remettant "categorieAccueil" à vide) — on retire la clé plutôt que de
    // la mettre à undefined, ce qui revient au même pour un champ optionnel.
    const misAJour = { ...schema, ...patch };
    (Object.keys(misAJour) as (keyof ActionSchema)[]).forEach((cle) => {
      if (misAJour[cle] === undefined) delete misAJour[cle];
    });
    setSchema(misAJour);
    await sauvegarderSchema(misAJour);
  };

  const basculerLogo = async (territoire: string, logoId: string) => {
    const pourTerritoire = logosParTerritoire[territoire] || [];
    const misesAJour = { ...logosParTerritoire, [territoire]: pourTerritoire.includes(logoId) ? pourTerritoire.filter((id) => id !== logoId) : [...pourTerritoire, logoId] };
    setLogosParTerritoire(misesAJour);
    await sauvegarderLogos(slug, misesAJour);
  };

  const majProgrammes = async (parParcours: Record<string, { storagePath: string; url: string }[]>) => {
    setProgrammes(parParcours);
    await sauvegarderProgrammes(slug, parParcours);
  };

  const televerserProgramme = async (parcoursId: string, fichier: File) => {
    if (fichier.size > 3 * 1024 * 1024) {
      showToast("Cette image est trop lourde. Merci de choisir un fichier de moins de 3 Mo.", "error");
      return;
    }
    setTeleversementProgrammeEnCours(parcoursId);
    try {
      const storagePath = `programmes_inscription/${slug}/${parcoursId}/${Date.now()}_${fichier.name}`;
      const ref = storageRef(storage, storagePath);
      await uploadBytes(ref, fichier);
      const url = await getDownloadURL(ref);
      const pourParcours = programmes[parcoursId] || [];
      await majProgrammes({ ...programmes, [parcoursId]: [...pourParcours, { storagePath, url }] });
    } catch (e) {
      console.error(e);
      showToast("Erreur lors du téléversement de l'image.", "error");
    } finally {
      setTeleversementProgrammeEnCours(null);
    }
  };

  const supprimerProgramme = async (parcoursId: string, image: { storagePath: string; url: string }) => {
    const pourParcours = (programmes[parcoursId] || []).filter((img) => img.storagePath !== image.storagePath);
    await majProgrammes({ ...programmes, [parcoursId]: pourParcours });
    await deleteObject(storageRef(storage, image.storagePath)).catch(() => {});
  };

  const ajouterParcours = async () => {
    const label = nouveauParcoursLabel.trim();
    if (!label) return;
    const id = slugifier(label);
    const misesAJour = [...parcoursListe, { id, label }];
    setParcoursListe(misesAJour);
    setNouveauParcoursLabel("");
    await sauvegarderParcours(slug, misesAJour);
  };
  const supprimerParcours = async (id: string) => {
    const misesAJour = parcoursListe.filter((p) => p.id !== id);
    setParcoursListe(misesAJour);
    await sauvegarderParcours(slug, misesAJour);
    const sessionsMisesAJour = { ...sessions };
    delete sessionsMisesAJour[id];
    setSessions(sessionsMisesAJour);
    const codesMisAJour = Object.fromEntries(Object.entries(codes).filter(([cle]) => cle.split("|")[0] !== id));
    setCodes(codesMisAJour);
    await sauvegarderSessions(slug, sessionsMisesAJour, codesMisAJour);
  };

  const ajouterTerritoire = async () => {
    const valeur = nouveauTerritoire.trim();
    if (!valeur || territoiresListe.includes(valeur)) return;
    const misesAJour = [...territoiresListe, valeur];
    setTerritoiresListe(misesAJour);
    setNouveauTerritoire("");
    await sauvegarderTerritoires(slug, misesAJour);
  };
  const supprimerTerritoire = async (valeur: string) => {
    const misesAJour = territoiresListe.filter((t) => t !== valeur);
    setTerritoiresListe(misesAJour);
    await sauvegarderTerritoires(slug, misesAJour);
  };

  const ajouterNiveau = async () => {
    const valeur = nouveauNiveau.trim();
    if (!valeur || niveauxEtudes.includes(valeur)) return;
    const misesAJour = [...niveauxEtudes, valeur];
    setNiveauxEtudes(misesAJour);
    setNouveauNiveau("");
    await sauvegarderNiveauxEtudes(slug, misesAJour);
  };
  const supprimerNiveau = async (valeur: string) => {
    const misesAJour = niveauxEtudes.filter((n) => n !== valeur);
    setNiveauxEtudes(misesAJour);
    await sauvegarderNiveauxEtudes(slug, misesAJour);
  };

  const ajouterSession = async () => {
    const debut = parseDateInput(nouvelleSessionDebut);
    const fin = parseDateInput(nouvelleSessionFin);
    if (!debut || !fin) {
      showToast("Merci de renseigner une date de début ET une date de fin avant d'ajouter la session.", "error");
      return;
    }
    const valeur = formaterLibelleSession(debut, fin, nouvelleSessionCreneau);
    const dejaExistant = Object.values(sessions).some((parTerritoire) => Object.values(parTerritoire).some((dates) => dates.includes(valeur)));
    if (dejaExistant) {
      showToast("Une session existe déjà avec exactement les mêmes dates et le même créneau.", "error");
      return;
    }
    const pourParcours = sessions[nouvelleSessionParcours] || {};
    const misesAJour = { ...sessions, [nouvelleSessionParcours]: { ...pourParcours, [nouvelleSessionTerritoire]: [...(pourParcours[nouvelleSessionTerritoire] || []), valeur] } };
    setSessions(misesAJour);
    setNouvelleSessionDebut("");
    setNouvelleSessionFin("");
    await sauvegarderSessions(slug, misesAJour, codes);
  };
  const supprimerSession = async (parcours: string, territoire: string, valeur: string) => {
    const pourParcours = sessions[parcours] || {};
    const misesAJour = { ...sessions, [parcours]: { ...pourParcours, [territoire]: (pourParcours[territoire] || []).filter((s) => s !== valeur) } };
    setSessions(misesAJour);
    const cle = `${parcours}|${territoire}|${valeur}`;
    const codesMisAJour = { ...codes };
    delete codesMisAJour[cle];
    setCodes(codesMisAJour);
    await sauvegarderSessions(slug, misesAJour, codesMisAJour);
  };
  const genererCode = async (ligne: { parcoursId: string; territoire: string; date: string }) => {
    const cle = `${ligne.parcoursId}|${ligne.territoire}|${ligne.date}`;
    if (codes[cle]) return;
    const anneeMatch = ligne.date.match(/(\d{4})/);
    const annee = anneeMatch ? anneeMatch[1].slice(-2) : String(new Date().getFullYear()).slice(-2);
    const nombreExistant = Object.keys(codes).filter((c) => c.split("|")[1] === ligne.territoire).length;
    const numero = String(nombreExistant + 1).padStart(2, "0");
    const code = `MN${annee}_${slug.toUpperCase()}-${ligne.territoire}_${numero}`;
    const misesAJour = { ...codes, [cle]: code };
    setCodes(misesAJour);
    await sauvegarderSessions(slug, sessions, misesAJour);
  };
  const modifierCode = async (cle: string, valeur: string) => {
    const misesAJour = { ...codes, [cle]: valeur };
    setCodes(misesAJour);
    await sauvegarderSessions(slug, sessions, misesAJour);
  };

  // --- QUESTIONNAIRE (questions CUSTOM) ---
  const ajouterQuestion = () => {
    if (!schema) return;
    const nouvelleQuestion: QuestionDef = {
      id: `q_${Date.now()}`,
      label: "Nouvelle question",
      type: "texte",
      requis: false,
      etape: schema.questions.length,
    };
    majSchema({ questions: [...schema.questions, nouvelleQuestion] });
  };
  const modifierQuestion = (id: string, patch: Partial<QuestionDef>) => {
    if (!schema) return;
    majSchema({ questions: schema.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  };
  const supprimerQuestion = (id: string) => {
    if (!schema) return;
    majSchema({ questions: schema.questions.filter((q) => q.id !== id) });
  };
  const deplacerQuestion = (index: number, direction: -1 | 1) => {
    if (!schema) return;
    const triees = [...schema.questions].sort((a, b) => a.etape - b.etape);
    const cible = index + direction;
    if (cible < 0 || cible >= triees.length) return;
    [triees[index], triees[cible]] = [triees[cible], triees[index]];
    majSchema({ questions: triees.map((q, i) => ({ ...q, etape: i })) });
  };

  // --- CATÉGORIES D'ÉVOLUTION (catégories ACTIVITÉ de la grille de suivi de
  // présence, voir reponses/[slug]/[id]/evolution) — modifiables par action,
  // contrairement aux 4 codes structurels fixes (Absence justifiée/non
  // justifiée, Férié, Abandon), gérés par le moteur.
  const categoriesEvolution = schema && schema.categoriesEvolution && schema.categoriesEvolution.length > 0 ? schema.categoriesEvolution : CATEGORIE_EVOLUTION_DEFAUT;
  const luminanceTexte = (bg: string): string => {
    const hex = bg.replace("#", "");
    if (hex.length !== 6) return "#FFFFFF";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#111111" : "#FFFFFF";
  };
  const ajouterCategorieEvolution = () => {
    const nouvelle: CategorieEvolution = { code: `C${categoriesEvolution.length + 1}`, label: "Nouvelle catégorie", bg: "#3B82F6", text: "#FFFFFF" };
    majSchema({ categoriesEvolution: [...categoriesEvolution, nouvelle] });
  };
  const modifierCategorieEvolution = (index: number, patch: Partial<CategorieEvolution>) => {
    majSchema({ categoriesEvolution: categoriesEvolution.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  };
  const supprimerCategorieEvolution = (index: number) => {
    majSchema({ categoriesEvolution: categoriesEvolution.filter((_, i) => i !== index) });
  };

  const dupliquerDepuisModele = async (modeleId: string) => {
    if (!schema) return;
    const modele = MODELES_DUPLICATION.find((m) => m.id === modeleId);
    if (!modele) return;
    const questions: QuestionDef[] = modele.questions.map((q, i) => ({ ...q, id: `q_${Date.now()}_${i}`, etape: i }));
    await majSchema({ questions, dupliqueDepuis: modele.id });
    showToast(`Questionnaire dupliqué depuis ${modele.label}.`, "success");
  };

  const questionsTriees = schema ? [...schema.questions].sort((a, b) => a.etape - b.etape) : [];
  const lienPublic = `${typeof window !== "undefined" ? window.location.origin : "https://cosmos.colombbus.org"}/inscription/${slug}`;

  const lignesSessions = parcoursListe
    .flatMap((p) => territoiresListe.flatMap((t) => (sessions[p.id]?.[t] || []).map((date) => ({ parcoursId: p.id, parcoursLabel: p.label, territoire: t, date }))))
    .sort((a, b) => {
      const territoireDiff = a.territoire.localeCompare(b.territoire, "fr", { numeric: true });
      if (territoireDiff !== 0) return territoireDiff;
      const dateA = extraireDatePourTri(a.date);
      const dateB = extraireDatePourTri(b.date);
      if (dateA !== null && dateB !== null && dateA !== dateB) return dateA - dateB;
      return a.date.localeCompare(b.date, "fr", { numeric: true });
    });

  if (loading || loadingPermissions) {
    return <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>Chargement...</div>;
  }
  if (introuvable || !schema) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-center p-8 antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#EF736A]">Action introuvable</p>
        <Link href="/mediation/actions-collectives/creer-action" className="text-xs font-bold text-[#005259] underline">Retour à la liste des actions</Link>
      </div>
    );
  }
  if (role !== "admin") {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-center p-8 antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#EF736A]">Page réservée à l'administrateur</p>
        <Link href={`/mediation/actions-collectives/inscription/${slug}`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
          <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
          <span>Retour au formulaire</span>
        </Link>
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_action_dynamique">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="max-w-5xl mx-auto relative z-10 space-y-6">

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]" style={{ backgroundColor: schema.accentColor }}></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Gérer <span className="text-[#EA601F] font-semibold">{schema.label}</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Questionnaire, parkours, territoires et sessions</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link href={`/mediation/actions-collectives/inscription/${slug}`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Formulaire</span>
            </Link>
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>
        </div>

        {/* LIEN DU FORMULAIRE PUBLIC */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-[#EA601F]" />
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Lien du formulaire public</h2>
          </div>
          <p className="text-[10px] text-[#404040]/50">À partager tel quel (email, réseaux, QR code...) — aucune connexion requise pour le remplir.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 rounded-xl text-xs text-[#005259] font-mono font-bold overflow-x-auto whitespace-nowrap">
              {lienPublic}
            </code>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(lienPublic); showToast("Lien copié.", "success"); }}
                className="px-3 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/15 text-[#005259] rounded-xl text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
              >
                Copier
              </button>
              <a href={`/inscription/${slug}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl text-xs font-bold uppercase tracking-wide transition-colors">
                Ouvrir
              </a>
            </div>
          </div>
        </div>

        {/* INFOS GÉNÉRALES */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Informations générales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Nom de l'action</label>
              <input type="text" defaultValue={schema.label} onBlur={(e) => majSchema({ label: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Couleur d'accent</label>
              <input type="color" defaultValue={schema.accentColor} onBlur={(e) => majSchema({ accentColor: e.target.value })} className={`${inputClass} h-10 cursor-pointer`} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs font-bold text-[#404040] cursor-pointer">
                <input type="checkbox" checked={schema.actif} onChange={(e) => majSchema({ actif: e.target.checked })} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                Action active (visible sur l'accueil et le formulaire public)
              </label>
            </div>
            <div className="sm:col-span-3">
              <label className={labelClass}>Tuile visible sur l'accueil, dans...</label>
              <select
                value={schema.categorieAccueil || ""}
                onChange={(e) => majSchema({ categorieAccueil: (e.target.value || undefined) as CategorieAccueil | undefined })}
                className={inputClass}
              >
                <option value="">Nulle part (accessible uniquement via Gestion Colombbus &gt; Actions personnalisées)</option>
                {CATEGORIES_ACCUEIL.map((c) => <option key={c.valeur} value={c.valeur}>{c.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className={labelClass}>Texte de consentement RGPD</label>
              <textarea defaultValue={schema.consentementRgpdTexte} onBlur={(e) => majSchema({ consentementRgpdTexte: e.target.value })} rows={2} className={inputClass} />
            </div>
            <div className="sm:col-span-3">
              <label className="flex items-center gap-2 text-xs font-bold text-[#404040] cursor-pointer">
                <input type="checkbox" checked={schema.conseillerReferentActif} onChange={(e) => majSchema({ conseillerReferentActif: e.target.checked })} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                Étape "Conseiller·e référent·e" activée
              </label>
            </div>
          </div>
        </div>

        {/* QUESTIONNAIRE */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <QuestionMarkCircleIcon className="w-4 h-4 text-[#EA601F]" />
              <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Questionnaire ({questionsTriees.length})</h2>
            </div>
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => { if (e.target.value) dupliquerDepuisModele(e.target.value); e.target.value = ""; }}
                defaultValue=""
                className="px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 rounded-xl text-xs font-bold text-[#005259] outline-none cursor-pointer"
              >
                <option value="" disabled>Dupliquer depuis...</option>
                {MODELES_DUPLICATION.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <button type="button" onClick={ajouterQuestion} className="flex items-center gap-1.5 px-3 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
                <PlusIcon className="w-4 h-4" /> Question
              </button>
            </div>
          </div>
          <p className="text-[10px] text-[#404040]/50">
            Ces questions s'ajoutent au socle commun (identité, adresse, QPV, date de naissance, niveau d'études, parkours/territoire/session) et apparaissent dans une étape unique "Informations complémentaires" du formulaire.
          </p>
          <div className="space-y-3">
            {questionsTriees.map((q, index) => (
              <div key={q.id} className="border border-[#404040]/10 rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button type="button" onClick={() => deplacerQuestion(index, -1)} disabled={index === 0} className="text-[#404040]/40 hover:text-[#005259] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                      <ChevronUpIcon className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => deplacerQuestion(index, 1)} disabled={index === questionsTriees.length - 1} className="text-[#404040]/40 hover:text-[#005259] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed">
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input type="text" defaultValue={q.label} onBlur={(e) => modifierQuestion(q.id, { label: e.target.value })} placeholder="Intitulé de la question" className={inputClass} />
                    <select value={q.type} onChange={(e) => modifierQuestion(q.id, { type: e.target.value as TypeQuestion })} className={inputClass}>
                      {TYPES_QUESTION.map((t) => <option key={t.valeur} value={t.valeur}>{t.label}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-xs font-bold text-[#404040] cursor-pointer">
                      <input type="checkbox" checked={q.requis} onChange={(e) => modifierQuestion(q.id, { requis: e.target.checked })} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                      Obligatoire
                    </label>
                  </div>
                  <button type="button" onClick={() => supprimerQuestion(q.id)} className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer shrink-0">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
                {(q.type === "select" || q.type === "tags_multiples") && (
                  <div className="pl-6">
                    <label className={labelClass}>Options (séparées par une virgule)</label>
                    <input
                      type="text"
                      defaultValue={(q.options || []).join(", ")}
                      onBlur={(e) => modifierQuestion(q.id, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                      className={inputClass}
                    />
                  </div>
                )}
                <div className="pl-6 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-[#404040]/50">Afficher seulement si</span>
                  <select
                    value={q.conditionSurQuestionId || ""}
                    onChange={(e) => modifierQuestion(q.id, { conditionSurQuestionId: e.target.value || undefined, conditionValeur: undefined })}
                    className="px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none"
                  >
                    <option value="">(toujours affichée)</option>
                    {questionsTriees.filter((autre) => autre.id !== q.id && (autre.type === "oui_non" || autre.type === "select")).map((autre) => (
                      <option key={autre.id} value={autre.id}>{autre.label}</option>
                    ))}
                  </select>
                  {q.conditionSurQuestionId && (
                    <>
                      <span className="text-[10px] font-bold uppercase text-[#404040]/50">vaut</span>
                      <input
                        type="text"
                        defaultValue={q.conditionValeur || ""}
                        onBlur={(e) => modifierQuestion(q.id, { conditionValeur: e.target.value })}
                        placeholder="Ex : Oui"
                        className="px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs outline-none w-28"
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
            {questionsTriees.length === 0 && <p className="text-xs text-[#404040]/50 italic text-center py-4">Aucune question personnalisée pour le moment.</p>}
          </div>
        </div>

        {/* CATÉGORIES D'ÉVOLUTION */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <TagIcon className="w-4 h-4 text-[#EA601F]" />
              <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Catégories d'évolution ({categoriesEvolution.length})</h2>
            </div>
            <button type="button" onClick={ajouterCategorieEvolution} className="flex items-center gap-1.5 px-3 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer">
              <PlusIcon className="w-4 h-4" /> Catégorie
            </button>
          </div>
          <p className="text-[10px] text-[#404040]/50">
            Les catégories "activité" affichées sur la grille de suivi de présence (page Évolution d'une session) — par ex. les modules ou ateliers couverts au jour le jour. Les 4 codes de statut (Absence justifiée/non justifiée, Férié, Abandon) restent fixes et ne sont pas modifiables ici.
          </p>
          <div className="space-y-2">
            {categoriesEvolution.map((c, index) => (
              <div key={index} className="flex items-center gap-2 border border-[#404040]/10 rounded-xl p-2.5">
                <input
                  type="text"
                  defaultValue={c.code}
                  onBlur={(e) => modifierCategorieEvolution(index, { code: e.target.value.trim() })}
                  placeholder="Code"
                  maxLength={6}
                  className="w-20 px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-lg text-xs font-bold text-center text-[#005259] outline-none transition-colors uppercase"
                />
                <input
                  type="text"
                  defaultValue={c.label}
                  onBlur={(e) => modifierCategorieEvolution(index, { label: e.target.value })}
                  placeholder="Intitulé"
                  className="flex-1 px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-lg text-xs text-[#404040] outline-none transition-colors"
                />
                <input
                  type="color"
                  value={c.bg}
                  onChange={(e) => modifierCategorieEvolution(index, { bg: e.target.value, text: luminanceTexte(e.target.value) })}
                  title="Couleur de la catégorie"
                  className="w-9 h-9 rounded-lg border border-[#404040]/15 cursor-pointer shrink-0"
                />
                <span className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ backgroundColor: c.bg, color: c.text }}>
                  {c.code || "—"}
                </span>
                <button type="button" onClick={() => supprimerCategorieEvolution(index)} className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer shrink-0">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {categoriesEvolution.length === 0 && <p className="text-xs text-[#404040]/50 italic text-center py-4">Aucune catégorie d'évolution pour le moment.</p>}
          </div>
        </div>

        {/* LOGOS */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <PhotoIcon className="w-4 h-4 text-[#EA601F]" />
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Logos du formulaire public</h2>
          </div>
          <p className="text-[10px] text-[#404040]/50">
            Choisis parmi la <Link href="/mediation/bibliotheque-logos" className="underline hover:text-[#005259]">bibliothèque de logos</Link> — affichés dans l'en-tête de{" "}
            <a href={`/inscription/${slug}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#005259]">la version publique du formulaire</a>, territoire par territoire.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {territoiresListe.map((t) => (
              <button key={t} type="button" onClick={() => setTerritoireLogosActif(t)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${territoireLogosActif === t ? "bg-[#005259] text-white border-[#005259]" : "bg-[#F3F3F2] text-[#404040] border-[#404040]/10 hover:border-[#005259]/40"}`}>
                {t}
              </button>
            ))}
          </div>
          {logosDisponibles.length === 0 ? (
            <p className="text-xs text-[#404040]/50 italic">Aucun logo dans la bibliothèque pour le moment.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {logosDisponibles.map((logo) => {
                const selectionne = (logosParTerritoire[territoireLogosActif] || []).includes(logo.id);
                return (
                  <button key={logo.id} type="button" onClick={() => basculerLogo(territoireLogosActif, logo.id)} title={logo.nom} className={`p-2 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center gap-1 ${selectionne ? "border-[#005259] bg-[#005259]/5" : "border-[#404040]/10 hover:border-[#404040]/25"}`}>
                    <div className="w-full h-12 flex items-center justify-center">
                      <img src={logo.url} alt={logo.nom} className="max-h-full max-w-full object-contain" />
                    </div>
                    <span className="text-[9px] font-bold uppercase text-[#404040]/60 truncate w-full text-center">{logo.nom}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* PROGRAMME PAR PARCOURS */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <PhotoIcon className="w-4 h-4 text-[#EA601F]" />
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Programme par parcours</h2>
          </div>
          <div className="space-y-4">
            {parcoursListe.map((p) => (
              <div key={p.id} className="border border-[#404040]/10 rounded-xl p-3 space-y-2">
                <span className="text-xs font-bold text-[#005259]">{p.label}</span>
                <div className="flex flex-wrap gap-3">
                  {(programmes[p.id] || []).map((img) => (
                    <div key={img.storagePath} className="relative w-20 h-20 rounded-lg border border-[#404040]/10 overflow-hidden group bg-[#F3F3F2]">
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => supprimerProgramme(p.id, img)} className="absolute top-1 right-1 p-1 bg-white/90 text-[#EF736A] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className={`w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${televersementProgrammeEnCours === p.id ? "border-[#404040]/20 text-[#404040]/30" : "border-[#404040]/20 hover:border-[#005259]/40 text-[#404040]/40 hover:text-[#005259]"}`}>
                    {televersementProgrammeEnCours === p.id ? <span className="text-[9px] font-bold uppercase">...</span> : <PlusIcon className="w-5 h-5" />}
                    <input type="file" accept="image/*" disabled={televersementProgrammeEnCours === p.id} onChange={(e) => { const f = e.target.files?.[0]; if (f) televerserProgramme(p.id, f); e.target.value = ""; }} className="hidden" />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PARKOURS */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Parkours</h2>
          <div className="flex flex-wrap gap-1.5">
            {parcoursListe.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 bg-[#F3F3F2] border border-[#404040]/10 rounded-lg px-2.5 py-1.5 text-xs text-[#404040]">
                {p.label}
                <button type="button" onClick={() => supprimerParcours(p.id)} className="text-[#EF736A] hover:text-[#EF736A]/70 cursor-pointer"><XMarkIcon className="w-3.5 h-3.5" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <input type="text" value={nouveauParcoursLabel} onChange={(e) => setNouveauParcoursLabel(e.target.value)} placeholder="Intitulé du nouveau parkours" className={inputClass} />
            <button type="button" onClick={ajouterParcours} className="shrink-0 px-3 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl transition-colors cursor-pointer"><PlusIcon className="w-4 h-4" /></button>
          </div>
        </div>

        {/* TERRITOIRES */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Territoires</h2>
          <div className="flex flex-wrap gap-1.5">
            {territoiresListe.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 bg-[#F3F3F2] border border-[#404040]/10 rounded-lg px-2.5 py-1.5 text-xs text-[#404040]">
                {t}
                <button type="button" onClick={() => supprimerTerritoire(t)} className="text-[#EF736A] hover:text-[#EF736A]/70 cursor-pointer"><XMarkIcon className="w-3.5 h-3.5" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <input type="text" value={nouveauTerritoire} onChange={(e) => setNouveauTerritoire(e.target.value)} placeholder="Ex : 75, 78, Autres..." className={inputClass} />
            <button type="button" onClick={ajouterTerritoire} className="shrink-0 px-3 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl transition-colors cursor-pointer"><PlusIcon className="w-4 h-4" /></button>
          </div>
        </div>

        {/* NIVEAUX D'ÉTUDES */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Niveaux d'études proposés</h2>
            <label className="flex items-center gap-2 text-xs font-bold text-[#404040] cursor-pointer">
              <input
                type="checkbox"
                checked={schema.niveauEtudesActif !== false}
                onChange={(e) => majSchema({ niveauEtudesActif: e.target.checked })}
                className="w-4 h-4 accent-[#005259] cursor-pointer"
              />
              Champ activé
            </label>
          </div>
          {schema.niveauEtudesActif === false ? (
            <p className="text-xs text-[#404040]/50 italic">Masqué du formulaire, des réponses et des statistiques pour cette action.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {niveauxEtudes.map((n) => (
                  <span key={n} className="inline-flex items-center gap-1.5 bg-[#F3F3F2] border border-[#404040]/10 rounded-lg px-2.5 py-1.5 text-xs text-[#404040]">
                    {n}
                    <button type="button" onClick={() => supprimerNiveau(n)} className="text-[#EF736A] hover:text-[#EF736A]/70 cursor-pointer"><XMarkIcon className="w-3.5 h-3.5" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <input type="text" value={nouveauNiveau} onChange={(e) => setNouveauNiveau(e.target.value)} placeholder="Ex : Bac+5 et plus" className={inputClass} />
                <button type="button" onClick={ajouterNiveau} className="shrink-0 px-3 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl transition-colors cursor-pointer"><PlusIcon className="w-4 h-4" /></button>
              </div>
            </>
          )}
        </div>

        {/* SESSIONS */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Sessions ({lignesSessions.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
            <div>
              <label className={labelClass}>Parkours</label>
              <select value={nouvelleSessionParcours} onChange={(e) => setNouvelleSessionParcours(e.target.value)} className={inputClass}>
                {parcoursListe.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Territoire</label>
              <select value={nouvelleSessionTerritoire} onChange={(e) => setNouvelleSessionTerritoire(e.target.value)} className={inputClass}>
                {territoiresListe.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date de début</label>
              <input type="date" value={nouvelleSessionDebut} onChange={(e) => setNouvelleSessionDebut(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date de fin</label>
              <input type="date" value={nouvelleSessionFin} onChange={(e) => setNouvelleSessionFin(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Créneau</label>
              <select value={nouvelleSessionCreneau} onChange={(e) => setNouvelleSessionCreneau(e.target.value)} className={inputClass}>
                <option value="Matin">Matin</option>
                <option value="Après-midi">Après-midi</option>
              </select>
            </div>
            <div className="flex">
              <button type="button" onClick={ajouterSession} className="w-full self-end px-3 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl transition-colors cursor-pointer flex items-center justify-center"><PlusIcon className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="overflow-x-auto border border-[#404040]/10 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-4 py-3">Parkours</th>
                  <th className="px-4 py-3">Territoire</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {lignesSessions.length > 0 ? lignesSessions.map((ligne, index) => (
                  <tr key={`${ligne.parcoursId}-${ligne.territoire}-${index}`} className="hover:bg-[#F3F3F2]/60 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-[#005259]">{ligne.parcoursLabel}</td>
                    <td className="px-4 py-2.5">{ligne.territoire}</td>
                    <td className="px-4 py-2.5">{ligne.date}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        {codes[`${ligne.parcoursId}|${ligne.territoire}|${ligne.date}`] ? (
                          <input
                            key={`${ligne.parcoursId}|${ligne.territoire}|${ligne.date}|${codes[`${ligne.parcoursId}|${ligne.territoire}|${ligne.date}`]}`}
                            type="text"
                            defaultValue={codes[`${ligne.parcoursId}|${ligne.territoire}|${ligne.date}`]}
                            onBlur={(e) => modifierCode(`${ligne.parcoursId}|${ligne.territoire}|${ligne.date}`, e.target.value)}
                            className="font-mono text-[10px] font-bold text-[#005259] bg-[#005259]/5 border border-[#005259]/15 focus:border-[#005259] focus:bg-white rounded px-1.5 py-1 w-32 outline-none"
                          />
                        ) : (
                          <button type="button" onClick={() => genererCode(ligne)} className="p-1.5 bg-[#005259]/10 hover:bg-[#005259] text-[#005259] hover:text-white border border-[#005259]/30 rounded-lg transition-colors cursor-pointer" title="Générer un code interne">
                            <PlusIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button type="button" onClick={() => supprimerSession(ligne.parcoursId, ligne.territoire, ligne.date)} className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer" title="Supprimer cette session">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">Aucune session enregistrée.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
    </PageGuard>
  );
}

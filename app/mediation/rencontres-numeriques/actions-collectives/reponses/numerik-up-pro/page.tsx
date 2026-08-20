"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { useRouter } from "next/navigation";
import { HomeIcon, MagnifyingGlassIcon, ClipboardDocumentCheckIcon, DocumentArrowUpIcon, TrashIcon, DocumentDuplicateIcon, ChevronUpIcon, ChevronDownIcon, ChevronUpDownIcon, PencilSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Champs issus du formulaire de pré-inscription — modifiables ici par
// l'équipe pour corriger une réponse ou fusionner un doublon.
interface Inscription {
  id: string;
  Civilité?: string;
  Nom?: string;
  Prénom?: string;
  Téléphone?: string;
  Age?: string;
  Email?: string;
  Code_Postal?: string;
  Niveau_Etudes?: string;
  Ville?: string;
  Territoire?: string;
  QPV?: string;
  Situation_Handicap?: string;
  NEET?: string;
  CEJ?: string;
  RSA?: string;
  RQTH?: string;
  France_Travail?: string;
  Identifiant_France_Travail?: string;
  Comment_Connu?: string;
  Structure_Accompagnement?: string;
  Structure_Autre?: string;
  Projet_Professionnel?: string;
  Formation_Acces?: string;
  Conseiller_Prenom?: string;
  Conseiller_Nom?: string;
  Conseiller_Telephone?: string;
  Conseiller_Email?: string;
  RGPD?: boolean;
  Consentement_Partage_Simulation?: boolean;
  // Parcours et session choisis à l'inscription — la session est parfois
  // générique (ancienne réponse, ou aucune session ne convenait) : dans ce
  // cas elle doit être affectée manuellement par l'équipe.
  Parcours?: string;
  Session?: string;
  // Coché par l'équipe pour affecter cette personne au suivi de recrutement
  // détaillé de sa session, sur /reponses/numerik-up-pro/[id].
  Suivi_Recrutement?: boolean;
}

interface Parcours {
  id: string;
  label: string;
}

const PARCOURS_DEFAUT: Parcours[] = [
  { id: "numerikup-pro", label: "Numérik'UP Pro" },
];

const TERRITOIRES_DEFAUT = ["91", "92", "Autres"];

// Valeur sentinelle du filtre territoire pour repérer les préinscriptions
// sans territoire renseigné — distincte de "" qui signifie "tous".
const TERRITOIRE_NON_AFFECTE = "__non_affecte__";

const NIVEAUX_ETUDES = ["Brevet, CAP, BEP", "Bac", "Bac+2 (L2, BTS, DUT, DEUST)", "Bac+3 (Licence, licence professionnelle)", "Bac+4/5 et plus"];
const STRUCTURES_ACCOMPAGNEMENT = ["Mission locale", "E2C (Ecole de la deuxième chance)", "Pôle Emploi", "PLIE", "Epide", "PJJ", "Aucune", "Autre"];

const inputEditClass = "w-full min-w-[140px] px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] focus:bg-white rounded-lg text-[11px] text-[#404040] outline-none font-medium transition-colors";

// Signale les mineur·e·s avec le même jaune que les groupes ACI de l'agenda.
const estMineur = (age?: string) => {
  const n = parseInt(age || "", 10);
  return !isNaN(n) && n < 18;
};

// Normalisation pour comparer deux valeurs sans être sensible à la casse, aux
// accents ou aux espaces superflus (utilisé pour détecter les doublons).
const normaliser = (s?: string) =>
  (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

// Clé de regroupement des doublons : email si présent, sinon nom + prénom +
// téléphone (une même personne soumet parfois plusieurs fois le formulaire
// avec des adresses email légèrement différentes ou absentes).
const cleDoublon = (i: Inscription) => {
  const email = normaliser(i.Email);
  if (email) return `email:${email}`;
  const nomPrenomTel = normaliser(`${i.Nom || ""}${i.Prénom || ""}${i.Téléphone || ""}`);
  return nomPrenomTel ? `identite:${nomPrenomTel}` : "";
};

export default function ReponsesNumerikUpProPage() {
  const router = useRouter();
  const { role } = usePermissions();
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [parcoursListe, setParcoursListe] = useState<Parcours[]>(PARCOURS_DEFAUT);
  const [territoiresListe, setTerritoiresListe] = useState<string[]>(TERRITOIRES_DEFAUT);
  const [territoireFiltre, setTerritoireFiltre] = useState("");
  // "preinscrits" = pas encore affecté·e·s à une session (liste principale) ;
  // "affectes" = déjà cochés pour le suivi de recrutement (retirés de la
  // liste principale pour ne pas l'encombrer une fois pris en charge).
  const [onglet, setOnglet] = useState<"preinscrits" | "affectes" | "doublons">("preinscrits");
  // Tri par colonne, activé en cliquant sur les flèches dans les entêtes du
  // tableau — asc -> desc -> retour à l'ordre par défaut.
  const [tri, setTri] = useState<{ colonne: string; direction: "asc" | "desc" } | null>(null);
  // Sélection multiple — utilisée dans l'onglet "Doublons" pour supprimer
  // plusieurs fiches en une seule fois.
  const [selection, setSelection] = useState<Set<string>>(new Set());
  // Fiche en cours de modification dans le panneau d'édition (copie de
  // travail — les changements ne sont enregistrés qu'au clic sur "Enregistrer").
  const [edition, setEdition] = useState<Inscription | null>(null);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  // sessions[parcoursId][territoire] = liste de dates de session — permet de
  // proposer les sessions disponibles pour le territoire de chaque inscrit.
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});

  // Barre de défilement horizontal dupliquée en haut du tableau — synchronisée
  // avec le défilement réel pour éviter d'avoir à descendre tout en bas.
  const scrollHautRef = useRef<HTMLDivElement>(null);
  const scrollTableRef = useRef<HTMLDivElement>(null);
  const [largeurTable, setLargeurTable] = useState(0);
  const synchroniseEnCours = useRef(false);

  useEffect(() => {
    const mettreAJourLargeur = () => {
      if (scrollTableRef.current) setLargeurTable(scrollTableRef.current.scrollWidth);
    };
    mettreAJourLargeur();
    window.addEventListener("resize", mettreAJourLargeur);
    return () => window.removeEventListener("resize", mettreAJourLargeur);
  });

  const surScrollHaut = () => {
    if (synchroniseEnCours.current) { synchroniseEnCours.current = false; return; }
    if (scrollHautRef.current && scrollTableRef.current) {
      synchroniseEnCours.current = true;
      scrollTableRef.current.scrollLeft = scrollHautRef.current.scrollLeft;
    }
  };

  // La sélection multiple n'a de sens que dans l'onglet Doublons — on la vide
  // en changeant d'onglet pour éviter de supprimer une fiche par erreur.
  useEffect(() => {
    setSelection(new Set());
  }, [onglet]);

  const basculerSelection = (id: string) => {
    setSelection((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  };

  const surScrollTable = () => {
    if (synchroniseEnCours.current) { synchroniseEnCours.current = false; return; }
    if (scrollHautRef.current && scrollTableRef.current) {
      synchroniseEnCours.current = true;
      scrollHautRef.current.scrollLeft = scrollTableRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    const charger = async () => {
      try {
        const [snapInscriptions, snapParcours, snapTerritoires, snapSessions] = await Promise.all([
          getDocs(query(collection(db, "inscriptions_numerikuppro"), orderBy("createdAt", "desc"))),
          getDoc(doc(db, "configuration_numerikuppro", "parcours")),
          getDoc(doc(db, "configuration_numerikuppro", "territoires")),
          getDoc(doc(db, "configuration_numerikuppro", "sessions")),
        ]);
        setInscriptions(snapInscriptions.docs.map((d) => ({ id: d.id, ...d.data() } as Inscription)));
        if (snapParcours.exists() && Array.isArray(snapParcours.data().liste) && snapParcours.data().liste.length > 0) {
          setParcoursListe(snapParcours.data().liste);
        }
        if (snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0) {
          setTerritoiresListe(snapTerritoires.data().liste);
        }
        if (snapSessions.exists()) {
          setSessions(snapSessions.data().parTerritoire || {});
        }
      } catch (error) {
        console.error("Erreur lors du chargement des inscriptions Numérik'UP Pro :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  // Toutes les sessions existantes, groupées par territoire, tous parkours
  // confondus — permet de forcer le passage d'un·e inscrit·e vers n'importe
  // quelle autre session, y compris hors de son territoire déclaré.
  const sessionsParTerritoire = useMemo(() => {
    const parTerritoire: Record<string, Set<string>> = {};
    Object.values(sessions).forEach((parTerr) => {
      Object.entries(parTerr).forEach(([territoire, dates]) => {
        if (!parTerritoire[territoire]) parTerritoire[territoire] = new Set();
        dates.forEach((d) => parTerritoire[territoire].add(d));
      });
    });
    return Object.fromEntries(
      Object.entries(parTerritoire).map(([t, dates]) => [t, Array.from(dates).sort((a, b) => a.localeCompare(b, "fr"))])
    );
  }, [sessions]);

  // Regroupe les inscriptions par clé de doublon (email, ou à défaut
  // nom+prénom+téléphone) — tout groupe de 2 ou plus est un doublon.
  const groupesDoublons = useMemo(() => {
    const groupes = new Map<string, Inscription[]>();
    inscriptions.forEach((i) => {
      const cle = cleDoublon(i);
      if (!cle) return;
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle)!.push(i);
    });
    return groupes;
  }, [inscriptions]);

  // id -> { cle, taille } pour les inscriptions faisant partie d'un doublon,
  // utilisé pour filtrer l'onglet "Doublons" et afficher le badge de comptage.
  const infosDoublons = useMemo(() => {
    const map = new Map<string, { cle: string; taille: number }>();
    groupesDoublons.forEach((liste, cle) => {
      if (liste.length > 1) liste.forEach((i) => map.set(i.id, { cle, taille: liste.length }));
    });
    return map;
  }, [groupesDoublons]);

  const sexeDeCivilite = (civilite?: string) => (civilite === "Mme" ? "Femme" : civilite === "M." ? "Homme" : "—");

  // Valeur affichée pour une colonne donnée — sert à la fois au filtre et,
  // pour les colonnes calculées (Sexe, Prescripteur), reste cohérente avec ce
  // qui est rendu dans la cellule.
  const valeurColonne = (i: Inscription, cle: string): string => {
    switch (cle) {
      case "civilite": return i.Civilité || "";
      case "prenom": return i.Prénom || "";
      case "nom": return i.Nom || "";
      case "telephone": return i.Téléphone || "";
      case "age": return i.Age || "";
      case "email": return i.Email || "";
      case "diplome": return i.Niveau_Etudes || "";
      case "sexe": return sexeDeCivilite(i.Civilité);
      case "ville": return i.Ville || "";
      case "codePostal": return i.Code_Postal || "";
      case "territoire": return i.Territoire || "";
      case "qpv": return i.QPV || "";
      case "parcours": return i.Parcours || "";
      case "prescripteur": return i.Structure_Accompagnement === "Autre" ? (i.Structure_Autre || "Autre") : (i.Structure_Accompagnement || "");
      case "situationHandicap": return i.Situation_Handicap || "";
      case "rqth": return i.RQTH || "";
      case "neet": return i.NEET || "";
      case "cej": return i.CEJ || "";
      case "rsa": return i.RSA || "";
      case "franceTravail": return i.France_Travail || "";
      case "identifiantFranceTravail": return i.Identifiant_France_Travail || "";
      case "commentConnu": return i.Comment_Connu || "";
      case "projetProfessionnel": return i.Projet_Professionnel || "";
      case "formationAcces": return i.Formation_Acces || "";
      case "rgpd": return i.RGPD ? "Oui" : "Non";
      case "consentementPartage": return i.Consentement_Partage_Simulation ? "Oui" : "Non";
      case "conseillerPrenom": return i.Conseiller_Prenom || "";
      case "conseillerNom": return i.Conseiller_Nom || "";
      case "conseillerTelephone": return i.Conseiller_Telephone || "";
      case "conseillerEmail": return i.Conseiller_Email || "";
      default: return "";
    }
  };

  // Bascule le tri sur une colonne : asc -> desc -> retour à l'ordre par défaut.
  const basculerTri = (colonne: string) => {
    setTri((prev) => {
      if (prev?.colonne === colonne) return prev.direction === "asc" ? { colonne, direction: "desc" } : null;
      return { colonne, direction: "asc" };
    });
  };

  const inscriptionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    const resultat = inscriptions.filter((i) => {
      if (onglet === "preinscrits" && i.Suivi_Recrutement) return false;
      if (onglet === "affectes" && !i.Suivi_Recrutement) return false;
      if (onglet === "doublons" && !infosDoublons.has(i.id)) return false;
      if (territoireFiltre === TERRITOIRE_NON_AFFECTE && i.Territoire) return false;
      else if (territoireFiltre && territoireFiltre !== TERRITOIRE_NON_AFFECTE && i.Territoire !== territoireFiltre) return false;
      if (terme && !`${i.Prénom || ""} ${i.Nom || ""}`.toLowerCase().includes(terme)) return false;
      return true;
    });
    if (tri) {
      const dir = tri.direction === "asc" ? 1 : -1;
      return [...resultat].sort((a, b) => valeurColonne(a, tri.colonne).localeCompare(valeurColonne(b, tri.colonne), "fr", { numeric: true }) * dir);
    }
    // Dans l'onglet Doublons, on regroupe visuellement les fiches d'une même
    // personne en les triant par clé de doublon plutôt que par date.
    if (onglet === "doublons") {
      return [...resultat].sort((a, b) => (infosDoublons.get(a.id)?.cle || "").localeCompare(infosDoublons.get(b.id)?.cle || ""));
    }
    return resultat;
  }, [inscriptions, recherche, onglet, territoireFiltre, infosDoublons, tri]);

  // Sessions définies sur la page de paramètres — sert uniquement à pointer
  // le bouton "Suivi recrutement" vers une première session valide (le choix
  // précis de la session se fait ensuite sur cette page-là).
  const sessionsDistinctes = useMemo(
    () => Array.from(new Set(Object.values(sessions).flatMap((parTerritoire) => Object.values(parTerritoire).flat()))).sort((a, b) => a.localeCompare(b, "fr")),
    [sessions]
  );

  const allerAuSuiviRecrutement = () => {
    if (sessionsDistinctes.length === 0) return;
    router.push(`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionsDistinctes[0])}`);
  };

  // Mise à jour optimiste locale + écriture Firestore d'un seul champ de
  // suivi — chaque cellule éditable enregistre indépendamment des autres.
  const mettreAJourChamp = async (id: string, champ: keyof Inscription, valeur: string) => {
    setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, [champ]: valeur } : i)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", id), { [champ]: valeur });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du champ ${champ} :`, error);
    }
  };

  // Bascule la case "Suivi de recrutement" — une fois cochée, la personne
  // apparaît sur la page de suivi détaillé de sa session (.../[id]).
  const basculerSuiviRecrutement = async (id: string, valeur: boolean) => {
    setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, Suivi_Recrutement: valeur } : i)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", id), { Suivi_Recrutement: valeur });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du suivi de recrutement :", error);
    }
  };

  // Supprime définitivement une préinscription — utilisé notamment pour
  // nettoyer les doublons repérés dans l'onglet dédié.
  const supprimerInscription = async (i: Inscription) => {
    const nom = `${i.Prénom || ""} ${i.Nom || ""}`.trim() || "cette personne";
    if (!window.confirm(`Supprimer définitivement la préinscription de ${nom} ? Cette action est irréversible.`)) return;
    setInscriptions((prev) => prev.filter((x) => x.id !== i.id));
    try {
      await deleteDoc(doc(db, "inscriptions_numerikuppro", i.id));
    } catch (error) {
      console.error("Erreur lors de la suppression de la préinscription :", error);
    }
  };

  // Supprime en une fois toutes les fiches actuellement sélectionnées.
  const supprimerSelection = async () => {
    if (selection.size === 0) return;
    if (!window.confirm(`Supprimer définitivement ${selection.size} préinscription(s) sélectionnée(s) ? Cette action est irréversible.`)) return;
    const ids = Array.from(selection);
    setInscriptions((prev) => prev.filter((x) => !selection.has(x.id)));
    setSelection(new Set());
    try {
      await Promise.all(ids.map((id) => deleteDoc(doc(db, "inscriptions_numerikuppro", id))));
    } catch (error) {
      console.error("Erreur lors de la suppression groupée des préinscriptions :", error);
    }
  };

  const ouvrirEdition = (i: Inscription) => setEdition({ ...i });
  const fermerEdition = () => setEdition(null);

  const majEdition = <K extends keyof Inscription>(champ: K, valeur: Inscription[K]) => {
    setEdition((prev) => (prev ? { ...prev, [champ]: valeur } : prev));
  };

  const enregistrerEdition = async () => {
    if (!edition) return;
    setEnregistrementEnCours(true);
    const { id, ...donnees } = { ...edition, Nom: (edition.Nom || "").toUpperCase() };
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", id), donnees);
      setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, ...donnees } : i)));
      setEdition(null);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la fiche :", error);
    } finally {
      setEnregistrementEnCours(false);
    }
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement des inscriptions...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-[100rem] mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Préinscriptions <span className="text-[#EA601F] font-semibold">Numérik'UP Pro</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                {inscriptions.length} inscription{inscriptions.length > 1 ? "s" : ""} reçue{inscriptions.length > 1 ? "s" : ""} — suivi de recrutement
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {sessionsDistinctes.length > 0 && (
              <button
                type="button"
                onClick={allerAuSuiviRecrutement}
                className="flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white px-3.5 py-2 rounded-xl transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm"
              >
                <ClipboardDocumentCheckIcon className="w-4 h-4" />
                <span>Suivi recrutement</span>
              </button>
            )}
            {role === "admin" && (
              <Link
                href="/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/importer"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <DocumentArrowUpIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Importer</span>
              </Link>
            )}
            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>
        </div>

        {/* ONGLETS */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOnglet("preinscrits")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              onglet === "preinscrits" ? "bg-[#005259] text-white shadow-sm" : "bg-white text-[#005259] border border-[#404040]/10 hover:border-[#005259]"
            }`}
          >
            Préinscrits ({inscriptions.filter((i) => !i.Suivi_Recrutement).length})
          </button>
          <button
            type="button"
            onClick={() => setOnglet("affectes")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              onglet === "affectes" ? "bg-[#005259] text-white shadow-sm" : "bg-white text-[#005259] border border-[#404040]/10 hover:border-[#005259]"
            }`}
          >
            Affectés à une session ({inscriptions.filter((i) => i.Suivi_Recrutement).length})
          </button>
          <button
            type="button"
            onClick={() => setOnglet("doublons")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              onglet === "doublons" ? "bg-[#EA601F] text-white shadow-sm" : "bg-white text-[#EA601F] border border-[#404040]/10 hover:border-[#EA601F]"
            }`}
          >
            <DocumentDuplicateIcon className="w-3.5 h-3.5" />
            Doublons ({infosDoublons.size})
          </button>
          {onglet === "doublons" && selection.size > 0 && (
            <button
              type="button"
              onClick={supprimerSelection}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer bg-[#C0392B] hover:bg-[#a3311f] text-white shadow-sm"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Supprimer la sélection ({selection.size})
            </button>
          )}
        </div>

        {/* RECHERCHE & FILTRE TERRITOIRE */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative group max-w-md flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-[#404040]/40 group-focus-within:text-[#005259] transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Rechercher par nom ou prénom..."
              className="w-full bg-white border border-[#404040]/15 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all shadow-sm font-medium"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          <select
            value={territoireFiltre}
            onChange={(e) => setTerritoireFiltre(e.target.value)}
            className="bg-white border border-[#404040]/15 rounded-2xl px-4 py-3.5 text-sm text-[#404040] outline-none focus:border-[#005259] focus:ring-1 focus:ring-[#005259] transition-all shadow-sm font-medium"
          >
            <option value="">Tous les territoires</option>
            {territoiresListe.map((t) => (
              <option key={t} value={t}>Territoire {t}</option>
            ))}
            <option value={TERRITOIRE_NON_AFFECTE}>Territoire non renseigné</option>
          </select>
        </div>

        {/* BARRE DE DÉFILEMENT HORIZONTAL (haut) */}
        <div ref={scrollHautRef} onScroll={surScrollHaut} className="overflow-x-auto overflow-y-hidden">
          <div style={{ width: largeurTable, height: 1 }}></div>
        </div>

        {/* TABLEAU */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <div ref={scrollTableRef} onScroll={surScrollTable} className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  {onglet === "doublons" && (
                    <th className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={inscriptionsFiltrees.length > 0 && inscriptionsFiltrees.every((i) => selection.has(i.id))}
                        onChange={(e) =>
                          setSelection(e.target.checked ? new Set(inscriptionsFiltrees.map((i) => i.id)) : new Set())
                        }
                        title="Tout sélectionner / tout désélectionner"
                        className="w-4 h-4 accent-[#EA601F] cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-3 py-3 text-center">Suivi recrutement</th>
                  <th className="px-3 py-3">Session</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                  <th className="px-3 py-3 text-center">#</th>
                  {([
                    ["civilite", "Civilité"],
                    ["prenom", "Prénom"],
                    ["nom", "Nom"],
                    ["telephone", "Téléphone"],
                    ["age", "Âge"],
                    ["email", "Email"],
                    ["diplome", "Diplôme"],
                    ["sexe", "Sexe"],
                    ["ville", "Ville"],
                    ["codePostal", "Code Postal"],
                    ["territoire", "Dpt."],
                    ["qpv", "QPV"],
                    ["parcours", "Parcours"],
                    ["prescripteur", "Prescripteur"],
                    ["situationHandicap", "Situation handicap"],
                    ["rqth", "RQTH ?"],
                    ["rsa", "RSA ?"],
                    ["neet", "NEET ?"],
                    ["cej", "CEJ ?"],
                    ["franceTravail", "France Travail"],
                    ["identifiantFranceTravail", "Identifiant France Travail"],
                    ["commentConnu", "Comment connu"],
                    ["projetProfessionnel", "Projet professionnel"],
                    ["formationAcces", "Formation — accès"],
                    ["rgpd", "RGPD"],
                    ["consentementPartage", "Partage simulation"],
                    ["conseillerPrenom", "Prénom Référent"],
                    ["conseillerNom", "Nom Référent"],
                    ["conseillerTelephone", "Tél Référent"],
                    ["conseillerEmail", "Mail Référent"],
                  ] as const).map(([cle, libelle]) => (
                    <th key={cle} className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => basculerTri(cle)}
                        className="flex items-center gap-1 hover:text-[#EA601F] transition-colors cursor-pointer"
                        title={`Trier par ${libelle}`}
                      >
                        <span>{libelle}</span>
                        {tri?.colonne === cle ? (
                          tri.direction === "asc" ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
                        ) : (
                          <ChevronUpDownIcon className="w-3 h-3 opacity-30" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {inscriptionsFiltrees.length > 0 ? (
                  inscriptionsFiltrees.map((i, index) => {
                    const prescripteur = i.Structure_Accompagnement === "Autre" ? (i.Structure_Autre || "Autre") : (i.Structure_Accompagnement || "");
                    return (
                      <tr key={i.id} className="hover:bg-[#F3F3F2]/60 transition-colors align-top">
                        {onglet === "doublons" && (
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selection.has(i.id)}
                              onChange={() => basculerSelection(i.id)}
                              className="w-4 h-4 accent-[#EA601F] cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={i.Suivi_Recrutement || false}
                            onChange={(e) => basculerSuiviRecrutement(i.id, e.target.checked)}
                            title="Affecter au suivi de recrutement de sa session"
                            className="w-4 h-4 accent-[#EA601F] cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={i.Session || ""}
                            onChange={(e) => mettreAJourChamp(i.id, "Session", e.target.value)}
                            className={inputEditClass}
                          >
                            <option value="">-- Choisir une session --</option>
                            {i.Session && !Object.values(sessionsParTerritoire).some((dates) => dates.includes(i.Session as string)) && (
                              <option value={i.Session}>{i.Session}</option>
                            )}
                            {Object.entries(sessionsParTerritoire).map(([territoire, dates]) => (
                              <optgroup key={territoire} label={`Territoire ${territoire}`}>
                                {dates.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => ouvrirEdition(i)}
                            title="Modifier cette fiche"
                            className="p-1.5 rounded-lg text-[#404040]/40 hover:text-white hover:bg-[#005259] transition-colors cursor-pointer"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => supprimerInscription(i)}
                            title="Supprimer définitivement cette préinscription"
                            className="p-1.5 rounded-lg text-[#404040]/40 hover:text-white hover:bg-[#C0392B] transition-colors cursor-pointer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Civilité || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{i.Prénom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">
                          {i.Nom || "—"}
                          {infosDoublons.has(i.id) && (
                            <span
                              title="Fait partie d'un groupe de doublons probable (même email, ou même nom+prénom+téléphone)"
                              className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-[#EA601F]/15 text-[#EA601F] text-[9px] font-bold normal-case align-middle"
                            >
                              ×{infosDoublons.get(i.id)?.taille}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Téléphone || "—"}</td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {i.Age ? (
                            estMineur(i.Age) ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-[#F9C44E]/20 text-[#005259] border border-[#F9C44E] text-[10px] font-bold">{i.Age}</span>
                            ) : i.Age
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 max-w-[180px] truncate">{i.Email || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Niveau_Etudes || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{sexeDeCivilite(i.Civilité)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Ville || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Code_Postal || "—"}</td>
                        <td className="px-3 py-2 text-center">{i.Territoire || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.QPV || "—"}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={i.Parcours}>{i.Parcours || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={prescripteur}>{prescripteur || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Situation_Handicap || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.RQTH || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.RSA || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.NEET || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.CEJ || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.France_Travail || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Identifiant_France_Travail || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={i.Comment_Connu}>{i.Comment_Connu || "—"}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate" title={i.Projet_Professionnel}>{i.Projet_Professionnel || "—"}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate" title={i.Formation_Acces}>{i.Formation_Acces || "—"}</td>
                        <td className="px-3 py-2 text-center">{i.RGPD ? "Oui" : "Non"}</td>
                        <td className="px-3 py-2 text-center">{i.Consentement_Partage_Simulation ? "Oui" : "Non"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Prenom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Nom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Telephone || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate">{i.Conseiller_Email || "—"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={onglet === "doublons" ? 35 : 34} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                      🔍 Aucune inscription trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* PANNEAU D'ÉDITION DE FICHE */}
      {edition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#404040]/40 backdrop-blur-sm" onClick={fermerEdition}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#404040]/10">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#005259]">
                Modifier la fiche de {edition.Prénom || ""} {edition.Nom || ""}
              </h2>
              <button type="button" onClick={fermerEdition} className="p-1.5 rounded-lg text-[#404040]/50 hover:bg-[#F3F3F2] cursor-pointer">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Civilité</label>
                <select value={edition.Civilité || ""} onChange={(e) => majEdition("Civilité", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="M.">M.</option>
                  <option value="Mme">Mme</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Prénom</label>
                <input type="text" value={edition.Prénom || ""} onChange={(e) => majEdition("Prénom", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Nom</label>
                <input type="text" value={edition.Nom || ""} onChange={(e) => majEdition("Nom", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Téléphone</label>
                <input type="text" value={edition.Téléphone || ""} onChange={(e) => majEdition("Téléphone", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Âge</label>
                <input type="text" value={edition.Age || ""} onChange={(e) => majEdition("Age", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Email</label>
                <input type="text" value={edition.Email || ""} onChange={(e) => majEdition("Email", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Niveau d'études</label>
                <select value={edition.Niveau_Etudes || ""} onChange={(e) => majEdition("Niveau_Etudes", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  {NIVEAUX_ETUDES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Code postal</label>
                <input type="text" value={edition.Code_Postal || ""} onChange={(e) => majEdition("Code_Postal", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Ville</label>
                <input type="text" value={edition.Ville || ""} onChange={(e) => majEdition("Ville", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Territoire</label>
                <select value={edition.Territoire || ""} onChange={(e) => majEdition("Territoire", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  {territoiresListe.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">QPV</label>
                <select value={edition.QPV || ""} onChange={(e) => majEdition("QPV", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                  <option value="Je ne sais pas">Je ne sais pas</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Parcours</label>
                <select value={edition.Parcours || ""} onChange={(e) => majEdition("Parcours", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  {edition.Parcours && !parcoursListe.some((p) => p.label === edition.Parcours) && (
                    <option value={edition.Parcours}>{edition.Parcours}</option>
                  )}
                  {parcoursListe.map((p) => (
                    <option key={p.id} value={p.label}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Situation de handicap ?</label>
                <select value={edition.Situation_Handicap || ""} onChange={(e) => majEdition("Situation_Handicap", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">RQTH ?</label>
                <select value={edition.RQTH || ""} onChange={(e) => majEdition("RQTH", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">NEET ?</label>
                <select value={edition.NEET || ""} onChange={(e) => majEdition("NEET", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">CEJ ?</label>
                <select value={edition.CEJ || ""} onChange={(e) => majEdition("CEJ", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">RSA ?</label>
                <select value={edition.RSA || ""} onChange={(e) => majEdition("RSA", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Inscrit·e à France Travail ?</label>
                <select value={edition.France_Travail || ""} onChange={(e) => majEdition("France_Travail", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              {edition.France_Travail === "Oui" && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Identifiant France Travail</label>
                  <input type="text" value={edition.Identifiant_France_Travail || ""} onChange={(e) => majEdition("Identifiant_France_Travail", e.target.value)} className={inputEditClass} />
                </div>
              )}
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-[11px] font-medium text-[#404040]">
                  <input type="checkbox" checked={edition.RGPD || false} onChange={(e) => majEdition("RGPD", e.target.checked)} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                  Consentement RGPD
                </label>
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-[11px] font-medium text-[#404040]">
                  <input type="checkbox" checked={edition.Consentement_Partage_Simulation || false} onChange={(e) => majEdition("Consentement_Partage_Simulation", e.target.checked)} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                  Consentement partage simulation
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Comment connu·e</label>
                <input type="text" value={edition.Comment_Connu || ""} onChange={(e) => majEdition("Comment_Connu", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Structure d'accompagnement</label>
                <select value={edition.Structure_Accompagnement || ""} onChange={(e) => majEdition("Structure_Accompagnement", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  {STRUCTURES_ACCOMPAGNEMENT.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {edition.Structure_Accompagnement === "Autre" && (
                  <input
                    type="text"
                    value={edition.Structure_Autre || ""}
                    onChange={(e) => majEdition("Structure_Autre", e.target.value)}
                    placeholder="Préciser la structure"
                    className={`${inputEditClass} mt-2`}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Projet professionnel</label>
                <textarea value={edition.Projet_Professionnel || ""} onChange={(e) => majEdition("Projet_Professionnel", e.target.value)} rows={3} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Formation — accès au projet</label>
                <textarea value={edition.Formation_Acces || ""} onChange={(e) => majEdition("Formation_Acces", e.target.value)} rows={3} className={inputEditClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Prénom référent</label>
                <input type="text" value={edition.Conseiller_Prenom || ""} onChange={(e) => majEdition("Conseiller_Prenom", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Nom référent</label>
                <input type="text" value={edition.Conseiller_Nom || ""} onChange={(e) => majEdition("Conseiller_Nom", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Téléphone référent</label>
                <input type="text" value={edition.Conseiller_Telephone || ""} onChange={(e) => majEdition("Conseiller_Telephone", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Email référent</label>
                <input type="text" value={edition.Conseiller_Email || ""} onChange={(e) => majEdition("Conseiller_Email", e.target.value)} className={inputEditClass} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#404040]/10">
              <button
                type="button"
                onClick={fermerEdition}
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-[#404040]/60 hover:bg-[#F3F3F2] transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={enregistrerEdition}
                disabled={enregistrementEnCours}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-50 text-white transition-colors cursor-pointer"
              >
                {enregistrementEnCours ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </PageGuard>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, MagnifyingGlassIcon, AcademicCapIcon, ChevronUpIcon, ChevronDownIcon, ChevronUpDownIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import SessionSelect from "@/components/SessionSelect";

// Champs issus du formulaire de pré-inscription (lecture seule ici — ce sont
// les réponses telles que soumises).
interface Inscription {
  id: string;
  Civilité?: string;
  Nom?: string;
  Prénom?: string;
  Téléphone?: string;
  Age?: string;
  Email?: string;
  Niveau_Etudes?: string;
  Ville?: string;
  Territoire?: string;
  QPV?: string;
  Structures_Accompagnement?: string[];
  Structure_Autre?: string;
  ASE?: string;
  Conseiller_Prenom?: string;
  Conseiller_Nom?: string;
  Conseiller_Telephone?: string;
  Conseiller_Email?: string;
  Session?: string;
  // Coché sur /reponses/numerik-up : détermine si la personne apparaît ici,
  // sur la page de suivi détaillé de sa session.
  Suivi_Recrutement?: boolean;
  // Champs de suivi de recrutement, renseignés par l'équipe après coup —
  // absents du formulaire d'origine, ajoutés/modifiés directement ici.
  Critere_Preinscription_Respecte?: string;
  Commentaire_Suivi_Recrutement?: string;
  Date_Mail_Preinscription?: string;
  Pix_Badges_Etoiles?: string;
  // Campagne Pix, éclatée en 3 colonnes (voir le groupe d'en-tête "Campagne
  // Pix") — remplace l'ancien champ combiné Pix_Badges_Etoiles ci-dessus,
  // conservé tel quel pour ne pas perdre les données déjà saisies (toujours
  // affiché sur la fiche apprenant·e).
  Pix_Badge?: string;
  Pix_Etoile?: string;
  Abandon_Avant_Parkour?: string;
  Date_Relance_Pix_1?: string;
  Date_Relance_Pix_2?: string;
  Date_Relance_Pix_3?: string;
  Completion_Pix?: string;
  Appel_Avant_Parkour?: string;
  CV_Recu?: string;
  OK_NOK?: string;
  Date_Mail_Parkour?: string;
  // Case CV de la page Apprenant·e·s (suivi pédagogique E2C) — cochée
  // automatiquement quand CV_Recu passe à "Oui", voir mettreAJourChamp.
  E2C_CV?: boolean;
}

const inputEditClass = "w-full min-w-[140px] px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] focus:bg-white rounded-lg text-[11px] text-[#404040] outline-none font-medium transition-colors";

// Ouvre un brouillon Gmail pré-rempli avec le destinataire dans un nouvel
// onglet — c'est ensuite l'utilisateur·rice qui relit et clique "Envoyer"
// depuis son propre compte Gmail (pas d'envoi automatique, pas d'identifiants
// à stocker côté serveur).
function ouvrirGmail(email?: string) {
  if (!email) return;
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`, "_blank", "noopener,noreferrer");
}


// Colonnes figées (#, Civilité, Prénom, Nom, Téléphone) — restent visibles
// pendant le défilement horizontal du tableau, très large avec ses colonnes
// de suivi. Les colonnes gardent leur largeur naturelle (auto, comme le
// reste du tableau) : on mesure leur position réelle après rendu plutôt que
// de figer une largeur en dur, qui désynchronisait "left" du contenu réel.
const classeFigee = "sticky z-10";
const ombreDerniereFigee = "shadow-[6px_0_8px_-6px_rgba(0,0,0,0.25)]";

// Signale les mineur·e·s avec le même jaune que les groupes ACI de l'agenda.
const estMineur = (age?: string) => {
  const n = parseInt(age || "", 10);
  return !isNaN(n) && n < 18;
};

// Duplicata de reponses/numerik-up, paramétré par un identifiant de session :
// n'affiche que les personnes affectées à cette session précise (case
// "Suivi recrutement" cochée sur la page générale des réponses).
export default function ReponsesNumerikUpSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = decodeURIComponent((params?.id as string) || "");

  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  // "en_attente" = pas encore de décision (OK_NOK vide) ; "affectes" = décision
  // déjà prise (OK ou NOK) — cliquer sur OK/NOK fait donc disparaître la ligne
  // de l'onglet "en attente" sans avoir à la supprimer.
  const [onglet, setOnglet] = useState<"en_attente" | "affectes">("en_attente");
  // Tri sur la colonne Nom — asc -> desc -> retour à l'ordre par défaut.
  const [triNom, setTriNom] = useState<"asc" | "desc" | null>(null);
  const basculerTriNom = () => {
    setTriNom((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
  };
  // sessions[parcoursId][territoire] = liste de dates de session, telles que
  // définies sur la page de paramètres — sert de source pour les sélecteurs.
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});
  // codes["parcoursId|territoire|date"] = code interne défini sur la page de
  // paramètres — jamais affiché sur le formulaire public, mais utile ici pour
  // identifier une session sans avoir à lire ses dates en toutes lettres.
  const [codes, setCodes] = useState<Record<string, string>>({});

  // Décalages "left" des colonnes figées, calculés à partir de la largeur
  // réelle (offsetWidth) de chaque colonne — offsetLeft est peu fiable à
  // l'intérieur d'un <table> (offsetParent ambigu selon les navigateurs), on
  // additionne donc nous-mêmes les largeurs mesurées des colonnes qui précèdent.
  const refNum = useRef<HTMLTableCellElement>(null);
  const refCivilite = useRef<HTMLTableCellElement>(null);
  const refPrenom = useRef<HTMLTableCellElement>(null);
  const refNom = useRef<HTMLTableCellElement>(null);
  const refTelephone = useRef<HTMLTableCellElement>(null);
  const [decalages, setDecalages] = useState({ num: 0, civilite: 0, prenom: 0, nom: 0, telephone: 0 });

  useEffect(() => {
    const mesurer = () => {
      const largeurNum = refNum.current?.offsetWidth || 0;
      const largeurCivilite = refCivilite.current?.offsetWidth || 0;
      const largeurPrenom = refPrenom.current?.offsetWidth || 0;
      const largeurNom = refNom.current?.offsetWidth || 0;
      const suivant = {
        num: 0,
        civilite: largeurNum,
        prenom: largeurNum + largeurCivilite,
        nom: largeurNum + largeurCivilite + largeurPrenom,
        telephone: largeurNum + largeurCivilite + largeurPrenom + largeurNom,
      };
      // Ne déclenche un nouveau rendu que si les valeurs mesurées ont
      // réellement changé — sans cet garde, l'effet (sans tableau de
      // dépendances, pour se remesurer si le contenu change) provoque une
      // boucle de rendu infinie (setState -> rendu -> effet -> setState...).
      setDecalages((prev) =>
        prev.civilite === suivant.civilite && prev.prenom === suivant.prenom && prev.nom === suivant.nom && prev.telephone === suivant.telephone
          ? prev
          : suivant
      );
    };
    mesurer();
    window.addEventListener("resize", mesurer);
    return () => window.removeEventListener("resize", mesurer);
  });

  // Barre de défilement horizontal dupliquée en haut du tableau — synchronisée
  // avec le défilement réel pour éviter d'avoir à descendre tout en bas
  // (même mécanisme que sur les pages Réponses).
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
        const [snapInscriptions, snapSessions] = await Promise.all([
          getDocs(query(collection(db, "inscriptions_numerikup"), orderBy("createdAt", "desc"))),
          getDoc(doc(db, "configuration_numerikup", "sessions")),
        ]);
        setInscriptions(snapInscriptions.docs.map((d) => ({ id: d.id, ...d.data() } as Inscription)));
        if (snapSessions.exists()) {
          setSessions(snapSessions.data().parTerritoire || {});
          setCodes(snapSessions.data().codes || {});
        }
      } catch (error) {
        console.error("Erreur lors du chargement des inscriptions Numérik'UP :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  // Seules les personnes affectées à cette session (case "Suivi
  // recrutement" cochée sur la page générale) apparaissent ici.
  const inscriptionsSession = useMemo(
    () => inscriptions.filter((i) => i.Session === sessionId && i.Suivi_Recrutement),
    [inscriptions, sessionId]
  );

  // Territoire(s) auxquels appartient la session sélectionnée, d'après la
  // configuration définie sur la page de paramètres.
  const territoireDeSession = useMemo(() => {
    const trouves = new Set<string>();
    Object.values(sessions).forEach((parTerritoire) => {
      Object.entries(parTerritoire).forEach(([territoire, dates]) => {
        if (dates.includes(sessionId)) trouves.add(territoire);
      });
    });
    return Array.from(trouves).join(" / ");
  }, [sessions, sessionId]);

  const changerSession = (nouvelleSession: string) => {
    router.push(`/mediation/actions-collectives/reponses/numerik-up/${encodeURIComponent(nouvelleSession)}`);
  };

  // Retrouve le code interne d'une session à partir de sa date, en cherchant
  // le parkours/territoire auquel elle appartient — les codes sont
  // enregistrés par "parcoursId|territoire|date" sur la page de paramètres.
  // Retombe sur la date si aucun code n'a encore été généré.
  const codeDeSession = (date: string) => {
    for (const [parcoursId, parTerritoire] of Object.entries(sessions)) {
      for (const [territoire, dates] of Object.entries(parTerritoire)) {
        if (dates.includes(date)) return codes[`${parcoursId}|${territoire}|${date}`] || date;
      }
    }
    return date;
  };

  // Toutes les sessions, tous territoires et parkours confondus — le code
  // interne identifie déjà la session sans ambiguïté (il encode le
  // territoire, ex. "MN26_NKUP-91_01"), donc plus besoin de filtrer par
  // territoire pour la retrouver.
  const toutesLesSessions = useMemo(
    () => Array.from(new Set(Object.values(sessions).flatMap((parTerritoire) => Object.values(parTerritoire).flat()))).sort((a, b) => codeDeSession(a).localeCompare(codeDeSession(b), "fr")),
    [sessions, codes]
  );

  const inscriptionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    const resultat = inscriptionsSession.filter((i) => {
      if (onglet === "en_attente" && i.OK_NOK) return false;
      if (onglet === "affectes" && !i.OK_NOK) return false;
      if (terme && !`${i.Prénom || ""} ${i.Nom || ""}`.toLowerCase().includes(terme)) return false;
      return true;
    });
    if (triNom) {
      const dir = triNom === "asc" ? 1 : -1;
      return [...resultat].sort((a, b) => (a.Nom || "").localeCompare(b.Nom || "", "fr") * dir);
    }
    return resultat;
  }, [inscriptionsSession, recherche, onglet, triNom]);

  // Mise à jour optimiste locale + écriture Firestore d'un seul champ de
  // suivi — chaque cellule éditable enregistre indépendamment des autres.
  const mettreAJourChamp = async (id: string, champ: keyof Inscription, valeur: string) => {
    // Un CV reçu ici coche automatiquement la case CV de la page
    // Apprenant·e·s (même document) — évite d'avoir à cocher les deux.
    const champs: Record<string, string | boolean> = { [champ]: valeur };
    if (champ === "CV_Recu" && valeur === "Oui") {
      champs.E2C_CV = true;
    }
    setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, ...champs } : i)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikup", id), champs);
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du champ ${champ} :`, error);
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
                Préinscriptions <span className="text-[#EA601F] font-semibold">Numérik'UP</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Session : {sessionId ? codeDeSession(sessionId) : "—"}{territoireDeSession && ` — Territoire : ${territoireDeSession}`} — {inscriptionsSession.length} inscription{inscriptionsSession.length > 1 ? "s" : ""} affectée{inscriptionsSession.length > 1 ? "s" : ""} au suivi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {toutesLesSessions.length > 0 && (
              <SessionSelect
                value={sessionId}
                options={!toutesLesSessions.includes(sessionId) && sessionId ? [sessionId, ...toutesLesSessions] : toutesLesSessions}
                resoudreLabel={codeDeSession}
                onChange={(s) => s && changerSession(s)}
              />
            )}
            <Link
              href="/mediation/actions-collectives/reponses/numerik-up"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Réponses</span>
            </Link>
            <Link
              href={`/mediation/actions-collectives/reponses/numerik-up/${encodeURIComponent(sessionId)}/apprenants`}
              className="flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white px-3.5 py-2 rounded-xl transition-colors text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <AcademicCapIcon className="w-4 h-4" />
              <span>Apprenant·e·s</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>
        </div>

        {/* BASCULE EN ATTENTE / AFFECTÉ·E·S + RECHERCHE */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="inline-flex bg-white border border-[#404040]/10 rounded-2xl p-1.5 shadow-sm w-fit">
            <button
              type="button"
              onClick={() => setOnglet("en_attente")}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${onglet === "en_attente" ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/60 hover:text-[#005259]"}`}
            >
              En attente ({inscriptionsSession.filter((i) => !i.OK_NOK).length})
            </button>
            <button
              type="button"
              onClick={() => setOnglet("affectes")}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${onglet === "affectes" ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/60 hover:text-[#005259]"}`}
            >
              Affecté·e·s ({inscriptionsSession.filter((i) => i.OK_NOK).length})
            </button>
          </div>
          <div className="relative group flex-1 max-w-md">
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
        </div>

        {/* BARRE DE DÉFILEMENT HORIZONTAL (haut) — collée en haut de l'écran
            au défilement vertical, sinon elle sort du cadre et devient
            inutilisable dès qu'on descend dans le tableau. */}
        <div ref={scrollHautRef} onScroll={surScrollHaut} className="sticky top-0 z-30 bg-[#F3F3F2] py-1.5 overflow-x-auto overflow-y-hidden">
          <div style={{ width: largeurTable, height: 1 }}></div>
        </div>

        {/* TABLEAU */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <div ref={scrollTableRef} onScroll={surScrollTable} className="overflow-x-auto">
            {/* border-separate (et non border-collapse) : indispensable pour que les
                colonnes figées (position: sticky) masquent correctement le contenu
                des colonnes défilantes qui passent dessous — avec border-collapse,
                les navigateurs laissent transparaître ce contenu par-dessous. */}
            <table className="border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th ref={refNum} rowSpan={2} className={`${classeFigee} px-3 py-3 text-center bg-[#F3F3F2] align-bottom`} style={{ left: decalages.num }}>#</th>
                  <th ref={refCivilite} rowSpan={2} className={`${classeFigee} px-3 py-3 bg-[#F3F3F2] align-bottom`} style={{ left: decalages.civilite }}>Civilité</th>
                  <th ref={refPrenom} rowSpan={2} className={`${classeFigee} px-3 py-3 bg-[#F3F3F2] align-bottom`} style={{ left: decalages.prenom }}>Prénom</th>
                  <th ref={refNom} rowSpan={2} className={`${classeFigee} px-3 py-3 bg-[#F3F3F2] align-bottom`} style={{ left: decalages.nom }}>
                    <button type="button" onClick={basculerTriNom} className="flex items-center gap-1 cursor-pointer">
                      <span>Nom</span>
                      {triNom === "asc" ? <ChevronUpIcon className="w-3 h-3" /> : triNom === "desc" ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronUpDownIcon className="w-3 h-3 opacity-30" />}
                    </button>
                  </th>
                  <th ref={refTelephone} rowSpan={2} className={`${classeFigee} ${ombreDerniereFigee} px-3 py-3 bg-[#F3F3F2] align-bottom`} style={{ left: decalages.telephone }}>Téléphone</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">Âge</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">Diplôme</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">Dpt.</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">QPV</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">Prescripteur</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">ASE ?</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">Critères pré-inscription respecté ?</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">Commentaires de suivi de recrutement</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">Date - Mail envoyé Préinscription</th>
                  <th colSpan={3} className="px-3 py-2 text-center border-b border-[#404040]/10">Campagne Pix</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">CV reçu</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">Abandon avant Parkour</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">OK / NOK</th>
                  <th rowSpan={2} className="px-3 py-3 align-bottom">Date - Mail envoyé Parkour (Lieu, début, horaire)</th>
                </tr>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-3 py-2">Badge</th>
                  <th className="px-3 py-2">Étoile</th>
                  <th className="px-3 py-2">Pourcentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {inscriptionsFiltrees.length > 0 ? (
                  inscriptionsFiltrees.map((i, index) => {
                    const prescripteur = [...(i.Structures_Accompagnement || []), i.Structure_Autre].filter(Boolean).join(", ");
                    // Repère visuellement les candidat·e·s orienté·e·s par
                    // l'E2C — y compris les colonnes figées, qui portent leur
                    // propre fond opaque pour masquer le contenu défilant en
                    // dessous et ne peuvent donc pas hériter du fond de <tr>.
                    const estE2C = prescripteur.toUpperCase().includes("E2C");
                    const fondFigee = estE2C ? "bg-[#F5EEFF] group-hover:bg-[#7C1FD1]/10" : "bg-white group-hover:bg-[#F3F3F2]/60";
                    return (
                      <tr key={i.id} className={`group transition-colors align-top ${estE2C ? "bg-[#7C1FD1]/5 hover:bg-[#7C1FD1]/10" : "hover:bg-[#F3F3F2]/60"}`}>
                        <td className={`${classeFigee} px-3 py-2 text-center text-[#404040]/50 font-bold ${fondFigee}`} style={{ left: decalages.num }}>{index + 1}</td>
                        <td className={`${classeFigee} px-3 py-2 whitespace-nowrap ${fondFigee}`} style={{ left: decalages.civilite }}>{i.Civilité || "—"}</td>
                        <td className={`${classeFigee} px-3 py-2 whitespace-nowrap font-bold text-[#005259] ${fondFigee}`} style={{ left: decalages.prenom }}>{i.Prénom || "—"}</td>
                        <td className={`${classeFigee} px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase ${fondFigee}`} style={{ left: decalages.nom }}>
                          <Link href={`/mediation/actions-collectives/reponses/numerik-up/${encodeURIComponent(sessionId)}/apprenants/${i.id}`} className="hover:text-[#EA601F] hover:underline transition-colors">
                            {i.Nom || "—"}
                          </Link>
                        </td>
                        <td className={`${classeFigee} ${ombreDerniereFigee} px-3 py-2 whitespace-nowrap ${fondFigee}`} style={{ left: decalages.telephone }}>{i.Téléphone || "—"}</td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {i.Age ? (
                            estMineur(i.Age) ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-[#F9C44E]/20 text-[#005259] border border-[#F9C44E] text-[10px] font-bold">{i.Age}</span>
                            ) : i.Age
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Niveau_Etudes || "—"}</td>
                        <td className="px-3 py-2 text-center">{i.Territoire || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.QPV || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={prescripteur}>{prescripteur || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.ASE || "—"}</td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Critere_Preinscription_Respecte || ""} onChange={(e) => mettreAJourChamp(i.id, "Critere_Preinscription_Respecte", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Commentaire_Suivi_Recrutement || ""} onBlur={(e) => mettreAJourChamp(i.id, "Commentaire_Suivi_Recrutement", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <input type="date" defaultValue={i.Date_Mail_Preinscription || ""} onChange={(e) => mettreAJourChamp(i.id, "Date_Mail_Preinscription", e.target.value)} className={inputEditClass} />
                            <button
                              type="button"
                              onClick={() => ouvrirGmail(i.Email)}
                              disabled={!i.Email}
                              title={i.Email ? `Ouvrir Gmail vers ${i.Email}` : "Aucun email renseigné"}
                              className="shrink-0 p-1.5 rounded-lg bg-[#F3F3F2] text-[#005259] hover:bg-[#005259] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <EnvelopeIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Pix_Badge || ""} onBlur={(e) => mettreAJourChamp(i.id, "Pix_Badge", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Pix_Etoile || ""} onBlur={(e) => mettreAJourChamp(i.id, "Pix_Etoile", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Completion_Pix || ""} onBlur={(e) => mettreAJourChamp(i.id, "Completion_Pix", e.target.value)} placeholder="Ex : 80%" className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.CV_Recu || ""} onChange={(e) => mettreAJourChamp(i.id, "CV_Recu", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Abandon_Avant_Parkour || ""} onChange={(e) => mettreAJourChamp(i.id, "Abandon_Avant_Parkour", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.OK_NOK || ""} onChange={(e) => mettreAJourChamp(i.id, "OK_NOK", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="OK">OK</option>
                            <option value="NOK">NOK</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <input type="date" defaultValue={i.Date_Mail_Parkour || ""} onChange={(e) => mettreAJourChamp(i.id, "Date_Mail_Parkour", e.target.value)} className={inputEditClass} />
                            {/* Bouton mail masqué en attendant le modèle du mail "Parkour"
                                (sera rattaché à un autre modèle que celui de préinscription,
                                voir reponses/numerik-up/page.tsx) — décommenter une fois
                                le texte fourni.
                            <button
                              type="button"
                              onClick={() => ouvrirGmail(i.Email)}
                              disabled={!i.Email}
                              title={i.Email ? `Ouvrir Gmail vers ${i.Email}` : "Aucun email renseigné"}
                              className="shrink-0 p-1.5 rounded-lg bg-[#F3F3F2] text-[#005259] hover:bg-[#005259] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <EnvelopeIcon className="w-3.5 h-3.5" />
                            </button>
                            */}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={20} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                      🔍 Aucune inscription trouvée.
                    </td>
                  </tr>
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

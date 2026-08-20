"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, MagnifyingGlassIcon, AcademicCapIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

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
  // Coché sur /reponses/digital-up : détermine si la personne apparaît ici,
  // sur la page de suivi détaillé de sa session.
  Suivi_Recrutement?: boolean;
  // Champs de suivi de recrutement, renseignés par l'équipe après coup —
  // absents du formulaire d'origine, ajoutés/modifiés directement ici.
  Critere_Preinscription_Respecte?: string;
  Commentaire_Suivi_Recrutement?: string;
  Date_Mail_Preinscription?: string;
  Pix_Badges_Etoiles?: string;
  Abandon_Avant_Parkour?: string;
  Date_Relance_Pix_1?: string;
  Date_Relance_Pix_2?: string;
  Date_Relance_Pix_3?: string;
  Completion_Pix?: string;
  Appel_Avant_Parkour?: string;
  CV_Recu?: string;
  OK_NOK?: string;
  Date_Mail_Parkour?: string;
}

const inputEditClass = "w-full min-w-[140px] px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] focus:bg-white rounded-lg text-[11px] text-[#404040] outline-none font-medium transition-colors";

const TERRITOIRES_DEFAUT = ["91", "92", "Autres"];

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

// Duplicata de reponses/digital-up, paramétré par un identifiant de session :
// n'affiche que les personnes affectées à cette session précise (case
// "Suivi recrutement" cochée sur la page générale des réponses).
export default function ReponsesDigitalUpSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = decodeURIComponent((params?.id as string) || "");

  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  // sessions[parcoursId][territoire] = liste de dates de session, telles que
  // définies sur la page de paramètres — sert de source pour les sélecteurs.
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});
  const [territoiresListe, setTerritoiresListe] = useState<string[]>(TERRITOIRES_DEFAUT);
  const [territoireSelectionne, setTerritoireSelectionne] = useState("");

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
        const [snapInscriptions, snapSessions, snapTerritoires] = await Promise.all([
          getDocs(query(collection(db, "inscriptions_digitalup"), orderBy("createdAt", "desc"))),
          getDoc(doc(db, "configuration_digitalup", "sessions")),
          getDoc(doc(db, "configuration_digitalup", "territoires")),
        ]);
        setInscriptions(snapInscriptions.docs.map((d) => ({ id: d.id, ...d.data() } as Inscription)));
        if (snapSessions.exists()) {
          setSessions(snapSessions.data().parTerritoire || {});
        }
        if (snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0) {
          setTerritoiresListe(snapTerritoires.data().liste);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des inscriptions Digital'UP :", error);
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

  // Initialise le territoire sélectionné sur celui de la session en cours
  // dès que la configuration est chargée, sinon le premier disponible.
  // Synchronise toujours le territoire affiché sur celui de la session en
  // cours dès qu'il est connu — sans ce "toujours" (et avec un simple garde
  // "si déjà défini, ne pas y toucher"), changer de territoire déclenchait
  // une navigation vers une nouvelle session dont les données arrivent après
  // le rendu : le repli sur territoiresListe[0] ("91") se posait en premier
  // et restait bloqué, empêchant la vraie valeur de session de s'appliquer.
  useEffect(() => {
    if (territoireDeSession) {
      setTerritoireSelectionne(territoireDeSession.split(" / ")[0]);
    } else if (territoiresListe.length > 0 && !territoireSelectionne) {
      setTerritoireSelectionne(territoiresListe[0]);
    }
  }, [territoireDeSession, territoiresListe]);

  // Sessions du territoire sélectionné, tous parkours confondus — reprend
  // la configuration définie sur la page de paramètres.
  const sessionsDuTerritoire = useMemo(
    () => Array.from(new Set(Object.values(sessions).flatMap((parTerritoire) => parTerritoire[territoireSelectionne] || []))).sort((a, b) => a.localeCompare(b, "fr")),
    [sessions, territoireSelectionne]
  );

  const changerSession = (nouvelleSession: string) => {
    router.push(`/mediation/rencontres-numeriques/actions-collectives/reponses/digital-up/${encodeURIComponent(nouvelleSession)}`);
  };

  // Changer de territoire bascule automatiquement sur sa première session,
  // puisque la session affichée doit toujours appartenir au territoire choisi.
  const changerTerritoire = (nouveauTerritoire: string) => {
    setTerritoireSelectionne(nouveauTerritoire);
    const datesDuTerritoire = Array.from(new Set(Object.values(sessions).flatMap((parTerritoire) => parTerritoire[nouveauTerritoire] || []))).sort((a, b) => a.localeCompare(b, "fr"));
    if (datesDuTerritoire.length > 0) {
      changerSession(datesDuTerritoire[0]);
    }
  };

  const inscriptionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return inscriptionsSession;
    return inscriptionsSession.filter((i) => `${i.Prénom || ""} ${i.Nom || ""}`.toLowerCase().includes(terme));
  }, [inscriptionsSession, recherche]);

  // Mise à jour optimiste locale + écriture Firestore d'un seul champ de
  // suivi — chaque cellule éditable enregistre indépendamment des autres.
  const mettreAJourChamp = async (id: string, champ: keyof Inscription, valeur: string) => {
    setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, [champ]: valeur } : i)));
    try {
      await updateDoc(doc(db, "inscriptions_digitalup", id), { [champ]: valeur });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du champ ${champ} :`, error);
    }
  };

  const sexeDeCivilite = (civilite?: string) => (civilite === "Mme" ? "Femme" : civilite === "M." ? "Homme" : "—");

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
                Préinscriptions <span className="text-[#EA601F] font-semibold">Digital'UP</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Session : {sessionId || "—"}{territoireDeSession && ` — Territoire : ${territoireDeSession}`} — {inscriptionsSession.length} inscription{inscriptionsSession.length > 1 ? "s" : ""} affectée{inscriptionsSession.length > 1 ? "s" : ""} au suivi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {territoiresListe.length > 0 && (
              <select
                value={territoireSelectionne}
                onChange={(e) => changerTerritoire(e.target.value)}
                className="bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] outline-none font-medium shadow-sm"
              >
                {territoiresListe.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            {sessionsDuTerritoire.length > 0 && (
              <select
                value={sessionId}
                onChange={(e) => changerSession(e.target.value)}
                className="bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] outline-none font-medium shadow-sm max-w-[240px]"
              >
                {!sessionsDuTerritoire.includes(sessionId) && sessionId && (
                  <option value={sessionId}>{sessionId}</option>
                )}
                {sessionsDuTerritoire.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            <Link
              href={`/mediation/rencontres-numeriques/actions-collectives/reponses/digital-up/${encodeURIComponent(sessionId)}/apprenants`}
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

        {/* RECHERCHE */}
        <div className="relative group max-w-md">
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
                  <th ref={refNum} className={`${classeFigee} px-3 py-3 text-center bg-[#F3F3F2]`} style={{ left: decalages.num }}>#</th>
                  <th ref={refCivilite} className={`${classeFigee} px-3 py-3 bg-[#F3F3F2]`} style={{ left: decalages.civilite }}>Civilité</th>
                  <th ref={refPrenom} className={`${classeFigee} px-3 py-3 bg-[#F3F3F2]`} style={{ left: decalages.prenom }}>Prénom</th>
                  <th ref={refNom} className={`${classeFigee} px-3 py-3 bg-[#F3F3F2]`} style={{ left: decalages.nom }}>Nom</th>
                  <th ref={refTelephone} className={`${classeFigee} ${ombreDerniereFigee} px-3 py-3 bg-[#F3F3F2]`} style={{ left: decalages.telephone }}>Téléphone</th>
                  <th className="px-3 py-3">Âge</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Diplôme</th>
                  <th className="px-3 py-3">Sexe</th>
                  <th className="px-3 py-3">Ville</th>
                  <th className="px-3 py-3">Dpt.</th>
                  <th className="px-3 py-3">QPV</th>
                  <th className="px-3 py-3">Prescripteur</th>
                  <th className="px-3 py-3">ASE ?</th>
                  <th className="px-3 py-3">Prénom Référent</th>
                  <th className="px-3 py-3">Nom Référent</th>
                  <th className="px-3 py-3">Tél Référent</th>
                  <th className="px-3 py-3">Mail Référent</th>
                  <th className="px-3 py-3">Critères pré-inscription respecté ?</th>
                  <th className="px-3 py-3">Commentaires de suivi de recrutement</th>
                  <th className="px-3 py-3">Date - Mail envoyé Préinscription</th>
                  <th className="px-3 py-3">Compétences Pix (Badges / Étoiles)</th>
                  <th className="px-3 py-3">Abandon avant Parkour</th>
                  <th className="px-3 py-3">Date 1re relance PIX</th>
                  <th className="px-3 py-3">Date 2e relance PIX</th>
                  <th className="px-3 py-3">Date 3e relance PIX</th>
                  <th className="px-3 py-3">Complétion PIX</th>
                  <th className="px-3 py-3">Appel avant Parkour</th>
                  <th className="px-3 py-3">CV reçu</th>
                  <th className="px-3 py-3">OK / NOK</th>
                  <th className="px-3 py-3">Date - Mail envoyé Parkour (Lieu, début, horaire)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {inscriptionsFiltrees.length > 0 ? (
                  inscriptionsFiltrees.map((i, index) => {
                    const prescripteur = [...(i.Structures_Accompagnement || []), i.Structure_Autre].filter(Boolean).join(", ");
                    return (
                      <tr key={i.id} className="group hover:bg-[#F3F3F2]/60 transition-colors align-top">
                        <td className={`${classeFigee} px-3 py-2 text-center text-[#404040]/50 font-bold bg-white group-hover:bg-[#F3F3F2]/60`} style={{ left: decalages.num }}>{index + 1}</td>
                        <td className={`${classeFigee} px-3 py-2 whitespace-nowrap bg-white group-hover:bg-[#F3F3F2]/60`} style={{ left: decalages.civilite }}>{i.Civilité || "—"}</td>
                        <td className={`${classeFigee} px-3 py-2 whitespace-nowrap font-bold text-[#005259] bg-white group-hover:bg-[#F3F3F2]/60`} style={{ left: decalages.prenom }}>{i.Prénom || "—"}</td>
                        <td className={`${classeFigee} px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase bg-white group-hover:bg-[#F3F3F2]/60`} style={{ left: decalages.nom }}>{i.Nom || "—"}</td>
                        <td className={`${classeFigee} ${ombreDerniereFigee} px-3 py-2 whitespace-nowrap bg-white group-hover:bg-[#F3F3F2]/60`} style={{ left: decalages.telephone }}>{i.Téléphone || "—"}</td>
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
                        <td className="px-3 py-2 text-center">{i.Territoire || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.QPV || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={prescripteur}>{prescripteur || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.ASE || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Prenom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Nom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Telephone || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate">{i.Conseiller_Email || "—"}</td>

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
                          <input type="date" defaultValue={i.Date_Mail_Preinscription || ""} onChange={(e) => mettreAJourChamp(i.id, "Date_Mail_Preinscription", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Pix_Badges_Etoiles || ""} onBlur={(e) => mettreAJourChamp(i.id, "Pix_Badges_Etoiles", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Abandon_Avant_Parkour || ""} onChange={(e) => mettreAJourChamp(i.id, "Abandon_Avant_Parkour", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" defaultValue={i.Date_Relance_Pix_1 || ""} onChange={(e) => mettreAJourChamp(i.id, "Date_Relance_Pix_1", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" defaultValue={i.Date_Relance_Pix_2 || ""} onChange={(e) => mettreAJourChamp(i.id, "Date_Relance_Pix_2", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" defaultValue={i.Date_Relance_Pix_3 || ""} onChange={(e) => mettreAJourChamp(i.id, "Date_Relance_Pix_3", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Completion_Pix || ""} onBlur={(e) => mettreAJourChamp(i.id, "Completion_Pix", e.target.value)} placeholder="Ex : 80%" className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Appel_Avant_Parkour || ""} onChange={(e) => mettreAJourChamp(i.id, "Appel_Avant_Parkour", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.CV_Recu || ""} onChange={(e) => mettreAJourChamp(i.id, "CV_Recu", e.target.value)} className={inputEditClass}>
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
                          <input type="text" defaultValue={i.Date_Mail_Parkour || ""} onBlur={(e) => mettreAJourChamp(i.id, "Date_Mail_Parkour", e.target.value)} placeholder="Lieu, début, horaire" className={inputEditClass} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={30} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
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

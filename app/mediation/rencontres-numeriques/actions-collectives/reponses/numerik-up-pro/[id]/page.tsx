"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, MagnifyingGlassIcon, AcademicCapIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { useToast } from "@/components/ToastProvider";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Champs issus du formulaire de pré-inscription (lecture seule ici — ce sont
// les réponses telles que soumises), puis champs de suivi de recrutement
// propres à Numérik'UP Pro (renseignés par l'équipe à la main, d'après la
// feuille de suivi des candidatures réelle).
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
  Situation_Handicap?: string;
  RQTH?: string;
  RSA?: string;
  France_Travail?: string;
  Identifiant_France_Travail?: string;
  Projet_Professionnel?: string;
  Structure_Accompagnement?: string;
  Structure_Autre?: string;
  Conseiller_Prenom?: string;
  Conseiller_Nom?: string;
  Conseiller_Telephone?: string;
  Conseiller_Email?: string;
  Session?: string;
  // Coché sur /reponses/numerik-up-pro : détermine si la personne apparaît
  // ici, sur la page de suivi détaillé de sa session.
  Suivi_Recrutement?: boolean;
  // Champs de suivi de recrutement propres à Numérik'UP Pro, absents du
  // formulaire d'origine, renseignés à la main par l'équipe directement ici
  // — reprennent la feuille "Suivi_Candidatures" réelle (session Paris 9h-13h).
  Convocation_Info_Collective?: string;
  Date_Convocation_Info_Collective?: string;
  Presence_Info_Collective?: string;
  Convocation_Test_Langue?: string;
  Date_Test_Pix_Langue?: string;
  Presence_Test_Langue?: string;
  A_Un_Ordinateur?: string;
  Attribution_PC_Colombbus?: string;
  Competences_Numeriques?: string;
  Notes_Tests_FR?: string;
  Niveau_B1_Francais?: string;
  Recuperation_CV?: string;
  Date_Heures_Entretien?: string;
  Presence_Entretien?: string;
  Informations_Entretien?: string;
  Fiche_Entretien?: string;
  // Décision réelle de l'équipe (Oui / Non / File d'attente) — distincte de
  // OK_NOK ci-dessous, qui reste le seul champ consulté par les pages
  // Apprenant·e·s / Évolution / Statistiques pour déterminer qui est retenu·e ;
  // OK_NOK n'est donc pas retiré pour ne rien casser en aval.
  Decision?: string;
  Avis_Positif_Negatif?: string;
  A_Confirme?: string;
  OK_NOK?: string;
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

// Duplicata de reponses/numerik-up-pro, paramétré par un identifiant de
// session : n'affiche que les personnes affectées à cette session précise
// (case "Suivi recrutement" cochée sur la page générale des réponses).
export default function ReponsesNumerikUpProSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
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
          getDocs(query(collection(db, "inscriptions_numerikuppro"), orderBy("createdAt", "desc"))),
          getDoc(doc(db, "configuration_numerikuppro", "sessions")),
          getDoc(doc(db, "configuration_numerikuppro", "territoires")),
        ]);
        setInscriptions(snapInscriptions.docs.map((d) => ({ id: d.id, ...d.data() } as Inscription)));
        if (snapSessions.exists()) {
          setSessions(snapSessions.data().parTerritoire || {});
        }
        if (snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0) {
          setTerritoiresListe(snapTerritoires.data().liste);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des inscriptions Numérik'UP Pro :", error);
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
    router.push(`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(nouvelleSession)}`);
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
  // suivi — chaque cellule éditable enregistre indépendamment des autres, et
  // confirme visuellement l'enregistrement (ou l'échec) via un toast.
  const mettreAJourChamp = async (id: string, champ: keyof Inscription, valeur: string) => {
    setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, [champ]: valeur } : i)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", id), { [champ]: valeur });
      showToast("Champ enregistré.");
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du champ ${champ} :`, error);
      showToast("Erreur lors de l'enregistrement du champ.", "error");
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
                Préinscriptions <span className="text-[#EA601F] font-semibold">Numérik'UP Pro</span>
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
              href={`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionId)}/apprenants`}
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
                  <th className="px-3 py-3">Sexe</th>
                  <th className="px-3 py-3">Ville</th>
                  <th className="px-3 py-3">Dpt.</th>
                  <th className="px-3 py-3">QPV</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Situation handicap</th>
                  <th className="px-3 py-3">RQTH</th>
                  <th className="px-3 py-3">RSA</th>
                  <th className="px-3 py-3">Niveau de diplôme</th>
                  <th className="px-3 py-3">Inscrit·e France Travail</th>
                  <th className="px-3 py-3">Identifiant France Travail</th>
                  <th className="px-3 py-3">Intérêt pour la formation</th>
                  <th className="px-3 py-3">Prescripteur</th>
                  <th className="px-3 py-3">Prénom Référent</th>
                  <th className="px-3 py-3">Nom Référent</th>
                  <th className="px-3 py-3">Tél Référent</th>
                  <th className="px-3 py-3">Mail Référent</th>
                  <th className="px-3 py-3">Convocation info collective</th>
                  <th className="px-3 py-3">Date convocation info collective</th>
                  <th className="px-3 py-3">Présence info collective</th>
                  <th className="px-3 py-3">Convocation test langue</th>
                  <th className="px-3 py-3">Convocation test Pix/Langue</th>
                  <th className="px-3 py-3">Présence test langue</th>
                  <th className="px-3 py-3">Ont-ils un ordi ?</th>
                  <th className="px-3 py-3">Attribution PC Colombbus</th>
                  <th className="px-3 py-3">Compétences numériques</th>
                  <th className="px-3 py-3">Notes tests FR</th>
                  <th className="px-3 py-3">Niveau B1 Français ?</th>
                  <th className="px-3 py-3">Récupération CV</th>
                  <th className="px-3 py-3">Date / heures entretien</th>
                  <th className="px-3 py-3">Présence entretien</th>
                  <th className="px-3 py-3">Informations entretien recrutement</th>
                  <th className="px-3 py-3">Fiche d'entretien</th>
                  <th className="px-3 py-3">Décision</th>
                  <th className="px-3 py-3">Avis positif / négatif</th>
                  <th className="px-3 py-3">A confirmé</th>
                  <th className="px-3 py-3">OK / NOK (admission finale)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {inscriptionsFiltrees.length > 0 ? (
                  inscriptionsFiltrees.map((i, index) => {
                    const prescripteur = i.Structure_Accompagnement === "Autre" ? (i.Structure_Autre || "Autre") : (i.Structure_Accompagnement || "");
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
                        <td className="px-3 py-2 whitespace-nowrap">{sexeDeCivilite(i.Civilité)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Ville || "—"}</td>
                        <td className="px-3 py-2 text-center">{i.Territoire || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.QPV || "—"}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate">{i.Email || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Situation_Handicap || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.RQTH || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.RSA || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Niveau_Etudes || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.France_Travail || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Identifiant_France_Travail || "—"}</td>
                        <td className="px-3 py-2 max-w-[220px] truncate" title={i.Projet_Professionnel}>{i.Projet_Professionnel || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={prescripteur}>{prescripteur || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Prenom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Nom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Telephone || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate">{i.Conseiller_Email || "—"}</td>

                        <td className="px-3 py-2">
                          <select defaultValue={i.Convocation_Info_Collective || ""} onChange={(e) => mettreAJourChamp(i.id, "Convocation_Info_Collective", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Date_Convocation_Info_Collective || ""} onBlur={(e) => mettreAJourChamp(i.id, "Date_Convocation_Info_Collective", e.target.value)} placeholder="Date, lieu / lien visio" className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Presence_Info_Collective || ""} onChange={(e) => mettreAJourChamp(i.id, "Presence_Info_Collective", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Convocation_Test_Langue || ""} onChange={(e) => mettreAJourChamp(i.id, "Convocation_Test_Langue", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Date_Test_Pix_Langue || ""} onBlur={(e) => mettreAJourChamp(i.id, "Date_Test_Pix_Langue", e.target.value)} placeholder="Date, lieu" className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Presence_Test_Langue || ""} onChange={(e) => mettreAJourChamp(i.id, "Presence_Test_Langue", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.A_Un_Ordinateur || ""} onChange={(e) => mettreAJourChamp(i.id, "A_Un_Ordinateur", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Attribution_PC_Colombbus || ""} onChange={(e) => mettreAJourChamp(i.id, "Attribution_PC_Colombbus", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Competences_Numeriques || ""} onBlur={(e) => mettreAJourChamp(i.id, "Competences_Numeriques", e.target.value)} placeholder="Ex : 97%" className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Notes_Tests_FR || ""} onBlur={(e) => mettreAJourChamp(i.id, "Notes_Tests_FR", e.target.value)} placeholder="Ex : 18/20" className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Niveau_B1_Francais || ""} onChange={(e) => mettreAJourChamp(i.id, "Niveau_B1_Francais", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Recuperation_CV || ""} onChange={(e) => mettreAJourChamp(i.id, "Recuperation_CV", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Date_Heures_Entretien || ""} onBlur={(e) => mettreAJourChamp(i.id, "Date_Heures_Entretien", e.target.value)} placeholder="Date, heure, avec qui" className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Presence_Entretien || ""} onChange={(e) => mettreAJourChamp(i.id, "Presence_Entretien", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Informations_Entretien || ""} onBlur={(e) => mettreAJourChamp(i.id, "Informations_Entretien", e.target.value)} placeholder="Compte-rendu d'entretien" className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Fiche_Entretien || ""} onBlur={(e) => mettreAJourChamp(i.id, "Fiche_Entretien", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Decision || ""} onChange={(e) => mettreAJourChamp(i.id, "Decision", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                            <option value="File d'attente">File d'attente</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Avis_Positif_Negatif || ""} onBlur={(e) => mettreAJourChamp(i.id, "Avis_Positif_Negatif", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.A_Confirme || ""} onChange={(e) => mettreAJourChamp(i.id, "A_Confirme", e.target.value)} className={inputEditClass}>
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
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={43} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
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

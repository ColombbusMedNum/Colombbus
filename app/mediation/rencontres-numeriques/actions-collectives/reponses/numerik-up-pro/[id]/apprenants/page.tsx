"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, ArrowLeftIcon, MagnifyingGlassIcon, ChartBarIcon, DocumentPlusIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Champs issus du formulaire de pré-inscription (lecture seule ici) + champs
// de suivi pédagogique/administratif renseignés une fois l'apprenant·e
// retenu·e (OK / NOK = "OK" sur la page de suivi de recrutement).
interface Apprenant {
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
  Identifiant_France_Travail?: string;
  Conseiller_Prenom?: string;
  Conseiller_Nom?: string;
  Conseiller_Telephone?: string;
  Conseiller_Email?: string;
  Structure_Accompagnement?: string;
  Structure_Autre?: string;
  Session?: string;
  Suivi_Recrutement?: boolean;
  OK_NOK?: string;
  // Champs de suivi pédagogique/administratif propres au parcours Tech —
  // reprennent la feuille "Apprenant.es" réelle (session Paris 9h-13h).
  Ordinateur_Utilise?: string;
  Planning_Formation?: boolean;
  Programme_Formation?: boolean;
  Acces_Openclassroom?: boolean;
  Convocation_Premier_Jour?: boolean;
  Charte_Engagement?: boolean;
  Reglement_Interieur?: boolean;
  Signature_Droit_Image?: boolean;
  Integration_Kairos?: boolean;
  Validation_Kairos?: boolean;
  Acces_Drive_Apprenant?: boolean;
  Cotisation_Adhesion?: boolean;
  Questionnaire_Positionnement_Entree?: string;
  Questionnaire_Positionnement_Sortie?: string;
  Date_Convocation_PIX_Certification?: string;
  Cle_USB_32G?: boolean;
  Trousse_Outils?: boolean;
  Date_Bilan_Intermediaire?: string;
  Satisfaction_Chaud_Mois1?: boolean;
  Projet_Developpement_Mois2_CV?: boolean;
  Certification_PIX?: boolean;
  Certification_HTML_CSS?: boolean;
  Certification_MYSQL?: boolean;
  Module_Analyse_Risques_SI?: boolean;
  Module_Reseau_TCPIP?: boolean;
  Module_Test_Intrusion_Web?: boolean;
  Formation_Cisco_Cybersecurite?: boolean;
  Cisco_Bases_Materiel?: boolean;
  OC_Monter_PC?: boolean;
  OC_Installer_Windows11?: boolean;
  OC_Decouvrir_Metier_Technicien?: boolean;
  Entretien_Fin_Parcours?: boolean;
  Satisfaction_Chaud_FinSession?: boolean;
  Bilan_Individuel_Envoye?: boolean;
  Satisfaction_Froid_3Mois?: boolean;
  Satisfaction_Froid_6Mois?: boolean;
}

const inputEditClass = "w-full min-w-[70px] px-1.5 py-1 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] focus:bg-white rounded-md text-[11px] text-[#404040] outline-none font-medium transition-colors text-center";
const checkboxClass = "w-4 h-4 accent-[#005259] cursor-pointer";

// Signale les mineur·e·s avec le même jaune que les groupes ACI de l'agenda.
const estMineur = (age?: string) => {
  const n = parseInt(age || "", 10);
  return !isNaN(n) && n < 18;
};

const TERRITOIRES_DEFAUT = ["91", "92", "Autres"];

// Ne liste que les apprenant·e·s retenu·e·s (OK) pour cette session précise
// — reprend la structure de la feuille de suivi pédagogique/administratif.
export default function ApprenantsNumerikUpProSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = decodeURIComponent((params?.id as string) || "");

  const [inscriptions, setInscriptions] = useState<Apprenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  // sessions[parcoursId][territoire] = liste de dates de session, telles que
  // définies sur la page de paramètres — permet de changer de session sans
  // revenir en arrière sur la page de suivi de recrutement.
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});
  const [territoiresListe, setTerritoiresListe] = useState<string[]>(TERRITOIRES_DEFAUT);
  const [territoireSelectionne, setTerritoireSelectionne] = useState("");

  useEffect(() => {
    const charger = async () => {
      try {
        const [snapInscriptions, snapSessions, snapTerritoires] = await Promise.all([
          getDocs(query(collection(db, "inscriptions_numerikuppro"), orderBy("createdAt", "desc"))),
          getDoc(doc(db, "configuration_numerikuppro", "sessions")),
          getDoc(doc(db, "configuration_numerikuppro", "territoires")),
        ]);
        setInscriptions(snapInscriptions.docs.map((d) => ({ id: d.id, ...d.data() } as Apprenant)));
        if (snapSessions.exists()) {
          setSessions(snapSessions.data().parTerritoire || {});
        }
        if (snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0) {
          setTerritoiresListe(snapTerritoires.data().liste);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des apprenant·e·s :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  const apprenantsSession = useMemo(
    () =>
      inscriptions
        .filter((i) => i.Session === sessionId && i.Suivi_Recrutement && i.OK_NOK === "OK")
        .sort((a, b) => (a.Nom || "").localeCompare(b.Nom || "", "fr")),
    [inscriptions, sessionId]
  );

  // Transmet la liste des apprenant·e·s au générateur d'émargement pour que
  // les lignes NOM/Prénom soient pré-remplies automatiquement.
  const hrefEmargement = useMemo(() => {
    const noms = apprenantsSession
      .map((a) => `${encodeURIComponent(a.Prénom || "")}|${encodeURIComponent(a.Nom || "")}`)
      .join(";");
    const params = new URLSearchParams({ intitule: "NUMERIK PRO" });
    if (noms) params.set("noms", noms);
    return `/mediation/rencontres-numeriques/emargement?${params.toString()}`;
  }, [apprenantsSession]);

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

  const sessionsDuTerritoire = useMemo(
    () => Array.from(new Set(Object.values(sessions).flatMap((parTerritoire) => parTerritoire[territoireSelectionne] || []))).sort((a, b) => a.localeCompare(b, "fr")),
    [sessions, territoireSelectionne]
  );

  const changerSession = (nouvelleSession: string) => {
    router.push(`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(nouvelleSession)}/apprenants`);
  };

  const changerTerritoire = (nouveauTerritoire: string) => {
    setTerritoireSelectionne(nouveauTerritoire);
    const datesDuTerritoire = Array.from(new Set(Object.values(sessions).flatMap((parTerritoire) => parTerritoire[nouveauTerritoire] || []))).sort((a, b) => a.localeCompare(b, "fr"));
    if (datesDuTerritoire.length > 0) {
      changerSession(datesDuTerritoire[0]);
    }
  };

  // Statistiques du groupe retenu (avant filtre de recherche) : sexe, tranche
  // d'âge, diplôme — reprises ensuite sur la feuille Statistiques globale.
  const statistiques = useMemo(() => {
    const sexe: Record<string, number> = { Femme: 0, Homme: 0, "Non renseigné": 0 };
    const age: Record<string, number> = { "Moins de 18 ans": 0, "18 à 25 ans": 0, "26 ans et +": 0, "Non renseigné": 0 };
    const diplome: Record<string, number> = {};
    apprenantsSession.forEach((a) => {
      if (a.Civilité === "Mme") sexe.Femme++;
      else if (a.Civilité === "M.") sexe.Homme++;
      else sexe["Non renseigné"]++;

      const brut = (a.Age || "").trim();
      const nombre = parseInt(brut, 10);
      if (brut.includes("+") || (!isNaN(nombre) && nombre >= 26)) age["26 ans et +"]++;
      else if (!isNaN(nombre) && nombre < 18) age["Moins de 18 ans"]++;
      else if (!isNaN(nombre)) age["18 à 25 ans"]++;
      else age["Non renseigné"]++;

      const niveau = a.Niveau_Etudes?.trim() || "Non renseigné";
      diplome[niveau] = (diplome[niveau] || 0) + 1;
    });
    return { sexe, age, diplome };
  }, [apprenantsSession]);

  const apprenantsFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return apprenantsSession;
    return apprenantsSession.filter((i) => `${i.Prénom || ""} ${i.Nom || ""}`.toLowerCase().includes(terme));
  }, [apprenantsSession, recherche]);

  const mettreAJourChampTexte = async (id: string, champ: keyof Apprenant, valeur: string) => {
    setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, [champ]: valeur } : i)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", id), { [champ]: valeur });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du champ ${champ} :`, error);
    }
  };

  const basculerChampBooleen = async (id: string, champ: keyof Apprenant, valeur: boolean) => {
    setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, [champ]: valeur } : i)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", id), { [champ]: valeur });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du champ ${champ} :`, error);
    }
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement des apprenant·e·s...
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
                Apprenant<span className="text-[#EA601F] font-semibold">·e·s</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Session : {sessionId || "—"}{territoireDeSession && ` — Territoire : ${territoireDeSession}`} — {apprenantsSession.length} apprenant{apprenantsSession.length > 1 ? "s" : ""} retenu{apprenantsSession.length > 1 ? "s" : ""} (OK)
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
              href={`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionId)}/evolution`}
              className="flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white px-3.5 py-2 rounded-xl transition-colors text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ChartBarIcon className="w-4 h-4" />
              <span>Évolution</span>
            </Link>
            <Link
              href={hrefEmargement}
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <DocumentPlusIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Générateur d'émargement</span>
            </Link>
            <Link
              href={`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionId)}`}
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Suivi de recrutement</span>
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

        {/* STATISTIQUES DU GROUPE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#005259] mb-2">Sexe</div>
            <div className="space-y-1">
              {Object.entries(statistiques.sexe).filter(([, n]) => n > 0).map(([label, n]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-[#404040]/70">{label}</span>
                  <span className="font-bold text-[#005259]">{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#005259] mb-2">Âge</div>
            <div className="space-y-1">
              {Object.entries(statistiques.age).filter(([, n]) => n > 0).map(([label, n]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-[#404040]/70">{label}</span>
                  <span className="font-bold text-[#005259]">{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#005259] mb-2">Diplôme</div>
            <div className="space-y-1">
              {Object.entries(statistiques.diplome).map(([label, n]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-[#404040]/70">{label}</span>
                  <span className="font-bold text-[#005259]">{n}</span>
                </div>
              ))}
            </div>
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

        {/* TABLEAU */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr className="bg-[#F3F3F2] text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-3 py-2 border-b border-[#404040]/10" colSpan={16}>Apprenant·e·s</th>
                  <th className="px-3 py-2 border-b border-l border-[#404040]/10" colSpan={35}>Administratif</th>
                </tr>
                <tr className="bg-[#005259]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-3 py-1.5" colSpan={16}></th>
                  <th className="px-3 py-1.5 border-l border-[#404040]/10 text-center" colSpan={11}>Intégration</th>
                  <th className="px-3 py-1.5 border-l border-[#404040]/10 text-center" colSpan={3}>Positionnement</th>
                  <th className="px-3 py-1.5 border-l border-[#404040]/10 text-center" colSpan={2}>Matériel</th>
                  <th className="px-3 py-1.5 border-l border-[#404040]/10 text-center" colSpan={3}>Suivi pédagogique</th>
                  <th className="px-3 py-1.5 border-l border-[#404040]/10 text-center" colSpan={3}>Certifications</th>
                  <th className="px-3 py-1.5 border-l border-[#404040]/10 text-center" colSpan={8}>Modules réseau &amp; cybersécurité</th>
                  <th className="px-3 py-1.5 border-l border-[#404040]/10 text-center" colSpan={5}>Clôture</th>
                </tr>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-3 py-3 text-center">#</th>
                  <th className="px-3 py-3">Civilité</th>
                  <th className="px-3 py-3">Prénom</th>
                  <th className="px-3 py-3">Nom</th>
                  <th className="px-3 py-3">Âge</th>
                  <th className="px-3 py-3">Ville</th>
                  <th className="px-3 py-3">Id. France Travail</th>
                  <th className="px-3 py-3">Dpt.</th>
                  <th className="px-3 py-3">QPV</th>
                  <th className="px-3 py-3">Diplôme</th>
                  <th className="px-3 py-3">Téléphone</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Ordinateur</th>
                  <th className="px-3 py-3">Prescripteur</th>
                  <th className="px-3 py-3">Mail prescripteur</th>
                  <th className="px-3 py-3">Tél. prescripteur</th>
                  <th className="px-2 py-3 border-l border-[#404040]/10 text-center">Planning</th>
                  <th className="px-2 py-3 text-center">Programme</th>
                  <th className="px-2 py-3 text-center">Accès OC</th>
                  <th className="px-2 py-3 text-center">Convoc. 1er jour</th>
                  <th className="px-2 py-3 text-center">Charte</th>
                  <th className="px-2 py-3 text-center">Règlement</th>
                  <th className="px-2 py-3 text-center">Droit image</th>
                  <th className="px-2 py-3 text-center">Intégration Kairos</th>
                  <th className="px-2 py-3 text-center">Validation Kairos</th>
                  <th className="px-2 py-3 text-center">Accès Drive</th>
                  <th className="px-2 py-3 text-center">Cotisation</th>
                  <th className="px-2 py-3 border-l border-[#404040]/10 text-center">Positionnement E.</th>
                  <th className="px-2 py-3 text-center">Positionnement S.</th>
                  <th className="px-2 py-3 text-center">Convoc. PIX</th>
                  <th className="px-2 py-3 border-l border-[#404040]/10 text-center">Clé USB</th>
                  <th className="px-2 py-3 text-center">Trousse à outils</th>
                  <th className="px-2 py-3 border-l border-[#404040]/10 text-center">Bilan intermédiaire</th>
                  <th className="px-2 py-3 text-center">Satisfaction M1</th>
                  <th className="px-2 py-3 text-center">Projet Dev. M2 (CV)</th>
                  <th className="px-2 py-3 border-l border-[#404040]/10 text-center">PIX</th>
                  <th className="px-2 py-3 text-center">HTML/CSS</th>
                  <th className="px-2 py-3 text-center">MYSQL</th>
                  <th className="px-2 py-3 border-l border-[#404040]/10 text-center">Risques SI</th>
                  <th className="px-2 py-3 text-center">Réseau TCP/IP</th>
                  <th className="px-2 py-3 text-center">Test intrusion web</th>
                  <th className="px-2 py-3 text-center">Cisco CyberS.</th>
                  <th className="px-2 py-3 text-center">Cisco matériel</th>
                  <th className="px-2 py-3 text-center">Monter un PC</th>
                  <th className="px-2 py-3 text-center">Installer W11</th>
                  <th className="px-2 py-3 text-center">Métier technicien</th>
                  <th className="px-2 py-3 border-l border-[#404040]/10 text-center">Entretien fin parcours</th>
                  <th className="px-2 py-3 text-center">Satisfaction fin session</th>
                  <th className="px-2 py-3 text-center">Bilan envoyé</th>
                  <th className="px-2 py-3 text-center">Satisfaction 3 mois</th>
                  <th className="px-2 py-3 text-center">Satisfaction 6 mois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {apprenantsFiltres.length > 0 ? (
                  apprenantsFiltres.map((i, index) => {
                    const conseiller = `${i.Conseiller_Prenom || ""} ${i.Conseiller_Nom || ""}`.trim();
                    return (
                      <tr key={i.id} className="hover:bg-[#F3F3F2]/60 transition-colors align-top">
                        <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Civilité || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">
                          <Link href={`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionId)}/apprenants/${i.id}`} className="hover:text-[#EA601F] hover:underline transition-colors">
                            {i.Prénom || "—"}
                          </Link>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">
                          <Link href={`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionId)}/apprenants/${i.id}`} className="hover:text-[#EA601F] hover:underline transition-colors">
                            {i.Nom || "—"}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {i.Age ? (
                            estMineur(i.Age) ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-[#F9C44E]/20 text-[#005259] border border-[#F9C44E] text-[10px] font-bold">{i.Age}</span>
                            ) : i.Age
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Ville || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Identifiant_France_Travail || "—"}</td>
                        <td className="px-3 py-2 text-center">{i.Territoire || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.QPV || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Niveau_Etudes || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Téléphone || "—"}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate">{i.Email || "—"}</td>
                        <td className="px-2 py-2">
                          <input type="text" defaultValue={i.Ordinateur_Utilise || ""} onBlur={(e) => mettreAJourChampTexte(i.id, "Ordinateur_Utilise", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={conseiller}>{conseiller || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate">{i.Conseiller_Email || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Telephone || "—"}</td>
                        <td className="px-2 py-2 border-l border-[#404040]/10 text-center">
                          <input type="checkbox" checked={i.Planning_Formation || false} onChange={(e) => basculerChampBooleen(i.id, "Planning_Formation", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Programme_Formation || false} onChange={(e) => basculerChampBooleen(i.id, "Programme_Formation", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Acces_Openclassroom || false} onChange={(e) => basculerChampBooleen(i.id, "Acces_Openclassroom", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Convocation_Premier_Jour || false} onChange={(e) => basculerChampBooleen(i.id, "Convocation_Premier_Jour", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Charte_Engagement || false} onChange={(e) => basculerChampBooleen(i.id, "Charte_Engagement", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Reglement_Interieur || false} onChange={(e) => basculerChampBooleen(i.id, "Reglement_Interieur", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Signature_Droit_Image || false} onChange={(e) => basculerChampBooleen(i.id, "Signature_Droit_Image", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Integration_Kairos || false} onChange={(e) => basculerChampBooleen(i.id, "Integration_Kairos", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Validation_Kairos || false} onChange={(e) => basculerChampBooleen(i.id, "Validation_Kairos", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Acces_Drive_Apprenant || false} onChange={(e) => basculerChampBooleen(i.id, "Acces_Drive_Apprenant", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Cotisation_Adhesion || false} onChange={(e) => basculerChampBooleen(i.id, "Cotisation_Adhesion", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 border-l border-[#404040]/10">
                          <input type="text" defaultValue={i.Questionnaire_Positionnement_Entree || ""} onBlur={(e) => mettreAJourChampTexte(i.id, "Questionnaire_Positionnement_Entree", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="text" defaultValue={i.Questionnaire_Positionnement_Sortie || ""} onBlur={(e) => mettreAJourChampTexte(i.id, "Questionnaire_Positionnement_Sortie", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="text" defaultValue={i.Date_Convocation_PIX_Certification || ""} onBlur={(e) => mettreAJourChampTexte(i.id, "Date_Convocation_PIX_Certification", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-2 py-2 border-l border-[#404040]/10 text-center">
                          <input type="checkbox" checked={i.Cle_USB_32G || false} onChange={(e) => basculerChampBooleen(i.id, "Cle_USB_32G", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Trousse_Outils || false} onChange={(e) => basculerChampBooleen(i.id, "Trousse_Outils", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 border-l border-[#404040]/10">
                          <input type="text" defaultValue={i.Date_Bilan_Intermediaire || ""} onBlur={(e) => mettreAJourChampTexte(i.id, "Date_Bilan_Intermediaire", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Satisfaction_Chaud_Mois1 || false} onChange={(e) => basculerChampBooleen(i.id, "Satisfaction_Chaud_Mois1", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Projet_Developpement_Mois2_CV || false} onChange={(e) => basculerChampBooleen(i.id, "Projet_Developpement_Mois2_CV", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 border-l border-[#404040]/10 text-center">
                          <input type="checkbox" checked={i.Certification_PIX || false} onChange={(e) => basculerChampBooleen(i.id, "Certification_PIX", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Certification_HTML_CSS || false} onChange={(e) => basculerChampBooleen(i.id, "Certification_HTML_CSS", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Certification_MYSQL || false} onChange={(e) => basculerChampBooleen(i.id, "Certification_MYSQL", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 border-l border-[#404040]/10 text-center">
                          <input type="checkbox" checked={i.Module_Analyse_Risques_SI || false} onChange={(e) => basculerChampBooleen(i.id, "Module_Analyse_Risques_SI", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Module_Reseau_TCPIP || false} onChange={(e) => basculerChampBooleen(i.id, "Module_Reseau_TCPIP", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Module_Test_Intrusion_Web || false} onChange={(e) => basculerChampBooleen(i.id, "Module_Test_Intrusion_Web", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Formation_Cisco_Cybersecurite || false} onChange={(e) => basculerChampBooleen(i.id, "Formation_Cisco_Cybersecurite", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Cisco_Bases_Materiel || false} onChange={(e) => basculerChampBooleen(i.id, "Cisco_Bases_Materiel", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.OC_Monter_PC || false} onChange={(e) => basculerChampBooleen(i.id, "OC_Monter_PC", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.OC_Installer_Windows11 || false} onChange={(e) => basculerChampBooleen(i.id, "OC_Installer_Windows11", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.OC_Decouvrir_Metier_Technicien || false} onChange={(e) => basculerChampBooleen(i.id, "OC_Decouvrir_Metier_Technicien", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 border-l border-[#404040]/10 text-center">
                          <input type="checkbox" checked={i.Entretien_Fin_Parcours || false} onChange={(e) => basculerChampBooleen(i.id, "Entretien_Fin_Parcours", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Satisfaction_Chaud_FinSession || false} onChange={(e) => basculerChampBooleen(i.id, "Satisfaction_Chaud_FinSession", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Bilan_Individuel_Envoye || false} onChange={(e) => basculerChampBooleen(i.id, "Bilan_Individuel_Envoye", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Satisfaction_Froid_3Mois || false} onChange={(e) => basculerChampBooleen(i.id, "Satisfaction_Froid_3Mois", e.target.checked)} className={checkboxClass} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={i.Satisfaction_Froid_6Mois || false} onChange={(e) => basculerChampBooleen(i.id, "Satisfaction_Froid_6Mois", e.target.checked)} className={checkboxClass} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={51} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                      🔍 Aucun·e apprenant·e retenu·e (OK) pour cette session.
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

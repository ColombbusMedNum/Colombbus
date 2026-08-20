"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, MagnifyingGlassIcon, UsersIcon, IdentificationIcon, ArrowPathIcon, PencilSquareIcon, CheckIcon, XMarkIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { chargerPrescripteurs, Prescripteur } from "@/lib/prescripteurs";
import { formatPhoneNumber, formatPhoneForStorage } from "@/lib/formatPhone";
import { formatNom, formatPrenom } from "@/lib/formatName";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Champs communs aux 3 collections d'inscriptions — suffisants pour
// regrouper les participant·e·s et les prescripteurs sans avoir besoin du
// détail propre à chaque programme.
interface InscriptionBase {
  id: string;
  Civilité?: string;
  Nom?: string;
  Prénom?: string;
  Téléphone?: string;
  Email?: string;
  Session?: string;
  Conseiller_Nom?: string;
  Conseiller_Prenom?: string;
  Conseiller_Telephone?: string;
  Conseiller_Email?: string;
  Structure_Accompagnement?: string;
  Structures_Accompagnement?: string[];
  Structure_Autre?: string;
  Suivi_Recrutement?: boolean;
}

interface Programme {
  id: string;
  label: string;
  collection: string;
  configCollection: string;
  accent: string;
}

const PROGRAMMES: Programme[] = [
  { id: "numerikup", label: "Numérik'UP", collection: "inscriptions_numerikup", configCollection: "configuration_numerikup", accent: "#005259" },
  { id: "digitalup", label: "Digital'UP", collection: "inscriptions_digitalup", configCollection: "configuration_digitalup", accent: "#EA601F" },
  { id: "numerikuppro", label: "Numérik'UP Pro", collection: "inscriptions_numerikuppro", configCollection: "configuration_numerikuppro", accent: "#7C1FD1" },
];

// sessions[parcoursId][territoire] = dates de session ; codes["parcoursId|territoire|date"]
// = code interne — reprend la configuration définie sur chaque page paramètres.
interface ConfigSessions {
  sessions: Record<string, Record<string, string[]>>;
  codes: Record<string, string>;
}

const normalise = (s?: string) => (s || "").trim().toLowerCase();

// Domaine d'un email (tout ce qui suit le @) — souvent plus parlant que
// l'organisme lui-même pour repérer visuellement les prescripteurs d'une
// même structure (ex. "@francetravail.net", "@missionlocaledeparis.fr").
const domaineEmail = (email?: string): string => {
  const parties = (email || "").split("@");
  return parties.length === 2 && parties[1] ? parties[1].toLowerCase() : "—";
};

// Fournisseurs d'emails grand public — un domaine ne représente une vraie
// structure que s'il n'en fait pas partie (une Mission locale ou France
// Travail a son propre nom de domaine, pas "gmail.com").
const DOMAINES_GENERIQUES = new Set([
  "gmail.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr",
  "yahoo.com", "yahoo.fr", "free.fr", "orange.fr", "wanadoo.fr", "live.fr",
  "live.com", "laposte.net", "sfr.fr", "icloud.com", "msn.com", "aol.com",
  "protonmail.com", "numericable.fr", "bbox.fr", "neuf.fr",
]);

// Identité d'une personne à travers les 3 collections — l'email prime (le
// plus fiable), sinon nom + prénom + téléphone. Il n'existe aucun identifiant
// partagé entre les 3 programmes aujourd'hui : c'est ce rapprochement qui en
// tient lieu pour cette page.
const cleDePersonne = (i: InscriptionBase) => {
  const email = normalise(i.Email);
  return email ? `email:${email}` : `nom:${normalise(i.Nom)}|${normalise(i.Prénom)}|${normalise(i.Téléphone)}`;
};

// Contrairement à cleDePersonne ci-dessus, on regroupe ici uniquement par
// nom + prénom normalisés (sans faire primer l'email) : le même·e
// conseiller·e référent·e est parfois ressaisi·e avec un email sur une
// inscription et sans sur une autre, ce qui éclatait une même personne en
// deux lignes distinctes lorsque l'email était pris en priorité.
const cleMatchPrescripteur = (p: Prescripteur) => `nom:${normalise(p.referentNom)}|${normalise(p.referentPrenom)}`;

const clePrescripteurDeInscription = (i: InscriptionBase) => `nom:${normalise(i.Conseiller_Nom)}|${normalise(i.Conseiller_Prenom)}`;

// L'organisme provient de champs différents selon le programme : texte libre
// pour Numérik'UP Pro, cases à cocher (+ "Autre") pour Numérik'UP/Digital'UP.
const organismeDeInscription = (programmeId: string, i: InscriptionBase): string => {
  if (programmeId === "numerikuppro") return i.Structure_Accompagnement || i.Structure_Autre || "";
  return [...(i.Structures_Accompagnement || []), i.Structure_Autre].filter(Boolean).join(", ");
};

// Retrouve le code interne d'une session à partir de sa date, en cherchant le
// parkours/territoire auquel elle appartient — retombe sur la date si aucun
// code n'a encore été généré sur la page paramètres du programme concerné.
const codeDeSession = (config: ConfigSessions | undefined, session: string): string => {
  if (!config) return session;
  for (const parTerritoire of Object.values(config.sessions)) {
    for (const [territoire, dates] of Object.entries(parTerritoire)) {
      if (dates.includes(session)) {
        const parcoursId = Object.keys(config.sessions).find((id) => config.sessions[id] === parTerritoire);
        return config.codes[`${parcoursId}|${territoire}|${session}`] || session;
      }
    }
  }
  return session;
};

interface Position {
  programmeId: string;
  session: string;
}

interface Personne {
  cle: string;
  civilite?: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
  email?: string;
  positions: Position[];
}

interface PrescripteurAgg {
  cle: string;
  id?: string;
  organisme?: string;
  referentNom?: string;
  referentPrenom?: string;
  referentTelephone?: string;
  referentEmail?: string;
  programmes: Record<string, number>;
}

interface StructureAgg {
  domaine: string;
  organismes: string[];
  referents: string[];
  programmes: Record<string, number>;
}

function PositionBadge({ programme, code }: { programme: Programme; code: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
      style={{ backgroundColor: `${programme.accent}1A`, color: programme.accent }}
      title={programme.label}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: programme.accent }}></span>
      {code}
    </span>
  );
}

function Badge({ programme, nombre }: { programme: Programme; nombre: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
      style={{ backgroundColor: `${programme.accent}1A`, color: programme.accent }}
      title={`${nombre} sur ${programme.label}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: programme.accent }}></span>
      {programme.label} × {nombre}
    </span>
  );
}

const inputClass = "w-full px-2.5 py-1.5 bg-white border border-[#404040]/15 focus:border-[#005259] rounded-lg text-[11px] text-[#404040] outline-none font-medium transition-colors";

interface BrouillonPrescripteur {
  id?: string;
  organisme: string;
  referentPrenom: string;
  referentNom: string;
  referentTelephone: string;
  referentEmail: string;
}

// Vue transversale aux 3 programmes d'actions collectives : qui a été
// positionné où (participant·e·s), et quel prescripteur a orienté combien de
// bénéficiaires sur quel programme — deux lectures d'un même jeu de données,
// basculables par un simple onglet.
export default function ParticipantsPage() {
  const [vue, setVue] = useState<"participants" | "prescripteurs" | "structures">("participants");
  const [donnees, setDonnees] = useState<Record<string, InscriptionBase[]>>({});
  const [configs, setConfigs] = useState<Record<string, ConfigSessions>>({});
  const [prescripteurs, setPrescripteurs] = useState<Prescripteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [synchronisation, setSynchronisation] = useState<{ enCours: boolean; ajoutes: number } | null>(null);
  const [brouillon, setBrouillon] = useState<BrouillonPrescripteur | null>(null);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

  // Barre de défilement horizontal dupliquée en haut du tableau — synchronisée
  // avec le défilement réel pour éviter d'avoir à descendre tout en bas
  // (même mécanisme que sur les pages Réponses Numérik'UP/Digital'UP/Pro).
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

  const charger = async () => {
    try {
      const [snaps, snapsConfig, listePrescripteurs] = await Promise.all([
        Promise.all(PROGRAMMES.map((p) => getDocs(collection(db, p.collection)))),
        Promise.all(PROGRAMMES.map((p) => getDoc(doc(db, p.configCollection, "sessions")))),
        chargerPrescripteurs(),
      ]);
      const suivant: Record<string, InscriptionBase[]> = {};
      const suivantConfig: Record<string, ConfigSessions> = {};
      PROGRAMMES.forEach((p, index) => {
        suivant[p.id] = snaps[index].docs.map((d) => ({ id: d.id, ...d.data() } as InscriptionBase));
        const donneesConfig = snapsConfig[index].exists() ? snapsConfig[index].data() : {};
        suivantConfig[p.id] = { sessions: donneesConfig.parTerritoire || {}, codes: donneesConfig.codes || {} };
      });
      setDonnees(suivant);
      setConfigs(suivantConfig);
      setPrescripteurs(listePrescripteurs);
    } catch (error) {
      console.error("Erreur lors du chargement des participants/prescripteurs :", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  // "Positionné" = affecté au suivi de recrutement d'une session précise
  // (Suivi_Recrutement === true), même terme que partout ailleurs dans
  // l'application.
  const participants = useMemo(() => {
    const carte = new Map<string, Personne>();
    PROGRAMMES.forEach((prog) => {
      (donnees[prog.id] || []).forEach((i) => {
        if (!i.Suivi_Recrutement) return;
        const cle = cleDePersonne(i);
        const existant = carte.get(cle) || { cle, positions: [] };
        existant.civilite = existant.civilite || i.Civilité;
        existant.nom = existant.nom || i.Nom;
        existant.prenom = existant.prenom || i.Prénom;
        existant.telephone = existant.telephone || i.Téléphone;
        existant.email = existant.email || i.Email;
        existant.positions.push({ programmeId: prog.id, session: i.Session || "" });
        carte.set(cle, existant);
      });
    });
    return Array.from(carte.values()).sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));
  }, [donnees]);

  const participantsFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return participants;
    return participants.filter((p) => `${p.prenom || ""} ${p.nom || ""} ${p.email || ""}`.toLowerCase().includes(terme));
  }, [participants, recherche]);

  // Annuaire complet : chaque réponse au formulaire compte, qu'elle ait ou
  // non été positionnée sur une session ensuite — un prescripteur oriente
  // des bénéficiaires que Colombbus retienne ou non leur candidature.
  const prescripteursAgg = useMemo(() => {
    const carte = new Map<string, PrescripteurAgg>();
    prescripteurs.forEach((p) => {
      const cle = cleMatchPrescripteur(p);
      carte.set(cle, { cle, id: p.id, organisme: p.organisme, referentNom: p.referentNom, referentPrenom: p.referentPrenom, referentTelephone: p.referentTelephone, referentEmail: p.referentEmail, programmes: {} });
    });
    PROGRAMMES.forEach((prog) => {
      (donnees[prog.id] || []).forEach((i) => {
        if (!i.Conseiller_Nom && !i.Conseiller_Prenom && !i.Conseiller_Email) return;
        const cle = clePrescripteurDeInscription(i);
        const organisme = organismeDeInscription(prog.id, i);
        const existant = carte.get(cle) || {
          cle,
          organisme,
          referentNom: i.Conseiller_Nom,
          referentPrenom: i.Conseiller_Prenom,
          referentTelephone: i.Conseiller_Telephone,
          referentEmail: i.Conseiller_Email,
          programmes: {},
        };
        existant.organisme = existant.organisme || organisme;
        existant.referentTelephone = existant.referentTelephone || i.Conseiller_Telephone;
        existant.referentEmail = existant.referentEmail || i.Conseiller_Email;
        existant.programmes[prog.id] = (existant.programmes[prog.id] || 0) + 1;
        carte.set(cle, existant);
      });
    });
    return Array.from(carte.values())
      .filter((p) => Object.keys(p.programmes).length > 0)
      .sort((a, b) => (a.organisme || a.referentNom || "").localeCompare(b.organisme || b.referentNom || "", "fr"));
  }, [donnees, prescripteurs]);

  const prescripteursFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return prescripteursAgg;
    return prescripteursAgg.filter((p) => `${p.organisme || ""} ${p.referentPrenom || ""} ${p.referentNom || ""} ${p.referentEmail || ""}`.toLowerCase().includes(terme));
  }, [prescripteursAgg, recherche]);

  // Regroupe les prescripteurs par nom de domaine d'email — un domaine
  // "métier" (ex. "@francetravail.net") révèle une vraie structure partagée
  // par plusieurs référent·e·s, contrairement aux fournisseurs grand public
  // exclus ci-dessous (gmail.com, free.fr...) qui ne veulent rien dire.
  const structuresAgg = useMemo(() => {
    const carte = new Map<string, { domaine: string; organismes: Set<string>; referents: Set<string>; programmes: Record<string, number> }>();
    prescripteursAgg.forEach((p) => {
      const domaine = domaineEmail(p.referentEmail);
      if (domaine === "—" || DOMAINES_GENERIQUES.has(domaine)) return;
      const existant = carte.get(domaine) || { domaine, organismes: new Set<string>(), referents: new Set<string>(), programmes: {} };
      if (p.organisme) existant.organismes.add(p.organisme);
      const nomComplet = `${formatPrenom(p.referentPrenom)} ${formatNom(p.referentNom)}`.trim();
      if (nomComplet) existant.referents.add(nomComplet);
      Object.entries(p.programmes).forEach(([prog, n]) => {
        existant.programmes[prog] = (existant.programmes[prog] || 0) + n;
      });
      carte.set(domaine, existant);
    });
    return Array.from(carte.values())
      .map((s): StructureAgg => ({ domaine: s.domaine, organismes: Array.from(s.organismes), referents: Array.from(s.referents), programmes: s.programmes }))
      .sort((a, b) => a.domaine.localeCompare(b.domaine, "fr"));
  }, [prescripteursAgg]);

  const structuresFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return structuresAgg;
    return structuresAgg.filter(
      (s) => s.domaine.includes(terme) || s.organismes.some((o) => o.toLowerCase().includes(terme)) || s.referents.some((r) => r.toLowerCase().includes(terme))
    );
  }, [structuresAgg, recherche]);

  // Rattrape l'historique : crée une fiche prescripteur pour chaque
  // conseiller·e déjà présent dans les inscriptions mais pas encore dans
  // l'annuaire — les nouvelles inscriptions, elles, l'alimentent
  // automatiquement via l'autocomplétion des formulaires.
  const synchroniser = async () => {
    setSynchronisation({ enCours: true, ajoutes: 0 });
    try {
      const dejaVus = new Set(prescripteurs.map((p) => cleMatchPrescripteur(p)));
      const candidats = new Map<string, { organisme?: string; referentPrenom?: string; referentNom?: string; referentTelephone?: string; referentEmail?: string }>();
      PROGRAMMES.forEach((prog) => {
        (donnees[prog.id] || []).forEach((i) => {
          if (!i.Conseiller_Nom && !i.Conseiller_Prenom && !i.Conseiller_Email) return;
          const cle = clePrescripteurDeInscription(i);
          if (dejaVus.has(cle) || candidats.has(cle)) return;
          candidats.set(cle, {
            organisme: organismeDeInscription(prog.id, i),
            referentPrenom: formatPrenom(i.Conseiller_Prenom),
            referentNom: formatNom(i.Conseiller_Nom),
            referentTelephone: formatPhoneForStorage(i.Conseiller_Telephone),
            referentEmail: i.Conseiller_Email,
          });
        });
      });
      for (const champs of candidats.values()) {
        await addDoc(collection(db, "prescripteurs"), { ...champs, organisme: champs.organisme || "", createdAt: serverTimestamp() });
      }
      setPrescripteurs(await chargerPrescripteurs());
      setSynchronisation({ enCours: false, ajoutes: candidats.size });
    } catch (error) {
      console.error("Erreur lors de la synchronisation des prescripteurs :", error);
      setSynchronisation(null);
    }
  };

  const debuterEdition = (p: PrescripteurAgg) => {
    setBrouillon({
      id: p.id,
      organisme: p.organisme || "",
      referentPrenom: p.referentPrenom || "",
      referentNom: p.referentNom || "",
      referentTelephone: p.referentTelephone || "",
      referentEmail: p.referentEmail || "",
    });
  };

  // Une fiche prescripteur peut ne pas encore exister dans l'annuaire (ligne
  // reconstituée depuis une inscription seulement) : dans ce cas l'édition la
  // crée directement, plutôt que de mettre à jour un document qui n'existe pas.
  const enregistrerPrescripteur = async () => {
    if (!brouillon) return;
    setEnregistrementEnCours(true);
    const champs = {
      organisme: brouillon.organisme.trim(),
      referentPrenom: formatPrenom(brouillon.referentPrenom),
      referentNom: formatNom(brouillon.referentNom),
      referentTelephone: formatPhoneForStorage(brouillon.referentTelephone),
      referentEmail: brouillon.referentEmail.trim(),
    };
    try {
      if (brouillon.id) {
        await updateDoc(doc(db, "prescripteurs", brouillon.id), champs);
      } else {
        await addDoc(collection(db, "prescripteurs"), { ...champs, createdAt: serverTimestamp() });
      }
      setPrescripteurs(await chargerPrescripteurs());
      setBrouillon(null);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du prescripteur :", error);
    } finally {
      setEnregistrementEnCours(false);
    }
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement...
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
                Participants <span className="text-[#EA601F] font-semibold">& Prescripteurs</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Vue transversale Numérik'UP / Digital'UP / Numérik'UP Pro —{" "}
                {vue === "participants"
                  ? `${participants.length} personne${participants.length > 1 ? "s" : ""} positionnée${participants.length > 1 ? "s" : ""}`
                  : vue === "prescripteurs"
                  ? `${prescripteursAgg.length} prescripteur${prescripteursAgg.length > 1 ? "s" : ""}`
                  : `${structuresAgg.length} structure${structuresAgg.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>
        </div>

        {/* BASCULE + RECHERCHE */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="inline-flex bg-white border border-[#404040]/10 rounded-2xl p-1.5 shadow-sm w-fit">
            <button
              type="button"
              onClick={() => setVue("participants")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${vue === "participants" ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/60 hover:text-[#005259]"}`}
            >
              <UsersIcon className="w-4 h-4" />
              <span>Participants</span>
            </button>
            <button
              type="button"
              onClick={() => setVue("prescripteurs")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${vue === "prescripteurs" ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/60 hover:text-[#005259]"}`}
            >
              <IdentificationIcon className="w-4 h-4" />
              <span>Prescripteurs</span>
            </button>
            <button
              type="button"
              onClick={() => setVue("structures")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${vue === "structures" ? "bg-[#005259] text-white shadow-sm" : "text-[#404040]/60 hover:text-[#005259]"}`}
            >
              <BuildingOffice2Icon className="w-4 h-4" />
              <span>Structures</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative group max-w-md">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-4 w-4 text-[#404040]/40 group-focus-within:text-[#005259] transition-colors" />
              </div>
              <input
                type="text"
                placeholder={vue === "participants" ? "Rechercher par nom ou email..." : vue === "prescripteurs" ? "Rechercher par organisme, nom ou email..." : "Rechercher par domaine, organisme ou référent·e..."}
                className="w-64 bg-white border border-[#404040]/15 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all shadow-sm font-medium"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
            {vue === "prescripteurs" && (
              <button
                type="button"
                onClick={synchroniser}
                disabled={synchronisation?.enCours}
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2.5 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm disabled:opacity-50 cursor-pointer"
                title="Créer une fiche prescripteur pour chaque conseiller·e déjà présent dans les inscriptions mais absent de l'annuaire"
              >
                <ArrowPathIcon className={`w-4 h-4 ${synchronisation?.enCours ? "animate-spin" : ""}`} />
                <span>Synchroniser</span>
              </button>
            )}
          </div>
        </div>

        {synchronisation && !synchronisation.enCours && (
          <div className="bg-[#005259]/10 border border-[#005259]/20 text-[#005259] rounded-2xl px-4 py-3 text-xs font-bold">
            {synchronisation.ajoutes} prescripteur{synchronisation.ajoutes > 1 ? "s" : ""} ajouté{synchronisation.ajoutes > 1 ? "s" : ""} à l'annuaire.
          </div>
        )}

        {vue === "structures" ? (
        /* CARTES — regroupement par nom de domaine d'email, hors fournisseurs
           grand public (gmail.com, free.fr...) qui ne représentent aucune
           structure réelle. */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {structuresFiltrees.length > 0 ? (
            structuresFiltrees.map((s) => (
              <div key={s.domaine} className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <BuildingOffice2Icon className="w-4 h-4 text-[#EA601F] shrink-0" />
                  <h3 className="text-sm font-extrabold text-[#005259] break-all">{s.domaine}</h3>
                </div>
                {s.organismes.length > 0 && (
                  <p className="text-xs text-[#404040]/70 font-medium">{s.organismes.join(", ")}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {PROGRAMMES.filter((prog) => s.programmes[prog.id]).map((prog) => (
                    <Badge key={prog.id} programme={prog} nombre={s.programmes[prog.id]} />
                  ))}
                </div>
                <div className="pt-2 border-t border-[#404040]/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">
                    Référent·e·s ({s.referents.length})
                  </div>
                  <div className="text-xs text-[#404040] space-y-0.5">
                    {s.referents.map((r) => (
                      <div key={r}>{r}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
              🔍 Aucune structure trouvée.
            </div>
          )}
        </div>
        ) : (
        <>
        {/* BARRE DE DÉFILEMENT HORIZONTAL (haut) — collée en haut de l'écran
            au défilement vertical, sinon elle sort du cadre et devient
            inutilisable dès qu'on descend dans le tableau. */}
        <div ref={scrollHautRef} onScroll={surScrollHaut} className="sticky top-0 z-30 bg-[#F3F3F2] py-1.5 overflow-x-auto overflow-y-hidden">
          <div style={{ width: largeurTable, height: 1 }}></div>
        </div>

        {/* TABLEAU */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <div ref={scrollTableRef} onScroll={surScrollTable} className="overflow-x-auto">
            {vue === "participants" ? (
              <table className="border-collapse text-xs w-full">
                <thead>
                  <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-3 py-3 text-center">#</th>
                    <th className="px-3 py-3">Civilité</th>
                    <th className="px-3 py-3">Prénom</th>
                    <th className="px-3 py-3">Nom</th>
                    <th className="px-3 py-3">Téléphone</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Positionné·e sur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#404040]/5">
                  {participantsFiltres.length > 0 ? (
                    participantsFiltres.map((p, index) => (
                      <tr key={p.cle} className="hover:bg-[#F3F3F2]/60 transition-colors">
                        <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{p.civilite || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{formatPrenom(p.prenom) || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">{formatNom(p.nom) || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatPhoneNumber(p.telephone)}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{p.email || "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            {p.positions.map((pos, i2) => {
                              const programme = PROGRAMMES.find((prog) => prog.id === pos.programmeId)!;
                              return <PositionBadge key={`${pos.programmeId}-${pos.session}-${i2}`} programme={programme} code={codeDeSession(configs[pos.programmeId], pos.session)} />;
                            })}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                        🔍 Aucun·e participant·e trouvé·e.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="border-collapse text-xs w-full">
                <thead>
                  <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-3 py-3 text-center">#</th>
                    <th className="px-3 py-3">Organisme</th>
                    <th className="px-3 py-3">Référent·e</th>
                    <th className="px-3 py-3">Téléphone</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Domaine email</th>
                    <th className="px-3 py-3">Bénéficiaires orienté·e·s sur</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#404040]/5">
                  {prescripteursFiltres.length > 0 ? (
                    prescripteursFiltres.map((p, index) => (
                      <tr key={p.cle} className="hover:bg-[#F3F3F2]/60 transition-colors">
                        <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{p.organisme || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{`${formatPrenom(p.referentPrenom)} ${formatNom(p.referentNom)}`.trim() || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatPhoneNumber(p.referentTelephone)}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{p.referentEmail || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-[#404040]/70">{domaineEmail(p.referentEmail)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            {PROGRAMMES.filter((prog) => p.programmes[prog.id]).map((prog) => (
                              <Badge key={prog.id} programme={prog} nombre={p.programmes[prog.id]} />
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => debuterEdition(p)}
                            className="p-1.5 bg-[#005259]/10 hover:bg-[#005259] text-[#005259] hover:text-white border border-[#005259]/30 rounded-lg transition-colors cursor-pointer"
                            title="Modifier ce prescripteur"
                          >
                            <PencilSquareIcon className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                        🔍 Aucun prescripteur trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
        </>
        )}

      </div>

      {/* MODALE D'ÉDITION D'UN PRESCRIPTEUR */}
      {brouillon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#005259]">
              {brouillon.id ? "Modifier le prescripteur" : "Ajouter à l'annuaire"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#404040]/60 mb-1">Organisme</label>
                <input type="text" value={brouillon.organisme} onChange={(e) => setBrouillon({ ...brouillon, organisme: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#404040]/60 mb-1">Prénom</label>
                  <input type="text" value={brouillon.referentPrenom} onChange={(e) => setBrouillon({ ...brouillon, referentPrenom: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#404040]/60 mb-1">Nom</label>
                  <input type="text" value={brouillon.referentNom} onChange={(e) => setBrouillon({ ...brouillon, referentNom: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#404040]/60 mb-1">Téléphone</label>
                <input type="tel" value={brouillon.referentTelephone} onChange={(e) => setBrouillon({ ...brouillon, referentTelephone: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#404040]/60 mb-1">Email</label>
                <input type="email" value={brouillon.referentEmail} onChange={(e) => setBrouillon({ ...brouillon, referentEmail: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#404040]/10">
              <button
                type="button"
                onClick={() => setBrouillon(null)}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                <XMarkIcon className="w-4 h-4" />
                <span>Annuler</span>
              </button>
              <button
                type="button"
                onClick={enregistrerPrescripteur}
                disabled={enregistrementEnCours}
                className="flex items-center gap-2 px-4 py-2 bg-[#005259] hover:bg-[#00363a] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckIcon className="w-4 h-4" />
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </PageGuard>
  );
}

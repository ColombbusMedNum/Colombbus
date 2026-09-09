"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { addDoc, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, MagnifyingGlassIcon, ClipboardDocumentCheckIcon, ChartBarIcon, TrashIcon, DocumentDuplicateIcon, ChevronUpIcon, ChevronDownIcon, ChevronUpDownIcon, PencilSquareIcon, XMarkIcon, CheckIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import SessionSelect from "@/components/SessionSelect";
import { usePermissions } from "@/lib/PermissionsProvider";
import { useToast } from "@/components/ToastProvider";
import { formatNom, formatPrenom } from "@/lib/formatName";
import { formatPhoneForStorage } from "@/lib/formatPhone";
import { calculerAge } from "@/lib/dateNaissance";
import { ActionSchema, InscriptionActionDynamique, QuestionDef } from "@/lib/dynamicActions/types";
import { chargerSchema, chargerConfiguration, inscriptionsCollection, inscriptionDoc, ConfigurationChargee } from "@/lib/dynamicActions/store";
import ChampQuestion from "@/components/actionDynamique/ChampQuestion";

// Champs personnels copiés lors d'une duplication vers une autre session —
// même principe que sur les 4 programmes historiques (voir .../reponses/
// prfe/page.tsx) : Session et tout champ de suivi propre à une session ne
// sont jamais copiés, "reponses" (questions CUSTOM) l'est intégralement.
const TERRITOIRE_NON_AFFECTE = "__non_affecte__";

const estMineur = (age?: number | "") => typeof age === "number" && age < 18;

const normaliser = (s?: string) => (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

const cleDoublon = (i: InscriptionActionDynamique) => {
  const email = normaliser(i.Email);
  if (email) return `email:${email}`;
  const nomPrenomTel = normaliser(`${i.Nom || ""}${i.Prénom || ""}${i.Téléphone || ""}`);
  return nomPrenomTel ? `identite:${nomPrenomTel}` : "";
};

const inputEditClass = "w-full min-w-[140px] px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] focus:bg-white rounded-lg text-[11px] text-[#404040] outline-none font-medium transition-colors";
const labelEditClass = "block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1";

export default function ReponsesActionDynamiquePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { role } = usePermissions();
  const { showToast } = useToast();

  const [schema, setSchema] = useState<ActionSchema | null>(null);
  const [config, setConfig] = useState<ConfigurationChargee | null>(null);
  const [inscriptions, setInscriptions] = useState<InscriptionActionDynamique[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [territoireFiltre, setTerritoireFiltre] = useState("");
  const [onglet, setOnglet] = useState<"preinscrits" | "affectes" | "doublons">("preinscrits");
  const [tri, setTri] = useState<{ colonne: string; direction: "asc" | "desc" } | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [edition, setEdition] = useState<InscriptionActionDynamique | null>(null);
  const [dupliquer, setDupliquer] = useState<InscriptionActionDynamique | null>(null);
  const [sessionCible, setSessionCible] = useState("");
  const [duplicationEnCours, setDuplicationEnCours] = useState(false);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

  const scrollHautRef = useRef<HTMLDivElement>(null);
  const scrollTableRef = useRef<HTMLDivElement>(null);
  const [largeurTable, setLargeurTable] = useState(0);
  const synchroniseEnCours = useRef(false);

  useEffect(() => {
    const charger = async () => {
      const [s, c] = await Promise.all([chargerSchema(slug), chargerConfiguration(slug)]);
      if (!s) { setLoading(false); return; }
      setSchema(s);
      setConfig(c);
      const snap = await getDocs(query(inscriptionsCollection(slug), orderBy("createdAt", "desc")));
      setInscriptions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InscriptionActionDynamique)));
      setLoading(false);
    };
    charger();
  }, [slug]);

  useEffect(() => {
    const mettreAJourLargeur = () => { if (scrollTableRef.current) setLargeurTable(scrollTableRef.current.scrollWidth); };
    mettreAJourLargeur();
    window.addEventListener("resize", mettreAJourLargeur);
    return () => window.removeEventListener("resize", mettreAJourLargeur);
  });
  const surScrollHaut = () => {
    if (synchroniseEnCours.current) { synchroniseEnCours.current = false; return; }
    if (scrollHautRef.current && scrollTableRef.current) { synchroniseEnCours.current = true; scrollTableRef.current.scrollLeft = scrollHautRef.current.scrollLeft; }
  };
  const surScrollTable = () => {
    if (synchroniseEnCours.current) { synchroniseEnCours.current = false; return; }
    if (scrollHautRef.current && scrollTableRef.current) { synchroniseEnCours.current = true; scrollHautRef.current.scrollLeft = scrollTableRef.current.scrollLeft; }
  };

  useEffect(() => { setSelection(new Set()); }, [onglet]);
  const basculerSelection = (id: string) => setSelection((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  const sessionsParTerritoire = useMemo(() => {
    if (!config) return {};
    const parTerritoire: Record<string, Set<string>> = {};
    Object.values(config.sessions).forEach((parTerr) => {
      Object.entries(parTerr).forEach(([territoire, dates]) => {
        if (!parTerritoire[territoire]) parTerritoire[territoire] = new Set();
        dates.forEach((d) => parTerritoire[territoire].add(d));
      });
    });
    return Object.fromEntries(Object.entries(parTerritoire).map(([t, dates]) => [t, Array.from(dates).sort((a, b) => a.localeCompare(b, "fr"))]));
  }, [config]);

  const sessionsAffichees = useMemo(() => {
    if (territoireFiltre && territoireFiltre !== TERRITOIRE_NON_AFFECTE && sessionsParTerritoire[territoireFiltre]) return { [territoireFiltre]: sessionsParTerritoire[territoireFiltre] };
    return sessionsParTerritoire;
  }, [sessionsParTerritoire, territoireFiltre]);

  const codeDeSession = (date: string) => {
    if (!config) return date;
    for (const [parcoursId, parTerritoire] of Object.entries(config.sessions)) {
      for (const [territoire, dates] of Object.entries(parTerritoire)) {
        if (dates.includes(date)) return config.codes[`${parcoursId}|${territoire}|${date}`] || date;
      }
    }
    return date;
  };

  const toutesLesSessions = useMemo(() => Array.from(new Set(Object.values(sessionsParTerritoire).flat())).sort((a, b) => codeDeSession(a).localeCompare(codeDeSession(b), "fr")), [sessionsParTerritoire, config]);

  const groupesDoublons = useMemo(() => {
    const groupes = new Map<string, InscriptionActionDynamique[]>();
    inscriptions.forEach((i) => { const cle = cleDoublon(i); if (!cle) return; if (!groupes.has(cle)) groupes.set(cle, []); groupes.get(cle)!.push(i); });
    return groupes;
  }, [inscriptions]);
  const infosDoublons = useMemo(() => {
    const map = new Map<string, { cle: string; taille: number }>();
    groupesDoublons.forEach((liste, cle) => { if (liste.length > 1) liste.forEach((i) => map.set(i.id!, { cle, taille: liste.length })); });
    return map;
  }, [groupesDoublons]);

  const sexeDeCivilite = (civilite?: string) => (civilite === "Mme" ? "Femme" : civilite === "M." ? "Homme" : "—");

  const questionsTriees = useMemo(() => (schema ? [...schema.questions].sort((a, b) => a.etape - b.etape) : []), [schema]);

  const valeurCustom = (i: InscriptionActionDynamique, q: QuestionDef): string => {
    const v = i.reponses?.[q.id];
    if (v === undefined || v === null) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "boolean") return v ? "Oui" : "Non";
    return String(v);
  };

  const valeurColonne = (i: InscriptionActionDynamique, cle: string): string => {
    switch (cle) {
      case "civilite": return i.Civilité || "";
      case "prenom": return i.Prénom || "";
      case "nom": return i.Nom || "";
      case "telephone": return i.Téléphone || "";
      case "age": return String(i.Age ?? "");
      case "email": return i.Email || "";
      case "diplome": return i.Niveau_Etudes || "";
      case "sexe": return sexeDeCivilite(i.Civilité);
      case "ville": return i.Ville || "";
      case "codePostal": return i.Code_Postal || "";
      case "territoire": return i.Territoire || "";
      case "qpv": return i.QPV || "";
      case "parcours": return i.Parcours || "";
      case "prescripteur": return i.Structure_Accompagnement || "";
      case "rgpd": return i.RGPD ? "Oui" : "Non";
      case "conseillerPrenom": return i.Conseiller_Prenom || "";
      case "conseillerNom": return i.Conseiller_Nom || "";
      case "conseillerTelephone": return i.Conseiller_Telephone || "";
      case "conseillerEmail": return i.Conseiller_Email || "";
      default: {
        const q = questionsTriees.find((qq) => qq.id === cle);
        return q ? valeurCustom(i, q) : "";
      }
    }
  };

  const basculerTri = (colonne: string) => setTri((prev) => (prev?.colonne === colonne ? (prev.direction === "asc" ? { colonne, direction: "desc" } : null) : { colonne, direction: "asc" }));

  const inscriptionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    const resultat = inscriptions.filter((i) => {
      if (onglet === "preinscrits" && i.Suivi_Recrutement) return false;
      if (onglet === "affectes" && !i.Suivi_Recrutement) return false;
      if (onglet === "doublons" && !infosDoublons.has(i.id!)) return false;
      if (territoireFiltre === TERRITOIRE_NON_AFFECTE && i.Territoire) return false;
      else if (territoireFiltre && territoireFiltre !== TERRITOIRE_NON_AFFECTE && i.Territoire !== territoireFiltre) return false;
      if (terme && !`${i.Prénom || ""} ${i.Nom || ""}`.toLowerCase().includes(terme)) return false;
      return true;
    });
    if (tri) {
      const dir = tri.direction === "asc" ? 1 : -1;
      return [...resultat].sort((a, b) => valeurColonne(a, tri.colonne).localeCompare(valeurColonne(b, tri.colonne), "fr", { numeric: true }) * dir);
    }
    if (onglet === "doublons") return [...resultat].sort((a, b) => (infosDoublons.get(a.id!)?.cle || "").localeCompare(infosDoublons.get(b.id!)?.cle || ""));
    return resultat;
  }, [inscriptions, recherche, onglet, territoireFiltre, infosDoublons, tri]);

  const sessionsDistinctes = useMemo(() => (config ? Array.from(new Set(Object.values(config.sessions).flatMap((p) => Object.values(p).flat()))).sort((a, b) => a.localeCompare(b, "fr")) : []), [config]);

  const allerAuSuiviRecrutement = () => { if (sessionsDistinctes.length === 0) return; router.push(`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionsDistinctes[0])}`); };

  const mettreAJourChamp = async (id: string, champ: keyof InscriptionActionDynamique, valeur: any) => {
    setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, [champ]: valeur } : i)));
    try { await updateDoc(inscriptionDoc(slug, id), { [champ]: valeur }); } catch (e) { console.error(e); }
  };
  const basculerSuiviRecrutement = async (id: string, valeur: boolean) => mettreAJourChamp(id, "Suivi_Recrutement", valeur);

  const supprimerInscription = async (i: InscriptionActionDynamique) => {
    const nom = `${i.Prénom || ""} ${i.Nom || ""}`.trim() || "cette personne";
    if (!window.confirm(`Supprimer définitivement la préinscription de ${nom} ? Cette action est irréversible.`)) return;
    setInscriptions((prev) => prev.filter((x) => x.id !== i.id));
    try { await deleteDoc(inscriptionDoc(slug, i.id!)); } catch (e) { console.error(e); }
  };

  const confirmerDuplication = async () => {
    if (!dupliquer || !sessionCible) return;
    setDuplicationEnCours(true);
    try {
      const { id, Session, Suivi_Recrutement, Absences, Evolution_Actif, Evolution_Retards, createdAt, ...champs } = dupliquer;
      await addDoc(inscriptionsCollection(slug), { ...champs, Session: sessionCible, Suivi_Recrutement: false, createdAt: serverTimestamp() });
      const snap = await getDocs(query(inscriptionsCollection(slug), orderBy("createdAt", "desc")));
      setInscriptions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InscriptionActionDynamique)));
      setDupliquer(null);
      setSessionCible("");
    } catch (e) {
      console.error(e);
    } finally {
      setDuplicationEnCours(false);
    }
  };

  const supprimerSelection = async () => {
    if (selection.size === 0) return;
    if (!window.confirm(`Supprimer définitivement ${selection.size} préinscription(s) sélectionnée(s) ? Cette action est irréversible.`)) return;
    const ids = Array.from(selection);
    setInscriptions((prev) => prev.filter((x) => !selection.has(x.id!)));
    setSelection(new Set());
    try { await Promise.all(ids.map((id) => deleteDoc(inscriptionDoc(slug, id)))); } catch (e) { console.error(e); }
  };

  const ouvrirEdition = (i: InscriptionActionDynamique) => setEdition({ ...i, reponses: { ...i.reponses } });
  const fermerEdition = () => setEdition(null);
  const majEdition = <K extends keyof InscriptionActionDynamique>(champ: K, valeur: InscriptionActionDynamique[K]) => setEdition((prev) => (prev ? { ...prev, [champ]: valeur } : prev));
  const majReponseEdition = (questionId: string, valeur: string | string[] | boolean) => setEdition((prev) => (prev ? { ...prev, reponses: { ...prev.reponses, [questionId]: valeur } } : prev));

  const enregistrerEdition = async () => {
    if (!edition) return;
    setEnregistrementEnCours(true);
    const { id, ...donnees } = { ...edition, Nom: formatNom(edition.Nom), Prénom: formatPrenom(edition.Prénom), Téléphone: formatPhoneForStorage(edition.Téléphone) };
    try {
      await updateDoc(inscriptionDoc(slug, id!), donnees as any);
      setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, ...donnees } : i)));
      setEdition(null);
    } catch (e) {
      console.error(e);
    } finally {
      setEnregistrementEnCours(false);
    }
  };

  if (loading) {
    return <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>Chargement des inscriptions...</div>;
  }
  if (!schema || !config) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-center p-8 antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#EF736A]">Action introuvable</p>
        <Link href="/mediation/actions-collectives/creer-action" className="text-xs font-bold text-[#005259] underline">Retour à la liste des actions</Link>
      </div>
    );
  }

  const colonnesFixes = (
    [
      ["civilite", "Civilité"], ["prenom", "Prénom"], ["nom", "Nom"], ["telephone", "Téléphone"], ["age", "Âge"],
      ["email", "Email"], ["diplome", "Diplôme"], ["sexe", "Sexe"], ["ville", "Ville"], ["codePostal", "Code Postal"],
      ["territoire", "Dpt."], ["qpv", "QPV"], ["parcours", "Parcours"], ["prescripteur", "Prescripteur"],
    ] as const
  ).filter(([cle]) => cle !== "diplome" || schema.niveauEtudesActif !== false);
  const colonnesFin = [
    ["rgpd", "RGPD"], ["conseillerPrenom", "Prénom Référent"], ["conseillerNom", "Nom Référent"],
    ["conseillerTelephone", "Tél Référent"], ["conseillerEmail", "Mail Référent"],
  ] as const;
  const nbColonnes = 4 + colonnesFixes.length + questionsTriees.length + colonnesFin.length + (onglet === "doublons" ? 1 : 0);

  return (
    <PageGuard pageId="page_access_action_dynamique">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="max-w-[100rem] mx-auto relative z-10 space-y-6">

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]" style={{ backgroundColor: schema.accentColor }}></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Préinscriptions <span className="text-[#EA601F] font-semibold">{schema.label}</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">{inscriptions.length} inscription{inscriptions.length > 1 ? "s" : ""} reçue{inscriptions.length > 1 ? "s" : ""} — suivi de recrutement</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {sessionsDistinctes.length > 0 && (
              <button type="button" onClick={allerAuSuiviRecrutement} className="flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white px-3.5 py-2 rounded-xl transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm">
                <ClipboardDocumentCheckIcon className="w-4 h-4" /><span>Suivi recrutement</span>
              </button>
            )}
            <Link href={`/mediation/actions-collectives/reponses/${slug}/statistiques`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <ChartBarIcon className="w-4 h-4 text-[#EA601F]" /><span>Statistiques</span>
            </Link>
            {role === "admin" && (
              <Link href={`/mediation/actions-collectives/inscription/${slug}/parametres`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <Cog6ToothIcon className="w-4 h-4 text-[#EA601F]" /><span>Paramètres</span>
              </Link>
            )}
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" /><span>Accueil</span>
            </Link>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setOnglet("preinscrits")} className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${onglet === "preinscrits" ? "bg-[#005259] text-white shadow-sm" : "bg-white text-[#005259] border border-[#404040]/10 hover:border-[#005259]"}`}>
            Préinscrits ({inscriptions.filter((i) => !i.Suivi_Recrutement).length})
          </button>
          <button type="button" onClick={() => setOnglet("affectes")} className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${onglet === "affectes" ? "bg-[#005259] text-white shadow-sm" : "bg-white text-[#005259] border border-[#404040]/10 hover:border-[#005259]"}`}>
            Affectés à une session ({inscriptions.filter((i) => i.Suivi_Recrutement).length})
          </button>
          <button type="button" onClick={() => setOnglet("doublons")} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${onglet === "doublons" ? "bg-[#EA601F] text-white shadow-sm" : "bg-white text-[#EA601F] border border-[#404040]/10 hover:border-[#EA601F]"}`}>
            <DocumentDuplicateIcon className="w-3.5 h-3.5" />Doublons ({infosDoublons.size})
          </button>
          {onglet === "doublons" && selection.size > 0 && (
            <button type="button" onClick={supprimerSelection} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer bg-[#C0392B] hover:bg-[#a3311f] text-white shadow-sm">
              <TrashIcon className="w-3.5 h-3.5" />Supprimer la sélection ({selection.size})
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative group max-w-md flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-[#404040]/40 group-focus-within:text-[#005259] transition-colors" />
            </div>
            <input type="text" placeholder="Rechercher par nom ou prénom..." className="w-full bg-white border border-[#404040]/15 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all shadow-sm font-medium" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
          <select value={territoireFiltre} onChange={(e) => setTerritoireFiltre(e.target.value)} className="bg-white border border-[#404040]/15 rounded-2xl px-4 py-3.5 text-sm text-[#404040] outline-none focus:border-[#005259] focus:ring-1 focus:ring-[#005259] transition-all shadow-sm font-medium">
            <option value="">Tous les territoires</option>
            {config.territoiresListe.map((t) => <option key={t} value={t}>Territoire {t}</option>)}
            <option value={TERRITOIRE_NON_AFFECTE}>Territoire non renseigné</option>
          </select>
        </div>

        <div ref={scrollHautRef} onScroll={surScrollHaut} className="overflow-x-auto overflow-y-hidden">
          <div style={{ width: largeurTable, height: 1 }}></div>
        </div>

        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <div ref={scrollTableRef} onScroll={surScrollTable} className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  {onglet === "doublons" && (
                    <th className="px-3 py-3 text-center">
                      <input type="checkbox" checked={inscriptionsFiltrees.length > 0 && inscriptionsFiltrees.every((i) => selection.has(i.id!))} onChange={(e) => setSelection(e.target.checked ? new Set(inscriptionsFiltrees.map((i) => i.id!)) : new Set())} title="Tout sélectionner / tout désélectionner" className="w-4 h-4 accent-[#EA601F] cursor-pointer" />
                    </th>
                  )}
                  <th className="px-3 py-3 text-center">Suivi recrutement</th>
                  <th className="px-3 py-3">Session</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                  <th className="px-3 py-3 text-center">#</th>
                  {colonnesFixes.map(([cle, libelle]) => (
                    <th key={cle} className="px-3 py-3">
                      <button type="button" onClick={() => basculerTri(cle)} className="flex items-center gap-1 hover:text-[#EA601F] transition-colors cursor-pointer" title={`Trier par ${libelle}`}>
                        <span>{libelle}</span>
                        {tri?.colonne === cle ? (tri.direction === "asc" ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />) : <ChevronUpDownIcon className="w-3 h-3 opacity-30" />}
                      </button>
                    </th>
                  ))}
                  {questionsTriees.map((q) => (
                    <th key={q.id} className="px-3 py-3">
                      <button type="button" onClick={() => basculerTri(q.id)} className="flex items-center gap-1 hover:text-[#EA601F] transition-colors cursor-pointer" title={`Trier par ${q.label}`}>
                        <span>{q.label}</span>
                        {tri?.colonne === q.id ? (tri.direction === "asc" ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />) : <ChevronUpDownIcon className="w-3 h-3 opacity-30" />}
                      </button>
                    </th>
                  ))}
                  {colonnesFin.map(([cle, libelle]) => (
                    <th key={cle} className="px-3 py-3">
                      <button type="button" onClick={() => basculerTri(cle)} className="flex items-center gap-1 hover:text-[#EA601F] transition-colors cursor-pointer" title={`Trier par ${libelle}`}>
                        <span>{libelle}</span>
                        {tri?.colonne === cle ? (tri.direction === "asc" ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />) : <ChevronUpDownIcon className="w-3 h-3 opacity-30" />}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {inscriptionsFiltrees.length > 0 ? inscriptionsFiltrees.map((i, index) => (
                  <tr key={i.id} className="hover:bg-[#F3F3F2]/60 transition-colors align-top">
                    {onglet === "doublons" && (
                      <td className="px-3 py-2 text-center"><input type="checkbox" checked={selection.has(i.id!)} onChange={() => basculerSelection(i.id!)} className="w-4 h-4 accent-[#EA601F] cursor-pointer" /></td>
                    )}
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={!!i.Suivi_Recrutement} onChange={(e) => basculerSuiviRecrutement(i.id!, e.target.checked)} title="Affecter au suivi de recrutement de sa session" className="w-4 h-4 accent-[#EA601F] cursor-pointer" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={i.Session || ""} onChange={(e) => mettreAJourChamp(i.id!, "Session", e.target.value)} className={inputEditClass}>
                        <option value="">-- Choisir une session --</option>
                        {i.Session && !Object.values(sessionsParTerritoire).some((dates) => dates.includes(i.Session as string)) && <option value={i.Session}>{codeDeSession(i.Session)}</option>}
                        {Object.entries(sessionsAffichees).map(([territoire, dates]) => (
                          <optgroup key={territoire} label={`Territoire ${territoire}`}>
                            {dates.map((s) => <option key={s} value={s}>{codeDeSession(s)}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <button type="button" onClick={() => ouvrirEdition(i)} title="Modifier cette fiche" className="p-1.5 rounded-lg text-[#404040]/40 hover:text-white hover:bg-[#005259] transition-colors cursor-pointer"><PencilSquareIcon className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setDupliquer(i)} title="Dupliquer vers une autre session" className="p-1.5 rounded-lg text-[#404040]/40 hover:text-white hover:bg-[#EA601F] transition-colors cursor-pointer"><DocumentDuplicateIcon className="w-4 h-4" /></button>
                      <button type="button" onClick={() => supprimerInscription(i)} title="Supprimer définitivement cette préinscription" className="p-1.5 rounded-lg text-[#404040]/40 hover:text-white hover:bg-[#C0392B] transition-colors cursor-pointer"><TrashIcon className="w-4 h-4" /></button>
                    </td>
                    <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{i.Civilité || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{i.Prénom || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">
                      {i.Nom || "—"}
                      {infosDoublons.has(i.id!) && <span title="Fait partie d'un groupe de doublons probable" className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-[#EA601F]/15 text-[#EA601F] text-[9px] font-bold normal-case align-middle">×{infosDoublons.get(i.id!)?.taille}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{i.Téléphone || "—"}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {i.Age !== "" && i.Age !== undefined ? (estMineur(i.Age) ? <span className="inline-block px-2 py-0.5 rounded bg-[#F9C44E]/20 text-[#005259] border border-[#F9C44E] text-[10px] font-bold">{i.Age}</span> : i.Age) : "—"}
                    </td>
                    <td className="px-3 py-2 max-w-[180px] truncate">{i.Email || "—"}</td>
                    {schema.niveauEtudesActif !== false && <td className="px-3 py-2 whitespace-nowrap">{i.Niveau_Etudes || "—"}</td>}
                    <td className="px-3 py-2 whitespace-nowrap">{sexeDeCivilite(i.Civilité)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{i.Ville || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{i.Code_Postal || "—"}</td>
                    <td className="px-3 py-2 text-center">{i.Territoire || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{i.QPV || "—"}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate" title={i.Parcours}>{i.Parcours || "—"}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate" title={i.Structure_Accompagnement}>{i.Structure_Accompagnement || "—"}</td>
                    {questionsTriees.map((q) => (
                      <td key={q.id} className="px-3 py-2 max-w-[180px] truncate" title={valeurCustom(i, q)}>{valeurCustom(i, q) || "—"}</td>
                    ))}
                    <td className="px-3 py-2 text-center">{i.RGPD ? "Oui" : "Non"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Prenom || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Nom || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Telephone || "—"}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate">{i.Conseiller_Email || "—"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={nbColonnes} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">🔍 Aucune inscription trouvée.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {edition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#404040]/40 backdrop-blur-sm" onClick={fermerEdition}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[#404040]/10">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#005259]">Modifier la fiche de {edition.Prénom || ""} {edition.Nom || ""}</h2>
              <button type="button" onClick={fermerEdition} className="p-1.5 rounded-lg text-[#404040]/50 hover:bg-[#F3F3F2] cursor-pointer"><XMarkIcon className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelEditClass}>Civilité</label><select value={edition.Civilité || ""} onChange={(e) => majEdition("Civilité", e.target.value)} className={inputEditClass}><option value="">—</option><option value="M.">M.</option><option value="Mme">Mme</option></select></div>
              <div><label className={labelEditClass}>Prénom</label><input type="text" value={edition.Prénom || ""} onChange={(e) => majEdition("Prénom", e.target.value)} className={inputEditClass} /></div>
              <div><label className={labelEditClass}>Nom</label><input type="text" value={edition.Nom || ""} onChange={(e) => majEdition("Nom", e.target.value)} className={inputEditClass} /></div>
              <div><label className={labelEditClass}>Téléphone</label><input type="text" value={edition.Téléphone || ""} onChange={(e) => majEdition("Téléphone", e.target.value)} className={inputEditClass} /></div>
              <div>
                <label className={labelEditClass}>Date de naissance</label>
                <input type="date" value={edition.Date_Naissance || ""} onChange={(e) => { const age = calculerAge(e.target.value); setEdition((prev) => (prev ? { ...prev, Date_Naissance: e.target.value, Age: age !== null ? age : prev.Age } : prev)); }} className={inputEditClass} />
              </div>
              <div><label className={labelEditClass}>Âge</label><input type="text" value={edition.Age ?? ""} onChange={(e) => majEdition("Age", e.target.value === "" ? "" : Number(e.target.value))} className={inputEditClass} /></div>
              <div><label className={labelEditClass}>Email</label><input type="text" value={edition.Email || ""} onChange={(e) => majEdition("Email", e.target.value)} className={inputEditClass} /></div>
              {schema.niveauEtudesActif !== false && (
                <div>
                  <label className={labelEditClass}>Niveau d'études</label>
                  <select value={edition.Niveau_Etudes || ""} onChange={(e) => majEdition("Niveau_Etudes", e.target.value)} className={inputEditClass}>
                    <option value="">—</option>
                    {edition.Niveau_Etudes && !config.niveauxEtudes.includes(edition.Niveau_Etudes) && <option value={edition.Niveau_Etudes}>{edition.Niveau_Etudes}</option>}
                    {config.niveauxEtudes.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}
              <div><label className={labelEditClass}>Code postal</label><input type="text" value={edition.Code_Postal || ""} onChange={(e) => majEdition("Code_Postal", e.target.value)} className={inputEditClass} /></div>
              <div><label className={labelEditClass}>Ville</label><input type="text" value={edition.Ville || ""} onChange={(e) => majEdition("Ville", e.target.value)} className={inputEditClass} /></div>
              <div>
                <label className={labelEditClass}>Territoire</label>
                <select value={edition.Territoire || ""} onChange={(e) => majEdition("Territoire", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  {config.territoiresListe.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelEditClass}>QPV</label>
                <select value={edition.QPV || ""} onChange={(e) => majEdition("QPV", e.target.value)} className={inputEditClass}><option value="">—</option><option value="Oui">Oui</option><option value="Non">Non</option><option value="Je ne sais pas">Je ne sais pas</option></select>
              </div>
              <div>
                <label className={labelEditClass}>Parcours</label>
                <select value={edition.Parcours || ""} onChange={(e) => majEdition("Parcours", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  {edition.Parcours && !config.parcoursListe.some((p) => p.label === edition.Parcours) && <option value={edition.Parcours}>{edition.Parcours}</option>}
                  {config.parcoursListe.map((p) => <option key={p.id} value={p.label}>{p.label}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-[11px] font-medium text-[#404040]"><input type="checkbox" checked={edition.RGPD || false} onChange={(e) => majEdition("RGPD", e.target.checked)} className="w-4 h-4 accent-[#005259] cursor-pointer" />Consentement RGPD</label>
              </div>
            </div>

            {questionsTriees.length > 0 && (
              <div className="pt-3 border-t border-[#404040]/10 space-y-3">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-[#005259]">Questions complémentaires</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {questionsTriees.map((q) => (
                    <ChampQuestion key={q.id} question={q} valeur={edition.reponses?.[q.id]} onChange={(v) => majReponseEdition(q.id, v)} inputClass={inputEditClass} labelClass={labelEditClass} />
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#404040]/10">
              <div><label className={labelEditClass}>Structure d'accompagnement</label><input type="text" value={edition.Structure_Accompagnement || ""} onChange={(e) => majEdition("Structure_Accompagnement", e.target.value)} className={inputEditClass} /></div>
              <div><label className={labelEditClass}>Prénom référent</label><input type="text" value={edition.Conseiller_Prenom || ""} onChange={(e) => majEdition("Conseiller_Prenom", e.target.value)} className={inputEditClass} /></div>
              <div><label className={labelEditClass}>Nom référent</label><input type="text" value={edition.Conseiller_Nom || ""} onChange={(e) => majEdition("Conseiller_Nom", e.target.value)} className={inputEditClass} /></div>
              <div><label className={labelEditClass}>Téléphone référent</label><input type="text" value={edition.Conseiller_Telephone || ""} onChange={(e) => majEdition("Conseiller_Telephone", e.target.value)} className={inputEditClass} /></div>
              <div><label className={labelEditClass}>Email référent</label><input type="text" value={edition.Conseiller_Email || ""} onChange={(e) => majEdition("Conseiller_Email", e.target.value)} className={inputEditClass} /></div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#404040]/10">
              <button type="button" onClick={fermerEdition} className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-[#404040]/60 hover:bg-[#F3F3F2] transition-colors cursor-pointer">Annuler</button>
              <button type="button" onClick={enregistrerEdition} disabled={enregistrementEnCours} className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-50 text-white transition-colors cursor-pointer">{enregistrementEnCours ? "Enregistrement..." : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}

      {dupliquer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#005259]">Dupliquer vers une autre session</h2>
            <p className="text-xs text-[#404040]/70">Crée une nouvelle préinscription pour {dupliquer.Prénom || ""} {dupliquer.Nom || ""} sur la session choisie, avec les mêmes informations — le suivi reste indépendant entre les deux sessions.</p>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#404040]/60 mb-1">Session cible</label>
              <SessionSelect value={sessionCible} options={toutesLesSessions} resoudreLabel={codeDeSession} onChange={setSessionCible} className="w-full flex items-center justify-between gap-2 bg-[#F3F3F2] border border-[#404040]/10 rounded-xl px-3 py-2.5 text-xs text-[#404040] font-medium cursor-pointer" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#404040]/10">
              <button type="button" onClick={() => { setDupliquer(null); setSessionCible(""); }} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"><XMarkIcon className="w-4 h-4" /><span>Annuler</span></button>
              <button type="button" onClick={confirmerDuplication} disabled={!sessionCible || duplicationEnCours} className="flex items-center gap-2 px-4 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"><CheckIcon className="w-4 h-4" /><span>{duplicationEnCours ? "Duplication..." : "Dupliquer"}</span></button>
            </div>
          </div>
        </div>
      )}
    </main>
    </PageGuard>
  );
}

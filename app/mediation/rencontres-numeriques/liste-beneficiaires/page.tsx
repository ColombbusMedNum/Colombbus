"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, collectionGroup, getDocs, query, where, updateDoc, doc, writeBatch } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { quicksand } from "@/lib/fonts";
import { PermissionGuard } from "@/components/PermissionGuard";
import PageGuard from "@/components/PageGuard";
import Accordion from "@/components/Accordion";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { lireNom, lirePrenom, lireTelephone } from "@/lib/beneficiaireFields";
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  HomeIcon,
  ArrowTopRightOnSquareIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  NoSymbolIcon,
  ArrowsPointingInIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

export default function ListeBeneficiaires() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [beneficiaires, setBeneficiaires] = useState<any[]>([]);
  const [usagersDuJour, setUsagersDuJour] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtreActif, setFiltreActif] = useState<string>("Tous"); // Valeur par défaut : Tous
  const [loading, setLoading] = useState(true);
  const [lettresOuvertes, setLettresOuvertes] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Fusion de doublons (voir handleFusionner) : mode sélection (max 2 fiches
  // à la fois), modale de choix de la fiche conservée, réservé aux
  // administrateurs (benef_merge) puisque la fiche non conservée est
  // définitivement supprimée après déplacement de son historique.
  const [modeSelectionFusion, setModeSelectionFusion] = useState(false);
  const [selectionFusion, setSelectionFusion] = useState<string[]>([]);
  const [survivantChoisi, setSurvivantChoisi] = useState<string | null>(null);
  const [fusionModalOuvert, setFusionModalOuvert] = useState(false);
  const [fusionEnCours, setFusionEnCours] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const aujourdhuiStr = new Date().toLocaleDateString('en-CA');

      // 1. Planning du jour (Suresnes)
      try {
        const qPlanning = query(
          collection(db, "planning_suresnes"), 
          where("date", "==", aujourdhuiStr)
        );
        const planningSnapshot = await getDocs(qPlanning);
        
        const nomsDuJour = planningSnapshot.docs
          .map(doc => doc.data().usager)
          .filter(usager => usager && usager.trim() !== "")
          .map(usager => usager.trim().toLowerCase());
        
        setUsagersDuJour(nomsDuJour);
      } catch (errPlan) {
        console.warn("Agenda Suresnes non disponible :", errPlan);
      }

      // 2. Récupération des utilisateurs + de TOUTES les visites en 2
      // requêtes globales (collectionGroup), au lieu d'un aller-retour
      // Firestore par bénéficiaire (1+N). Les visites ne vivent qu'à un seul
      // endroit du schéma (utilisateurs/{id}/visites), donc collectionGroup
      // ne peut pas remonter de documents d'une autre origine.
      const [querySnapshot, visitesSnapshot] = await Promise.all([
        getDocs(collection(db, "utilisateurs")),
        getDocs(collectionGroup(db, "visites")).catch(() => null), // tolérant : la liste s'affiche même si cette requête échoue
      ]);

      const visitesParUtilisateur = new Map<string, any[]>();
      visitesSnapshot?.docs.forEach((docSnap) => {
        const userId = docSnap.ref.parent.parent?.id;
        if (!userId) return;
        if (!visitesParUtilisateur.has(userId)) visitesParUtilisateur.set(userId, []);
        visitesParUtilisateur.get(userId)!.push(docSnap.data());
      });

      const docsAvecVisites = querySnapshot.docs.map((docSnap) => {
        const userData = docSnap.data();
        let datePremierRDV = "—";
        let nbVisitesPresent = 0;

        const nom = lireNom(userData);
        const prenom = lirePrenom(userData);

        const docsVisites = visitesParUtilisateur.get(docSnap.id) || [];
        if (docsVisites.length > 0) {
          const visitesPresentes = docsVisites.filter(data => {
            return data.statut !== "Absent" && data.statut !== "Annulé" && data.presence !== "Absent" && data.presence !== false;
          });
          nbVisitesPresent = visitesPresentes.length;

          // Le 1er RDV doit correspondre à une venue effective, pas à un
          // rendez-vous manqué.
          const dates = visitesPresentes.map(d => d.date).filter(Boolean).sort();
          if (dates.length > 0) {
            datePremierRDV = new Date(dates[0]).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
          }
        }

        return {
          id: docSnap.id,
          ...userData,
          nomAffiche: nom,
          prenomAffiche: prenom,
          premierRDV: datePremierRDV,
          totalVisites: nbVisitesPresent
        };
      });

      // Tri alphabétique local en JavaScript
      docsAvecVisites.sort((a, b) => 
        (a.nomAffiche || "").localeCompare(b.nomAffiche || "", 'fr', { sensitivity: 'base' })
      );

      setBeneficiaires(docsAvecVisites);

    } catch (error) {
      console.error("Erreur lors de la récupération des données:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleBlacklist = async (id: string, statutActuel: string) => {
    const nouveauStatut = statutActuel === "Oui" ? "Non" : "Oui";
    const message = nouveauStatut === "Oui" 
      ? "Êtes-vous sûr de vouloir blacklister ce bénéficiaire ?" 
      : "Réactiver ce bénéficiaire ?";
      
    if (await confirm(message)) {
      try {
        const userRef = doc(db, "utilisateurs", id);
        await updateDoc(userRef, {
          Statut_Blacklist: nouveauStatut
        });

        setBeneficiaires(prev => prev.map(b => b.id === id ? { ...b, Statut_Blacklist: nouveauStatut } : b));
      } catch (error) {
        console.error("Erreur lors de la modification de la blacklist :", error);
        showToast("Une erreur est survenue.", "error");
      }
    }
  };

  const handleCreerNouveau = () => {
    const nouvelId = "user_" + Math.random().toString(36).substring(2, 11);
    router.push(`/mediation/rencontres-numeriques/liste-beneficiaires/${nouvelId}`);
  };

  const toggleModeSelectionFusion = () => {
    setModeSelectionFusion((v) => !v);
    setSelectionFusion([]);
    setSurvivantChoisi(null);
    setFusionModalOuvert(false);
  };

  const toggleSelectionFusion = (id: string) => {
    setSelectionFusion((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        setSurvivantChoisi((s) => (s === id ? null : s));
        return next;
      }
      if (prev.length >= 2) return prev;
      const next = [...prev, id];
      // Présélectionne par défaut la fiche ayant le plus de visites comme
      // fiche conservée, une fois les 2 sélectionnées — modifiable dans la modale.
      if (next.length === 2) {
        const [a, b] = next.map((bid) => beneficiaires.find((x) => x.id === bid));
        if (a && b) setSurvivantChoisi(a.totalVisites >= b.totalVisites ? a.id : b.id);
      }
      return next;
    });
  };

  // Fusionne deux fiches en doublon : l'historique (visites, fiches_bilan) de
  // la fiche non conservée est déplacé sous la fiche conservée, ses champs
  // vides sont complétés (jamais écrasés) avec ceux de la fiche non conservée,
  // puis celle-ci est définitivement supprimée. Best-effort et non bloquant :
  // les créneaux Suresnes déjà posés au nom de la fiche supprimée (simple
  // texte, pas une référence d'ID — voir planning_suresnes.usager) sont
  // repointés vers le nom conservé quand les noms diffèrent.
  const handleFusionner = async () => {
    if (selectionFusion.length !== 2 || !survivantChoisi) return;
    const perdantId = selectionFusion.find((id) => id !== survivantChoisi);
    const survivant = beneficiaires.find((b) => b.id === survivantChoisi);
    const perdant = beneficiaires.find((b) => b.id === perdantId);
    if (!perdantId || !survivant || !perdant) return;

    const ok = await confirm(
      `Fusionner "${perdant.prenomAffiche} ${perdant.nomAffiche}" (${perdant.totalVisites} visite(s)) dans "${survivant.prenomAffiche} ${survivant.nomAffiche}" (${survivant.totalVisites} visite(s)) ? L'historique sera déplacé, mais la fiche non conservée sera définitivement supprimée. Cette action est irréversible.`
    );
    if (!ok) return;

    setFusionEnCours(true);
    try {
      const [visitesPerdant, fichesBilanPerdant] = await Promise.all([
        getDocs(collection(db, "utilisateurs", perdantId, "visites")),
        getDocs(collection(db, "utilisateurs", perdantId, "fiches_bilan")),
      ]);

      const batch = writeBatch(db);

      visitesPerdant.docs.forEach((docSnap) => {
        batch.set(doc(collection(db, "utilisateurs", survivantChoisi, "visites")), docSnap.data());
        batch.delete(docSnap.ref);
      });
      fichesBilanPerdant.docs.forEach((docSnap) => {
        batch.set(doc(collection(db, "utilisateurs", survivantChoisi, "fiches_bilan")), docSnap.data());
        batch.delete(docSnap.ref);
      });

      const completion: Record<string, any> = {};

      // Téléphone traité à part : certaines fiches (import en masse, création
      // rapide depuis Suresnes sans numéro connu) stockent un numéro factice
      // du type "0000000000" au lieu d'un champ vide — un tel numéro ne doit
      // jamais être préféré à un vrai numéro trouvé sur l'autre fiche, même si
      // la fiche conservée a "déjà" une valeur dans ce champ. Couvre aussi la
      // 3e variante de casse "Telephone" (sans accent) lue en repli ailleurs
      // dans l'app (voir suresnes/page.tsx).
      const estTelephonePlaceholder = (v: any) => {
        if (v === undefined || v === null || v === "") return true;
        const chiffres = String(v).replace(/\D/g, "");
        return chiffres === "" || /^0+$/.test(chiffres);
      };
      ["Téléphone", "telephone", "Telephone"].forEach((champ) => {
        const valeurSurvivant = survivant[champ];
        const valeurPerdant = perdant[champ];
        if (estTelephonePlaceholder(valeurSurvivant) && !estTelephonePlaceholder(valeurPerdant)) {
          completion[champ] = valeurPerdant;
        }
      });

      const champsACompleter = [
        "email", "Email", "Adresse_Rue", "Ville", "Code_Postal",
        "Date_Naissance", "Situation_Socio_Pro", "Situation_Handicap", "RQTH", "QPV",
        "Sexe", "sexe", "Civilité", "Lieu_RDV", "lieuRDV", "Date_Adhesion",
      ];
      champsACompleter.forEach((champ) => {
        const valeurSurvivant = survivant[champ];
        const valeurPerdant = perdant[champ];
        const survivantVide = valeurSurvivant === undefined || valeurSurvivant === null || valeurSurvivant === "";
        const perdantRenseigne = valeurPerdant !== undefined && valeurPerdant !== null && valeurPerdant !== "";
        if (survivantVide && perdantRenseigne) completion[champ] = valeurPerdant;
      });
      if (Object.keys(completion).length > 0) {
        batch.update(doc(db, "utilisateurs", survivantChoisi), completion);
      }

      batch.delete(doc(db, "utilisateurs", perdantId));

      await batch.commit();

      const nomPerdant = `${perdant.prenomAffiche.trim()} ${perdant.nomAffiche.trim().toUpperCase()}`;
      const nomSurvivant = `${survivant.prenomAffiche.trim()} ${survivant.nomAffiche.trim().toUpperCase()}`;
      if (nomPerdant && nomPerdant !== nomSurvivant) {
        try {
          const qCreneaux = query(collection(db, "planning_suresnes"), where("usager", "==", nomPerdant));
          const creneauxSnap = await getDocs(qCreneaux);
          if (!creneauxSnap.empty) {
            const batchRenommage = writeBatch(db);
            creneauxSnap.docs.forEach((c) => batchRenommage.update(c.ref, { usager: nomSurvivant }));
            await batchRenommage.commit();
          }
        } catch (err) {
          console.error("Erreur lors du repointage des créneaux Suresnes :", err);
        }
      }

      showToast("Fiches fusionnées avec succès.", "success");
      setModeSelectionFusion(false);
      setSelectionFusion([]);
      setSurvivantChoisi(null);
      setFusionModalOuvert(false);
      await fetchData();
    } catch (error) {
      console.error("Erreur lors de la fusion :", error);
      showToast("Une erreur est survenue pendant la fusion.", "error");
    } finally {
      setFusionEnCours(false);
    }
  };

  // Filtrage robuste
  function GridFilter(liste: any[]) {
    return liste.filter((b) => {
      const nomComplet = `${b.prenomAffiche} ${b.nomAffiche}`.toLowerCase().trim();
      const matchesSearch = nomComplet.includes(searchTerm.toLowerCase());

      let matchesBadge = true;
      const situation = (b.Situation_Socio_Pro || b.Situation || "").toLowerCase();
      const statut = (b.Statut || "").toLowerCase();

      if (filtreActif === "Aujourd'hui") {
        matchesBadge = usagersDuJour.some(u => nomComplet.includes(u) || u.includes(nomComplet));
      } else if (filtreActif === "Suresnes") {
        matchesBadge = b.Ville?.toLowerCase() === "suresnes";
      } else if (filtreActif === "DE") {
        matchesBadge = situation.includes("emploi") || situation === "de";
      } else if (filtreActif === "Blacklistes") {
        matchesBadge = b.Statut_Blacklist === "Oui";
      } else if (filtreActif === "Adherents") {
        matchesBadge = !!(b.Date_Adhesion && b.Date_Adhesion.trim() !== "");
      } else if (filtreActif === "VilleNonRenseignee") {
        matchesBadge = !b.Ville || b.Ville.trim() === "";
      } else if (filtreActif === "Actifs") {
        matchesBadge = (statut === "actif" || b.Statut === undefined) && b.Statut_Blacklist !== "Oui"; 
      }

      return matchesSearch && matchesBadge;
    });
  }

  // Mémoïsé : évite de rebalayer toute la liste à chaque rendu (frappe dans
  // la recherche, changement de filtre...).
  const filteredBeneficiaires = useMemo(
    () => GridFilter(beneficiaires),
    [beneficiaires, searchTerm, filtreActif, usagersDuJour]
  );

  const { countAujourdhui, countSuresnes, countDE, countBlacklistes, countAdherents, countVilleNonRenseignee } = useMemo(() => {
    const countAujourdhui = beneficiaires.filter(b => {
      const nomComplet = `${b.prenomAffiche} ${b.nomAffiche}`.toLowerCase().trim();
      return usagersDuJour.some(u => nomComplet.includes(u) || u.includes(nomComplet));
    }).length;

    const countSuresnes = beneficiaires.filter(b => b.Ville?.toLowerCase() === "suresnes").length;
    const countDE = beneficiaires.filter(b => {
      const sit = (b.Situation_Socio_Pro || b.Situation || "").toLowerCase();
      return sit.includes("emploi") || sit === "de";
    }).length;
    const countBlacklistes = beneficiaires.filter(b => b.Statut_Blacklist === "Oui").length;
    const countAdherents = beneficiaires.filter(b => b.Date_Adhesion && b.Date_Adhesion.trim() !== "").length;
    const countVilleNonRenseignee = beneficiaires.filter(b => !b.Ville || b.Ville.trim() === "").length;

    return { countAujourdhui, countSuresnes, countDE, countBlacklistes, countAdherents, countVilleNonRenseignee };
  }, [beneficiaires, usagersDuJour]);

  // Table de correspondance "lettre -> a des bénéficiaires ?" calculée une
  // fois par changement de liste, au lieu de 26 balayages complets par rendu.
  // Regroupement des résultats filtrés par initiale (première lettre du
  // nom), pour l'affichage en accordéons — les noms vides tombent dans "#".
  const beneficiairesParLettre = useMemo(() => {
    const groupes = new Map<string, any[]>();
    filteredBeneficiaires.forEach((b) => {
      const lettre = b.nomAffiche?.trim()?.[0]?.toUpperCase() || "#";
      const cle = /^[A-Z]$/.test(lettre) ? lettre : "#";
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle)!.push(b);
    });
    return Array.from(groupes.entries()).sort(([a], [b]) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });
  }, [filteredBeneficiaires]);

  const toggleLettre = (lettre: string) => {
    setLettresOuvertes((prev) => {
      const next = new Set(prev);
      if (next.has(lettre)) next.delete(lettre);
      else next.add(lettre);
      return next;
    });
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement de la base de données...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_liste_beneficiaires">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        
        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Bénéficiaires <span className="text-[#EA601F] font-normal">et suivi</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5">
                Gestion et suivi des accompagnements Colombbus
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <PermissionGuard actionId="benef_nav_agenda_suresnes">
              <Link
                href="/mediation/rencontres-numeriques/suresnes"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Agenda RN</span>
              </Link>
            </PermissionGuard>

            <PermissionGuard actionId="benef_nav_bilan_suresnes">
              <Link
                href="/mediation/bilan-suresnes"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <UserGroupIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Analyse par Territoire</span>
              </Link>
            </PermissionGuard>

            <PermissionGuard actionId="benef_nav_suresnes_liste">
              <Link
                href="/mediation/rencontres-numeriques/liste-beneficiaires/suresnes"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <UserGroupIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Bénéficiaires Suresnes</span>
              </Link>
            </PermissionGuard>

            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>

            {/* BOUTON CRÉER BÉNÉFICIAIRE (PROTÉGÉ) */}
            <PermissionGuard actionId="benef_create_new">
              <button
                onClick={handleCreerNouveau}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md active:scale-95 group"
              >
                <UserPlusIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>Nouveau</span>
              </button>
            </PermissionGuard>

            {/* FUSION DE DOUBLONS (RÉSERVÉ AUX ADMINS) */}
            <PermissionGuard actionId="benef_merge">
              <button
                onClick={toggleModeSelectionFusion}
                title="Sélectionner deux fiches en doublon à fusionner"
                className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 ${
                  modeSelectionFusion ? "bg-[#005259] text-white" : "bg-white border border-[#404040]/10 text-[#005259] hover:bg-[#005259] hover:text-white"
                }`}
              >
                <ArrowsPointingInIcon className="w-4 h-4" />
                <span>{modeSelectionFusion ? "Annuler la fusion" : "Fusionner des doublons"}</span>
              </button>
            </PermissionGuard>

          </div>
        </div>

        {/* BARRE DE SÉLECTION POUR LA FUSION */}
        {modeSelectionFusion && (
          <div className="flex items-center justify-between gap-4 bg-[#005259] text-white p-3.5 rounded-2xl shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wide">
              {selectionFusion.length === 0 && "Cochez 2 fiches en doublon dans la liste ci-dessous."}
              {selectionFusion.length === 1 && "1 fiche sélectionnée — choisissez-en une deuxième."}
              {selectionFusion.length === 2 && "2 fiches sélectionnées, prêtes à être fusionnées."}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSelectionFusion([])}
                disabled={selectionFusion.length === 0}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Vider la sélection
              </button>
              <button
                onClick={() => setFusionModalOuvert(true)}
                disabled={selectionFusion.length !== 2}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EA601F] hover:bg-white hover:text-[#EA601F] rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#EA601F] disabled:hover:text-white"
              >
                <ArrowsPointingInIcon className="w-3.5 h-3.5" />
                Fusionner
              </button>
            </div>
          </div>
        )}

        {/* BARRE DE RECHERCHE */}
        <PermissionGuard actionId="benef_search">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-[#404040]/40 group-focus-within:text-[#005259] transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Rechercher un bénéficiaire par son nom ou son prénom..."
              className="w-full bg-white border border-[#404040]/15 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all shadow-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </PermissionGuard>

        {/* FILTRES RAPIDES */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-[10px] font-bold text-[#404040]/60 uppercase tracking-widest mr-1">
            Filtrer par :
          </span>

          <button
            onClick={() => setFiltreActif("Tous")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "Tous"
                ? "bg-[#005259] text-white shadow-sm"
                : "bg-white text-[#404040] border border-[#404040]/10 hover:border-[#005259] hover:text-[#005259]"
            }`}
          >
            Tous ({beneficiaires.length})
          </button>

          <PermissionGuard actionId="benef_filter_today">
            <button
              onClick={() => setFiltreActif("Aujourd'hui")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                filtreActif === "Aujourd'hui"
                  ? "bg-[#005259] text-white shadow-sm"
                  : "bg-white text-[#404040] border border-[#404040]/10 hover:border-[#005259] hover:text-[#005259]"
              }`}
            >
              📅 Aujourd'hui ({countAujourdhui})
            </button>
          </PermissionGuard>

          <PermissionGuard actionId="benef_filter_suresnes">
            <button
              onClick={() => setFiltreActif("Suresnes")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                filtreActif === "Suresnes"
                  ? "bg-[#005259] text-white shadow-sm"
                  : "bg-white text-[#404040] border border-[#404040]/10 hover:border-[#005259] hover:text-[#005259]"
              }`}
            >
              📍 Suresnes ({countSuresnes})
            </button>
          </PermissionGuard>

          <PermissionGuard actionId="benef_filter_de">
            <button
              onClick={() => setFiltreActif("DE")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                filtreActif === "DE"
                  ? "bg-[#005259] text-white shadow-sm"
                  : "bg-white text-[#404040] border border-[#404040]/10 hover:border-[#005259] hover:text-[#005259]"
              }`}
            >
              💼 France Travail ({countDE})
            </button>
          </PermissionGuard>

          <PermissionGuard actionId="benef_filter_blacklist">
            <button
              onClick={() => setFiltreActif("Blacklistes")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                filtreActif === "Blacklistes"
                  ? "bg-[#EF736A] text-white shadow-sm"
                  : "bg-white text-[#EF736A] border border-[#EF736A]/30 hover:bg-[#EF736A]/10"
              }`}
            >
              🚫 Blacklistés ({countBlacklistes})
            </button>
          </PermissionGuard>

          <button
            onClick={() => setFiltreActif("Adherents")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "Adherents"
                ? "bg-[#005259] text-white shadow-sm"
                : "bg-white text-[#404040] border border-[#404040]/10 hover:border-[#005259] hover:text-[#005259]"
            }`}
          >
            ✅ Adhérents ({countAdherents})
          </button>

          
        </div>

        {/* RÉSULTATS — ACCORDÉONS PAR INITIALE */}
        {beneficiairesParLettre.length > 0 ? (
          <div className="space-y-2">
            {beneficiairesParLettre.map(([lettre, liste]) => (
              <Accordion
                key={lettre}
                title={`${lettre === "#" ? "Autres" : lettre} (${liste.length})`}
                open={lettresOuvertes.has(lettre)}
                onToggle={() => toggleLettre(lettre)}
              >
                <div className="overflow-x-auto -m-2.5">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                        <th className="px-6 py-4">Identité</th>
                        <th className="px-6 py-4 hidden md:table-cell">Contact / Coordonnées</th>
                        <th className="px-6 py-4 hidden lg:table-cell">Localisation</th>
                        <th className="px-6 py-4 text-center hidden sm:table-cell">Visites</th>
                        <th className="px-6 py-4 hidden sm:table-cell">1er RDV</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#404040]/5">
                      {liste.map((b) => {
                        const estAdherent = b.Date_Adhesion && b.Date_Adhesion.trim() !== "";
                        const isBlackliste = b.Statut_Blacklist === "Oui";
                        const civilite = b.Civilité ? `${b.Civilité} ` : "";

                        return (
                          <tr key={b.id} className={`hover:bg-[#F3F3F2]/60 transition-colors group ${isBlackliste ? "bg-[#EF736A]/10" : ""} ${selectionFusion.includes(b.id) ? "bg-[#005259]/5" : ""}`}>
                            <td className="px-6 py-4">
                              <div className="flex items-start gap-3">
                                {modeSelectionFusion && (
                                  <input
                                    type="checkbox"
                                    checked={selectionFusion.includes(b.id)}
                                    disabled={!selectionFusion.includes(b.id) && selectionFusion.length >= 2}
                                    onChange={() => toggleSelectionFusion(b.id)}
                                    className="w-4 h-4 mt-1 accent-[#005259] cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 shrink-0"
                                  />
                                )}
                                <div>
                              <div className={`font-bold text-base tracking-tight uppercase transition-colors ${isBlackliste ? "text-[#EF736A] line-through" : "text-[#005259] group-hover:text-[#EA601F]"}`}>
                                <span className="text-[#404040]/60 font-normal normal-case text-xs mr-1">{civilite}</span>
                                {b.nomAffiche || "SANS NOM"}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs text-[#404040] font-medium">
                                  {b.prenomAffiche || "Sans prénom"}
                                </span>
                                {isBlackliste ? (
                                  <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-[#EF736A] bg-[#EF736A]/15 px-2 py-0.5 rounded border border-[#EF736A]/30">
                                    🚫 Blacklisté
                                  </span>
                                ) : estAdherent ? (
                                  <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-[#005259] bg-[#A9E0C9]/30 px-2 py-0.5 rounded border border-[#A9E0C9]">
                                    ✅ Adhérent
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-[#EA601F] bg-[#F9945D]/15 px-2 py-0.5 rounded border border-[#F9945D]/30">
                                    ⚠️ Non adhérent
                                  </span>
                                )}
                              </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4 hidden md:table-cell">
                              <div className="text-xs font-medium text-[#404040]">
                                {formatPhoneNumber(lireTelephone(b))}
                              </div>
                              <div className="text-xs text-[#404040]/60 truncate max-w-[220px] mt-0.5">
                                {b.email || b.Email || "—"}
                              </div>
                            </td>

                            <td className="px-6 py-4 hidden lg:table-cell">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-[#404040] uppercase tracking-wide">
                                  {b.Ville || "—"}
                                </span>
                                <span className="text-[10px] text-[#404040]/60 mt-0.5">
                                  {b.Code_Postal || "—"}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-center hidden sm:table-cell">
                              <span className={`inline-flex items-center justify-center text-xs font-bold px-2.5 py-1 rounded-xl border ${
                                b.totalVisites > 0
                                  ? "bg-[#005259]/10 text-[#005259] border-[#005259]/20"
                                  : "bg-[#F3F3F2] text-[#404040]/40 border-[#404040]/10"
                              }`}>
                                {b.totalVisites}
                              </span>
                            </td>

                            <td className="px-6 py-4 hidden sm:table-cell">
                              <div className="text-xs font-medium text-[#404040]/80">
                                {b.premierRDV}
                              </div>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end items-center gap-2">
                                <PermissionGuard actionId="benef_action_toggle_blacklist">
                                  <button
                                    onClick={() => handleToggleBlacklist(b.id, b.Statut_Blacklist)}
                                    title={isBlackliste ? "Retirer de la blacklist" : "Ajouter à la blacklist"}
                                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                                      isBlackliste
                                        ? "bg-[#EF736A]/20 text-[#EF736A] border-[#EF736A]/40 hover:bg-[#EF736A] hover:text-white"
                                        : "bg-[#F3F3F2] text-[#404040]/50 border-[#404040]/10 hover:text-[#EF736A] hover:border-[#EF736A]/40"
                                    }`}
                                  >
                                    <NoSymbolIcon className="w-4 h-4" />
                                  </button>
                                </PermissionGuard>

                                <PermissionGuard actionId="benef_action_open">
                                  <Link
                                    href={`/mediation/rencontres-numeriques/liste-beneficiaires/${b.id}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#005259] hover:bg-[#EA601F] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                                  >
                                    <span>Ouvrir</span>
                                    <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                                  </Link>
                                </PermissionGuard>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Accordion>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
            🔍 Aucun résultat pour ce filtre ou cette recherche.
            <div className="mt-3">
              <button
                onClick={() => { setSearchTerm(""); setFiltreActif("Tous"); }}
                className="text-[#005259] hover:underline cursor-pointer font-bold"
              >
                Réinitialiser la vue
              </button>
            </div>
          </div>
        )}

        {/* FOOTER STATS */}
        <div className="flex flex-col sm:flex-row justify-between items-center px-2 gap-2 text-xs">
          <p className="text-[#404040]/80 font-medium">
            Affichage de <span className="text-[#005259] font-bold">{filteredBeneficiaires.length}</span> bénéficiaire(s)
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-[#404040]/60 uppercase tracking-widest font-bold">
            <UserGroupIcon className="w-3.5 h-3.5 text-[#005259]" />
            <span>Base Centrale Colombbus</span>
          </div>
        </div>

      </div>

      {/* POP-UP : CHOIX DE LA FICHE CONSERVÉE AVANT FUSION */}
      {fusionModalOuvert && selectionFusion.length === 2 && (() => {
        const [fiche1, fiche2] = selectionFusion.map((id) => beneficiaires.find((b) => b.id === id)).filter(Boolean) as any[];
        if (!fiche1 || !fiche2) return null;

        const CarteFiche = ({ fiche }: { fiche: any }) => {
          const estSurvivant = survivantChoisi === fiche.id;
          return (
            <button
              type="button"
              onClick={() => setSurvivantChoisi(fiche.id)}
              className={`text-left w-full p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                estSurvivant ? "border-[#005259] bg-[#005259]/5" : "border-[#404040]/10 hover:border-[#404040]/25"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-[#005259] uppercase">{fiche.prenomAffiche} {fiche.nomAffiche}</span>
                {estSurvivant && (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white bg-[#005259] px-2 py-0.5 rounded">Conservée</span>
                )}
              </div>
              <div className="text-[11px] text-[#404040]/70 space-y-1">
                <div>📞 {formatPhoneNumber(fiche.Téléphone || fiche.telephone) || "—"}</div>
                <div>📍 {fiche.Ville || "—"} {fiche.Code_Postal || ""}</div>
                <div>🗓️ 1er RDV : {fiche.premierRDV}</div>
                <div>👥 {fiche.totalVisites} visite(s)</div>
                <div>{fiche.Date_Adhesion?.trim() ? "✅ Adhérent" : "⚠️ Non adhérent"}</div>
              </div>
            </button>
          );
        };

        return (
          <div className="fixed inset-0 bg-[#404040]/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white border border-[#404040]/10 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#005259] uppercase tracking-wide flex items-center gap-2">
                  <ArrowsPointingInIcon className="w-4 h-4 text-[#EA601F]" />
                  Fusionner ces deux fiches
                </h3>
                <button onClick={() => setFusionModalOuvert(false)} className="text-[#404040]/40 hover:text-[#404040] cursor-pointer">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <p className="text-[11px] text-[#404040]/70">
                Choisissez la fiche à <span className="font-bold text-[#005259]">conserver</span>. Son historique de visites recevra
                celui de l'autre fiche, et ses champs vides seront complétés avec les informations de l'autre fiche sans écraser les
                siens. La fiche non conservée sera <span className="font-bold text-[#EF736A]">définitivement supprimée</span>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CarteFiche fiche={fiche1} />
                <CarteFiche fiche={fiche2} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFusionModalOuvert(false)}
                  className="text-[#404040]/60 hover:text-[#404040] text-xs px-3 cursor-pointer transition-colors font-bold uppercase tracking-wider"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleFusionner}
                  disabled={!survivantChoisi || fusionEnCours}
                  className="px-4 py-2 bg-[#EA601F] hover:bg-[#005259] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {fusionEnCours ? "Fusion en cours..." : "Fusionner"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
    </PageGuard>
  );
}
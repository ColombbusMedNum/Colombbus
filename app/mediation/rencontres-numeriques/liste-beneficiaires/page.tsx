"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, collectionGroup, getDocs, query, where, updateDoc, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Quicksand } from "next/font/google";
import { PermissionGuard } from "@/components/PermissionGuard";
import PageGuard from "@/components/PageGuard";
import Accordion from "@/components/Accordion";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { usePermissions } from "@/lib/PermissionsProvider";
import { formatPhoneNumber } from "@/lib/formatPhone";
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  HomeIcon,
  ArrowTopRightOnSquareIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  NoSymbolIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";

// Lecteur CSV tolérant aux champs entre guillemets (virgules/guillemets
// internes échappés en ""), tel qu'exporté par Google Sheets — un simple
// split(",") casserait sur une adresse ou un commentaire contenant une virgule.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }
  return rows;
}

// Recherche d'une colonne par mots-clés plutôt que par position ou intitulé
// exact : l'export "Collecte information public" de Google Forms a des
// en-têtes longs, accentués et susceptibles de bouger si le formulaire est
// modifié — on matche par sous-chaînes normalisées (minuscules, sans accents)
// pour rester robuste à ces variations.
const REGEX_DIACRITIQUES = new RegExp("[̀-ͯ]", "g");
const REGEX_APOSTROPHES = new RegExp("[‘’]", "g");

function normaliserEntete(s: string): string {
  return (s || "")
    .normalize("NFD").replace(REGEX_DIACRITIQUES, "")
    .toLowerCase()
    .replace(REGEX_APOSTROPHES, "'")
    .trim();
}

// Correspondance stricte (en-tête entier, une fois normalisé) — nécessaire
// pour les en-têtes courts comme "Prénom", dont un mot-clé en sous-chaîne
// matcherait à tort la colonne Trigramme (dont la description contient
// littéralement "...1ère lettre du Prénom et 2 premières lettres du NOM...").
function trouverColonneExacte(headers: string[], texte: string): number {
  const cible = normaliserEntete(texte);
  return headers.map(normaliserEntete).findIndex((h) => h === cible);
}

function trouverColonne(headers: string[], ...motsClefs: string[]): number {
  const normalises = headers.map(normaliserEntete);
  return normalises.findIndex((h) => motsClefs.every((m) => h.includes(m)));
}

// Police Quicksand pour toute la page
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function ListeBeneficiaires() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { role } = usePermissions();
  const [beneficiaires, setBeneficiaires] = useState<any[]>([]);
  const [usagersDuJour, setUsagersDuJour] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtreActif, setFiltreActif] = useState<string>("Tous"); // Valeur par défaut : Tous
  const [loading, setLoading] = useState(true);
  const [lettresOuvertes, setLettresOuvertes] = useState<Set<string>>(new Set());
  const router = useRouter();

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

        // Extraction tolérante aux majuscules/accents
        const nom = userData.Nom || userData.nom || "";
        const prenom = userData.Prénom || userData.prénom || userData.Prenom || userData.prenom || "";

        const docsVisites = visitesParUtilisateur.get(docSnap.id) || [];
        if (docsVisites.length > 0) {
          nbVisitesPresent = docsVisites.filter(data => {
            return data.statut !== "Absent" && data.statut !== "Annulé" && data.presence !== "Absent" && data.presence !== false;
          }).length;

          const dates = docsVisites.map(d => d.date).filter(Boolean).sort();
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

  // "DD/MM/YYYY" (format du formulaire) -> "YYYY-MM-DD" (format Firestore
  // utilisé partout ailleurs dans l'app, ex agenda/page.tsx).
  function convertirDateFr(dateStr: string): string {
    const m = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return "";
    const [, jj, mm, aaaa] = m;
    return `${aaaa}-${mm.padStart(2, "0")}-${jj.padStart(2, "0")}`;
  }

  // Le formulaire ne demande pas explicitement Matin/Après-midi : on le
  // déduit de l'heure de l'horodatage de soumission (avant/après 13h),
  // hypothèse raisonnable puisque le formulaire est rempli juste après la
  // séance.
  function deriverMoment(horodateur: string): string {
    const m = horodateur.match(/(\d{1,2}):\d{2}(?::\d{2})?\s*$/);
    if (!m) return "Matin";
    return Number(m[1]) < 13 ? "Matin" : "Après-midi";
  }

  // La colonne "Civilité" du formulaire contient du texte libre (Monsieur/
  // Madame, M/F, Homme/Femme...) : on en déduit à la fois Civilité (M./Mme,
  // utilisée dans les fiches) et Sexe (Homme/Femme, utilisé dans les stats).
  function deriverCiviliteEtSexe(raw: string): { civilite: string; sexe: string } {
    // "Homme" contient la sous-chaîne "mme" : on doit d'abord écarter les
    // marqueurs masculins avant de chercher les marqueurs féminins, sans
    // quoi un simple includes("mme") classe tous les hommes en Mme.
    const g = normaliserEntete(raw);
    const estHomme = g.startsWith("h") || g.includes("monsieur") || g === "m" || g.startsWith("mr");
    const estFemme = !estHomme && (g.startsWith("f") || g.includes("madame") || g.startsWith("mme"));
    return estFemme ? { civilite: "Mme", sexe: "Femme" } : { civilite: "M.", sexe: "Homme" };
  }

  // Import en masse depuis l'export Google Forms "Collecte information
  // public" : une ligne par visite (pas par personne), colonnes repérées par
  // mots-clés plutôt que par position (voir trouverColonne) pour rester
  // robuste si le formulaire évolue. Deux difficultés propres à ce fichier :
  // - une même personne revient sur des dizaines de lignes (une par venue) ;
  //   le PROFIL n'est créé qu'une fois par identité (prénom + nom), à partir
  //   de la ligne la plus complète (un rendez-vous honoré renseigne bien plus
  //   de champs qu'un rendez-vous annulé/reporté) — mais CHAQUE ligne devient
  //   une entrée de suivi (visite) sur cette même fiche, avec le médiateur,
  //   la thématique, ce qui a été fait et la satisfaction ;
  // - les lignes d'ateliers collectifs (trimestre "T4") n'ont pas de nom de
  //   bénéficiaire : elles sont naturellement écartées faute de Prénom/Nom.
  //
  // Attention : aucune protection contre les doublons de VISITES si ce même
  // fichier est réimporté deux fois (contrairement aux profils, déjà protégés
  // par identité) — chaque ligne redeviendrait une nouvelle visite. À
  // n'utiliser qu'une fois par export.
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    // Ce type d'export Google Sheets est parfois encodé en Windows-1252
    // plutôt qu'en UTF-8 : un décodage UTF-8 direct produirait alors des
    // caractères accentués corrompus ("Ã©" au lieu de "é").
    const buffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buffer);
    if (/Ã.|â€/.test(text)) {
      text = new TextDecoder("windows-1252").decode(buffer);
    }

    const rows = parseCSV(text);
    if (rows.length < 2) {
      showToast("Fichier CSV vide ou incomplet.", "error");
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const idxPrenom = trouverColonneExacte(headers, "Prénom");
    const idxNom = trouverColonne(headers, "nom", "majuscule");
    if (idxPrenom === -1 || idxNom === -1) {
      showToast("Colonnes Prénom / Nom introuvables dans ce fichier.", "error");
      return;
    }
    const idxSexe = trouverColonne(headers, "civilite");
    const idxTelephone = trouverColonne(headers, "telephone");
    const idxEmail = trouverColonne(headers, "email");
    const idxAge = trouverColonne(headers, "age du");
    const idxSituationSocioPro = trouverColonne(headers, "situation socio");
    const idxAdresse = trouverColonne(headers, "adresse postale");
    const idxCodePostal = trouverColonne(headers, "code postal de residence");
    const idxHandicap = trouverColonne(headers, "situation de handicap");
    const idxRqth = trouverColonne(headers, "rqth");
    const idxAdhesionStatut = trouverColonne(headers, "adhesion a l'association");
    // Colonnes propres à chaque visite (suivi de la personne).
    const idxHorodateur = trouverColonne(headers, "horodateur");
    const idxLieu = trouverColonne(headers, "lieu de rdv");
    const idxDateRdv = trouverColonne(headers, "date du rendez-vous");
    const idxMediateurNom = trouverColonne(headers, "choisir le mediateur");
    const idxTrigramme = trouverColonne(headers, "trigramme");
    const idxPresente = trouverColonne(headers, "personne a ete presente");
    const idxThematique = trouverColonne(headers, "thematique abordee");
    const idxDetails = trouverColonne(headers, "specifier");
    const idxSatisfaction = trouverColonne(headers, "satisfait");
    const idxJustificatif = trouverColonne(headers, "justificatif");

    const val = (cols: string[], i: number) => (i >= 0 ? (cols[i] || "").trim() : "");

    // Une seule ligne — la plus complète — retenue par identité, pour le
    // PROFIL uniquement (les visites, elles, gardent toutes les lignes).
    const meilleureLigneParIdentite = new Map<string, { prenom: string; nom: string; sexe: string; telephone: string; email: string; age: string; situationSocioPro: string; adresse: string; codePostal: string; handicap: string; rqth: string; dateRdv: string; adhesionStatut: string; score: number }>();

    for (const cols of dataRows) {
      const prenom = val(cols, idxPrenom);
      const nom = val(cols, idxNom);
      if (!prenom || !nom) continue;

      const candidat = {
        prenom, nom,
        sexe: val(cols, idxSexe),
        telephone: val(cols, idxTelephone),
        email: val(cols, idxEmail),
        age: val(cols, idxAge),
        situationSocioPro: val(cols, idxSituationSocioPro),
        adresse: val(cols, idxAdresse),
        codePostal: val(cols, idxCodePostal),
        handicap: val(cols, idxHandicap),
        rqth: val(cols, idxRqth),
        dateRdv: convertirDateFr(val(cols, idxDateRdv)),
        adhesionStatut: val(cols, idxAdhesionStatut),
      };
      const score = [candidat.telephone, candidat.email, candidat.age, candidat.situationSocioPro, candidat.adresse, candidat.codePostal].filter(Boolean).length;

      const cle = `${prenom} ${nom}`.trim().toLowerCase();
      const existant = meilleureLigneParIdentite.get(cle);
      if (!existant || score > existant.score) {
        meilleureLigneParIdentite.set(cle, { ...candidat, score });
      }
    }

    // Identité -> id du document utilisateurs, qu'il soit déjà existant ou
    // créé par cet import — sert ensuite à rattacher chaque visite au bon
    // profil.
    const identiteVersId = new Map<string, string>();
    beneficiaires.forEach((b: any) => {
      const cle = `${b.prenomAffiche || ""} ${b.nomAffiche || ""}`.trim().toLowerCase();
      if (cle) identiteVersId.set(cle, b.id);
    });

    let batch = writeBatch(db);
    let opsEnAttente = 0;
    let profilsCrees = 0;
    let profilsExistants = 0;

    const commitSiPlein = async () => {
      if (opsEnAttente >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        opsEnAttente = 0;
      }
    };

    for (const [cle, p] of meilleureLigneParIdentite) {
      if (identiteVersId.has(cle)) { profilsExistants++; continue; }

      // Ville déduite du code postal (75xxx -> Paris, 92150 -> Suresnes) :
      // pas de colonne Ville dans ce formulaire.
      const ville = p.codePostal.startsWith("75") ? "PARIS" : p.codePostal === "92150" ? "Suresnes" : "";

      // Adhérent dès que la colonne Adhésion contient "oui" (ex "Oui - CB",
      // "Oui - Espèces") — "Déjà Adhérent" et les mentions "Non - ..."
      // n'entrent volontairement pas dans ce critère. Pas de date exacte
      // disponible dans le fichier : fixée au 1er janvier 2026.
      const estAdherentImport = normaliserEntete(p.adhesionStatut).includes("oui");

      // Le formulaire ne donne qu'un âge (pas de date de naissance) : on
      // l'approxime au 1er janvier de l'année de naissance déduite de l'âge
      // renseigné à la date de ce rendez-vous.
      const anneeRdv = p.dateRdv ? parseInt(p.dateRdv.slice(0, 4), 10) : NaN;
      const ageNum = parseInt(p.age, 10);
      const dateNaissance = (!isNaN(anneeRdv) && !isNaN(ageNum) && ageNum > 0 && ageNum < 120)
        ? `${anneeRdv - ageNum}-01-01`
        : "";

      const { civilite, sexe } = deriverCiviliteEtSexe(p.sexe);

      const ref = doc(collection(db, "utilisateurs"));
      batch.set(ref, {
        Civilité: civilite,
        Nom: p.nom.toUpperCase(),
        Prénom: p.prenom,
        Sexe: sexe,
        Téléphone: p.telephone,
        email: p.email,
        Adresse_Rue: p.adresse,
        Code_Postal: p.codePostal,
        Ville: ville,
        Situation_Socio_Pro: p.situationSocioPro,
        Situation_Handicap: p.handicap || "Non",
        RQTH: p.rqth || "Non",
        QPV: "Non",
        Statut_Blacklist: "Non",
        ...(dateNaissance ? { Date_Naissance: dateNaissance } : {}),
        ...(estAdherentImport ? { Date_Adhesion: "2026-01-01" } : {}),
      });
      identiteVersId.set(cle, ref.id);
      profilsCrees++;
      opsEnAttente++;
      await commitSiPlein();
    }

    // Une entrée de suivi (visite) par ligne du fichier — c'est là que
    // médiateur, thématique, ce qui a été fait et la satisfaction sont
    // effectivement enregistrés, contrairement au profil qui ne retient
    // qu'une synthèse par personne.
    let visitesCreees = 0;
    let visitesIgnorees = 0;
    for (const cols of dataRows) {
      const prenom = val(cols, idxPrenom);
      const nom = val(cols, idxNom);
      if (!prenom || !nom) continue;

      const cle = `${prenom} ${nom}`.trim().toLowerCase();
      const userId = identiteVersId.get(cle);
      const dateRdv = convertirDateFr(val(cols, idxDateRdv));
      if (!userId || !dateRdv) { visitesIgnorees++; continue; }

      const present = val(cols, idxPresente).toLowerCase().startsWith("oui");
      const mediateurNom = val(cols, idxMediateurNom);
      const trigramme = val(cols, idxTrigramme);
      const mediateur = trigramme ? `${mediateurNom} (${trigramme})` : mediateurNom;
      const satisfactionBrute = val(cols, idxSatisfaction).replace(",", ".");
      const satisfaction = present && satisfactionBrute ? Number(satisfactionBrute) || 0 : 0;

      const ref = doc(collection(db, "utilisateurs", userId, "visites"));
      batch.set(ref, {
        mediateur,
        lieu: val(cols, idxLieu),
        thematique: present ? val(cols, idxThematique) : "",
        details: present ? val(cols, idxDetails) : "",
        statut: present ? "Présent" : "Absent",
        absencePar: present ? "" : val(cols, idxJustificatif),
        satisfaction,
        date: dateRdv,
        moment: deriverMoment(val(cols, idxHorodateur)),
        createdAt: serverTimestamp(),
      });
      visitesCreees++;
      opsEnAttente++;
      await commitSiPlein();
    }

    if (opsEnAttente > 0) await batch.commit();

    const details: string[] = [];
    if (profilsExistants > 0) details.push(`${profilsExistants} profil(s) déjà existant(s) réutilisé(s)`);
    if (visitesIgnorees > 0) details.push(`${visitesIgnorees} ligne(s) sans date exploitable ignorée(s)`);

    showToast(
      visitesCreees > 0
        ? `${profilsCrees} bénéficiaire(s) créé(s), ${visitesCreees} visite(s) enregistrée(s)${details.length > 0 ? ` — ${details.join(", ")}` : ""}.`
        : `Aucune visite importée${details.length > 0 ? ` (${details.join(", ")})` : ""}.`,
      visitesCreees > 0 ? "success" : "error"
    );
    if (profilsCrees > 0 || visitesCreees > 0) fetchData();
  };

  // Reconstruit ENTIÈREMENT l'agenda dans planning_suresnes à partir des
  // visites déjà importées (voir handleImportCSV) : le fichier Google Forms
  // ne donne qu'un lieu et un moment (Matin/Après-midi) par visite, pas de
  // créneau agenda — on les reconstitue ici a posteriori. Chaque lieu devient
  // son propre "site" (onglet dans app/mediation/rencontres-numeriques/suresnes),
  // Suresnes/RN-91 gardant leurs conventions existantes (suffixe (RN)/(RN91)
  // sur mediateurNom).
  //
  // Volontairement PAS idempotent/additif : planning_suresnes ne contient à
  // ce stade que des créneaux reconstruits par cette même fonction (site
  // encore vide avant le tout premier import), donc on le vide et on le
  // regénère en entier à chaque lancement — sinon un créneau déjà présent
  // (créé par un essai précédent, avant un correctif comme l'ajout de la
  // thématique) resterait bloqué avec les anciennes données pour toujours.
  //
  // Nettoyage ponctuel : un tout premier essai de cette fonction écrivait les
  // lieux hors Suresnes dans planning_mediateurs (l'agenda général des
  // médiateurs), mélangés aux vrais créneaux du staff. On les identifie sans
  // ambiguïté : un créneau planning_mediateurs légitime porte toujours un
  // identifiant médiateur (mediatId, ou à défaut mediateurId/mediateur sur
  // les documents anciens) — voir lib/matchMediateur.ts — alors que ceux créés
  // par cette fonction n'en ont aucun.
  const handleMettreAJourAgenda = async () => {
    if (!(await confirm(
      "Reconstruire ENTIÈREMENT l'agenda (planning_suresnes, un onglet par lieu) à partir des visites déjà importées ? " +
      "Tous les créneaux actuels de planning_suresnes seront supprimés et recréés. " +
      "Cette opération supprime aussi les créneaux sans médiateur identifié qu'un précédent essai avait créés par erreur dans l'agenda général des médiateurs."
    ))) return;

    try {
      const [usersSnap, visitesSnap, suresnesSnap, mediateursSnap] = await Promise.all([
        getDocs(collection(db, "utilisateurs")),
        getDocs(collectionGroup(db, "visites")),
        getDocs(collection(db, "planning_suresnes")),
        getDocs(collection(db, "planning_mediateurs")),
      ]);

      const nomBeneficiaire = new Map<string, string>();
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        const nom = data.Nom || data.nom || "";
        const prenom = data.Prénom || data.prenom || "";
        nomBeneficiaire.set(d.id, `${prenom} ${nom}`.trim());
      });

      let batch = writeBatch(db);
      let ops = 0;
      const commitSiPlein = async () => {
        if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0; }
      };

      // Nettoyage des créneaux erronés du précédent essai (voir commentaire
      // ci-dessus) : aucun identifiant médiateur du tout = créé par cette
      // fonction, pas par un vrai médiateur/coordinateur.
      let actionsSupprimees = 0;
      for (const d of mediateursSnap.docs) {
        const data = d.data();
        if (!data.mediatId && !data.mediateurId && !data.mediateur) {
          batch.delete(doc(db, "planning_mediateurs", d.id));
          actionsSupprimees++;
          ops++;
          await commitSiPlein();
        }
      }

      // Reconstruction complète : on repart d'un planning_suresnes vide (voir
      // commentaire de fonction) plutôt que de fusionner avec l'existant.
      for (const d of suresnesSnap.docs) {
        batch.delete(doc(db, "planning_suresnes", d.id));
        ops++;
        await commitSiPlein();
      }

      const horairesPrisParCle = new Map<string, Set<string>>();
      const usagerDejaPresent = new Set<string>();

      const HORAIRES_PAR_MOMENT: Record<string, string[]> = {
        "Matin": ["10h00 - 11h30", "11h30 - 13h00"],
        "Après-midi": ["14h00 - 15h30", "15h30 - 17h00"],
      };

      // Suresnes/RN-91 gardent leur convention existante (site fixe +
      // suffixe sur mediateurNom, voir lib/activitesTypes.ts). Deux façons
      // d'y appartenir : la mention "RN" (ex "RN Suresnes", "RN - 91", pour
      // les modèles d'agenda), OU le lieu "Suresnes" seul et exact — c'est le
      // libellé réellement utilisé dans le fichier importé pour le lieu
      // principal. Un dérivé comme "Suresnes - à domicile" ou
      // "Suresnes - Collecte.Tech" n'est PAS un match exact : il garde son
      // propre onglet, c'est un service à part.
      const siteDeLieu = (lieu: string): string => {
        const upper = (lieu || "").trim().toUpperCase();
        if (upper === "SURESNES") return "suresnes";
        const estRN = upper.includes("RN");
        if (estRN && (upper.includes("91") || upper.includes("ESSONNE"))) return "rn91";
        if (estRN) return "suresnes";
        return lieu.trim();
      };
      // Le champ "mediateur" d'une visite importée porte le trigramme entre
      // parenthèses (voir handleImportCSV) : on l'enlève pour ne garder que
      // le nom, avant de reposer le suffixe (RN)/(RN91) attendu par l'agenda
      // Suresnes existant.
      const nomMediateurBase = (mediateurBrut: string) => mediateurBrut.replace(/\s*\([^)]*\)\s*$/, "").trim();

      // Certains médiateurs sont désignés par leur seul prénom (ou une
      // orthographe différente) dans le fichier importé, sans correspondre
      // au nom complet de leur fiche — d'où l'alerte "orphelin" dans l'agenda
      // Suresnes. Recensés au fur et à mesure par l'utilisateur.
      const ALIAS_MEDIATEURS: Record<string, string> = {
        "benoit": "Benoît DE TIMOWSKI",
        "emmanuel": "Emmanuel CHAUDY",
        "justine": "Justine PERINEL",
        "johaan": "Johaan",
      };
      const resoudreMediateur = (mediateurBrut: string) => {
        const base = nomMediateurBase(mediateurBrut);
        return ALIAS_MEDIATEURS[normaliserEntete(base)] || base;
      };

      let creneauxCrees = 0;
      let creneauxIgnores = 0;

      for (const docSnap of visitesSnap.docs) {
        const data = docSnap.data();
        const userId = docSnap.ref.parent.parent?.id;
        if (!userId || data.statut === "Absent" || !data.date || !data.moment || !data.mediateur || !data.lieu) continue;

        const usagerNom = nomBeneficiaire.get(userId) || "";
        const mediateurBase = resoudreMediateur(data.mediateur);
        const site = siteDeLieu(data.lieu);
        const mediateurNomComplet = site === "rn91" ? `${mediateurBase} (RN91)` : site === "suresnes" ? `${mediateurBase} (RN)` : mediateurBase;

        const cle = `${mediateurNomComplet}|${data.date}|${data.moment}`;
        const usagerCle = `${cle}|${usagerNom}`.toLowerCase();

        if (usagerNom && usagerDejaPresent.has(usagerCle)) continue;

        const horairesDispo = HORAIRES_PAR_MOMENT[data.moment] || [];
        const dejaPris = horairesPrisParCle.get(cle) || new Set<string>();
        const horaireLibre = horairesDispo.find((h) => !dejaPris.has(h));

        if (!horaireLibre) { creneauxIgnores++; continue; }

        dejaPris.add(horaireLibre);
        horairesPrisParCle.set(cle, dejaPris);
        if (usagerNom) usagerDejaPresent.add(usagerCle);

        const ref = doc(collection(db, "planning_suresnes"));
        batch.set(ref, {
          mediateurNom: mediateurNomComplet,
          date: data.date,
          moment: data.moment,
          horaire: horaireLibre,
          usager: usagerNom,
          thematique: data.thematique || "",
          site,
        });
        creneauxCrees++;
        ops++;
        await commitSiPlein();
      }

      if (ops > 0) await batch.commit();

      showToast(
        `Agenda mis à jour : ${creneauxCrees} créneau(x) créé(s)${creneauxIgnores > 0 ? `, ${creneauxIgnores} ignoré(s) (créneaux déjà pleins)` : ""}` +
        `${actionsSupprimees > 0 ? `, ${actionsSupprimees} créneau(x) erroné(s) supprimé(s) de l'agenda médiateurs` : ""}.`,
        "success"
      );
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'agenda :", error);
      showToast("Une erreur est survenue lors de la mise à jour de l'agenda.", "error");
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

  const { countAujourdhui, countSuresnes, countDE, countBlacklistes, countAdherents } = useMemo(() => {
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

    return { countAujourdhui, countSuresnes, countDE, countBlacklistes, countAdherents };
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
                <span>Agenda Suresnes</span>
              </Link>
            </PermissionGuard>

            <PermissionGuard actionId="page_access_bilan_suresnes">
              <Link
                href="/mediation/bilan-suresnes"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <UserGroupIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Analyse par Territoire</span>
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

            {/* IMPORT CSV EN MASSE — réservé à l'administrateur (délibérément
                hors de la matrice de droits configurable : un import en masse
                crée trop de données pour être ouvert à d'autres rôles). */}
            {role === "admin" && (
              <label className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 text-[#005259] text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm active:scale-95">
                <ArrowUpTrayIcon className="w-4 h-4" />
                <span>Importer CSV</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCSV} />
              </label>
            )}

            {/* MISE À JOUR DE L'AGENDA À PARTIR DES VISITES IMPORTÉES —
                réservé à l'administrateur, même logique que l'import CSV. */}
            {role === "admin" && (
              <button
                onClick={handleMettreAJourAgenda}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 text-[#005259] text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <ArrowPathIcon className="w-4 h-4" />
                <span>Mettre à jour l'agenda</span>
              </button>
            )}
          </div>
        </div>

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
              💼 Public France Travail ({countDE})
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
                          <tr key={b.id} className={`hover:bg-[#F3F3F2]/60 transition-colors group ${isBlackliste ? "bg-[#EF736A]/10" : ""}`}>
                            <td className="px-6 py-4">
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
                            </td>

                            <td className="px-6 py-4 hidden md:table-cell">
                              <div className="text-xs font-medium text-[#404040]">
                                {formatPhoneNumber(b.Téléphone || b.telephone)}
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
    </main>
    </PageGuard>
  );
}
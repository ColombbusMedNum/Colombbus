"use client";

import React, { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, updateDoc, getDocs, addDoc } from "firebase/firestore";
import { ChevronLeftIcon, ArrowDownTrayIcon, UserGroupIcon, HomeIcon, ArrowPathIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import PageGuard from "@/components/PageGuard";
import { PermissionGuard } from "@/components/PermissionGuard";
import { lireNom, lirePrenom, lireTelephone } from "@/lib/beneficiaireFields";

interface BeneficiaireCollecte {
  id: string;
  annee: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  creationDossier: boolean;
  testEntreeForm: boolean;
  testSortiePix: boolean;
  remiseAttestation: boolean;
  devis: boolean;
  facture: boolean;
  dechargeMateriel: boolean;
  scanArchivage: boolean;
  lienDossierDrive: string;
  lienAttestation: string;
  lienRemiseMateriel: string;
  // Plusieurs scans possibles pour un même bénéficiaire — un lien par ligne,
  // même format libre que "commentaires" plutôt qu'un tableau, pour rester
  // éditable dans un simple textarea sans UI d'ajout/suppression dédiée.
  lienScans: string;
  commentaires: string;
}

// Un lien de "Liens Scans" peut porter un titre libre, saisi comme
// "Titre | https://..." (séparateur "|" plutôt que ":" pour ne pas entrer en
// conflit avec le "://" de l'URL elle-même) — sans titre, on retombe sur
// "Scan N" à l'affichage.
function parserLignesLiens(valeur: string): { titre: string | null; url: string }[] {
  return valeur
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(ligne => {
      const index = ligne.indexOf("|");
      if (index === -1) return { titre: null, url: ligne };
      return { titre: ligne.slice(0, index).trim() || null, url: ligne.slice(index + 1).trim() };
    });
}

// Cellule "lien unique" réutilisée pour Drive/Attestation/Remise matériel —
// même principe clic-pour-éditer que les commentaires, mais un texte de
// libellé fixe à l'affichage (pas l'URL brute, souvent longue) plutôt qu'un
// textarea multi-lignes (réservé aux scans, qui peuvent être plusieurs).
function LienUnique({
  valeur, enEdition, onStartEdit, valeurEdition, onChangeEdition, onSave, label, placeholder,
}: {
  valeur: string;
  enEdition: boolean;
  onStartEdit: () => void;
  valeurEdition: string;
  onChangeEdition: (v: string) => void;
  onSave: () => void;
  label: string;
  placeholder: string;
}) {
  if (enEdition) {
    return (
      <input
        autoFocus
        type="url"
        value={valeurEdition}
        onChange={(e) => onChangeEdition(e.target.value)}
        onBlur={onSave}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSave(); } }}
        placeholder={placeholder}
        className="w-full bg-[#F3F3F2] border border-[#005259] text-[#404040] rounded-lg p-1.5 text-[11px] outline-none focus:ring-1 focus:ring-[#005259]"
      />
    );
  }

  if (!valeur) {
    return (
      <span onClick={onStartEdit} className="text-[#404040]/40 italic cursor-pointer hover:text-[#005259] p-1 block">
        Ajouter un lien...
      </span>
    );
  }

  // Le clic sur le lien ouvre l'URL (comportement attendu d'un lien) : le
  // bouton crayon, séparé, est donc indispensable pour pouvoir revenir
  // éditer/remplacer une valeur déjà enregistrée — sans lui, un lien une
  // fois posé n'était plus jamais modifiable depuis cette cellule.
  return (
    <div className="flex items-center gap-1 group/lien">
      <a
        href={valeur}
        target="_blank"
        rel="noopener noreferrer"
        title={valeur}
        className="text-[#005259] underline truncate hover:text-[#EA601F] transition-colors p-1"
      >
        {label}
      </a>
      <button
        type="button"
        onClick={onStartEdit}
        title="Modifier le lien"
        className="p-0.5 text-[#404040]/30 hover:text-[#005259] opacity-0 group-hover/lien:opacity-100 transition-opacity shrink-0 cursor-pointer"
      >
        <PencilSquareIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function SuiviCollecteTech() {
  const [beneficiaires, setBeneficiaires] = useState<BeneficiaireCollecte[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentValue, setCommentValue] = useState("");
  const [editingDriveId, setEditingDriveId] = useState<string | null>(null);
  const [driveValue, setDriveValue] = useState("");
  const [editingAttestationId, setEditingAttestationId] = useState<string | null>(null);
  const [attestationValue, setAttestationValue] = useState("");
  const [editingRemiseMaterielId, setEditingRemiseMaterielId] = useState<string | null>(null);
  const [remiseMaterielValue, setRemiseMaterielValue] = useState("");
  const [editingScansId, setEditingScansId] = useState<string | null>(null);
  const [scansValue, setScansValue] = useState("");

  // Barre de défilement horizontal dupliquée en haut du tableau (en plus de
  // celle, normale, tout en bas) : un simple div de la largeur réelle du
  // tableau, dont le scroll est synchronisé dans les deux sens avec le vrai
  // conteneur scrollable qui l'entoure.
  const scrollHautRef = useRef<HTMLDivElement>(null);
  const scrollTableRef = useRef<HTMLDivElement>(null);
  const [largeurTableau, setLargeurTableau] = useState(0);

  useEffect(() => {
    const mettreAJourLargeur = () => {
      if (scrollTableRef.current) setLargeurTableau(scrollTableRef.current.scrollWidth);
    };
    mettreAJourLargeur();
    window.addEventListener("resize", mettreAJourLargeur);
    return () => window.removeEventListener("resize", mettreAJourLargeur);
  }, [beneficiaires]);

  // Chargement unique (pas de temps réel) : le scan des sous-collections de
  // chaque usager est coûteux (3×N lectures) — on l'exécute au chargement de
  // la page et sur demande explicite via le bouton "Rafraîchir", plutôt que
  // de le relancer automatiquement à chaque écriture Firestore faite par
  // n'importe qui ailleurs dans l'application.
  const fetchBeneficiairesCollecte = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "utilisateurs"));
      const listeTemporaire: BeneficiaireCollecte[] = [];

      // Traitement séquentiel ou parallèle sécurisé pour chaque usager
      const promises = snapshot.docs.map(async (userDoc) => {
          const userData = userDoc.data();
          let associeACollecte = false;

          // 1. Vérification dans la sous-collection générique d'historique (actions / rendezvous / visites)
          const sousCollectionsPossibles = ["actions", "rendezvous", "visites"];
          
          for (const nomColl of sousCollectionsPossibles) {
            if (associeACollecte) break;
            try {
              const subSnap = await getDocs(collection(db, "utilisateurs", userDoc.id, nomColl));
              
              // On parcourt les actions enregistrées pour voir si l'une d'elles correspond au lieu recherché
              subSnap.docs.forEach((subDoc) => {
                const subData = subDoc.data();
                const lieu = subData.Lieu_RDV || subData.lieuRDV || subData.lieu || subData.lieu_rencontre || "";
                if (lieu.trim() === "92 - Collecte Tech") {
                  associeACollecte = true;
                }
              });
            } catch (err) {
              // Ignore les sous-collections inexistantes pour cet usager
            }
          }

          // 2. Si l'utilisateur possède une action liée, on construit sa ligne Excel
          if (associeACollecte) {
            let anneeExtraite = "2026";
            if (userData.anneeCollecte) {
              anneeExtraite = userData.anneeCollecte;
            } else if (userData.Date_Adhesion) {
              const match = userData.Date_Adhesion.match(/\d{4}/);
              if (match) anneeExtraite = match[0];
            }

            listeTemporaire.push({
              id: userDoc.id,
              annee: anneeExtraite,
              nom: lireNom(userData) || "—",
              prenom: lirePrenom(userData) || "—",
              telephone: lireTelephone(userData) || "—",
              email: userData.email || userData.Email || "—",
              creationDossier: !!userData.creationDossier,
              testEntreeForm: !!userData.testEntreeForm,
              testSortiePix: !!userData.testSortiePix,
              remiseAttestation: !!userData.remiseAttestation,
              devis: !!userData.devis,
              facture: !!userData.facture,
              dechargeMateriel: !!userData.dechargeMateriel,
              scanArchivage: !!userData.scanArchivage,
              lienDossierDrive: userData.lienDossierDrive || "",
              lienAttestation: userData.lienAttestation || "",
              lienRemiseMateriel: userData.lienRemiseMateriel || "",
              lienScans: userData.lienScans || "",
              commentaires: userData.commentairesCollecte || ""
            });
          }
        });

      await Promise.all(promises);

      // Tri final par ordre alphabétique
      listeTemporaire.sort((a, b) => a.nom.localeCompare(b.nom));
      setBeneficiaires(listeTemporaire);
    } catch (error) {
      console.error("Erreur lors du traitement des actions :", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeneficiairesCollecte();
  }, []);

  const handleAnneeChange = async (id: string, nouvelleAnnee: string) => {
    try {
      await updateDoc(doc(db, "utilisateurs", id), { anneeCollecte: nouvelleAnnee });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStep = async (id: string, field: keyof BeneficiaireCollecte, currentVal: boolean) => {
    const newVal = !currentVal;

    // Mise à jour optimiste immédiate : cette page ne s'actualise pas en
    // temps réel (chargement unique, voir fetchBeneficiairesCollecte), donc
    // sans ça la case ne se cochait visuellement qu'au prochain "Rafraîchir"
    // manuel — d'où l'impression de lenteur, l'écriture Firestore elle-même
    // étant pourtant rapide.
    setBeneficiaires(prev => prev.map(b => (b.id === id ? { ...b, [field]: newVal } : b)));

    try {
      // 1. Mise à jour de l'état dans Firestore
      await updateDoc(doc(db, "utilisateurs", id), { [field]: newVal });

      // 2. Traitement si la case "devis" passe à true
      if (field === "devis" && newVal) {
        const beneficiaire = beneficiaires.find((b) => b.id === id);

        if (beneficiaire) {
          const dateJour = new Date().toLocaleDateString("fr-FR");
          const messageNotif = `📄 Demande de devis : La case devis a été cochée pour ${beneficiaire.prenom} ${beneficiaire.nom} (Tel: ${beneficiaire.telephone} / Email: ${beneficiaire.email}).`;

          // A. Ajout dans la collection "notifications" de l'application
          await addDoc(collection(db, "notifications"), {
            message: messageNotif,
            createdAt: Date.now(),
            lue: false,
            destinataireEmail: "ct92-mednum@colombbus.org",
            type: "devis_collecte"
          });

          // B. Envoi d'un email en arrière-plan via l'API interne
          fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: "ct92-mednum@colombbus.org",
              subject: `[Collecte Tech] Demande de devis - ${beneficiaire.prenom} ${beneficiaire.nom}`,
              text: `Bonjour,\n\nLa case 'Devis' a été cochée le ${dateJour} pour le bénéficiaire suivant :\n\n- Nom : ${beneficiaire.nom}\n- Prénom : ${beneficiaire.prenom}\n- Téléphone : ${beneficiaire.telephone}\n- Email : ${beneficiaire.email}\n- Année : ${beneficiaire.annee}\n\nMerci de prendre en charge cette demande.`
            })
          }).catch((err) => console.error("Erreur d'envoi d'email :", err));
        }
      }
    } catch (err) {
      console.error("Erreur lors de la mise à jour :", err);
      // L'écriture Firestore a échoué : annule la mise à jour optimiste
      // pour ne pas laisser la case cochée à tort à l'écran.
      setBeneficiaires(prev => prev.map(b => (b.id === id ? { ...b, [field]: currentVal } : b)));
    }
  };

  const handleSaveComment = async (id: string) => {
    try {
      await updateDoc(doc(db, "utilisateurs", id), { commentairesCollecte: commentValue });
      setBeneficiaires(prev => prev.map(b => b.id === id ? { ...b, commentaires: commentValue } : b));
      setEditingCommentId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDrive = async (id: string) => {
    try {
      await updateDoc(doc(db, "utilisateurs", id), { lienDossierDrive: driveValue.trim() });
      setBeneficiaires(prev => prev.map(b => b.id === id ? { ...b, lienDossierDrive: driveValue.trim() } : b));
      setEditingDriveId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAttestation = async (id: string) => {
    try {
      await updateDoc(doc(db, "utilisateurs", id), { lienAttestation: attestationValue.trim() });
      setBeneficiaires(prev => prev.map(b => b.id === id ? { ...b, lienAttestation: attestationValue.trim() } : b));
      setEditingAttestationId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRemiseMateriel = async (id: string) => {
    try {
      await updateDoc(doc(db, "utilisateurs", id), { lienRemiseMateriel: remiseMaterielValue.trim() });
      setBeneficiaires(prev => prev.map(b => b.id === id ? { ...b, lienRemiseMateriel: remiseMaterielValue.trim() } : b));
      setEditingRemiseMaterielId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveScans = async (id: string) => {
    try {
      await updateDoc(doc(db, "utilisateurs", id), { lienScans: scansValue });
      setBeneficiaires(prev => prev.map(b => b.id === id ? { ...b, lienScans: scansValue } : b));
      setEditingScansId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const exportToCSV = () => {
    if (beneficiaires.length === 0) return;
    const headers = ["Année;Nom;Prénom;Numéro de téléphone personnel;Mail contact;Création Dossier DRIVE;Lien Dossier Drive;Test entrée Google Form;Test sortie PIX (ABC PIX);Remise de l'attestation compétences;Lien Attestation;Devis;Facture;Décharge matériel;Lien Remise Matériel;Scan et archivage;Liens Scans;Commentaires\n"];
    const rows = beneficiaires.map(b =>
      `${b.annee};${b.nom};${b.prenom};${b.telephone};${b.email};${b.creationDossier?'X':''};${b.lienDossierDrive};${b.testEntreeForm?'X':''};${b.testSortiePix?'X':''};${b.remiseAttestation?'X':''};${b.lienAttestation};${b.devis?'X':''};${b.facture?'X':''};${b.dechargeMateriel?'X':''};${b.lienRemiseMateriel};${b.scanArchivage?'X':''};${b.lienScans.replace(/\n/g, " | ")};${b.commentaires.replace(/\n/g, " ")}`
    );
    const blob = new Blob([headers + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `suivi_collecte_tech_${new Date().toLocaleDateString('fr-FR')}.csv`);
    link.click();
  };

  return (
    <PageGuard pageId="page_access_suivi_collecte">
    <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-[1600px] mx-auto space-y-6 relative z-10">
        
        {/* BARRE HAUTE / ENTÊTE */}
        <div className="bg-white p-5 rounded-2xl border border-[#404040]/10 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm mb-3"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
            <h1 className="text-xl md:text-2xl font-extrabold uppercase text-[#005259] tracking-tight flex items-center gap-2">
              Suivi <span className="text-[#EA601F]">IdF — 92 Collecte Tech</span>
            </h1>
            <p className="text-xs text-[#404040]/70 mt-1">Tableau opérationnel filtré exclusivement sur la Collecte Tech (92)</p>
          </div>

          <div className="flex items-center gap-2">
          <button
            onClick={fetchBeneficiairesCollecte}
            disabled={loading}
            title="Recharger la liste (les données ne se mettent plus à jour automatiquement)"
            className="inline-flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white disabled:opacity-40 border border-[#404040]/15 text-[#005259] font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Rafraîchir</span>
          </button>
          <PermissionGuard actionId="collecte_export">
            <button
              onClick={exportToCSV}
              disabled={beneficiaires.length === 0}
              className="inline-flex items-center gap-2 bg-[#EA601F] hover:bg-[#005259] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              <ArrowDownTrayIcon className="w-4 h-4 text-white" />
              <span>Exporter au format Excel</span>
            </button>
          </PermissionGuard>
          </div>
        </div>

        {/* AFFICHAGE DE LA GRILLE DE SUIVI */}
        {loading ? (
          <div className="text-center py-24 text-[#005259] font-bold tracking-widest animate-pulse uppercase text-xs">
            Analyse des actions en cours...
          </div>
        ) : beneficiaires.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-[#404040]/20 rounded-2xl bg-white max-w-4xl mx-auto shadow-sm">
            <UserGroupIcon className="w-8 h-8 text-[#404040]/40 mx-auto mb-3" />
            <p className="text-[#404040]/70 text-xs font-bold">Aucun bénéficiaire avec une action enregistrée à "92 - Collecte Tech".</p>
          </div>
        ) : (
          <div className="w-full bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
            <div
              ref={scrollHautRef}
              className="overflow-x-auto overflow-y-hidden"
              onScroll={(e) => { if (scrollTableRef.current) scrollTableRef.current.scrollLeft = e.currentTarget.scrollLeft; }}
            >
              <div style={{ width: largeurTableau, height: 1 }} />
            </div>
            <div
              ref={scrollTableRef}
              className="overflow-x-auto"
              onScroll={(e) => { if (scrollHautRef.current) scrollHautRef.current.scrollLeft = e.currentTarget.scrollLeft; }}
            >
              <table className="w-full text-left border-collapse table-fixed min-w-[2100px]">
                <thead>
                  <tr className="bg-[#F3F3F2] text-[10px] font-bold uppercase text-[#005259] border-b border-[#404040]/10 tracking-wider">
                    <th className="p-3 w-24 pl-5">Année</th>
                    <th className="p-3 w-40 sticky left-0 z-20 bg-[#F3F3F2] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">Nom</th>
                    <th className="p-3 w-40 sticky left-40 z-20 bg-[#F3F3F2] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">Prénom</th>
                    <th className="p-3 w-44">Téléphone personnel</th>
                    <th className="p-3 w-52">Mail contact</th>
                    
                    <th className="p-2 w-28 text-center text-[9px] border-l border-[#404040]/10">Création Dossier DRIVE</th>
                    <th className="p-3 w-56 text-[9px]">Lien Dossier Drive</th>
                    <th className="p-2 w-24 text-center text-[9px]">Test entrée Google Form</th>
                    <th className="p-2 w-24 text-center text-[9px]">Test sortie PIX</th>
                    <th className="p-2 w-24 text-center text-[9px]">Remise Attestation</th>
                    <th className="p-3 w-48 text-[9px]">Lien Attestation</th>
                    <th className="p-2 w-20 text-center text-[9px] bg-[#EA601F]/10 text-[#EA601F] border-l border-[#404040]/10">Devis</th>
                    <th className="p-2 w-20 text-center text-[9px] border-l border-[#404040]/10">Facture</th>
                    <th className="p-2 w-24 text-center text-[9px]">Décharge matériel</th>
                    <th className="p-3 w-48 text-[9px]">Lien Remise Matériel</th>
                    <th className="p-2 w-24 text-center text-[9px]">Scan & Archivage</th>
                    <th className="p-3 w-56 text-[9px]">Liens Scans (titre | lien, un par ligne)</th>

                    <th className="p-3 w-80 border-l border-[#404040]/10">Commentaires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#404040]/10 text-[12px] text-[#404040] font-medium">
                  {beneficiaires.map((b) => (
                    <tr key={b.id} className="hover:bg-[#F3F3F2]/60 transition-colors group">
                      <td className="p-3 pl-5 text-xs">
                        <PermissionGuard actionId="collecte_change_year">
                          <select
                            value={b.annee}
                            onChange={(e) => handleAnneeChange(b.id, e.target.value)}
                            className="bg-[#F3F3F2] border border-[#404040]/15 rounded-lg px-2 py-1 text-[#005259] text-[11px] font-bold outline-none focus:border-[#005259] cursor-pointer"
                          >
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                          </select>
                        </PermissionGuard>
                      </td>

                      <td className="p-3 font-bold text-[#005259] uppercase truncate sticky left-0 z-10 bg-white group-hover:bg-[#F3F3F2]/60 transition-colors shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                        <Link href={`/mediation/rencontres-numeriques/liste-beneficiaires/${b.id}`} className="hover:text-[#EA601F] hover:underline transition-colors">
                          {b.nom}
                        </Link>
                      </td>
                      <td className="p-3 text-[#404040] font-bold capitalize truncate sticky left-40 z-10 bg-white group-hover:bg-[#F3F3F2]/60 transition-colors shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">{b.prenom}</td>
                      <td className="p-3 text-[#404040]/80 text-xs">{b.telephone}</td>
                      <td className="p-3 text-[#404040]/80 truncate text-xs">{b.email}</td>
                      
                      {(() => {
                        const renderCase = (cell: { field: string; color: string; bg: string }) => {
                          const isChecked = b[cell.field as keyof BeneficiaireCollecte] as boolean;
                          return (
                            <td
                              key={cell.field}
                              className={`p-2 text-center border-l border-[#404040]/10 ${cell.bg} ${isChecked ? 'bg-[#A9E0C9]/30' : ''}`}
                            >
                              <PermissionGuard actionId="collecte_toggle_step">
                                <label className="flex items-center justify-center w-full h-full cursor-pointer py-1">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleStep(b.id, cell.field as keyof BeneficiaireCollecte, isChecked)}
                                    className={`w-4 h-4 rounded border-[#404040]/30 bg-white ${cell.color} transition-all cursor-pointer`}
                                  />
                                </label>
                              </PermissionGuard>
                            </td>
                          );
                        };
                        return (
                          <>
                            {renderCase({ field: "creationDossier", color: "accent-[#005259]", bg: "bg-[#F3F3F2]/30" })}

                            <td className="p-2 border-l border-[#404040]/10 text-[11px]">
                              <PermissionGuard
                                actionId="collecte_comment_edit"
                                fallback={b.lienDossierDrive ? (
                                  <a href={b.lienDossierDrive} target="_blank" rel="noopener noreferrer" className="text-[#005259] underline truncate block hover:text-[#EA601F] transition-colors">Dossier Drive</a>
                                ) : <span className="text-[#404040]/40 italic">—</span>}
                              >
                                <LienUnique
                                  valeur={b.lienDossierDrive}
                                  enEdition={editingDriveId === b.id}
                                  onStartEdit={() => { setEditingDriveId(b.id); setDriveValue(b.lienDossierDrive); }}
                                  valeurEdition={driveValue}
                                  onChangeEdition={setDriveValue}
                                  onSave={() => handleSaveDrive(b.id)}
                                  label="Dossier Drive"
                                  placeholder="https://drive.google.com/..."
                                />
                              </PermissionGuard>
                            </td>

                            {[
                              { field: "testEntreeForm", color: "accent-[#005259]", bg: "bg-[#F3F3F2]/30" },
                              { field: "testSortiePix", color: "accent-[#005259]", bg: "bg-[#F3F3F2]/30" },
                              { field: "remiseAttestation", color: "accent-[#005259]", bg: "bg-[#F3F3F2]/30" },
                            ].map(renderCase)}

                            <td className="p-2 border-l border-[#404040]/10 text-[11px]">
                              <PermissionGuard
                                actionId="collecte_comment_edit"
                                fallback={b.lienAttestation ? (
                                  <a href={b.lienAttestation} target="_blank" rel="noopener noreferrer" className="text-[#005259] underline truncate block hover:text-[#EA601F] transition-colors">Attestation</a>
                                ) : <span className="text-[#404040]/40 italic">—</span>}
                              >
                                <LienUnique
                                  valeur={b.lienAttestation}
                                  enEdition={editingAttestationId === b.id}
                                  onStartEdit={() => { setEditingAttestationId(b.id); setAttestationValue(b.lienAttestation); }}
                                  valeurEdition={attestationValue}
                                  onChangeEdition={setAttestationValue}
                                  onSave={() => handleSaveAttestation(b.id)}
                                  label="Attestation"
                                  placeholder="https://..."
                                />
                              </PermissionGuard>
                            </td>

                            {[
                              { field: "devis", color: "accent-[#EA601F]", bg: "bg-[#EA601F]/5" },
                              { field: "facture", color: "accent-[#005259]", bg: "bg-[#F3F3F2]/30" },
                              { field: "dechargeMateriel", color: "accent-[#005259]", bg: "bg-[#F3F3F2]/30" },
                            ].map(renderCase)}

                            <td className="p-2 border-l border-[#404040]/10 text-[11px]">
                              <PermissionGuard
                                actionId="collecte_comment_edit"
                                fallback={b.lienRemiseMateriel ? (
                                  <a href={b.lienRemiseMateriel} target="_blank" rel="noopener noreferrer" className="text-[#005259] underline truncate block hover:text-[#EA601F] transition-colors">Remise matériel</a>
                                ) : <span className="text-[#404040]/40 italic">—</span>}
                              >
                                <LienUnique
                                  valeur={b.lienRemiseMateriel}
                                  enEdition={editingRemiseMaterielId === b.id}
                                  onStartEdit={() => { setEditingRemiseMaterielId(b.id); setRemiseMaterielValue(b.lienRemiseMateriel); }}
                                  valeurEdition={remiseMaterielValue}
                                  onChangeEdition={setRemiseMaterielValue}
                                  onSave={() => handleSaveRemiseMateriel(b.id)}
                                  label="Remise matériel"
                                  placeholder="https://..."
                                />
                              </PermissionGuard>
                            </td>

                            {[
                              { field: "scanArchivage", color: "accent-[#005259]", bg: "bg-[#F3F3F2]/30" },
                            ].map(renderCase)}

                            <td className="p-2 border-l border-[#404040]/10 text-[11px]">
                              <PermissionGuard
                                actionId="collecte_comment_edit"
                                fallback={
                                  <div className="flex flex-col gap-0.5">
                                    {parserLignesLiens(b.lienScans).map(({ titre, url }, i) => (
                                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" title={url} className="text-[#005259] underline truncate hover:text-[#EA601F] transition-colors">
                                        {titre || `Scan ${i + 1}`}
                                      </a>
                                    ))}
                                    {!b.lienScans && <span className="text-[#404040]/40 italic">—</span>}
                                  </div>
                                }
                              >
                                {editingScansId === b.id ? (
                                  <textarea
                                    autoFocus
                                    value={scansValue}
                                    onChange={(e) => setScansValue(e.target.value)}
                                    onBlur={() => handleSaveScans(b.id)}
                                    placeholder={"Un lien par ligne, titre optionnel :\nPasseport | https://...\nhttps://... (sans titre = \"Scan 1\")"}
                                    className="w-full bg-[#F3F3F2] border border-[#005259] text-[#404040] rounded-lg p-1.5 text-[11px] outline-none min-h-[64px] focus:ring-1 focus:ring-[#005259] resize-y"
                                  />
                                ) : !b.lienScans ? (
                                  <span
                                    onClick={() => { setEditingScansId(b.id); setScansValue(b.lienScans); }}
                                    className="text-[#404040]/40 italic cursor-pointer hover:text-[#005259] p-1 block"
                                  >
                                    Ajouter des liens...
                                  </span>
                                ) : (
                                  <div className="flex items-start gap-1 group/lien p-1">
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                      {parserLignesLiens(b.lienScans).map(({ titre, url }, i) => (
                                        <a
                                          key={i}
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={url}
                                          className="text-[#005259] underline truncate hover:text-[#EA601F] transition-colors"
                                        >
                                          {titre || `Scan ${i + 1}`}
                                        </a>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingScansId(b.id); setScansValue(b.lienScans); }}
                                      title="Modifier les liens"
                                      className="p-0.5 text-[#404040]/30 hover:text-[#005259] opacity-0 group-hover/lien:opacity-100 transition-opacity shrink-0 cursor-pointer"
                                    >
                                      <PencilSquareIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </PermissionGuard>
                            </td>
                          </>
                        );
                      })()}

                      <td className="p-2 border-l border-[#404040]/10 text-[11px]">
                        <PermissionGuard
                          actionId="collecte_comment_edit"
                          fallback={
                            <div className="w-full h-full min-h-[32px] text-[#404040]/80 whitespace-pre-wrap break-words p-1">
                              {b.commentaires || <span className="text-[#404040]/40 italic">Aucune note</span>}
                            </div>
                          }
                        >
                          <div
                            className="w-full h-full"
                            onClick={() => {
                              if (editingCommentId !== b.id) {
                                setEditingCommentId(b.id);
                                setCommentValue(b.commentaires);
                              }
                            }}
                          >
                            {editingCommentId === b.id ? (
                              <textarea
                                autoFocus
                                value={commentValue}
                                onChange={(e) => setCommentValue(e.target.value)}
                                onBlur={() => handleSaveComment(b.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSaveComment(b.id);
                                  }
                                }}
                                className="w-full bg-[#F3F3F2] border border-[#005259] text-[#404040] rounded-lg p-2 text-[11px] outline-none min-h-[80px] focus:ring-1 focus:ring-[#005259] resize-y"
                              />
                            ) : (
                              <div className="w-full h-full min-h-[32px] cursor-pointer text-[#404040]/80 whitespace-pre-wrap break-words hover:text-[#005259] transition-colors p-1">
                                {b.commentaires || <span className="text-[#404040]/40 italic">Ajouter une note...</span>}
                              </div>
                            )}
                          </div>
                        </PermissionGuard>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
    </PageGuard>
  );
}
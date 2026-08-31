"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc, arrayUnion } from "firebase/firestore";
import { useMediateurs } from "@/lib/MediateursProvider";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import {
  HomeIcon,
  ArrowLeftIcon,
  UserCircleIcon,
  IdentificationIcon,
  UserGroupIcon,
  AcademicCapIcon,
  CheckBadgeIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleLeftRightIcon,
  TrashIcon,
  PlusIcon,
  PhotoIcon,
  XMarkIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { formatPhoneNumber } from "@/lib/formatPhone";
import FicheEntretienDiagnostic from "./FicheEntretienDiagnostic";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

interface AbsenceRecord {
  date: string;
  justifiee: boolean;
  type: string;
  raison: string;
  reference: string;
  lien: string;
}

// Un seul document Firestore regroupe TOUS les champs répartis sur les
// différentes pages (Réponses, Suivi de recrutement, Apprenant·e·s,
// Évolution, Absences) — la fiche se contente donc de tout relire ici, sans
// requête supplémentaire.
export interface Inscription {
  id: string;
  // Pré-inscription
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
  Parcours?: string;
  Session?: string;
  // Suivi de recrutement
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
  Decision?: string;
  Avis_Positif_Negatif?: string;
  A_Confirme?: string;
  OK_NOK?: string;
  // Suivi pédagogique (Apprenant·e·s) — parcours Tech.
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
  // Évolution
  Evolution?: Record<string, string>;
  Evolution_Retards?: Record<string, string>;
  Evolution_Actif?: boolean;
  // Absences
  Absences?: AbsenceRecord[];
  // Bilan de formation — dates d'entrée/fin calculées depuis Session,
  // le reste est renseigné à la main par l'équipe pédagogique.
  Bilan_DateEvaluation1?: string;
  Bilan_Evaluation1?: string;
  Bilan_DateEvaluation2?: string;
  Bilan_Evaluation2?: string;
  Bilan_DateEvaluation3?: string;
  Bilan_Evaluation3?: string;
  Bilan_Adaptation?: string;
  Bilan_CommentaireGeneral?: string;
  Bilan_CompetencesTransversales?: string;
  Bilan_Journal?: EntreeJournal[];
  // Compte rendu d'entretien individuel de fin de parcours.
  // Noms du staff Colombbus et/ou de personnes extérieures — ces dernières
  // sont conservées dans configuration_bilan_formation/suggestions pour
  // rester proposées ensuite (voir ajouterSuggestion).
  Entretien_PersonnesPresentes?: string[];
  Entretien_RetoursPix?: string;
  Entretien_RetoursDevCyber?: string;
  Entretien_RetoursMaintenance?: string;
  Entretien_InterventionsExterieures?: EntreeAppreciation[];
  Entretien_RetoursFormateurs?: string;
  Entretien_TableFormateurs?: EntreeAppreciation[];
  Entretien_ProjetProfessionnel?: string;
  Entretien_PistesAExplorer?: string;
  Entretien_FaitA?: string;
  Entretien_FaitLe?: string;
  // Images de signature encodées en base64, stockées directement dans le
  // document (comme la bibliothèque de logos avant sa migration vers
  // Firebase Storage) — pas besoin d'un vrai fichier hébergé pour ça.
  Entretien_SignatureApprenantUrl?: string;
  Entretien_SignatureColombbusUrl?: string;
  // Fiche entretien diagnostic (formulaire papier Numérik'Pro Tech saisi
  // directement ici) — voir FicheEntretienDiagnostic.tsx. Les champs
  // d'identité/contact déjà présents plus haut (Civilité, Nom, Prénom,
  // Téléphone, Email, Code_Postal, Ville, RQTH, France_Travail,
  // Niveau_Etudes, Age) sont réutilisés tels quels, pas dupliqués ici.
  Diagnostic_DateRealisation?: string;
  Diagnostic_ModeEntretienAtelier?: boolean;
  Diagnostic_ModeDetail?: string;
  Diagnostic_NomRealisateur?: string;
  Diagnostic_FonctionRealisateur?: string;
  Diagnostic_LieuRealisation?: string;
  Diagnostic_PeriodeRealisation?: string;
  Diagnostic_OrientePar?: string;
  Diagnostic_NomUsage?: string;
  Diagnostic_DateNaissance?: string;
  Diagnostic_TelFixe?: string;
  Diagnostic_Adresse?: string;
  Diagnostic_NumSecuriteSociale?: string;
  Diagnostic_NumCNI?: string;
  Diagnostic_NumCarteSejour?: string;
  Diagnostic_SituationFamiliale?: string;
  Diagnostic_SituationParticuliere?: string[];
  Diagnostic_SituationParticuliereAutre?: string;
  Diagnostic_Chomage?: boolean;
  Diagnostic_DureeChomage?: string;
  Diagnostic_CongeParental?: boolean;
  Diagnostic_FranceTravailDepuis?: string;
  Diagnostic_FormationSuivies?: string;
  Diagnostic_NatureContrat?: string;
  Diagnostic_NatureContratAutre?: string;
  Diagnostic_EmploiOccupe?: string;
  Diagnostic_EquipementInfo?: boolean;
  Diagnostic_EquipementInfoPrecisions?: string;
  Diagnostic_TypeEquipement?: string[];
  Diagnostic_TypeConnectivite?: string;
  Diagnostic_MaitriseInfo?: string;
  Diagnostic_MaitriseInfoExpertPrecisions?: string;
  Diagnostic_ActionsRealisees?: boolean;
  Diagnostic_ActionsRealiseesPrecisions?: string;
  Diagnostic_AiseNavigation?: boolean;
  Diagnostic_AiseNavigationPrecisions?: string;
  Diagnostic_ExperienceDepannage?: boolean;
  Diagnostic_ExperienceDepannagePrecisions?: string;
  Diagnostic_CompetencesARenforcer?: string[];
  Diagnostic_CompetencesARenforcerAutre?: string;
  Diagnostic_ObjSortie1_Coche?: boolean;
  Diagnostic_ObjSortie1_Reponse?: string;
  Diagnostic_ObjSortie2_Coche?: boolean;
  Diagnostic_ObjSortie2_Reponse?: string;
  Diagnostic_ObjSortie3_Coche?: boolean;
  Diagnostic_ObjSortie3_Reponse?: string;
  Diagnostic_ProjetProfessionnelAujourdhui?: string;
  Diagnostic_ProblemesSpecifiques?: string;
  Diagnostic_ContraintesParticulieres?: string;
  Diagnostic_DateAttestation?: string;
}

interface EntreeJournal {
  date: string;
  module: string;
  commentaire: string;
}

interface EntreeAppreciation {
  nom: string;
  appreciation: string;
}

const CODES_LABELS: Record<string, { label: string; bg: string }> = {
  G: { label: "Game Design", bg: "#7C1FD1" },
  D: { label: "Développement", bg: "#F5820D" },
  GR: { label: "Graphisme", bg: "#22D3EE" },
  SK: { label: "Soft Skills", bg: "#CA9A00" },
  M: { label: "Maintenance", bg: "#3B82F6" },
  A: { label: "Absence justifiée", bg: "#EF4444" },
  ANJ: { label: "Absence non justifiée", bg: "#111827" },
  F: { label: "Férié / Off", bg: "#6B7280" },
  AB: { label: "Abandon", bg: "#22C55E" },
};
const CODES_PRESENCE = ["G", "D", "GR", "SK", "M"];
const HEURES_PAR_JOUR = 3;

const sexeDeCivilite = (civilite?: string) => (civilite === "Mme" ? "Femme" : civilite === "M." ? "Homme" : "—");

function formaterDateFr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Dates d'entrée/fin de formation — calculées depuis le libellé de la
// session ("Du lundi 19 janvier 2026 au vendredi 13 février 2026 (91)"),
// jamais ressaisies à la main.
function extraireDatesSession(session?: string): { debut: string; fin: string } {
  if (!session) return { debut: "—", fin: "—" };
  const regex = new RegExp(`(\\d{1,2})\\s+(${MOIS_FR.join("|")})\\s+(\\d{4})`, "gi");
  const trouvees: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(session.toLowerCase())) !== null) {
    const jour = m[1].padStart(2, "0");
    const mois = String(MOIS_FR.indexOf(m[2].toLowerCase()) + 1).padStart(2, "0");
    trouvees.push(`${jour}/${mois}/${m[3]}`);
  }
  return { debut: trouvees[0] || "—", fin: trouvees[trouvees.length - 1] || "—" };
}

const inputEditClass = "w-full bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] focus:bg-white rounded-lg px-2.5 py-2 text-xs text-[#404040] outline-none font-medium transition-colors";
const textareaEditClass = `${inputEditClass} resize-y`;

function Section({ icon: Icon, titre, children }: { icon: React.ComponentType<{ className?: string }>; titre: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <Icon className="w-4 h-4 text-[#EA601F]" />
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#005259]">{titre}</h2>
      </div>
      {children}
    </div>
  );
}

function Champ({ label, valeur }: { label: string; valeur?: string | number }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50">{label}</div>
      <div className="text-sm font-medium text-[#404040] break-words">{valeur || valeur === 0 ? valeur : "—"}</div>
    </div>
  );
}

// Champ texte libre édité en place (onBlur seulement, pas à chaque frappe —
// même convention que le journal des absences déjà existant sur cette
// fiche/le reste de l'appli).
function ChampEditable({ label, valeur, onValide, rows = 2 }: { label: string; valeur?: string; onValide: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">{label}</label>
      <textarea defaultValue={valeur || ""} onBlur={(e) => onValide(e.target.value)} rows={rows} className={textareaEditClass} />
    </div>
  );
}

// Champ texte libre (une ligne ou multiligne) avec suggestions issues d'une
// liste PARTAGÉE entre toutes les fiches (voir configuration_bilan_formation
// dans le composant principal) : au fur et à mesure que l'équipe saisit de
// nouvelles valeurs, elles s'ajoutent à la liste pour tout le monde — sans
// jamais empêcher de taper une valeur qui n'y figure pas encore.
function ChampAutocomplete({ label, valeur, suggestions, onValide, onAjouterSuggestion, multiline = false, rows = 2 }: {
  label: string;
  valeur?: string;
  suggestions: string[];
  onValide: (v: string) => void;
  onAjouterSuggestion: (v: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  const [saisie, setSaisie] = useState(valeur || "");
  const [ouvert, setOuvert] = useState(false);
  // true quand la liste a été ouverte via la flèche (toutes les valeurs déjà
  // saisies) plutôt qu'en tapant (liste filtrée au fil de la frappe).
  const [viaFleche, setViaFleche] = useState(false);

  useEffect(() => setSaisie(valeur || ""), [valeur]);

  const filtrees = suggestions.filter((s) => s.toLowerCase().includes(saisie.toLowerCase()) && s !== saisie).slice(0, 8);
  const toutes = suggestions.filter((s) => s !== saisie).slice(0, 12);
  const listeAffichee = viaFleche ? toutes : filtrees;

  const choisir = (v: string) => {
    setSaisie(v);
    setOuvert(false);
    onValide(v);
    if (v.trim()) onAjouterSuggestion(v.trim());
  };

  return (
    <div className="relative">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">{label}</label>
      <div className="relative">
        {multiline ? (
          <textarea
            value={saisie}
            onChange={(e) => { setSaisie(e.target.value); setViaFleche(false); }}
            onFocus={() => { setOuvert(true); setViaFleche(false); }}
            onBlur={() => choisir(saisie)}
            rows={rows}
            className={`${textareaEditClass} pr-7`}
          />
        ) : (
          <input
            type="text"
            value={saisie}
            onChange={(e) => { setSaisie(e.target.value); setViaFleche(false); }}
            onFocus={() => { setOuvert(true); setViaFleche(false); }}
            onBlur={() => choisir(saisie)}
            className={`${inputEditClass} pr-7`}
          />
        )}
        {suggestions.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setOuvert((o) => !(o && viaFleche)); setViaFleche(true); }}
            title="Voir les valeurs déjà saisies"
            className="absolute right-1.5 top-1.5 p-0.5 text-[#404040]/40 hover:text-[#005259] cursor-pointer"
          >
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${ouvert && viaFleche ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {ouvert && listeAffichee.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-[#404040]/15 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {listeAffichee.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choisir(s)}
              className="block w-full text-left px-2.5 py-1.5 text-xs text-[#404040] hover:bg-[#F3F3F2] transition-colors cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Tableau à lignes ajoutables {nom, appréciation} — partagé par les deux
// tableaux du compte rendu d'entretien (interventions extérieures et
// retours formateur·rices), qui n'ont que l'intitulé de colonne qui diffère.
function TableauAppreciations({
  titre, colonneNom, lignes, brouillon, onChangeBrouillon, onAjouter, onSupprimer, suggestions, datalistId,
}: {
  titre: string;
  colonneNom: string;
  lignes: { nom: string; appreciation: string }[];
  brouillon: { nom: string; appreciation: string };
  onChangeBrouillon: (v: { nom: string; appreciation: string }) => void;
  onAjouter: () => void;
  onSupprimer: (index: number) => void;
  suggestions: string[];
  datalistId: string;
}) {
  return (
    <div className="pt-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-2">{titre}</div>
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-2 items-end mb-3">
        <div>
          <label className="block text-[9px] font-bold uppercase text-[#404040]/50 mb-1">{colonneNom}</label>
          <input type="text" list={datalistId} value={brouillon.nom} onChange={(e) => onChangeBrouillon({ ...brouillon, nom: e.target.value })} className={inputEditClass} />
          <datalist id={datalistId}>
            {suggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div>
          <label className="block text-[9px] font-bold uppercase text-[#404040]/50 mb-1">Appréciation</label>
          <input type="text" value={brouillon.appreciation} onChange={(e) => onChangeBrouillon({ ...brouillon, appreciation: e.target.value })} className={inputEditClass} />
        </div>
        <button type="button" onClick={onAjouter} className="p-2.5 bg-[#005259] hover:bg-[#EA601F] text-white rounded-lg transition-colors cursor-pointer shrink-0">
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2">
        {lignes.map((ligne, index) => (
          <div key={index} className="flex items-start gap-3 bg-[#F3F3F2] rounded-lg p-2.5">
            <span className="text-xs font-bold text-[#005259] shrink-0 w-40">{ligne.nom}</span>
            <span className="text-xs text-[#404040] flex-1 whitespace-pre-wrap">{ligne.appreciation}</span>
            <button type="button" onClick={() => onSupprimer(index)} className="text-[#404040]/40 hover:text-[#EF736A] shrink-0">
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        {lignes.length === 0 && <p className="text-xs text-[#404040]/50 font-medium">Aucune entrée pour le moment.</p>}
      </div>
    </div>
  );
}

// Liste de noms ajoutés un par un (personnes présentes à l'entretien) —
// suggestions mêlant le staff Colombbus (toujours proposé) et les personnes
// extérieures déjà saisies par le passé (conservées dans
// configuration_bilan_formation/suggestions, voir ajouterSuggestion).
function ListeNoms({ noms, brouillon, onChangeBrouillon, onAjouter, onSupprimer, suggestions }: {
  noms: string[];
  brouillon: string;
  onChangeBrouillon: (v: string) => void;
  onAjouter: () => void;
  onSupprimer: (index: number) => void;
  suggestions: string[];
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Personnes présentes</label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          list="datalist-personnes"
          value={brouillon}
          onChange={(e) => onChangeBrouillon(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAjouter(); } }}
          placeholder="Nom, puis Entrée ou +"
          className={inputEditClass}
        />
        <datalist id="datalist-personnes">
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
        <button type="button" onClick={onAjouter} className="p-2.5 bg-[#005259] hover:bg-[#EA601F] text-white rounded-lg transition-colors cursor-pointer shrink-0">
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {noms.map((nom, index) => (
          <span key={index} className="inline-flex items-center gap-1.5 bg-[#F3F3F2] border border-[#404040]/10 rounded-lg px-2.5 py-1 text-xs font-bold text-[#404040]">
            {nom}
            <button type="button" onClick={() => onSupprimer(index)} className="text-[#404040]/40 hover:text-[#EF736A] cursor-pointer">
              <XMarkIcon className="w-3 h-3" />
            </button>
          </span>
        ))}
        {noms.length === 0 && <span className="text-xs text-[#404040]/50 font-medium">Aucune personne ajoutée.</span>}
      </div>
    </div>
  );
}

// Case à signature : image téléversée (encodée en base64) affichée en
// grand, ou zone cliquable pour en ajouter une tant qu'aucune n'est
// enregistrée.
function BoiteSignature({ label, url, uploading, onUpload, onSupprimer }: {
  label: string;
  url?: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onSupprimer: () => void;
}) {
  const inputId = `signature-${label.replace(/\s+/g, "-")}`;
  return (
    <div>
      <div className="text-center text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-2">{label}</div>
      <div className="relative h-40 rounded-xl border-2 border-dashed border-[#404040]/20 bg-[#F3F3F2] flex items-center justify-center overflow-hidden">
        {url ? (
          <>
            <img src={url} alt={label} className="max-h-full max-w-full object-contain p-2" />
            <button type="button" onClick={onSupprimer} title="Retirer cette signature" className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 border border-[#404040]/10 text-[#404040]/50 hover:text-[#EF736A] rounded-lg shadow-sm cursor-pointer">
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <label htmlFor={inputId} className="flex flex-col items-center gap-1.5 text-[#404040]/40 hover:text-[#005259] transition-colors cursor-pointer">
            <PhotoIcon className="w-7 h-7" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{uploading ? "Envoi..." : "Ajouter une image"}</span>
          </label>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function Puce({ actif, label }: { actif?: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${actif ? "bg-[#005259]/10 text-[#005259]" : "bg-[#404040]/5 text-[#404040]/40"}`}>
      {actif ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XCircleIcon className="w-3.5 h-3.5" />}
      <span>{label}</span>
    </div>
  );
}

function SousGroupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1.5">{titre}</div>
      {children}
    </div>
  );
}

// Fiche consolidée d'un·e apprenant·e NUMERIK PRO : regroupe en un seul
// écran ce qui est aujourd'hui réparti entre Réponses, Suivi de recrutement,
// Apprenant·e·s, Évolution et Absences, en lisant un unique document
// Firestore.
export default function FicheApprenantNumerikUpProPage() {
  const params = useParams();
  const sessionId = decodeURIComponent((params?.id as string) || "");
  const apprenantId = (params?.apprenantId as string) || "";

  const [inscription, setInscription] = useState<Inscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);
  const [ongletActif, setOngletActif] = useState<"fiche" | "diagnostic">("fiche");
  const { mediateurs } = useMediateurs();

  useEffect(() => {
    const charger = async () => {
      try {
        const snap = await getDoc(doc(db, "inscriptions_numerikuppro", apprenantId));
        if (snap.exists()) {
          setInscription({ id: snap.id, ...snap.data() } as Inscription);
        } else {
          setIntrouvable(true);
        }
      } catch (error) {
        console.error("Erreur lors du chargement de la fiche apprenant·e :", error);
        setIntrouvable(true);
      } finally {
        setLoading(false);
      }
    };
    if (apprenantId) charger();
  }, [apprenantId]);

  // Suggestions PARTAGÉES entre toutes les fiches des 3 programmes (module,
  // intervenant, formateur·rice, évaluation, personne extérieure) — un seul
  // document Firestore, mis à jour à chaque nouvelle valeur saisie, relu ici
  // à l'ouverture de la fiche pour bénéficier immédiatement des ajouts faits
  // depuis d'autres fiches (déjà créées ou futures).
  const MODULES_PAR_DEFAUT = ["Pix", "Développement", "Cybersécurité", "Maintenance", "Autre"];
  const [suggestions, setSuggestions] = useState<{ modules: string[]; intervenants: string[]; formateurs: string[]; evaluations: string[]; personnesExternes: string[] }>({
    modules: MODULES_PAR_DEFAUT, intervenants: [], formateurs: [], evaluations: [], personnesExternes: [],
  });
  useEffect(() => {
    const chargerSuggestions = async () => {
      try {
        const snap = await getDoc(doc(db, "configuration_bilan_formation", "suggestions"));
        if (snap.exists()) {
          const data = snap.data();
          setSuggestions({
            modules: data.modules?.length ? data.modules : MODULES_PAR_DEFAUT,
            intervenants: data.intervenants || [],
            formateurs: data.formateurs || [],
            evaluations: data.evaluations || [],
            personnesExternes: data.personnesExternes || [],
          });
        } else {
          setDoc(doc(db, "configuration_bilan_formation", "suggestions"), { modules: MODULES_PAR_DEFAUT }).catch(() => {});
        }
      } catch (error) {
        console.error("Erreur lors du chargement des suggestions :", error);
      }
    };
    chargerSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ajouterSuggestion = (champ: "modules" | "intervenants" | "formateurs" | "evaluations" | "personnesExternes", valeur: string) => {
    const v = valeur.trim();
    if (!v) return;
    setSuggestions((prev) => (prev[champ].includes(v) ? prev : { ...prev, [champ]: [...prev[champ], v] }));
    setDoc(doc(db, "configuration_bilan_formation", "suggestions"), { [champ]: arrayUnion(v) }, { merge: true }).catch((error) => {
      console.error(`Erreur lors de l'enregistrement de la suggestion (${champ}) :`, error);
    });
  };

  // Noms du staff Colombbus, toujours proposés en priorité pour "Personnes
  // présentes" — combinés aux personnes extérieures déjà saisies (suggestions.personnesExternes).
  const nomsStaff = useMemo(
    () => mediateurs.map((m: any) => `${m.prenom || ""} ${m.nom || ""}`.trim()).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b, "fr")),
    [mediateurs]
  );
  const suggestionsPersonnes = useMemo(
    () => [...nomsStaff, ...suggestions.personnesExternes.filter((n) => !nomsStaff.includes(n))],
    [nomsStaff, suggestions.personnesExternes]
  );
  const [brouillonPersonne, setBrouillonPersonne] = useState("");
  const ajouterPersonnePresente = () => {
    const nom = brouillonPersonne.trim();
    if (!nom) return;
    const liste = [...(inscription?.Entretien_PersonnesPresentes || []), nom];
    mettreAJourChamp("Entretien_PersonnesPresentes", liste);
    if (!nomsStaff.includes(nom)) ajouterSuggestion("personnesExternes", nom);
    setBrouillonPersonne("");
  };
  const supprimerPersonnePresente = (index: number) => {
    const liste = (inscription?.Entretien_PersonnesPresentes || []).filter((_, i) => i !== index);
    mettreAJourChamp("Entretien_PersonnesPresentes", liste);
  };

  // Écriture directe sur le document Firestore de l'apprenant·e — mêmes
  // mécanismes que les autres pages de suivi (mise à jour optimiste locale
  // + persistance en base).
  const mettreAJourChamp = async (champ: keyof Inscription, valeur: any) => {
    setInscription((prev) => (prev ? { ...prev, [champ]: valeur } : prev));
    try {
      await updateDoc(doc(db, "inscriptions_numerikuppro", apprenantId), { [champ]: valeur });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de ${champ} :`, error);
    }
  };

  // Signatures : image encodée en base64, gardée uniquement en état local le
  // temps de la session (jamais écrite en base, volontairement — voir la
  // mention affichée sous les cases) pour ne pas conserver ces images
  // sensibles dans Firestore. Elles ne servent qu'à l'impression/export PDF
  // de la fiche pendant qu'elle est ouverte.
  const [televersementSignature, setTeleversementSignature] = useState<"apprenant" | "colombbus" | null>(null);
  const televerserSignature = (type: "apprenant" | "colombbus", file: File) => {
    if (file.size > 500 * 1024) {
      console.error("Image de signature trop lourde (max 500 Ko).");
      return;
    }
    setTeleversementSignature(type);
    const reader = new FileReader();
    reader.onload = () => {
      const champ = type === "apprenant" ? "Entretien_SignatureApprenantUrl" : "Entretien_SignatureColombbusUrl";
      setInscription((prev) => (prev ? { ...prev, [champ]: reader.result as string } : prev));
      setTeleversementSignature(null);
    };
    reader.onerror = () => setTeleversementSignature(null);
    reader.readAsDataURL(file);
  };
  const supprimerSignature = (type: "apprenant" | "colombbus") => {
    const champ = type === "apprenant" ? "Entretien_SignatureApprenantUrl" : "Entretien_SignatureColombbusUrl";
    setInscription((prev) => (prev ? { ...prev, [champ]: "" } : prev));
  };

  const [nouvelleEntreeJournal, setNouvelleEntreeJournal] = useState({ date: "", module: "Pix", commentaire: "" });
  const ajouterEntreeJournal = () => {
    if (!nouvelleEntreeJournal.date || !nouvelleEntreeJournal.commentaire.trim()) return;
    const liste = [...(inscription?.Bilan_Journal || []), { ...nouvelleEntreeJournal }].sort((a, b) => a.date.localeCompare(b.date));
    mettreAJourChamp("Bilan_Journal", liste);
    ajouterSuggestion("modules", nouvelleEntreeJournal.module);
    setNouvelleEntreeJournal({ date: "", module: nouvelleEntreeJournal.module, commentaire: "" });
  };
  const supprimerEntreeJournal = (index: number) => {
    const liste = (inscription?.Bilan_Journal || []).filter((_, i) => i !== index);
    mettreAJourChamp("Bilan_Journal", liste);
  };

  // Les deux tableaux du compte rendu d'entretien (interventions extérieures
  // / retours formateur·rices) partagent la même forme {nom, appréciation} —
  // un seul jeu de handlers paramétré par le nom du champ Firestore visé.
  const [nouvelleAppreciation, setNouvelleAppreciation] = useState<Record<string, { nom: string; appreciation: string }>>({
    Entretien_InterventionsExterieures: { nom: "", appreciation: "" },
    Entretien_TableFormateurs: { nom: "", appreciation: "" },
  });
  const ajouterAppreciation = (champ: "Entretien_InterventionsExterieures" | "Entretien_TableFormateurs") => {
    const brouillon = nouvelleAppreciation[champ];
    if (!brouillon.nom.trim()) return;
    const liste = [...(inscription?.[champ] || []), { ...brouillon }];
    mettreAJourChamp(champ, liste);
    ajouterSuggestion(champ === "Entretien_InterventionsExterieures" ? "intervenants" : "formateurs", brouillon.nom);
    setNouvelleAppreciation((prev) => ({ ...prev, [champ]: { nom: "", appreciation: "" } }));
  };
  const supprimerAppreciation = (champ: "Entretien_InterventionsExterieures" | "Entretien_TableFormateurs", index: number) => {
    const liste = (inscription?.[champ] || []).filter((_, i) => i !== index);
    mettreAJourChamp(champ, liste);
  };

  // Résumé de présence calculé directement à partir des cases déjà
  // renseignées sur la grille Évolution — inutile de reconstituer tout le
  // calendrier de la session, seules les cases remplies comptent.
  const resumeEvolution = useMemo(() => {
    const compteurs: Record<string, number> = {};
    let heuresPresence = 0;
    let heuresPrevues = 0;
    Object.entries(inscription?.Evolution || {}).forEach(([iso, valeur]) => {
      if (!valeur) return;
      compteurs[valeur] = (compteurs[valeur] || 0) + 1;
      if (valeur === "F") return;
      heuresPrevues += HEURES_PAR_JOUR;
      if (CODES_PRESENCE.includes(valeur)) {
        const retard = Math.max(0, Math.min(HEURES_PAR_JOUR, parseFloat((inscription?.Evolution_Retards?.[iso] || "0").replace(",", ".")) || 0));
        heuresPresence += HEURES_PAR_JOUR - retard;
      }
    });
    const taux = heuresPrevues > 0 ? Math.round((heuresPresence / heuresPrevues) * 100) : null;
    return { compteurs, heuresPresence, heuresPrevues, taux };
  }, [inscription]);

  const absencesTriees = useMemo(
    () => [...(inscription?.Absences || [])].sort((a, b) => a.date.localeCompare(b.date)),
    [inscription]
  );

  const referent = `${inscription?.Conseiller_Prenom || ""} ${inscription?.Conseiller_Nom || ""}`.trim();
  const datesFormation = extraireDatesSession(inscription?.Session || sessionId);

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement de la fiche...
      </div>
    );
  }

  if (introuvable || !inscription) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-[#404040] antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#404040]/60">Apprenant·e introuvable.</p>
        <Link
          href={`/mediation/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionId)}/apprenants`}
          className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
        >
          <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
          <span>Retour</span>
        </Link>
      </div>
    );
  }

  const i = inscription;

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none print:hidden"></div>

      <div className="max-w-[80rem] mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#005259] text-white flex items-center justify-center text-lg font-black uppercase shadow-[0_0_15px_rgba(0,82,89,0.3)] shrink-0">
              {(i.Prénom?.[0] || "") + (i.Nom?.[0] || "")}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#005259] tracking-tight">
                {i.Prénom || "—"} <span className="uppercase">{i.Nom || "—"}</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                {i.Civilité || "—"}{i.Age && ` — ${i.Age} ans`}{i.Territoire && ` — Territoire ${i.Territoire}`} — Session : {sessionId || "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <span className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm ${i.OK_NOK === "OK" ? "bg-[#005259]/10 text-[#005259]" : i.OK_NOK === "NOK" ? "bg-[#EF736A]/10 text-[#EF736A]" : "bg-[#404040]/5 text-[#404040]/50"}`}>
              {i.OK_NOK || "En cours"}
            </span>
            {i.Evolution_Actif && (
              <span className="px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm bg-[#EA601F]/10 text-[#EA601F]">Actif</span>
            )}

            <div className="flex items-center gap-1 bg-white border border-[#404040]/10 rounded-xl p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setOngletActif("fiche")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  ongletActif === "fiche" ? "bg-[#005259] text-white" : "text-[#404040]/60 hover:text-[#005259]"
                }`}
              >
                Fiche
              </button>
              <button
                type="button"
                onClick={() => setOngletActif("diagnostic")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  ongletActif === "diagnostic" ? "bg-[#005259] text-white" : "text-[#404040]/60 hover:text-[#005259]"
                }`}
              >
                Entretien diagnostic
              </button>
            </div>

            <Link
              href={`/mediation/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionId)}/apprenants`}
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
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

        {ongletActif === "diagnostic" ? (
          <FicheEntretienDiagnostic inscription={i} mettreAJourChamp={mettreAJourChamp} />
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <Section icon={UserCircleIcon} titre="Identité & contact">
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Téléphone" valeur={formatPhoneNumber(i.Téléphone)} />
              <Champ label="Email" valeur={i.Email} />
              <Champ label="Ville" valeur={i.Ville} />
              <Champ label="Code postal" valeur={i.Code_Postal} />
              <Champ label="Sexe" valeur={sexeDeCivilite(i.Civilité)} />
              <Champ label="Niveau de diplôme" valeur={i.Niveau_Etudes} />
              <Champ label="Parcours" valeur={i.Parcours} />
              <Champ label="Ordinateur utilisé" valeur={i.Ordinateur_Utilise} />
            </div>
          </Section>

          <Section icon={IdentificationIcon} titre="Situation">
            <div className="flex flex-wrap gap-2">
              <Puce actif={i.QPV === "Oui"} label="QPV" />
              <Puce actif={i.NEET === "Oui"} label="NEET" />
              <Puce actif={i.CEJ === "Oui"} label="CEJ" />
              <Puce actif={i.RSA === "Oui"} label="RSA" />
              <Puce actif={i.RQTH === "Oui"} label="RQTH" />
              <Puce actif={i.Situation_Handicap === "Oui"} label="Situation handicap" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-1">
              <Champ label="Inscrit·e France Travail" valeur={i.France_Travail} />
              <Champ label="Identifiant France Travail" valeur={i.Identifiant_France_Travail} />
              <Champ label="Comment connu ?" valeur={i.Comment_Connu} />
            </div>
          </Section>

          <Section icon={UserGroupIcon} titre="Accompagnement & projet">
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Prescripteur / structure d'accompagnement" valeur={i.Structure_Accompagnement || i.Structure_Autre} />
              <Champ label="Intérêt pour la formation" valeur={i.Projet_Professionnel} />
              <Champ label="Comment a-t-il·elle accédé à la formation ?" valeur={i.Formation_Acces} />
              <Champ label="Référent·e" valeur={referent} />
              <Champ label="Tél. référent·e" valeur={formatPhoneNumber(i.Conseiller_Telephone)} />
              <Champ label="Mail référent·e" valeur={i.Conseiller_Email} />
            </div>
          </Section>

          <Section icon={AcademicCapIcon} titre="Suivi de recrutement">
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Convocation info collective" valeur={i.Convocation_Info_Collective} />
              <Champ label="Date convocation info collective" valeur={i.Date_Convocation_Info_Collective} />
              <Champ label="Présence info collective" valeur={i.Presence_Info_Collective} />
              <Champ label="Convocation test langue" valeur={i.Convocation_Test_Langue} />
              <Champ label="Convocation test Pix/Langue" valeur={i.Date_Test_Pix_Langue} />
              <Champ label="Présence test langue" valeur={i.Presence_Test_Langue} />
              <Champ label="Ont-ils un ordi ?" valeur={i.A_Un_Ordinateur} />
              <Champ label="Attribution PC Colombbus" valeur={i.Attribution_PC_Colombbus} />
              <Champ label="Compétences numériques" valeur={i.Competences_Numeriques} />
              <Champ label="Notes tests FR" valeur={i.Notes_Tests_FR} />
              <Champ label="Niveau B1 Français ?" valeur={i.Niveau_B1_Francais} />
              <Champ label="Récupération CV" valeur={i.Recuperation_CV} />
              <Champ label="Date / heures entretien" valeur={i.Date_Heures_Entretien} />
              <Champ label="Présence entretien" valeur={i.Presence_Entretien} />
              <Champ label="Fiche d'entretien" valeur={i.Fiche_Entretien} />
              <Champ label="Décision" valeur={i.Decision} />
              <Champ label="Avis positif / négatif" valeur={i.Avis_Positif_Negatif} />
              <Champ label="A confirmé" valeur={i.A_Confirme} />
            </div>
            {i.Informations_Entretien && (
              <div className="pt-3 border-t border-[#404040]/10">
                <Champ label="Informations entretien recrutement" valeur={i.Informations_Entretien} />
              </div>
            )}
          </Section>

          <Section icon={CheckBadgeIcon} titre="Suivi pédagogique">
            <div className="space-y-3">
              <SousGroupe titre="Intégration">
                <div className="flex flex-wrap gap-2">
                  <Puce actif={i.Planning_Formation} label="Planning" />
                  <Puce actif={i.Programme_Formation} label="Programme" />
                  <Puce actif={i.Acces_Openclassroom} label="Accès OC" />
                  <Puce actif={i.Convocation_Premier_Jour} label="Convoc. 1er jour" />
                  <Puce actif={i.Charte_Engagement} label="Charte" />
                  <Puce actif={i.Reglement_Interieur} label="Règlement" />
                  <Puce actif={i.Signature_Droit_Image} label="Droit image" />
                  <Puce actif={i.Integration_Kairos} label="Intégration Kairos" />
                  <Puce actif={i.Validation_Kairos} label="Validation Kairos" />
                  <Puce actif={i.Acces_Drive_Apprenant} label="Accès Drive" />
                  <Puce actif={i.Cotisation_Adhesion} label="Cotisation" />
                </div>
              </SousGroupe>
              <SousGroupe titre="Positionnement & matériel">
                <div className="grid grid-cols-3 gap-3 mb-2">
                  <Champ label="Positionnement E." valeur={i.Questionnaire_Positionnement_Entree} />
                  <Champ label="Positionnement S." valeur={i.Questionnaire_Positionnement_Sortie} />
                  <Champ label="Convoc. PIX" valeur={i.Date_Convocation_PIX_Certification} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Puce actif={i.Cle_USB_32G} label="Clé USB" />
                  <Puce actif={i.Trousse_Outils} label="Trousse à outils" />
                </div>
              </SousGroupe>
              <SousGroupe titre="Bilan & certifications">
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <Champ label="Bilan intermédiaire" valeur={i.Date_Bilan_Intermediaire} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Puce actif={i.Satisfaction_Chaud_Mois1} label="Satisfaction M1" />
                  <Puce actif={i.Projet_Developpement_Mois2_CV} label="Projet Dev. M2 (CV)" />
                  <Puce actif={i.Certification_PIX} label="PIX" />
                  <Puce actif={i.Certification_HTML_CSS} label="HTML/CSS" />
                  <Puce actif={i.Certification_MYSQL} label="MySQL" />
                </div>
              </SousGroupe>
              <SousGroupe titre="Modules réseau & cybersécurité">
                <div className="flex flex-wrap gap-2">
                  <Puce actif={i.Module_Analyse_Risques_SI} label="Risques SI" />
                  <Puce actif={i.Module_Reseau_TCPIP} label="Réseau TCP/IP" />
                  <Puce actif={i.Module_Test_Intrusion_Web} label="Test intrusion web" />
                  <Puce actif={i.Formation_Cisco_Cybersecurite} label="Cisco CyberS." />
                  <Puce actif={i.Cisco_Bases_Materiel} label="Cisco matériel" />
                  <Puce actif={i.OC_Monter_PC} label="Monter un PC" />
                  <Puce actif={i.OC_Installer_Windows11} label="Installer W11" />
                  <Puce actif={i.OC_Decouvrir_Metier_Technicien} label="Métier technicien" />
                </div>
              </SousGroupe>
              <SousGroupe titre="Clôture">
                <div className="flex flex-wrap gap-2">
                  <Puce actif={i.Entretien_Fin_Parcours} label="Entretien fin parcours" />
                  <Puce actif={i.Satisfaction_Chaud_FinSession} label="Satisfaction fin session" />
                  <Puce actif={i.Bilan_Individuel_Envoye} label="Bilan envoyé" />
                  <Puce actif={i.Satisfaction_Froid_3Mois} label="Satisfaction 3 mois" />
                  <Puce actif={i.Satisfaction_Froid_6Mois} label="Satisfaction 6 mois" />
                </div>
              </SousGroupe>
            </div>
          </Section>

          <Section icon={ChartBarIcon} titre="Évolution — présence">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#F3F3F2] rounded-xl p-3 text-center">
                <div className="text-xl font-black text-[#005259]">{resumeEvolution.taux !== null ? `${resumeEvolution.taux}%` : "—"}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mt-0.5">Taux de présence</div>
              </div>
              <div className="bg-[#F3F3F2] rounded-xl p-3 text-center">
                <div className="text-xl font-black text-[#005259]">{resumeEvolution.heuresPresence}h</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mt-0.5">Heures présentes</div>
              </div>
              <div className="bg-[#F3F3F2] rounded-xl p-3 text-center">
                <div className="text-xl font-black text-[#005259]">{resumeEvolution.heuresPrevues}h</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mt-0.5">Heures prévues</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.keys(CODES_LABELS).filter((code) => resumeEvolution.compteurs[code]).map((code) => (
                <span key={code} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold" style={{ backgroundColor: `${CODES_LABELS[code].bg}1A`, color: CODES_LABELS[code].bg }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CODES_LABELS[code].bg }}></span>
                  {CODES_LABELS[code].label} × {resumeEvolution.compteurs[code]}
                </span>
              ))}
              {Object.keys(resumeEvolution.compteurs).length === 0 && (
                <span className="text-xs text-[#404040]/50 font-medium">Aucune case renseignée pour le moment.</span>
              )}
            </div>
          </Section>

          <Section icon={ExclamationTriangleIcon} titre="Absences">
            {absencesTriees.length === 0 ? (
              <p className="text-xs text-[#404040]/50 font-medium">Aucune absence enregistrée.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="border-collapse text-xs w-full">
                  <thead>
                    <tr className="text-[#005259] text-[10px] uppercase tracking-widest font-bold border-b border-[#404040]/10">
                      <th className="px-1 py-2 text-left">Date</th>
                      <th className="px-1 py-2 text-center">JA</th>
                      <th className="px-1 py-2 text-left">Type</th>
                      <th className="px-1 py-2 text-left">Raison</th>
                      <th className="px-1 py-2 text-left">Référence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]/5">
                    {absencesTriees.map((rec, index) => (
                      <tr key={index}>
                        <td className="px-1 py-2 whitespace-nowrap">{formaterDateFr(rec.date)}</td>
                        <td className="px-1 py-2 text-center">{rec.justifiee ? "✔" : ""}</td>
                        <td className="px-1 py-2 whitespace-nowrap">{rec.type || "—"}</td>
                        <td className="px-1 py-2 max-w-[160px] truncate" title={rec.raison}>{rec.raison || "—"}</td>
                        <td className="px-1 py-2 max-w-[140px] truncate">
                          {rec.reference ? (rec.lien ? <a href={rec.lien} target="_blank" rel="noopener noreferrer" className="text-[#005259] font-bold underline hover:text-[#EA601F]">{rec.reference}</a> : rec.reference) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <div className="lg:col-span-2">
            <Section icon={ClipboardDocumentCheckIcon} titre="Bilan de formation">
              <div className="grid grid-cols-2 gap-4">
                <Champ label="Date d'entrée en formation" valeur={datesFormation.debut} />
                <Champ label="Date de fin de formation" valeur={datesFormation.fin} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {([1, 2, 3] as const).map((n) => (
                  <div key={n} className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Date</label>
                      <input
                        type="date"
                        defaultValue={(inscription?.[`Bilan_DateEvaluation${n}` as keyof Inscription] as string) || ""}
                        onChange={(e) => mettreAJourChamp(`Bilan_DateEvaluation${n}` as keyof Inscription, e.target.value)}
                        className={inputEditClass}
                      />
                    </div>
                    <ChampAutocomplete
                      label={`Évaluation ${n}`}
                      valeur={inscription?.[`Bilan_Evaluation${n}` as keyof Inscription] as string}
                      suggestions={suggestions.evaluations}
                      onValide={(v) => mettreAJourChamp(`Bilan_Evaluation${n}` as keyof Inscription, v)}
                      onAjouterSuggestion={(v) => ajouterSuggestion("evaluations", v)}
                      multiline
                    />
                  </div>
                ))}
              </div>
              <ChampEditable label="Adaptation en cours de formation" valeur={inscription?.Bilan_Adaptation} onValide={(v) => mettreAJourChamp("Bilan_Adaptation", v)} />
              <ChampEditable label="Commentaire général" valeur={inscription?.Bilan_CommentaireGeneral} onValide={(v) => mettreAJourChamp("Bilan_CommentaireGeneral", v)} rows={3} />
              <ChampEditable label="Compétences transversales" valeur={inscription?.Bilan_CompetencesTransversales} onValide={(v) => mettreAJourChamp("Bilan_CompetencesTransversales", v)} rows={3} />

              <div className="pt-3 border-t border-[#404040]/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-2">Journal des évaluations par module</div>
                <div className="grid grid-cols-1 md:grid-cols-[140px_160px_1fr_auto] gap-2 items-end mb-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-[#404040]/50 mb-1">Date</label>
                    <input type="date" value={nouvelleEntreeJournal.date} onChange={(e) => setNouvelleEntreeJournal({ ...nouvelleEntreeJournal, date: e.target.value })} className={inputEditClass} />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-[#404040]/50 mb-1">Module</label>
                    <input type="text" list="datalist-modules-journal" value={nouvelleEntreeJournal.module} onChange={(e) => setNouvelleEntreeJournal({ ...nouvelleEntreeJournal, module: e.target.value })} className={inputEditClass} />
                    <datalist id="datalist-modules-journal">
                      {suggestions.modules.map((m) => <option key={m} value={m} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-[#404040]/50 mb-1">Commentaire ou score</label>
                    <input type="text" value={nouvelleEntreeJournal.commentaire} onChange={(e) => setNouvelleEntreeJournal({ ...nouvelleEntreeJournal, commentaire: e.target.value })} className={inputEditClass} />
                  </div>
                  <button type="button" onClick={ajouterEntreeJournal} className="p-2.5 bg-[#005259] hover:bg-[#EA601F] text-white rounded-lg transition-colors cursor-pointer shrink-0">
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {(inscription?.Bilan_Journal || []).map((entree, index) => (
                    <div key={index} className="flex items-start gap-3 bg-[#F3F3F2] rounded-lg p-2.5">
                      <span className="text-[10px] font-bold text-[#005259] shrink-0 w-16">{formaterDateFr(entree.date)}</span>
                      <span className="text-[10px] font-bold uppercase text-[#EA601F] shrink-0 w-24">{entree.module}</span>
                      <span className="text-xs text-[#404040] flex-1 whitespace-pre-wrap">{entree.commentaire}</span>
                      <button type="button" onClick={() => supprimerEntreeJournal(index)} className="text-[#404040]/40 hover:text-[#EF736A] shrink-0">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(inscription?.Bilan_Journal || []).length === 0 && (
                    <p className="text-xs text-[#404040]/50 font-medium">Aucune évaluation enregistrée pour le moment.</p>
                  )}
                </div>
              </div>
            </Section>
          </div>

          <div className="lg:col-span-2">
            <Section icon={ChatBubbleLeftRightIcon} titre="Compte rendu d'entretien individuel">
              <div className="grid grid-cols-2 gap-4">
                <Champ label="Apprenant·e concerné·e" valeur={`${inscription?.Prénom || ""} ${inscription?.Nom || ""}`.trim()} />
                <ListeNoms
                  noms={inscription?.Entretien_PersonnesPresentes || []}
                  brouillon={brouillonPersonne}
                  onChangeBrouillon={setBrouillonPersonne}
                  onAjouter={ajouterPersonnePresente}
                  onSupprimer={supprimerPersonnePresente}
                  suggestions={suggestionsPersonnes}
                />
              </div>

              <div className="pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-2">Retours sur la formation</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ChampEditable label="Module Pix" valeur={inscription?.Entretien_RetoursPix} onValide={(v) => mettreAJourChamp("Entretien_RetoursPix", v)} rows={3} />
                  <ChampEditable label="Développement & Cybersécurité" valeur={inscription?.Entretien_RetoursDevCyber} onValide={(v) => mettreAJourChamp("Entretien_RetoursDevCyber", v)} rows={3} />
                  <ChampEditable label="Maintenance informatique" valeur={inscription?.Entretien_RetoursMaintenance} onValide={(v) => mettreAJourChamp("Entretien_RetoursMaintenance", v)} rows={3} />
                </div>
              </div>

              <TableauAppreciations
                titre="Interventions extérieures"
                colonneNom="Intervenant"
                lignes={inscription?.Entretien_InterventionsExterieures || []}
                brouillon={nouvelleAppreciation.Entretien_InterventionsExterieures}
                onChangeBrouillon={(v) => setNouvelleAppreciation((prev) => ({ ...prev, Entretien_InterventionsExterieures: v }))}
                onAjouter={() => ajouterAppreciation("Entretien_InterventionsExterieures")}
                onSupprimer={(index) => supprimerAppreciation("Entretien_InterventionsExterieures", index)}
                suggestions={suggestions.intervenants}
                datalistId="datalist-intervenants"
              />

              <ChampEditable label="Retours formateur·rices (général)" valeur={inscription?.Entretien_RetoursFormateurs} onValide={(v) => mettreAJourChamp("Entretien_RetoursFormateurs", v)} rows={3} />

              <TableauAppreciations
                titre="Retours sur les formateur·rices"
                colonneNom="Formateur·rice"
                lignes={inscription?.Entretien_TableFormateurs || []}
                brouillon={nouvelleAppreciation.Entretien_TableFormateurs}
                onChangeBrouillon={(v) => setNouvelleAppreciation((prev) => ({ ...prev, Entretien_TableFormateurs: v }))}
                onAjouter={() => ajouterAppreciation("Entretien_TableFormateurs")}
                onSupprimer={(index) => supprimerAppreciation("Entretien_TableFormateurs", index)}
                suggestions={suggestions.formateurs}
                datalistId="datalist-formateurs"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChampEditable label="Projet professionnel" valeur={inscription?.Entretien_ProjetProfessionnel} onValide={(v) => mettreAJourChamp("Entretien_ProjetProfessionnel", v)} rows={3} />
                <ChampEditable label="Pistes à explorer" valeur={inscription?.Entretien_PistesAExplorer} onValide={(v) => mettreAJourChamp("Entretien_PistesAExplorer", v)} rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#404040]/10">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Fait à</label>
                  <input type="text" defaultValue={inscription?.Entretien_FaitA || "Paris"} onBlur={(e) => mettreAJourChamp("Entretien_FaitA", e.target.value)} className={inputEditClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Le</label>
                  <input type="date" defaultValue={inscription?.Entretien_FaitLe || new Date().toISOString().slice(0, 10)} onChange={(e) => mettreAJourChamp("Entretien_FaitLe", e.target.value)} className={inputEditClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#404040]/10">
                <BoiteSignature
                  label="Signature apprenant·e"
                  url={inscription?.Entretien_SignatureApprenantUrl}
                  uploading={televersementSignature === "apprenant"}
                  onUpload={(file) => televerserSignature("apprenant", file)}
                  onSupprimer={() => supprimerSignature("apprenant")}
                />
                <BoiteSignature
                  label="Signature Colombbus"
                  url={inscription?.Entretien_SignatureColombbusUrl}
                  uploading={televersementSignature === "colombbus"}
                  onUpload={(file) => televerserSignature("colombbus", file)}
                  onSupprimer={() => supprimerSignature("colombbus")}
                />
              </div>
              <div className="print:hidden flex items-center gap-2.5 bg-[#F9C44E]/20 border border-[#F9C44E] rounded-xl p-3">
                <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-[#404040]" />
                <p className="text-xs font-bold text-[#404040]">
                  Ces signatures ne sont pas enregistrées : elles ne servent qu'à l'impression/l'export de cette fiche et seront perdues si vous quittez la page.
                </p>
              </div>
            </Section>
          </div>

        </div>
        )}

      </div>
    </main>
    </PageGuard>
  );
}

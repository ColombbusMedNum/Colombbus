"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
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
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { formatPhoneNumber } from "@/lib/formatPhone";

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
interface Inscription {
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
}

const CODES_LABELS: Record<string, { label: string; bg: string }> = {
  G: { label: "Game Design", bg: "#7C1FD1" },
  D: { label: "Développement", bg: "#F5820D" },
  GR: { label: "Graphisme", bg: "#22D3EE" },
  SK: { label: "Soft Skills", bg: "#CA9A00" },
  A: { label: "Absence justifiée", bg: "#EF4444" },
  ANJ: { label: "Absence non justifiée", bg: "#111827" },
  F: { label: "Férié / Off", bg: "#6B7280" },
  AB: { label: "Abandon", bg: "#22C55E" },
};
const CODES_PRESENCE = ["G", "D", "GR", "SK"];
const HEURES_PAR_JOUR = 3;

const sexeDeCivilite = (civilite?: string) => (civilite === "Mme" ? "Femme" : civilite === "M." ? "Homme" : "—");

function formaterDateFr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

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
          href={`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionId)}/apprenants`}
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

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-[80rem] mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
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
            <Link
              href={`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionId)}/apprenants`}
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

        </div>

      </div>
    </main>
    </PageGuard>
  );
}

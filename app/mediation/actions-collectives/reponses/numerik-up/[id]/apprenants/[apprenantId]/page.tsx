"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { formatPhoneNumber, formatPhoneForStorage } from "@/lib/formatPhone";
import { formatNom, formatPrenom } from "@/lib/formatName";

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
  Adresse_Postale?: string;
  Code_Postal?: string;
  Niveau_Etudes?: string;
  Ville?: string;
  Territoire?: string;
  QPV?: string;
  NEET?: string;
  CEJ?: string;
  RSA?: string;
  RQTH?: string;
  Situation_Plus_26?: string;
  Comment_Connu?: string;
  Structures_Accompagnement?: string[];
  Structure_Autre?: string;
  ASE?: string;
  Conseiller_Prenom?: string;
  Conseiller_Nom?: string;
  Conseiller_Telephone?: string;
  Conseiller_Email?: string;
  Parcours?: string;
  Session?: string;
  // Suivi de recrutement
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
  // Suivi pédagogique (Apprenant·e·s)
  E2C_CS?: boolean;
  E2C_FR?: boolean;
  E2C_CV?: boolean;
  E2C_CE?: boolean;
  DI_Accord?: string;
  Production_GR_Nombre?: string;
  Production_GD_Nombre?: string;
  Production_VSC_Nombre?: string;
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
  M: { label: "Maintenance", bg: "#3B82F6" },
  A: { label: "Absence justifiée", bg: "#EF4444" },
  ANJ: { label: "Absence non justifiée", bg: "#111827" },
  F: { label: "Férié / Off", bg: "#6B7280" },
  AB: { label: "Abandon", bg: "#22C55E" },
};
const CODES_PRESENCE = ["G", "D", "GR", "SK", "M"];
const HEURES_PAR_JOUR = 3;

const NIVEAUX_ETUDES = ["Brevet, CAP, BEP", "Bac", "Bac+2 (L2, BTS, DUT, DEUST)", "Bac+3 (Licence, licence professionnelle)", "Bac+4/5 et plus"];
const STRUCTURES_ACCOMPAGNEMENT = ["Mission locale", "E2C (Ecole de la deuxième chance)", "Pôle Emploi", "PLIE", "Epide", "PJJ", "Aucune"];
const inputEditClass = "w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] focus:bg-white rounded-lg text-xs text-[#404040] outline-none font-medium transition-colors";

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

// Fiche consolidée d'un·e apprenant·e : regroupe en un seul écran ce qui est
// aujourd'hui réparti entre Réponses, Suivi de recrutement, Apprenant·e·s,
// Évolution et Absences, en lisant un unique document Firestore.
export default function FicheApprenantNumerikUpPage() {
  const params = useParams();
  const sessionId = decodeURIComponent((params?.id as string) || "");
  const apprenantId = (params?.apprenantId as string) || "";

  const [inscription, setInscription] = useState<Inscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);
  // Édition inline de la fiche — un brouillon local, écrit d'un bloc sur le
  // même document que les autres pages (Réponses, Apprenant·e·s...), rien
  // n'est perdu tant que "Enregistrer" n'est pas cliqué.
  const [edition, setEdition] = useState<Inscription | null>(null);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

  const ouvrirEdition = () => { if (inscription) setEdition({ ...inscription }); };
  const fermerEdition = () => setEdition(null);
  const majEdition = <K extends keyof Inscription>(champ: K, valeur: Inscription[K]) => {
    setEdition((prev) => (prev ? { ...prev, [champ]: valeur } : prev));
  };
  const basculerStructureEdition = (structure: string) => {
    setEdition((prev) => {
      if (!prev) return prev;
      const actuelles = prev.Structures_Accompagnement || [];
      const suivantes = actuelles.includes(structure) ? actuelles.filter((s) => s !== structure) : [...actuelles, structure];
      return { ...prev, Structures_Accompagnement: suivantes };
    });
  };
  const enregistrerEdition = async () => {
    if (!edition) return;
    setEnregistrementEnCours(true);
    const { id, ...donnees } = {
      ...edition,
      Nom: formatNom(edition.Nom),
      Prénom: formatPrenom(edition.Prénom),
      Téléphone: formatPhoneForStorage(edition.Téléphone),
    };
    try {
      await updateDoc(doc(db, "inscriptions_numerikup", id), donnees);
      setInscription((prev) => (prev ? { ...prev, ...donnees } : prev));
      setEdition(null);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la fiche :", error);
    } finally {
      setEnregistrementEnCours(false);
    }
  };

  useEffect(() => {
    const charger = async () => {
      try {
        const snap = await getDoc(doc(db, "inscriptions_numerikup", apprenantId));
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

  const structures = useMemo(() => {
    const liste = [...(inscription?.Structures_Accompagnement || [])];
    if (inscription?.Structure_Autre) liste.push(inscription.Structure_Autre);
    return liste.join(", ");
  }, [inscription]);

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
          href={`/mediation/actions-collectives/reponses/numerik-up/${encodeURIComponent(sessionId)}/apprenants`}
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
            <button
              type="button"
              onClick={ouvrirEdition}
              className="flex items-center gap-2 bg-[#EA601F] hover:bg-[#d9540f] text-white border border-[#EA601F] px-3.5 py-2 rounded-xl transition-all text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer"
            >
              <PencilSquareIcon className="w-4 h-4" />
              <span>Modifier</span>
            </button>
            <Link
              href={`/mediation/actions-collectives/reponses/numerik-up/${encodeURIComponent(sessionId)}/apprenants`}
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
              <Champ label="Adresse" valeur={i.Adresse_Postale} />
              <Champ label="Sexe" valeur={sexeDeCivilite(i.Civilité)} />
              <Champ label="Niveau d'études" valeur={i.Niveau_Etudes} />
              <Champ label="Parcours" valeur={i.Parcours} />
            </div>
          </Section>

          <Section icon={IdentificationIcon} titre="Situation">
            <div className="flex flex-wrap gap-2">
              <Puce actif={i.QPV === "Oui"} label="QPV" />
              <Puce actif={i.NEET === "Oui"} label="NEET" />
              <Puce actif={i.CEJ === "Oui"} label="CEJ" />
              <Puce actif={i.RSA === "Oui"} label="RSA" />
              <Puce actif={i.RQTH === "Oui"} label="RQTH" />
              <Puce actif={i.ASE === "Oui"} label="ASE" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-1">
              <Champ label="Situation +26 ans" valeur={i.Situation_Plus_26} />
              <Champ label="Comment connu ?" valeur={i.Comment_Connu} />
            </div>
          </Section>

          <Section icon={UserGroupIcon} titre="Accompagnement">
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Structure(s) d'accompagnement" valeur={structures} />
              <Champ label="Référent·e" valeur={referent} />
              <Champ label="Tél. référent·e" valeur={formatPhoneNumber(i.Conseiller_Telephone)} />
              <Champ label="Mail référent·e" valeur={i.Conseiller_Email} />
            </div>
          </Section>

          <Section icon={AcademicCapIcon} titre="Suivi de recrutement">
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Critères pré-inscription respectés ?" valeur={i.Critere_Preinscription_Respecte} />
              <Champ label="Abandon avant parkour" valeur={i.Abandon_Avant_Parkour} />
              <Champ label="Date mail préinscription" valeur={i.Date_Mail_Preinscription} />
              <Champ label="Date mail parkour" valeur={i.Date_Mail_Parkour} />
              <Champ label="Appel avant parkour" valeur={i.Appel_Avant_Parkour} />
              <Champ label="CV reçu" valeur={i.CV_Recu} />
              <Champ label="Compétences Pix (badges / étoiles)" valeur={i.Pix_Badges_Etoiles} />
              <Champ label="Complétion PIX" valeur={i.Completion_Pix} />
              <Champ label="1re relance PIX" valeur={i.Date_Relance_Pix_1} />
              <Champ label="2e relance PIX" valeur={i.Date_Relance_Pix_2} />
              <Champ label="3e relance PIX" valeur={i.Date_Relance_Pix_3} />
            </div>
            {i.Commentaire_Suivi_Recrutement && (
              <div className="pt-3 border-t border-[#404040]/10">
                <Champ label="Commentaires de suivi de recrutement" valeur={i.Commentaire_Suivi_Recrutement} />
              </div>
            )}
          </Section>

          <Section icon={CheckBadgeIcon} titre="Suivi pédagogique">
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1.5">École de la 2e chance (E2C)</div>
                <div className="flex flex-wrap gap-2">
                  <Puce actif={i.E2C_CS} label="CS" />
                  <Puce actif={i.E2C_FR} label="FR" />
                  <Puce actif={i.E2C_CV} label="CV" />
                  <Puce actif={i.E2C_CE} label="CE" />
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1.5">Droit à l'image (DI)</div>
                <div className="flex flex-wrap gap-2">
                  <Champ label="Accord" valeur={i.DI_Accord} />
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1.5">Productions rendues</div>
                <div className="grid grid-cols-3 gap-3">
                  <Champ label="GR" valeur={i.Production_GR_Nombre} />
                  <Champ label="GD" valeur={i.Production_GD_Nombre} />
                  <Champ label="VSC" valeur={i.Production_VSC_Nombre} />
                </div>
              </div>
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

      {/* MODALE D'ÉDITION — mêmes champs que la modale "Modifier cette fiche"
          de la liste Réponses, pour rester cohérent, mais accessible
          directement depuis la fiche consolidée. */}
      {edition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#404040]/40 backdrop-blur-sm" onClick={fermerEdition}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#404040]/10">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#005259]">
                Modifier la fiche de {edition.Prénom || ""} {edition.Nom || ""}
              </h2>
              <button type="button" onClick={fermerEdition} className="p-1.5 rounded-lg text-[#404040]/50 hover:bg-[#F3F3F2] cursor-pointer">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Civilité</label>
                <select value={edition.Civilité || ""} onChange={(e) => majEdition("Civilité", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="M.">M.</option>
                  <option value="Mme">Mme</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Prénom</label>
                <input type="text" value={edition.Prénom || ""} onChange={(e) => majEdition("Prénom", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Nom</label>
                <input type="text" value={edition.Nom || ""} onChange={(e) => majEdition("Nom", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Téléphone</label>
                <input type="text" value={edition.Téléphone || ""} onChange={(e) => majEdition("Téléphone", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Âge</label>
                <input type="text" value={edition.Age || ""} onChange={(e) => majEdition("Age", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Email</label>
                <input type="text" value={edition.Email || ""} onChange={(e) => majEdition("Email", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Niveau d'études</label>
                <select value={edition.Niveau_Etudes || ""} onChange={(e) => majEdition("Niveau_Etudes", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  {NIVEAUX_ETUDES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Adresse postale</label>
                <input type="text" value={edition.Adresse_Postale || ""} onChange={(e) => majEdition("Adresse_Postale", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Code postal</label>
                <input type="text" value={edition.Code_Postal || ""} onChange={(e) => majEdition("Code_Postal", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Ville</label>
                <input type="text" value={edition.Ville || ""} onChange={(e) => majEdition("Ville", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Territoire</label>
                <input type="text" value={edition.Territoire || ""} onChange={(e) => majEdition("Territoire", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Parcours</label>
                <input type="text" value={edition.Parcours || ""} onChange={(e) => majEdition("Parcours", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">QPV</label>
                <select value={edition.QPV || ""} onChange={(e) => majEdition("QPV", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                  <option value="Je ne sais pas">Je ne sais pas</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">ASE ?</label>
                <select value={edition.ASE || ""} onChange={(e) => majEdition("ASE", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">RQTH ?</label>
                <select value={edition.RQTH || ""} onChange={(e) => majEdition("RQTH", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">NEET ?</label>
                <select value={edition.NEET || ""} onChange={(e) => majEdition("NEET", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">CEJ ?</label>
                <select value={edition.CEJ || ""} onChange={(e) => majEdition("CEJ", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">RSA ?</label>
                <select value={edition.RSA || ""} onChange={(e) => majEdition("RSA", e.target.value)} className={inputEditClass}>
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Situation (+26 ans)</label>
                <input type="text" value={edition.Situation_Plus_26 || ""} onChange={(e) => majEdition("Situation_Plus_26", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Comment connu·e</label>
                <input type="text" value={edition.Comment_Connu || ""} onChange={(e) => majEdition("Comment_Connu", e.target.value)} className={inputEditClass} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1.5">Structure(s) d'accompagnement</label>
              <div className="flex flex-wrap gap-2">
                {STRUCTURES_ACCOMPAGNEMENT.map((s) => (
                  <label
                    key={s}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                      (edition.Structures_Accompagnement || []).includes(s) ? "bg-[#005259] text-white border-[#005259]" : "bg-[#F3F3F2] border-[#404040]/10 text-[#404040]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={(edition.Structures_Accompagnement || []).includes(s)}
                      onChange={() => basculerStructureEdition(s)}
                      className="hidden"
                    />
                    {s}
                  </label>
                ))}
              </div>
              <input
                type="text"
                value={edition.Structure_Autre || ""}
                onChange={(e) => majEdition("Structure_Autre", e.target.value)}
                placeholder="Autre structure (texte libre)"
                className={`${inputEditClass} mt-2`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Prénom référent</label>
                <input type="text" value={edition.Conseiller_Prenom || ""} onChange={(e) => majEdition("Conseiller_Prenom", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Nom référent</label>
                <input type="text" value={edition.Conseiller_Nom || ""} onChange={(e) => majEdition("Conseiller_Nom", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Téléphone référent</label>
                <input type="text" value={edition.Conseiller_Telephone || ""} onChange={(e) => majEdition("Conseiller_Telephone", e.target.value)} className={inputEditClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1">Email référent</label>
                <input type="text" value={edition.Conseiller_Email || ""} onChange={(e) => majEdition("Conseiller_Email", e.target.value)} className={inputEditClass} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#404040]/10">
              <button
                type="button"
                onClick={fermerEdition}
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-[#404040]/60 hover:bg-[#F3F3F2] transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={enregistrerEdition}
                disabled={enregistrementEnCours}
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#005259] hover:bg-[#003d42] text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {enregistrementEnCours ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </PageGuard>
  );
}

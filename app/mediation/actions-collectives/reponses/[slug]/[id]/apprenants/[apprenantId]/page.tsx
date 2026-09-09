"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getDoc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import {
  HomeIcon,
  ArrowLeftIcon,
  UserCircleIcon,
  IdentificationIcon,
  UserGroupIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { formatPhoneNumber } from "@/lib/formatPhone";
import FicheEntretienDiagnostic from "./FicheEntretienDiagnostic";
import { ActionSchema, CATEGORIE_EVOLUTION_DEFAUT, InscriptionActionDynamique, QuestionDef } from "@/lib/dynamicActions/types";
import { chargerSchema, inscriptionDoc } from "@/lib/dynamicActions/store";

// Forme du journal des absences CORE : date + motif libre — justifiée/non
// justifiée se lit sur le code posé ce jour-là dans Evolution ("A"/"ANJ"),
// voir [slug]/[id]/absences/page.tsx et [slug]/[id]/evolution/page.tsx.
type AbsenceRecord = NonNullable<InscriptionActionDynamique["Absences"]>[number];

// Un seul document Firestore regroupe TOUS les champs répartis sur les
// différentes pages (Réponses, Suivi de recrutement, Apprenant·e·s,
// Évolution, Absences) — la fiche se contente donc de tout relire ici. Les
// champs Diagnostic_* portent la "Fiche entretien diagnostic" (voir
// FicheEntretienDiagnostic.tsx), génériques (aucun n'est propre à une action
// en particulier). Diagnostic_RQTH/Diagnostic_FranceTravail sont propres à
// cette fiche diagnostic (distincts d'éventuelles questions CUSTOM du
// même nom posées à l'inscription).
export interface Inscription extends InscriptionActionDynamique {
  Decision_Recrutement?: string;
  Evolution?: Record<string, string>;

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
  Diagnostic_RQTH?: boolean;
  Diagnostic_CongeParental?: boolean;
  Diagnostic_FranceTravail?: boolean;
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

// Duplicata générique de reponses/prfe/[id]/apprenants/[apprenantId] —
// regroupe en un seul écran ce qui est réparti entre Réponses, Suivi de
// recrutement, Apprenant·e·s, Évolution et Absences. Les nombreuses sections
// propres au parcours Tech de PRFE (suivi pédagogique détaillé Kairos/
// certifications, bilan de formation, compte rendu d'entretien de fin de
// parcours) n'ont pas d'équivalent générique et ne sont pas reprises ici —
// seule la "Fiche entretien diagnostic" (déjà générique) l'est, voir
// FicheEntretienDiagnostic.tsx. Les réponses CUSTOM du questionnaire de
// l'action sont affichées via schema.questions, comme sur les autres pages.
export default function FicheApprenantPage() {
  const { slug, id, apprenantId } = useParams<{ slug: string; id: string; apprenantId: string }>();
  const sessionId = decodeURIComponent(id || "");

  const [schema, setSchema] = useState<ActionSchema | null>(null);
  const [inscription, setInscription] = useState<Inscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);
  const [ongletActif, setOngletActif] = useState<"fiche" | "diagnostic">("fiche");

  useEffect(() => {
    const charger = async () => {
      try {
        const s = await chargerSchema(slug);
        setSchema(s);
        if (!s) { setIntrouvable(true); return; }
        const snap = await getDoc(inscriptionDoc(slug, apprenantId));
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
  }, [slug, apprenantId]);

  const mettreAJourChamp = async (champ: keyof Inscription, valeur: any) => {
    setInscription((prev) => (prev ? { ...prev, [champ]: valeur } : prev));
    try {
      await updateDoc(inscriptionDoc(slug, apprenantId), { [champ]: valeur });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de ${String(champ)} :`, error);
    }
  };

  const categoriesActivite = schema?.categoriesEvolution && schema.categoriesEvolution.length > 0 ? schema.categoriesEvolution : CATEGORIE_EVOLUTION_DEFAUT;
  const codesPresence = useMemo(() => categoriesActivite.map((c) => c.code), [categoriesActivite]);

  const resumeEvolution = useMemo(() => {
    const compteurs: Record<string, number> = {};
    let heuresPresence = 0;
    let heuresPrevues = 0;
    Object.entries(inscription?.Evolution || {}).forEach(([iso, valeur]) => {
      if (!valeur) return;
      compteurs[valeur] = (compteurs[valeur] || 0) + 1;
      if (valeur === "F") return;
      heuresPrevues += HEURES_PAR_JOUR;
      if (codesPresence.includes(valeur)) {
        const retard = Math.max(0, Math.min(HEURES_PAR_JOUR, parseFloat((inscription?.Evolution_Retards?.[iso] || "0").replace(",", ".")) || 0));
        heuresPresence += HEURES_PAR_JOUR - retard;
      }
    });
    const taux = heuresPrevues > 0 ? Math.round((heuresPresence / heuresPrevues) * 100) : null;
    return { compteurs, heuresPresence, heuresPrevues, taux };
  }, [inscription, codesPresence]);

  const absencesTriees = useMemo(() => [...(inscription?.Absences || [])].sort((a, b) => a.date.localeCompare(b.date)), [inscription]);

  const questionsTriees = useMemo(() => (schema ? [...schema.questions].sort((a, b) => a.etape - b.etape) : []), [schema]);
  const valeurCustom = (q: QuestionDef): string => {
    const v = inscription?.reponses?.[q.id];
    if (v === undefined || v === null) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "boolean") return v ? "Oui" : "Non";
    return String(v);
  };

  const referent = `${inscription?.Conseiller_Prenom || ""} ${inscription?.Conseiller_Nom || ""}`.trim();

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement de la fiche...
      </div>
    );
  }

  if (introuvable || !inscription || !schema) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-[#404040] antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#404040]/60">Apprenant·e introuvable.</p>
        <Link
          href={`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionId)}/apprenants`}
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
    <PageGuard pageId="page_access_action_dynamique">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none print:hidden"></div>

      <div className="max-w-[80rem] mx-auto relative z-10 space-y-6">

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl text-white flex items-center justify-center text-lg font-black uppercase shadow-[0_0_15px_rgba(0,82,89,0.3)] shrink-0" style={{ backgroundColor: schema.accentColor }}>
              {(i.Prénom?.[0] || "") + (i.Nom?.[0] || "")}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#005259] tracking-tight">
                {i.Prénom || "—"} <span className="uppercase">{i.Nom || "—"}</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                {schema.label} — {i.Civilité || "—"}{i.Age !== "" && i.Age !== undefined && ` — ${i.Age} ans`}{i.Territoire && ` — Territoire ${i.Territoire}`} — Session : {sessionId || "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <span className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm ${i.Decision_Recrutement === "OK" ? "bg-[#005259]/10 text-[#005259]" : i.Decision_Recrutement === "NOK" ? "bg-[#EF736A]/10 text-[#EF736A]" : "bg-[#404040]/5 text-[#404040]/50"}`}>
              {i.Decision_Recrutement || "En cours"}
            </span>
            {i.Evolution_Actif && (
              <span className="px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm bg-[#EA601F]/10 text-[#EA601F]">Actif</span>
            )}

            <div className="flex items-center gap-1 bg-white border border-[#404040]/10 rounded-xl p-1 shadow-sm">
              <button type="button" onClick={() => setOngletActif("fiche")} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${ongletActif === "fiche" ? "bg-[#005259] text-white" : "text-[#404040]/60 hover:text-[#005259]"}`}>
                Fiche
              </button>
              <button type="button" onClick={() => setOngletActif("diagnostic")} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${ongletActif === "diagnostic" ? "bg-[#005259] text-white" : "text-[#404040]/60 hover:text-[#005259]"}`}>
                Entretien diagnostic
              </button>
            </div>

            <Link href={`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionId)}/apprenants`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" /><span>Apprenant·e·s</span>
            </Link>
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" /><span>Accueil</span>
            </Link>
          </div>
        </div>

        {ongletActif === "diagnostic" ? (
          <FicheEntretienDiagnostic inscription={i} mettreAJourChamp={mettreAJourChamp} intituleAction={schema.label} />
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
              <Champ label="QPV" valeur={i.QPV} />
            </div>
          </Section>

          <Section icon={UserGroupIcon} titre="Accompagnement & projet">
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Prescripteur / structure d'accompagnement" valeur={i.Structure_Accompagnement} />
              <Champ label="Référent·e" valeur={referent} />
              <Champ label="Tél. référent·e" valeur={formatPhoneNumber(i.Conseiller_Telephone)} />
              <Champ label="Mail référent·e" valeur={i.Conseiller_Email} />
            </div>
          </Section>

          {questionsTriees.length > 0 && (
            <Section icon={IdentificationIcon} titre="Questions complémentaires">
              <div className="grid grid-cols-2 gap-4">
                {questionsTriees.map((q) => <Champ key={q.id} label={q.label} valeur={valeurCustom(q)} />)}
              </div>
            </Section>
          )}

          <Section icon={ClipboardDocumentCheckIcon} titre="Suivi de recrutement">
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Décision" valeur={i.Decision_Recrutement || "En cours"} />
              <Champ label="Affecté·e au suivi" valeur={i.Suivi_Recrutement ? "Oui" : "Non"} />
            </div>
          </Section>

          <Section icon={AcademicCapIcon} titre="Évolution & présence">
            <div className="grid grid-cols-3 gap-4">
              <Champ label="Heures de présence" valeur={resumeEvolution.heuresPrevues > 0 ? resumeEvolution.heuresPresence.toFixed(2) : undefined} />
              <Champ label="Heures prévues" valeur={resumeEvolution.heuresPrevues > 0 ? resumeEvolution.heuresPrevues.toFixed(2) : undefined} />
              <Champ label="Taux de présence" valeur={resumeEvolution.taux !== null ? `${resumeEvolution.taux}%` : undefined} />
            </div>
            {Object.keys(resumeEvolution.compteurs).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#404040]/10">
                {Object.entries(resumeEvolution.compteurs).map(([code, n]) => {
                  const info = categoriesActivite.find((c) => c.code === code);
                  return (
                    <span key={code} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold" style={info ? { backgroundColor: `${info.bg}20`, color: info.bg } : undefined}>
                      {info?.label || code} : {n}
                    </span>
                  );
                })}
              </div>
            )}
          </Section>

          <Section icon={ClipboardDocumentCheckIcon} titre="Journal des absences">
            {absencesTriees.length > 0 ? (
              <div className="space-y-2">
                {absencesTriees.map((a: AbsenceRecord, index: number) => {
                  const justifiee = inscription?.Evolution?.[a.date] !== "ANJ";
                  return (
                    <div key={index} className="flex items-center justify-between gap-3 bg-[#F3F3F2] rounded-lg p-2.5 text-xs">
                      <span className="font-bold text-[#005259]">{formaterDateFr(a.date)}</span>
                      <span className={`font-bold ${justifiee ? "text-[#005259]" : "text-[#EF4444]"}`}>{justifiee ? "Justifiée" : "Non justifiée"}</span>
                      <span className="text-[#404040]/70 flex-1 truncate">{a.motif || "—"}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#404040]/50 font-medium">Aucune absence enregistrée.</p>
            )}
          </Section>

        </div>
        )}

      </div>
    </main>
    </PageGuard>
  );
}

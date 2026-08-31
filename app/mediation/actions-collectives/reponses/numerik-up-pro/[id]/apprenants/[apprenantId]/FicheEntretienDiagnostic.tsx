"use client";

import { useState } from "react";
import { PrinterIcon, ExclamationTriangleIcon, PhotoIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { Inscription } from "./page";

// Reproduction éditable + imprimable de la "FICHE ENTRETIEN DIAGNOSTIC —
// Numérik'Pro Tech" (formulaire papier fourni). Les champs déjà présents sur
// le profil (identité/contact) sont réutilisés via mettreAJourChamp — voir
// l'interface Inscription exportée par page.tsx pour la liste complète des
// nouveaux champs Diagnostic_*.

// Style "trait souligné" (pas de case encadrée) — fidèle à la densité du PDF
// papier, où chaque ligne tient sur une seule hauteur de texte. La valeur
// saisie ressort en orange Colombbus, comme sur la maquette validée.
const champLigneInputClass =
  "flex-1 min-w-0 bg-transparent border-0 border-b border-[#404040]/30 focus:border-[#005259] rounded-none px-1 py-0.5 text-xs text-[#EA601F] font-semibold outline-none print:border-black";
const champLigneLabelClass = "text-[11px] font-bold text-[#404040] whitespace-nowrap shrink-0 print:text-black";

const champTexteClass =
  "w-full bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-lg px-2.5 py-1.5 text-xs text-[#404040] outline-none font-medium transition-colors " +
  "print:border-0 print:border-b print:border-black print:rounded-none print:bg-transparent print:px-0";

const labelClass = champLigneLabelClass;

function ChampLigne({ label, valeur, onValide, type = "text", className = "" }: { label: string; valeur?: string; onValide: (v: string) => void; type?: string; className?: string }) {
  return (
    <label className={`flex items-baseline gap-1.5 min-w-0 ${className}`}>
      <span className={champLigneLabelClass}>{label} :</span>
      <input type={type} defaultValue={valeur || ""} onBlur={(e) => onValide(e.target.value)} className={champLigneInputClass} />
    </label>
  );
}

function ZoneTexte({ label, sousLabel, valeur, onValide, rows = 3 }: { label?: string; sousLabel?: string; valeur?: string; onValide: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-bold text-[#404040] mb-1">{label}</span>}
      {sousLabel && <span className="block text-[10px] italic text-[#404040]/50 mb-1.5 print:text-black/70">{sousLabel}</span>}
      <textarea defaultValue={valeur || ""} onBlur={(e) => onValide(e.target.value)} rows={rows} className={`${champTexteClass} resize-y print:resize-none`} />
    </label>
  );
}

// Case ☐/☒ — visuellement fidèle au formulaire papier fourni (des "X" dans
// des cases, pas des coches). Le glyphe (couleur de texte) reste visible à
// l'impression même si le navigateur retire les couleurs de fond.
function Case({ coche }: { coche?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 shrink-0 rounded-[3px] border-2 text-[11px] font-black leading-none print:border-black ${
        coche ? "border-[#005259] text-[#005259] print:text-black" : "border-[#404040]/40 text-transparent"
      }`}
    >
      ✕
    </span>
  );
}

function CocherBool({ label, valeur, onChange }: { label: string; valeur?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5">
      <span className="text-xs font-bold text-[#404040] flex-1 min-w-[60%]">{label}</span>
      <div className="flex items-center gap-4 shrink-0">
        <button type="button" onClick={() => onChange(true)} className="flex items-center gap-1.5 cursor-pointer">
          <Case coche={valeur === true} />
          <span className="text-xs font-medium text-[#404040]">OUI</span>
        </button>
        <button type="button" onClick={() => onChange(false)} className="flex items-center gap-1.5 cursor-pointer">
          <Case coche={valeur === false} />
          <span className="text-xs font-medium text-[#404040]">NON</span>
        </button>
      </div>
    </div>
  );
}

function CocherChoixUnique({ label, options, valeur, onChange, className = "" }: { label?: string; options: string[]; valeur?: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={className}>
      {label && <span className="block text-xs font-bold text-[#404040] mb-1">{label}</span>}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => onChange(opt)} className="flex items-center gap-1.5 cursor-pointer">
            <Case coche={valeur === opt} />
            <span className="text-xs font-medium text-[#404040]">{opt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CocherChoixMultiple({ label, options, valeurs, onChange }: { label?: string; options: string[]; valeurs?: string[]; onChange: (v: string[]) => void }) {
  const liste = valeurs || [];
  const toggle = (opt: string) => onChange(liste.includes(opt) ? liste.filter((v) => v !== opt) : [...liste, opt]);
  return (
    <div>
      {label && <span className="block text-xs font-bold text-[#404040] mb-1">{label}</span>}
      <div className="flex flex-col gap-1">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => toggle(opt)} className="flex items-center gap-1.5 cursor-pointer text-left">
            <Case coche={liste.includes(opt)} />
            <span className="text-xs font-medium text-[#404040]">{opt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Bandeau de section teal, fidèle au PDF fourni. Pas de break-inside-avoid :
// une grande section (ex. "Situation administrative") qui ne tient pas dans
// l'espace restant de la page serait alors renvoyée intégralement à la page
// suivante, laissant un grand vide — le PDF original laisse justement ses
// sections se couper naturellement entre deux pages (ex. "Situation
// sociale"), c'est ce comportement qu'on reproduit ici.
function SectionPDF({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#404040]/15 rounded-xl overflow-hidden">
      <div className="bg-[#005259] text-white text-xs font-extrabold uppercase tracking-widest px-3 py-2 print:bg-[#005259] print:text-white">
        {titre}
      </div>
      <div className="p-3 space-y-2 bg-white">{children}</div>
    </div>
  );
}

// Un des 3 blocs "Que visez-vous à la sortie ?" — case à cocher + question +
// réponse libre, repris tel quel du PDF (y compris la question "Quel métier…"
// qui y apparaît deux fois).
function BlocObjectif({
  coche, onToggle, question, exemple, reponse, onReponse,
}: {
  coche?: boolean; onToggle: (v: boolean) => void; question: string; exemple?: string; reponse?: string; onReponse: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => onToggle(!coche)} className="flex items-start gap-1.5 cursor-pointer text-left">
        <Case coche={coche} />
        <span className="text-xs font-bold text-[#404040]">{question}</span>
      </button>
      {exemple && <p className="text-[10px] italic text-[#404040]/50 pl-5.5 ml-5">({exemple})</p>}
      <textarea
        defaultValue={reponse || ""}
        onBlur={(e) => onReponse(e.target.value)}
        rows={2}
        className={`${champTexteClass} resize-y print:resize-none ml-5 w-[calc(100%-1.25rem)]`}
      />
    </div>
  );
}

// Signature de l'attestation finale — jamais persistée en base (voir mention
// jaune ci-dessous), même principe que les 3 fiches apprenant·e·s (Digital'UP,
// Numérik'UP, NUMERIK PRO) : état local uniquement, perdue en quittant la page.
function BoiteSignatureLocale({ url, uploading, onUpload, onSupprimer }: { url?: string; uploading: boolean; onUpload: (file: File) => void; onSupprimer: () => void }) {
  return (
    <div className="relative h-32 rounded-xl border-2 border-dashed border-[#404040]/20 bg-[#F3F3F2] flex items-center justify-center overflow-hidden print:border-black print:bg-transparent">
      {url ? (
        <>
          <img src={url} alt="Signature" className="max-h-full max-w-full object-contain p-2" />
          <button type="button" onClick={onSupprimer} title="Retirer cette signature" className="print:hidden absolute top-1.5 right-1.5 p-1.5 bg-white/90 border border-[#404040]/10 text-[#404040]/50 hover:text-[#EF736A] rounded-lg shadow-sm cursor-pointer">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <label htmlFor="signature-diagnostic" className="print:hidden flex flex-col items-center gap-1.5 text-[#404040]/40 hover:text-[#005259] transition-colors cursor-pointer">
          <PhotoIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">{uploading ? "Envoi..." : "Ajouter une image"}</span>
        </label>
      )}
      <input
        id="signature-diagnostic"
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
  );
}

export default function FicheEntretienDiagnostic({
  inscription, mettreAJourChamp,
}: {
  inscription: Inscription;
  mettreAJourChamp: (champ: keyof Inscription, valeur: any) => void;
}) {
  const i = inscription;
  const maj = (champ: keyof Inscription, valeur: any) => mettreAJourChamp(champ, valeur);

  const [signatureUrl, setSignatureUrl] = useState<string | undefined>(undefined);
  const [televersementSignature, setTeleversementSignature] = useState(false);
  const televerserSignature = (file: File) => {
    if (file.size > 500 * 1024) {
      console.error("Image de signature trop lourde (max 500 Ko).");
      return;
    }
    setTeleversementSignature(true);
    const reader = new FileReader();
    reader.onload = () => {
      setSignatureUrl(reader.result as string);
      setTeleversementSignature(false);
    };
    reader.onerror = () => setTeleversementSignature(false);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-[#EA601F] hover:bg-[#005259] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
        >
          <PrinterIcon className="w-4 h-4" /> Imprimer
        </button>
      </div>

      <div className="bg-white text-black p-6 md:p-[1.8cm] print:p-0 rounded-2xl print:rounded-none shadow-sm print:shadow-none mx-auto w-full max-w-4xl space-y-3">
        <img src="/logos/Logo_Colombbus_noir_trans.png" alt="Colombbus" className="h-12 w-auto object-contain" />

        <div className="bg-[#005259] text-white text-center py-4 rounded-xl print:rounded-none">
          <h1 className="text-lg font-bold uppercase tracking-wide">Fiche entretien diagnostic</h1>
          <p className="text-sm font-medium">Numérik'Pro Tech</p>
        </div>

        <SectionPDF titre="Ne pas remplir cette zone grise réservée à Colombbus">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <ChampLigne label="Date de réalisation" type="date" valeur={i.Diagnostic_DateRealisation} onValide={(v) => maj("Diagnostic_DateRealisation", v)} className="w-[220px]" />
            <div className="flex items-baseline gap-2 flex-1 min-w-[280px]">
              <span className={champLigneLabelClass}>Mode choisi :</span>
              <button type="button" onClick={() => maj("Diagnostic_ModeEntretienAtelier", !i.Diagnostic_ModeEntretienAtelier)} className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                <Case coche={i.Diagnostic_ModeEntretienAtelier} />
                <span className="text-xs font-medium text-[#404040] whitespace-nowrap">Entretien(s)/atelier(s)</span>
              </button>
              <input defaultValue={i.Diagnostic_ModeDetail || ""} onBlur={(e) => maj("Diagnostic_ModeDetail", e.target.value)} className={champLigneInputClass} />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <ChampLigne label="Nom du réalisateur" valeur={i.Diagnostic_NomRealisateur} onValide={(v) => maj("Diagnostic_NomRealisateur", v)} className="flex-[1.4] min-w-[240px]" />
            <ChampLigne label="Fonction du réalisateur" valeur={i.Diagnostic_FonctionRealisateur} onValide={(v) => maj("Diagnostic_FonctionRealisateur", v)} className="flex-1 min-w-[180px]" />
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 items-start">
            <ChampLigne label="Lieu de réalisation" valeur={i.Diagnostic_LieuRealisation} onValide={(v) => maj("Diagnostic_LieuRealisation", v)} className="flex-1 min-w-[220px]" />
            <CocherChoixUnique
              label="Période réalisation"
              options={["Accueil-recrutement", "Début de parcours"]}
              valeur={i.Diagnostic_PeriodeRealisation}
              onChange={(v) => maj("Diagnostic_PeriodeRealisation", v)}
            />
          </div>
        </SectionPDF>

        <SectionPDF titre="Situation administrative">
          <ChampLigne label="Orienté par" valeur={i.Diagnostic_OrientePar} onValide={(v) => maj("Diagnostic_OrientePar", v)} />
          <div className="flex flex-wrap gap-x-8 gap-y-2 items-start">
            <CocherChoixUnique label="Civilité" options={["Mme", "M."]} valeur={i.Civilité} onChange={(v) => maj("Civilité", v)} />
            <div className="flex-1 min-w-[240px] space-y-2">
              <ChampLigne label="Nom de naissance" valeur={i.Nom} onValide={(v) => maj("Nom", v)} />
              <ChampLigne label="Nom d'usage" valeur={i.Diagnostic_NomUsage} onValide={(v) => maj("Diagnostic_NomUsage", v)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <ChampLigne label="Prénom(s)" valeur={i.Prénom} onValide={(v) => maj("Prénom", v)} className="flex-1 min-w-[160px]" />
            <ChampLigne label="Date de naissance" type="date" valeur={i.Diagnostic_DateNaissance} onValide={(v) => maj("Diagnostic_DateNaissance", v)} className="flex-1 min-w-[180px]" />
            <ChampLigne label="Âge" valeur={i.Age} onValide={(v) => maj("Age", v)} className="min-w-[120px]" />
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <ChampLigne label="Tél. fixe" valeur={i.Diagnostic_TelFixe} onValide={(v) => maj("Diagnostic_TelFixe", v)} className="flex-1 min-w-[180px]" />
            <ChampLigne label="Tél. portable" valeur={i.Téléphone} onValide={(v) => maj("Téléphone", v)} className="flex-1 min-w-[180px]" />
          </div>
          <ChampLigne label="Adresse" valeur={i.Diagnostic_Adresse} onValide={(v) => maj("Diagnostic_Adresse", v)} />
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <ChampLigne label="CP" valeur={i.Code_Postal} onValide={(v) => maj("Code_Postal", v)} className="min-w-[140px]" />
            <ChampLigne label="Ville" valeur={i.Ville} onValide={(v) => maj("Ville", v)} className="flex-1 min-w-[180px]" />
          </div>
          <ChampLigne label="Courriel" valeur={i.Email} onValide={(v) => maj("Email", v)} />
          <ChampLigne label="N° sécurité sociale" valeur={i.Diagnostic_NumSecuriteSociale} onValide={(v) => maj("Diagnostic_NumSecuriteSociale", v)} />
          <ChampLigne label="N° CNI" valeur={i.Diagnostic_NumCNI} onValide={(v) => maj("Diagnostic_NumCNI", v)} />
          <ChampLigne label="N° carte de séjour" valeur={i.Diagnostic_NumCarteSejour} onValide={(v) => maj("Diagnostic_NumCarteSejour", v)} />
        </SectionPDF>

        <SectionPDF titre="Situation sociale">
          <CocherChoixUnique
            label="Quelle est votre situation familiale ?"
            options={["Célibataire", "Vie maritale/concubinage", "Marié(e)", "Veuf(ve)", "Divorcé(e)"]}
            valeur={i.Diagnostic_SituationFamiliale}
            onChange={(v) => maj("Diagnostic_SituationFamiliale", v)}
          />
          <div>
            <CocherChoixMultiple
              label="Situation particulière ?"
              options={["Parent isolé", "Aidant familial", "Autre"]}
              valeurs={i.Diagnostic_SituationParticuliere}
              onChange={(v) => maj("Diagnostic_SituationParticuliere", v)}
            />
            {i.Diagnostic_SituationParticuliere?.includes("Autre") && (
              <div className="mt-2">
                <ChampLigne label="Précisez" valeur={i.Diagnostic_SituationParticuliereAutre} onValide={(v) => maj("Diagnostic_SituationParticuliereAutre", v)} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 items-baseline">
            <CocherBool label="Êtes-vous au chômage ?" valeur={i.Diagnostic_Chomage} onChange={(v) => maj("Diagnostic_Chomage", v)} />
            <ChampLigne label="Durée de chômage (en année et mois)" valeur={i.Diagnostic_DureeChomage} onValide={(v) => maj("Diagnostic_DureeChomage", v)} />
          </div>
          <CocherBool label="Avez-vous une RQTH (Reconnaissance en Qualité de Travailleur Handicapé) ?" valeur={i.RQTH === "Oui"} onChange={(v) => maj("RQTH", v ? "Oui" : "Non")} />
          <CocherBool label="Êtes-vous en congé parental ?" valeur={i.Diagnostic_CongeParental} onChange={(v) => maj("Diagnostic_CongeParental", v)} />
          <div className="flex flex-wrap gap-x-8 gap-y-2 items-baseline">
            <CocherBool label="Êtes-vous inscrit(e) à France Travail ?" valeur={i.France_Travail === "Oui"} onChange={(v) => maj("France_Travail", v ? "Oui" : "Non")} />
            <ChampLigne label="Si OUI, depuis quand ?" type="date" valeur={i.Diagnostic_FranceTravailDepuis} onValide={(v) => maj("Diagnostic_FranceTravailDepuis", v)} />
          </div>
        </SectionPDF>

        <SectionPDF titre="Diplôme obtenu / Niveau d'études">
          <CocherChoixUnique
            options={["Sans diplôme", "Brevet des collèges", "CAP / BEP (autres diplômes techniques)", "Bac (général, pro ou technologique)", "Bac + 2 (BTS ou autre)", "Bac + 3/4 (Licence, Maîtrise)", "Bac + 5 (Master, Écoles d'ingénieur, École d'arts…)", "Bac + 7 (Doctorat, post-doc, thèse)"]}
            valeur={i.Niveau_Etudes}
            onChange={(v) => maj("Niveau_Etudes", v)}
          />
          <ChampLigne label="Formation/études suivies" valeur={i.Diagnostic_FormationSuivies} onValide={(v) => maj("Diagnostic_FormationSuivies", v)} />
        </SectionPDF>

        <SectionPDF titre="Expérience professionnelle récente">
          <div>
            <CocherChoixUnique
              label="Nature du contrat de travail"
              options={["CDI", "CDD", "CDDI", "Intérim", "Autre"]}
              valeur={i.Diagnostic_NatureContrat}
              onChange={(v) => maj("Diagnostic_NatureContrat", v)}
            />
            {i.Diagnostic_NatureContrat === "Autre" && (
              <div className="mt-2">
                <ChampLigne label="Précisez" valeur={i.Diagnostic_NatureContratAutre} onValide={(v) => maj("Diagnostic_NatureContratAutre", v)} />
              </div>
            )}
          </div>
          <CocherChoixUnique
            label="Emploi occupé"
            options={["Employé(e)", "Employé qualifié", "Technicien", "Agent de maîtrise", "Cadre moyen", "Cadre dirigeant"]}
            valeur={i.Diagnostic_EmploiOccupe}
            onChange={(v) => maj("Diagnostic_EmploiOccupe", v)}
          />
        </SectionPDF>

        <SectionPDF titre="Votre future expérience professionnelle">
          <CocherBool label="Disposez-vous d'un équipement informatique ?" valeur={i.Diagnostic_EquipementInfo} onChange={(v) => maj("Diagnostic_EquipementInfo", v)} />
          {i.Diagnostic_EquipementInfo && (
            <>
              <ChampLigne label="Si OUI, précisez" valeur={i.Diagnostic_EquipementInfoPrecisions} onValide={(v) => maj("Diagnostic_EquipementInfoPrecisions", v)} />
              <CocherChoixMultiple
                options={["Écran + unité centrale", "PC portable", "Box internet (ADSL)", "Box internet (Fibre Optique)", "Téléphone portable", "Téléphone portable + forfait internet"]}
                valeurs={i.Diagnostic_TypeEquipement}
                onChange={(v) => maj("Diagnostic_TypeEquipement", v)}
              />
              <ChampLigne label="Précisez le type (PC, Mac, Linux…) et la connectivité (ADSL, fibre, etc.)" valeur={i.Diagnostic_TypeConnectivite} onValide={(v) => maj("Diagnostic_TypeConnectivite", v)} />
            </>
          )}
          <div>
            <span className="block text-xs font-bold text-[#404040] mb-1.5">Comment évalueriez-vous votre maîtrise de l'informatique ?</span>
            <div className="space-y-1.5">
              {[
                { niveau: "Débutant", detail: "ouverture d'une session, utilisation de la souris, utilisation de programmes" },
                { niveau: "Amateur/autodidacte", detail: "utilisation messagerie, gestion fichiers, recherches sur internet/sur disque" },
                { niveau: "Initié professionnel", detail: "traitement de texte, administration système/réseau, programmation informatique/web" },
                { niveau: "Expert", detail: "précisez votre expertise ou spécialité" },
              ].map(({ niveau, detail }) => (
                <button key={niveau} type="button" onClick={() => maj("Diagnostic_MaitriseInfo", niveau)} className="flex items-start gap-1.5 text-left cursor-pointer w-full">
                  <Case coche={i.Diagnostic_MaitriseInfo === niveau} />
                  <span className="text-xs text-[#404040]">
                    <span className="font-bold">{niveau}</span> <span className="italic text-[#404040]/50">({detail})</span>
                  </span>
                </button>
              ))}
            </div>
            {i.Diagnostic_MaitriseInfo === "Expert" && (
              <div className="mt-2">
                <ChampLigne label="Précisez" valeur={i.Diagnostic_MaitriseInfoExpertPrecisions} onValide={(v) => maj("Diagnostic_MaitriseInfoExpertPrecisions", v)} />
              </div>
            )}
          </div>
          <CocherBool
            label="Avez-vous déjà réalisé des actions telles que : installation de logiciels, utilisation de messageries, gestion de fichiers, utilisation de plateformes collaboratives ?"
            valeur={i.Diagnostic_ActionsRealisees}
            onChange={(v) => maj("Diagnostic_ActionsRealisees", v)}
          />
          {i.Diagnostic_ActionsRealisees && <ChampLigne label="Précisez" valeur={i.Diagnostic_ActionsRealiseesPrecisions} onValide={(v) => maj("Diagnostic_ActionsRealiseesPrecisions", v)} />}
          <CocherBool
            label="Êtes-vous à l'aise avec la navigation, la maintenance de base, et la gestion d'un environnement informatique ?"
            valeur={i.Diagnostic_AiseNavigation}
            onChange={(v) => maj("Diagnostic_AiseNavigation", v)}
          />
          {i.Diagnostic_AiseNavigation && <ChampLigne label="Précisez" valeur={i.Diagnostic_AiseNavigationPrecisions} onValide={(v) => maj("Diagnostic_AiseNavigationPrecisions", v)} />}
          <CocherBool
            label="Avez-vous déjà eu des expériences en dépannage informatique ou en support technique ?"
            valeur={i.Diagnostic_ExperienceDepannage}
            onChange={(v) => maj("Diagnostic_ExperienceDepannage", v)}
          />
          {i.Diagnostic_ExperienceDepannage && <ChampLigne label="Précisez" valeur={i.Diagnostic_ExperienceDepannagePrecisions} onValide={(v) => maj("Diagnostic_ExperienceDepannagePrecisions", v)} />}
          <div>
            <CocherChoixMultiple
              label="Quelles compétences souhaitez-vous renforcer ou acquérir dans le cadre de Numérik'Pro Tech ?"
              options={[
                "Renforcer mon socle de compétences numériques de base",
                "Découvrir et comprendre les fondamentaux de la cybersécurité",
                "Apprendre les bases de la maintenance informatique responsable",
                "Comprendre les principes de sobriété numérique et d'éco-conception",
                "Bénéficier d'un accompagnement socio-professionnel pour construire mon projet professionnel",
                "Autre",
              ]}
              valeurs={i.Diagnostic_CompetencesARenforcer}
              onChange={(v) => maj("Diagnostic_CompetencesARenforcer", v)}
            />
            {i.Diagnostic_CompetencesARenforcer?.includes("Autre") && (
              <div className="mt-2">
                <ChampLigne label="Précisez" valeur={i.Diagnostic_CompetencesARenforcerAutre} onValide={(v) => maj("Diagnostic_CompetencesARenforcerAutre", v)} />
              </div>
            )}
          </div>
        </SectionPDF>

        <SectionPDF titre="Que visez-vous à la sortie de la formation Numérik'Pro ?">
          <BlocObjectif
            coche={i.Diagnostic_ObjSortie1_Coche}
            onToggle={(v) => maj("Diagnostic_ObjSortie1_Coche", v)}
            question="Quel métier souhaitez-vous exercer à l'issue de la formation ?"
            exemple="ex. : Technicien HelpDesk, support informatique, analyste cybersécurité, etc."
            reponse={i.Diagnostic_ObjSortie1_Reponse}
            onReponse={(v) => maj("Diagnostic_ObjSortie1_Reponse", v)}
          />
          <BlocObjectif
            coche={i.Diagnostic_ObjSortie2_Coche}
            onToggle={(v) => maj("Diagnostic_ObjSortie2_Coche", v)}
            question="Quel métier souhaitez-vous exercer à l'issue de la formation ?"
            reponse={i.Diagnostic_ObjSortie2_Reponse}
            onReponse={(v) => maj("Diagnostic_ObjSortie2_Reponse", v)}
          />
          <BlocObjectif
            coche={i.Diagnostic_ObjSortie3_Coche}
            onToggle={(v) => maj("Diagnostic_ObjSortie3_Coche", v)}
            question="Pouvez-vous décrire brièvement votre projet professionnel et comment Numérik'Pro Tech pourrait vous y aider ?"
            reponse={i.Diagnostic_ObjSortie3_Reponse}
            onReponse={(v) => maj("Diagnostic_ObjSortie3_Reponse", v)}
          />
        </SectionPDF>

        <SectionPDF titre="Quel est votre projet professionnel aujourd'hui ? Quel métier voulez-vous exercer ?">
          <ZoneTexte valeur={i.Diagnostic_ProjetProfessionnelAujourdhui} onValide={(v) => maj("Diagnostic_ProjetProfessionnelAujourdhui", v)} rows={4} />
        </SectionPDF>

        <SectionPDF titre="Questions complémentaires et besoins spécifiques">
          <ZoneTexte
            label="Sur quels problèmes spécifiques/urgents COLOMBBUS pourrait vous apporter des éléments de réponses ou solutions ?"
            sousLabel="ex. : difficultés à utiliser certains logiciels, manque d'autonomie dans l'utilisation d'outils numériques, besoins en révision de compétences de base…"
            valeur={i.Diagnostic_ProblemesSpecifiques}
            onValide={(v) => maj("Diagnostic_ProblemesSpecifiques", v)}
          />
          <ZoneTexte
            label="Avez-vous des contraintes particulières (mobilité, horaires, accessibilité) qui pourraient impacter votre participation à la formation ?"
            sousLabel="ex. : temps de trajet maximal, équipements spécifiques, etc."
            valeur={i.Diagnostic_ContraintesParticulieres}
            onValide={(v) => maj("Diagnostic_ContraintesParticulieres", v)}
          />
        </SectionPDF>

        <div className="border-2 border-[#005259] rounded-xl p-4 space-y-4 break-inside-avoid-page print:border-black">
          <p className="text-sm font-bold text-[#005259] print:text-black">J'atteste sur l'honneur que les informations portées sur cette fiche sont exactes</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChampLigne label="Date" type="date" valeur={i.Diagnostic_DateAttestation} onValide={(v) => maj("Diagnostic_DateAttestation", v)} />
            <div>
              <span className={labelClass}>Signature (précédée de la mention "Lu et approuvé")</span>
              <BoiteSignatureLocale url={signatureUrl} uploading={televersementSignature} onUpload={televerserSignature} onSupprimer={() => setSignatureUrl(undefined)} />
            </div>
          </div>
          <div className="print:hidden flex items-center gap-2.5 bg-[#F9C44E]/20 border border-[#F9C44E] rounded-xl p-3">
            <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-[#404040]" />
            <p className="text-xs font-bold text-[#404040]">
              Cette signature n'est pas enregistrée : elle ne sert qu'à l'impression/l'export de cette fiche et sera perdue si vous quittez la page.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-[#404040]/15 text-[9px] text-[#404040]/70 print:text-black leading-relaxed space-y-2 break-inside-avoid-page">
          <p>
            <span className="font-bold italic">Les informations portées sur ce formulaire sont obligatoires.</span>{" "}
            <span className="italic">
              Elles font l'objet dans le cadre de votre accompagnement social et professionnel, d'un traitement informatisé destiné à une inscription à la certification PIX. Les
              destinataires des données sont le conseiller en insertion professionnelle de COLOMBBUS ou les acteurs de l'action sociale l'emploi. En application de la loi
              Informatique et Libertés du 6 janvier 1978 modifiée, vous disposez d'un droit d'accès, de rectification et d'effacement de vos données personnelles. Vous disposez
              également du droit de limiter ou de vous opposer au traitement de vos données pour motifs légitimes, et de décider du sort de celles-ci après votre décès, dans les
              limites fixées par la loi.
            </span>
          </p>
          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-[#EA601F] print:text-black pt-2">Numérik'Pro Tech</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          html, body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* L'icône native du sélecteur de date et la poignée de
             redimensionnement des zones de texte n'ont aucune utilité à
             l'impression — sans ça, elles s'impriment quand même comme des
             artefacts visuels parasites. */
          input[type="date"]::-webkit-calendar-picker-indicator {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

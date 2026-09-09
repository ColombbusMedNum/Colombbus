"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { formatNom, formatPrenom } from "@/lib/formatName";
import { formatPhoneForStorage } from "@/lib/formatPhone";
import { sessionEstAVenir } from "@/lib/sessionDates";
import { calculerAge } from "@/lib/dateNaissance";

// Version PUBLIQUE (sans connexion) du formulaire de pré-inscription PRFE —
// voir aussi la version interne, réservée au staff, à
// app/mediation/actions-collectives/inscription/prfe/page.tsx. Mêmes champs
// et même collection Firestore (inscriptions_prfe), mais : aucun
// PageGuard/navigation interne (voir middleware.ts pagesPubliques et
// firestore.rules pour l'écriture ouverte correspondante) ; pas
// d'autocomplétion sur l'annuaire des prescripteurs (accès réservé au
// staff) — le/la candidat.e saisit directement les coordonnées de son
// conseiller.e référent.e le cas échéant ; en-tête avec logos, choisis par
// un admin depuis /mediation/actions-collectives/inscription/prfe/parametres
// (bibliothèque partagée).

interface Parcours {
  id: string;
  label: string;
}

// PRFE ne propose aujourd'hui qu'un seul parcours (préparation au titre
// professionnel TIP — technicien informatique de proximité).
const PARCOURS_DEFAUT: Parcours[] = [
  { id: "preparation-parcours-metiers", label: "Préparation Parcours Métiers" },
];

const TERRITOIRES_DEFAUT = ["91", "92", "Autres"];

const NIVEAUX_ETUDES = [
  "Infra brevet",
  "Brevet, CAP, BEP",
  "Bac",
  "Bac+2 (L2, BTS, DUT, DEUST)",
  "Bac+3 (Licence, licence professionnelle)",
  "Bac+4/5 et plus",
  "Supérieur à Bac +3",
  "Autre",
];

// Option ajoutée à la liste des sessions pour les personnes intéressées par
// le parcours mais indisponibles aux dates proposées (plutôt que de les
// forcer à choisir une session à laquelle elles ne pourront pas venir).
const SESSION_AUCUNE_CONVIENT = "Aucune date ne me convient — me recontacter";

const inputClass = "w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] placeholder-[#404040]/40 outline-none font-medium transition-colors";
const labelClass = "block text-[11px] font-bold text-[#404040]/70 uppercase tracking-wide mb-1";

// Pour les campagnes d'emailing (Brevo...) : un lien du type
// .../inscription/prfe?parcours=preparation-parcours-metiers pré-sélectionne
// le parcours correspondant, sans accents/casse à respecter côté lien.
function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const FORM_VIDE = {
  civilite: "M.",
  nom: "",
  prenom: "",
  telephone: "",
  email: "",
  adressePostale: "",
  codePostal: "",
  ville: "",
  qpv: "Je ne sais pas",
  dateNaissance: "",
  situationHandicap: "Non",
  rqth: "Non",
  rsa: "Non",
  niveauEtudes: "Bac",
  niveauEtudesAutre: "",
  franceTravail: "Non",
  identifiantFranceTravail: "",
  formationCertifianteRecente: "Non",
  informeFormationTIP: "Non",
  disponibleDatesSession: "Oui",
  structureAccompagnement: "",
  conseillerNom: "",
  conseillerPrenom: "",
  conseillerEmail: "",
  conseillerTelephone: "",
  metierSouhaite: "",
  parcours: "preparation-parcours-metiers",
  territoire: "91",
  session: "",
  rgpd: false,
};

export default function FormulairePublicPrfePage() {
  return (
    <Suspense fallback={null}>
      <FormulairePublicPrfeContenu />
    </Suspense>
  );
}

function FormulairePublicPrfeContenu() {
  const searchParams = useSearchParams();
  const parcoursPreselectionneApplique = useRef(false);
  const [formData, setFormData] = useState(FORM_VIDE);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etape, setEtape] = useState(1);
  const TOTAL_ETAPES = 6;

  // Protections anti-bot invisibles (pas de CAPTCHA) : un champ piège que
  // seuls des bots remplissent (masqué pour un vrai visiteur), et un délai
  // minimum entre l'affichage de la page et l'envoi (un bot soumet en une
  // fraction de seconde, jamais un humain sur un formulaire en 6 étapes).
  // Les deux sont aussi vérifiées côté règles Firestore (voir firestore.rules)
  // pour rester efficaces même face à un script qui contournerait ce code.
  const [piege, setPiege] = useState("");
  const [debutRemplissage] = useState(() => Date.now());

  const [parcoursListe, setParcoursListe] = useState<Parcours[]>(PARCOURS_DEFAUT);
  const [territoiresListe, setTerritoiresListe] = useState<string[]>(TERRITOIRES_DEFAUT);
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});
  // Un même partenaire ne finance pas forcément l'action sur tous les
  // territoires : les logos affichés en en-tête dépendent donc du
  // territoire choisi à l'étape 1 (voir .../prfe/parametres).
  const [logosParTerritoire, setLogosParTerritoire] = useState<Record<string, string[]>>({});
  const [logosParId, setLogosParId] = useState<Map<string, any>>(new Map());

  // Lien pré-rempli pour campagnes d'emailing : .../prfe?parcours=... —
  // comparaison insensible aux accents/casse pour rester tolérant, appliquée
  // une seule fois pour ne pas écraser un choix fait ensuite manuellement.
  useEffect(() => {
    if (parcoursPreselectionneApplique.current) return;
    const parametreParcours = searchParams.get("parcours");
    if (!parametreParcours) return;
    const cible = normaliser(parametreParcours);
    const trouve = parcoursListe.find((p) => normaliser(p.id) === cible || normaliser(p.label).includes(cible));
    if (trouve) {
      setFormData((prev) => ({ ...prev, parcours: trouve.id }));
      parcoursPreselectionneApplique.current = true;
    }
  }, [searchParams, parcoursListe]);

  // Détection automatique QPV à partir de l'adresse tapée (voir
  // app/api/verifier-qpv/route.ts) : ne fait que pré-remplir/suggérer une
  // valeur pour le champ "Réside en QPV ?", qui reste éditable — aucune
  // garantie à 100% (géocodage approximatif possible).
  const [verificationQpv, setVerificationQpv] = useState<"idle" | "chargement" | "fait" | "erreur">("idle");
  const [messageQpv, setMessageQpv] = useState<string | null>(null);

  const verifierQpv = async () => {
    if (!formData.adressePostale || !formData.codePostal || !formData.ville) return;
    setVerificationQpv("chargement");
    setMessageQpv(null);
    try {
      const reponse = await fetch("/api/verifier-qpv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adresse: formData.adressePostale, codePostal: formData.codePostal, ville: formData.ville }),
      });
      const data = await reponse.json();
      if (!reponse.ok || !data.trouve) {
        setVerificationQpv("erreur");
        setMessageQpv("Adresse non reconnue, merci de renseigner ce champ manuellement.");
        return;
      }
      setFormData((prev) => ({ ...prev, qpv: data.enQPV ? "Oui" : "Non" }));
      setVerificationQpv("fait");
      setMessageQpv(data.enQPV ? `Adresse détectée en QPV (${data.nomQPV || "quartier prioritaire"}) — vérifiez et corrigez si besoin.` : "Adresse détectée hors QPV — vérifiez et corrigez si besoin.");
    } catch {
      setVerificationQpv("erreur");
      setMessageQpv("Vérification indisponible, merci de renseigner ce champ manuellement.");
    }
  };

  // Visuels "programme" par parcours, affichés automatiquement sous le
  // choix de session (voir .../prfe/parametres pour la gestion).
  const [programmes, setProgrammes] = useState<Record<string, { storagePath: string; url: string }[]>>({});

  useEffect(() => {
    const charger = async () => {
      const [snapSessions, snapParcours, snapTerritoires, snapLogosFormulaire, snapProgrammes] = await Promise.all([
        getDoc(doc(db, "configuration_prfe", "sessions")),
        getDoc(doc(db, "configuration_prfe", "parcours")),
        getDoc(doc(db, "configuration_prfe", "territoires")),
        getDoc(doc(db, "configuration_prfe", "logosFormulaire")),
        getDoc(doc(db, "configuration_prfe", "programmes")),
      ]);
      if (snapProgrammes.exists()) {
        setProgrammes(snapProgrammes.data().parParcours || {});
      }
      if (snapSessions.exists()) {
        setSessions(snapSessions.data().parTerritoire || {});
      }
      if (snapParcours.exists() && Array.isArray(snapParcours.data().liste) && snapParcours.data().liste.length > 0) {
        setParcoursListe(snapParcours.data().liste);
      }
      if (snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0) {
        setTerritoiresListe(snapTerritoires.data().liste);
      }
      if (snapLogosFormulaire.exists()) {
        const data = snapLogosFormulaire.data();
        let parTerritoire: Record<string, string[]> = data.parTerritoire && typeof data.parTerritoire === "object" ? data.parTerritoire : {};
        if (Object.keys(parTerritoire).length === 0 && Array.isArray(data.logoIds) && data.logoIds.length > 0) {
          const territoiresConnus = snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0
            ? snapTerritoires.data().liste
            : TERRITOIRES_DEFAUT;
          parTerritoire = Object.fromEntries(territoiresConnus.map((t: string) => [t, data.logoIds]));
        }
        setLogosParTerritoire(parTerritoire);
        if (Object.values(parTerritoire).some((liste) => liste.length > 0)) {
          const snapLogos = await getDocs(collection(db, "logos_emargement"));
          setLogosParId(new Map(snapLogos.docs.map((d) => [d.id, { id: d.id, ...d.data() } as any])));
        }
      }
    };
    charger();
  }, []);

  const logos = (logosParTerritoire[formData.territoire] || []).map((id) => logosParId.get(id)).filter(Boolean);

  const sessionsDisponibles = (sessions[formData.parcours]?.[formData.territoire] || []).filter(sessionEstAVenir);

  // Territoire choisi en premier (étape 1) : le choix du parcours (étape 2)
  // ne propose ensuite que ceux ayant au moins une session à venir pour ce
  // territoire, plutôt que la liste complète peu importe la pertinence.
  const parcoursDisponibles = parcoursListe.filter((p) =>
    (sessions[p.id]?.[formData.territoire] || []).some(sessionEstAVenir)
  );

  // Si le territoire change et que le parcours actuellement choisi n'a plus
  // de session à venir dessus, on retombe sur le premier parcours encore
  // disponible (et on efface la session, forcément obsolète).
  useEffect(() => {
    if (parcoursDisponibles.length === 0) return;
    if (!parcoursDisponibles.some((p) => p.id === formData.parcours)) {
      setFormData((prev) => ({ ...prev, parcours: parcoursDisponibles[0].id, session: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.territoire, sessions]);

  const ageCalcule = calculerAge(formData.dateNaissance);

  const validerEtape = (numero: number): string | null => {
    if (numero === 1) {
      if (!formData.territoire) return "Merci de sélectionner un territoire.";
    }
    if (numero === 2) {
      if (!formData.parcours) return "Merci de sélectionner un parcours.";
      if (!formData.session) return "Merci de sélectionner une session.";
    }
    if (numero === 3) {
      if (!formData.nom || !formData.prenom || !formData.telephone || !formData.email) return "Merci de compléter le nom, prénom, téléphone et email.";
      if (!formData.adressePostale || !formData.codePostal || !formData.ville) return "Merci de compléter l'adresse complète.";
      if (!formData.dateNaissance) return "Merci de renseigner votre date de naissance.";
    }
    return null;
  };

  const etapeSuivante = () => {
    const err = validerEtape(etape);
    setErreur(err);
    if (err) return;
    setEtape((e) => Math.min(e + 1, TOTAL_ETAPES));
  };

  const etapePrecedente = () => { setErreur(null); setEtape((e) => Math.max(e - 1, 1)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rgpd) {
      setErreur("Le consentement RGPD est obligatoire pour enregistrer votre inscription.");
      return;
    }
    if (!formData.session) {
      setErreur("Merci de sélectionner une session.");
      return;
    }

    setErreur(null);

    // Piège/délai anti-bot : on affiche le message de succès normalement
    // (pour ne pas indiquer à un bot qu'il a été détecté) sans rien
    // enregistrer. Un vrai visiteur ne passe jamais par ici.
    const dureeRemplissageMs = Date.now() - debutRemplissage;
    if (piege.trim() !== "" || dureeRemplissageMs < 4000) {
      setEnvoye(true);
      return;
    }

    setEnvoiEnCours(true);
    try {
      await addDoc(collection(db, "inscriptions_prfe"), {
        _piege: piege,
        _dureeRemplissageMs: dureeRemplissageMs,
        Civilité: formData.civilite,
        Nom: formatNom(formData.nom),
        Prénom: formatPrenom(formData.prenom),
        Téléphone: formatPhoneForStorage(formData.telephone),
        Email: formData.email,
        Adresse_Postale: formData.adressePostale,
        Code_Postal: formData.codePostal,
        Ville: formData.ville,
        QPV: formData.qpv,
        Date_Naissance: formData.dateNaissance,
        Age: ageCalcule ?? "",
        Situation_Handicap: formData.situationHandicap,
        RQTH: formData.rqth,
        RSA: formData.rsa,
        Niveau_Etudes: formData.niveauEtudes === "Autre" ? formData.niveauEtudesAutre : formData.niveauEtudes,
        France_Travail: formData.franceTravail,
        Identifiant_France_Travail: formData.franceTravail === "Oui" ? formData.identifiantFranceTravail : "",
        Formation_Certifiante_Recente: formData.formationCertifianteRecente,
        Informe_Formation_TIP: formData.informeFormationTIP,
        Disponible_Dates_Session: formData.disponibleDatesSession,
        Structure_Accompagnement: formData.structureAccompagnement,
        Conseiller_Nom: formatNom(formData.conseillerNom),
        Conseiller_Prenom: formatPrenom(formData.conseillerPrenom),
        Conseiller_Email: formData.conseillerEmail,
        Conseiller_Telephone: formatPhoneForStorage(formData.conseillerTelephone),
        Parcours: parcoursListe.find((p) => p.id === formData.parcours)?.label || formData.parcours,
        Metier_Souhaite: formData.metierSouhaite,
        Territoire: formData.territoire,
        Session: formData.session,
        RGPD: formData.rgpd,
        createdAt: serverTimestamp(),
      });

      setEnvoye(true);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de l'inscription Préparation Parcours Métiers :", error);
      setErreur("Une erreur est survenue lors de l'enregistrement. Merci de réessayer dans quelques instants.");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] font-medium antialiased`}>
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">

        {/* EN-TÊTE — logo Colombbus + partenaires choisis dans la bibliothèque */}
        <div className="flex flex-col items-center text-center mb-8 gap-4">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="relative h-14 w-14">
              <Image src="/logos/Logo_Colombbus_noir_trans.png" alt="Colombbus" fill sizes="56px" className="object-contain" priority />
            </div>
            {logos.map((logo) => (
              <div key={logo.id} className="relative h-12 w-24">
                <Image src={logo.url} alt={logo.nom} fill sizes="96px" className="object-contain" unoptimized />
              </div>
            ))}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase text-[#005259] tracking-tight">
              Préparation Parcours <span className="text-[#EA601F]">Métiers</span>
            </h1>
            <p className="text-sm text-[#404040]/70 mt-1">Formulaire de pré-inscription</p>
          </div>
        </div>

        {envoye ? (
          <div className="bg-white border border-[#404040]/10 rounded-3xl p-8 shadow-sm text-center space-y-3">
            <CheckCircleIcon className="w-12 h-12 text-[#A9E0C9] mx-auto" />
            <h2 className="text-lg font-black uppercase text-[#005259]">Inscription envoyée !</h2>
            <p className="text-sm text-[#404040]/70">
              Merci {formData.prenom} — votre pré-inscription a bien été enregistrée. Notre équipe vous recontactera prochainement.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#404040]/10 rounded-3xl p-5 sm:p-8 shadow-sm space-y-6">

            {/* RGPD */}
            <div className="bg-[#88ACEA]/10 border border-[#88ACEA]/40 rounded-xl p-3 text-[11px] text-[#404040] space-y-1">
              <p>Les données recueillies dans ce formulaire font l'objet d'un traitement informatique destiné à l'inscription à l'action Préparation Parcours Métiers organisée par l'association Colombbus, en conformité avec la loi RGPD 2018.</p>
              <p>Responsable du traitement : Colombbus, 10 rue du Terrage, 75010 Paris. Données conservées 2 ans puis supprimées ou anonymisées. Vous pouvez à tout moment retirer votre consentement, accéder à vos données, demander leur rectification/suppression ou exercer votre droit à la limitation/opposition en écrivant à contact@colombbus.org.</p>
            </div>

            {/* PROGRESSION */}
            <div className="flex items-center gap-2">
              {Array.from({ length: TOTAL_ETAPES }, (_, i) => i + 1).map((n) => (
                <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= etape ? "bg-[#005259]" : "bg-[#404040]/10"}`}></div>
              ))}
              <span className="shrink-0 text-[10px] font-bold text-[#404040]/60 uppercase tracking-wider ml-1">{etape}/{TOTAL_ETAPES}</span>
            </div>

            {erreur && (
              <div className="bg-[#EF736A]/10 border border-[#EF736A]/30 text-[#EF736A] text-xs font-bold rounded-xl p-3">
                {erreur}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Champ piège anti-bot : invisible et hors du parcours au
                  clavier pour un vrai visiteur, mais que les robots
                  remplissent souvent automatiquement en scannant le
                  formulaire (voir handleSubmit). */}
              <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
                <label htmlFor="site-web">Site web</label>
                <input
                  id="site-web"
                  type="text"
                  name="site-web"
                  tabIndex={-1}
                  autoComplete="off"
                  value={piege}
                  onChange={(e) => setPiege(e.target.value)}
                />
              </div>

              {/* ÉTAPE 1 — TERRITOIRE */}
              {etape === 1 && (
              <div className="space-y-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Votre territoire</h2>
                <div>
                  <label className={labelClass}>Dans quel département résidez-vous ? *</label>
                  <select required value={formData.territoire} onChange={(e) => setFormData({ ...formData, territoire: e.target.value, session: "" })} className={inputClass}>
                    {territoiresListe.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <p className="text-[10px] text-[#404040]/50 italic">Les parcours et sessions proposés ensuite dépendent de votre territoire.</p>

                <div className="flex justify-end pt-2 border-t border-[#404040]/10">
                  <button type="button" onClick={etapeSuivante} className="px-5 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">
                    Suivant
                  </button>
                </div>
              </div>
              )}

              {/* ÉTAPE 2 — PARCOURS & SESSION */}
              {etape === 2 && (
              <div className="space-y-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Parcours souhaité</h2>
                {parcoursDisponibles.length === 0 ? (
                  <p className="text-xs text-[#EF736A] font-bold">Aucune session à venir n'est actuellement programmée pour le territoire {formData.territoire}.</p>
                ) : (
                  <>
                    <div>
                      <label className={labelClass}>Sur quel parcours de formation souhaitez-vous vous préinscrire ? *</label>
                      <select required value={formData.parcours} onChange={(e) => setFormData({ ...formData, parcours: e.target.value, session: "" })} className={inputClass}>
                        {parcoursDisponibles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Session souhaitée *</label>
                      <select required value={formData.session} onChange={(e) => setFormData({ ...formData, session: e.target.value })} className={inputClass}>
                        <option value="">-- Choisir une session --</option>
                        {sessionsDisponibles.map((s) => <option key={s} value={s}>{s}</option>)}
                        <option value={SESSION_AUCUNE_CONVIENT}>{SESSION_AUCUNE_CONVIENT}</option>
                      </select>
                    </div>

                    {(programmes[formData.parcours] || []).length > 0 && (
                      <div className="space-y-3">
                        <span className={labelClass}>Programme</span>
                        {programmes[formData.parcours].map((img) => (
                          <img key={img.storagePath} src={img.url} alt="Programme" className="w-full h-auto rounded-xl border border-[#404040]/10" />
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-between pt-2 border-t border-[#404040]/10">
                  <button type="button" onClick={etapePrecedente} className="px-5 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
                    Précédent
                  </button>
                  <button type="button" onClick={etapeSuivante} disabled={parcoursDisponibles.length === 0} className="px-5 py-2 bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">
                    Suivant
                  </button>
                </div>
              </div>
              )}

              {/* ÉTAPE 3 — IDENTITÉ */}
              {etape === 3 && (
              <div className="space-y-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Votre identité</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Civilité *</label>
                    <select required value={formData.civilite} onChange={(e) => setFormData({ ...formData, civilite: e.target.value })} className={inputClass}>
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Nom *</label>
                    <input required type="text" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className={inputClass} placeholder="DUPONT" />
                  </div>
                  <div>
                    <label className={labelClass}>Prénom *</label>
                    <input required type="text" value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} className={inputClass} placeholder="Jean" />
                  </div>
                  <div>
                    <label className={labelClass}>Téléphone *</label>
                    <input required type="tel" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} className={inputClass} placeholder="06 12 34 56 78" />
                  </div>
                  <div>
                    <label className={labelClass}>Date de naissance *</label>
                    <input required type="date" value={formData.dateNaissance} onChange={(e) => setFormData({ ...formData, dateNaissance: e.target.value })} className={inputClass} />
                    {ageCalcule !== null && <p className="mt-1 text-[10px] text-[#404040]/50">→ {ageCalcule} ans</p>}
                  </div>
                  <div className="sm:col-span-3">
                    <label className={labelClass}>Email *</label>
                    <input required type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} placeholder="vous@email.com" />
                  </div>
                  <div className="sm:col-span-3">
                    <label className={labelClass}>Adresse postale *</label>
                    <input required type="text" value={formData.adressePostale} onChange={(e) => setFormData({ ...formData, adressePostale: e.target.value })} className={inputClass} placeholder="12 rue de la Paix" />
                  </div>
                  <div>
                    <label className={labelClass}>Code postal *</label>
                    <input required type="text" value={formData.codePostal} onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })} className={inputClass} placeholder="91000" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Ville de résidence *</label>
                    <input required type="text" value={formData.ville} onChange={(e) => setFormData({ ...formData, ville: e.target.value })} onBlur={verifierQpv} className={inputClass} placeholder="Évry-Courcouronnes" />
                  </div>
                  <div className="sm:col-span-3">
                    <label className={labelClass}>Résidez-vous en QPV ?</label>
                    <div className="flex items-center gap-3">
                      <select value={formData.qpv} onChange={(e) => setFormData({ ...formData, qpv: e.target.value })} className={inputClass}>
                        <option value="Oui">Oui</option>
                        <option value="Non">Non</option>
                        <option value="Je ne sais pas">Je ne sais pas</option>
                      </select>
                      <button type="button" onClick={verifierQpv} disabled={verificationQpv === "chargement"} className="shrink-0 px-3 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/15 text-[#005259] rounded-xl text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-50 cursor-pointer">
                        {verificationQpv === "chargement" ? "Vérification..." : "Vérifier automatiquement"}
                      </button>
                    </div>
                    {messageQpv && <p className="mt-1 text-xs text-[#404040]/70">{messageQpv}</p>}
                  </div>
                </div>

                <div className="flex justify-between pt-2 border-t border-[#404040]/10">
                  <button type="button" onClick={etapePrecedente} className="px-5 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
                    Précédent
                  </button>
                  <button type="button" onClick={etapeSuivante} className="px-5 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">
                    Suivant
                  </button>
                </div>
              </div>
              )}

              {/* ÉTAPE 4 — SITUATION */}
              {etape === 4 && (
              <div className="space-y-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Votre situation</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>En situation de handicap ?</label>
                    <select value={formData.situationHandicap} onChange={(e) => setFormData({ ...formData, situationHandicap: e.target.value })} className={inputClass}>
                      <option value="Oui">Oui</option>
                      <option value="Non">Non</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Reconnu.e RQTH ?</label>
                    <select value={formData.rqth} onChange={(e) => setFormData({ ...formData, rqth: e.target.value })} className={inputClass}>
                      <option value="Oui">Oui</option>
                      <option value="Non">Non</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Bénéficiaire du RSA ?</label>
                    <select value={formData.rsa} onChange={(e) => setFormData({ ...formData, rsa: e.target.value })} className={inputClass}>
                      <option value="Oui">Oui</option>
                      <option value="Non">Non</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Niveau d'études</label>
                    <select value={formData.niveauEtudes} onChange={(e) => setFormData({ ...formData, niveauEtudes: e.target.value })} className={inputClass}>
                      {NIVEAUX_ETUDES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {formData.niveauEtudes === "Autre" && (
                      <input
                        type="text"
                        value={formData.niveauEtudesAutre}
                        onChange={(e) => setFormData({ ...formData, niveauEtudesAutre: e.target.value })}
                        placeholder="Préciser le niveau d'études"
                        className={`${inputClass} mt-2`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Inscrit.e à France Travail ?</label>
                    <select value={formData.franceTravail} onChange={(e) => setFormData({ ...formData, franceTravail: e.target.value })} className={inputClass}>
                      <option value="Oui">Oui</option>
                      <option value="Non">Non</option>
                      <option value="Inscription en cours">Inscription en cours</option>
                    </select>
                  </div>
                  {formData.franceTravail === "Oui" && (
                    <div>
                      <label className={labelClass}>Identifiant France Travail</label>
                      <input type="text" value={formData.identifiantFranceTravail} onChange={(e) => setFormData({ ...formData, identifiantFranceTravail: e.target.value })} className={inputClass} />
                    </div>
                  )}
                  <div>
                    <label className={labelClass}>Formation certifiante suivie ces 12 derniers mois ?</label>
                    <select value={formData.formationCertifianteRecente} onChange={(e) => setFormData({ ...formData, formationCertifianteRecente: e.target.value })} className={inputClass}>
                      <option value="Oui">Oui</option>
                      <option value="Non">Non</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Informé·e que cette formation mène vers le titre professionnel TIP (technicien informatique de proximité) ?</label>
                    <select value={formData.informeFormationTIP} onChange={(e) => setFormData({ ...formData, informeFormationTIP: e.target.value })} className={inputClass}>
                      <option value="Oui">Oui</option>
                      <option value="Non">Non</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Disponible pour intégrer la formation aux dates de la session choisie ?</label>
                    <select value={formData.disponibleDatesSession} onChange={(e) => setFormData({ ...formData, disponibleDatesSession: e.target.value })} className={inputClass}>
                      <option value="Oui">Oui</option>
                      <option value="Non">Non</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Quelle est votre structure d'accompagnement ?</label>
                  <input
                    type="text"
                    value={formData.structureAccompagnement}
                    onChange={(e) => setFormData({ ...formData, structureAccompagnement: e.target.value })}
                    placeholder="Ex : Mission locale de Paris, France Travail, PLIE, E2C..."
                    className={inputClass}
                  />
                </div>

                <div className="flex justify-between pt-2 border-t border-[#404040]/10">
                  <button type="button" onClick={etapePrecedente} className="px-5 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
                    Précédent
                  </button>
                  <button type="button" onClick={etapeSuivante} className="px-5 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">
                    Suivant
                  </button>
                </div>
              </div>
              )}

              {/* ÉTAPE 5 — CONSEILLER RÉFÉRENT (saisie libre, pas d'autocomplétion
                  publique sur l'annuaire interne des prescripteurs) */}
              {etape === 5 && (
              <div className="space-y-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Conseiller.e référent.e (si applicable)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Nom du/de la conseiller.e</label>
                    <input type="text" value={formData.conseillerNom} onChange={(e) => setFormData({ ...formData, conseillerNom: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Prénom du/de la conseiller.e</label>
                    <input type="text" value={formData.conseillerPrenom} onChange={(e) => setFormData({ ...formData, conseillerPrenom: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Email du/de la conseiller.e</label>
                    <input type="email" value={formData.conseillerEmail} onChange={(e) => setFormData({ ...formData, conseillerEmail: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Téléphone du/de la conseiller.e</label>
                    <input type="tel" value={formData.conseillerTelephone} onChange={(e) => setFormData({ ...formData, conseillerTelephone: e.target.value })} className={inputClass} />
                  </div>
                </div>

                <div className="flex justify-between pt-2 border-t border-[#404040]/10">
                  <button type="button" onClick={etapePrecedente} className="px-5 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
                    Précédent
                  </button>
                  <button type="button" onClick={etapeSuivante} className="px-5 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">
                    Suivant
                  </button>
                </div>
              </div>
              )}

              {/* ÉTAPE 6 — PROJET & CONSENTEMENT */}
              {etape === 6 && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Quel métier ou domaine professionnel souhaitez-vous exercer ?</label>
                  <textarea value={formData.metierSouhaite} onChange={(e) => setFormData({ ...formData, metierSouhaite: e.target.value })} rows={3} className={inputClass} />
                </div>

                <label className="flex items-start gap-2.5 text-xs text-[#404040] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.rgpd}
                    onChange={(e) => setFormData({ ...formData, rgpd: e.target.checked })}
                    className="mt-0.5 w-4 h-4 accent-[#005259] cursor-pointer"
                  />
                  <span>J'autorise le traitement des données collectées en conformité avec la loi RGPD 2018. *</span>
                </label>

                <div className="flex justify-between pt-2 border-t border-[#404040]/10">
                  <button type="button" onClick={etapePrecedente} className="px-5 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
                    Précédent
                  </button>
                  <button
                    type="submit"
                    disabled={envoiEnCours}
                    className="px-6 py-2.5 bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md"
                  >
                    {envoiEnCours ? "Enregistrement..." : "Envoyer mon inscription"}
                  </button>
                </div>
              </div>
              )}
            </form>
          </div>
        )}

        <p className="text-center text-[10px] text-[#404040]/40 mt-8">Plateforme C.O.S.M.O.S. — Colombbus</p>
      </div>
    </main>
  );
}

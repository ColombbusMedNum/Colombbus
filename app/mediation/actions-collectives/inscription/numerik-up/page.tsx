"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { useToast } from "@/components/ToastProvider";
import { usePermissions } from "@/lib/PermissionsProvider";
import PrescripteurAutocomplete from "@/components/PrescripteurAutocomplete";
import { chargerPrescripteurs, upsertPrescripteur } from "@/lib/prescripteurs";
import { formatNom, formatPrenom } from "@/lib/formatName";
import { formatPhoneForStorage } from "@/lib/formatPhone";

interface Parcours {
  id: string;
  label: string;
}

const PARCOURS_DEFAUT: Parcours[] = [
  { id: "crea", label: "Numérik'Up Créa : Game Design + Graphisme" },
  { id: "tech", label: "Numérik'Up Tech : Développement Web + Maintenance informatique" },
];

// Les dates de session varient selon le territoire (département) : chaque
// parkours a donc ses propres sessions par territoire, pas une liste unique.
const TERRITOIRES_DEFAUT = ["91", "92", "Autres"];

const TRANCHES_AGE = ["16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "+ de 26 ans"];

const NIVEAUX_ETUDES = [
  "Brevet, CAP, BEP",
  "Bac",
  "Bac+2 (L2, BTS, DUT, DEUST)",
  "Bac+3 (Licence, licence professionnelle)",
  "Bac+4/5 et plus",
];

const STRUCTURES = [
  "Mission locale",
  "E2C (Ecole de la deuxième chance)",
  "Pôle Emploi",
  "PLIE",
  "Epide",
  "PJJ",
  "Aucune",
];

const CANAUX_CONNAISSANCE = [
  "Mission locale / conseiller.e",
  "Bouche à oreille",
  "Email",
  "Site (www.colombbus.org)",
  "Réseaux sociaux (Facebook, Twitter, LinkedIn)",
  "Autre",
];

const inputClass = "w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] placeholder-[#404040]/40 outline-none font-medium transition-colors";
const labelClass = "block text-[11px] font-bold text-[#404040]/70 uppercase tracking-wide mb-1";

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
  age: "",
  neet: "Non",
  cej: "Non",
  situationPlus26: "",
  rsa: "Non",
  rqth: "Non",
  niveauEtudes: NIVEAUX_ETUDES[0],
  structures: [] as string[],
  structureAutre: "",
  ase: "Non",
  conseillerNom: "",
  conseillerPrenom: "",
  conseillerEmail: "",
  conseillerTelephone: "",
  commentConnu: CANAUX_CONNAISSANCE[0],
  commentConnuAutre: "",
  parcours: "crea",
  territoire: "91",
  session: "",
  rgpd: false,
};

export default function FormulaireNumerikUpPage() {
  const { showToast } = useToast();
  const { role } = usePermissions();
  const [formData, setFormData] = useState(FORM_VIDE);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [etape, setEtape] = useState(1);
  const TOTAL_ETAPES = 5;

  // Parkours, territoires et sessions sont gérés depuis une page dédiée
  // (voir .../numerik-up/parametres, réservée à l'admin) — ce formulaire ne
  // fait que les lire.
  const [parcoursListe, setParcoursListe] = useState<Parcours[]>(PARCOURS_DEFAUT);
  const [territoiresListe, setTerritoiresListe] = useState<string[]>(TERRITOIRES_DEFAUT);
  // sessions[parcoursId][territoire] = liste de dates de session.
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});

  useEffect(() => {
    const charger = async () => {
      const [snapSessions, snapParcours, snapTerritoires] = await Promise.all([
        getDoc(doc(db, "configuration_numerikup", "sessions")),
        getDoc(doc(db, "configuration_numerikup", "parcours")),
        getDoc(doc(db, "configuration_numerikup", "territoires")),
      ]);
      if (snapSessions.exists()) {
        setSessions(snapSessions.data().parTerritoire || {});
      }
      if (snapParcours.exists() && Array.isArray(snapParcours.data().liste) && snapParcours.data().liste.length > 0) {
        setParcoursListe(snapParcours.data().liste);
      }
      if (snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0) {
        setTerritoiresListe(snapTerritoires.data().liste);
      }
    };
    charger();
  }, []);

  const sessionsDisponibles = sessions[formData.parcours]?.[formData.territoire] || [];

  const toggleStructure = (structure: string) => {
    setFormData((prev) => ({
      ...prev,
      structures: prev.structures.includes(structure)
        ? prev.structures.filter((s) => s !== structure)
        : [...prev.structures, structure],
    }));
  };

  // Validation minimale avant de passer à l'étape suivante — évite d'arriver
  // au bout du formulaire avec des champs obligatoires vides sans s'en rendre
  // compte, tout en restant tolérant sur les champs facultatifs.
  const validerEtape = (numero: number): string | null => {
    if (numero === 1) {
      if (!formData.territoire) return "Merci de sélectionner un territoire.";
      if (!formData.session) return "Merci de sélectionner une session.";
    }
    if (numero === 2) {
      if (!formData.nom || !formData.prenom || !formData.telephone || !formData.email) return "Merci de compléter le nom, prénom, téléphone et email.";
      if (!formData.adressePostale || !formData.codePostal || !formData.ville) return "Merci de compléter l'adresse complète.";
      if (!formData.age) return "Merci de renseigner l'âge du / de la participant.e.";
    }
    return null;
  };

  const etapeSuivante = () => {
    const erreur = validerEtape(etape);
    if (erreur) {
      showToast(erreur, "error");
      return;
    }
    setEtape((e) => Math.min(e + 1, TOTAL_ETAPES));
  };

  const etapePrecedente = () => setEtape((e) => Math.max(e - 1, 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rgpd) {
      showToast("Le consentement RGPD est obligatoire pour enregistrer l'inscription.", "error");
      return;
    }
    if (!formData.session) {
      showToast("Merci de sélectionner une session.", "error");
      return;
    }

    setEnvoiEnCours(true);
    try {
      await addDoc(collection(db, "inscriptions_numerikup"), {
        Civilité: formData.civilite,
        Nom: formatNom(formData.nom),
        Prénom: formatPrenom(formData.prenom),
        Téléphone: formatPhoneForStorage(formData.telephone),
        Email: formData.email,
        Adresse_Postale: formData.adressePostale,
        Code_Postal: formData.codePostal,
        Ville: formData.ville,
        QPV: formData.qpv,
        Age: formData.age,
        NEET: formData.neet,
        CEJ: formData.cej,
        Situation_Plus_26: formData.age === "+ de 26 ans" ? formData.situationPlus26 : "",
        RSA: formData.rsa,
        RQTH: formData.rqth,
        Niveau_Etudes: formData.niveauEtudes,
        Structures_Accompagnement: formData.structures,
        Structure_Autre: formData.structureAutre,
        ASE: formData.ase,
        Conseiller_Nom: formatNom(formData.conseillerNom),
        Conseiller_Prenom: formatPrenom(formData.conseillerPrenom),
        Conseiller_Email: formData.conseillerEmail,
        Conseiller_Telephone: formatPhoneForStorage(formData.conseillerTelephone),
        Comment_Connu: formData.commentConnu === "Autre" ? formData.commentConnuAutre : formData.commentConnu,
        Parcours: parcoursListe.find((p) => p.id === formData.parcours)?.label || formData.parcours,
        Territoire: formData.territoire,
        Session: formData.session,
        RGPD: formData.rgpd,
        createdAt: serverTimestamp(),
      });

      try {
        const prescripteurs = await chargerPrescripteurs();
        await upsertPrescripteur(prescripteurs, {
          referentPrenom: formatPrenom(formData.conseillerPrenom),
          referentNom: formatNom(formData.conseillerNom),
          referentTelephone: formatPhoneForStorage(formData.conseillerTelephone),
          referentEmail: formData.conseillerEmail,
        });
      } catch (error) {
        console.error("Erreur lors de la mise à jour de l'annuaire des prescripteurs :", error);
      }

      showToast("Inscription enregistrée avec succès.", "success");
      setFormData(FORM_VIDE);
      setEtape(1);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de l'inscription Numérik'Up :", error);
      showToast("Une erreur est survenue lors de l'enregistrement.", "error");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-3xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Formulaire <span className="text-[#EA601F] font-semibold">Numérik'UP</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Pré-inscription au parcours Numérik'Up
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Link
              href="/mediation/actions-collectives/reponses/numerik-up"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Réponses</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
            {role === "admin" && (
              <Link
                href="/mediation/actions-collectives/inscription/numerik-up/parametres"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <Cog6ToothIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Gérer</span>
              </Link>
            )}
          </div>
        </div>

        {/* RGPD */}
        <div className="bg-[#88ACEA]/10 border border-[#88ACEA]/40 rounded-xl p-3 text-[11px] text-[#404040]">
          Les données recueillies dans ce formulaire font l'objet d'un traitement informatique destiné à l'inscription à l'action Parkour Numérik'Up organisée par l'association Colombbus, en conformité avec la loi RGPD 2018.
        </div>

        {/* PROGRESSION */}
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_ETAPES }, (_, i) => i + 1).map((n) => (
            <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= etape ? "bg-[#005259]" : "bg-[#404040]/10"}`}></div>
          ))}
          <span className="shrink-0 text-[10px] font-bold text-[#404040]/60 uppercase tracking-wider ml-1">{etape}/{TOTAL_ETAPES}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ÉTAPE 1 — PARCOURS & SESSION */}
          {etape === 1 && (
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Parcours souhaité</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Quel type de Parkour Numérik'Up vous intéresse ? *</label>
                <select
                  required
                  value={formData.parcours}
                  onChange={(e) => setFormData({ ...formData, parcours: e.target.value, session: "" })}
                  className={inputClass}
                >
                  {parcoursListe.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Territoire *</label>
                <select
                  required
                  value={formData.territoire}
                  onChange={(e) => setFormData({ ...formData, territoire: e.target.value, session: "" })}
                  className={inputClass}
                >
                  {territoiresListe.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Session souhaitée *</label>
                <select
                  required
                  value={formData.session}
                  onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                  className={inputClass}
                >
                  <option value="">-- Choisir une session --</option>
                  {sessionsDisponibles.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-[#404040]/50 italic">Les dates de session dépendent du territoire (département) du / de la participant.e.</p>

            <div className="flex justify-end pt-2 border-t border-[#404040]/10">
              <button type="button" onClick={etapeSuivante} className="px-5 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">
                Suivant
              </button>
            </div>
          </div>
          )}

          {/* ÉTAPE 2 — IDENTITÉ */}
          {etape === 2 && (
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Identité du / de la participant.e</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Civilité *</label>
                <select required value={formData.civilite} onChange={(e) => setFormData({ ...formData, civilite: e.target.value })} className={inputClass}>
                  <option value="M.">M.</option>
                  <option value="Mme">Mme</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Nom (majuscules) *</label>
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
                <label className={labelClass}>Email *</label>
                <input required type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} placeholder="participant@email.com" />
              </div>
              <div>
                <label className={labelClass}>Âge *</label>
                <select required value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} className={inputClass}>
                  <option value="">--</option>
                  {TRANCHES_AGE.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Adresse postale *</label>
                <input required type="text" value={formData.adressePostale} onChange={(e) => setFormData({ ...formData, adressePostale: e.target.value })} className={inputClass} placeholder="12 rue de la Paix" />
              </div>
              <div>
                <label className={labelClass}>Code postal *</label>
                <input required type="text" value={formData.codePostal} onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })} className={inputClass} placeholder="91000" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Ville de résidence *</label>
                <input required type="text" value={formData.ville} onChange={(e) => setFormData({ ...formData, ville: e.target.value })} className={inputClass} placeholder="Évry-Courcouronnes" />
              </div>
              <div>
                <label className={labelClass}>Réside en QPV ?</label>
                <select value={formData.qpv} onChange={(e) => setFormData({ ...formData, qpv: e.target.value })} className={inputClass}>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                  <option value="Je ne sais pas">Je ne sais pas</option>
                </select>
              </div>
            </div>

            {formData.age === "+ de 26 ans" && (
              <div>
                <label className={labelClass}>Merci de préciser la situation du / de la participant.e (+ de 26 ans)</label>
                <textarea value={formData.situationPlus26} onChange={(e) => setFormData({ ...formData, situationPlus26: e.target.value })} rows={2} className={inputClass} />
              </div>
            )}

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

          {/* ÉTAPE 3 — SITUATION */}
          {etape === 3 && (
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Situation du / de la participant.e</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>N.E.E.T (ni étudiant.e, ni employé.e, ni stagiaire) ?</label>
                <select value={formData.neet} onChange={(e) => setFormData({ ...formData, neet: e.target.value })} className={inputClass}>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Accompagné.e par le CEJ ?</label>
                <select value={formData.cej} onChange={(e) => setFormData({ ...formData, cej: e.target.value })} className={inputClass}>
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
                <label className={labelClass}>Reconnu.e RQTH ?</label>
                <select value={formData.rqth} onChange={(e) => setFormData({ ...formData, rqth: e.target.value })} className={inputClass}>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Accompagné.e par l'ASE ?</label>
                <select value={formData.ase} onChange={(e) => setFormData({ ...formData, ase: e.target.value })} className={inputClass}>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Niveau d'études</label>
                <select value={formData.niveauEtudes} onChange={(e) => setFormData({ ...formData, niveauEtudes: e.target.value })} className={inputClass}>
                  {NIVEAUX_ETUDES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Structure(s) d'accompagnement</label>
              <div className="flex flex-wrap gap-2">
                {STRUCTURES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStructure(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      formData.structures.includes(s)
                        ? "bg-[#005259] text-white border-[#005259]"
                        : "bg-[#F3F3F2] text-[#404040] border-[#404040]/10 hover:border-[#005259]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.structureAutre}
                onChange={(e) => setFormData({ ...formData, structureAutre: e.target.value })}
                placeholder="Autre structure (préciser)"
                className={`${inputClass} mt-2`}
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

          {/* ÉTAPE 4 — CONSEILLER RÉFÉRENT */}
          {etape === 4 && (
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Conseiller.e référent.e</h2>
            <PrescripteurAutocomplete
              prenom={formData.conseillerPrenom}
              nom={formData.conseillerNom}
              telephone={formData.conseillerTelephone}
              email={formData.conseillerEmail}
              onChange={({ prenom, nom, telephone, email }) => setFormData({ ...formData, conseillerPrenom: prenom, conseillerNom: nom, conseillerTelephone: telephone, conseillerEmail: email })}
              inputClass={inputClass}
              labelClass={labelClass}
            />

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

          {/* ÉTAPE 5 — ORIGINE & CONSENTEMENT */}
          {etape === 5 && (
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <label className={labelClass}>Comment avez-vous connu l'action Numérik'Up ?</label>
              <select value={formData.commentConnu} onChange={(e) => setFormData({ ...formData, commentConnu: e.target.value })} className={inputClass}>
                {CANAUX_CONNAISSANCE.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {formData.commentConnu === "Autre" && (
                <input
                  type="text"
                  value={formData.commentConnuAutre}
                  onChange={(e) => setFormData({ ...formData, commentConnuAutre: e.target.value })}
                  placeholder="Préciser"
                  className={`${inputClass} mt-2`}
                />
              )}
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
                {envoiEnCours ? "Enregistrement..." : "Envoyer l'inscription"}
              </button>
            </div>
          </div>
          )}
        </form>

      </div>
    </main>
    </PageGuard>
  );
}

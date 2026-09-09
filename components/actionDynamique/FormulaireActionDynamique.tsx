"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import { CheckCircleIcon, HomeIcon, ArrowLeftIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { useToast } from "@/components/ToastProvider";
import PrescripteurAutocomplete from "@/components/PrescripteurAutocomplete";
import { chargerPrescripteurs, upsertPrescripteur } from "@/lib/prescripteurs";
import { formatNom, formatPrenom } from "@/lib/formatName";
import { formatPhoneForStorage } from "@/lib/formatPhone";
import { sessionEstAVenir } from "@/lib/sessionDates";
import { calculerAge } from "@/lib/dateNaissance";
import { ActionSchema, QuestionDef } from "@/lib/dynamicActions/types";
import { chargerSchema, chargerConfiguration, inscriptionsCollection, ConfigurationChargee } from "@/lib/dynamicActions/store";
import ChampQuestion from "./ChampQuestion";

const inputClass = "w-full px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] placeholder-[#404040]/40 outline-none font-medium transition-colors";
const labelClass = "block text-[11px] font-bold text-[#404040]/70 uppercase tracking-wide mb-1";

const SESSION_AUCUNE_CONVIENT = "Aucune date ne me convient — me recontacter";

type EtatChargement = "chargement" | "introuvable" | "pret";

interface FormCore {
  civilite: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adressePostale: string;
  codePostal: string;
  ville: string;
  qpv: string;
  dateNaissance: string;
  niveauEtudes: string;
  parcours: string;
  territoire: string;
  session: string;
  conseillerNom: string;
  conseillerPrenom: string;
  conseillerEmail: string;
  conseillerTelephone: string;
  structureAccompagnement: string;
  rgpd: boolean;
}

const CORE_VIDE: FormCore = {
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
  niveauEtudes: "",
  parcours: "",
  territoire: "",
  session: "",
  conseillerNom: "",
  conseillerPrenom: "",
  conseillerEmail: "",
  conseillerTelephone: "",
  structureAccompagnement: "",
  rgpd: false,
};

export default function FormulaireActionDynamique({ slug, variant }: { slug: string; variant: "public" | "interne" }) {
  const [etatChargement, setEtatChargement] = useState<EtatChargement>("chargement");
  const [schema, setSchema] = useState<ActionSchema | null>(null);
  const [config, setConfig] = useState<ConfigurationChargee | null>(null);
  const [logos, setLogos] = useState<any[]>([]);
  const [logosParId, setLogosParId] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    let annule = false;
    (async () => {
      const s = await chargerSchema(slug);
      if (annule) return;
      if (!s || s.actif === false) {
        setEtatChargement("introuvable");
        return;
      }
      const c = await chargerConfiguration(slug);
      if (annule) return;
      setSchema(s);
      setConfig(c);
      if (Object.values(c.logosParTerritoire).some((liste) => liste.length > 0)) {
        const snapLogos = await getDocs(collection(db, "logos_emargement"));
        if (!annule) setLogosParId(new Map(snapLogos.docs.map((d) => [d.id, { id: d.id, ...d.data() } as any])));
      }
      setEtatChargement("pret");
    })();
    return () => { annule = true; };
  }, [slug]);

  if (etatChargement === "chargement") {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement du formulaire...
      </div>
    );
  }
  if (etatChargement === "introuvable" || !schema || !config) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center text-[#404040] gap-4 antialiased`}>
        <p className="text-sm font-bold uppercase tracking-widest">Formulaire introuvable ou fermé.</p>
        <Link href="/" className="text-xs font-bold text-[#005259] underline">Retour à l'accueil</Link>
      </div>
    );
  }

  return <FormulaireActionDynamiqueContenu slug={slug} variant={variant} schema={schema} config={config} logosParId={logosParId} />;
}

function FormulaireActionDynamiqueContenu({
  slug,
  variant,
  schema,
  config,
  logosParId,
}: {
  slug: string;
  variant: "public" | "interne";
  schema: ActionSchema;
  config: ConfigurationChargee;
  logosParId: Map<string, any>;
}) {
  const { showToast } = useToast();
  const permissions = variant === "interne" ? usePermissionsSafe() : null;

  const [core, setCore] = useState<FormCore>({ ...CORE_VIDE, territoire: config.territoiresListe[0] || "" });
  const [reponses, setReponses] = useState<Record<string, string | string[] | boolean>>({});
  const [reponsesAutre, setReponsesAutre] = useState<Record<string, string>>({});
  const [etape, setEtape] = useState(1);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  // Anti-bot (formulaire public uniquement) — même principe que sur les 4
  // programmes historiques (voir app/inscription/prfe/page.tsx) : honeypot
  // invisible + délai minimum de remplissage, vérifiés aussi côté
  // firestore.rules pour rester efficaces face à un script direct.
  const [piege, setPiege] = useState("");
  const [debutRemplissage] = useState(() => Date.now());

  const [verificationQpv, setVerificationQpv] = useState<"idle" | "chargement" | "fait" | "erreur">("idle");
  const [messageQpv, setMessageQpv] = useState<string | null>(null);

  useEffect(() => {
    if (!core.parcours && config.parcoursListe.length > 0) {
      setCore((prev) => ({ ...prev, parcours: config.parcoursListe[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.parcoursListe]);

  const sessionsDisponibles = (config.sessions[core.parcours]?.[core.territoire] || []).filter(sessionEstAVenir);
  const parcoursDisponibles = config.parcoursListe.filter((p) => (config.sessions[p.id]?.[core.territoire] || []).some(sessionEstAVenir));

  useEffect(() => {
    if (parcoursDisponibles.length === 0) return;
    if (!parcoursDisponibles.some((p) => p.id === core.parcours)) {
      setCore((prev) => ({ ...prev, parcours: parcoursDisponibles[0].id, session: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core.territoire, config.sessions]);

  const logos = (config.logosParTerritoire[core.territoire] || []).map((id) => logosParId.get(id)).filter(Boolean);
  const programmesDuParcours = config.programmes[core.parcours] || [];
  const ageCalcule = calculerAge(core.dateNaissance);

  const verifierQpv = async () => {
    if (!core.adressePostale || !core.codePostal || !core.ville) return;
    setVerificationQpv("chargement");
    setMessageQpv(null);
    try {
      const reponse = await fetch("/api/verifier-qpv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adresse: core.adressePostale, codePostal: core.codePostal, ville: core.ville }),
      });
      const data = await reponse.json();
      if (!reponse.ok || !data.trouve) {
        setVerificationQpv("erreur");
        setMessageQpv("Adresse non reconnue, merci de renseigner ce champ manuellement.");
        return;
      }
      setCore((prev) => ({ ...prev, qpv: data.enQPV ? "Oui" : "Non" }));
      setVerificationQpv("fait");
      setMessageQpv(data.enQPV ? `Adresse détectée en QPV (${data.nomQPV || "quartier prioritaire"}) — vérifiez et corrigez si besoin.` : "Adresse détectée hors QPV — vérifiez et corrigez si besoin.");
    } catch {
      setVerificationQpv("erreur");
      setMessageQpv("Vérification indisponible, merci de renseigner ce champ manuellement.");
    }
  };

  // Questions dont la condition d'affichage (si définie) est remplie.
  const questionsVisibles = useMemo(() => {
    return [...schema.questions]
      .sort((a, b) => a.etape - b.etape)
      .filter((q) => {
        if (!q.conditionSurQuestionId) return true;
        const valeurCond = reponses[q.conditionSurQuestionId];
        return valeurCond === q.conditionValeur;
      });
  }, [schema.questions, reponses]);

  const etapes = useMemo(() => {
    const liste: { id: string; titre: string }[] = [
      { id: "territoire", titre: "Votre territoire" },
      { id: "parcours", titre: "Parcours souhaité" },
      { id: "identite", titre: "Votre identité" },
    ];
    if (schema.questions.length > 0) liste.push({ id: "custom", titre: "Informations complémentaires" });
    if (schema.conseillerReferentActif) liste.push({ id: "conseiller", titre: "Conseiller·e référent·e" });
    liste.push({ id: "consentement", titre: "Consentement" });
    return liste;
  }, [schema.questions.length, schema.conseillerReferentActif]);

  const TOTAL_ETAPES = etapes.length;
  const etapeId = etapes[etape - 1]?.id;

  const validerEtape = (numero: number): string | null => {
    const id = etapes[numero - 1]?.id;
    if (id === "territoire" && !core.territoire) return "Merci de sélectionner un territoire.";
    if (id === "parcours") {
      if (!core.parcours) return "Merci de sélectionner un parcours.";
      if (!core.session) return "Merci de sélectionner une session.";
    }
    if (id === "identite") {
      if (!core.nom || !core.prenom || !core.telephone || !core.email) return "Merci de compléter le nom, prénom, téléphone et email.";
      if (!core.adressePostale || !core.codePostal || !core.ville) return "Merci de compléter l'adresse complète.";
      if (!core.dateNaissance) return "Merci de renseigner la date de naissance.";
    }
    if (id === "custom") {
      for (const q of questionsVisibles) {
        if (!q.requis) continue;
        const v = reponses[q.id];
        if (q.type === "checkbox" && !v) return `Merci de cocher "${q.label}".`;
        if (q.type !== "checkbox" && (v === undefined || v === "" || (Array.isArray(v) && v.length === 0))) {
          return `Merci de répondre à "${q.label}".`;
        }
      }
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
    if (!core.rgpd) {
      setErreur("Le consentement RGPD est obligatoire pour enregistrer l'inscription.");
      return;
    }
    if (!core.session) {
      setErreur("Merci de sélectionner une session.");
      return;
    }
    setErreur(null);

    let dureeRemplissageMs = 0;
    if (variant === "public") {
      dureeRemplissageMs = Date.now() - debutRemplissage;
      if (piege.trim() !== "" || dureeRemplissageMs < 4000) {
        setEnvoye(true);
        return;
      }
    }

    setEnvoiEnCours(true);
    try {
      const reponsesCompletes: Record<string, any> = { ...reponses };
      for (const [qid, autre] of Object.entries(reponsesAutre)) {
        if (reponses[qid] === "Autre") reponsesCompletes[`${qid}__autre`] = autre;
      }

      await addDoc(inscriptionsCollection(slug), {
        ...(variant === "public" ? { _piege: piege, _dureeRemplissageMs: dureeRemplissageMs } : {}),
        Civilité: core.civilite,
        Nom: formatNom(core.nom),
        Prénom: formatPrenom(core.prenom),
        Téléphone: formatPhoneForStorage(core.telephone),
        Email: core.email,
        Adresse_Postale: core.adressePostale,
        Code_Postal: core.codePostal,
        Ville: core.ville,
        QPV: core.qpv,
        Date_Naissance: core.dateNaissance,
        Age: ageCalcule ?? "",
        Niveau_Etudes: core.niveauEtudes,
        Parcours: config.parcoursListe.find((p) => p.id === core.parcours)?.label || core.parcours,
        Territoire: core.territoire,
        Session: core.session,
        Conseiller_Nom: formatNom(core.conseillerNom),
        Conseiller_Prenom: formatPrenom(core.conseillerPrenom),
        Conseiller_Email: core.conseillerEmail,
        Conseiller_Telephone: formatPhoneForStorage(core.conseillerTelephone),
        Structure_Accompagnement: core.structureAccompagnement,
        RGPD: core.rgpd,
        reponses: reponsesCompletes,
        createdAt: serverTimestamp(),
      });

      if (variant === "interne" && schema.conseillerReferentActif) {
        try {
          const prescripteurs = await chargerPrescripteurs();
          await upsertPrescripteur(prescripteurs, {
            organisme: core.structureAccompagnement,
            referentPrenom: formatPrenom(core.conseillerPrenom),
            referentNom: formatNom(core.conseillerNom),
            referentTelephone: formatPhoneForStorage(core.conseillerTelephone),
            referentEmail: core.conseillerEmail,
          });
        } catch (err) {
          console.error("Erreur lors de la mise à jour de l'annuaire des prescripteurs :", err);
        }
      }

      if (variant === "public") {
        setEnvoye(true);
      } else {
        showToast("Inscription enregistrée avec succès.", "success");
        setCore({ ...CORE_VIDE, territoire: config.territoiresListe[0] || "" });
        setReponses({});
        setReponsesAutre({});
        setEtape(1);
      }
    } catch (error) {
      console.error(`Erreur lors de l'enregistrement de l'inscription (${slug}) :`, error);
      if (variant === "public") setErreur("Une erreur est survenue lors de l'enregistrement. Merci de réessayer dans quelques instants.");
      else showToast("Une erreur est survenue lors de l'enregistrement.", "error");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const boutonSuivant = (
    <button type="button" onClick={etapeSuivante} disabled={etapeId === "parcours" && parcoursDisponibles.length === 0} className="px-5 py-2 bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm">
    Suivant
    </button>
  );
  const boutonPrecedent = (
    <button type="button" onClick={etapePrecedente} className="px-5 py-2 bg-white hover:bg-[#F3F3F2] border border-[#404040]/10 text-[#404040] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
      Précédent
    </button>
  );

  const corpsFormulaire = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {variant === "public" && (
        <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
          <label htmlFor="site-web">Site web</label>
          <input id="site-web" type="text" name="site-web" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
        </div>
      )}

      {etapeId === "territoire" && (
        <div className="space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Votre territoire</h2>
          <div>
            <label className={labelClass}>Dans quel département résidez-vous ? *</label>
            <select required value={core.territoire} onChange={(e) => setCore({ ...core, territoire: e.target.value, session: "" })} className={inputClass}>
              {config.territoiresListe.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <p className="text-[10px] text-[#404040]/50 italic">Les parcours et sessions proposés ensuite dépendent de votre territoire.</p>
          <div className="flex justify-end pt-2 border-t border-[#404040]/10">{boutonSuivant}</div>
        </div>
      )}

      {etapeId === "parcours" && (
        <div className="space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Parcours souhaité</h2>
          {parcoursDisponibles.length === 0 ? (
            <p className="text-xs text-[#EF736A] font-bold">Aucune session à venir n'est actuellement programmée pour le territoire {core.territoire}.</p>
          ) : (
            <>
              <div>
                <label className={labelClass}>Sur quel parcours souhaitez-vous vous préinscrire ? *</label>
                <select required value={core.parcours} onChange={(e) => setCore({ ...core, parcours: e.target.value, session: "" })} className={inputClass}>
                  {parcoursDisponibles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Session souhaitée *</label>
                <select required value={core.session} onChange={(e) => setCore({ ...core, session: e.target.value })} className={inputClass}>
                  <option value="">-- Choisir une session --</option>
                  {sessionsDisponibles.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value={SESSION_AUCUNE_CONVIENT}>{SESSION_AUCUNE_CONVIENT}</option>
                </select>
              </div>
              {programmesDuParcours.length > 0 && (
                <div className="space-y-3">
                  <span className={labelClass}>Programme</span>
                  {programmesDuParcours.map((img) => (
                    <img key={img.storagePath} src={img.url} alt="Programme" className="w-full h-auto rounded-xl border border-[#404040]/10" />
                  ))}
                </div>
              )}
            </>
          )}
          <div className="flex justify-between pt-2 border-t border-[#404040]/10">{boutonPrecedent}{boutonSuivant}</div>
        </div>
      )}

      {etapeId === "identite" && (
        <div className="space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Votre identité</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Civilité *</label>
              <select required value={core.civilite} onChange={(e) => setCore({ ...core, civilite: e.target.value })} className={inputClass}>
                <option value="M.">M.</option>
                <option value="Mme">Mme</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Nom *</label>
              <input required type="text" value={core.nom} onChange={(e) => setCore({ ...core, nom: e.target.value })} className={inputClass} placeholder="DUPONT" />
            </div>
            <div>
              <label className={labelClass}>Prénom *</label>
              <input required type="text" value={core.prenom} onChange={(e) => setCore({ ...core, prenom: e.target.value })} className={inputClass} placeholder="Jean" />
            </div>
            <div>
              <label className={labelClass}>Téléphone *</label>
              <input required type="tel" value={core.telephone} onChange={(e) => setCore({ ...core, telephone: e.target.value })} className={inputClass} placeholder="06 12 34 56 78" />
            </div>
            <div>
              <label className={labelClass}>Date de naissance *</label>
              <input required type="date" value={core.dateNaissance} onChange={(e) => setCore({ ...core, dateNaissance: e.target.value })} className={inputClass} />
              {ageCalcule !== null && <p className="mt-1 text-[10px] text-[#404040]/50">→ {ageCalcule} ans</p>}
            </div>
            <div className="sm:col-span-3">
              <label className={labelClass}>Email *</label>
              <input required type="email" value={core.email} onChange={(e) => setCore({ ...core, email: e.target.value })} className={inputClass} placeholder="vous@email.com" />
            </div>
            <div className="sm:col-span-3">
              <label className={labelClass}>Adresse postale *</label>
              <input required type="text" value={core.adressePostale} onChange={(e) => setCore({ ...core, adressePostale: e.target.value })} className={inputClass} placeholder="12 rue de la Paix" />
            </div>
            <div>
              <label className={labelClass}>Code postal *</label>
              <input required type="text" value={core.codePostal} onChange={(e) => setCore({ ...core, codePostal: e.target.value })} className={inputClass} placeholder="91000" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Ville de résidence *</label>
              <input required type="text" value={core.ville} onChange={(e) => setCore({ ...core, ville: e.target.value })} onBlur={verifierQpv} className={inputClass} placeholder="Évry-Courcouronnes" />
            </div>
            <div className="sm:col-span-3">
              <label className={labelClass}>Résidez-vous en QPV ?</label>
              <div className="flex items-center gap-3">
                <select value={core.qpv} onChange={(e) => setCore({ ...core, qpv: e.target.value })} className={inputClass}>
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
            {schema.niveauEtudesActif !== false && (
              <div className="sm:col-span-3">
                <label className={labelClass}>Niveau d'études *</label>
                <select required value={core.niveauEtudes} onChange={(e) => setCore({ ...core, niveauEtudes: e.target.value })} className={inputClass}>
                  <option value="">--</option>
                  {config.niveauxEtudes.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-between pt-2 border-t border-[#404040]/10">{boutonPrecedent}{boutonSuivant}</div>
        </div>
      )}

      {etapeId === "custom" && (
        <div className="space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Informations complémentaires</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {questionsVisibles.map((q) => (
              <div key={q.id} className={q.type === "textarea" || q.type === "tags_multiples" || q.type === "checkbox" ? "sm:col-span-3" : ""}>
                <ChampQuestion
                  question={q}
                  valeur={reponses[q.id]}
                  valeurAutre={reponsesAutre[q.id]}
                  onChange={(v) => setReponses((prev) => ({ ...prev, [q.id]: v }))}
                  onChangeAutre={(v) => setReponsesAutre((prev) => ({ ...prev, [q.id]: v }))}
                  inputClass={inputClass}
                  labelClass={labelClass}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-2 border-t border-[#404040]/10">{boutonPrecedent}{boutonSuivant}</div>
        </div>
      )}

      {etapeId === "conseiller" && (
        <div className="space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Conseiller·e référent·e {variant === "public" ? "(si applicable)" : ""}</h2>
          {variant === "interne" ? (
            <PrescripteurAutocomplete
              prenom={core.conseillerPrenom}
              nom={core.conseillerNom}
              telephone={core.conseillerTelephone}
              email={core.conseillerEmail}
              onChange={({ prenom, nom, telephone, email, organisme }) =>
                setCore((prev) => ({ ...prev, conseillerPrenom: prenom, conseillerNom: nom, conseillerTelephone: telephone, conseillerEmail: email, structureAccompagnement: organisme || prev.structureAccompagnement }))
              }
              inputClass={inputClass}
              labelClass={labelClass}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nom du/de la conseiller·e</label>
                <input type="text" value={core.conseillerNom} onChange={(e) => setCore({ ...core, conseillerNom: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Prénom du/de la conseiller·e</label>
                <input type="text" value={core.conseillerPrenom} onChange={(e) => setCore({ ...core, conseillerPrenom: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email du/de la conseiller·e</label>
                <input type="email" value={core.conseillerEmail} onChange={(e) => setCore({ ...core, conseillerEmail: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Téléphone du/de la conseiller·e</label>
                <input type="tel" value={core.conseillerTelephone} onChange={(e) => setCore({ ...core, conseillerTelephone: e.target.value })} className={inputClass} />
              </div>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-[#404040]/10">{boutonPrecedent}{boutonSuivant}</div>
        </div>
      )}

      {etapeId === "consentement" && (
        <div className="space-y-4">
          <label className="flex items-start gap-2.5 text-xs text-[#404040] cursor-pointer">
            <input type="checkbox" checked={core.rgpd} onChange={(e) => setCore({ ...core, rgpd: e.target.checked })} className="mt-0.5 w-4 h-4 accent-[#005259] cursor-pointer" />
            <span>J'autorise le traitement des données collectées en conformité avec la loi RGPD 2018. *</span>
          </label>
          <div className="flex justify-between pt-2 border-t border-[#404040]/10">
            {boutonPrecedent}
            <button type="submit" disabled={envoiEnCours} className="px-6 py-2.5 bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md">
              {envoiEnCours ? "Enregistrement..." : "Envoyer l'inscription"}
            </button>
          </div>
        </div>
      )}
    </form>
  );

  const progression = (
    <div className="flex items-center gap-2">
      {Array.from({ length: TOTAL_ETAPES }, (_, i) => i + 1).map((n) => (
        <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= etape ? "bg-[#005259]" : "bg-[#404040]/10"}`}></div>
      ))}
      <span className="shrink-0 text-[10px] font-bold text-[#404040]/60 uppercase tracking-wider ml-1">{etape}/{TOTAL_ETAPES}</span>
    </div>
  );

  if (variant === "public") {
    return (
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] font-medium antialiased`}>
        <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
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
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight" style={{ color: schema.accentColor }}>{schema.label}</h1>
              <p className="text-sm text-[#404040]/70 mt-1">Formulaire de pré-inscription</p>
            </div>
          </div>

          {envoye ? (
            <div className="bg-white border border-[#404040]/10 rounded-3xl p-8 shadow-sm text-center space-y-3">
              <CheckCircleIcon className="w-12 h-12 text-[#A9E0C9] mx-auto" />
              <h2 className="text-lg font-black uppercase text-[#005259]">Inscription envoyée !</h2>
              <p className="text-sm text-[#404040]/70">Merci {core.prenom} — votre pré-inscription a bien été enregistrée. Notre équipe vous recontactera prochainement.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#404040]/10 rounded-3xl p-5 sm:p-8 shadow-sm space-y-6">
              <div className="bg-[#88ACEA]/10 border border-[#88ACEA]/40 rounded-xl p-3 text-[11px] text-[#404040]">
                <p>{schema.consentementRgpdTexte}</p>
              </div>
              {progression}
              {erreur && <div className="bg-[#EF736A]/10 border border-[#EF736A]/30 text-[#EF736A] text-xs font-bold rounded-xl p-3">{erreur}</div>}
              {corpsFormulaire}
            </div>
          )}
          <p className="text-center text-[10px] text-[#404040]/40 mt-8">Plateforme C.O.S.M.O.S. — Colombbus</p>
        </div>
      </main>
    );
  }

  return (
    <PageGuard pageId="page_access_action_dynamique">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-3xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]" style={{ backgroundColor: schema.accentColor }}></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Formulaire <span style={{ color: "#EA601F" }} className="font-semibold">{schema.label}</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Pré-inscription au parcours {schema.label}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <Link href={`/mediation/actions-collectives/reponses/${slug}`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Réponses</span>
              </Link>
              <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
              {permissions?.role === "admin" && (
                <Link href={`/mediation/actions-collectives/inscription/${slug}/parametres`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
                  <Cog6ToothIcon className="w-4 h-4 text-[#EA601F]" />
                  <span>Gérer</span>
                </Link>
              )}
            </div>
          </div>
          <div className="bg-[#88ACEA]/10 border border-[#88ACEA]/40 rounded-xl p-3 text-[11px] text-[#404040]">
            <p>{schema.consentementRgpdTexte}</p>
          </div>
          {progression}
          {erreur && <div className="bg-[#EF736A]/10 border border-[#EF736A]/30 text-[#EF736A] text-xs font-bold rounded-xl p-3">{erreur}</div>}
          {corpsFormulaire}
        </div>
      </main>
    </PageGuard>
  );
}

// usePermissions() lève si utilisé hors PermissionsProvider — ici toujours
// dans l'arbre (voir app/layout.tsx), donc simple alias de lisibilité.
function usePermissionsSafe() {
  return usePermissions();
}

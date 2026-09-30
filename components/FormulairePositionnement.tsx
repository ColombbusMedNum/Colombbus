"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { formatNom, formatPrenom } from "@/lib/formatName";
import { formatPhoneForStorage } from "@/lib/formatPhone";
import { ConfigPositionnement, ReponsesPositionnement, calculerScorePositionnement } from "@/lib/positionnement";

const inputClass = "w-full px-3 py-2.5 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] outline-none font-medium transition-colors";
const labelClass = "block text-xs font-bold uppercase tracking-wide text-[#005259] mb-1.5";

// Formulaire PUBLIC générique de test de positionnement multi-sections, dont
// le contenu (sections/questions) est entièrement piloté par Firestore (voir
// lib/positionnement.ts et components/EditeurPositionnement.tsx) — pas de
// questions codées en dur, contrairement à Test de langue B1/Collecte Tech.
// Réutilisable par n'importe quel programme via le prop programmeId (voir
// app/inscription/prfe-positionnement pour le câblage PRFE).
export default function FormulairePositionnement({ programmeId, piedDePage }: { programmeId: string; piedDePage?: string }) {
  const [config, setConfig] = useState<ConfigPositionnement | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "positionnement", programmeId)).then((snap) => {
      setConfig(snap.exists() ? (snap.data() as ConfigPositionnement) : null);
      setChargement(false);
    });
  }, [programmeId]);

  const [etape, setEtape] = useState(0); // 0 = identité, 1..N = sections
  const [identite, setIdentite] = useState({ nom: "", prenom: "", email: "", telephone: "", rgpd: false });
  const [reponses, setReponses] = useState<ReponsesPositionnement>({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [piege, setPiege] = useState("");
  const [debutRemplissage] = useState(() => Date.now());

  const sections = config?.sections || [];
  const totalEtapes = sections.length + 1;

  const validerEtape = (): string | null => {
    if (etape === 0) {
      if (!identite.nom.trim() || !identite.prenom.trim() || !identite.email.trim()) return "Merci de renseigner nom, prénom et adresse mail.";
      if (!identite.rgpd) return "Le consentement RGPD est obligatoire.";
      return null;
    }
    const section = sections[etape - 1];
    const incomplet = section.items.some((item) => item.type !== "texte_intro" && (reponses[item.id] === undefined || reponses[item.id] === ""));
    if (incomplet) return "Merci de répondre à toutes les questions de cette section avant de continuer.";
    return null;
  };

  const suivant = () => {
    const err = validerEtape();
    setErreur(err);
    if (err) return;
    if (etape < totalEtapes - 1) setEtape((e) => e + 1);
    else handleSubmit();
  };
  const precedent = () => { setErreur(null); setEtape((e) => Math.max(0, e - 1)); };

  const handleSubmit = async () => {
    if (!config) return;
    setErreur(null);
    const dureeRemplissageMs = Date.now() - debutRemplissage;
    const score = calculerScorePositionnement(config, reponses);
    if (piege.trim() !== "" || dureeRemplissageMs < 4000) {
      setEnvoye(true);
      return;
    }
    setEnvoiEnCours(true);
    try {
      await addDoc(collection(db, "positionnement", programmeId, "resultats"), {
        _piege: piege,
        _dureeRemplissageMs: dureeRemplissageMs,
        Nom: formatNom(identite.nom),
        Prénom: formatPrenom(identite.prenom),
        Téléphone: formatPhoneForStorage(identite.telephone),
        Email: identite.email.trim(),
        Réponses: reponses,
        ScoreGlobal: score.scoreGlobal,
        TotalQcmGlobal: score.totalQcmGlobal,
        ScoreParSection: score.parSection,
        RGPD: identite.rgpd,
        createdAt: serverTimestamp(),
      });
      setEnvoye(true);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du test de positionnement :", error);
      setErreur("Une erreur est survenue lors de l'envoi — merci de réessayer.");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  if (chargement) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement...
      </div>
    );
  }
  if (!config || sections.length === 0) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#404040]/60 font-bold tracking-widest text-xs uppercase antialiased text-center px-4`}>
        Ce test n'est pas disponible pour le moment.
      </div>
    );
  }

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] font-medium antialiased`}>
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">

        <div className="text-center mb-8">
          <h1 className="text-xl sm:text-2xl font-black uppercase text-[#005259] tracking-tight">{config.titre}</h1>
          {config.description && <p className="text-sm text-[#404040]/70 mt-2 whitespace-pre-line">{config.description}</p>}
        </div>

        {envoye ? (
          <div className="bg-white border border-[#404040]/10 rounded-3xl p-8 shadow-sm text-center space-y-3">
            <CheckCircleIcon className="w-12 h-12 text-[#A9E0C9] mx-auto" />
            <h2 className="text-lg font-black uppercase text-[#005259]">Test envoyé !</h2>
            <p className="text-sm text-[#404040]/70">Merci {identite.prenom}, vos réponses ont bien été enregistrées.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#404040]/10 rounded-3xl p-5 sm:p-8 shadow-sm space-y-6">

            <div className="bg-[#88ACEA]/10 border border-[#88ACEA]/40 rounded-xl p-3 text-[11px] text-[#404040]">
              Les données seront traitées en conformité avec la loi RGPD 2018.
            </div>

            <div className="flex items-center gap-2">
              {Array.from({ length: totalEtapes }, (_, i) => i).map((n) => (
                <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= etape ? "bg-[#005259]" : "bg-[#404040]/10"}`}></div>
              ))}
              <span className="shrink-0 text-[10px] font-bold text-[#404040]/60 uppercase tracking-wider ml-1">
                {etape === 0 ? "Infos" : `Section ${etape}/${sections.length}`}
              </span>
            </div>

            {erreur && (
              <div className="bg-[#EF736A]/10 border border-[#EF736A]/30 text-[#EF736A] text-xs font-bold rounded-xl p-3">{erreur}</div>
            )}

            <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
              <label htmlFor="site-web">Site web</label>
              <input id="site-web" type="text" name="site-web" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
            </div>

            {etape === 0 ? (
              <div className="space-y-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259] border-b border-[#404040]/10 pb-2">Informations du candidat</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Nom *</label>
                    <input type="text" required value={identite.nom} onChange={(e) => setIdentite({ ...identite, nom: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Prénom *</label>
                    <input type="text" required value={identite.prenom} onChange={(e) => setIdentite({ ...identite, prenom: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Adresse e-mail *</label>
                    <input type="email" required value={identite.email} onChange={(e) => setIdentite({ ...identite, email: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Téléphone *</label>
                    <input type="tel" value={identite.telephone} onChange={(e) => setIdentite({ ...identite, telephone: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <label className="flex items-start gap-2.5 text-xs text-[#404040] cursor-pointer">
                  <input type="checkbox" checked={identite.rgpd} onChange={(e) => setIdentite({ ...identite, rgpd: e.target.checked })} className="mt-0.5 accent-[#005259]" />
                  <span>J'accepte que mes données personnelles soient collectées et utilisées dans le cadre de ce test, en conformité avec la loi RGPD 2018. *</span>
                </label>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="border-b border-[#404040]/10 pb-2">
                  <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">{sections[etape - 1].titre}</h2>
                  {sections[etape - 1].sousTitre && <p className="text-[11px] text-[#404040]/60 mt-1">{sections[etape - 1].sousTitre}</p>}
                </div>
                {sections[etape - 1].items.map((item, index) =>
                  item.type === "texte_intro" ? (
                    <div key={item.id} className="bg-[#F3F3F2] rounded-xl p-4 text-[13px] leading-relaxed text-[#404040] whitespace-pre-line">
                      {item.contenu}
                    </div>
                  ) : (
                    <div key={item.id} className="space-y-2">
                      <p className="text-sm font-bold text-[#404040]">{index + 1}. {item.enonce} <span className="text-[#EF736A]">*</span></p>
                      {item.type === "qcm" ? (
                        <div className="space-y-1.5">
                          {(item.options || []).map((option, oi) => (
                            <label
                              key={oi}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors text-sm ${
                                reponses[item.id] === oi ? "bg-[#005259]/10 border-[#005259] text-[#005259] font-bold" : "bg-[#F3F3F2] border-[#404040]/10 text-[#404040] hover:border-[#005259]/40"
                              }`}
                            >
                              <input type="radio" name={item.id} checked={reponses[item.id] === oi} onChange={() => setReponses((prev) => ({ ...prev, [item.id]: oi }))} className="accent-[#005259]" />
                              {option}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          value={(reponses[item.id] as string) || ""}
                          onChange={(e) => setReponses((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          rows={item.enonce && item.enonce.length > 80 ? 4 : 2}
                          className={inputClass}
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-[#404040]/10">
              <button type="button" onClick={precedent} disabled={etape === 0} className="px-5 py-2 bg-white hover:bg-[#F3F3F2] disabled:opacity-30 disabled:cursor-not-allowed border border-[#404040]/10 text-[#404040] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
                Précédent
              </button>
              <button
                type="button"
                onClick={suivant}
                disabled={envoiEnCours}
                className="px-6 py-2.5 bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                {etape < totalEtapes - 1 ? "Suivant" : envoiEnCours ? "Envoi..." : "Envoyer mes réponses"}
              </button>
            </div>
          </div>
        )}

        {piedDePage && <p className="text-center text-[10px] text-[#404040]/40 mt-8">{piedDePage}</p>}
      </div>
    </main>
  );
}

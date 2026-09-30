"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp } from "firebase/firestore";
import Image from "next/image";
import { quicksand } from "@/lib/fonts";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { ConfigSatisfaction, ItemSatisfaction, ReponsesSatisfaction, itemVisible, sectionVisible } from "@/lib/satisfaction";

const inputClass = "w-full px-3 py-2.5 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-sm text-[#404040] outline-none font-medium transition-colors";
const labelClass = "block text-xs font-bold uppercase tracking-wide text-[#005259] mb-1.5";

// Formulaire PUBLIC générique de questionnaire de satisfaction, contenu
// entièrement piloté par Firestore (voir lib/satisfaction.ts et
// components/EditeurSatisfaction.tsx) — pas de notation (contrairement au
// test de positionnement), et une réponse peut sauter une section entière
// (branchement, ex. "à chaud"/"à froid"). Réutilisable par n'importe quel
// programme via programmeId.
export default function FormulaireSatisfaction({ programmeId }: { programmeId: string }) {
  const [config, setConfig] = useState<ConfigSatisfaction | null>(null);
  const [logos, setLogos] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const snap = await getDoc(doc(db, "satisfaction", programmeId));
      if (!snap.exists()) {
        setChargement(false);
        return;
      }
      const c = snap.data() as ConfigSatisfaction;
      setConfig(c);
      if (c.logoIds && c.logoIds.length > 0) {
        const snapLogos = await getDocs(collection(db, "logos_emargement"));
        const parId = new Map(snapLogos.docs.map((d) => [d.id, { id: d.id, ...d.data() } as any]));
        setLogos(c.logoIds.map((id) => parId.get(id)).filter(Boolean));
      }
      setChargement(false);
    };
    charger();
  }, [programmeId]);

  const [etape, setEtape] = useState(0); // 0 = email, 1..N = sections visibles
  const [email, setEmail] = useState("");
  const [rgpd, setRgpd] = useState(false);
  const [reponses, setReponses] = useState<ReponsesSatisfaction>({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [piege, setPiege] = useState("");
  const [debutRemplissage] = useState(() => Date.now());

  // Recalculé à chaque réponse : une section conditionnelle référence
  // toujours une question d'une section précédente, donc ses réponses sont
  // déjà connues quand on évalue la visibilité.
  const sectionsVisibles = useMemo(() => (config ? config.sections.filter((s) => sectionVisible(s, reponses)) : []), [config, reponses]);
  const totalEtapes = sectionsVisibles.length + 1;
  const sectionActuelle = etape > 0 ? sectionsVisibles[etape - 1] : null;
  const itemsVisibles = sectionActuelle ? sectionActuelle.items.filter((it) => itemVisible(it, reponses)) : [];

  const validerEtape = (): string | null => {
    if (etape === 0) {
      if (!email.trim()) return "Merci de renseigner votre adresse e-mail.";
      if (!rgpd) return "Le consentement RGPD est obligatoire.";
      return null;
    }
    const incomplet = itemsVisibles.some((it) => it.type !== "texte_intro" && (reponses[it.id] === undefined || reponses[it.id] === ""));
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
    setErreur(null);
    const dureeRemplissageMs = Date.now() - debutRemplissage;
    if (piege.trim() !== "" || dureeRemplissageMs < 4000) {
      setEnvoye(true);
      return;
    }
    setEnvoiEnCours(true);
    try {
      await addDoc(collection(db, "satisfaction", programmeId, "resultats"), {
        _piege: piege,
        _dureeRemplissageMs: dureeRemplissageMs,
        Email: email.trim(),
        Réponses: reponses,
        RGPD: rgpd,
        createdAt: serverTimestamp(),
      });
      setEnvoye(true);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du questionnaire de satisfaction :", error);
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
  if (!config || config.sections.length === 0) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#404040]/60 font-bold tracking-widest text-xs uppercase antialiased text-center px-4`}>
        Ce questionnaire n'est pas disponible pour le moment.
      </div>
    );
  }

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
            <h1 className="text-xl sm:text-2xl font-black uppercase text-[#005259] tracking-tight">{config.titre}</h1>
            {config.description && <p className="text-sm text-[#404040]/70 mt-2 whitespace-pre-line">{config.description}</p>}
          </div>
        </div>

        {envoye ? (
          <div className="bg-white border border-[#404040]/10 rounded-3xl p-8 shadow-sm text-center space-y-3">
            <CheckCircleIcon className="w-12 h-12 text-[#A9E0C9] mx-auto" />
            <h2 className="text-lg font-black uppercase text-[#005259]">Merci !</h2>
            <p className="text-sm text-[#404040]/70">Vos réponses ont bien été enregistrées.</p>
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
                {etape === 0 ? "Infos" : `Section ${etape}/${sectionsVisibles.length}`}
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
                <div>
                  <label className={labelClass}>Adresse e-mail *</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="vous@email.com" />
                </div>
                <label className="flex items-start gap-2.5 text-xs text-[#404040] cursor-pointer">
                  <input type="checkbox" checked={rgpd} onChange={(e) => setRgpd(e.target.checked)} className="mt-0.5 accent-[#005259]" />
                  <span>J'accepte que mes données personnelles soient collectées et utilisées dans le cadre de ce questionnaire, en conformité avec la loi RGPD 2018. *</span>
                </label>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="border-b border-[#404040]/10 pb-2">
                  <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">{sectionActuelle!.titre}</h2>
                  {sectionActuelle!.sousTitre && <p className="text-[11px] text-[#404040]/60 mt-1">{sectionActuelle!.sousTitre}</p>}
                </div>
                {itemsVisibles.map((item, index) => (
                  <RenduItemSatisfaction key={item.id} item={item} index={index} reponse={reponses[item.id]} onChange={(v) => setReponses((prev) => ({ ...prev, [item.id]: v }))} />
                ))}
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

        <p className="text-center text-[10px] text-[#404040]/40 mt-8">Plateforme C.O.S.M.O.S. — Colombbus</p>
      </div>
    </main>
  );
}

function RenduItemSatisfaction({ item, index, reponse, onChange }: { item: ItemSatisfaction; index: number; reponse: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  if (item.type === "texte_intro") {
    return (
      <div className="bg-[#F3F3F2] rounded-xl p-4 text-[13px] leading-relaxed text-[#404040] whitespace-pre-line">
        {item.contenu}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-[#404040]">{index + 1}. {item.enonce} <span className="text-[#EF736A]">*</span></p>
      {item.type === "choix_unique" && (
        <div className="space-y-1.5">
          {(item.options || []).map((option) => (
            <label
              key={option}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors text-sm ${
                reponse === option ? "bg-[#005259]/10 border-[#005259] text-[#005259] font-bold" : "bg-[#F3F3F2] border-[#404040]/10 text-[#404040] hover:border-[#005259]/40"
              }`}
            >
              <input type="radio" name={item.id} checked={reponse === option} onChange={() => onChange(option)} className="accent-[#005259]" />
              {option}
            </label>
          ))}
        </div>
      )}
      {item.type === "choix_multiple" && (
        <div className="space-y-1.5">
          {(item.options || []).map((option) => {
            const liste = Array.isArray(reponse) ? reponse : [];
            const coche = liste.includes(option);
            return (
              <label
                key={option}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors text-sm ${
                  coche ? "bg-[#005259]/10 border-[#005259] text-[#005259] font-bold" : "bg-[#F3F3F2] border-[#404040]/10 text-[#404040] hover:border-[#005259]/40"
                }`}
              >
                <input type="checkbox" checked={coche} onChange={() => onChange(coche ? liste.filter((v) => v !== option) : [...liste, option])} className="accent-[#005259]" />
                {option}
              </label>
            );
          })}
        </div>
      )}
      {item.type === "texte_libre" && (
        <textarea value={(reponse as string) || ""} onChange={(e) => onChange(e.target.value)} rows={item.enonce && item.enonce.length > 80 ? 4 : 2} className={inputClass} />
      )}
      {item.type === "echelle" && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-[#404040]/60 font-bold uppercase tracking-wide w-20 shrink-0">{item.echelleMin || "Pas satisfait"}</span>
          <div className="flex items-center gap-2 flex-1 justify-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(String(n))}
                className={`w-10 h-10 rounded-xl border-2 font-black text-sm transition-colors cursor-pointer ${
                  reponse === String(n) ? "bg-[#005259] border-[#005259] text-white" : "bg-[#F3F3F2] border-[#404040]/15 text-[#404040] hover:border-[#005259]/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-[#404040]/60 font-bold uppercase tracking-wide w-20 shrink-0 text-right">{item.echelleMax || "Très satisfait"}</span>
        </div>
      )}
    </div>
  );
}

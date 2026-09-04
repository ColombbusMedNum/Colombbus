"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import {
  HomeIcon,
  Cog6ToothIcon,
  ClockIcon,
  HomeModernIcon,
  ChevronDownIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { useToast } from "@/components/ToastProvider";

const JOURS_SEMAINE = [
  { key: "lundi", label: "Lundi" },
  { key: "mardi", label: "Mardi" },
  { key: "mercredi", label: "Mercredi" },
  { key: "jeudi", label: "Jeudi" },
  { key: "vendredi", label: "Vendredi" }
];

const HORAIRES_PAR_DEFAUT = {
  lundi: { debut: "09:30", fin: "17:00" },
  mardi: { debut: "09:30", fin: "17:00" },
  mercredi: { debut: "09:30", fin: "17:00" },
  jeudi: { debut: "09:30", fin: "17:00" },
  vendredi: { debut: "09:30", fin: "17:00" }
};

// Réglages globaux variables (susceptibles de changer d'une année sur
// l'autre), auparavant dispersés dans chaque page qui les utilise :
// - Seuils d'alerte ACI (heures complémentaires) : app/mediation/volume-horaire/page.tsx
// - Quota de visites à domicile RND Suresnes : app/mediation/rencontres-numeriques/suresnes/page.tsx
// Stockés ensemble dans configuration_equipe/parametres_configuration, déjà
// utilisé pour d'autres réglages d'équipe partagés.
export default function ParametresPage() {
  const { showToast } = useToast();

  const [seuilHeuresInput, setSeuilHeuresInput] = useState("0");
  const [seuilPourcentageInput, setSeuilPourcentageInput] = useState("0");
  const [quotaDomicileInput, setQuotaDomicileInput] = useState("4");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configuration_equipe", "parametres_configuration"), (snap) => {
      const data = snap.data();
      const seuils = data?.seuilsComplementairesACI || {};
      setSeuilHeuresInput(String(Number(seuils.heures) || 0));
      setSeuilPourcentageInput(String(Number(seuils.pourcentage) || 0));
      setQuotaDomicileInput(String(Number(data?.quotaDomicileRND) || 4));
    });
    return () => unsub();
  }, []);

  // Grilles horaires ACI (Paris/Massy), déplacées ici depuis
  // app/mediation/equipe/page.tsx pour regrouper tous les réglages variables
  // au même endroit.
  const [grillesHorairesACI, setGrillesHorairesACI] = useState<{ [site: string]: any }>({
    Paris: { ...HORAIRES_PAR_DEFAUT },
    Massy: { ...HORAIRES_PAR_DEFAUT }
  });
  const [horaireEnregistre, setHoraireEnregistre] = useState<{ [site: string]: boolean }>({});
  const horaireEnregistreTimers = useRef<{ [site: string]: ReturnType<typeof setTimeout> }>({});
  const [accordionOpen, setAccordionOpen] = useState<{ [site: string]: boolean }>({
    Paris: false,
    Massy: false
  });

  useEffect(() => {
    let unsub = () => {};
    let annule = false;

    const horairesRef = doc(db, "configuration_equipe", "parametres_horaires");
    // Ancien emplacement : ce document vivait par erreur dans liste_mediateurs
    // (qui ne devrait contenir que des fiches de médiateurs indexées par UID) —
    // voir la migration équivalente pour parametres_configuration dans
    // app/mediation/equipe/page.tsx.
    const ancienHoraireRef = doc(db, "liste_mediateurs", "parametres_horaires");

    const demarrer = async () => {
      try {
        const nouveauHoraires = await getDoc(horairesRef);
        if (!nouveauHoraires.exists()) {
          const ancien = await getDoc(ancienHoraireRef);
          if (ancien.exists()) {
            await setDoc(horairesRef, ancien.data());
            await deleteDoc(ancienHoraireRef).catch(() => {});
          }
        }
      } catch (err) {
        console.error("Erreur lors de la migration des grilles horaires ACI :", err);
      }

      if (annule) return;

      unsub = onSnapshot(horairesRef, (snapshot) => {
        if (snapshot.exists()) {
          setGrillesHorairesACI(snapshot.data());
        } else {
          setDoc(horairesRef, {
            Paris: { ...HORAIRES_PAR_DEFAUT },
            Massy: { ...HORAIRES_PAR_DEFAUT }
          });
        }
      });
    };

    demarrer();

    return () => {
      annule = true;
      unsub();
    };
  }, []);

  const handleGlobalHoraireChange = async (site: "Paris" | "Massy", jour: string, type: "debut" | "fin", val: string) => {
    const updated = {
      ...grillesHorairesACI,
      [site]: {
        ...grillesHorairesACI[site],
        [jour]: { ...grillesHorairesACI[site][jour], [type]: val }
      }
    };
    setGrillesHorairesACI(updated);
    try {
      await setDoc(doc(db, "configuration_equipe", "parametres_horaires"), updated);
      setHoraireEnregistre(prev => ({ ...prev, [site]: true }));
      clearTimeout(horaireEnregistreTimers.current[site]);
      horaireEnregistreTimers.current[site] = setTimeout(() => {
        setHoraireEnregistre(prev => ({ ...prev, [site]: false }));
      }, 2000);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'enregistrement des horaires.", "error");
    }
  };

  const enregistrerSeuils = async () => {
    const heures = Math.max(0, Number(seuilHeuresInput) || 0);
    const pourcentage = Math.max(0, Number(seuilPourcentageInput) || 0);
    try {
      await setDoc(doc(db, "configuration_equipe", "parametres_configuration"), {
        seuilsComplementairesACI: { heures, pourcentage }
      }, { merge: true });
      showToast("Seuils d'alerte ACI enregistrés.", "success");
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'enregistrement.", "error");
    }
  };

  const enregistrerQuotaDomicile = async () => {
    const quota = Math.max(0, Math.round(Number(quotaDomicileInput) || 0));
    try {
      await setDoc(doc(db, "configuration_equipe", "parametres_configuration"), {
        quotaDomicileRND: quota
      }, { merge: true });
      showToast("Quota de visites à domicile enregistré.", "success");
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'enregistrement.", "error");
    }
  };

  return (
    <PageGuard pageId="page_access_parametres">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-3xl mx-auto relative z-10 space-y-6">

          {/* EN-TÊTE ET BOUTON RETOUR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Paramètres <span className="text-[#EA601F] font-semibold">Généraux</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                  Quotas et seuils d'alerte, susceptibles d'évoluer d'une année sur l'autre
                </p>
              </div>
            </div>

            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm w-fit"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>

          {/* SEUILS D'ALERTE ACI */}
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#005259]">
              <ClockIcon className="w-5 h-5 text-[#EA601F]" />
              <h2 className="text-sm font-bold uppercase tracking-wide">Seuils d'alerte ACI — Heures complémentaires</h2>
            </div>
            <p className="text-[11px] text-[#404040]/60 leading-relaxed">
              Utilisés dans <span className="font-bold">Volume Horaire</span> : un ACI est signalé dès qu'il dépasse
              l'un OU l'autre des deux seuils ci-dessous (0 = seuil désactivé).
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Seuil en heures complémentaires</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={seuilHeuresInput}
                    onChange={e => setSeuilHeuresInput(e.target.value)}
                    className="w-24 p-2 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-xs font-mono outline-none focus:border-[#005259]"
                  />
                  <span className="text-[11px] text-[#404040]/60 font-bold">h</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Seuil en % du volume contractuel</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={seuilPourcentageInput}
                    onChange={e => setSeuilPourcentageInput(e.target.value)}
                    className="w-24 p-2 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-xs font-mono outline-none focus:border-[#005259]"
                  />
                  <span className="text-[11px] text-[#404040]/60 font-bold">%</span>
                </div>
              </div>
              <button
                onClick={enregistrerSeuils}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#005259] hover:bg-[#EA601F] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer w-fit"
              >
                <Cog6ToothIcon className="w-4 h-4" />
                <span>Enregistrer</span>
              </button>
            </div>
          </div>

          {/* QUOTA VISITES À DOMICILE RND SURESNES */}
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#005259]">
              <HomeModernIcon className="w-5 h-5 text-[#EA601F]" />
              <h2 className="text-sm font-bold uppercase tracking-wide">Quota de visites à domicile — RND Suresnes</h2>
            </div>
            <p className="text-[11px] text-[#404040]/60 leading-relaxed">
              Utilisé dans <span className="font-bold">Agenda Suresnes</span> (créneaux « (RND) ») : au-delà de ce
              nombre de visites à domicile « Présent » dans l'année, le nom du bénéficiaire s'affiche en orange et
              une confirmation est demandée avant de le repositionner sur un créneau.
            </p>
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1.5">Quota par an</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={quotaDomicileInput}
                    onChange={e => setQuotaDomicileInput(e.target.value)}
                    className="w-24 p-2 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-xs font-mono outline-none focus:border-[#005259]"
                  />
                  <span className="text-[11px] text-[#404040]/60 font-bold">visite(s)</span>
                </div>
              </div>
              <button
                onClick={enregistrerQuotaDomicile}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#005259] hover:bg-[#EA601F] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer w-fit"
              >
                <Cog6ToothIcon className="w-4 h-4" />
                <span>Enregistrer</span>
              </button>
            </div>
          </div>

          {/* GRILLES HORAIRES ACI */}
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#005259]">
              <ClockIcon className="w-5 h-5 text-[#EA601F]" />
              <h2 className="text-sm font-bold uppercase tracking-wide">Grilles Horaires ACI</h2>
            </div>
            <p className="text-[11px] text-[#404040]/60 leading-relaxed">
              Utilisées pour générer automatiquement les créneaux « RN Observation » des ACI sur TERRAGE/MASSY, selon
              le territoire (Paris ou Massy) auquel chacun·e est rattaché·e dans sa fiche.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["Paris", "Massy"] as const).map(site => {
                const isOpen = accordionOpen[site];
                return (
                  <div key={site} className="border border-[#404040]/10 rounded-2xl overflow-hidden">
                    <div
                      onClick={() => setAccordionOpen(prev => ({ ...prev, [site]: !prev[site] }))}
                      className="p-3.5 bg-[#F3F3F2]/60 hover:bg-[#F3F3F2] cursor-pointer flex items-center justify-between transition-all select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#005259]">{site}</h3>
                        <span className={`flex items-center gap-1 text-[10px] font-bold uppercase text-[#005259] transition-opacity duration-300 ${horaireEnregistre[site] ? "opacity-100" : "opacity-0"}`}>
                          <CheckCircleIcon className="w-3.5 h-3.5 text-[#A9E0C9]" /> Enregistré
                        </span>
                      </div>
                      <ChevronDownIcon className={`w-4 h-4 text-[#404040]/50 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#EA601F]" : ""}`} />
                    </div>

                    {isOpen && (
                      <div className="p-3.5 border-t border-[#404040]/10 space-y-2 bg-white">
                        {JOURS_SEMAINE.map(j => (
                          <div key={j.key} className="flex items-center justify-between p-2 bg-[#F3F3F2]/40 border border-[#404040]/10 rounded-xl">
                            <span className="text-[11px] font-bold text-[#005259] uppercase tracking-wide pl-1">{j.label}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                className="p-1 bg-white border border-[#404040]/15 text-[#404040] font-mono text-xs rounded text-center w-20 outline-none focus:border-[#005259]"
                                value={grillesHorairesACI[site]?.[j.key]?.debut || "09:30"}
                                onChange={e => handleGlobalHoraireChange(site, j.key, "debut", e.target.value)}
                              />
                              <span className="text-[#404040]/50 text-[10px] font-bold uppercase">à</span>
                              <input
                                type="time"
                                className="p-1 bg-white border border-[#404040]/15 text-[#404040] font-mono text-xs rounded text-center w-20 outline-none focus:border-[#005259]"
                                value={grillesHorairesACI[site]?.[j.key]?.fin || "17:00"}
                                onChange={e => handleGlobalHoraireChange(site, j.key, "fin", e.target.value)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </main>
    </PageGuard>
  );
}

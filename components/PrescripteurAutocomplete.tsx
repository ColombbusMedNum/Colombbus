"use client";

import { useEffect, useMemo, useState } from "react";
import { chargerPrescripteurs, Prescripteur } from "@/lib/prescripteurs";

interface Valeurs {
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
}

interface Props extends Valeurs {
  onChange: (valeurs: Valeurs & { organisme?: string }) => void;
  inputClass: string;
  labelClass: string;
}

// Autocomplétion partagée par les 3 formulaires d'inscription (Numérik'UP,
// Digital'UP, NUMERIK PRO) pour le bloc "conseiller·e référent·e" — évite
// de ressaisir en texte libre un·e référent·e déjà connu·e, seul point
// commun aux 3 programmes (contrairement à Structure_Accompagnement, dont la
// forme diffère selon le programme).
export default function PrescripteurAutocomplete({ prenom, nom, telephone, email, onChange, inputClass, labelClass }: Props) {
  const [liste, setListe] = useState<Prescripteur[]>([]);
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    chargerPrescripteurs().then(setListe).catch(() => {});
  }, []);

  const suggestions = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return [];
    return liste
      .filter((p) => `${p.referentPrenom || ""} ${p.referentNom || ""} ${p.organisme || ""} ${p.referentEmail || ""}`.toLowerCase().includes(terme))
      .slice(0, 8);
  }, [liste, recherche]);

  const selectionner = (p: Prescripteur) => {
    onChange({ prenom: p.referentPrenom || "", nom: p.referentNom || "", telephone: p.referentTelephone || "", email: p.referentEmail || "", organisme: p.organisme });
    setRecherche("");
    setOuvert(false);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <label className={labelClass}>Rechercher un·e référent·e déjà connu·e</label>
        <input
          type="text"
          value={recherche}
          onChange={(e) => { setRecherche(e.target.value); setOuvert(true); }}
          onFocus={() => setOuvert(true)}
          placeholder="Nom, prénom, organisme ou email..."
          className={inputClass}
        />
        {ouvert && (
          <>
            {suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-[#404040]/15 rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectionner(p)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#F3F3F2] transition-colors border-b border-[#404040]/5 last:border-0 cursor-pointer"
                  >
                    <div className="font-bold text-[#005259]">{p.referentPrenom} {p.referentNom}</div>
                    <div className="text-[#404040]/60">{p.organisme}{p.referentEmail ? ` — ${p.referentEmail}` : ""}</div>
                  </button>
                ))}
              </div>
            )}
            <div className="fixed inset-0 z-10" onClick={() => setOuvert(false)}></div>
          </>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Nom (majuscules)</label>
          <input type="text" value={nom} onChange={(e) => onChange({ prenom, nom: e.target.value, telephone, email })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Prénom</label>
          <input type="text" value={prenom} onChange={(e) => onChange({ prenom: e.target.value, nom, telephone, email })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={email} onChange={(e) => onChange({ prenom, nom, telephone, email: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Téléphone</label>
          <input type="tel" value={telephone} onChange={(e) => onChange({ prenom, nom, telephone: e.target.value, email })} className={inputClass} />
        </div>
      </div>
    </div>
  );
}

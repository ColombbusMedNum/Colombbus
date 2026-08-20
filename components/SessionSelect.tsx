"use client";

import { useMemo, useState } from "react";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";

interface Props {
  value: string;
  options: string[];
  resoudreLabel: (valeur: string) => string;
  onChange: (valeur: string) => void;
  placeholder?: string;
  className?: string;
}

// Remplace un <select> natif pour les listes de sessions : un <select> natif
// long, ouvert près du haut de l'écran, se fait clipper par le navigateur
// autour de l'option sélectionnée — les toutes premières options (triées par
// code) deviennent alors invisibles sans qu'on puisse les faire défiler. Un
// menu maison, entièrement dessiné par nous, n'a pas cette limite et permet
// en plus de chercher un code directement.
export default function SessionSelect({ value, options, resoudreLabel, onChange, placeholder = "-- Choisir une session --", className }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");

  const optionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return options;
    return options.filter((o) => resoudreLabel(o).toLowerCase().includes(terme));
  }, [options, recherche, resoudreLabel]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className={className || "flex items-center justify-between gap-2 bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] font-medium shadow-sm cursor-pointer max-w-[240px] w-full"}
      >
        <span className="truncate">{value ? resoudreLabel(value) : placeholder}</span>
        <ChevronUpDownIcon className="w-3.5 h-3.5 text-[#404040]/40 shrink-0" />
      </button>
      {ouvert && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOuvert(false); setRecherche(""); }}></div>
          <div className="absolute z-50 mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-[#404040]/15 rounded-xl shadow-lg">
            <div className="p-2 sticky top-0 bg-white border-b border-[#404040]/10">
              <input
                type="text"
                autoFocus
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un code..."
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/10 rounded-lg text-xs text-[#404040] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => { onChange(""); setOuvert(false); setRecherche(""); }}
              className="w-full text-left px-3 py-2 text-xs text-[#404040]/50 hover:bg-[#F3F3F2] transition-colors cursor-pointer"
            >
              {placeholder}
            </button>
            {optionsFiltrees.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setOuvert(false); setRecherche(""); }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer ${o === value ? "bg-[#005259] text-white font-bold" : "text-[#404040] hover:bg-[#F3F3F2]"}`}
              >
                {resoudreLabel(o)}
              </button>
            ))}
            {optionsFiltrees.length === 0 && (
              <div className="px-3 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-[#404040]/40">Aucun résultat</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

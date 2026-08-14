"use client";

import { ReactNode } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

// Section repliable générique pour les formulaires longs (voir le formulaire
// de modèle d'activité dans l'agenda et dans /mediation/modeles) : évite
// qu'une pop-up avec beaucoup de champs optionnels ne déborde de l'écran.
export default function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-[#404040]/10 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2.5 py-2 bg-[#F3F3F2] hover:bg-[#F3F3F2]/70 cursor-pointer text-left transition-colors"
      >
        <span className="text-[10px] text-[#404040] font-bold uppercase tracking-wide">{title}</span>
        <ChevronDownIcon className={`w-3.5 h-3.5 text-[#404040]/50 transition-transform duration-200 shrink-0 ${open ? "rotate-180 text-[#EA601F]" : ""}`} />
      </button>
      {open && <div className="p-2.5 space-y-3 border-t border-[#404040]/10">{children}</div>}
    </div>
  );
}

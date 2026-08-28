"use client";

import { useEffect, useState } from "react";
import { ChevronUpIcon } from "@heroicons/react/24/outline";

// Bouton flottant "remonter en haut", pour les pages longues à défilement
// (agendas...) où revenir en haut à la molette est fastidieux. N'apparaît
// qu'une fois qu'on a effectivement défilé, pour ne pas encombrer l'écran
// au chargement de la page.
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      title="Remonter en haut de la page"
      aria-label="Remonter en haut de la page"
      className="fixed bottom-6 right-6 z-[120] p-3 bg-[#005259] hover:bg-[#EA601F] text-white rounded-full shadow-lg transition-all cursor-pointer"
    >
      <ChevronUpIcon className="w-5 h-5" />
    </button>
  );
}

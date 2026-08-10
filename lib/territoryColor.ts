// Couleur de badge par territoire, cohérente avec la charte graphique
// (partagée entre app/mediation/equipe et app/mediation/competences, où
// elle était dupliquée à l'identique).
export function getTerritoryColor(territory: string): string {
  if (!territory) return "bg-[#005259]/10 border-[#005259]/30 text-[#005259]";
  const t = territory.toLowerCase().trim();
  if (t === "paris") return "bg-[#005259]/10 border-[#005259]/30 text-[#005259]";
  if (t === "massy") return "bg-[#EA601F]/10 border-[#EA601F]/30 text-[#EA601F]";

  const colors = [
    "bg-[#A9E0C9]/30 border-[#A9E0C9] text-[#005259]",
    "bg-[#F9945D]/15 border-[#F9945D]/40 text-[#EA601F]",
    "bg-[#EF736A]/15 border-[#EF736A]/40 text-[#EF736A]",
    "bg-[#005259]/10 border-[#005259]/30 text-[#005259]"
  ];
  const hash = t.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

"use client";

import { PhotoIcon, TrashIcon } from "@heroicons/react/24/outline";

// Briques UI partagées par les fiches "papier" imprimables (Entretien
// diagnostic, Diagnostic équipement) — extraites de l'ancien
// FicheEntretienDiagnostic.tsx (dupliqué à l'identique sur 4 programmes)
// pour être réutilisées par le moteur générique FicheDiagnosticGenerique.tsx
// (voir lib/ficheDiagnostic.ts) sans dupliquer le style ni le comportement.

// Style "trait souligné" (pas de case encadrée) — fidèle à la densité du PDF
// papier, où chaque ligne tient sur une seule hauteur de texte. La valeur
// saisie ressort en orange Colombbus, comme sur la maquette validée.
export const champLigneInputClass =
  "flex-1 min-w-0 bg-transparent border-0 border-b border-[#404040]/30 focus:border-[#005259] rounded-none px-1 py-0.5 text-xs text-[#EA601F] font-semibold outline-none print:border-black";
export const champLigneLabelClass = "text-[11px] font-bold text-[#404040] whitespace-nowrap shrink-0 print:text-black";

export const champTexteClass =
  "w-full bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-lg px-2.5 py-1.5 text-xs text-[#404040] outline-none font-medium transition-colors " +
  "print:border-0 print:border-b print:border-black print:rounded-none print:bg-transparent print:px-0";

export const labelClass = champLigneLabelClass;

export function ChampLigne({ label, valeur, onValide, type = "text", className = "" }: { label: string; valeur?: string; onValide: (v: string) => void; type?: string; className?: string }) {
  return (
    <label className={`flex items-baseline gap-1.5 min-w-0 ${className}`}>
      <span className={champLigneLabelClass}>{label} :</span>
      <input type={type} defaultValue={valeur || ""} onBlur={(e) => onValide(e.target.value)} className={champLigneInputClass} />
    </label>
  );
}

export function ZoneTexte({ label, sousLabel, valeur, onValide, rows = 3 }: { label?: string; sousLabel?: string; valeur?: string; onValide: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-bold text-[#404040] mb-1">{label}</span>}
      {sousLabel && <span className="block text-[10px] italic text-[#404040]/50 mb-1.5 print:text-black/70">{sousLabel}</span>}
      <textarea defaultValue={valeur || ""} onBlur={(e) => onValide(e.target.value)} rows={rows} className={`${champTexteClass} resize-y print:resize-none`} />
    </label>
  );
}

// Case ☐/☒ — visuellement fidèle au formulaire papier fourni (des "X" dans
// des cases, pas des coches). Le glyphe (couleur de texte) reste visible à
// l'impression même si le navigateur retire les couleurs de fond.
export function Case({ coche }: { coche?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 shrink-0 rounded-[3px] border-2 text-[11px] font-black leading-none print:border-black ${
        coche ? "border-[#005259] text-[#005259] print:text-black" : "border-[#404040]/40 text-transparent"
      }`}
    >
      ✕
    </span>
  );
}

export function CocherBool({ label, valeur, onChange }: { label: string; valeur?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5">
      <span className="text-xs font-bold text-[#404040] flex-1 min-w-[60%]">{label}</span>
      <div className="flex items-center gap-4 shrink-0">
        <button type="button" onClick={() => onChange(true)} className="flex items-center gap-1.5 cursor-pointer">
          <Case coche={valeur === true} />
          <span className="text-xs font-medium text-[#404040]">OUI</span>
        </button>
        <button type="button" onClick={() => onChange(false)} className="flex items-center gap-1.5 cursor-pointer">
          <Case coche={valeur === false} />
          <span className="text-xs font-medium text-[#404040]">NON</span>
        </button>
      </div>
    </div>
  );
}

export function CocherChoixUnique({ label, options, valeur, onChange, className = "" }: { label?: string; options: string[]; valeur?: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={className}>
      {label && <span className="block text-xs font-bold text-[#404040] mb-1">{label}</span>}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => onChange(opt)} className="flex items-center gap-1.5 cursor-pointer">
            <Case coche={valeur === opt} />
            <span className="text-xs font-medium text-[#404040]">{opt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CocherChoixMultiple({ label, options, valeurs, onChange }: { label?: string; options: string[]; valeurs?: string[]; onChange: (v: string[]) => void }) {
  const liste = valeurs || [];
  const toggle = (opt: string) => onChange(liste.includes(opt) ? liste.filter((v) => v !== opt) : [...liste, opt]);
  return (
    <div>
      {label && <span className="block text-xs font-bold text-[#404040] mb-1">{label}</span>}
      <div className="flex flex-col gap-1">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => toggle(opt)} className="flex items-center gap-1.5 cursor-pointer text-left">
            <Case coche={liste.includes(opt)} />
            <span className="text-xs font-medium text-[#404040]">{opt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Bandeau de section teal, fidèle au PDF fourni. Pas de break-inside-avoid :
// une grande section (ex. "Situation administrative") qui ne tient pas dans
// l'espace restant de la page serait alors renvoyée intégralement à la page
// suivante, laissant un grand vide — le PDF original laisse justement ses
// sections se couper naturellement entre deux pages, c'est ce comportement
// qu'on reproduit ici.
export function SectionPDF({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#404040]/15 rounded-xl overflow-hidden">
      <div className="bg-[#005259] text-white text-xs font-extrabold uppercase tracking-widest px-3 py-2 print:bg-[#005259] print:text-white">
        {titre}
      </div>
      <div className="p-3 space-y-2 bg-white">{children}</div>
    </div>
  );
}

// Signature de l'attestation finale — jamais persistée en base (voir mention
// jaune sur la fiche), même principe sur les 4 programmes : état local
// uniquement, perdue en quittant la page.
export function BoiteSignatureLocale({ url, uploading, onUpload, onSupprimer }: { url?: string; uploading: boolean; onUpload: (file: File) => void; onSupprimer: () => void }) {
  return (
    <div className="relative h-32 rounded-xl border-2 border-dashed border-[#404040]/20 bg-[#F3F3F2] flex items-center justify-center overflow-hidden print:border-black print:bg-transparent">
      {url ? (
        <>
          <img src={url} alt="Signature" className="max-h-full max-w-full object-contain p-2" />
          <button type="button" onClick={onSupprimer} title="Retirer cette signature" className="print:hidden absolute top-1.5 right-1.5 p-1.5 bg-white/90 border border-[#404040]/10 text-[#404040]/50 hover:text-[#EF736A] rounded-lg shadow-sm cursor-pointer">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <label htmlFor="signature-diagnostic" className="print:hidden flex flex-col items-center gap-1.5 text-[#404040]/40 hover:text-[#005259] transition-colors cursor-pointer">
          <PhotoIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">{uploading ? "Envoi..." : "Ajouter une image"}</span>
        </label>
      )}
      <input
        id="signature-diagnostic"
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

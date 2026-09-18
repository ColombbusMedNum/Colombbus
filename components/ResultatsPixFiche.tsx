"use client";

import { ChartPieIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { COMPETENCES_PIX, PixResultat } from "@/lib/pixImport";

// Année incluse : voir la même remarque dans PixResultatsSession.tsx — sans
// elle, deux tests à cheval sur deux années civiles semblent mal triés.
function formaterDateFr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : iso;
}

// Bloc "Résultats Pix" de la fiche individuelle d'un·e apprenant·e (Digital Up
// 96H / Numérik'UP Pro) — même style visuel que les autres Section de cette
// fiche, mais autonome (pas d'accès au composant Section local, propre à
// chaque page) pour rester partagé entre les deux modules. Lecture seule :
// l'import se fait depuis la page Pix de la session (voir
// components/PixResultatsSession.tsx).
export default function ResultatsPixFiche({ historique }: { historique?: PixResultat[] }) {
  const trie = (historique || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const dernier = trie[trie.length - 1] || null;
  const premier = trie[0] || null;
  const delta = dernier && premier && trie.length > 1 ? dernier.totalPix - premier.totalPix : null;

  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-5 space-y-4 print:shadow-none print:border-black print:break-inside-avoid-page">
      <div className="flex items-center gap-2.5">
        <ChartPieIcon className="w-4 h-4 text-[#EA601F]" />
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#005259] print:text-black">Résultats Pix</h2>
      </div>

      {!dernier ? (
        <p className="text-xs text-[#404040]/50 font-medium">Aucun résultat Pix importé pour le moment.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#F3F3F2] rounded-xl p-3 text-center">
              <div className="text-xl font-black text-[#005259]">
                {dernier.totalPix}
                {delta !== null && <span className="text-xs font-bold text-[#EA601F] ml-1">{delta >= 0 ? `+${delta}` : delta}</span>}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mt-0.5">Total Pix</div>
            </div>
            <div className="bg-[#F3F3F2] rounded-xl p-3 text-center flex flex-col items-center justify-center gap-0.5">
              {dernier.certifiable ? (
                <CheckCircleIcon className="w-6 h-6 text-[#005259]" />
              ) : (
                <XCircleIcon className="w-6 h-6 text-[#EF736A]" />
              )}
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mt-0.5">Certifiable</div>
            </div>
            <div className="bg-[#F3F3F2] rounded-xl p-3 text-center">
              <div className="text-xl font-black text-[#005259]">{dernier.nbCompetencesCertifiables}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mt-0.5">Compétences certifiables</div>
            </div>
          </div>

          <p className="text-[10px] text-[#404040]/50 font-medium">
            Dernier test : {formaterDateFr(dernier.date)}{trie.length > 1 ? ` — ${trie.length} tests au total` : ""}
          </p>

          <div className="overflow-x-auto -mx-1">
            <table className="border-collapse text-[11px] w-full">
              <thead>
                <tr className="text-[#005259] text-[9px] uppercase tracking-widest font-bold">
                  <th className="px-2 py-1.5 text-left">Compétence</th>
                  {trie.map((r) => (
                    <th key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10">{formaterDateFr(r.date)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {COMPETENCES_PIX.map((c) => (
                  <tr key={c}>
                    <td className="px-2 py-1.5 text-[#404040]">{c}</td>
                    {trie.map((r) => {
                      const comp = r.competences[c];
                      return (
                        <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10 text-[#404040]/80">
                          {comp ? `${comp.niveau} · ${comp.pix}pix` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

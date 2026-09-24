"use client";

import { ChartPieIcon } from "@heroicons/react/24/outline";
import { COMPETENCES_PIX } from "@/lib/pixImport";
import { BADGES_NKUP, DOMAINES_NKUP, PixResultatNkup } from "@/lib/pixImportNkup";

// Même remarque que ResultatsPixFiche.tsx (année incluse dans le format
// affiché, pour ne pas fausser le tri visuel de deux tests à cheval sur deux
// années civiles).
function formaterDateFr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : iso;
}

function formaterPct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

// Bloc "Résultats Pix" de la fiche individuelle Numérik'UP (non pro) — variante
// de components/ResultatsPixFiche.tsx pour le format diagnostic "Parkour
// Numérik'UP" (palier /3 + badges + détail en % par compétence/domaine), trop
// différent du format pix/niveau par compétence pour partager le même
// composant (voir lib/pixImportNkup.ts). Lecture seule : l'import se fait
// depuis la page Pix de la session (components/PixResultatsSessionNkup.tsx).
export default function ResultatsPixFicheNkup({ historique }: { historique?: PixResultatNkup[] }) {
  const trie = (historique || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const dernier = trie[trie.length - 1] || null;
  const nbBadgesObtenus = dernier ? BADGES_NKUP.filter((b) => dernier.badges[b]).length : 0;

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
              <div className="text-xl font-black text-[#005259]">{dernier.palier !== null ? `${dernier.palier}/3` : "—"}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mt-0.5">Palier</div>
            </div>
            <div className="bg-[#F3F3F2] rounded-xl p-3 text-center">
              <div className="text-xl font-black text-[#005259]">{formaterPct(dernier.maitriseGlobale)}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mt-0.5">Maîtrise globale</div>
            </div>
            <div className="bg-[#F3F3F2] rounded-xl p-3 text-center">
              <div className="text-xl font-black text-[#005259]">{dernier.partage ? `${nbBadgesObtenus}/${BADGES_NKUP.length}` : "—"}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mt-0.5">Badges obtenus</div>
            </div>
          </div>

          <p className="text-[10px] text-[#404040]/50 font-medium">
            Dernier test : {formaterDateFr(dernier.date)}{trie.length > 1 ? ` — ${trie.length} tests au total` : ""}
          </p>

          <div className="overflow-x-auto -mx-1">
            <table className="border-collapse text-[11px] w-full">
              <thead>
                <tr className="text-[#005259] text-[9px] uppercase tracking-widest font-bold">
                  <th className="px-2 py-1.5 text-left">—</th>
                  {trie.map((r) => (
                    <th key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10">{formaterDateFr(r.date)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {BADGES_NKUP.map((b) => (
                  <tr key={b}>
                    <td className="px-2 py-1.5 text-[#404040]">{b}</td>
                    {trie.map((r) => {
                      const v = r.badges[b];
                      return (
                        <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10 text-[#404040]/80">
                          {v === null || v === undefined ? "—" : v ? "✔" : "✘"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {COMPETENCES_PIX.filter((c) => trie.some((r) => r.competences[c])).map((c) => (
                  <tr key={c}>
                    <td className="px-2 py-1.5 text-[#404040]">{c}</td>
                    {trie.map((r) => {
                      const comp = r.competences[c];
                      return (
                        <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10 text-[#404040]/80">
                          {comp ? formaterPct(comp.pct) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {DOMAINES_NKUP.some((d) => trie.some((r) => r.domaines[d])) && (
                  <tr>
                    <td colSpan={trie.length + 1} className="px-2 pt-3 pb-1 text-[9px] font-bold uppercase tracking-wider text-[#005259]/50">
                      Par domaine (regroupe plusieurs compétences ci-dessus)
                    </td>
                  </tr>
                )}
                {DOMAINES_NKUP.filter((d) => trie.some((r) => r.domaines[d])).map((d) => (
                  <tr key={d} className="bg-[#005259]/5">
                    <td className="px-2 py-1.5 font-bold text-[#005259]">{d}</td>
                    {trie.map((r) => {
                      const dom = r.domaines[d];
                      return (
                        <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10 font-bold text-[#005259]">
                          {dom ? formaterPct(dom.pct) : "—"}
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

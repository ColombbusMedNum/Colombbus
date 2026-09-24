"use client";

import { ChartPieIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { COMPETENCES_PIX, PALETTE_COURBES, PixResultat } from "@/lib/pixImport";

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
// Petit graphique d'évolution (Total Pix par test) sous le tableau détaillé —
// n'a de sens qu'à partir de 2 tests, sinon une seule valeur ne trace rien.
const GRAPHE_LARGEUR = 400;
const GRAPHE_HAUTEUR = 90;
const GRAPHE_PAD_X = 8;
const GRAPHE_PAD_Y = 14;

export default function ResultatsPixFiche({ historique }: { historique?: PixResultat[] }) {
  const trie = (historique || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const dernier = trie[trie.length - 1] || null;
  const premier = trie[0] || null;
  const delta = dernier && premier && trie.length > 1 ? dernier.totalPix - premier.totalPix : null;

  const valeursGraphe = trie.map((r) => r.totalPix);
  const maxGraphe = Math.max(1, ...valeursGraphe);
  const minGraphe = Math.min(0, ...valeursGraphe);
  const xPourIndex = (i: number) => GRAPHE_PAD_X + (trie.length <= 1 ? 0 : (i / (trie.length - 1)) * (GRAPHE_LARGEUR - GRAPHE_PAD_X * 2));
  const yPourValeur = (v: number) => GRAPHE_HAUTEUR - GRAPHE_PAD_Y - ((v - minGraphe) / (maxGraphe - minGraphe || 1)) * (GRAPHE_HAUTEUR - GRAPHE_PAD_Y * 2);
  const pointsGraphe = trie.map((r, i) => `${xPourIndex(i)},${yPourValeur(r.totalPix)}`).join(" ");

  // Même principe, une courbe par compétence (celles ayant au moins un
  // résultat dans l'historique) plutôt qu'une seule courbe globale.
  const competencesPresentes = COMPETENCES_PIX.filter((c) => trie.some((r) => r.competences[c]));
  const maxPixCompetence = Math.max(1, ...trie.flatMap((r) => competencesPresentes.map((c) => r.competences[c]?.pix || 0)));
  const yPourPixCompetence = (v: number) => GRAPHE_HAUTEUR - GRAPHE_PAD_Y - (v / maxPixCompetence) * (GRAPHE_HAUTEUR - GRAPHE_PAD_Y * 2);

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

          {trie.length > 1 && (
            <div className="pt-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1.5">Évolution (Total Pix)</div>
              <svg viewBox={`0 0 ${GRAPHE_LARGEUR} ${GRAPHE_HAUTEUR}`} className="w-full" style={{ height: GRAPHE_HAUTEUR }}>
                <polyline points={pointsGraphe} fill="none" stroke="#EA601F" strokeWidth={2} />
                {trie.map((r, i) => (
                  <circle key={r.date} cx={xPourIndex(i)} cy={yPourValeur(r.totalPix)} r={3} fill="#005259" />
                ))}
              </svg>
              <div className="flex justify-between text-[9px] text-[#404040]/50 font-medium">
                <span>{formaterDateFr(trie[0].date)}</span>
                <span>{formaterDateFr(trie[trie.length - 1].date)}</span>
              </div>
            </div>
          )}

          {trie.length > 1 && competencesPresentes.length > 0 && (
            <div className="pt-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 mb-1.5">Évolution par compétence</div>
              <svg viewBox={`0 0 ${GRAPHE_LARGEUR} ${GRAPHE_HAUTEUR}`} className="w-full" style={{ height: GRAPHE_HAUTEUR }}>
                {competencesPresentes.map((c, ci) => {
                  const couleur = PALETTE_COURBES[ci % PALETTE_COURBES.length];
                  const points = trie.map((r, i) => `${xPourIndex(i)},${yPourPixCompetence(r.competences[c]?.pix || 0)}`).join(" ");
                  return (
                    <g key={c}>
                      <polyline points={points} fill="none" stroke={couleur} strokeWidth={1.5} />
                      {trie.map((r, i) => (
                        <circle key={r.date} cx={xPourIndex(i)} cy={yPourPixCompetence(r.competences[c]?.pix || 0)} r={2} fill={couleur} />
                      ))}
                    </g>
                  );
                })}
              </svg>
              <div className="flex justify-between text-[9px] text-[#404040]/50 font-medium mb-1.5">
                <span>{formaterDateFr(trie[0].date)}</span>
                <span>{formaterDateFr(trie[trie.length - 1].date)}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {competencesPresentes.map((c, ci) => (
                  <div key={c} className="flex items-center gap-1 text-[9px] text-[#404040]/70 font-medium">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PALETTE_COURBES[ci % PALETTE_COURBES.length] }}></span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import {
  HomeIcon, ArrowLeftIcon, ArrowUpTrayIcon, DocumentArrowUpIcon,
  ChevronDownIcon, ChartBarIcon, CheckCircleIcon, XCircleIcon,
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import {
  COMPETENCES_PIX, PALETTE_COURBES, PixResultat, LignePixCsv,
  parserCsvPix, trouverApprenantPourLigne, fusionnerResultats,
} from "@/lib/pixImport";

interface ApprenantPix {
  id: string;
  Nom?: string;
  Prénom?: string;
  Email?: string;
  Session?: string;
  Suivi_Recrutement?: boolean;
  OK_NOK?: string;
  PixResultats?: PixResultat[];
}

interface Props {
  // Nom de la collection Firestore des inscriptions (varie selon le module :
  // "inscriptions_digitaluppro" ou "inscriptions_numerikuppro").
  collectionInscriptions: string;
  // Racine des routes du module, pour reconstruire les liens "Apprenant·e·s"
  // et "Évolution" de la session (ex. ".../reponses/digital-up-pro").
  basePath: string;
}

// Année incluse (pas seulement JJ/MM) : deux imports peuvent chevaucher deux
// années civiles différentes (ex. un ancien test de mai 2025 et un plus
// récent d'avril 2026) — sans l'année, les colonnes semblaient triées dans le
// mauvais sens alors que le tri chronologique complet (voir fusionnerResultats)
// était en réalité correct.
function formaterDateFr(iso: string): string {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a.slice(2)}`;
}

export default function PixResultatsSession({ collectionInscriptions, basePath }: Props) {
  const params = useParams();
  const sessionId = decodeURIComponent((params?.id as string) || "");

  const [apprenants, setApprenants] = useState<ApprenantPix[]>([]);
  const [loading, setLoading] = useState(true);

  const [texteColle, setTexteColle] = useState("");
  const [lignesParsees, setLignesParsees] = useState<LignePixCsv[]>([]);
  const [anomalies, setAnomalies] = useState<number[]>([]);
  const [nomFichier, setNomFichier] = useState("");
  const [correspondanceManuelle, setCorrespondanceManuelle] = useState<Record<number, string>>({});
  const [enCours, setEnCours] = useState(false);
  const [resultatImport, setResultatImport] = useState<string | null>(null);

  const [ouverts, setOuverts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const charger = async () => {
      try {
        const snap = await getDocs(query(collection(db, collectionInscriptions), orderBy("createdAt", "desc")));
        setApprenants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprenantPix)));
      } catch (error) {
        console.error("Erreur lors du chargement des apprenant·e·s :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [collectionInscriptions]);

  const apprenantsSession = useMemo(
    () =>
      apprenants
        .filter((a) => a.Session === sessionId && a.Suivi_Recrutement && a.OK_NOK === "OK")
        .sort((a, b) => (a.Nom || "").localeCompare(b.Nom || "", "fr")),
    [apprenants, sessionId]
  );

  // Rapprochement CSV -> apprenant·e : automatique (email puis nom/prénom),
  // avec repli manuel choisi dans le <select> de la ligne non reconnue.
  const lignesAvecMatch = useMemo(
    () =>
      lignesParsees.map((ligne, index) => {
        const manuelId = correspondanceManuelle[index];
        const manuel = manuelId ? apprenantsSession.find((a) => a.id === manuelId) || null : null;
        return { ligne, index, apprenant: manuel || trouverApprenantPourLigne(ligne, apprenantsSession) };
      }),
    [lignesParsees, apprenantsSession, correspondanceManuelle]
  );
  const lignesReconnues = lignesAvecMatch.filter((l) => l.apprenant);
  const lignesNonReconnues = lignesAvecMatch.filter((l) => !l.apprenant);

  const analyser = (texte: string, nom: string) => {
    const { lignes, anomalies: anomaliesFichier } = parserCsvPix(texte);
    setLignesParsees((prev) => [...prev, ...lignes]);
    if (anomaliesFichier.length > 0) setAnomalies((prev) => [...prev, ...anomaliesFichier]);
    setNomFichier((prev) => (prev ? `${prev} + ${nom}` : nom));
    setResultatImport(null);
  };

  const surChoixFichier = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const texte = await fichier.text();
    analyser(texte, fichier.name);
    e.target.value = "";
  };

  const analyserColle = () => {
    if (!texteColle.trim()) return;
    analyser(texteColle, "collé manuellement");
    setTexteColle("");
  };

  const reinitialiser = () => {
    setLignesParsees([]);
    setAnomalies([]);
    setNomFichier("");
    setCorrespondanceManuelle({});
    setResultatImport(null);
  };

  const importer = async () => {
    if (lignesReconnues.length === 0) return;
    setEnCours(true);
    try {
      // Plusieurs fichiers (dates de test différentes) peuvent être chargés
      // avant l'import et concerner la même personne — on regroupe TOUTES ses
      // lignes plutôt que de ne garder que la dernière rencontrée, l'ordre de
      // dépôt des fichiers n'ayant pas à correspondre à l'ordre chronologique
      // (voir fusionnerResultats, qui re-trie systématiquement par date).
      const resultatsParApprenant = new Map<string, PixResultat[]>();
      lignesReconnues.forEach(({ ligne, apprenant }) => {
        const liste = resultatsParApprenant.get(apprenant!.id) || [];
        liste.push(ligne.resultat);
        resultatsParApprenant.set(apprenant!.id, liste);
      });

      await Promise.all(
        Array.from(resultatsParApprenant.entries()).map(([id, nouveaux]) => {
          const apprenant = apprenantsSession.find((a) => a.id === id);
          const historique = fusionnerResultats(apprenant?.PixResultats, nouveaux);
          return updateDoc(doc(db, collectionInscriptions, id), { PixResultats: historique });
        })
      );

      setApprenants((prev) =>
        prev.map((a) =>
          resultatsParApprenant.has(a.id)
            ? { ...a, PixResultats: fusionnerResultats(a.PixResultats, resultatsParApprenant.get(a.id)!) }
            : a
        )
      );

      const nbIgnorees = lignesNonReconnues.length;
      setResultatImport(
        `${resultatsParApprenant.size} apprenant·e(s) mis à jour (${lignesReconnues.length} résultat(s) au total).` +
          (nbIgnorees > 0 ? ` ${nbIgnorees} ligne(s) non reconnue(s) ignorée(s).` : "")
      );
      reinitialiser();
    } catch (error) {
      console.error("Erreur lors de l'import des résultats Pix :", error);
      setResultatImport("Une erreur est survenue pendant l'import — voir la console.");
    } finally {
      setEnCours(false);
    }
  };

  const toggleDetail = (id: string) => {
    setOuverts((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  };

  // --- GRAPHIQUE D'ÉVOLUTION (tou·te·s les apprenant·e·s de la session) ---
  const apprenantsAvecData = useMemo(
    () => apprenantsSession.filter((a) => (a.PixResultats || []).length > 0),
    [apprenantsSession]
  );
  const datesUnion = useMemo(
    () => Array.from(new Set(apprenantsAvecData.flatMap((a) => (a.PixResultats || []).map((r) => r.date)))).sort(),
    [apprenantsAvecData]
  );
  const maxPix = useMemo(
    () => Math.max(1, ...apprenantsAvecData.flatMap((a) => (a.PixResultats || []).map((r) => r.totalPix))),
    [apprenantsAvecData]
  );

  const LARGEUR = 1000;
  const HAUTEUR = 380;
  const PAD_GAUCHE = 44;
  const PAD_DROITE = 16;
  const PAD_HAUT = 16;
  const PAD_BAS = 56;
  const largeurTrace = LARGEUR - PAD_GAUCHE - PAD_DROITE;
  const hauteurTrace = HAUTEUR - PAD_HAUT - PAD_BAS;

  const xPourDate = (dateIso: string) => {
    const idx = datesUnion.indexOf(dateIso);
    if (datesUnion.length <= 1) return PAD_GAUCHE + largeurTrace / 2;
    return PAD_GAUCHE + (idx / (datesUnion.length - 1)) * largeurTrace;
  };
  const yPourPix = (v: number) => PAD_HAUT + hauteurTrace - (v / maxPix) * hauteurTrace;

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-[100rem] mx-auto relative z-10 space-y-6">
          {/* EN-TÊTE & NAVIGATION */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Résultats <span className="text-[#EA601F] font-normal">Pix</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                  Session : {sessionId || "—"} — {apprenantsSession.length} apprenant{apprenantsSession.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={`${basePath}/${encodeURIComponent(sessionId)}/apprenants`}
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Apprenant·e·s</span>
              </Link>
              <Link
                href="/"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

          {/* IMPORT CSV */}
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Importer un export CSV Pix</h2>
            <p className="text-[11px] text-[#404040]/60">
              Export "Résultats" tel quel depuis pix.org (une ligne par participant·e). Le rapprochement se fait par email,
              puis par nom/prénom si l'email est absent ou ne correspond à personne de cette session.
            </p>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[#404040]/20 hover:border-[#EA601F] rounded-xl p-6 cursor-pointer transition-colors text-[#005259]">
              <DocumentArrowUpIcon className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Choisir un fichier .csv</span>
              <input type="file" accept=".csv,text/csv" onChange={surChoixFichier} className="hidden" />
            </label>
            <div className="flex gap-2">
              <textarea
                value={texteColle}
                onChange={(e) => setTexteColle(e.target.value)}
                placeholder="Ou colle directement le contenu CSV ici..."
                rows={3}
                className="flex-1 px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white rounded-xl text-xs text-[#404040] outline-none font-mono transition-colors"
              />
              <button
                type="button"
                onClick={analyserColle}
                className="shrink-0 self-start px-3 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-xl transition-colors cursor-pointer"
                title="Analyser le texte collé"
              >
                <ArrowUpTrayIcon className="w-4 h-4" />
              </button>
            </div>

            {anomalies.length > 0 && (
              <p className="text-[11px] font-bold text-[#8a6d1a] bg-[#F9C44E]/10 border border-[#F9C44E] rounded-xl px-3 py-2">
                ⚠️ Ligne(s) n° {anomalies.join(", ")} avec un nombre de colonnes inattendu — vérifie le fichier source.
              </p>
            )}

            {lignesParsees.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[11px] font-bold text-[#005259]">
                    {nomFichier} — {lignesReconnues.length} reconnue(s), {lignesNonReconnues.length} à rapprocher
                  </p>
                  <button type="button" onClick={reinitialiser} className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 hover:text-[#EF736A] cursor-pointer">
                    Tout effacer
                  </button>
                </div>

                {lignesNonReconnues.length > 0 && (
                  <div className="border border-[#EF736A]/30 bg-[#EF736A]/5 rounded-xl p-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#C0392B]">Lignes non reconnues — rapprocher manuellement</p>
                    {lignesNonReconnues.map(({ ligne, index }) => (
                      <div key={index} className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-bold text-[#404040]">{ligne.prenom} {ligne.nom}</span>
                        <span className="text-[#404040]/50">{ligne.email || "(sans email)"}</span>
                        <select
                          value={correspondanceManuelle[index] || ""}
                          onChange={(e) => setCorrespondanceManuelle((prev) => ({ ...prev, [index]: e.target.value }))}
                          className="bg-white border border-[#404040]/15 rounded-lg px-2 py-1 text-xs outline-none"
                        >
                          <option value="">— Associer à —</option>
                          {apprenantsSession.map((a) => (
                            <option key={a.id} value={a.id}>{a.Prénom} {a.Nom}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={importer}
                  disabled={enCours || lignesReconnues.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-50 text-white rounded-xl transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {enCours ? "Import en cours..." : `Importer ${lignesReconnues.length} résultat(s)`}
                </button>
              </div>
            )}

            {resultatImport && (
              <p className="text-xs font-bold text-[#005259] bg-[#005259]/5 border border-[#005259]/15 rounded-xl px-3 py-2">{resultatImport}</p>
            )}
          </div>

          {/* TABLEAU + DÉTAIL PAR APPRENANT·E */}
          {apprenantsSession.length === 0 ? (
            <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
              Aucun·e apprenant·e retenu·e (OK) pour cette session.
            </div>
          ) : (
            <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                      <th className="px-3 py-3">Prénom</th>
                      <th className="px-3 py-3">Nom</th>
                      <th className="px-3 py-3 text-center">Dernier import</th>
                      <th className="px-3 py-3 text-center">Total Pix</th>
                      <th className="px-3 py-3 text-center">Certifiable</th>
                      <th className="px-3 py-3 text-center">Compétences certifiables</th>
                      <th className="px-3 py-3 text-center">Détail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]/5">
                    {apprenantsSession.map((a) => {
                      const historique = (a.PixResultats || []).slice().sort((x, y) => (x.date < y.date ? -1 : 1));
                      const dernier = historique[historique.length - 1] || null;
                      const estOuvert = ouverts.has(a.id);
                      return (
                        <Fragment key={a.id}>
                          <tr className="hover:bg-[#F3F3F2]/60 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-[#005259]">{a.Prénom || "—"}</td>
                            <td className="px-3 py-2.5 font-bold text-[#005259] uppercase">{a.Nom || "—"}</td>
                            <td className="px-3 py-2.5 text-center">{dernier ? formaterDateFr(dernier.date) : "—"}</td>
                            <td className="px-3 py-2.5 text-center font-bold">{dernier ? dernier.totalPix : "—"}</td>
                            <td className="px-3 py-2.5 text-center">
                              {dernier ? (
                                dernier.certifiable ? (
                                  <CheckCircleIcon className="w-4 h-4 text-[#005259] inline" />
                                ) : (
                                  <XCircleIcon className="w-4 h-4 text-[#EF736A] inline" />
                                )
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">{dernier ? dernier.nbCompetencesCertifiables : "—"}</td>
                            <td className="px-3 py-2.5 text-center">
                              {historique.length > 0 && (
                                <button type="button" onClick={() => toggleDetail(a.id)} className="p-1 hover:bg-[#F3F3F2] rounded-lg cursor-pointer">
                                  <ChevronDownIcon className={`w-4 h-4 text-[#EA601F] transition-transform ${estOuvert ? "rotate-180" : ""}`} />
                                </button>
                              )}
                            </td>
                          </tr>
                          {estOuvert && historique.length > 0 && (
                            <tr>
                              <td colSpan={7} className="bg-[#F3F3F2]/60 px-4 py-4">
                                <div className="overflow-x-auto">
                                  <table className="border-collapse text-[11px] w-full">
                                    <thead>
                                      <tr className="text-[#005259] text-[9px] uppercase tracking-widest font-bold">
                                        <th className="px-2 py-1.5 text-left">Compétence</th>
                                        {historique.map((r) => (
                                          <th key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10">{formaterDateFr(r.date)}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#404040]/5 bg-white rounded-xl">
                                      <tr className="font-bold text-[#005259]">
                                        <td className="px-2 py-1.5">Total Pix</td>
                                        {historique.map((r) => (
                                          <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10">{r.totalPix}</td>
                                        ))}
                                      </tr>
                                      <tr className="font-bold text-[#EA601F]">
                                        <td className="px-2 py-1.5">Compétences certifiables</td>
                                        {historique.map((r) => (
                                          <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10">{r.nbCompetencesCertifiables}</td>
                                        ))}
                                      </tr>
                                      {COMPETENCES_PIX.map((c) => (
                                        <tr key={c}>
                                          <td className="px-2 py-1.5 text-[#404040]">{c}</td>
                                          {historique.map((r) => {
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
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GRAPHIQUE D'ÉVOLUTION GLOBAL */}
          {apprenantsAvecData.length > 0 && datesUnion.length > 0 && (
            <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-5 space-y-4">
              <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#005259]">
                <ChartBarIcon className="w-4 h-4 text-[#EA601F]" />
                Évolution du total de Pix
              </h2>
              <div className="overflow-x-auto">
                <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} className="w-full min-w-[600px]" style={{ height: HAUTEUR }}>
                  {/* Grille + graduations Y */}
                  {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                    const y = PAD_HAUT + hauteurTrace - f * hauteurTrace;
                    return (
                      <g key={f}>
                        <line x1={PAD_GAUCHE} y1={y} x2={LARGEUR - PAD_DROITE} y2={y} stroke="#40404015" strokeWidth={1} />
                        <text x={PAD_GAUCHE - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#404040" opacity={0.6}>
                          {Math.round(f * maxPix)}
                        </text>
                      </g>
                    );
                  })}
                  {/* Graduations X */}
                  {datesUnion.map((d) => (
                    <text
                      key={d}
                      x={xPourDate(d)}
                      y={HAUTEUR - PAD_BAS + 34}
                      textAnchor="end"
                      fontSize="10"
                      fill="#404040"
                      opacity={0.7}
                      transform={`rotate(-45 ${xPourDate(d)} ${HAUTEUR - PAD_BAS + 34})`}
                    >
                      {formaterDateFr(d)}
                    </text>
                  ))}
                  {/* Courbes */}
                  {apprenantsAvecData.map((a, index) => {
                    const historique = (a.PixResultats || []).slice().sort((x, y) => (x.date < y.date ? -1 : 1));
                    const couleur = PALETTE_COURBES[index % PALETTE_COURBES.length];
                    const points = historique.map((r) => `${xPourDate(r.date)},${yPourPix(r.totalPix)}`).join(" ");
                    return (
                      <g key={a.id}>
                        <polyline points={points} fill="none" stroke={couleur} strokeWidth={2} />
                        {historique.map((r) => (
                          <circle key={r.date} cx={xPourDate(r.date)} cy={yPourPix(r.totalPix)} r={3} fill={couleur} />
                        ))}
                      </g>
                    );
                  })}
                </svg>
              </div>
              {/* Légende */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {apprenantsAvecData.map((a, index) => (
                  <div key={a.id} className="flex items-center gap-1.5 text-[11px] font-medium text-[#404040]">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PALETTE_COURBES[index % PALETTE_COURBES.length] }}></span>
                    <span>{a.Prénom} {a.Nom}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </PageGuard>
  );
}

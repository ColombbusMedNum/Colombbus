"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import {
  HomeIcon, ArrowLeftIcon, ArrowUpTrayIcon, DocumentArrowUpIcon,
  ChevronDownIcon, CheckCircleIcon, XCircleIcon, MinusCircleIcon,
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import {
  BADGES_NKUP, DOMAINES_NKUP, PixResultatNkup, LignePixNkupCsv,
  parserCsvPixNkup, trouverApprenantParNomPrenom, fusionnerResultatsNkup,
} from "@/lib/pixImportNkup";
import { COMPETENCES_PIX } from "@/lib/pixImport";

interface ApprenantPixNkup {
  id: string;
  Nom?: string;
  Prénom?: string;
  Session?: string;
  Suivi_Recrutement?: boolean;
  OK_NOK?: string;
  PixResultatsNkup?: PixResultatNkup[];
}

interface Props {
  collectionInscriptions: string;
  basePath: string;
  // Optionnel : complète automatiquement, à l'import, les cases "Campagne
  // Pix" ressaisies à la main sur la page de suivi de recrutement du module —
  // dont les champs varient d'un module à l'autre (Pix_Badge/Pix_Etoile
  // séparés sur Numérik'UP, Pix_Badges_Etoiles combiné sur Digital'UP...),
  // d'où ce mapping fourni par l'appelant plutôt que codé en dur ici.
  mapperVersSuiviRecrutement?: (dernier: PixResultatNkup, nbBadgesObtenus: number) => Record<string, string>;
}

// Même remarque que PixResultatsSession.tsx : l'année compte, pas seulement
// JJ/MM, pour ne pas fausser le tri chronologique en cas de tests à cheval
// sur deux années civiles.
function formaterDateFr(iso: string): string {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a.slice(2)}`;
}

function formaterPct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

// Variante de components/PixResultatsSession.tsx pour le format diagnostic
// "PARKOUR NUMERIK'UP" (palier /3 + badges + détail par compétence/domaine en
// %), trop différent du format Digital Up 96H / Numérik'UP Pro (pix/niveau
// par compétence) pour partager le même composant — voir lib/pixImportNkup.ts.
export default function PixResultatsSessionNkup({ collectionInscriptions, basePath, mapperVersSuiviRecrutement }: Props) {
  const params = useParams();
  const sessionId = decodeURIComponent((params?.id as string) || "");

  const [apprenants, setApprenants] = useState<ApprenantPixNkup[]>([]);
  const [loading, setLoading] = useState(true);

  const [texteColle, setTexteColle] = useState("");
  const [lignesParsees, setLignesParsees] = useState<LignePixNkupCsv[]>([]);
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
        setApprenants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprenantPixNkup)));
      } catch (error) {
        console.error("Erreur lors du chargement des apprenant·e·s :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [collectionInscriptions]);

  // Tou·te·s les apprenant·e·s affecté·e·s à la session (case "Suivi
  // recrutement" cochée) — pas seulement retenu·e·s (OK_NOK), contrairement à
  // components/PixResultatsSession.tsx : le questionnaire diagnostic Pix se
  // fait avant la décision d'admission.
  const apprenantsSession = useMemo(
    () =>
      apprenants
        .filter((a) => a.Session === sessionId && a.Suivi_Recrutement)
        .sort((a, b) => (a.Nom || "").localeCompare(b.Nom || "", "fr")),
    [apprenants, sessionId]
  );

  // Rapprochement CSV -> apprenant·e : nom + prénom uniquement, ce format
  // n'ayant pas de colonne email — repli manuel choisi dans le <select> de la
  // ligne non reconnue, identique à PixResultatsSession.tsx.
  const lignesAvecMatch = useMemo(
    () =>
      lignesParsees.map((ligne, index) => {
        const manuelId = correspondanceManuelle[index];
        const manuel = manuelId ? apprenantsSession.find((a) => a.id === manuelId) || null : null;
        return { ligne, index, apprenant: manuel || trouverApprenantParNomPrenom(ligne, apprenantsSession) };
      }),
    [lignesParsees, apprenantsSession, correspondanceManuelle]
  );
  const lignesReconnues = lignesAvecMatch.filter((l) => l.apprenant);
  const lignesNonReconnues = lignesAvecMatch.filter((l) => !l.apprenant);

  const analyser = (texte: string, nom: string) => {
    const { lignes, anomalies: anomaliesFichier } = parserCsvPixNkup(texte);
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
      const resultatsParApprenant = new Map<string, PixResultatNkup[]>();
      lignesReconnues.forEach(({ ligne, apprenant }) => {
        const liste = resultatsParApprenant.get(apprenant!.id) || [];
        liste.push(ligne.resultat);
        resultatsParApprenant.set(apprenant!.id, liste);
      });

      await Promise.all(
        Array.from(resultatsParApprenant.entries()).map(([id, nouveaux]) => {
          const apprenant = apprenantsSession.find((a) => a.id === id);
          const historique = fusionnerResultatsNkup(apprenant?.PixResultatsNkup, nouveaux);
          const dernier = historique[historique.length - 1];
          const nbBadgesObtenus = BADGES_NKUP.filter((b) => dernier.badges[b]).length;
          return updateDoc(doc(db, collectionInscriptions, id), {
            PixResultatsNkup: historique,
            ...(mapperVersSuiviRecrutement ? mapperVersSuiviRecrutement(dernier, nbBadgesObtenus) : {}),
          });
        })
      );

      setApprenants((prev) =>
        prev.map((a) =>
          resultatsParApprenant.has(a.id)
            ? { ...a, PixResultatsNkup: fusionnerResultatsNkup(a.PixResultatsNkup, resultatsParApprenant.get(a.id)!) }
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
                  Résultats <span className="text-[#EA601F] font-normal">Pix Préinscription</span>
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
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">Importer un export CSV Pix (Parkour Numérik'UP)</h2>
            <p className="text-[11px] text-[#404040]/60">
              Export "Résultats" du parcours diagnostic tel quel depuis pix.org (une ligne par participant·e). Ce fichier n'a pas de
              colonne email — le rapprochement se fait uniquement par nom/prénom.
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
              Aucun·e apprenant·e affecté·e à cette session pour le moment.
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
                      <th className="px-3 py-3 text-center">Progression</th>
                      <th className="px-3 py-3 text-center">Palier</th>
                      <th className="px-3 py-3 text-center">Maîtrise globale</th>
                      <th className="px-3 py-3 text-center">Badges</th>
                      <th className="px-3 py-3 text-center">Détail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]/5">
                    {apprenantsSession.map((a) => {
                      const historique = (a.PixResultatsNkup || []).slice().sort((x, y) => (x.date < y.date ? -1 : 1));
                      const dernier = historique[historique.length - 1] || null;
                      const estOuvert = ouverts.has(a.id);
                      const nbBadgesObtenus = dernier ? BADGES_NKUP.filter((b) => dernier.badges[b]).length : 0;
                      const peutOuvrir = historique.length > 0;
                      return (
                        <Fragment key={a.id}>
                          <tr className="hover:bg-[#F3F3F2]/60 transition-colors">
                            <td
                              className={`px-3 py-2.5 font-bold text-[#005259] ${peutOuvrir ? "cursor-pointer hover:underline hover:text-[#EA601F]" : ""}`}
                              onClick={peutOuvrir ? () => toggleDetail(a.id) : undefined}
                            >
                              {a.Prénom || "—"}
                            </td>
                            <td
                              className={`px-3 py-2.5 font-bold text-[#005259] uppercase ${peutOuvrir ? "cursor-pointer hover:underline hover:text-[#EA601F]" : ""}`}
                              onClick={peutOuvrir ? () => toggleDetail(a.id) : undefined}
                            >
                              {a.Nom || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-center">{dernier ? formaterDateFr(dernier.date) : "—"}</td>
                            <td className="px-3 py-2.5 text-center font-bold">{dernier ? formaterPct(dernier.progression) : "—"}</td>
                            <td className="px-3 py-2.5 text-center">
                              {dernier && dernier.palier !== null ? (
                                <span className="inline-block px-2 py-0.5 rounded-lg bg-[#005259]/10 text-[#005259] border border-[#005259]/20 text-[10px] font-bold">
                                  {dernier.palier}/3
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold">{dernier ? formaterPct(dernier.maitriseGlobale) : "—"}</td>
                            <td className="px-3 py-2.5 text-center">{dernier && dernier.partage ? `${nbBadgesObtenus}/${BADGES_NKUP.length}` : "—"}</td>
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
                              <td colSpan={8} className="bg-[#F3F3F2]/60 px-4 py-4">
                                <div className="overflow-x-auto">
                                  <table className="border-collapse text-[11px] w-full">
                                    <thead>
                                      <tr className="text-[#005259] text-[9px] uppercase tracking-widest font-bold">
                                        <th className="px-2 py-1.5 text-left">—</th>
                                        {historique.map((r) => (
                                          <th key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10">{formaterDateFr(r.date)}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#404040]/5 bg-white rounded-xl">
                                      <tr className="font-bold text-[#005259]">
                                        <td className="px-2 py-1.5">Progression</td>
                                        {historique.map((r) => (
                                          <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10">{formaterPct(r.progression)}</td>
                                        ))}
                                      </tr>
                                      <tr className="font-bold text-[#005259]">
                                        <td className="px-2 py-1.5">Palier</td>
                                        {historique.map((r) => (
                                          <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10">{r.palier !== null ? `${r.palier}/3` : "—"}</td>
                                        ))}
                                      </tr>
                                      <tr className="font-bold text-[#EA601F]">
                                        <td className="px-2 py-1.5">Maîtrise globale</td>
                                        {historique.map((r) => (
                                          <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10">{formaterPct(r.maitriseGlobale)}</td>
                                        ))}
                                      </tr>
                                      {BADGES_NKUP.map((b) => (
                                        <tr key={b}>
                                          <td className="px-2 py-1.5 text-[#404040]">{b}</td>
                                          {historique.map((r) => {
                                            const v = r.badges[b];
                                            return (
                                              <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10">
                                                {v === null || v === undefined ? (
                                                  <MinusCircleIcon className="w-3.5 h-3.5 text-[#404040]/30 inline" />
                                                ) : v ? (
                                                  <CheckCircleIcon className="w-3.5 h-3.5 text-[#005259] inline" />
                                                ) : (
                                                  <XCircleIcon className="w-3.5 h-3.5 text-[#EF736A] inline" />
                                                )}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                      {COMPETENCES_PIX.filter((c) => historique.some((r) => r.competences[c])).map((c) => (
                                        <tr key={c}>
                                          <td className="px-2 py-1.5 text-[#404040]">{c}</td>
                                          {historique.map((r) => {
                                            const comp = r.competences[c];
                                            return (
                                              <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10 text-[#404040]/80">
                                                {comp ? `${formaterPct(comp.pct)} (${comp.nbAcquisMaitrises ?? "—"}/${comp.nbAcquisCible ?? "—"})` : "—"}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                      {DOMAINES_NKUP.some((d) => historique.some((r) => r.domaines[d])) && (
                                        <tr>
                                          <td colSpan={historique.length + 1} className="px-2 pt-3 pb-1 text-[9px] font-bold uppercase tracking-wider text-[#005259]/50">
                                            Par domaine (regroupe plusieurs compétences ci-dessus)
                                          </td>
                                        </tr>
                                      )}
                                      {DOMAINES_NKUP.filter((d) => historique.some((r) => r.domaines[d])).map((d) => (
                                        <tr key={d} className="bg-[#005259]/5">
                                          <td className="px-2 py-1.5 font-bold text-[#005259]">{d}</td>
                                          {historique.map((r) => {
                                            const dom = r.domaines[d];
                                            return (
                                              <td key={r.date} className="px-2 py-1.5 text-center border-l border-[#404040]/10 font-bold text-[#005259]">
                                                {dom ? `${formaterPct(dom.pct)} (${dom.nbAcquisMaitrises ?? "—"}/${dom.nbAcquisCible ?? "—"})` : "—"}
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
        </div>
      </main>
    </PageGuard>
  );
}

"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { ArrowLeftIcon, ArrowUpTrayIcon, DocumentArrowUpIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const STRUCTURES = ["Mission locale", "E2C (Ecole de la deuxième chance)", "Pôle Emploi", "PLIE", "Epide", "PJJ", "Aucune"];

interface LigneImportee {
  Civilité: string;
  Nom: string;
  Prénom: string;
  Téléphone: string;
  Email: string;
  Adresse_Postale: string;
  Code_Postal: string;
  Ville: string;
  QPV: string;
  Age: string;
  NEET: string;
  CEJ: string;
  Situation_Plus_26: string;
  RSA: string;
  RQTH: string;
  Niveau_Etudes: string;
  Structures_Accompagnement: string[];
  Structure_Autre: string;
  ASE: string;
  Conseiller_Nom: string;
  Conseiller_Prenom: string;
  Conseiller_Email: string;
  Conseiller_Telephone: string;
  Comment_Connu: string;
  Parcours: string;
  Territoire: string;
  Session: string;
  RGPD: boolean;
  _horodateur: Date | null;
}

// Parseur CSV tolérant aux champs entre guillemets contenant des virgules,
// des guillemets échappés ("") ou des retours à la ligne.
// Un guillemet n'ouvre une section "entre guillemets" que s'il est le tout
// premier caractère du champ (norme RFC4180) — sinon un guillemet isolé au
// milieu d'une réponse libre (fréquent dans les réponses texte des
// formulaires) était pris pour une ouverture de champ et avalait ensuite
// toutes les lignes suivantes jusqu'au prochain guillemet, fusionnant
// plusieurs inscriptions en une seule ligne et faisant disparaître des
// enregistrements à l'import.
function parserCSV(texte: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let dansGuillemets = false;
  let debutDeChamp = true;
  let i = 0;
  while (i < texte.length) {
    const c = texte[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') { champ += '"'; i += 2; continue; }
        dansGuillemets = false; i++; continue;
      }
      champ += c; i++; continue;
    }
    if (c === '"' && debutDeChamp) { dansGuillemets = true; debutDeChamp = false; i++; continue; }
    if (c === ',') { ligne.push(champ); champ = ""; debutDeChamp = true; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; debutDeChamp = true; i++; continue; }
    champ += c; debutDeChamp = false; i++;
  }
  if (champ.length > 0 || ligne.length > 0) { ligne.push(champ); lignes.push(ligne); }
  return lignes.filter((l) => l.some((v) => v.trim() !== ""));
}

function normaliser(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim();
}

// Renvoie TOUS les index de colonnes dont l'en-tête correspond — certains
// exports dupliquent une même question plusieurs fois (branches du
// formulaire Google Forms), une seule est renseignée par ligne.
function trouverColonnes(entetes: string[], motif: RegExp, exclusion?: RegExp): number[] {
  const resultat: number[] = [];
  entetes.forEach((e, i) => {
    const h = normaliser(e);
    if (motif.test(h) && (!exclusion || !exclusion.test(h))) resultat.push(i);
  });
  return resultat;
}

function valeur(ligne: string[], indices: number[]): string {
  for (const i of indices) {
    const v = (ligne[i] || "").trim();
    if (v) return v;
  }
  return "";
}

function normaliserAge(brut: string): string {
  const v = brut.trim();
  if (!v) return "";
  if (v.includes("+")) return "+ de 26 ans";
  return v.replace(/\s*ans?$/i, "").trim();
}

function normaliserCivilite(brut: string): string {
  const v = normaliser(brut);
  if (v.startsWith("mme") || v.startsWith("madame")) return "Mme";
  return "M.";
}

function normaliserOuiNon(brut: string): string {
  const v = normaliser(brut);
  if (v.startsWith("oui")) return "Oui";
  if (v.startsWith("non")) return "Non";
  return brut.trim() ? "Non" : "Non";
}

function parseHorodateur(brut: string): Date | null {
  const m = brut.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] || "0"));
  return isNaN(d.getTime()) ? null : d;
}

// Construit une ligne exploitable à partir d'un tableau de cellules brutes et
// de la carte des colonnes détectées pour ce fichier.
function mapperLigne(ligne: string[], colonnes: Record<string, number[]>): LigneImportee {
  const structureBrute = valeur(ligne, colonnes.structure);
  const structuresDetectees = structureBrute
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const structuresConnues = structuresDetectees.filter((s) => STRUCTURES.some((ref) => normaliser(ref) === normaliser(s)));
  const structuresInconnues = structuresDetectees.filter((s) => !STRUCTURES.some((ref) => normaliser(ref) === normaliser(s)));

  return {
    Civilité: normaliserCivilite(valeur(ligne, colonnes.civilite)),
    Nom: valeur(ligne, colonnes.nom).toUpperCase(),
    Prénom: valeur(ligne, colonnes.prenom),
    Téléphone: valeur(ligne, colonnes.telephone),
    Email: valeur(ligne, colonnes.email),
    Adresse_Postale: valeur(ligne, colonnes.adresse),
    Code_Postal: valeur(ligne, colonnes.codePostal),
    Ville: valeur(ligne, colonnes.ville),
    QPV: valeur(ligne, colonnes.qpv) || "Je ne sais pas",
    Age: normaliserAge(valeur(ligne, colonnes.age)),
    NEET: normaliserOuiNon(valeur(ligne, colonnes.neet)),
    CEJ: normaliserOuiNon(valeur(ligne, colonnes.cej)),
    Situation_Plus_26: valeur(ligne, colonnes.situationPlus26),
    RSA: normaliserOuiNon(valeur(ligne, colonnes.rsa)),
    RQTH: normaliserOuiNon(valeur(ligne, colonnes.rqth)),
    Niveau_Etudes: valeur(ligne, colonnes.niveauEtudes),
    Structures_Accompagnement: structuresConnues,
    Structure_Autre: structuresInconnues.join(", "),
    ASE: normaliserOuiNon(valeur(ligne, colonnes.ase)),
    Conseiller_Nom: valeur(ligne, colonnes.conseillerNom),
    Conseiller_Prenom: valeur(ligne, colonnes.conseillerPrenom),
    Conseiller_Email: valeur(ligne, colonnes.conseillerEmail),
    Conseiller_Telephone: valeur(ligne, colonnes.conseillerTelephone),
    Comment_Connu: valeur(ligne, colonnes.commentConnu),
    Parcours: valeur(ligne, colonnes.parcours),
    Territoire: valeur(ligne, colonnes.territoire),
    Session: valeur(ligne, colonnes.session),
    RGPD: normaliser(valeur(ligne, colonnes.rgpd)).startsWith("oui") || !colonnes.rgpd.length,
    _horodateur: parseHorodateur(valeur(ligne, colonnes.horodateur)),
  };
}

function detecterColonnes(entetes: string[]): Record<string, number[]> {
  return {
    civilite: trouverColonnes(entetes, /civilite/),
    nom: trouverColonnes(entetes, /nom du participant/),
    prenom: trouverColonnes(entetes, /prenom du participant/),
    telephone: trouverColonnes(entetes, /telephone du participant/),
    email: trouverColonnes(entetes, /mail/, /conseiller/),
    adresse: trouverColonnes(entetes, /adresse postale/),
    codePostal: trouverColonnes(entetes, /code postal/),
    ville: trouverColonnes(entetes, /ville de residence/),
    qpv: trouverColonnes(entetes, /qpv/),
    age: trouverColonnes(entetes, /age du participant/),
    neet: trouverColonnes(entetes, /n\.?e\.?e\.?t/),
    cej: trouverColonnes(entetes, /engagement jeune/),
    situationPlus26: trouverColonnes(entetes, /26 ans.*situation|situation.*26 ans/),
    rsa: trouverColonnes(entetes, /rsa/),
    rqth: trouverColonnes(entetes, /rqth|situation de handicap/),
    niveauEtudes: trouverColonnes(entetes, /niveau d.?etude/),
    structure: trouverColonnes(entetes, /structure d.?accompagnement/),
    ase: trouverColonnes(entetes, /aide sociale a l.?enfance|\(ase\)/),
    conseillerNom: trouverColonnes(entetes, /nom du conseiller/),
    conseillerPrenom: trouverColonnes(entetes, /prenom du conseiller/),
    conseillerEmail: trouverColonnes(entetes, /mail du conseiller/),
    conseillerTelephone: trouverColonnes(entetes, /telephone conseiller/),
    commentConnu: trouverColonnes(entetes, /comment avez-vous connu/),
    rgpd: trouverColonnes(entetes, /rgpd/),
    parcours: trouverColonnes(entetes, /type de parkour|parcours de formation/),
    territoire: trouverColonnes(entetes, /territoire|departement de residence/),
    session: trouverColonnes(entetes, /session souhait/),
    horodateur: trouverColonnes(entetes, /horodateur/),
  };
}

// anomalies = n° de ligne (dans le fichier source, en-tête compris) dont le
// nombre de colonnes diffère de l'en-tête — signe probable qu'un guillemet
// mal formé ou une cellule mal échappée a fusionné plusieurs lignes réelles
// en une seule lors du parsing. Ne contient que des numéros de ligne, jamais
// de contenu, pour que l'équipe puisse vérifier elle-même dans le fichier
// source sans qu'aucune donnée personnelle ne transite ailleurs.
function parserFichier(texte: string): { lignes: LigneImportee[]; anomalies: number[] } {
  const lignesBrutes = parserCSV(texte);
  if (lignesBrutes.length === 0) return { lignes: [], anomalies: [] };
  // Certains exports ("Suivi...") ont une première ligne parasite (numéros
  // de colonnes) avant le vrai en-tête — on la détecte et on la saute.
  const contientParticipant = (l: string[]) => l.some((c) => normaliser(c).includes("participant"));
  const indexEntete = !contientParticipant(lignesBrutes[0]) && lignesBrutes[1] && contientParticipant(lignesBrutes[1]) ? 1 : 0;
  const entetes = lignesBrutes[indexEntete];
  const colonnes = detecterColonnes(entetes);
  const donnees = lignesBrutes.slice(indexEntete + 1);
  const anomalies = donnees
    .map((l, i) => (l.length !== entetes.length ? i + indexEntete + 2 : null))
    .filter((n): n is number => n !== null);
  return { lignes: donnees.map((l) => mapperLigne(l, colonnes)), anomalies };
}

export default function ImporterNumerikUpPage() {
  const { role, loading: loadingPermissions } = usePermissions();
  const [texteColle, setTexteColle] = useState("");
  const [lignesParsees, setLignesParsees] = useState<LigneImportee[]>([]);
  const [anomalies, setAnomalies] = useState<{ fichier: string; lignes: number[] }[]>([]);
  const [nomFichier, setNomFichier] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);

  const analyser = (texte: string, nom: string) => {
    const { lignes, anomalies: anomaliesFichier } = parserFichier(texte);
    setLignesParsees((prev) => [...prev, ...lignes]);
    if (anomaliesFichier.length > 0) {
      setAnomalies((prev) => [...prev, { fichier: nom, lignes: anomaliesFichier }]);
    }
    setNomFichier((prev) => (prev ? `${prev} + ${nom}` : nom));
    setResultat(null);
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
    setResultat(null);
  };

  const importer = async () => {
    if (lignesParsees.length === 0) return;
    setEnCours(true);
    try {
      const taillePaquet = 400;
      for (let i = 0; i < lignesParsees.length; i += taillePaquet) {
        const paquet = lignesParsees.slice(i, i + taillePaquet);
        const batch = writeBatch(db);
        paquet.forEach((l) => {
          const { _horodateur, ...donnees } = l;
          const ref = doc(collection(db, "inscriptions_numerikup"));
          batch.set(ref, {
            ...donnees,
            createdAt: _horodateur ? Timestamp.fromDate(_horodateur) : serverTimestamp(),
          });
        });
        await batch.commit();
      }
      setResultat(`${lignesParsees.length} préinscription(s) importée(s) avec succès.`);
      setLignesParsees([]);
      setNomFichier("");
    } catch (error) {
      console.error("Erreur lors de l'import des préinscriptions Numérik'UP :", error);
      setResultat("Une erreur est survenue pendant l'import — voir la console.");
    } finally {
      setEnCours(false);
    }
  };

  if (loadingPermissions) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement...
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-center p-8 antialiased`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#EF736A]">Page réservée à l'administrateur</p>
        <Link
          href="/mediation/actions-collectives/reponses/numerik-up"
          className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
        >
          <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
          <span>Retour aux préinscriptions</span>
        </Link>
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Importer <span className="text-[#EA601F] font-semibold">des préinscriptions</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Import CSV (exports Google Forms / Sheets) — traité entièrement dans ton navigateur
              </p>
            </div>
          </div>

          <Link
            href="/mediation/actions-collectives/reponses/numerik-up"
            className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
          >
            <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
            <span>Préinscriptions</span>
          </Link>
        </div>

        {/* SOURCE */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">1. Charger un ou plusieurs fichiers CSV</h2>
          <p className="text-[11px] text-[#404040]/60">
            Chaque fichier peut avoir une mise en page différente (export brut du formulaire, feuille de suivi...) — les colonnes sont
            reconnues automatiquement par leur intitulé. Tu peux charger plusieurs fichiers à la suite, ils s'additionnent.
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
        </div>

        {/* ANOMALIES DE PARSING */}
        {anomalies.length > 0 && (
          <div className="bg-[#F9C44E]/10 border border-[#F9C44E] rounded-2xl p-5 shadow-sm space-y-2">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#8a6d1a]">
              ⚠️ Anomalie(s) détectée(s) — des enregistrements pourraient manquer
            </h2>
            <p className="text-[11px] text-[#404040]/70">
              Certaines lignes du fichier source n'ont pas le même nombre de colonnes que l'en-tête. C'est souvent le signe qu'un
              guillemet mal fermé dans une réponse libre a fusionné plusieurs inscriptions en une seule ligne lors de la lecture —
              vérifie ces lignes directement dans le fichier d'origine (ouvre-le dans un tableur) et corrige-les avant de ré-importer si besoin.
            </p>
            {anomalies.map((a, i) => (
              <p key={i} className="text-[11px] text-[#404040]/70">
                <span className="font-bold">{a.fichier}</span> — ligne(s) n° {a.lignes.join(", ")}
              </p>
            ))}
          </div>
        )}

        {/* APERÇU */}
        {lignesParsees.length > 0 && (
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#005259]">
                2. Aperçu — {lignesParsees.length} ligne{lignesParsees.length > 1 ? "s" : ""} détectée{lignesParsees.length > 1 ? "s" : ""}
              </h2>
              <button type="button" onClick={reinitialiser} className="text-[10px] font-bold uppercase tracking-wider text-[#404040]/50 hover:text-[#EF736A] cursor-pointer">
                Tout effacer
              </button>
            </div>
            <p className="text-[10px] text-[#404040]/50">Fichier(s) : {nomFichier}</p>
            <div className="overflow-x-auto border border-[#404040]/10 rounded-xl">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[9px] uppercase tracking-widest font-bold">
                    <th className="px-3 py-2">Prénom</th>
                    <th className="px-3 py-2">Nom</th>
                    <th className="px-3 py-2">Territoire</th>
                    <th className="px-3 py-2">Parcours</th>
                    <th className="px-3 py-2">Session</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#404040]/5">
                  {lignesParsees.slice(0, 5).map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{l.Prénom || "—"}</td>
                      <td className="px-3 py-2">{l.Nom || "—"}</td>
                      <td className="px-3 py-2">{l.Territoire || "—"}</td>
                      <td className="px-3 py-2 max-w-[220px] truncate">{l.Parcours || "—"}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{l.Session || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lignesParsees.length > 5 && (
                <p className="text-[10px] text-[#404040]/40 px-3 py-2">... et {lignesParsees.length - 5} autre(s) ligne(s).</p>
              )}
            </div>
            <button
              type="button"
              onClick={importer}
              disabled={enCours}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#EA601F] hover:bg-[#EF736A] disabled:opacity-50 text-white rounded-xl transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              {enCours ? "Import en cours..." : `Importer ${lignesParsees.length} préinscription(s)`}
            </button>
          </div>
        )}

        {resultat && (
          <div className="bg-white border border-[#005259]/20 rounded-2xl p-5 shadow-sm text-xs font-bold text-[#005259]">
            {resultat}
          </div>
        )}

      </div>
    </main>
    </PageGuard>
  );
}

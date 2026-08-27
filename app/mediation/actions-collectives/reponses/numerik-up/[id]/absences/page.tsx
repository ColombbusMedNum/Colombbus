"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, ArrowLeftIcon, TrashIcon, PlusIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

interface Apprenant {
  id: string;
  Prénom?: string;
  Nom?: string;
  Session?: string;
  Suivi_Recrutement?: boolean;
  OK_NOK?: string;
  // Un code par jour posé depuis la grille Évolution ("A" = absence
  // justifiée, "ANJ" = non justifiée) — voir rattraperAbsences ci-dessous.
  Evolution?: Record<string, string>;
  // Journal des absences justifiées (une entrée par évènement signalé).
  Absences?: AbsenceRecord[];
  // Nombre d'heures manquées un jour donné en cas de grand retard, clé
  // "AAAA-MM-JJ" — voir la grille Évolution, même champ.
  Evolution_Retards?: Record<string, string>;
}

interface AbsenceRecord {
  date: string;
  justifiee: boolean;
  type: string;
  raison: string;
  reference: string;
  lien: string;
}

const TYPES_JUSTIFICATIF = ["Email", "SMS", "Téléphone", "Autre"];

// Total d'heures manquées pour retard sur la session (même champ que la
// grille Évolution) — cumulé toutes dates confondues, pas seulement les
// jours renseignés dans le journal d'absences.
function cumulRetardHeures(retards: Record<string, string> | undefined): number {
  return Object.values(retards || {}).reduce((somme, v) => somme + (parseFloat((v || "0").replace(",", ".")) || 0), 0);
}

// Affiche une date stockée au format ISO ("AAAA-MM-JJ", tel que renvoyé par
// un <input type="date">) au format français "JJ/MM/AAAA".
function formaterDateFr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// Suivi des absences justifiées d'une session — séparé de la grille
// Évolution (trop chargée avec des sessions longues) : ajout, édition et
// suppression d'un journal d'évènements, plus un cumul par apprenant·e.
export default function AbsencesSessionPage() {
  const params = useParams();
  const sessionId = decodeURIComponent((params?.id as string) || "");

  const [apprenants, setApprenants] = useState<Apprenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [nouvelleAbsence, setNouvelleAbsence] = useState({ apprenantId: "", date: "", justifiee: true, type: "", raison: "", reference: "", lien: "" });
  const [brouillonAbsence, setBrouillonAbsence] = useState<{ apprenantId: string; indexRecord: number; valeurs: AbsenceRecord } | null>(null);
  const [rattrapageEnCours, setRattrapageEnCours] = useState(false);
  const [messageRattrapage, setMessageRattrapage] = useState<string | null>(null);

  useEffect(() => {
    const charger = async () => {
      try {
        const snap = await getDocs(query(collection(db, "inscriptions_numerikup"), orderBy("createdAt", "desc")));
        setApprenants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Apprenant)));
      } catch (error) {
        console.error("Erreur lors du chargement des apprenant·e·s :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  const apprenantsSession = useMemo(
    () =>
      apprenants
        .filter((a) => a.Session === sessionId && a.Suivi_Recrutement && a.OK_NOK === "OK")
        .sort((a, b) => (a.Nom || "").localeCompare(b.Nom || "", "fr")),
    [apprenants, sessionId]
  );

  // Journal des absences, à plat, trié par date — une ligne par évènement.
  const journalAbsences = useMemo(
    () =>
      apprenantsSession
        .flatMap((a, indexRoster) =>
          (a.Absences || []).map((rec, indexRecord) => ({ ...rec, apprenant: a, indexRoster: indexRoster + 1, indexRecord }))
        )
        .sort((x, y) => x.date.localeCompare(y.date)),
    [apprenantsSession]
  );

  const ajouterAbsence = async () => {
    const apprenant = apprenantsSession.find((a) => a.id === nouvelleAbsence.apprenantId);
    if (!apprenant || !nouvelleAbsence.date) return;
    const enregistrement: AbsenceRecord = {
      date: nouvelleAbsence.date,
      justifiee: nouvelleAbsence.justifiee,
      type: nouvelleAbsence.type,
      raison: nouvelleAbsence.raison,
      reference: nouvelleAbsence.reference,
      lien: nouvelleAbsence.lien,
    };
    const nouvelleListe = [...(apprenant.Absences || []), enregistrement];
    setApprenants((prev) => prev.map((a) => (a.id === apprenant.id ? { ...a, Absences: nouvelleListe } : a)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikup", apprenant.id), { Absences: nouvelleListe });
    } catch (error) {
      console.error("Erreur lors de l'ajout de l'absence :", error);
    }
    setNouvelleAbsence({ apprenantId: "", date: "", justifiee: true, type: "", raison: "", reference: "", lien: "" });
  };

  // Édition d'une absence : un brouillon local, rien n'est écrit tant que
  // "Enregistrer" n'est pas cliqué — évite tout effacement accidentel au fil
  // de la frappe.
  const debuterModificationAbsence = (apprenantId: string, indexRecord: number, valeurs: AbsenceRecord) => {
    setBrouillonAbsence({ apprenantId, indexRecord, valeurs: { ...valeurs } });
  };

  const annulerModificationAbsence = () => setBrouillonAbsence(null);

  const enregistrerModificationAbsence = async () => {
    if (!brouillonAbsence) return;
    const { apprenantId, indexRecord, valeurs } = brouillonAbsence;
    const apprenant = apprenants.find((a) => a.id === apprenantId);
    if (!apprenant) return;
    const nouvelleListe = (apprenant.Absences || []).map((r, i) => (i === indexRecord ? valeurs : r));
    setApprenants((prev) => prev.map((a) => (a.id === apprenantId ? { ...a, Absences: nouvelleListe } : a)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikup", apprenantId), { Absences: nouvelleListe });
    } catch (error) {
      console.error("Erreur lors de la modification de l'absence :", error);
    }
    setBrouillonAbsence(null);
  };

  const supprimerAbsence = async (apprenantId: string, indexRecord: number) => {
    const apprenant = apprenants.find((a) => a.id === apprenantId);
    if (!apprenant) return;
    const nouvelleListe = (apprenant.Absences || []).filter((_, i) => i !== indexRecord);
    setApprenants((prev) => prev.map((a) => (a.id === apprenantId ? { ...a, Absences: nouvelleListe } : a)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikup", apprenantId), { Absences: nouvelleListe });
    } catch (error) {
      console.error("Erreur lors de la suppression de l'absence :", error);
    }
  };

  // Rattrapage : reprend, pour les dates codées "A"/"ANJ" dans la grille
  // Évolution mais absentes du journal (ex. posées avant l'ajout de la
  // synchronisation automatique dans mettreAJourCase), une entrée dans
  // Absences. N'écrase jamais une entrée déjà présente (une modification
  // manuelle faite depuis ce journal reste prioritaire).
  const rattraperAbsences = async () => {
    setRattrapageEnCours(true);
    let nbAjoutees = 0;
    let nbApprenants = 0;
    try {
      for (const apprenant of apprenantsSession) {
        const dejaConnues = new Set((apprenant.Absences || []).map((r) => r.date));
        const aAjouter: AbsenceRecord[] = [];
        Object.entries(apprenant.Evolution || {}).forEach(([date, code]) => {
          if ((code === "A" || code === "ANJ") && !dejaConnues.has(date)) {
            aAjouter.push({ date, justifiee: code === "A", type: "", raison: "", reference: "", lien: "" });
          }
        });
        if (aAjouter.length === 0) continue;
        const nouvelleListe = [...(apprenant.Absences || []), ...aAjouter];
        await updateDoc(doc(db, "inscriptions_numerikup", apprenant.id), { Absences: nouvelleListe });
        setApprenants((prev) => prev.map((a) => (a.id === apprenant.id ? { ...a, Absences: nouvelleListe } : a)));
        nbAjoutees += aAjouter.length;
        nbApprenants += 1;
      }
      setMessageRattrapage(
        nbAjoutees > 0
          ? `${nbAjoutees} absence(s) reprise(s) depuis la grille Évolution, pour ${nbApprenants} apprenant·e(s).`
          : "Rien à rattraper : le journal des absences est déjà à jour."
      );
    } catch (error) {
      console.error("Erreur lors du rattrapage des absences :", error);
      setMessageRattrapage("Une erreur est survenue pendant le rattrapage.");
    } finally {
      setRattrapageEnCours(false);
    }
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
                Suivi des <span className="text-[#EA601F] font-semibold">absences</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Session : {sessionId || "—"} — {apprenantsSession.length} apprenant{apprenantsSession.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              onClick={rattraperAbsences}
              disabled={rattrapageEnCours}
              title="Reprend les absences déjà codées 'A'/'ANJ' dans la grille Évolution mais absentes du journal ci-dessous (ex. posées avant l'ajout de ce suivi)"
              className="flex items-center gap-2 bg-white hover:bg-[#EA601F] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#EA601F] transition-all text-xs font-bold uppercase tracking-wider shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{rattrapageEnCours ? "Rattrapage..." : "Rattraper depuis Évolution"}</span>
            </button>
            <Link
              href={`/mediation/actions-collectives/reponses/numerik-up/${encodeURIComponent(sessionId)}/evolution`}
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Évolution</span>
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

        {messageRattrapage && (
          <div className="bg-[#F9945D]/10 border border-[#F9945D]/30 text-[#EA601F] text-xs font-bold px-4 py-3 rounded-xl">
            {messageRattrapage}
          </div>
        )}

        {apprenantsSession.length === 0 ? (
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
            Aucun·e apprenant·e retenu·e (OK) pour cette session.
          </div>
        ) : (
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">

            {/* Cumul par apprenant·e */}
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs w-full">
                <thead>
                  <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-3 py-3 text-center">Δ</th>
                    <th className="px-3 py-3">Prénom</th>
                    <th className="px-3 py-3">Nom</th>
                    <th className="px-3 py-3 text-center">Cumul absences justifiées</th>
                    <th className="px-3 py-3 text-center">Cumul absences non justifiées</th>
                    <th className="px-3 py-3 text-center">Total absences</th>
                    <th className="px-3 py-3 text-center">Cumul retards (h)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#404040]/5">
                  {apprenantsSession.map((a, index) => (
                    <tr key={a.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                      <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{a.Prénom || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">{a.Nom || "—"}</td>
                      <td className="px-3 py-2 text-center font-bold text-[#005259]">
                        {(a.Absences || []).filter((r) => r.justifiee).length}
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-[#EF4444]">
                        {(a.Absences || []).filter((r) => !r.justifiee).length}
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-[#005259]">
                        {(a.Absences || []).length}
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-[#EA601F]">
                        {cumulRetardHeures(a.Evolution_Retards)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Journal des absences */}
            <div className="overflow-x-auto border-t border-[#404040]/10">
              <table className="border-collapse text-xs w-full">
                <thead>
                  <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3 text-center">Δ</th>
                    <th className="px-3 py-3 text-center">JA</th>
                    <th className="px-3 py-3 text-center">Nb</th>
                    <th className="px-3 py-3">Prénom</th>
                    <th className="px-3 py-3">Nom</th>
                    <th className="px-3 py-3">Type justificatif</th>
                    <th className="px-3 py-3">Raison</th>
                    <th className="px-3 py-3">N° enregistrement Drive partagé</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#404040]/5">
                  {journalAbsences.map((rec) => {
                    const enEdition = brouillonAbsence?.apprenantId === rec.apprenant.id && brouillonAbsence?.indexRecord === rec.indexRecord;
                    if (enEdition && brouillonAbsence) {
                      const b = brouillonAbsence.valeurs;
                      const maj = <K extends keyof AbsenceRecord>(champ: K, valeur: AbsenceRecord[K]) =>
                        setBrouillonAbsence({ ...brouillonAbsence, valeurs: { ...b, [champ]: valeur } });
                      return (
                        <tr key={`${rec.apprenant.id}-${rec.indexRecord}`} className="bg-[#005259]/5">
                          <td className="px-3 py-2">
                            <input type="date" value={b.date} onChange={(e) => maj("date", e.target.value)} className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                          </td>
                          <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{rec.indexRoster}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={b.justifiee} onChange={(e) => maj("justifiee", e.target.checked)} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                          </td>
                          <td className="px-3 py-2 text-center">{String(rec.indexRecord + 1).padStart(2, "0")}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{rec.apprenant.Prénom || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">{rec.apprenant.Nom || "—"}</td>
                          <td className="px-3 py-2">
                            <select value={b.type} onChange={(e) => maj("type", e.target.value)} className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none">
                              <option value="">-- Type --</option>
                              {TYPES_JUSTIFICATIF.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={b.raison} onChange={(e) => maj("raison", e.target.value)} placeholder="Raison" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                          </td>
                          <td className="px-3 py-2 space-y-1">
                            <input type="text" value={b.reference} onChange={(e) => maj("reference", e.target.value)} placeholder="Nom du fichier Drive" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                            <input type="url" value={b.lien} onChange={(e) => maj("lien", e.target.value)} placeholder="Lien Drive (https://...)" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <button type="button" onClick={enregistrerModificationAbsence} className="p-1.5 mr-1 bg-[#005259]/10 hover:bg-[#005259] text-[#005259] hover:text-white border border-[#005259]/30 rounded-lg transition-colors cursor-pointer" title="Enregistrer">
                              <CheckIcon className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={annulerModificationAbsence} className="p-1.5 bg-[#404040]/10 hover:bg-[#404040] text-[#404040] hover:text-white border border-[#404040]/20 rounded-lg transition-colors cursor-pointer" title="Annuler">
                              <XMarkIcon className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    return (
                    <tr key={`${rec.apprenant.id}-${rec.indexRecord}`} className="hover:bg-[#F3F3F2]/60 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">{formaterDateFr(rec.date)}</td>
                      <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{rec.indexRoster}</td>
                      <td className="px-3 py-2 text-center">{rec.justifiee ? "✔" : ""}</td>
                      <td className="px-3 py-2 text-center">{String(rec.indexRecord + 1).padStart(2, "0")}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{rec.apprenant.Prénom || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">{rec.apprenant.Nom || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{rec.type || "—"}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={rec.raison}>{rec.raison || "—"}</td>
                      <td className="px-3 py-2 max-w-[220px] truncate" title={rec.reference}>
                        {rec.reference ? (
                          rec.lien ? (
                            <a href={rec.lien} target="_blank" rel="noopener noreferrer" className="text-[#005259] font-bold underline hover:text-[#EA601F]">
                              {rec.reference}
                            </a>
                          ) : (
                            rec.reference
                          )
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <button type="button" onClick={() => debuterModificationAbsence(rec.apprenant.id, rec.indexRecord, rec)} className="p-1.5 mr-1 bg-[#005259]/10 hover:bg-[#005259] text-[#005259] hover:text-white border border-[#005259]/30 rounded-lg transition-colors cursor-pointer" title="Modifier">
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => supprimerAbsence(rec.apprenant.id, rec.indexRecord)} className="p-1.5 bg-[#EF736A]/10 hover:bg-[#EF736A] text-[#EF736A] hover:text-white border border-[#EF736A]/30 rounded-lg transition-colors cursor-pointer" title="Supprimer">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                  <tr className="bg-[#F3F3F2]/40">
                    <td className="px-3 py-2">
                      <input type="date" value={nouvelleAbsence.date} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, date: e.target.value })} className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                    </td>
                    <td colSpan={2} className="px-3 py-2 text-center">
                      <input type="checkbox" checked={nouvelleAbsence.justifiee} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, justifiee: e.target.checked })} className="w-4 h-4 accent-[#005259] cursor-pointer" />
                    </td>
                    <td colSpan={2} className="px-3 py-2">
                      <select value={nouvelleAbsence.apprenantId} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, apprenantId: e.target.value })} className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none">
                        <option value="">-- Apprenant·e --</option>
                        {apprenantsSession.map((a) => (
                          <option key={a.id} value={a.id}>{a.Prénom} {a.Nom}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select value={nouvelleAbsence.type} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, type: e.target.value })} className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none">
                        <option value="">-- Type --</option>
                        {TYPES_JUSTIFICATIF.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={nouvelleAbsence.raison} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, raison: e.target.value })} placeholder="Raison" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                    </td>
                    <td className="px-3 py-2 space-y-1">
                      <input type="text" value={nouvelleAbsence.reference} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, reference: e.target.value })} placeholder="Nom du fichier Drive" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                      <input type="url" value={nouvelleAbsence.lien} onChange={(e) => setNouvelleAbsence({ ...nouvelleAbsence, lien: e.target.value })} placeholder="Lien Drive (https://...)" className="w-full px-2 py-1.5 bg-white border border-[#404040]/15 rounded-lg text-[11px] outline-none" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={ajouterAbsence} className="p-1.5 bg-[#EA601F] hover:bg-[#EF736A] text-white rounded-lg transition-colors cursor-pointer">
                        <PlusIcon className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
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

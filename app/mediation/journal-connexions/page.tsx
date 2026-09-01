"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { useMediateurs } from "@/lib/MediateursProvider";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import {
  HomeIcon,
  FingerPrintIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const MOIS = [
  { value: "01", label: "Janvier" }, { value: "02", label: "Février" }, { value: "03", label: "Mars" },
  { value: "04", label: "Avril" }, { value: "05", label: "Mai" }, { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" }, { value: "08", label: "Août" }, { value: "09", label: "Septembre" },
  { value: "10", label: "Octobre" }, { value: "11", label: "Novembre" }, { value: "12", label: "Décembre" },
];

interface SessionConnexion {
  id: string;
  mediatId: string;
  debut?: Timestamp;
  dernierHeartbeat?: Timestamp;
  fin?: Timestamp | null;
}

// Une ligne par session de connexion (voir lib/PermissionsProvider.tsx qui
// crée le document au login et le prolonge par heartbeat toutes les 3
// minutes tant que l'onglet reste ouvert). "fin" n'est posé que si la
// personne s'est déconnectée explicitement (bouton Déconnexion) ; sinon
// dernierHeartbeat sert d'estimation de fin de session — pas une valeur
// exacte, mais une bonne approximation même sans déconnexion propre
// (fermeture d'onglet, coupure réseau...).
export default function JournalConnexions() {
  const { mediateurs } = useMediateurs();
  const [sessions, setSessions] = useState<SessionConnexion[]>([]);
  const [loading, setLoading] = useState(true);

  const [anneeFiltre, setAnneeFiltre] = useState(String(new Date().getFullYear()));
  const [moisFiltre, setMoisFiltre] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [medFiltre, setMedFiltre] = useState("tous");

  // Panneau "ACI non connectés" : requête indépendante du filtre principal,
  // scopée à un seul jour choisi (par défaut aujourd'hui) — l'ACI concerné
  // peut tomber hors du mois actuellement affiché dans le tableau.
  const [jourAbsences, setJourAbsences] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [sessionsJour, setSessionsJour] = useState<SessionConnexion[]>([]);

  useEffect(() => {
    const [y, m, d] = jourAbsences.split("-").map(Number);
    const debutJour = new Date(y, m - 1, d);
    const finJour = new Date(y, m - 1, d + 1);
    const q = query(
      collection(db, "journal_connexions"),
      where("debut", ">=", Timestamp.fromDate(debutJour)),
      where("debut", "<", Timestamp.fromDate(finJour))
    );
    const unsub = onSnapshot(
      q,
      (snap) => setSessionsJour(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      (err) => console.error("Erreur de chargement des connexions du jour :", err)
    );
    return () => unsub();
  }, [jourAbsences]);

  useEffect(() => {
    setLoading(true);
    const annee = Number(anneeFiltre);
    const debutRange = moisFiltre === "tous" ? new Date(annee, 0, 1) : new Date(annee, Number(moisFiltre) - 1, 1);
    const finRange = moisFiltre === "tous" ? new Date(annee + 1, 0, 1) : new Date(annee, Number(moisFiltre), 1);

    const q = query(
      collection(db, "journal_connexions"),
      where("debut", ">=", Timestamp.fromDate(debutRange)),
      where("debut", "<", Timestamp.fromDate(finRange))
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setLoading(false);
      },
      (err) => {
        console.error("Erreur de chargement du journal des connexions :", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [anneeFiltre, moisFiltre]);

  const mediateursParId = useMemo(() => {
    const map = new Map<string, any>();
    mediateurs.forEach((m: any) => map.set(m.id, m));
    return map;
  }, [mediateurs]);

  const nomMediateur = (id: string) => {
    const m = mediateursParId.get(id);
    return m ? `${m.prenom || ""} ${m.nom || ""}`.trim() || "Sans nom" : "Compte supprimé";
  };

  const mediateursTries = useMemo(() => {
    return [...mediateurs].sort((a: any, b: any) =>
      `${a.prenom || ""} ${a.nom || ""}`.localeCompare(`${b.prenom || ""} ${b.nom || ""}`, "fr")
    );
  }, [mediateurs]);

  // ACI actifs n'ayant ouvert aucune session le jour choisi — ne tient pas
  // compte du planning individuel (jour de repos, congé...), juste de la
  // présence ou non d'une connexion ce jour-là.
  const aciAbsents = useMemo(() => {
    const idsConnectes = new Set(sessionsJour.map((s) => s.mediatId));
    return mediateurs
      .filter((m: any) => m.statut === "ACI" && m.actif !== false && !idsConnectes.has(m.id))
      .sort((a: any, b: any) => (a.nom || "").localeCompare(b.nom || "", "fr"));
  }, [mediateurs, sessionsJour]);

  const totalAciActifs = useMemo(
    () => mediateurs.filter((m: any) => m.statut === "ACI" && m.actif !== false).length,
    [mediateurs]
  );

  const sessionsFiltrees = useMemo(() => {
    return sessions
      .filter((s) => medFiltre === "tous" || s.mediatId === medFiltre)
      .sort((a, b) => (b.debut?.toMillis() || 0) - (a.debut?.toMillis() || 0));
  }, [sessions, medFiltre]);

  const dureeMinutes = (s: SessionConnexion): number | null => {
    if (!s.debut) return null;
    const fin = s.fin || s.dernierHeartbeat;
    if (!fin) return null;
    return Math.max(0, Math.round((fin.toMillis() - s.debut.toMillis()) / 60000));
  };

  const formatDuree = (minutes: number | null) => {
    if (minutes === null) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
  };

  const formatDate = (ts?: Timestamp) =>
    ts ? ts.toDate().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const formatHeure = (ts?: Timestamp | null) =>
    ts ? ts.toDate().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

  const totalMinutesFiltre = useMemo(
    () => sessionsFiltrees.reduce((acc, s) => acc + (dureeMinutes(s) || 0), 0),
    [sessionsFiltrees]
  );

  const exporterCSV = () => {
    if (sessionsFiltrees.length === 0) return;
    const headers = "Médiateur;Date;Heure de connexion;Heure de fin (ou dernière activité);Durée (min);Déconnexion explicite\n";
    const rows = sessionsFiltrees.map((s) => {
      const minutes = dureeMinutes(s);
      return `${nomMediateur(s.mediatId)};${formatDate(s.debut)};${formatHeure(s.debut)};${formatHeure(s.fin || s.dernierHeartbeat)};${minutes ?? ""};${s.fin ? "Oui" : "Non"}`;
    });
    const blob = new Blob([headers + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `journal_connexions_${anneeFiltre}${moisFiltre !== "tous" ? `-${moisFiltre}` : ""}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  const anneesDisponibles = useMemo(() => {
    const anneeActuelle = new Date().getFullYear();
    return Array.from({ length: 4 }, (_, i) => String(anneeActuelle - i));
  }, []);

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#EA601F] font-bold animate-pulse text-xs uppercase tracking-widest`}>
        Chargement du journal des connexions...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_journal_connexions">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-6xl mx-auto relative z-10 space-y-6">
          {/* HEADER */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
                title="Retour à l'accueil"
              >
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
              <div className="flex items-center gap-3">
                <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
                <div>
                  <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                    Journal <span className="text-[#EA601F] font-normal">des Connexions</span>
                  </h1>
                  <p className="text-xs text-[#404040]/70 mt-0.5">
                    Qui s'est connecté, quand, et combien de temps
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ACI NON CONNECTÉS (jour choisi) */}
          <div className="p-4 bg-[#F9945D]/10 border border-[#F9945D]/30 rounded-2xl space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#EA601F]">
                <ExclamationTriangleIcon className="w-4 h-4" />
                <span>ACI non connectés le</span>
              </div>
              <input
                type="date"
                value={jourAbsences}
                onChange={(e) => setJourAbsences(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[#F9945D]/40 text-[#404040] rounded-lg text-xs font-bold outline-none focus:border-[#EA601F] cursor-pointer"
              />
            </div>
            {aciAbsents.length === 0 ? (
              <p className="text-xs text-[#005259] font-semibold">
                ✅ Tous les ACI actifs ({totalAciActifs}) se sont connectés ce jour-là.
              </p>
            ) : (
              <>
                <p className="text-[11px] text-[#404040]/70 font-bold uppercase tracking-wide">
                  {aciAbsents.length} / {totalAciActifs} ACI non connecté(s)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {aciAbsents.map((m: any) => (
                    <span
                      key={m.id}
                      className="px-2.5 py-1 bg-white border border-[#F9945D]/40 text-[#EA601F] rounded-lg text-[11px] font-bold"
                    >
                      {m.prenom} {m.nom}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* FILTRES */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-[#404040]/10 shadow-sm">
            <select
              value={medFiltre}
              onChange={(e) => setMedFiltre(e.target.value)}
              className="px-3 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-xs font-bold outline-none focus:border-[#005259] cursor-pointer"
            >
              <option value="tous">Tous les médiateurs</option>
              {mediateursTries.map((m: any) => (
                <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
              ))}
            </select>
            <select
              value={anneeFiltre}
              onChange={(e) => setAnneeFiltre(e.target.value)}
              className="px-3 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-xs font-bold outline-none focus:border-[#005259] cursor-pointer"
            >
              {anneesDisponibles.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select
              value={moisFiltre}
              onChange={(e) => setMoisFiltre(e.target.value)}
              className="px-3 py-1.5 bg-[#F3F3F2] border border-[#404040]/15 text-[#404040] rounded-xl text-xs font-bold outline-none focus:border-[#005259] cursor-pointer"
            >
              <option value="tous">Toute l'année</option>
              {MOIS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <div className="sm:ml-auto flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#005259]/10 text-[#005259] rounded-xl text-xs font-bold uppercase tracking-wider">
                <ClockIcon className="w-3.5 h-3.5" />
                {formatDuree(totalMinutesFiltre)} au total
              </span>
              <button
                onClick={exporterCSV}
                disabled={sessionsFiltrees.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#005259] hover:bg-[#EA601F] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                <span>Exporter (.csv)</span>
              </button>
            </div>
          </div>

          {/* TABLEAU */}
          <div className="w-full bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-6 py-4">Médiateur</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Connexion</th>
                    <th className="px-6 py-4">Fin</th>
                    <th className="px-6 py-4">Durée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#404040]/5 text-xs text-[#404040]">
                  {sessionsFiltrees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-[#404040]/50 font-bold uppercase tracking-wider text-[10px]">
                        Aucune connexion sur cette période.
                      </td>
                    </tr>
                  ) : (
                    sessionsFiltrees.map((s) => (
                      <tr key={s.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                        <td className="px-6 py-3 font-bold text-[#005259]">
                          <FingerPrintIcon className="w-3.5 h-3.5 inline mr-1.5 text-[#EA601F]" />
                          {nomMediateur(s.mediatId)}
                        </td>
                        <td className="px-6 py-3">{formatDate(s.debut)}</td>
                        <td className="px-6 py-3 font-mono">{formatHeure(s.debut)}</td>
                        <td className="px-6 py-3 font-mono">
                          {formatHeure(s.fin || s.dernierHeartbeat)}
                          {!s.fin && (
                            <span className="ml-1.5 text-[9px] font-bold uppercase text-[#F9945D]" title="Pas de déconnexion explicite — dernière activité connue">
                              ~est.
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 font-bold">{formatDuree(dureeMinutes(s))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </PageGuard>
  );
}

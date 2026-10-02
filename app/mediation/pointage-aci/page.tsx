"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, PlusIcon, XMarkIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { useMediateurs } from "@/lib/MediateursProvider";
import { estActionDuMediateur, type ActionAvecMediateur } from "@/lib/matchMediateur";
import {
  ecouterPointagesDuJour, enregistrerPointage, dureeTravaillee, ecartDureeLegale, formaterEcartHeures,
  ecouterGrillesHorairesACI, horairesNormauxDuJour,
  type PointageACI, type GrillesHorairesParSite,
} from "@/lib/pointageAci";

function normaliser(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function aujourdHui(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD en heure locale
}

function formaterDateAffichee(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

interface CreneauJour extends ActionAvecMediateur {
  date: string;
  lieu?: string;
}

export default function PointageAciPage() {
  const { user } = usePermissions();
  const { mediateurs, loading: loadingMediateurs } = useMediateurs();
  const [date, setDate] = useState(aujourdHui());
  const [pointages, setPointages] = useState<PointageACI[] | null>(null);
  const [creneauxJour, setCreneauxJour] = useState<CreneauJour[]>([]);
  const [grilles, setGrilles] = useState<GrillesHorairesParSite>({});
  const [lignesAjoutees, setLignesAjoutees] = useState<Set<string>>(new Set());
  const [choixAjout, setChoixAjout] = useState("");
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false);

  useEffect(() => ecouterPointagesDuJour(date, setPointages), [date]);
  useEffect(() => ecouterGrillesHorairesACI(setGrilles), []);
  useEffect(() => {
    const q = query(collection(db, "planning_mediateurs"), where("date", "==", date));
    return onSnapshot(q, (snap) => setCreneauxJour(snap.docs.map((d) => d.data() as CreneauJour)));
  }, [date]);

  // Changer de jour repart d'une liste vide : seules les lignes déjà
  // pointées (ou ré-ajoutées) ce jour-là réapparaissent, voir uidsAffiches.
  useEffect(() => setLignesAjoutees(new Set()), [date]);

  const aciActifs = useMemo(
    () => mediateurs
      .filter((m) => m.statut === "ACI" && m.actif !== false)
      .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr")),
    [mediateurs]
  );

  const pointagesParUid = useMemo(() => {
    const map: Record<string, PointageACI> = {};
    (pointages || []).forEach((p) => { map[p.uid] = p; });
    return map;
  }, [pointages]);

  // Une ligne apparaît si elle a déjà des données ce jour-là (persisté) OU si
  // elle vient d'être ajoutée manuellement cette session — jamais la liste
  // complète par défaut, pour ne saisir que les ACI réellement présent·e·s.
  const uidsAffiches = useMemo(() => {
    const uids = new Set(lignesAjoutees);
    (pointages || []).forEach((p) => uids.add(p.uid));
    return uids;
  }, [pointages, lignesAjoutees]);

  const lignesAffichees = aciActifs.filter((a) => uidsAffiches.has(a.id));
  const aciDisponibles = aciActifs.filter((a) => !uidsAffiches.has(a.id));

  const suggestionsAjout = useMemo(() => {
    const terme = normaliser(choixAjout.trim());
    if (!terme) return aciDisponibles.slice(0, 8);
    return aciDisponibles.filter((a) => normaliser(`${a.prenom} ${a.nom}`).includes(terme)).slice(0, 8);
  }, [aciDisponibles, choixAjout]);

  const changerJour = (delta: number) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setDate(d.toLocaleDateString("en-CA"));
  };

  const saisir = (uid: string, champ: "arrivee" | "depart", valeur: string) => {
    const saisiPar = user?.displayName || user?.email || "Inconnu";
    enregistrerPointage(uid, date, champ, valeur, saisiPar);
  };

const lieuxDuJourDe = (aci: { id: string; prenom?: string; nom?: string }): string[] => Array.from(new Set(
    creneauxJour.filter((c) => estActionDuMediateur(c, aci)).map((c) => c.lieu).filter(Boolean) as string[]
  ));

  const missionDuJour = (aci: { id: string; prenom?: string; nom?: string }): string => {
    const lieux = lieuxDuJourDe(aci);
    return lieux.length > 0 ? lieux.join(" / ") : "—";
  };

  const horairesNormauxObjet = (aci: { rattachementHoraireACI?: string }) =>
    horairesNormauxDuJour(grilles, aci.rattachementHoraireACI || "Paris", date);

  const horairesNormaux = (aci: { rattachementHoraireACI?: string }): string => {
    const h = horairesNormauxObjet(aci);
    return h ? `${h.debut} - ${h.fin}` : "—";
  };

  const loading = loadingMediateurs || pointages === null;

  return (
    <PageGuard pageId="page_access_pointage_aci">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-5xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Pointage <span className="text-[#EA601F] font-semibold">ACI</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">Heures d'arrivée et de départ, saisies par un permanent</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <Link href="/mediation/pointage-aci/recapitulatif" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm w-fit">
                <ChartBarIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Récapitulatif par période</span>
              </Link>
              <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm w-fit">
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => changerJour(-1)} className="p-2 bg-[#F3F3F2] hover:bg-[#005259] hover:text-white text-[#005259] rounded-lg transition-colors cursor-pointer">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 px-3 py-2 bg-[#F3F3F2] rounded-lg">
                <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-xs font-bold text-[#005259] outline-none cursor-pointer" />
              </div>
              <button onClick={() => changerJour(1)} className="p-2 bg-[#F3F3F2] hover:bg-[#005259] hover:text-white text-[#005259] rounded-lg transition-colors cursor-pointer">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
              {date !== aujourdHui() && (
                <button onClick={() => setDate(aujourdHui())} className="px-2.5 py-1.5 bg-[#F3F3F2] hover:bg-[#005259]/10 text-[#005259] rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer">
                  Aujourd'hui
                </button>
              )}
            </div>
            <p className="text-xs font-bold text-[#404040]/70 capitalize">{formaterDateAffichee(date)}</p>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 shadow-sm relative">
            <div className="flex items-center gap-2.5">
              <PlusIcon className="w-4 h-4 text-[#EA601F] shrink-0" />
              <input
                type="text"
                value={choixAjout}
                onChange={(e) => { setChoixAjout(e.target.value); setSuggestionsOuvertes(true); }}
                onFocus={() => setSuggestionsOuvertes(true)}
                onBlur={() => setTimeout(() => setSuggestionsOuvertes(false), 150)}
                placeholder={aciDisponibles.length === 0 ? "Tous les ACI actifs sont déjà sur cette liste" : "Saisir le nom d'un ACI à pointer..."}
                disabled={aciDisponibles.length === 0}
                className="flex-1 min-w-[200px] px-3 py-2 bg-[#F3F3F2] border border-[#404040]/15 rounded-lg text-xs font-bold text-[#005259] outline-none focus:border-[#005259]/40 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
            {suggestionsOuvertes && suggestionsAjout.length > 0 && (
              <div className="absolute left-4 right-4 top-full mt-1.5 bg-white border border-[#404040]/15 rounded-xl shadow-lg z-10 max-h-56 overflow-y-auto">
                {suggestionsAjout.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setLignesAjoutees((prev) => new Set(prev).add(a.id));
                      setChoixAjout("");
                      setSuggestionsOuvertes(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-[#005259] hover:bg-[#F3F3F2] transition-colors cursor-pointer"
                  >
                    {a.prenom} {a.nom}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-[#404040]/40 animate-pulse">Chargement...</div>
            ) : lignesAffichees.length === 0 ? (
              <div className="p-8 text-center text-xs font-medium text-[#404040]/50">Aucune ligne pour le moment — ajoute un ACI ci-dessus.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#404040]/10 bg-[#F3F3F2]">
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Nom</th>
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Mission du jour</th>
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Horaires normaux</th>
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Arrivée</th>
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Départ</th>
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Durée</th>
                      <th className="text-left font-extrabold uppercase tracking-wide text-[#005259] px-4 py-2.5">Saisi par</th>
                      <th className="px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesAffichees.map((a) => {
                      const p = pointagesParUid[a.id];
                      const aDesDonnees = !!(p?.arrivee || p?.depart);
                      return (
                        <tr key={a.id} className="border-b border-[#404040]/5 last:border-0 hover:bg-[#F3F3F2]/60 transition-colors">
                          <td className="px-4 py-2.5 font-bold text-[#005259] whitespace-nowrap">
                            <span className="font-normal text-[#404040]/70 mr-1">{a.prenom}</span>
                            {a.nom}
                          </td>
                          <td className="px-4 py-2.5 text-[#404040]/70 whitespace-nowrap">{missionDuJour(a)}</td>
                          <td className="px-4 py-2.5 font-mono text-[#404040]/60 whitespace-nowrap">{horairesNormaux(a)}</td>
                          <td className="px-4 py-2.5">
                            <input
                              type="time"
                              defaultValue={p?.arrivee || ""}
                              onBlur={(e) => e.target.value && saisir(a.id, "arrivee", e.target.value)}
                              onChange={(e) => e.target.value && saisir(a.id, "arrivee", e.target.value)}
                              className="px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] rounded-lg text-xs font-mono outline-none"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="time"
                              defaultValue={p?.depart || ""}
                              onBlur={(e) => e.target.value && saisir(a.id, "depart", e.target.value)}
                              onChange={(e) => e.target.value && saisir(a.id, "depart", e.target.value)}
                              className="px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] rounded-lg text-xs font-mono outline-none"
                            />
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {(() => {
                              const lieu = lieuxDuJourDe(a)[0];
                              const ecart = ecartDureeLegale(p?.arrivee, p?.depart, horairesNormauxObjet(a), lieu);
                              const ecartTexte = ecart !== null ? formaterEcartHeures(ecart) : "";
                              return (
                                <>
                                  <span className="font-bold text-[#404040]/70">{dureeTravaillee(p?.arrivee, p?.depart, lieu)}</span>
                                  {ecartTexte && (
                                    <span className={`ml-1.5 text-[10px] font-bold ${ecart! > 0 ? "text-[#EA601F]" : "text-[#005259]"}`}>
                                      {ecartTexte}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-2.5 text-[#404040]/50 whitespace-nowrap">{p?.saisiPar || "—"}</td>
                          <td className="px-2 py-2.5">
                            {!aDesDonnees && (
                              <button
                                onClick={() => setLignesAjoutees((prev) => { const s = new Set(prev); s.delete(a.id); return s; })}
                                title="Retirer cette ligne"
                                className="p-1 text-[#404040]/30 hover:text-[#EF736A] transition-colors cursor-pointer"
                              >
                                <XMarkIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-[11px] text-[#404040]/50 font-medium flex items-center gap-1.5">
            <ClockIcon className="w-3.5 h-3.5" />
            Saisie réservée aux permanents (médiateurs et coordinateurs) — jamais par l'ACI lui-même. "Horaires normaux" vient de la grille Paris/Massy (réglages Paramètres Généraux). "Durée" déduit la pause méridienne (13h-14h, 12h-13h à Levallois) quand elle est englobée ; l'écart affiché à côté se compare à la durée normale, elle aussi nette de pause.
          </p>
        </div>
      </main>
    </PageGuard>
  );
}

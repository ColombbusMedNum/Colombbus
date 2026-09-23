"use client";

// Vue Gantt "détaillée" des modèles d'activités — partagée entre
// app/mediation/modeles/page.tsx (page de gestion des modèles) et
// app/agenda/page.tsx (onglet "Gantt détaillé", à côté de "Gantt par
// activité") : les deux pages chargent déjà leur propre liste de
// ActiviteType, ce composant se contente de la recevoir en prop.

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  type ActiviteType, getJoursFeries, resoudreHoraireAffichage, formatDateFr,
} from "@/lib/activitesTypes";
import { ChevronDownIcon, ChevronRightIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

// Largeur d'une colonne-jour — même valeur que LARGEUR_JOUR dans
// app/agenda/page.tsx (GanttActiviteContinu), pour un rendu visuel cohérent
// entre les deux Gantt de l'app.
const LARGEUR_JOUR_GANTT = 26;

function joursEntreDatesGantt(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function parseDateGantt(s: string): Date {
  return new Date(`${s}T12:00:00`);
}
function isLightColorGantt(hex: string): boolean {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
const SANS_TERRITOIRE_GANTT = "Sans territoire";

// Extrait la "famille" d'un code interne en retirant son suffixe
// territoire-numéro (ex "NKUP_91 - 06" → "NKUP", "NKPRO_TECH_92-01" →
// "NKPRO_TECH") — plusieurs codes internes successifs (une session par
// période) désignent souvent LA MÊME action récurrente, y compris à cheval
// sur plusieurs territoires (ex NKUP en 91 ET en 92) : les regrouper sur une
// seule ligne du Gantt plutôt qu'une ligne par territoire/code est ce qui
// rend la vue d'ensemble lisible.
function familleCodeInterne(code: string): string {
  const m = /^(.*?)[_\s]*\d+\s*-\s*\d+\s*$/.exec(code);
  return (m ? m[1] : code).trim() || code;
}

// Découpe une liste de dates (format YYYY-MM-DD) en tronçons — une rupture
// démarre un nouveau tronçon, sauf un simple week-end (jusqu'à 3 jours
// d'écart, ex vendredi → lundi) qui reste dans le même tronçon : sans cette
// tolérance, une activité hebdomadaire Matin-Vendredi bien réelle et
// continue se fragmenterait en un mini-tronçon par semaine. Un vrai trou
// (une activité ponctuelle qui saute une ou plusieurs semaines, ex
// résidences autonomie, Suresnes RN/RND, CARON, VERDUN...) casse bien le
// tronçon. Sert à afficher les dates RÉELLEMENT posées dans l'agenda
// (planning_mediateurs) plutôt que l'intervalle dateDebut→dateFin déclaré
// sur le modèle, qui peut inclure des trous.
function tronconsDates(dates: string[]): { debut: Date; fin: Date }[] {
  const triees = Array.from(new Set(dates)).sort().map(d => parseDateGantt(d));
  if (triees.length === 0) return [];
  const segs: { debut: Date; fin: Date }[] = [];
  let debut = triees[0], fin = triees[0];
  for (let i = 1; i < triees.length; i++) {
    if (joursEntreDatesGantt(fin, triees[i]) <= 3) {
      fin = triees[i];
    } else {
      segs.push({ debut, fin });
      debut = triees[i]; fin = triees[i];
    }
  }
  segs.push({ debut, fin });
  return segs;
}

// Vue Gantt des modèles : une barre par modèle, ou par tronçon de dates
// réelles quand l'activité s'avère ponctuelle (voir tronconsDates) —
// déterminé à partir des vraies dates posées dans planning_mediateurs, pas
// d'une liste d'exceptions codée en dur par territoire/nom. Pour visualiser
// d'un coup d'œil quand chaque session a lieu et repérer chevauchements/
// trous. Même style que le GANTT par activité de l'agenda
// (app/agenda/page.tsx, GanttActiviteContinu) : grille jour par jour,
// ombrage week-ends/fériés. Les lignes sont regroupées par FAMILLE de code
// interne (voir familleCodeInterne) plutôt que par territoire — une même
// action peut apparaître sur plusieurs territoires/périodes et doit rester
// une seule ligne, tout en restant groupées en accordéons PAR territoire
// (un territoire donné ne mélange jamais deux actions différentes). Les
// modèles permanents (sans dateDebut NI dateFin) n'ont pas de période à
// représenter et sont exclus du tracé. Idem pour les modèles sans code
// interne — pas encore affichés ici (pas de section dédiée pour eux pour le
// moment) — mais tous comptés à part pour ne pas donner l'impression d'un
// oubli.
export default function ModelesGantt({ modeles }: { modeles: ActiviteType[] }) {
  // Un modèle avec un code interne mais une seule des deux dates
  // renseignées (ex dateDebut sans dateFin, activité toujours "en cours")
  // n'a pas de raison de disparaître du Gantt — la date manquante se replie
  // sur l'autre (barre d'un seul jour) plutôt que d'exclure le modèle en
  // entier faute d'une période complète.
  const avecPeriode = modeles
    .filter(m => m.codeInterne && (m.dateDebut || m.dateFin))
    .map(m => ({ ...m, dateDebut: m.dateDebut || m.dateFin, dateFin: m.dateFin || m.dateDebut }));
  const exclus = modeles.length - avecPeriode.length;

  // Occurrences réelles (planning_mediateurs) par lieu — sert à afficher les
  // dates ponctuelles réelles des résidences autonomie au lieu d'une barre
  // continue trompeuse (voir tronconsDates), et au détail "qui est
  // positionné, quel jour" sous chaque ligne (voir l'accordéon plus bas).
  // Récupéré pour TOUS les lieux du Gantt, pas seulement les résidences
  // autonomie — même requête que ouvrirDatesModele (une seule égalité sur
  // lieu, pas de tri/filtre de date côté Firestore pour éviter un index
  // composite), filtrée côté client par période au moment de l'affichage.
  const [actionsParLieu, setActionsParLieu] = useState<Record<string, { date: string; mediateurNom: string }[]>>({});
  const lieuxUniques = Array.from(new Set(avecPeriode.map(m => m.lieu))).sort().join("|");
  useEffect(() => {
    if (!lieuxUniques) { setActionsParLieu({}); return; }
    let annule = false;
    (async () => {
      const lieux = lieuxUniques.split("|");
      const resultats = await Promise.all(lieux.map(async lieu => {
        const snap = await getDocs(query(collection(db, "planning_mediateurs"), where("lieu", "==", lieu)));
        return [lieu, snap.docs.map(d => {
          const data = d.data() as any;
          return { date: data.date as string, mediateurNom: (data.mediateurNom || data.mediateur || "") as string };
        })] as const;
      }));
      if (annule) return;
      const map: Record<string, { date: string; mediateurNom: string }[]> = Object.create(null);
      resultats.forEach(([lieu, actions]) => { map[lieu] = actions; });
      setActionsParLieu(map);
    })();
    return () => { annule = true; };
  }, [lieuxUniques]);

  // Lignes dépliées (voir l'accordéon "qui est positionné, quel jour" sous
  // chaque ligne) — togglées indépendamment les unes des autres.
  const [lignesOuvertes, setLignesOuvertes] = useState<Set<string>>(new Set());
  const toggleLigne = (id: string) => {
    setLignesOuvertes(prev => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id); else suivant.add(id);
      return suivant;
    });
  };
  // Territoires repliés — indépendants les uns des autres, même mécanique
  // que le GANTT de l'agenda (voir territoiresReplies dans
  // app/agenda/page.tsx, GanttActiviteContinu).
  const [territoiresReplies, setTerritoiresReplies] = useState<Set<string>>(new Set());
  const toggleTerritoire = (territoire: string) => {
    setTerritoiresReplies(prev => {
      const suivant = new Set(prev);
      if (suivant.has(territoire)) suivant.delete(territoire); else suivant.add(territoire);
      return suivant;
    });
  };

  // Calé sur la date du jour à l'ouverture — repère "aujourd'hui" proche du
  // bord gauche (une petite marge de quelques jours, pas centré) plutôt
  // qu'au milieu de l'écran : le passé n'intéresse pas, autant laisser un
  // maximum de largeur visible aux prochains jours/semaines à venir.
  const scrollCorpsRef = useRef<HTMLDivElement>(null);
  const borneDebutGantt = avecPeriode.length > 0
    ? avecPeriode.reduce((min, m) => m.dateDebut < min ? m.dateDebut : min, avecPeriode[0].dateDebut)
    : "";
  useEffect(() => {
    if (!borneDebutGantt || !scrollCorpsRef.current) return;
    const debutDate = parseDateGantt(borneDebutGantt);
    const offsetPx = joursEntreDatesGantt(debutDate, new Date()) * LARGEUR_JOUR_GANTT;
    const conteneur = scrollCorpsRef.current;
    conteneur.scrollLeft = Math.max(0, offsetPx - LARGEUR_JOUR_GANTT * 3);
  }, [borneDebutGantt]);

  // Barre de défilement horizontal dupliquée en haut, synchronisée avec le
  // défilement réel du corps — sur une période large, la seule barre de
  // défilement en bas oblige à redescendre tout en bas du tableau à chaque
  // fois (même mécanisme que GanttActiviteContinu dans app/agenda/page.tsx).
  const scrollHautRef = useRef<HTMLDivElement>(null);
  const synchroniseEnCoursGantt = useRef(false);
  const surScrollHautGantt = () => {
    if (synchroniseEnCoursGantt.current) { synchroniseEnCoursGantt.current = false; return; }
    if (scrollHautRef.current && scrollCorpsRef.current) {
      synchroniseEnCoursGantt.current = true;
      scrollCorpsRef.current.scrollLeft = scrollHautRef.current.scrollLeft;
    }
  };
  const surScrollCorpsGantt = () => {
    if (synchroniseEnCoursGantt.current) { synchroniseEnCoursGantt.current = false; return; }
    if (scrollHautRef.current && scrollCorpsRef.current) {
      synchroniseEnCoursGantt.current = true;
      scrollHautRef.current.scrollLeft = scrollCorpsRef.current.scrollLeft;
    }
  };

  if (avecPeriode.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-[#404040]/15 rounded-2xl text-xs font-bold uppercase tracking-wider text-[#404040]/60 bg-white shadow-sm">
        Aucun modèle avec une période et un code interne dans cette sélection.
      </div>
    );
  }

  const premierJourStr = avecPeriode.reduce((min, m) => m.dateDebut < min ? m.dateDebut : min, avecPeriode[0].dateDebut);
  const dernierJourStr = avecPeriode.reduce((max, m) => m.dateFin > max ? m.dateFin : max, avecPeriode[0].dateFin);
  const premierJour = parseDateGantt(premierJourStr);
  const dernierJour = parseDateGantt(dernierJourStr);

  const joursFeries = new Set<string>();
  for (let an = premierJour.getFullYear(); an <= dernierJour.getFullYear(); an++) {
    getJoursFeries(an).forEach(d => joursFeries.add(d));
  }

  const totalJours = joursEntreDatesGantt(premierJour, dernierJour) + 1;
  const px = (d: Date) => joursEntreDatesGantt(premierJour, d) * LARGEUR_JOUR_GANTT;
  const largeurTimeline = totalJours * LARGEUR_JOUR_GANTT;

  const mois: { debut: Date; label: string }[] = [];
  let curseurMois = new Date(premierJour.getFullYear(), premierJour.getMonth(), 1);
  while (curseurMois <= dernierJour) {
    mois.push({ debut: new Date(curseurMois), label: curseurMois.toLocaleDateString('fr-FR', { month: 'short' }) });
    curseurMois = new Date(curseurMois.getFullYear(), curseurMois.getMonth() + 1, 1);
  }

  const jours: Date[] = [];
  let curseurJour = new Date(premierJour);
  while (curseurJour <= dernierJour) {
    jours.push(new Date(curseurJour));
    curseurJour = new Date(curseurJour);
    curseurJour.setDate(curseurJour.getDate() + 1);
  }
  const grilleJournaliere = `repeating-linear-gradient(to right, #F3F3F2 0px, #F3F3F2 1px, transparent 1px, transparent ${LARGEUR_JOUR_GANTT}px)`;
  const estJourOff = (j: Date) => {
    const jourSemaine = j.getDay();
    return jourSemaine === 0 || jourSemaine === 6 || joursFeries.has(j.toLocaleDateString('en-CA'));
  };
  const ombreJoursOff = `linear-gradient(to right, ${jours
    .map((j, i) => {
      const couleur = estJourOff(j) ? "rgba(64,64,64,0.07)" : "transparent";
      return `${couleur} ${i * LARGEUR_JOUR_GANTT}px, ${couleur} ${(i + 1) * LARGEUR_JOUR_GANTT}px`;
    })
    .join(", ")})`;

  // Une ligne par FAMILLE de code interne (voir familleCodeInterne), mais
  // JAMAIS à cheval sur plusieurs territoires : "NKUP" en 91 et "NKUP" en 92
  // partagent un nom de famille similaire mais sont deux actions
  // différentes (chacune son propre public/lieu), même si la même famille
  // de code interne (sessions successives 06/07/08...) s'y regroupe bien
  // sur une seule ligne à l'intérieur d'UN territoire donné.
  interface LigneGanttModeles { famille: string; label: string; territoires: string[]; modeles: ActiviteType[] }
  const lignesMap = new Map<string, LigneGanttModeles>();
  for (const m of avecPeriode) {
    const territoire = (m.territoire || "").trim() || SANS_TERRITOIRE_GANTT;
    const famille = familleCodeInterne(m.codeInterne || "");
    const cle = `${territoire}::${famille}`;
    let ligne = lignesMap.get(cle);
    if (!ligne) {
      ligne = { famille, label: m.lieu, territoires: [territoire], modeles: [] };
      lignesMap.set(cle, ligne);
    }
    ligne.modeles.push(m);
  }
  const lignesFamille = Array.from(lignesMap.values());
  lignesFamille.forEach(l => {
    // Libellé de la ligne : famille + territoire (ex "NKUP 92", "NKUP 91",
    // "NKPRO_TECH 92") plutôt que le nom complet d'un modèle précis — une
    // ligne regroupe plusieurs variantes/sessions (production, observation,
    // 06/07/08...) et le nom d'une seule d'entre elles serait trompeur.
    l.label = `${l.famille} ${l.territoires[0]}`;
  });
  // Tri chronologique (date de début la plus ancienne) à l'intérieur de
  // chaque territoire — regroupées ensuite en accordéons par territoire
  // (voir groupesTerritoire), repliables indépendamment les uns des autres.
  lignesFamille.sort((a, b) => {
    const da = Math.min(...a.modeles.map(m => parseDateGantt(m.dateDebut).getTime()));
    const db = Math.min(...b.modeles.map(m => parseDateGantt(m.dateDebut).getTime()));
    return da - db;
  });
  const parTerritoireMap = new Map<string, LigneGanttModeles[]>();
  lignesFamille.forEach(l => {
    const t = l.territoires[0] || SANS_TERRITOIRE_GANTT;
    if (!parTerritoireMap.has(t)) parTerritoireMap.set(t, []);
    parTerritoireMap.get(t)!.push(l);
  });
  const groupesTerritoire = Array.from(parTerritoireMap.entries())
    .map(([territoire, lignes]) => ({ territoire, lignes }))
    .sort((a, b) => {
      if (a.territoire === SANS_TERRITOIRE_GANTT) return 1;
      if (b.territoire === SANS_TERRITOIRE_GANTT) return -1;
      return a.territoire.localeCompare(b.territoire, "fr", { numeric: true });
    });

  const aujourdHui = new Date();
  const aujourdHuiVisible = aujourdHui >= premierJour && aujourdHui <= dernierJour;

  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 shadow-sm space-y-3">
      {exclus > 0 && (
        <p className="text-[10px] text-[#404040]/50 italic">
          {exclus} modèle{exclus > 1 ? "s" : ""} sans période et/ou sans code interne non représenté{exclus > 1 ? "s" : ""} ci-dessous.
        </p>
      )}
      <div ref={scrollHautRef} onScroll={surScrollHautGantt} className="sticky top-0 z-20 bg-white border-b border-[#404040]/10 overflow-x-auto overflow-y-hidden py-2 mb-2">
        <div style={{ width: `${200 + largeurTimeline}px`, height: 1 }} />
      </div>
      <div ref={scrollCorpsRef} onScroll={surScrollCorpsGantt} className="overflow-x-auto">
        <div className="relative" style={{ width: `${200 + largeurTimeline}px` }}>
          {/* Repère "aujourd'hui" — même position que le calage initial du
              défilement (voir borneDebutGantt/useEffect plus haut). */}
          {aujourdHuiVisible && (
            <div
              className="absolute top-0 bottom-0 w-px bg-[#EA601F] z-[5] pointer-events-none"
              style={{ left: `${200 + px(aujourdHui)}px` }}
              title="Aujourd'hui"
            />
          )}
          <div className="flex">
            <div className="w-[200px] shrink-0" />
            <div className="relative h-4" style={{ width: `${largeurTimeline}px` }}>
              {mois.map(mo => (
                <span key={mo.debut.toISOString()} className="absolute text-[10px] font-extrabold uppercase text-[#005259]" style={{ left: `${px(mo.debut)}px` }}>
                  {mo.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex mb-2">
            <div className="w-[200px] shrink-0" />
            <div className="relative h-3" style={{ width: `${largeurTimeline}px`, backgroundImage: ombreJoursOff }}>
              {jours.map(j => {
                const dateStr = j.toLocaleDateString('en-CA');
                const estFerie = joursFeries.has(dateStr);
                const estWeekend = !estFerie && estJourOff(j);
                return (
                  <span
                    key={j.toISOString()}
                    className={`absolute text-[8px] font-bold text-center ${estFerie ? "text-[#EF736A]" : estWeekend ? "text-[#404040]/50" : "text-[#404040]/40"}`}
                    style={{ left: `${px(j)}px`, width: `${LARGEUR_JOUR_GANTT}px` }}
                  >
                    {j.getDate()}
                  </span>
                );
              })}
            </div>
          </div>

          {groupesTerritoire.map((groupeTerr) => {
            const territoireReplie = territoiresReplies.has(groupeTerr.territoire);
            return (
              <div key={groupeTerr.territoire}>
                <div className="flex border-b border-[#404040]/10">
                  <button
                    type="button"
                    onClick={() => toggleTerritoire(groupeTerr.territoire)}
                    className="w-[200px] shrink-0 flex items-center gap-1.5 py-1.5 pr-2 sticky left-0 z-10 bg-[#EAF1F1] hover:bg-[#DCEBEB] text-left"
                  >
                    {territoireReplie ? <ChevronRightIcon className="w-3.5 h-3.5 text-[#005259] shrink-0" /> : <ChevronDownIcon className="w-3.5 h-3.5 text-[#005259] shrink-0" />}
                    <span className="font-extrabold text-[10px] uppercase tracking-wider text-[#005259] truncate">{groupeTerr.territoire}</span>
                    <span className="text-[10px] text-[#404040]/50 shrink-0">({groupeTerr.lignes.length})</span>
                  </button>
                  <div className="bg-[#EAF1F1]" style={{ width: `${largeurTimeline}px` }} />
                </div>
                {!territoireReplie && groupeTerr.lignes.map((ligne, idx) => {
                  const rowBgSolide = idx % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]";
                  const ligneId = `${ligne.territoires[0]}::${ligne.famille}`;
                  const ouverte = lignesOuvertes.has(ligneId);
                  const aujourdHuiStr = aujourdHui.toLocaleDateString('en-CA');

                  // Qui est positionné, et quels jours (voir l'accordéon
                  // ci-dessous) : agrégé à partir des occurrences réelles
                  // (actionsParLieu) de TOUS les lieux de la ligne (ex
                  // production + observation), restreintes à la période
                  // globale affichée du Gantt (pas à dateDebut/dateFin du
                  // modèle précis — plusieurs instances successives du même
                  // lieu peuvent se chevaucher/avoir des trous, une action
                  // réelle ne doit jamais être perdue faute de tomber
                  // exactement dans la bonne période déclarée). En
                  // parallèle, les créneaux SANS médiateur (mediateurNom
                  // vide) déclenchent une alerte — seulement à partir
                  // d'aujourd'hui, un trou dans le passé n'étant plus
                  // rattrapable.
                  const parMediateur = new Map<string, Set<string>>();
                  const joursSansMediateur = new Set<string>();
                  ligne.modeles.forEach(m => {
                    (actionsParLieu[m.lieu] || []).forEach(a => {
                      if (a.date < premierJourStr || a.date > dernierJourStr) return;
                      if (!a.mediateurNom) {
                        if (a.date >= aujourdHuiStr) joursSansMediateur.add(a.date);
                        return;
                      }
                      if (!parMediateur.has(a.mediateurNom)) parMediateur.set(a.mediateurNom, new Set());
                      parMediateur.get(a.mediateurNom)!.add(a.date);
                    });
                  });
                  // Les plus mobilisés en premier (nombre de jours décroissant)
                  // plutôt qu'un ordre alphabétique — plus lisible pour repérer
                  // d'un coup d'œil qui porte le plus l'activité, et le compte
                  // affiché à côté du nom évite d'avoir à compter les carrés.
                  const mediateursTries = Array.from(parMediateur.entries())
                    .map(([nom, dates]) => ({ nom, jours: Array.from(dates).sort() }))
                    .sort((a, b) => b.jours.length - a.jours.length || a.nom.localeCompare(b.nom, "fr"));
                  const nbSansMediateur = joursSansMediateur.size;

                  return (
                    <div key={ligneId}>
                      <div className={`flex border-b border-[#F3F3F2] ${idx % 2 === 0 ? "bg-white" : "bg-[#F3F3F2]/40"}`}>
                        <button
                          type="button"
                          onClick={() => toggleLigne(ligneId)}
                          className={`w-[200px] shrink-0 pr-2 py-1.5 sticky left-0 z-10 flex items-center gap-1 text-left ${rowBgSolide}`}
                        >
                          {ouverte ? <ChevronDownIcon className="w-3 h-3 text-[#005259] shrink-0" /> : <ChevronRightIcon className="w-3 h-3 text-[#005259] shrink-0" />}
                          <span className="w-2 h-2 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: ligne.modeles[0].couleur || "#005259" }} />
                          <span className="text-[10px] font-bold text-[#005259] truncate" title={ligne.label}>{ligne.label}</span>
                          {nbSansMediateur > 0 && (
                            <span title={`${nbSansMediateur} créneau${nbSansMediateur > 1 ? "x" : ""} à venir sans médiateur`}>
                              <ExclamationTriangleIcon className="w-3 h-3 text-[#EF736A] shrink-0" />
                            </span>
                          )}
                        </button>
                        <div className="relative" style={{ width: `${largeurTimeline}px`, minHeight: "32px", backgroundImage: `${grilleJournaliere}, ${ombreJoursOff}` }}>
                          {mois.map(mo => (
                            <div key={mo.debut.toISOString()} className="absolute top-0 bottom-0 border-l border-[#404040]/20" style={{ left: `${px(mo.debut)}px` }} />
                          ))}
                          {ligne.modeles.flatMap((m, mi) => {
                            // Ligne haute = activités du matin, ligne basse =
                            // après-midi — deux lanes à position fixe plutôt
                            // qu'empilées au hasard, pour repérer d'un coup
                            // d'œil quel moment de la journée est concerné
                            // (voir resoudreHoraireAffichage).
                            const hMatin = resoudreHoraireAffichage(m, "Matin");
                            const hApresMidi = resoudreHoraireAffichage(m, "Après-midi");
                            const lane = !hMatin && hApresMidi ? 1 : 0;
                            const momentTexte = lane === 1 ? "Après-midi" : "Matin";

                            // Tronçons calculés à partir des VRAIES dates
                            // posées dans l'agenda (planning_mediateurs),
                            // pour tous les modèles — pas seulement une
                            // liste d'exceptions (résidences autonomie,
                            // Suresnes RN/RND, CARON, VERDUN, CHÊNES,
                            // NPT...) : une activité réellement continue
                            // (occurrences chaque semaine) ne produit qu'un
                            // seul tronçon grâce à la tolérance "week-end"
                            // de tronconsDates, une activité ponctuelle en
                            // produit plusieurs, sans rien coder en dur.
                            // Repli sur la période déclarée du modèle tant
                            // qu'aucune occurrence réelle n'a encore été
                            // chargée/trouvée.
                            const datesReelles = (actionsParLieu[m.lieu] || [])
                              .map(a => a.date)
                              .filter(d => d >= m.dateDebut && d <= m.dateFin);
                            const segments = datesReelles.length > 0
                              ? tronconsDates(datesReelles)
                              : [{ debut: parseDateGantt(m.dateDebut), fin: parseDateGantt(m.dateFin) }];
                            const ponctuel = segments.length > 1;

                            return segments.map((seg, si) => (
                              <button
                                key={`${m.id || mi}-${si}`}
                                type="button"
                                title={`${m.lieu} · ${m.codeInterne} · ${momentTexte} · ${formatDateFr(seg.debut.toLocaleDateString('en-CA'))} → ${formatDateFr(seg.fin.toLocaleDateString('en-CA'))}`}
                                className="absolute h-3.5 rounded px-1.5 flex items-center text-[9px] font-bold truncate shadow-sm cursor-default"
                                style={{
                                  top: lane === 0 ? "3px" : "16px",
                                  left: `${px(seg.debut)}px`,
                                  width: `${Math.max(px(seg.fin) - px(seg.debut) + LARGEUR_JOUR_GANTT, LARGEUR_JOUR_GANTT)}px`,
                                  backgroundColor: m.couleur || "#005259",
                                  color: isLightColorGantt(m.couleur || "#005259") ? "#1A1A1A" : "#FFFFFF",
                                }}
                              >
                                {!ponctuel && `${m.lieu} · ${m.codeInterne}`}
                              </button>
                            ));
                          })}
                        </div>
                      </div>
                      {ouverte && (
                        mediateursTries.length === 0 ? (
                          <div className="pl-6 pr-2 py-2 bg-[#F9FAFA] border-b border-[#F3F3F2] text-[10px] italic text-[#404040]/40">
                            Aucun médiateur positionné sur ces créneaux pour l'instant.
                          </div>
                        ) : (
                          mediateursTries.map(({ nom, jours }) => (
                            <div key={nom} className="flex border-b border-[#F3F3F2] bg-[#F9FAFA]">
                              {/* Colonne médiateur figée, même mécanique que
                                  les colonnes des lignes d'activité (sticky
                                  + fond opaque) — sinon le nom défile hors
                                  champ avec le reste du contenu au scroll
                                  horizontal. */}
                              <div className="w-[200px] shrink-0 pl-6 pr-2 py-1 sticky left-0 z-10 bg-[#F9FAFA] flex items-center gap-1 min-w-0">
                                <span className="text-[9px] font-bold text-[#005259] truncate" title={nom}>{nom}</span>
                                <span className="text-[8px] font-bold text-[#404040]/50 shrink-0">({jours.length})</span>
                              </div>
                              <div className="relative" style={{ width: `${largeurTimeline}px`, minHeight: "18px" }}>
                                {jours.map(j => (
                                  <span
                                    key={j}
                                    title={`${nom} · ${formatDateFr(j)}`}
                                    className="absolute rounded-sm shadow-sm"
                                    style={{
                                      top: "2px",
                                      left: `${px(parseDateGantt(j)) + 2}px`,
                                      width: `${LARGEUR_JOUR_GANTT - 4}px`,
                                      height: "14px",
                                      backgroundColor: ligne.modeles[0].couleur || "#005259",
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          ))
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

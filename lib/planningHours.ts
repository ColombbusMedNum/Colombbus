// Calculs de durée partagés entre les pages qui exploitent "planning_mediateurs"
// (statistiques, mediateurs, volume-horaire). Avant cette centralisation, deux
// implémentations divergentes coexistaient : l'une déduisait toujours la pause
// déjeuner (13h-14h) du total d'heures, l'autre ne la déduisait que du calcul
// des heures complémentaires ACI — au risque d'afficher des totaux différents
// pour le même créneau selon la page consultée.
//
// Règle validée : la pause déjeuner est toujours déduite du total d'heures
// travaillées, partout dans l'application.

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const PAUSE_DEBUT_MIN = 13 * 60;
const PAUSE_FIN_MIN = 14 * 60;

// Durée totale d'un créneau, pause déjeuner déduite si le créneau l'englobe
// entièrement. Repli à 3.5h si les horaires sont absents/invalides.
export function calculerDureeHeures(debut: string, fin: string): number {
  if (!debut || !fin) return 3.5;

  const minutesDebut = timeToMinutes(debut);
  const minutesFin = timeToMinutes(fin);
  if (isNaN(minutesDebut) || isNaN(minutesFin)) return 3.5;

  let totalMinutes = minutesFin - minutesDebut;
  if (totalMinutes <= 0) return 3.5;

  if (minutesDebut <= PAUSE_DEBUT_MIN && minutesFin >= PAUSE_FIN_MIN) {
    totalMinutes -= 60;
  }

  return totalMinutes / 60;
}

export interface OccurrenceHoraire {
  debut?: string;
  fin?: string;
}

export interface FragmentHoraire {
  debut: string;
  fin: string;
  heures: number;
}

export interface ContributionJournaliere<T> {
  occurrence: T;
  heuresContribuees: number;
  // Portions réellement "nouvelles" de cette occurrence, une fois retranché
  // ce qui est déjà couvert par une occurrence plus courte du même jour — à
  // réinjecter dans calculerHeuresComplementairesACI (à la place de
  // action.debut/fin bruts) pour que le calcul ACI reste cohérent. Peut
  // contenir plusieurs morceaux si une occurrence plus courte "perce" son
  // milieu ; vide si l'occurrence ne contribue aucune heure nouvelle.
  fragments: FragmentHoraire[];
}

// Additionne les heures réellement travaillées sur une liste d'occurrences
// d'UN SEUL médiateur pour UN SEUL jour, sans compter deux fois les plages
// qui se chevauchent. Règle : une occurrence COURTE/spécifique (ex une
// tâche ponctuelle "92 - CARON" 14:00-16:30) garde toujours l'intégralité
// de ses heures ; c'est l'occurrence plus LONGUE qui l'englobe (ex une
// permanence "journée complète" Suresnes 09:00-17:00) qui se voit réduite
// d'autant — jamais l'inverse. Les occurrences sont donc traitées de la
// plus courte à la plus longue, chacune "réservant" sa plage pour les
// suivantes. Un doublon exact (même horaire répété sur Matin et Après-midi,
// ex TERRAGE) est le cas particulier où les deux durées sont égales : la
// seconde traitée n'apporte alors aucune heure nouvelle. La pause déjeuner
// n'est déduite qu'une seule fois pour la journée entière, jamais par
// fragment.
export function repartirHeuresSansChevauchement<T extends OccurrenceHoraire>(
  occurrences: T[]
): ContributionJournaliere<T>[] {
  const avecHoraires = occurrences
    .map((o) => ({ o, debut: timeToMinutes(o.debut || ""), fin: timeToMinutes(o.fin || "") }))
    .filter((x) => x.o.debut && x.o.fin && x.fin > x.debut);
  const sansHoraires = occurrences.filter((o) => !(o.debut && o.fin && timeToMinutes(o.fin) > timeToMinutes(o.debut)));

  const tries = [...avecHoraires].sort((a, b) => {
    const dureeA = a.fin - a.debut;
    const dureeB = b.fin - b.debut;
    return dureeA !== dureeB ? dureeA - dureeB : a.debut - b.debut;
  });

  const reservees: [number, number][] = [];
  let pauseDejaDeduite = false;
  const resultats: ContributionJournaliere<T>[] = [];

  tries.forEach(({ o, debut, fin }) => {
    // Retranche des [debut, fin] tout ce qui est déjà réservé par une
    // occurrence plus courte, quel que soit l'ordre chronologique.
    let segments: [number, number][] = [[debut, fin]];
    reservees.forEach(([rs, re]) => {
      const suivants: [number, number][] = [];
      segments.forEach(([s, e]) => {
        if (re <= s || rs >= e) {
          suivants.push([s, e]);
        } else {
          if (s < rs) suivants.push([s, Math.min(e, rs)]);
          if (e > re) suivants.push([Math.max(s, re), e]);
        }
      });
      segments = suivants;
    });

    const fragments: FragmentHoraire[] = [];
    segments.forEach(([s, e]) => {
      let minutes = e - s;
      if (minutes <= 0) return;
      if (!pauseDejaDeduite && s <= PAUSE_DEBUT_MIN && e >= PAUSE_FIN_MIN) {
        minutes -= 60;
        pauseDejaDeduite = true;
      }
      if (minutes > 0) fragments.push({ debut: minutesToTime(s), fin: minutesToTime(e), heures: minutes / 60 });
    });

    resultats.push({ occurrence: o, heuresContribuees: fragments.reduce((acc, f) => acc + f.heures, 0), fragments });
    reservees.push([debut, fin]);
  });

  sansHoraires.forEach((o) => resultats.push({ occurrence: o, heuresContribuees: 3.5, fragments: [] }));

  return resultats;
}

interface MediateurInfoACI {
  statut?: string;
  debutACI?: string;
  finACI?: string;
}

interface ActionPlanningDate {
  debut?: string;
  fin?: string;
  date?: string;
}

// Heures complémentaires pour le personnel ACI : au-delà de ses horaires de
// contrat personnalisés, la pause déjeuner étant exclue du temps de contrat.
// Le mercredi compte intégralement en heures complémentaires. Prend en entrée
// la durée totale déjà calculée par calculerDureeHeures (donc déjà nette de
// la pause) pour rester cohérent avec elle.
export function calculerHeuresComplementairesACI(
  action: ActionPlanningDate,
  medInfo: MediateurInfoACI,
  dureeTotale: number
): number {
  if (!action.debut || !action.fin) return 0;
  if (medInfo.statut !== "ACI") return 0;

  if (action.date) {
    const dateObj = new Date(action.date);
    if (dateObj.getDay() === 3) return dureeTotale; // Mercredi : tout compte en complémentaire
  }

  const start = timeToMinutes(action.debut);
  const end = timeToMinutes(action.fin);

  const debutContrat = timeToMinutes(medInfo.debutACI || "09:00");
  const finContrat = timeToMinutes(medInfo.finACI || "17:00");

  let minsContrat = 0;
  for (let t = start; t < end; t++) {
    if (t >= debutContrat && t < finContrat && !(t >= PAUSE_DEBUT_MIN && t < PAUSE_FIN_MIN)) {
      minsContrat++;
    }
  }

  const heuresContrat = minsContrat / 60;
  return Math.max(0, dureeTotale - heuresContrat);
}

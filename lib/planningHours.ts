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

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Les libellés de session sont du texte libre (ex. "Du lundi 5 octobre 2026
// au vendredi 30 octobre 2026 — Matin", voir .../numerik-up/parametres) :
// on en extrait la date de DÉBUT (première occurrence "jour mois année")
// pour savoir si la session est encore à venir.
function extraireDateDebut(libelle: string): Date | null {
  const regex = new RegExp(`(\\d{1,2})\\s+(${MOIS_FR.join("|")})\\s+(\\d{4})`, "i");
  const correspondance = libelle.toLowerCase().match(regex);
  if (!correspondance) return null;
  const jour = parseInt(correspondance[1], 10);
  const mois = MOIS_FR.indexOf(correspondance[2].toLowerCase());
  const annee = parseInt(correspondance[3], 10);
  return new Date(annee, mois, jour);
}

// Une session dont la date de début est déjà passée ne doit plus être
// proposée à l'inscription (voir app/mediation/actions-collectives/
// inscription/numerik-up/page.tsx et app/inscription/numerik-up/page.tsx) —
// un libellé sans date reconnaissable reste affiché par défaut plutôt que
// d'être masqué à tort.
export function sessionEstAVenir(libelle: string): boolean {
  const debut = extraireDateDebut(libelle);
  if (!debut) return true;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return debut >= aujourdhui;
}

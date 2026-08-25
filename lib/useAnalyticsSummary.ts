import { useMemo } from "react";
import { calculerDureeHeures, calculerHeuresComplementairesACI } from "./planningHours";
import { identifiantMediateur } from "./matchMediateur";

export interface AnalyticsSummaryItem {
  code: string;
  label: string;
  totalHeures: number;
  heuresComplementaires: number;
  count: number;
}

// Regroupe une liste d'actions planifiées par code analytique et cumule leur
// durée (via calculerDureeHeures), en isolant la part d'heures
// complémentaires ACI (calculerHeuresComplementairesACI, mêmes règles que
// app/mediation/volume-horaire). Partagé entre app/mediation/mediateurs et
// app/mediation/statistiques, qui dupliquaient cette logique — avec une
// différence fonctionnelle réelle : statistiques inclut l'identifiant du
// médiateur dans la clé de déduplication (nécessaire pour sa vue "Tous les
// médiateurs" agrégée), ce qui est repris ici comme comportement canonique
// — sans effet pour un usage à un seul médiateur comme dans mediateurs/page.tsx.
//
// `mediateurs` sert à retrouver, pour chaque action, le médiateur réellement
// concerné (statut, horaires ACI) — indispensable pour la vue "Tous les
// médiateurs" de statistiques où chaque action peut appartenir à une
// personne différente de celle actuellement affichée.
export function useAnalyticsSummary(currentMedActions: any[], mediateurs: any[] = []) {
  // Object.create(null) : clés indexées par du texte libre (nom complet,
  // code analytique) — sans prototype pour qu'une clé "__proto__" reste une
  // clé normale au lieu de polluer Object.prototype.
  const mediateursParId = useMemo(() => {
    return mediateurs.reduce((acc: Record<string, any>, m: any) => {
      const nomComplet = `${m.prenom || ""} ${m.nom || ""}`.trim();
      acc[m.id] = m;
      if (nomComplet) acc[nomComplet] = m;
      return acc;
    }, Object.create(null) as Record<string, any>);
  }, [mediateurs]);

  const analyticsSummary = useMemo<AnalyticsSummaryItem[]>(() => {
    const summary: Record<string, AnalyticsSummaryItem> = Object.create(null);
    const dejaCompte = new Set<string>();

    currentMedActions.forEach((action) => {
      const code = (action.codeAnalytique || "").trim() || "SANS_CODE";
      const label = action.codeAnalytique ? `Code ${action.codeAnalytique}` : "Sans code analytique / Non spécifié";
      const identifiant = identifiantMediateur(action);
      const cleUnique = `${identifiant}_${action.date}_${action.moment || ""}_${code}_${action.debut || ""}_${action.fin || ""}`;

      if (!summary[code]) {
        summary[code] = { code, label, totalHeures: 0, heuresComplementaires: 0, count: 0 };
      }

      if (dejaCompte.has(cleUnique)) {
        summary[code].count += 1;
      } else {
        const total = calculerDureeHeures(action.debut || "", action.fin || "");
        const medInfo = mediateursParId[identifiant] || {};
        summary[code].totalHeures += total;
        summary[code].heuresComplementaires += calculerHeuresComplementairesACI(action, medInfo, total);
        summary[code].count += 1;
        if (action.debut && action.fin) dejaCompte.add(cleUnique);
      }
    });

    // Arrondis propres pour éviter les résidus de virgule flottante JavaScript (ex: 14.000000002h)
    return Object.values(summary)
      .map((item) => ({
        ...item,
        totalHeures: Math.round(item.totalHeures * 10) / 10,
        heuresComplementaires: Math.round(item.heuresComplementaires * 10) / 10,
      }))
      .sort((a, b) => b.totalHeures - a.totalHeures);
  }, [currentMedActions, mediateursParId]);

  const totalHeuresGlobal = analyticsSummary.reduce((acc, curr) => acc + curr.totalHeures, 0);
  const totalHeuresComplementaires = analyticsSummary.reduce((acc, curr) => acc + curr.heuresComplementaires, 0);

  return { analyticsSummary, totalHeuresGlobal, totalHeuresComplementaires };
}

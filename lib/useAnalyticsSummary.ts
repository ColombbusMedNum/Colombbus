import { useMemo } from "react";
import { calculerDureeHeures } from "./planningHours";

export interface AnalyticsSummaryItem {
  code: string;
  label: string;
  totalHeures: number;
  count: number;
}

// Regroupe une liste d'actions planifiées par code analytique et cumule leur
// durée (via calculerDureeHeures). Partagé entre app/mediation/mediateurs et
// app/mediation/statistiques, qui dupliquaient cette logique — avec une
// différence fonctionnelle réelle : statistiques inclut l'identifiant du
// médiateur dans la clé de déduplication (nécessaire pour sa vue "Tous les
// médiateurs" agrégée), ce qui est repris ici comme comportement canonique
// — sans effet pour un usage à un seul médiateur comme dans mediateurs/page.tsx.
export function useAnalyticsSummary(currentMedActions: any[]) {
  const analyticsSummary = useMemo<AnalyticsSummaryItem[]>(() => {
    const summary: Record<string, AnalyticsSummaryItem> = {};
    const dejaCompte = new Set<string>();

    currentMedActions.forEach((action) => {
      const code = (action.codeAnalytique || "").trim() || "SANS_CODE";
      const label = action.codeAnalytique ? `Code ${action.codeAnalytique}` : "Sans code analytique / Non spécifié";
      const identifiant = action.mediateurId || action.mediateurNom || action.mediateur || "";
      const cleUnique = `${identifiant}_${action.date}_${action.moment || ""}_${code}_${action.debut || ""}_${action.fin || ""}`;

      if (!summary[code]) {
        summary[code] = { code, label, totalHeures: 0, count: 0 };
      }

      if (dejaCompte.has(cleUnique)) {
        summary[code].count += 1;
      } else {
        summary[code].totalHeures += calculerDureeHeures(action.debut || "", action.fin || "");
        summary[code].count += 1;
        if (action.debut && action.fin) dejaCompte.add(cleUnique);
      }
    });

    // Arrondis propres pour éviter les résidus de virgule flottante JavaScript (ex: 14.000000002h)
    return Object.values(summary)
      .map((item) => ({ ...item, totalHeures: Math.round(item.totalHeures * 10) / 10 }))
      .sort((a, b) => b.totalHeures - a.totalHeures);
  }, [currentMedActions]);

  const totalHeuresGlobal = analyticsSummary.reduce((acc, curr) => acc + curr.totalHeures, 0);

  return { analyticsSummary, totalHeuresGlobal };
}

"use client";

import { useMemo, useState } from "react";
import { ClockIcon, MapPinIcon } from "@heroicons/react/24/outline";
import Accordion from "./Accordion";
import { calculerDureeHeures } from "@/lib/planningHours";

interface ActionAvecDate {
  id: string;
  date: string;
  moment?: string;
  lieu?: string;
  debut?: string;
  fin?: string;
}

interface MediateurActionsParMoisProps {
  actions: ActionAvecDate[];
  emptyMessage?: string;
}

const NOMS_MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Liste chronologique brute des actions (pas juste l'agrégat par code
// analytique de MediateurAnalyticsPanel), groupées par mois et repliables —
// pour répondre à "qui a fait quoi, quand" plutôt que juste "combien d'heures".
export default function MediateurActionsParMois({ actions, emptyMessage = "Aucune action sur cette période." }: MediateurActionsParMoisProps) {
  const groupesParMois = useMemo(() => {
    // Object.create(null) : clé dérivée d'une date, mais gardé par cohérence
    // avec le reste de l'app (voir les correctifs prototype pollution).
    const map: Record<string, ActionAvecDate[]> = Object.create(null);
    actions.forEach((a) => {
      if (!a.date) return;
      const cle = a.date.slice(0, 7);
      if (!map[cle]) map[cle] = [];
      map[cle].push(a);
    });

    return Object.entries(map)
      .map(([cle, liste]) => {
        const [anneeStr, moisStr] = cle.split("-");

        // Un modèle "journée complète" (ex TERRAGE) pose le même horaire
        // (ex 09:30-17:30) sur les deux créneaux Matin ET Après-midi du même
        // jour/lieu : ce sont deux documents Firestore pour UNE seule
        // période travaillée — on les fusionne en une occurrence, ses heures
        // ne comptant qu'une fois. Une vraie coupure méridienne (deux
        // horaires différents) reste deux occurrences distinctes.
        const parCreneau: Record<string, { date: string; lieu: string; debut?: string; fin?: string; moments: string[]; id: string }> = Object.create(null);
        liste.forEach((a) => {
          const lieu = a.lieu || "Activité non spécifiée";
          const cleCreneau = `${a.date}_${lieu}_${a.debut || ""}_${a.fin || ""}`;
          if (!parCreneau[cleCreneau]) {
            parCreneau[cleCreneau] = { id: a.id, date: a.date, lieu, debut: a.debut, fin: a.fin, moments: [] };
          }
          if (a.moment) parCreneau[cleCreneau].moments.push(a.moment);
        });
        const occurrencesFusionnees = Object.values(parCreneau).map((o) => ({
          ...o,
          heures: calculerDureeHeures(o.debut || "", o.fin || ""),
        }));

        const totalHeures = occurrencesFusionnees.reduce((acc, o) => acc + o.heures, 0);

        // Regroupement par intitulé (lieu) à l'intérieur du mois, plutôt
        // qu'une simple liste chronologique — répond à "combien de fois et
        // combien d'heures sur CETTE activité ce mois-ci".
        const parIntitule: Record<string, typeof occurrencesFusionnees> = Object.create(null);
        occurrencesFusionnees.forEach((o) => {
          if (!parIntitule[o.lieu]) parIntitule[o.lieu] = [];
          parIntitule[o.lieu].push(o);
        });
        const intitules = Object.entries(parIntitule)
          .map(([titre, occurrences]) => ({
            titre,
            totalHeures: occurrences.reduce((acc, o) => acc + o.heures, 0),
            occurrences: [...occurrences].sort((a, b) => a.date.localeCompare(b.date)),
          }))
          .sort((a, b) => b.totalHeures - a.totalHeures);

        return {
          cle,
          annee: anneeStr,
          moisLabel: NOMS_MOIS[Number(moisStr) - 1] || moisStr,
          totalHeures,
          nbOccurrences: occurrencesFusionnees.length,
          intitules,
        };
      })
      .sort((a, b) => b.cle.localeCompare(a.cle));
  }, [actions]);

  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});

  if (groupesParMois.length === 0) {
    return (
      <div className="bg-white border border-[#404040]/10 rounded-2xl p-8 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60 shadow-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#404040]/10 rounded-2xl p-5 space-y-3 shadow-sm">
      <div className="flex items-center gap-2 pb-3 border-b border-[#404040]/10">
        <ClockIcon className="w-4 h-4 text-[#005259]" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#005259]">Détail des actions par mois</h3>
      </div>

      <div className="space-y-2">
        {groupesParMois.map((groupe, index) => {
          const estOuvert = ouverts[groupe.cle] ?? index === 0;
          return (
            <Accordion
              key={groupe.cle}
              title={`${groupe.moisLabel} ${groupe.annee} — ${groupe.nbOccurrences} action(s), ${groupe.totalHeures.toFixed(1)}h`}
              open={estOuvert}
              onToggle={() => setOuverts((prev) => ({ ...prev, [groupe.cle]: !estOuvert }))}
            >
              <div className="space-y-3">
                {groupe.intitules.map((groupeIntitule) => (
                  <div key={groupeIntitule.titre} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 px-2 py-1 border-b border-[#404040]/10">
                      <span className="flex items-center gap-1.5 min-w-0 font-bold text-[#005259] text-xs uppercase tracking-wide truncate">
                        <MapPinIcon className="w-3 h-3 text-[#EA601F] shrink-0" />
                        <span className="truncate">{groupeIntitule.titre}</span>
                      </span>
                      <span className="font-mono font-bold text-[#EA601F] shrink-0 text-[11px]">
                        {groupeIntitule.occurrences.length}× — {groupeIntitule.totalHeures.toFixed(1)}h
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {groupeIntitule.occurrences.map((o) => {
                        const jour = o.date.split("-")[2] || "";
                        const libelleMoment = o.moments.length > 1 ? "Journée" : o.moments[0] || "";
                        return (
                          <div
                            key={o.id}
                            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs px-2 py-1 rounded-lg hover:bg-[#F3F3F2] transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-[#005259] w-5 shrink-0">{jour}</span>
                              <span className="text-[9px] text-[#404040]/60 font-bold uppercase w-14 shrink-0">{libelleMoment}</span>
                            </div>
                            <span className="font-mono font-bold text-[#404040]/70 shrink-0 text-[11px]">
                              {o.debut && o.fin && <span className="mr-1.5">{o.debut}–{o.fin}</span>}
                              {o.heures > 0 && <span className="text-[#EA601F]">({o.heures.toFixed(1)}h)</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Accordion>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";
import { ActionSchema, DEFAULT_PIECES_SUIVI_ADMINISTRATIF, InscriptionActionDynamique, PieceSuiviAdministratif } from "@/lib/dynamicActions/types";
import { chargerSchema, chargerConfiguration, inscriptionsCollection, inscriptionDoc, ConfigurationChargee } from "@/lib/dynamicActions/store";

interface Apprenant extends InscriptionActionDynamique {
  id: string;
}

// Duplicata générique de reponses/digital-up-pro/[id]/suivi-administratif —
// même principe (une case par pièce, regroupées par thème), mais la liste
// des pièces vient du schéma de l'action (schema.suiviAdministratifPieces si
// suiviAdministratifPiecesPersonnalisees, sinon DEFAULT_PIECES_SUIVI_ADMINISTRATIF)
// au lieu d'une liste FSE codée en dur. Contrairement à digital-up-pro, il
// n'y a pas de "CHAMPS_LIES" vers une autre page : la seule copie de cette
// donnée est le champ SuiviAdministratif (map) sur le document d'inscription.
const TEINTES_GROUPES = ["bg-white", "bg-[#F3F3F2]/70"];
const checkboxClass = "w-4 h-4 accent-[#005259] cursor-pointer";

function CelluleLienDrive({ valeur, onValide }: { valeur?: string; onValide: (v: string) => void }) {
  return valeur ? (
    <a href={valeur} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-[#005259] underline hover:text-[#EA601F] whitespace-nowrap">
      Dossier Drive
    </a>
  ) : (
    <input
      type="text"
      defaultValue=""
      onBlur={(e) => onValide(e.target.value)}
      placeholder="Lien (https://...)"
      className="w-full min-w-[140px] px-2 py-1 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] focus:bg-white rounded-md text-[11px] text-[#404040] outline-none font-medium transition-colors"
    />
  );
}

export default function SuiviAdministratifActionDynamiqueSessionPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const router = useRouter();
  const sessionId = decodeURIComponent(id || "");

  const [schema, setSchema] = useState<ActionSchema | null>(null);
  const [config, setConfig] = useState<ConfigurationChargee | null>(null);
  const [apprenants, setApprenants] = useState<Apprenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [territoireSelectionne, setTerritoireSelectionne] = useState("");

  const refPrenom = useRef<HTMLTableCellElement>(null);
  const refNom = useRef<HTMLTableCellElement>(null);
  const [decalages, setDecalages] = useState({ prenom: 0, nom: 0 });

  useEffect(() => {
    const mesurer = () => {
      const largeurPrenom = refPrenom.current?.offsetWidth || 0;
      const suivant = { prenom: 0, nom: largeurPrenom };
      setDecalages((prev) => (prev.prenom === suivant.prenom && prev.nom === suivant.nom ? prev : suivant));
    };
    mesurer();
    window.addEventListener("resize", mesurer);
    return () => window.removeEventListener("resize", mesurer);
  });

  const scrollHautRef = useRef<HTMLDivElement>(null);
  const scrollTableRef = useRef<HTMLDivElement>(null);
  const [largeurTable, setLargeurTable] = useState(0);
  const synchroniseEnCours = useRef(false);

  useEffect(() => {
    const mettreAJourLargeur = () => {
      if (scrollTableRef.current) setLargeurTable(scrollTableRef.current.scrollWidth);
    };
    mettreAJourLargeur();
    window.addEventListener("resize", mettreAJourLargeur);
    return () => window.removeEventListener("resize", mettreAJourLargeur);
  });

  const surScrollHaut = () => {
    if (synchroniseEnCours.current) { synchroniseEnCours.current = false; return; }
    if (scrollHautRef.current && scrollTableRef.current) {
      synchroniseEnCours.current = true;
      scrollTableRef.current.scrollLeft = scrollHautRef.current.scrollLeft;
    }
  };
  const surScrollTable = () => {
    if (synchroniseEnCours.current) { synchroniseEnCours.current = false; return; }
    if (scrollHautRef.current && scrollTableRef.current) {
      synchroniseEnCours.current = true;
      scrollHautRef.current.scrollLeft = scrollTableRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    const charger = async () => {
      try {
        const [s, c] = await Promise.all([chargerSchema(slug), chargerConfiguration(slug)]);
        setSchema(s);
        setConfig(c);
        if (s) {
          const snap = await getDocs(query(inscriptionsCollection(slug), orderBy("createdAt", "desc")));
          setApprenants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Apprenant)));
        }
      } catch (error) {
        console.error("Erreur lors du chargement du suivi administratif :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [slug]);

  const apprenantsSession = useMemo(
    () =>
      apprenants
        .filter((a) => a.Session === sessionId && a.Suivi_Recrutement)
        .sort((a, b) => (a.Nom || "").localeCompare(b.Nom || "", "fr")),
    [apprenants, sessionId]
  );

  const pieces: PieceSuiviAdministratif[] = schema?.suiviAdministratifPiecesPersonnalisees
    ? (schema.suiviAdministratifPieces || [])
    : DEFAULT_PIECES_SUIVI_ADMINISTRATIF;
  const groupes = useMemo(() => {
    const ordre: string[] = [];
    const parGroupe = new Map<string, PieceSuiviAdministratif[]>();
    pieces.forEach((p) => {
      if (!parGroupe.has(p.groupe)) { parGroupe.set(p.groupe, []); ordre.push(p.groupe); }
      parGroupe.get(p.groupe)!.push(p);
    });
    return ordre.map((groupe) => ({ groupe, items: parGroupe.get(groupe)! }));
  }, [pieces]);

  const territoireDeSession = useMemo(() => {
    if (!config) return "";
    const trouves = new Set<string>();
    Object.values(config.sessions).forEach((parTerritoire) => {
      Object.entries(parTerritoire).forEach(([territoire, dates]) => {
        if (dates.includes(sessionId)) trouves.add(territoire);
      });
    });
    return Array.from(trouves).join(" / ");
  }, [config, sessionId]);

  useEffect(() => {
    if (territoireDeSession) {
      setTerritoireSelectionne(territoireDeSession.split(" / ")[0]);
    } else if (config && config.territoiresListe.length > 0 && !territoireSelectionne) {
      setTerritoireSelectionne(config.territoiresListe[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territoireDeSession, config]);

  const sessionsDuTerritoire = useMemo(
    () => (config ? Array.from(new Set(Object.values(config.sessions).flatMap((parTerritoire) => parTerritoire[territoireSelectionne] || []))).sort((a, b) => a.localeCompare(b, "fr")) : []),
    [config, territoireSelectionne]
  );

  const changerSession = (nouvelleSession: string) => {
    router.push(`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(nouvelleSession)}/suivi-administratif`);
  };
  const changerTerritoire = (nouveauTerritoire: string) => {
    setTerritoireSelectionne(nouveauTerritoire);
    const datesDuTerritoire = config ? Array.from(new Set(Object.values(config.sessions).flatMap((parTerritoire) => parTerritoire[nouveauTerritoire] || []))).sort((a, b) => a.localeCompare(b, "fr")) : [];
    if (datesDuTerritoire.length > 0) changerSession(datesDuTerritoire[0]);
  };

  const basculerPiece = async (apprenantId: string, pieceId: string, valeur: boolean) => {
    setApprenants((prev) => prev.map((a) => (a.id === apprenantId ? { ...a, SuiviAdministratif: { ...a.SuiviAdministratif, [pieceId]: valeur } } : a)));
    try {
      await updateDoc(inscriptionDoc(slug, apprenantId), { [`SuiviAdministratif.${pieceId}`]: valeur });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de la pièce ${pieceId} :`, error);
    }
  };

  const majLienDrive = async (apprenantId: string, valeur: string) => {
    setApprenants((prev) => prev.map((a) => (a.id === apprenantId ? { ...a, SuiviAdministratifLienDrive: valeur } : a)));
    try {
      await updateDoc(inscriptionDoc(slug, apprenantId), { SuiviAdministratifLienDrive: valeur });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du lien Drive :", error);
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
    <PageGuard pageId="page_access_action_dynamique">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-[100rem] mx-auto relative z-10 space-y-6">

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Suivi <span className="text-[#EA601F] font-semibold">administratif</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Session : {sessionId || "—"}{territoireDeSession && ` — Territoire : ${territoireDeSession}`} — {apprenantsSession.length} apprenant{apprenantsSession.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {config && config.territoiresListe.length > 0 && (
              <select value={territoireSelectionne} onChange={(e) => changerTerritoire(e.target.value)} className="bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] outline-none font-medium shadow-sm">
                {config.territoiresListe.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {sessionsDuTerritoire.length > 0 && (
              <select value={sessionId} onChange={(e) => changerSession(e.target.value)} className="bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] outline-none font-medium shadow-sm max-w-[240px]">
                {!sessionsDuTerritoire.includes(sessionId) && sessionId && <option value={sessionId}>{sessionId}</option>}
                {sessionsDuTerritoire.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <Link href={`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionId)}/apprenants`} className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Apprenant·e·s</span>
            </Link>
            <Link href="/" className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm">
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>
        </div>

        {pieces.length === 0 ? (
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
            Aucune pièce configurée — voir la page paramètres de cette action.
          </div>
        ) : apprenantsSession.length === 0 ? (
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
            Aucun·e apprenant·e affecté·e à cette session pour le moment.
          </div>
        ) : (
          <>
          <div ref={scrollHautRef} onScroll={surScrollHaut} className="sticky top-0 z-30 bg-[#F3F3F2] py-1.5 overflow-x-auto overflow-y-hidden">
            <div style={{ width: largeurTable, height: 1 }}></div>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
            <div ref={scrollTableRef} onScroll={surScrollTable} className="overflow-x-auto">
              <table className="border-separate border-spacing-0 text-xs w-full">
                <thead>
                  <tr className="text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                    <th ref={refPrenom} className="px-3 py-3 sticky left-0 top-0 bg-[#F3F3F2] z-20 align-bottom" style={{ left: decalages.prenom }} rowSpan={2}>Prénom</th>
                    <th ref={refNom} className="px-3 py-3 sticky top-0 bg-[#F3F3F2] z-20 shadow-[6px_0_8px_-6px_rgba(0,0,0,0.15)] align-bottom" style={{ left: decalages.nom }} rowSpan={2}>Nom</th>
                    {groupes.map((groupe, gi) => (
                      <th key={groupe.groupe} colSpan={groupe.items.length} className={`px-2 py-2 text-center border-b border-x border-[#404040]/10 whitespace-nowrap ${TEINTES_GROUPES[gi % 2]}`}>
                        {groupe.groupe}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left align-bottom border-x border-[#404040]/10 bg-white" rowSpan={2}>Dossier Drive</th>
                  </tr>
                  <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[9px] uppercase tracking-widest font-bold">
                    {groupes.map((groupe, gi) =>
                      groupe.items.map((item) => (
                        <th key={item.id} className={`px-2 py-3 text-left align-top w-[110px] max-w-[110px] whitespace-normal leading-tight border-x border-[#404040]/5 ${TEINTES_GROUPES[gi % 2]}`}>
                          {item.label}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {apprenantsSession.map((a) => (
                    <tr key={a.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] sticky left-0 bg-white z-10 border-b border-[#404040]/10" style={{ left: decalages.prenom }}>{a.Prénom || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase sticky bg-white z-10 shadow-[6px_0_8px_-6px_rgba(0,0,0,0.15)] border-b border-[#404040]/10" style={{ left: decalages.nom }}>
                        <Link href={`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionId)}/apprenants/${a.id}`} className="hover:text-[#EA601F] hover:underline transition-colors">
                          {a.Nom || "—"}
                        </Link>
                      </td>
                      {groupes.map((groupe, gi) =>
                        groupe.items.map((item) => (
                          <td key={item.id} className={`px-3 py-2 text-center border-x border-b border-[#404040]/10 ${TEINTES_GROUPES[gi % 2]}`}>
                            <input
                              type="checkbox"
                              checked={a.SuiviAdministratif?.[item.id] || false}
                              onChange={(e) => basculerPiece(a.id, item.id, e.target.checked)}
                              className={checkboxClass}
                            />
                          </td>
                        ))
                      )}
                      <td className="px-3 py-2 border-x border-b border-[#404040]/10">
                        <CelluleLienDrive valeur={a.SuiviAdministratifLienDrive} onValide={(v) => majLienDrive(a.id, v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}

      </div>
    </main>
    </PageGuard>
  );
}

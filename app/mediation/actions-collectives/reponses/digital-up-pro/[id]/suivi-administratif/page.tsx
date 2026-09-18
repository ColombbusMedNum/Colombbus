"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { HomeIcon, ArrowLeftIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

// Champs de suivi administratif Digital Up 96H — un booléen par pièce/étape
// à collecter, coché au fur et à mesure par l'équipe. Indépendant du suivi
// pédagogique (page Apprenant·e·s) : ici, on ne suit que la constitution du
// dossier administratif de chaque apprenant·e retenu·e.
interface Apprenant {
  id: string;
  Nom?: string;
  Prénom?: string;
  Session?: string;
  Suivi_Recrutement?: boolean;
  OK_NOK?: string;
  Admin_Ressources?: boolean;
  Admin_ContratPLIE91?: boolean;
  Admin_CharteEngagement?: boolean;
  Admin_DiagnosticEntree?: boolean;
  Admin_DiagnosticEquipement?: boolean;
  Admin_AutorisationDroitImage?: boolean;
  Admin_FicheEntretienDiagnostic?: boolean;
  Admin_QuestionnaireFSE?: boolean;
  Admin_CniTitreSejour?: boolean;
  Admin_AttestationParticipation?: boolean;
  Admin_RQTH?: boolean;
  Admin_ConvocationFormationPix?: boolean;
  Admin_TestLangue?: boolean;
  Admin_LienDossierDrive?: string;
}

// Items regroupés par thématique — chaque groupe devient un bloc de colonnes
// dans le tableau (en-tête sur deux niveaux : nom du groupe puis intitulé de
// chaque pièce), plutôt qu'une liste plate de 14 colonnes indifférenciées.
const GROUPES_SUIVI_ADMINISTRATIF: { groupe: string; items: { champ: keyof Apprenant; label: string }[] }[] = [
  {
    groupe: "Pièces d'identité & situation",
    items: [
      { champ: "Admin_CniTitreSejour", label: "CNI/Titre de séjour etc." },
      { champ: "Admin_RQTH", label: "RQTH si besoin" },
      { champ: "Admin_Ressources", label: "Ressources (CAF, ASS, France Travail)" },
    ],
  },
  {
    groupe: "Engagement & consentements",
    items: [
      { champ: "Admin_ContratPLIE91", label: "Contrat d'engagement PLIE 91 + Fiche de préconisation" },
      { champ: "Admin_CharteEngagement", label: "Charte d'engagement" },
      { champ: "Admin_AutorisationDroitImage", label: "Autorisation droit à l'image" },
    ],
  },
  {
    groupe: "Diagnostics",
    items: [
      { champ: "Admin_DiagnosticEntree", label: "Diagnostic entrée" },
      { champ: "Admin_DiagnosticEquipement", label: "Diagnostic compétences numériques et équipement" },
      { champ: "Admin_FicheEntretienDiagnostic", label: "Fiche entretien diagnostic" },
      { champ: "Admin_TestLangue", label: "Test de langue" },
    ],
  },
  {
    groupe: "Convocations",
    items: [
      { champ: "Admin_ConvocationFormationPix", label: "Convocation formation/Pix" },
    ],
  },
  {
    groupe: "Financement & fin de parcours",
    items: [
      { champ: "Admin_QuestionnaireFSE", label: "Questionnaire FSE+" },
      { champ: "Admin_AttestationParticipation", label: "Attestation de participation (fin de formation)" },
    ],
  },
];

// Teinte de fond alternée par groupe (identique en-tête/corps du tableau)
// pour que les colonnes d'un même thème restent visuellement rattachées.
const TEINTES_GROUPES = ["bg-white", "bg-[#F3F3F2]/70"];

const TERRITOIRES_DEFAUT = ["91", "92", "Autres"];
const checkboxClass = "w-4 h-4 accent-[#005259] cursor-pointer";

// Cellule "lien" : le champ édité est l'URL elle-même, affichée ensuite comme
// un lien cliquable dont le texte visible reste fixe ("Dossier Drive"),
// jamais l'URL brute.
function CelluleLienDrive({ valeur, onValide }: { valeur?: string; onValide: (v: string) => void }) {
  return valeur ? (
    <a
      href={valeur}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#005259] underline hover:text-[#EA601F] whitespace-nowrap"
    >
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

export default function SuiviAdministratifDigitalUpProSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = decodeURIComponent((params?.id as string) || "");

  const [apprenants, setApprenants] = useState<Apprenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});
  const [territoiresListe, setTerritoiresListe] = useState<string[]>(TERRITOIRES_DEFAUT);
  const [territoireSelectionne, setTerritoireSelectionne] = useState("");
  // codes["parcoursId|territoire|date"] = code interne — voir [id]/page.tsx.
  const [codesSession, setCodesSession] = useState<Record<string, string>>({});
  const codeDeSession = (session: string, territoire: string): string | undefined => {
    const cle = Object.keys(codesSession).find((k) => k.endsWith(`|${territoire}|${session}`));
    return cle ? codesSession[cle] : undefined;
  };

  // Décalages "left" des colonnes figées (Prénom, Nom), mesurés à partir de
  // la largeur réelle des cellules — même mécanisme que la page des
  // préinscriptions ([id]/page.tsx), pour rester aligné même si le contenu
  // de ces colonnes change de largeur.
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

  // Barre de défilement horizontal dupliquée en haut du tableau, synchronisée
  // avec le défilement réel — même mécanisme que [id]/page.tsx.
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
        const [snap, snapSessions, snapTerritoires] = await Promise.all([
          getDocs(query(collection(db, "inscriptions_digitaluppro"), orderBy("createdAt", "desc"))),
          getDoc(doc(db, "configuration_digitaluppro", "sessions")),
          getDoc(doc(db, "configuration_digitaluppro", "territoires")),
        ]);
        setApprenants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Apprenant)));
        if (snapSessions.exists()) {
          setSessions(snapSessions.data().parTerritoire || {});
          setCodesSession(snapSessions.data().codes || {});
        }
        if (snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0) {
          setTerritoiresListe(snapTerritoires.data().liste);
        }
      } catch (error) {
        console.error("Erreur lors du chargement du suivi administratif :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  const apprenantsSession = useMemo(
    () =>
      apprenants
        .filter((a) => a.Session === sessionId && a.Suivi_Recrutement && a.OK_NOK === "OK")
        .sort((a, b) => (a.Nom || "").localeCompare(b.Nom || "", "fr")),
    [apprenants, sessionId]
  );

  const territoireDeSession = useMemo(() => {
    const trouves = new Set<string>();
    Object.values(sessions).forEach((parTerritoire) => {
      Object.entries(parTerritoire).forEach(([territoire, dates]) => {
        if (dates.includes(sessionId)) trouves.add(territoire);
      });
    });
    return Array.from(trouves).join(" / ");
  }, [sessions, sessionId]);

  useEffect(() => {
    if (territoireDeSession) {
      setTerritoireSelectionne(territoireDeSession.split(" / ")[0]);
    } else if (territoiresListe.length > 0 && !territoireSelectionne) {
      setTerritoireSelectionne(territoiresListe[0]);
    }
  }, [territoireDeSession, territoiresListe]);

  const sessionsDuTerritoire = useMemo(
    () => Array.from(new Set(Object.values(sessions).flatMap((parTerritoire) => parTerritoire[territoireSelectionne] || []))).sort((a, b) => a.localeCompare(b, "fr")),
    [sessions, territoireSelectionne]
  );

  const changerSession = (nouvelleSession: string) => {
    router.push(`/mediation/actions-collectives/reponses/digital-up-pro/${encodeURIComponent(nouvelleSession)}/suivi-administratif`);
  };

  const changerTerritoire = (nouveauTerritoire: string) => {
    setTerritoireSelectionne(nouveauTerritoire);
    const datesDuTerritoire = Array.from(new Set(Object.values(sessions).flatMap((parTerritoire) => parTerritoire[nouveauTerritoire] || []))).sort((a, b) => a.localeCompare(b, "fr"));
    if (datesDuTerritoire.length > 0) changerSession(datesDuTerritoire[0]);
  };

  // Deux cases de cette page désignent le même document administratif qu'une
  // case de la page "Apprenant·e·s" (voir CHAMPS_LIES_SUIVI_ADMINISTRATIF
  // dans apprenants/page.tsx) — cocher l'une coche l'autre, et inversement.
  const CHAMPS_LIES_APPRENANTS: Partial<Record<string, string>> = {
    Admin_CharteEngagement: "Charte_Engagement",
    Admin_AutorisationDroitImage: "Signature_Droit_Image",
  };

  const basculerChampBooleen = async (id: string, champ: keyof Apprenant, valeur: boolean) => {
    setApprenants((prev) => prev.map((a) => (a.id === id ? { ...a, [champ]: valeur } : a)));
    const champLie = CHAMPS_LIES_APPRENANTS[champ as string];
    try {
      await updateDoc(doc(db, "inscriptions_digitaluppro", id), champLie ? { [champ]: valeur, [champLie]: valeur } : { [champ]: valeur });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de ${champ} :`, error);
    }
  };

  const basculerChampTexte = async (id: string, champ: keyof Apprenant, valeur: string) => {
    setApprenants((prev) => prev.map((a) => (a.id === id ? { ...a, [champ]: valeur } : a)));
    try {
      await updateDoc(doc(db, "inscriptions_digitaluppro", id), { [champ]: valeur });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de ${champ} :`, error);
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
    <PageGuard pageId="page_access_actions_collectives_accueil">
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
            {territoiresListe.length > 0 && (
              <select
                value={territoireSelectionne}
                onChange={(e) => changerTerritoire(e.target.value)}
                className="bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] outline-none font-medium shadow-sm"
              >
                {territoiresListe.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {sessionsDuTerritoire.length > 0 && (
              <select
                value={sessionId}
                onChange={(e) => changerSession(e.target.value)}
                className="bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] outline-none font-medium shadow-sm max-w-[240px]"
              >
                {!sessionsDuTerritoire.includes(sessionId) && sessionId && (
                  <option value={sessionId}>{codeDeSession(sessionId, territoireSelectionne) || sessionId}</option>
                )}
                {sessionsDuTerritoire.map((s) => (
                  <option key={s} value={s}>{codeDeSession(s, territoireSelectionne) || s}</option>
                ))}
              </select>
            )}
            <Link
              href={`/mediation/actions-collectives/reponses/digital-up-pro/${encodeURIComponent(sessionId)}/apprenants`}
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Apprenant·e·s</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
          </div>
        </div>

        {apprenantsSession.length === 0 ? (
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm p-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
            Aucun·e apprenant·e retenu·e (OK) pour cette session.
          </div>
        ) : (
          <>
          {/* BARRE DE DÉFILEMENT HORIZONTAL (haut) */}
          <div ref={scrollHautRef} onScroll={surScrollHaut} className="sticky top-0 z-30 bg-[#F3F3F2] py-1.5 overflow-x-auto overflow-y-hidden">
            <div style={{ width: largeurTable, height: 1 }}></div>
          </div>

          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
            <div ref={scrollTableRef} onScroll={surScrollTable} className="overflow-x-auto">
              {/* border-separate : indispensable pour que les colonnes figées
                  masquent bien le contenu des colonnes défilantes en dessous. */}
              <table className="border-separate border-spacing-0 text-xs w-full">
                <thead>
                  <tr className="text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                    {/* rowSpan={2} : ces deux cellules occupent déjà la colonne
                        correspondante sur la ligne 2 (groupes) ET la ligne 3
                        (intitulés) — il ne faut PAS les redéclarer sur la ligne
                        suivante, sous peine de décaler toutes les colonnes de 2
                        crans (bug corrigé ici : Prénom/Nom apparaissaient deux
                        fois, ce qui poussait les cases à cocher sous les
                        mauvais intitulés). */}
                    <th ref={refPrenom} className="px-3 py-3 sticky left-0 top-0 bg-[#F3F3F2] z-20 align-bottom" style={{ left: decalages.prenom }} rowSpan={2}>Prénom</th>
                    <th ref={refNom} className="px-3 py-3 sticky top-0 bg-[#F3F3F2] z-20 shadow-[6px_0_8px_-6px_rgba(0,0,0,0.15)] align-bottom" style={{ left: decalages.nom }} rowSpan={2}>Nom</th>
                    {GROUPES_SUIVI_ADMINISTRATIF.map((groupe, gi) => (
                      <th
                        key={groupe.groupe}
                        colSpan={groupe.items.length}
                        className={`px-2 py-2 text-center border-b border-x border-[#404040]/10 whitespace-nowrap ${TEINTES_GROUPES[gi % 2]}`}
                      >
                        {groupe.groupe}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left align-bottom border-x border-[#404040]/10 bg-white" rowSpan={2}>Dossier Drive</th>
                  </tr>
                  <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[9px] uppercase tracking-widest font-bold">
                    {GROUPES_SUIVI_ADMINISTRATIF.map((groupe, gi) =>
                      groupe.items.map((item) => (
                        <th key={item.champ} className={`px-2 py-3 text-left align-top w-[110px] max-w-[110px] whitespace-normal leading-tight border-x border-[#404040]/5 ${TEINTES_GROUPES[gi % 2]}`}>
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
                        <Link href={`/mediation/actions-collectives/reponses/digital-up-pro/${encodeURIComponent(sessionId)}/apprenants/${a.id}`} className="hover:text-[#EA601F] hover:underline transition-colors">
                          {a.Nom || "—"}
                        </Link>
                      </td>
                      {GROUPES_SUIVI_ADMINISTRATIF.map((groupe, gi) =>
                        groupe.items.map((item) => (
                          <td key={item.champ} className={`px-3 py-2 text-center border-x border-b border-[#404040]/10 ${TEINTES_GROUPES[gi % 2]}`}>
                            <input
                              type="checkbox"
                              checked={a[item.champ] as boolean || false}
                              onChange={(e) => basculerChampBooleen(a.id, item.champ, e.target.checked)}
                              className={checkboxClass}
                            />
                          </td>
                        ))
                      )}
                      <td className="px-3 py-2 border-x border-b border-[#404040]/10">
                        <CelluleLienDrive valeur={a.Admin_LienDossierDrive} onValide={(v) => basculerChampTexte(a.id, "Admin_LienDossierDrive", v)} />
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

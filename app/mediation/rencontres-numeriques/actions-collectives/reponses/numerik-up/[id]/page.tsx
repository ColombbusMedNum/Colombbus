"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { HomeIcon, ArrowLeftIcon, MagnifyingGlassIcon, AcademicCapIcon } from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Champs issus du formulaire de pré-inscription (lecture seule ici — ce sont
// les réponses telles que soumises).
interface Inscription {
  id: string;
  Civilité?: string;
  Nom?: string;
  Prénom?: string;
  Téléphone?: string;
  Age?: string;
  Email?: string;
  Niveau_Etudes?: string;
  Ville?: string;
  Territoire?: string;
  QPV?: string;
  Structures_Accompagnement?: string[];
  Structure_Autre?: string;
  ASE?: string;
  Conseiller_Prenom?: string;
  Conseiller_Nom?: string;
  Conseiller_Telephone?: string;
  Conseiller_Email?: string;
  Session?: string;
  // Coché sur /reponses/numerik-up : détermine si la personne apparaît ici,
  // sur la page de suivi détaillé de sa session.
  Suivi_Recrutement?: boolean;
  // Champs de suivi de recrutement, renseignés par l'équipe après coup —
  // absents du formulaire d'origine, ajoutés/modifiés directement ici.
  Critere_Preinscription_Respecte?: string;
  Commentaire_Suivi_Recrutement?: string;
  Date_Mail_Preinscription?: string;
  Pix_Badges_Etoiles?: string;
  Abandon_Avant_Parkour?: string;
  Date_Relance_Pix_1?: string;
  Date_Relance_Pix_2?: string;
  Date_Relance_Pix_3?: string;
  Completion_Pix?: string;
  Appel_Avant_Parkour?: string;
  CV_Recu?: string;
  OK_NOK?: string;
  Date_Mail_Parkour?: string;
}

const inputEditClass = "w-full min-w-[140px] px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] focus:bg-white rounded-lg text-[11px] text-[#404040] outline-none font-medium transition-colors";

const TERRITOIRES_DEFAUT = ["91", "92", "Autres"];

// Duplicata de reponses/numerik-up, paramétré par un identifiant de session :
// n'affiche que les personnes affectées à cette session précise (case
// "Suivi recrutement" cochée sur la page générale des réponses).
export default function ReponsesNumerikUpSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = decodeURIComponent((params?.id as string) || "");

  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  // sessions[parcoursId][territoire] = liste de dates de session, telles que
  // définies sur la page de paramètres — sert de source pour les sélecteurs.
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});
  const [territoiresListe, setTerritoiresListe] = useState<string[]>(TERRITOIRES_DEFAUT);
  const [territoireSelectionne, setTerritoireSelectionne] = useState("");

  useEffect(() => {
    const charger = async () => {
      try {
        const [snapInscriptions, snapSessions, snapTerritoires] = await Promise.all([
          getDocs(query(collection(db, "inscriptions_numerikup"), orderBy("createdAt", "desc"))),
          getDoc(doc(db, "configuration_numerikup", "sessions")),
          getDoc(doc(db, "configuration_numerikup", "territoires")),
        ]);
        setInscriptions(snapInscriptions.docs.map((d) => ({ id: d.id, ...d.data() } as Inscription)));
        if (snapSessions.exists()) {
          setSessions(snapSessions.data().parTerritoire || {});
        }
        if (snapTerritoires.exists() && Array.isArray(snapTerritoires.data().liste) && snapTerritoires.data().liste.length > 0) {
          setTerritoiresListe(snapTerritoires.data().liste);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des inscriptions Numérik'UP :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  // Seules les personnes affectées à cette session (case "Suivi
  // recrutement" cochée sur la page générale) apparaissent ici.
  const inscriptionsSession = useMemo(
    () => inscriptions.filter((i) => i.Session === sessionId && i.Suivi_Recrutement),
    [inscriptions, sessionId]
  );

  // Territoire(s) auxquels appartient la session sélectionnée, d'après la
  // configuration définie sur la page de paramètres.
  const territoireDeSession = useMemo(() => {
    const trouves = new Set<string>();
    Object.values(sessions).forEach((parTerritoire) => {
      Object.entries(parTerritoire).forEach(([territoire, dates]) => {
        if (dates.includes(sessionId)) trouves.add(territoire);
      });
    });
    return Array.from(trouves).join(" / ");
  }, [sessions, sessionId]);

  // Initialise le territoire sélectionné sur celui de la session en cours
  // dès que la configuration est chargée, sinon le premier disponible.
  useEffect(() => {
    if (territoireSelectionne) return;
    if (territoireDeSession) {
      setTerritoireSelectionne(territoireDeSession.split(" / ")[0]);
    } else if (territoiresListe.length > 0) {
      setTerritoireSelectionne(territoiresListe[0]);
    }
  }, [territoireDeSession, territoiresListe, territoireSelectionne]);

  // Sessions du territoire sélectionné, tous parkours confondus — reprend
  // la configuration définie sur la page de paramètres.
  const sessionsDuTerritoire = useMemo(
    () => Array.from(new Set(Object.values(sessions).flatMap((parTerritoire) => parTerritoire[territoireSelectionne] || []))).sort((a, b) => a.localeCompare(b, "fr")),
    [sessions, territoireSelectionne]
  );

  const changerSession = (nouvelleSession: string) => {
    router.push(`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up/${encodeURIComponent(nouvelleSession)}`);
  };

  // Changer de territoire bascule automatiquement sur sa première session,
  // puisque la session affichée doit toujours appartenir au territoire choisi.
  const changerTerritoire = (nouveauTerritoire: string) => {
    setTerritoireSelectionne(nouveauTerritoire);
    const datesDuTerritoire = Array.from(new Set(Object.values(sessions).flatMap((parTerritoire) => parTerritoire[nouveauTerritoire] || []))).sort((a, b) => a.localeCompare(b, "fr"));
    if (datesDuTerritoire.length > 0) {
      changerSession(datesDuTerritoire[0]);
    }
  };

  const inscriptionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return inscriptionsSession;
    return inscriptionsSession.filter((i) => `${i.Prénom || ""} ${i.Nom || ""}`.toLowerCase().includes(terme));
  }, [inscriptionsSession, recherche]);

  // Mise à jour optimiste locale + écriture Firestore d'un seul champ de
  // suivi — chaque cellule éditable enregistre indépendamment des autres.
  const mettreAJourChamp = async (id: string, champ: keyof Inscription, valeur: string) => {
    setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, [champ]: valeur } : i)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikup", id), { [champ]: valeur });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du champ ${champ} :`, error);
    }
  };

  const sexeDeCivilite = (civilite?: string) => (civilite === "Mme" ? "Femme" : civilite === "M." ? "Homme" : "—");

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement des inscriptions...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-[100rem] mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#404040]/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Préinscriptions <span className="text-[#EA601F] font-semibold">Numérik'UP</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5 font-medium">
                Session : {sessionId || "—"}{territoireDeSession && ` — Territoire : ${territoireDeSession}`} — {inscriptionsSession.length} inscription{inscriptionsSession.length > 1 ? "s" : ""} affectée{inscriptionsSession.length > 1 ? "s" : ""} au suivi
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
                {territoiresListe.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            {sessionsDuTerritoire.length > 0 && (
              <select
                value={sessionId}
                onChange={(e) => changerSession(e.target.value)}
                className="bg-white border border-[#404040]/10 rounded-xl px-3 py-2 text-xs text-[#404040] outline-none font-medium shadow-sm max-w-[240px]"
              >
                {!sessionsDuTerritoire.includes(sessionId) && sessionId && (
                  <option value={sessionId}>{sessionId}</option>
                )}
                {sessionsDuTerritoire.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            <Link
              href={`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up/${encodeURIComponent(sessionId)}/apprenants`}
              className="flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white px-3.5 py-2 rounded-xl transition-colors text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <AcademicCapIcon className="w-4 h-4" />
              <span>Apprenant·e·s</span>
            </Link>
            <Link
              href="/mediation/rencontres-numeriques/actions-collectives/reponses"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Réponses au formulaire</span>
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

        {/* RECHERCHE */}
        <div className="relative group max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-[#404040]/40 group-focus-within:text-[#005259] transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Rechercher par nom ou prénom..."
            className="w-full bg-white border border-[#404040]/15 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all shadow-sm font-medium"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        {/* TABLEAU */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-3 py-3 text-center">#</th>
                  <th className="px-3 py-3">Civilité</th>
                  <th className="px-3 py-3">Prénom</th>
                  <th className="px-3 py-3">Nom</th>
                  <th className="px-3 py-3">Téléphone</th>
                  <th className="px-3 py-3">Âge</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Diplôme</th>
                  <th className="px-3 py-3">Sexe</th>
                  <th className="px-3 py-3">Ville</th>
                  <th className="px-3 py-3">Dpt.</th>
                  <th className="px-3 py-3">QPV</th>
                  <th className="px-3 py-3">Prescripteur</th>
                  <th className="px-3 py-3">ASE ?</th>
                  <th className="px-3 py-3">Prénom Référent</th>
                  <th className="px-3 py-3">Nom Référent</th>
                  <th className="px-3 py-3">Tél Référent</th>
                  <th className="px-3 py-3">Mail Référent</th>
                  <th className="px-3 py-3">Critères pré-inscription respecté ?</th>
                  <th className="px-3 py-3">Commentaires de suivi de recrutement</th>
                  <th className="px-3 py-3">Date - Mail envoyé Préinscription</th>
                  <th className="px-3 py-3">Compétences Pix (Badges / Étoiles)</th>
                  <th className="px-3 py-3">Abandon avant Parkour</th>
                  <th className="px-3 py-3">Date 1re relance PIX</th>
                  <th className="px-3 py-3">Date 2e relance PIX</th>
                  <th className="px-3 py-3">Date 3e relance PIX</th>
                  <th className="px-3 py-3">Complétion PIX</th>
                  <th className="px-3 py-3">Appel avant Parkour</th>
                  <th className="px-3 py-3">CV reçu</th>
                  <th className="px-3 py-3">OK / NOK</th>
                  <th className="px-3 py-3">Date - Mail envoyé Parkour (Lieu, début, horaire)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {inscriptionsFiltrees.length > 0 ? (
                  inscriptionsFiltrees.map((i, index) => {
                    const prescripteur = [...(i.Structures_Accompagnement || []), i.Structure_Autre].filter(Boolean).join(", ");
                    return (
                      <tr key={i.id} className="hover:bg-[#F3F3F2]/60 transition-colors align-top">
                        <td className="px-3 py-2 text-center text-[#404040]/50 font-bold">{index + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Civilité || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259]">{i.Prénom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-[#005259] uppercase">{i.Nom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Téléphone || "—"}</td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">{i.Age || "—"}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate">{i.Email || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Niveau_Etudes || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{sexeDeCivilite(i.Civilité)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Ville || "—"}</td>
                        <td className="px-3 py-2 text-center">{i.Territoire || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.QPV || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={prescripteur}>{prescripteur || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.ASE || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Prenom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Nom || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{i.Conseiller_Telephone || "—"}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate">{i.Conseiller_Email || "—"}</td>

                        <td className="px-3 py-2">
                          <select defaultValue={i.Critere_Preinscription_Respecte || ""} onChange={(e) => mettreAJourChamp(i.id, "Critere_Preinscription_Respecte", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Commentaire_Suivi_Recrutement || ""} onBlur={(e) => mettreAJourChamp(i.id, "Commentaire_Suivi_Recrutement", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" defaultValue={i.Date_Mail_Preinscription || ""} onChange={(e) => mettreAJourChamp(i.id, "Date_Mail_Preinscription", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Pix_Badges_Etoiles || ""} onBlur={(e) => mettreAJourChamp(i.id, "Pix_Badges_Etoiles", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Abandon_Avant_Parkour || ""} onChange={(e) => mettreAJourChamp(i.id, "Abandon_Avant_Parkour", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" defaultValue={i.Date_Relance_Pix_1 || ""} onChange={(e) => mettreAJourChamp(i.id, "Date_Relance_Pix_1", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" defaultValue={i.Date_Relance_Pix_2 || ""} onChange={(e) => mettreAJourChamp(i.id, "Date_Relance_Pix_2", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" defaultValue={i.Date_Relance_Pix_3 || ""} onChange={(e) => mettreAJourChamp(i.id, "Date_Relance_Pix_3", e.target.value)} className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Completion_Pix || ""} onBlur={(e) => mettreAJourChamp(i.id, "Completion_Pix", e.target.value)} placeholder="Ex : 80%" className={inputEditClass} />
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.Appel_Avant_Parkour || ""} onChange={(e) => mettreAJourChamp(i.id, "Appel_Avant_Parkour", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.CV_Recu || ""} onChange={(e) => mettreAJourChamp(i.id, "CV_Recu", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select defaultValue={i.OK_NOK || ""} onChange={(e) => mettreAJourChamp(i.id, "OK_NOK", e.target.value)} className={inputEditClass}>
                            <option value="">—</option>
                            <option value="OK">OK</option>
                            <option value="NOK">NOK</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" defaultValue={i.Date_Mail_Parkour || ""} onBlur={(e) => mettreAJourChamp(i.id, "Date_Mail_Parkour", e.target.value)} placeholder="Lieu, début, horaire" className={inputEditClass} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={30} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                      🔍 Aucune inscription trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
    </PageGuard>
  );
}

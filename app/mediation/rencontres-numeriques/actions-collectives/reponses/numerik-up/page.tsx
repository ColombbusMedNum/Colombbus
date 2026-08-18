"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { useRouter } from "next/navigation";
import { HomeIcon, ArrowLeftIcon, MagnifyingGlassIcon, ClipboardDocumentCheckIcon, ChartPieIcon } from "@heroicons/react/24/outline";
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
  // Parcours et session choisis à l'inscription — la session est parfois
  // générique (ancienne réponse, ou aucune session ne convenait) : dans ce
  // cas elle doit être affectée manuellement par l'équipe.
  Parcours?: string;
  Session?: string;
  // Coché par l'équipe pour affecter cette personne au suivi de recrutement
  // détaillé de sa session, sur /reponses/numerik-up/[id].
  Suivi_Recrutement?: boolean;
}

interface Parcours {
  id: string;
  label: string;
}

const PARCOURS_DEFAUT: Parcours[] = [
  { id: "crea", label: "Numérik'Up Créa : Game Design + Graphisme" },
  { id: "tech", label: "Numérik'Up Tech : Développement Web + Maintenance informatique" },
];

const inputEditClass = "w-full min-w-[140px] px-2 py-1.5 bg-[#F3F3F2] border border-[#404040]/10 focus:border-[#005259] focus:bg-white rounded-lg text-[11px] text-[#404040] outline-none font-medium transition-colors";

// Signale les mineur·e·s avec le même jaune que les groupes ACI de l'agenda.
const estMineur = (age?: string) => {
  const n = parseInt(age || "", 10);
  return !isNaN(n) && n < 18;
};

export default function ReponsesNumerikUpPage() {
  const router = useRouter();
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [parcoursListe, setParcoursListe] = useState<Parcours[]>(PARCOURS_DEFAUT);
  // sessions[parcoursId][territoire] = liste de dates de session — permet de
  // proposer les sessions disponibles pour le territoire de chaque inscrit.
  const [sessions, setSessions] = useState<Record<string, Record<string, string[]>>>({});

  useEffect(() => {
    const charger = async () => {
      try {
        const [snapInscriptions, snapParcours, snapSessions] = await Promise.all([
          getDocs(query(collection(db, "inscriptions_numerikup"), orderBy("createdAt", "desc"))),
          getDoc(doc(db, "configuration_numerikup", "parcours")),
          getDoc(doc(db, "configuration_numerikup", "sessions")),
        ]);
        setInscriptions(snapInscriptions.docs.map((d) => ({ id: d.id, ...d.data() } as Inscription)));
        if (snapParcours.exists() && Array.isArray(snapParcours.data().liste) && snapParcours.data().liste.length > 0) {
          setParcoursListe(snapParcours.data().liste);
        }
        if (snapSessions.exists()) {
          setSessions(snapSessions.data().parTerritoire || {});
        }
      } catch (error) {
        console.error("Erreur lors du chargement des inscriptions Numérik'UP :", error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  // Toutes les sessions existantes, groupées par territoire, tous parkours
  // confondus — permet de forcer le passage d'un·e inscrit·e vers n'importe
  // quelle autre session, y compris hors de son territoire déclaré.
  const sessionsParTerritoire = useMemo(() => {
    const parTerritoire: Record<string, Set<string>> = {};
    Object.values(sessions).forEach((parTerr) => {
      Object.entries(parTerr).forEach(([territoire, dates]) => {
        if (!parTerritoire[territoire]) parTerritoire[territoire] = new Set();
        dates.forEach((d) => parTerritoire[territoire].add(d));
      });
    });
    return Object.fromEntries(
      Object.entries(parTerritoire).map(([t, dates]) => [t, Array.from(dates).sort((a, b) => a.localeCompare(b, "fr"))])
    );
  }, [sessions]);

  const inscriptionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return inscriptions;
    return inscriptions.filter((i) => `${i.Prénom || ""} ${i.Nom || ""}`.toLowerCase().includes(terme));
  }, [inscriptions, recherche]);

  // Sessions définies sur la page de paramètres — sert uniquement à pointer
  // le bouton "Suivi recrutement" vers une première session valide (le choix
  // précis de la session se fait ensuite sur cette page-là).
  const sessionsDistinctes = useMemo(
    () => Array.from(new Set(Object.values(sessions).flatMap((parTerritoire) => Object.values(parTerritoire).flat()))).sort((a, b) => a.localeCompare(b, "fr")),
    [sessions]
  );

  const allerAuSuiviRecrutement = () => {
    if (sessionsDistinctes.length === 0) return;
    router.push(`/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up/${encodeURIComponent(sessionsDistinctes[0])}`);
  };

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

  // Bascule la case "Suivi de recrutement" — une fois cochée, la personne
  // apparaît sur la page de suivi détaillé de sa session (.../[id]).
  const basculerSuiviRecrutement = async (id: string, valeur: boolean) => {
    setInscriptions((prev) => prev.map((i) => (i.id === id ? { ...i, Suivi_Recrutement: valeur } : i)));
    try {
      await updateDoc(doc(db, "inscriptions_numerikup", id), { Suivi_Recrutement: valeur });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du suivi de recrutement :", error);
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
                {inscriptions.length} inscription{inscriptions.length > 1 ? "s" : ""} reçue{inscriptions.length > 1 ? "s" : ""} — suivi de recrutement
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {sessionsDistinctes.length > 0 && (
              <button
                type="button"
                onClick={allerAuSuiviRecrutement}
                className="flex items-center gap-2 bg-[#EA601F] hover:bg-[#EF736A] text-white px-3.5 py-2 rounded-xl transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm"
              >
                <ClipboardDocumentCheckIcon className="w-4 h-4" />
                <span>Suivi recrutement</span>
              </button>
            )}
            <Link
              href="/mediation/rencontres-numeriques/actions-collectives/reponses/numerik-up/statistiques"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ChartPieIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Statistiques</span>
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
                  <th className="px-3 py-3">Session</th>
                  <th className="px-3 py-3 text-center">Suivi recrutement</th>
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
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {i.Age ? (
                            estMineur(i.Age) ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-[#F9C44E]/20 text-[#005259] border border-[#F9C44E] text-[10px] font-bold">{i.Age}</span>
                            ) : i.Age
                          ) : "—"}
                        </td>
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
                          <select
                            value={i.Session || ""}
                            onChange={(e) => mettreAJourChamp(i.id, "Session", e.target.value)}
                            className={inputEditClass}
                          >
                            <option value="">-- Choisir une session --</option>
                            {i.Session && !Object.values(sessionsParTerritoire).some((dates) => dates.includes(i.Session as string)) && (
                              <option value={i.Session}>{i.Session}</option>
                            )}
                            {Object.entries(sessionsParTerritoire).map(([territoire, dates]) => (
                              <optgroup key={territoire} label={`Territoire ${territoire}`}>
                                {dates.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={i.Suivi_Recrutement || false}
                            onChange={(e) => basculerSuiviRecrutement(i.id, e.target.checked)}
                            title="Affecter au suivi de recrutement de sa session"
                            className="w-4 h-4 accent-[#EA601F] cursor-pointer"
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={20} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, collectionGroup, getDocs } from "firebase/firestore";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { PermissionGuard } from "@/components/PermissionGuard";
import PageGuard from "@/components/PageGuard";
import { formatPhoneNumber } from "@/lib/formatPhone";
import {
  HomeIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

// Police Quicksand pour toute la page
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const CODE_POSTAL_SURESNES = "92150";

// Rendez-vous qui ne comptent pas comme une thématique d'accompagnement
// (mêmes moments exclus que le calcul de la "thématique phare" sur la fiche
// bénéficiaire, cf. [id]/page.tsx).
const MOMENTS_EXCLUS = ["Diagnostic Initial", "Diagnostic Final", "Questionnaire de satisfaction", "Collecte Tech"];

type Trimestre = "Tous" | "T1" | "T2" | "T3" | "T4";

function trimestreDeDate(date: Date): Trimestre {
  const mois = date.getMonth();
  if (mois <= 2) return "T1";
  if (mois <= 5) return "T2";
  if (mois <= 8) return "T3";
  return "T4";
}

// Correspondance vers les 8 thématiques de la plateforme "Numérique pour
// tous" (NPT) de la mairie de Suresnes (liste fermée, cf. capture d'écran
// fournie). Les thématiques internes identiques y sont reprises telles
// quelles ; les autres sont rattachées à la catégorie NPT la plus proche
// (approximation à valider — pas d'équivalent exact côté mairie).
const THEMATIQUES_MAIRIE: Record<string, string> = {
  "Accès aux droits et aux offres de soin": "Accès aux droits et aux offres de soin",
  "Choisir ses logiciels informatiques": "Choisir ses logiciels informatiques",
  "Communiquer par internet": "Communiquer par internet",
  "Création multimédia": "Création multimédia",
  "Gestion documentaire": "Gestion documentaire",
  "Le numérique au quotidien": "Le numérique au quotidien",
  "Les outils pour la vie professionnelle": "Les outils pour la vie professionnelle",
  "Premiers pas vers le numérique": "Premiers pas vers le numérique",
  "Ordinateur": "Premiers pas vers le numérique",
  "Smartphone": "Premiers pas vers le numérique",
  "Utilisation sécurisée d’internet": "Le numérique au quotidien",
  "Utilisation sécurisée d'internet": "Le numérique au quotidien",
  "Recherche d’emploi sur internet": "Les outils pour la vie professionnelle",
  "Recherche d'emploi sur internet": "Les outils pour la vie professionnelle",
  "Outils informatiques pour la fabrication": "Les outils pour la vie professionnelle",
  // Collecte Tech (remise de matériel / tests de positionnement) : pas de
  // catégorie NPT équivalente — rattachée par défaut à la plus proche
  // (premier contact/démarrage avec un équipement numérique).
  "Collecte Tech": "Premiers pas vers le numérique",
  "Collecte Tech - Remise de matériel": "Premiers pas vers le numérique",
  "Collecte Tech - Tests de positionnement": "Premiers pas vers le numérique",
};

// Par défaut, si une thématique interne n'a pas d'entrée explicite ci-dessus
// (nouvelle thématique ajoutée plus tard...), on la rattache quand même à la
// catégorie NPT la plus proche plutôt que de laisser un tiret — sauf quand il
// n'y a tout simplement aucune thématique enregistrée pour ce bénéficiaire.
const THEMATIQUE_MAIRIE_PAR_DEFAUT = "Premiers pas vers le numérique";

function thematiqueMairieCorrespondante(thematique: string): string {
  if (!thematique || thematique === "—") return "—";
  return THEMATIQUES_MAIRIE[thematique] || THEMATIQUE_MAIRIE_PAR_DEFAUT;
}

// Beaucoup de profils n'ont qu'une Date_Naissance et pas de champ Age figé
// (l'âge y est toujours recalculé à l'affichage, cf. calculerAgeEnDirect
// dans [id]/page.tsx) — sans ce calcul, leur âge n'apparaît jamais ici.
function calculerAge(dateNaissanceStr?: string): number | null {
  if (!dateNaissanceStr) return null;
  const naissance = new Date(dateNaissanceStr);
  if (isNaN(naissance.getTime())) return null;
  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - naissance.getFullYear();
  const moisDiff = aujourdhui.getMonth() - naissance.getMonth();
  if (moisDiff < 0 || (moisDiff === 0 && aujourdhui.getDate() < naissance.getDate())) age--;
  return age < 0 || isNaN(age) ? null : age;
}

export default function ListeBeneficiairesSuresnes() {
  const [beneficiaires, setBeneficiaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [trimestreFiltre, setTrimestreFiltre] = useState<Trimestre>("Tous");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [querySnapshot, visitesSnapshot] = await Promise.all([
          getDocs(collection(db, "utilisateurs")),
          getDocs(collectionGroup(db, "visites")).catch(() => null),
        ]);

        const visitesParUtilisateur = new Map<string, any[]>();
        visitesSnapshot?.docs.forEach((docSnap) => {
          const userId = docSnap.ref.parent.parent?.id;
          if (!userId) return;
          if (!visitesParUtilisateur.has(userId)) visitesParUtilisateur.set(userId, []);
          visitesParUtilisateur.get(userId)!.push(docSnap.data());
        });

        const resultats = querySnapshot.docs
          .map((docSnap) => {
            const userData: any = docSnap.data();
            return { id: docSnap.id, userData, codePostal: (userData.Code_Postal || "").toString().trim() };
          })
          .filter(({ codePostal }) => codePostal === CODE_POSTAL_SURESNES)
          .map(({ id, userData, codePostal }) => {
            const nom = userData.Nom || userData.nom || "";
            const prenom = userData.Prénom || userData.prénom || userData.Prenom || userData.prenom || "";
            const docsVisites = visitesParUtilisateur.get(id) || [];

            // La première visite doit correspondre à une venue effective : on
            // écarte les rendez-vous marqués comme une absence (mêmes critères
            // que le compteur "totalVisites" de la liste principale).
            const visitesTriees = docsVisites
              .filter((v) => v.statut !== "Absent" && v.statut !== "Annulé" && v.presence !== "Absent" && v.presence !== false && v.date)
              .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
            const premiereVisite = visitesTriees[0] || null;
            const premiereDateObj = premiereVisite ? new Date(premiereVisite.date) : null;
            // "Suresnes - à domicile" désigne une visite au domicile du
            // bénéficiaire plutôt qu'au lieu d'accueil (même règle que
            // normaliserSiteId dans bilan-suresnes/page.tsx) ; sinon, la
            // visite a eu lieu sur place, à Suresnes.
            const typeVisite = premiereVisite
              ? ((premiereVisite.lieu || "").toUpperCase().includes("DOMICILE") ? "Domicile" : "Suresnes")
              : "—";

            const presentsStandard = docsVisites.filter(
              (v) => v.statut === "Présent" && !MOMENTS_EXCLUS.includes(v.moment)
            );
            const compteurs: Record<string, number> = {};
            presentsStandard.forEach((v) => {
              if (v.thematique && v.thematique.trim() !== "") {
                compteurs[v.thematique] = (compteurs[v.thematique] || 0) + 1;
              }
            });
            const cles = Object.keys(compteurs);
            const thematiquePhare = cles.length === 0 ? "—" : cles.reduce((a, b) => (compteurs[a] > compteurs[b] ? a : b));

            return {
              id,
              civilite: userData.Civilité || "",
              nom,
              prenom,
              codePostal,
              telephone: userData.Téléphone || userData.telephone || "",
              age: userData.Age || userData.age || calculerAge(userData.Date_Naissance) || "",
              // Le type de visite (Domicile/Suresnes) de la 1ère venue est
              // fondu directement dans le lieu d'accueil plutôt que d'avoir
              // sa propre colonne.
              lieuAccueil: (() => {
                const lieuProfil = userData.Lieu_RDV || userData.lieuRDV || "";
                if (typeVisite === "Domicile") return lieuProfil ? `${lieuProfil} - Domicile` : "Domicile";
                return lieuProfil || (premiereVisite ? "Suresnes" : "");
              })(),
              thematiquePhare,
              thematiqueMairie: thematiqueMairieCorrespondante(thematiquePhare),
              premiereDateObj,
              premiereVisiteAffichee: premiereDateObj
                ? premiereDateObj.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
                : "—",
            };
          });

        // Ordre de première visite (les profils sans visite enregistrée sont
        // relégués en fin de liste, faute de date à trier).
        resultats.sort((a, b) => {
          if (!a.premiereDateObj && !b.premiereDateObj) return 0;
          if (!a.premiereDateObj) return 1;
          if (!b.premiereDateObj) return -1;
          return a.premiereDateObj.getTime() - b.premiereDateObj.getTime();
        });

        setBeneficiaires(resultats);
      } catch (error) {
        console.error("Erreur lors de la récupération des bénéficiaires de Suresnes :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const { beneficiairesFiltres, comptesTrimestres } = useMemo(() => {
    const comptes: Record<Trimestre, number> = { Tous: beneficiaires.length, T1: 0, T2: 0, T3: 0, T4: 0 };
    beneficiaires.forEach((b) => {
      if (b.premiereDateObj) comptes[trimestreDeDate(b.premiereDateObj)]++;
    });

    const filtres = trimestreFiltre === "Tous"
      ? beneficiaires
      : beneficiaires.filter((b) => b.premiereDateObj && trimestreDeDate(b.premiereDateObj) === trimestreFiltre);

    return { beneficiairesFiltres: filtres, comptesTrimestres: comptes };
  }, [beneficiaires, trimestreFiltre]);

  const exporterCSV = () => {
    if (beneficiairesFiltres.length === 0) return;
    const headers = "Lieu d'accueil;Civilité;Prénom;Nom;CP;N° Tel;Âge;Thématique;Thématique (Numérique pour tous);1ère visite\n";
    const rows = beneficiairesFiltres.map((b) =>
      [b.lieuAccueil, b.civilite, b.prenom, b.nom, b.codePostal, formatPhoneNumber(b.telephone), b.age, b.thematiquePhare, b.thematiqueMairie, b.premiereVisiteAffichee]
        .map((champ) => String(champ ?? "").replace(/;/g, ",").replace(/\n/g, " "))
        .join(";")
    );
    const blob = new Blob([headers + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const suffixe = trimestreFiltre !== "Tous" ? `_${trimestreFiltre}` : "";
    link.setAttribute("download", `beneficiaires_suresnes${suffixe}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement des bénéficiaires de Suresnes...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_liste_beneficiaires_suresnes">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Bénéficiaires <span className="text-[#EA601F] font-normal">de Suresnes ({CODE_POSTAL_SURESNES})</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5">
                Triés par ordre de première visite
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/mediation/rencontres-numeriques/liste-beneficiaires"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Retour à la liste</span>
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

        {/* FILTRE PAR TRIMESTRE + EXPORT */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-[#404040]/60 uppercase tracking-widest mr-1">
              Filtrer par :
            </span>

            <PermissionGuard actionId="benef_suresnes_filter_trimestre">
              <>
                <button
                  onClick={() => setTrimestreFiltre("Tous")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    trimestreFiltre === "Tous"
                      ? "bg-[#005259] text-white shadow-sm"
                      : "bg-[#F3F3F2] text-[#404040] border border-[#404040]/10 hover:border-[#005259] hover:text-[#005259]"
                  }`}
                >
                  Tous ({comptesTrimestres.Tous})
                </button>
                {(["T1", "T2", "T3", "T4"] as const).map((tri) => (
                  <button
                    key={tri}
                    onClick={() => setTrimestreFiltre(tri)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      trimestreFiltre === tri
                        ? "bg-[#005259] text-white shadow-sm"
                        : "bg-[#F3F3F2] text-[#404040] border border-[#404040]/10 hover:border-[#005259] hover:text-[#005259]"
                    }`}
                  >
                    {tri} ({comptesTrimestres[tri]})
                  </button>
                ))}
              </>
            </PermissionGuard>
          </div>

          <PermissionGuard actionId="benef_suresnes_export_csv">
            <button
              onClick={exporterCSV}
              disabled={beneficiairesFiltres.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#005259] hover:bg-[#EA601F] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed sm:ml-auto"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>Exporter (.csv)</span>
            </button>
          </PermissionGuard>
        </div>

        {/* RÉSULTATS */}
        {beneficiairesFiltres.length > 0 ? (
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Identité</th>
                  <th className="px-6 py-4 hidden md:table-cell">Contact</th>
                  <th className="px-6 py-4 hidden sm:table-cell">Âge</th>
                  <th className="px-6 py-4 hidden lg:table-cell">Lieu d'accueil</th>
                  <th className="px-6 py-4 hidden lg:table-cell">Thématique la plus récurrente</th>
                  <th className="px-6 py-4 hidden lg:table-cell">Thématique (Numérique pour tous)</th>
                  <th className="px-6 py-4">1ère visite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {beneficiairesFiltres.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F3F3F2]/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-base tracking-tight uppercase text-[#005259]">
                        <span className="text-[#404040]/60 font-normal normal-case text-xs mr-1">
                          {b.civilite ? `${b.civilite} ` : ""}
                        </span>
                        {b.nom || "SANS NOM"}
                      </div>
                      <div className="text-xs text-[#404040] font-medium mt-1">
                        {b.prenom || "Sans prénom"}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="text-xs font-medium text-[#404040]">
                        {formatPhoneNumber(b.telephone)}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="text-xs font-bold text-[#404040]">
                        {b.age || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="text-xs font-medium text-[#404040]">
                        {b.lieuAccueil || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide text-[#005259] bg-[#005259]/10 px-2.5 py-1 rounded-xl border border-[#005259]/20">
                        {b.thematiquePhare}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide text-[#EA601F] bg-[#EA601F]/10 px-2.5 py-1 rounded-xl border border-[#EA601F]/20">
                        {b.thematiqueMairie}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-[#404040]/80">
                        {b.premiereVisiteAffichee}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
            🔍 Aucun bénéficiaire de Suresnes pour ce filtre.
          </div>
        )}

        {/* FOOTER STATS */}
        <div className="flex flex-col sm:flex-row justify-between items-center px-2 gap-2 text-xs">
          <p className="text-[#404040]/80 font-medium">
            Affichage de <span className="text-[#005259] font-bold">{beneficiairesFiltres.length}</span> bénéficiaire(s)
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-[#404040]/60 uppercase tracking-widest font-bold">
            <UserGroupIcon className="w-3.5 h-3.5 text-[#005259]" />
            <span>Base Centrale Colombbus</span>
          </div>
        </div>

      </div>
    </main>
    </PageGuard>
  );
}

"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collectionGroup, onSnapshot, doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { 
  ChevronLeftIcon, 
  MapPinIcon, 
  CalendarIcon, 
  UserIcon, 
  DocumentTextIcon,
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  FunnelIcon
} from "@heroicons/react/24/outline";

// --- TYPES ---
interface VisiteComplet {
  id: string;
  userId: string;
  nomBeneficiaire: string;
  prenomBeneficiaire: string;
  date: string;
  lieu: string;
  details: string;
  statut: "Présent" | "Absent";
  thematique?: string;
  mediateur?: string;
  moment?: string;
}

export default function RendezVousParLieuPage() {
  const [visites, setVisites] = useState<VisiteComplet[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtres & Recherche
  const [recherche, setRecherche] = useState("");
  const [lieuFiltre, setLieuFiltre] = useState<string>("Tous");

  useEffect(() => {
    // Récupération globale de toutes les sous-collections "visites"
    const unsubVisites = onSnapshot(collectionGroup(db, "visites"), async (snapshot) => {
      // 1. Filtrer pour éliminer diagnostics, auto-évaluations, QCM, collectes et bilans tech
      const docsVisitesUniquement = snapshot.docs.filter((docSnap) => {
        const data = docSnap.data();
        const path = docSnap.ref.path.toLowerCase();
        const details = (data.details || "").toLowerCase();
        const thematique = (data.thematique || "").toLowerCase();
        const type = (data.type || "").toLowerCase();

        // Mots-clés / Motifs à exclure
        const aExclure = [
          "diagnostic",
          "auto-evaluation",
          "autoevaluation",
          "collecte",
          "bilan tech",
          "test",
          "qcm",
          "bilan automatique"
        ];

        const contientElementExclu = aExclure.some((mot) => 
          path.includes(mot) || 
          thematique.includes(mot) || 
          details.includes(mot) || 
          type.includes(mot)
        );

        return !contientElementExclu;
      });

      // 2. Récupérer la liste des IDs utilisateurs uniques
      const userIdsUniques = Array.from(
        new Set(docsVisitesUniquement.map((d) => d.ref.parent.parent?.id).filter(Boolean))
      ) as string[];

      // 3. Récupérer les profils utilisateurs associés pour obtenir Nom/Prénom
      const utilisateursMap: Record<string, { nom: string; prenom: string }> = {};
      
      await Promise.all(
        userIdsUniques.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, "utilisateurs", uid));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              utilisateursMap[uid] = {
                nom: uData.Nom || "Inconnu",
                prenom: uData.Prénom || "Inconnu",
              };
            } else {
              utilisateursMap[uid] = { nom: "Utilisateur", prenom: "Inconnu" };
            }
          } catch (error) {
            console.error("Erreur chargement utilisateur :", error);
            utilisateursMap[uid] = { nom: "Inconnu", prenom: "" };
          }
        })
      );

      // 4. Assembler les données de visites + infos bénéficiaire
      const listeComplete: VisiteComplet[] = docsVisitesUniquement.map((docSnap) => {
        const data = docSnap.data();
        const parentUserId = docSnap.ref.parent.parent?.id || "";
        const userInfo = utilisateursMap[parentUserId] || { nom: "Inconnu", prenom: "" };

        return {
          id: docSnap.id,
          userId: parentUserId,
          nomBeneficiaire: userInfo.nom,
          prenomBeneficiaire: userInfo.prenom,
          date: data.date || "",
          lieu: data.lieu || "Lieu non spécifié",
          details: data.details || "",
          statut: data.statut || "Présent",
          thematique: data.thematique || "",
          mediateur: data.mediateur || "",
          moment: data.moment || "",
        };
      });

      // Trier par date décroissante
      listeComplete.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setVisites(listeComplete);
      setLoading(false);
    });

    return () => unsubVisites();
  }, []);

  // Filtrage par recherche
  const visitesFiltrees = visites.filter((v) => {
    const terme = recherche.toLowerCase();
    const matchNom = `${v.nomBeneficiaire} ${v.prenomBeneficiaire}`.toLowerCase().includes(terme);
    const matchDetails = v.details.toLowerCase().includes(terme);
    const matchLieu = v.lieu.toLowerCase().includes(terme);
    const matchThematique = v.thematique?.toLowerCase().includes(terme);

    const matchRecherche = matchNom || matchDetails || matchLieu || matchThematique;
    const matchFiltreLieu = lieuFiltre === "Tous" || v.lieu === lieuFiltre;

    return matchRecherche && matchFiltreLieu;
  });

  // Regroupement par lieu
  const rdvsParLieu = visitesFiltrees.reduce<Record<string, VisiteComplet[]>>((acc, visite) => {
    const lieuCle = visite.lieu.trim() || "Non spécifié";
    if (!acc[lieuCle]) {
      acc[lieuCle] = [];
    }
    acc[lieuCle].push(visite);
    return acc;
  }, {});

  // Extraction de la liste unique des lieux pour le sélecteur
  const tousLesLieux = Array.from(new Set(visites.map((v) => v.lieu.trim() || "Non spécifié"))).sort();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold animate-pulse">
        Chargement des rendez-vous par lieux...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* EN-TÊTE & RETOUR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors group text-xs font-bold uppercase tracking-widest mb-2"
            >
              <ChevronLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Retour à l'accueil</span>
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic flex items-center gap-3">
              <BuildingOffice2Icon className="w-8 h-8 text-emerald-500 not-italic" />
              <span>Rendez-vous <span className="text-emerald-500 not-italic">Par Lieux</span></span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Vue synthétique de tous les entretiens individuels classés par emplacement géographique.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total :</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{visitesFiltrees.length}</span>
            <span className="text-xs text-slate-500">RDV(s)</span>
          </div>
        </div>

        {/* BARRE DE FILTRES ET RECHERCHE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
          {/* Recherche textuelle */}
          <div className="relative md:col-span-2">
            <MagnifyingGlassIcon className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un bénéficiaire, un détail, une thématique..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 outline-none transition-all"
            />
          </div>

          {/* Sélecteur de lieu */}
          <div className="relative">
            <FunnelIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={lieuFiltre}
              onChange={(e) => setLieuFiltre(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 outline-none transition-all appearance-none"
            >
              <option value="Tous">📍 Tous les lieux ({tousLesLieux.length})</option>
              {tousLesLieux.map((lieu) => (
                <option key={lieu} value={lieu}>
                  {lieu}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* AFFICHAGE DES RDV GROUPÉS PAR LIEU */}
        {Object.keys(rdvsParLieu).length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 font-mono text-xs">
            Aucun rendez-vous trouvé pour ces critères.
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(rdvsParLieu).map(([lieu, listeRdv]) => (
              <section 
                key={lieu} 
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
              >
                {/* Entête du Lieu */}
                <div className="bg-slate-950/80 border-b border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                      <MapPinIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-white uppercase tracking-wide">
                        {lieu}
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        {listeRdv.length} rendez-vous répertorié{listeRdv.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="self-start sm:self-auto px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-400">
                    {listeRdv.filter(r => r.statut === "Présent").length} Présent(s)
                  </span>
                </div>

                {/* Tableau des rendez-vous du lieu */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-slate-500 uppercase tracking-wider text-[10px] font-bold bg-slate-950/30">
                        <th className="py-3 px-4">Date & Moment</th>
                        <th className="py-3 px-4">Bénéficiaire</th>
                        <th className="py-3 px-4">Axe / Médiateur</th>
                        <th className="py-3 px-4">Détails de l'entretien</th>
                        <th className="py-3 px-4 text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {listeRdv.map((rdv) => (
                        <tr key={rdv.id} className="hover:bg-slate-950/40 transition-colors">
                          {/* Date */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                              <div>
                                <p className="font-mono font-bold text-white">
                                  {rdv.date ? new Date(rdv.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "—"}
                                </p>
                                {rdv.moment && (
                                  <p className="text-[10px] text-slate-500 uppercase tracking-tight">{rdv.moment}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Nom / Prénom du Bénéficiaire */}
<td className="py-3.5 px-4 whitespace-nowrap">
  {rdv.userId ? (
    <Link 
      href={`/liste-beneficiaires/${rdv.userId}`}
      className="group inline-flex items-center gap-2 hover:text-emerald-400 transition-colors"
    >
      <UserIcon className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
      <span className="font-bold text-slate-200 uppercase tracking-wide group-hover:underline">
        {rdv.nomBeneficiaire} <span className="text-emerald-400 capitalize">{rdv.prenomBeneficiaire}</span>
      </span>
    </Link>
  ) : (
    <div className="inline-flex items-center gap-2 text-slate-400">
      <UserIcon className="w-4 h-4 text-slate-600" />
      <span className="font-bold uppercase tracking-wide">
        {rdv.nomBeneficiaire} <span className="capitalize">{rdv.prenomBeneficiaire}</span>
      </span>
    </div>
  )}
</td>

                          {/* Détails de ce qui a été fait */}
                          <td className="py-3.5 px-4 min-w-[280px]">
                            <div className="flex items-start gap-2">
                              <DocumentTextIcon className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                              <p className="text-slate-300 leading-relaxed text-[11px] whitespace-pre-wrap">
                                {rdv.statut === "Absent" ? (
                                  <span className="italic text-slate-500">— Bénéficiaire absent —</span>
                                ) : (
                                  rdv.details || <span className="italic text-slate-600">Aucun détail rédigé.</span>
                                )}
                              </p>
                            </div>
                          </td>

                          {/* Statut */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {rdv.statut === "Présent" ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Présent
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                Absent
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
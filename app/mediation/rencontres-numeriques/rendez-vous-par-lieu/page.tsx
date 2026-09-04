"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, collectionGroup, getDocs, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import { 
  ChevronLeftIcon, 
  MapPinIcon, 
  CalendarIcon, 
  UserIcon, 
  DocumentTextIcon,
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  FunnelIcon,
  TagIcon,
  HomeIcon,
  CheckCircleIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";
import PageGuard from "@/components/PageGuard";

// --- TYPES ---
interface VisiteBrute {
  id: string;
  userId: string;
  date: string;
  lieu: string;
  details: string;
  statut: "Présent" | "Absent";
  thematique?: string;
  mediateur?: string;
  moment?: string;
}

interface VisiteComplet extends VisiteBrute {
  nomBeneficiaire: string;
  prenomBeneficiaire: string;
}

export default function RendezVousParLieuPage() {
  const [visitesBrutes, setVisitesBrutes] = useState<VisiteBrute[]>([]);
  const [utilisateursMap, setUtilisateursMap] = useState<Record<string, { nom: string; prenom: string }>>({});
  const [loadingVisites, setLoadingVisites] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loading = loadingVisites || loadingUsers;

  // Filtres & Recherche
  const [recherche, setRecherche] = useState("");
  const [lieuFiltre, setLieuFiltre] = useState<string>("Tous");

  // 1. Récupération globale de toutes les sous-collections "visites", en temps réel
  useEffect(() => {
    const unsubVisites = onSnapshot(collectionGroup(db, "visites"), (snapshot) => {
      // Filtrer pour éliminer diagnostics, auto-évaluations, QCM, collectes et bilans tech
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

      const listeBrute: VisiteBrute[] = docsVisitesUniquement.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: docSnap.ref.parent.parent?.id || "",
          date: data.date || "",
          lieu: data.lieu || "Lieu non spécifié",
          details: data.details || "",
          statut: data.statut || "Présent",
          thematique: data.thematique || "",
          mediateur: data.mediateur || "",
          moment: data.moment || "",
        };
      });

      setVisitesBrutes(listeBrute);
      setLoadingVisites(false);
    }, (error) => {
      console.error("Erreur de chargement des rendez-vous :", error);
      setLoadError(error.message);
      setLoadingVisites(false);
    });

    return () => unsubVisites();
  }, []);

  // 2. Récupération unique (pas de temps réel nécessaire) des profils Nom/Prénom,
  // remplace les anciens getDoc individuels par bénéficiaire (N+1) par un seul
  // chargement de la collection, converti en table de correspondance en mémoire.
  useEffect(() => {
    getDocs(collection(db, "utilisateurs")).then((snap) => {
      const map: Record<string, { nom: string; prenom: string }> = {};
      snap.docs.forEach((userSnap) => {
        const uData = userSnap.data();
        map[userSnap.id] = {
          nom: uData.Nom || "Inconnu",
          prenom: uData.Prénom || "Inconnu",
        };
      });
      setUtilisateursMap(map);
      setLoadingUsers(false);
    }).catch((error) => {
      console.error("Erreur chargement des bénéficiaires :", error);
      setLoadingUsers(false);
    });
  }, []);

  // 3. Assembler les visites avec les infos bénéficiaire, triées par date décroissante
  const visites = useMemo<VisiteComplet[]>(() => {
    const listeComplete = visitesBrutes.map((v) => {
      const userInfo = utilisateursMap[v.userId] || { nom: "Inconnu", prenom: "" };
      return { ...v, nomBeneficiaire: userInfo.nom, prenomBeneficiaire: userInfo.prenom };
    });

    listeComplete.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return listeComplete;
  }, [visitesBrutes, utilisateursMap]);

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

  // Regroupement par lieu. Object.create(null) : clé indexée par un nom de
  // lieu en texte libre — sans prototype pour qu'une clé "__proto__" reste
  // une clé normale au lieu de polluer Object.prototype.
  const rdvsParLieu = visitesFiltrees.reduce<Record<string, VisiteComplet[]>>((acc, visite) => {
    const lieuCle = visite.lieu.trim() || "Non spécifié";
    if (!acc[lieuCle]) {
      acc[lieuCle] = [];
    }
    acc[lieuCle].push(visite);
    return acc;
  }, Object.create(null));

  // Extraction de la liste unique des lieux pour le sélecteur
  const tousLesLieux = Array.from(new Set(visites.map((v) => v.lieu.trim() || "Non spécifié"))).sort();

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement des rendez-vous par lieux...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center p-4 antialiased`}>
        <div className="bg-white border border-red-200 rounded-2xl p-6 max-w-md text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-red-600">Erreur de chargement</p>
          <p className="text-xs text-[#404040]/70 mt-2">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_rdv_par_lieu">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
      
      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        
        {/* EN-TÊTE & RETOUR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight flex items-center gap-2">
                <BuildingOffice2Icon className="w-7 h-7 text-[#EA601F] hidden sm:block" />
                <span>Rendez-vous <span className="text-[#EA601F] font-normal">Par Lieux</span></span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5">
                Vue synthétique de tous les entretiens individuels classés par emplacement géographique
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link 
              href="/" 
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>

            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-[#404040]/10 shadow-sm">
              <span className="text-xs font-bold text-[#404040]/70 uppercase tracking-wider">Total :</span>
              <span className="text-lg font-bold text-[#005259]">{visitesFiltrees.length}</span>
              <span className="text-xs text-[#404040]/70 font-medium">RDV(s)</span>
            </div>
          </div>
        </div>

        {/* BARRE DE FILTRES ET RECHERCHE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Recherche textuelle */}
          <div className="relative md:col-span-2 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="w-5 h-5 text-[#404040]/40 group-focus-within:text-[#005259] transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Rechercher un bénéficiaire, un détail, une thématique..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-full bg-white border border-[#404040]/15 rounded-2xl pl-11 pr-4 py-3 text-xs font-medium text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all shadow-sm"
            />
          </div>

          {/* Sélecteur de lieu */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <FunnelIcon className="w-4 h-4 text-[#404040]/40" />
            </div>
            <select
              value={lieuFiltre}
              onChange={(e) => setLieuFiltre(e.target.value)}
              className="w-full bg-white border border-[#404040]/15 rounded-2xl pl-10 pr-8 py-3 text-xs font-bold text-[#005259] focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all appearance-none cursor-pointer shadow-sm"
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
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-12 text-center text-[#404040]/60 text-xs font-bold uppercase tracking-wider shadow-sm">
            🔍 Aucun rendez-vous trouvé pour ces critères.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(rdvsParLieu).map(([lieu, listeRdv]) => (
              <section 
                key={lieu} 
                className="bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Entête du Lieu */}
                <div className="bg-[#F3F3F2] border-b border-[#404040]/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white border border-[#404040]/10 rounded-xl text-[#EA601F] shadow-sm">
                      <MapPinIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#005259] uppercase tracking-wide">
                        {lieu}
                      </h2>
                      <p className="text-[11px] text-[#404040]/70 font-medium">
                        {listeRdv.length} rendez-vous répertorié{listeRdv.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="self-start sm:self-auto px-3 py-1 rounded-xl text-[10px] font-bold bg-[#A9E0C9]/30 text-[#005259] border border-[#A9E0C9] uppercase tracking-wider">
                    {listeRdv.filter(r => r.statut === "Présent").length} Présent(s)
                  </span>
                </div>

                {/* Tableau des rendez-vous du lieu */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F3F3F2]/50 border-b border-[#404040]/10 text-[#005259] uppercase tracking-widest text-[10px] font-bold">
                        <th className="py-3 px-4">Date & Moment</th>
                        <th className="py-3 px-4">Bénéficiaire</th>
                        <th className="py-3 px-4">Axe / Médiateur</th>
                        <th className="py-3 px-4">Détails de l'entretien</th>
                        <th className="py-3 px-4 text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#404040]/5">
                      {listeRdv.map((rdv) => (
                        <tr key={rdv.id} className="hover:bg-[#F3F3F2]/60 transition-colors group">
                          {/* Date */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4 text-[#EA601F] shrink-0" />
                              <div>
                                <p className="font-bold text-[#404040] text-xs">
                                  {rdv.date ? new Date(rdv.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "—"}
                                </p>
                                {rdv.moment && (
                                  <p className="text-[10px] text-[#404040]/60 uppercase tracking-wider font-bold">{rdv.moment}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Nom / Prénom du Bénéficiaire */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {rdv.userId ? (
                              <Link 
                                href={`/mediation/rencontres-numeriques/liste-beneficiaires/${rdv.userId}`}
                                className="inline-flex items-center gap-2 text-[#005259] hover:text-[#EA601F] transition-colors"
                              >
                                <UserIcon className="w-4 h-4 text-[#005259]/60 group-hover:text-[#EA601F] transition-colors" />
                                <span className="font-bold uppercase text-xs tracking-tight group-hover:underline">
                                  <span className="text-[#404040]/60 normal-case font-normal mr-1">{rdv.prenomBeneficiaire}</span>
                                  {rdv.nomBeneficiaire}
                                </span>
                              </Link>
                            ) : (
                              <div className="inline-flex items-center gap-2 text-[#404040]">
                                <UserIcon className="w-4 h-4 text-[#404040]/40" />
                                <span className="font-bold uppercase text-xs tracking-tight">
                                  <span className="text-[#404040]/60 normal-case font-normal mr-1">{rdv.prenomBeneficiaire}</span>
                                  {rdv.nomBeneficiaire}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Axe / Médiateur */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              {rdv.thematique && (
                                <div className="flex flex-col gap-1">
                                  {rdv.thematique.split(",").map((axe) => axe.trim()).filter(Boolean).map((axe, index) => (
                                    <div key={index} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-[#005259]/10 text-[#005259] border border-[#005259]/20 uppercase tracking-wider w-fit whitespace-nowrap">
                                      <TagIcon className="w-3 h-3 text-[#EA601F] shrink-0" />
                                      <span>{axe}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {rdv.mediateur && (
                                <p className="text-[10px] text-[#404040]/70 italic">Par : {rdv.mediateur}</p>
                              )}
                              {!rdv.thematique && !rdv.mediateur && (
                                <span className="text-[#404040]/30 italic text-xs">—</span>
                              )}
                            </div>
                          </td>

                          {/* Détails de ce qui a été fait */}
                          <td className="py-3.5 px-4 min-w-[280px]">
                            <div className="flex items-start gap-2">
                              <DocumentTextIcon className="w-4 h-4 text-[#404040]/40 shrink-0 mt-0.5" />
                              <p className="text-[#404040] leading-relaxed text-xs whitespace-pre-wrap font-medium">
                                {rdv.statut === "Absent" ? (
                                  <span className="italic text-[#EF736A] font-medium">— Bénéficiaire absent —</span>
                                ) : (
                                  rdv.details || <span className="italic text-[#404040]/40">Aucun détail rédigé.</span>
                                )}
                              </p>
                            </div>
                          </td>

                          {/* Statut */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {rdv.statut === "Présent" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-[#A9E0C9]/30 text-[#005259] border border-[#A9E0C9]">
                                <CheckCircleIcon className="w-3.5 h-3.5 text-[#005259]" />
                                Présent
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-[#EF736A]/15 text-[#EF736A] border border-[#EF736A]/30">
                                <XCircleIcon className="w-3.5 h-3.5" />
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
    </PageGuard>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Quicksand } from "next/font/google";
import { PermissionGuard } from "@/components/PermissionGuard";
import PageGuard from "@/components/PageGuard";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { 
  MagnifyingGlassIcon, 
  UserPlusIcon, 
  HomeIcon, 
  ArrowTopRightOnSquareIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  MapPinIcon,
  NoSymbolIcon
} from "@heroicons/react/24/outline";

// Police Quicksand pour toute la page
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function ListeBeneficiaires() {
  const [beneficiaires, setBeneficiaires] = useState<any[]>([]);
  const [usagersDuJour, setUsagersDuJour] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtreActif, setFiltreActif] = useState<string>("Tous"); // Valeur par défaut : Tous
  const [lettreActive, setLettreActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const aujourdhuiStr = new Date().toLocaleDateString('en-CA');

      // 1. Planning du jour (Suresnes)
      try {
        const qPlanning = query(
          collection(db, "planning_suresnes"), 
          where("date", "==", aujourdhuiStr)
        );
        const planningSnapshot = await getDocs(qPlanning);
        
        const nomsDuJour = planningSnapshot.docs
          .map(doc => doc.data().usager)
          .filter(usager => usager && usager.trim() !== "")
          .map(usager => usager.trim().toLowerCase());
        
        setUsagersDuJour(nomsDuJour);
      } catch (errPlan) {
        console.warn("Agenda Suresnes non disponible :", errPlan);
      }

      // 2. Récupération des utilisateurs dans Firestore
      const querySnapshot = await getDocs(collection(db, "utilisateurs"));
      
      const docsAvecVisites = await Promise.all(
        querySnapshot.docs.map(async (docSnap) => {
          const userData = docSnap.data();
          let datePremierRDV = "—";
          let nbVisitesPresent = 0;

          // Extraction tolérante aux majuscules/accents
          const nom = userData.Nom || userData.nom || "";
          const prenom = userData.Prénom || userData.prénom || userData.Prenom || userData.prenom || "";

          // Récupération sécurisée des visites
          try {
            const visitesSnapshot = await getDocs(collection(db, "utilisateurs", docSnap.id, "visites"));
            
            if (!visitesSnapshot.empty) {
              const docsVisites = visitesSnapshot.docs.map(d => d.data());
              
              nbVisitesPresent = docsVisites.filter(data => {
                return data.statut !== "Absent" && data.statut !== "Annulé" && data.presence !== "Absent" && data.presence !== false;
              }).length;

              const dates = docsVisites.map(d => d.date).filter(Boolean).sort();
              if (dates.length > 0) {
                datePremierRDV = new Date(dates[0]).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
              }
            }
          } catch (err) {
            // Ne bloque pas si la sous-collection visites échoue
          }

          return {
            id: docSnap.id,
            ...userData,
            nomAffiche: nom,
            prenomAffiche: prenom,
            premierRDV: datePremierRDV,
            totalVisites: nbVisitesPresent
          };
        })
      );

      // Tri alphabétique local en JavaScript
      docsAvecVisites.sort((a, b) => 
        (a.nomAffiche || "").localeCompare(b.nomAffiche || "", 'fr', { sensitivity: 'base' })
      );

      setBeneficiaires(docsAvecVisites);

    } catch (error) {
      console.error("Erreur lors de la récupération des données:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleBlacklist = async (id: string, statutActuel: string) => {
    const nouveauStatut = statutActuel === "Oui" ? "Non" : "Oui";
    const message = nouveauStatut === "Oui" 
      ? "Êtes-vous sûr de vouloir blacklister ce bénéficiaire ?" 
      : "Réactiver ce bénéficiaire ?";
      
    if (window.confirm(message)) {
      try {
        const userRef = doc(db, "utilisateurs", id);
        await updateDoc(userRef, {
          Statut_Blacklist: nouveauStatut
        });
        
        setBeneficiaires(prev => prev.map(b => b.id === id ? { ...b, Statut_Blacklist: nouveauStatut } : b));
      } catch (error) {
        console.error("Erreur lors de la modification de la blacklist :", error);
        alert("Une erreur est survenue.");
      }
    }
  };

  const handleCreerNouveau = () => {
    const nouvelId = "user_" + Math.random().toString(36).substring(2, 11);
    router.push(`/mediation/rencontres-numeriques/liste-beneficiaires/${nouvelId}`);
  };

  // Filtrage robuste
  function GridFilter(liste: any[]) {
    return liste.filter((b) => {
      const nomComplet = `${b.prenomAffiche} ${b.nomAffiche}`.toLowerCase().trim();
      const matchesSearch = nomComplet.includes(searchTerm.toLowerCase());

      let matchesBadge = true;
      const situation = (b.Situation_Socio_Pro || b.Situation || "").toLowerCase();
      const statut = (b.Statut || "").toLowerCase();

      if (filtreActif === "Aujourd'hui") {
        matchesBadge = usagersDuJour.some(u => nomComplet.includes(u) || u.includes(nomComplet));
      } else if (filtreActif === "Suresnes") {
        matchesBadge = b.Ville?.toLowerCase() === "suresnes";
      } else if (filtreActif === "DE") {
        matchesBadge = situation.includes("emploi") || situation === "de";
      } else if (filtreActif === "Blacklistes") {
        matchesBadge = b.Statut_Blacklist === "Oui";
      } else if (filtreActif === "Actifs") {
        matchesBadge = (statut === "actif" || b.Statut === undefined) && b.Statut_Blacklist !== "Oui"; 
      }

      let matchesLettre = true;
      if (lettreActive) {
        const premiereLettre = b.nomAffiche ? b.nomAffiche.trim().charAt(0).toUpperCase() : "";
        matchesLettre = premiereLettre === lettreActive;
      }

      return matchesSearch && matchesBadge && matchesLettre;
    });
  }

  // Mémoïsé : évite de rebalayer toute la liste à chaque rendu (frappe dans
  // la recherche, changement de filtre/lettre...).
  const filteredBeneficiaires = useMemo(
    () => GridFilter(beneficiaires),
    [beneficiaires, searchTerm, filtreActif, lettreActive, usagersDuJour]
  );

  const { countAujourdhui, countSuresnes, countDE, countBlacklistes } = useMemo(() => {
    const countAujourdhui = beneficiaires.filter(b => {
      const nomComplet = `${b.prenomAffiche} ${b.nomAffiche}`.toLowerCase().trim();
      return usagersDuJour.some(u => nomComplet.includes(u) || u.includes(nomComplet));
    }).length;

    const countSuresnes = beneficiaires.filter(b => b.Ville?.toLowerCase() === "suresnes").length;
    const countDE = beneficiaires.filter(b => {
      const sit = (b.Situation_Socio_Pro || b.Situation || "").toLowerCase();
      return sit.includes("emploi") || sit === "de";
    }).length;
    const countBlacklistes = beneficiaires.filter(b => b.Statut_Blacklist === "Oui").length;

    return { countAujourdhui, countSuresnes, countDE, countBlacklistes };
  }, [beneficiaires, usagersDuJour]);

  // Table de correspondance "lettre -> a des bénéficiaires ?" calculée une
  // fois par changement de liste, au lieu de 26 balayages complets par rendu.
  const lettresAvecBeneficiaires = useMemo(() => {
    return new Set(
      beneficiaires
        .map(b => b.nomAffiche?.[0]?.toUpperCase())
        .filter(Boolean)
    );
  }, [beneficiaires]);

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement de la base de données...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_liste_beneficiaires">
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
                Bénéficiaires <span className="text-[#EA601F] font-normal">et suivi</span>
              </h1>
              <p className="text-xs text-[#404040]/70 mt-0.5">
                Gestion et suivi des accompagnements Colombbus
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Link 
              href="/mediation/rencontres-numeriques/suresnes"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Agenda Suresnes</span>
            </Link>

            <Link 
              href="/mediation/localisations" 
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <MapPinIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Ajouter un lieu</span>
            </Link>

            <Link 
              href="/" 
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>

            {/* BOUTON CRÉER BÉNÉFICIAIRE (PROTÉGÉ) */}
            <PermissionGuard actionId="benef_create_new">
              <button 
                onClick={handleCreerNouveau} 
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md active:scale-95 group"
              >
                <UserPlusIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>Nouveau</span>
              </button>
            </PermissionGuard>
          </div>
        </div>

        {/* BARRE DE RECHERCHE */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-[#404040]/40 group-focus-within:text-[#005259] transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Rechercher un bénéficiaire par son nom ou son prénom..."
            className="w-full bg-white border border-[#404040]/15 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all shadow-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* BARRE DE FILTRAGE PAR LETTRE (ALPHABET) */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl p-3 flex flex-wrap gap-1 justify-between items-center shadow-sm">
          <button
            onClick={() => setLettreActive(null)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              lettreActive === null
                ? "bg-[#005259] text-white shadow-sm"
                : "text-[#404040]/70 hover:text-[#005259] hover:bg-[#F3F3F2]"
            }`}
          >
            Tous (A-Z)
          </button>
          <div className="flex flex-wrap gap-0.5 justify-center flex-1 mx-2">
            {alphabet.map((lettre) => {
              const aDesBeneficiaires = lettresAvecBeneficiaires.has(lettre);

              return (
                <button
                  key={lettre}
                  onClick={() => setLettreActive(lettre === lettreActive ? null : lettre)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    lettreActive === lettre
                      ? "bg-[#005259] text-white shadow-sm"
                      : aDesBeneficiaires
                      ? "text-[#005259] bg-[#F3F3F2] hover:bg-[#005259]/10 border border-[#005259]/10"
                      : "text-[#404040]/30 hover:text-[#404040]/60 hover:bg-[#F3F3F2]/50 opacity-50"
                  }`}
                >
                  {lettre}
                </button>
              );
            })}
          </div>
        </div>

        {/* FILTRES RAPIDES */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-[10px] font-bold text-[#404040]/60 uppercase tracking-widest mr-1">
            Filtrer par :
          </span>

          <button
            onClick={() => setFiltreActif("Tous")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "Tous"
                ? "bg-[#005259] text-white shadow-sm"
                : "bg-white text-[#404040] border border-[#404040]/10 hover:border-[#005259] hover:text-[#005259]"
            }`}
          >
            Tous ({beneficiaires.length})
          </button>

          <button
            onClick={() => setFiltreActif("Aujourd'hui")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "Aujourd'hui"
                ? "bg-[#005259] text-white shadow-sm"
                : "bg-white text-[#404040] border border-[#404040]/10 hover:border-[#005259] hover:text-[#005259]"
            }`}
          >
            📅 Aujourd'hui ({countAujourdhui})
          </button>

          <button
            onClick={() => setFiltreActif("Suresnes")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "Suresnes"
                ? "bg-[#005259] text-white shadow-sm"
                : "bg-white text-[#404040] border border-[#404040]/10 hover:border-[#005259] hover:text-[#005259]"
            }`}
          >
            📍 Suresnes ({countSuresnes})
          </button>

          <button
            onClick={() => setFiltreActif("DE")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "DE"
                ? "bg-[#005259] text-white shadow-sm"
                : "bg-white text-[#404040] border border-[#404040]/10 hover:border-[#005259] hover:text-[#005259]"
            }`}
          >
            💼 Public France Travail ({countDE})
          </button>

          <button
            onClick={() => setFiltreActif("Blacklistes")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "Blacklistes"
                ? "bg-[#EF736A] text-white shadow-sm"
                : "bg-white text-[#EF736A] border border-[#EF736A]/30 hover:bg-[#EF736A]/10"
            }`}
          >
            🚫 Blacklistés ({countBlacklistes})
          </button>
        </div>

        {/* TABLEAU DES RÉSULTATS */}
        <div className="bg-white border border-[#404040]/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Identité</th>
                  <th className="px-6 py-4 hidden md:table-cell">Contact / Coordonnées</th>
                  <th className="px-6 py-4 hidden lg:table-cell">Localisation</th>
                  <th className="px-6 py-4 text-center hidden sm:table-cell">Visites</th>
                  <th className="px-6 py-4 hidden sm:table-cell">1er RDV</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#404040]/5">
                {filteredBeneficiaires.length > 0 ? (
                  filteredBeneficiaires.map((b) => {
                    const estAdherent = b.Date_Adhesion && b.Date_Adhesion.trim() !== "";
                    const isBlackliste = b.Statut_Blacklist === "Oui";
                    const civilite = b.Civilité ? `${b.Civilité} ` : "";

                    return (
                      <tr key={b.id} className={`hover:bg-[#F3F3F2]/60 transition-colors group ${isBlackliste ? "bg-[#EF736A]/10" : ""}`}>
                        <td className="px-6 py-4">
                          <div className={`font-bold text-base tracking-tight uppercase transition-colors ${isBlackliste ? "text-[#EF736A] line-through" : "text-[#005259] group-hover:text-[#EA601F]"}`}>
                            <span className="text-[#404040]/60 font-normal normal-case text-xs mr-1">{civilite}</span>
                            {b.nomAffiche || "SANS NOM"}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-[#404040] font-medium">
                              {b.prenomAffiche || "Sans prénom"}
                            </span>
                            {isBlackliste ? (
                              <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-[#EF736A] bg-[#EF736A]/15 px-2 py-0.5 rounded border border-[#EF736A]/30">
                                🚫 Blacklisté
                              </span>
                            ) : estAdherent ? (
                              <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-[#005259] bg-[#A9E0C9]/30 px-2 py-0.5 rounded border border-[#A9E0C9]">
                                ✅ Adhérent
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-[#EA601F] bg-[#F9945D]/15 px-2 py-0.5 rounded border border-[#F9945D]/30">
                                ⚠️ Non adhérent
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 hidden md:table-cell">
                          <div className="text-xs font-medium text-[#404040]">
                            {formatPhoneNumber(b.Téléphone || b.telephone)}
                          </div>
                          <div className="text-xs text-[#404040]/60 truncate max-w-[220px] mt-0.5">
                            {b.email || b.Email || "—"}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-[#404040] uppercase tracking-wide">
                              {b.Ville || "—"}
                            </span>
                            <span className="text-[10px] text-[#404040]/60 mt-0.5">
                              {b.Code_Postal || "—"}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-center hidden sm:table-cell">
                          <span className={`inline-flex items-center justify-center text-xs font-bold px-2.5 py-1 rounded-xl border ${
                            b.totalVisites > 0 
                              ? "bg-[#005259]/10 text-[#005259] border-[#005259]/20" 
                              : "bg-[#F3F3F2] text-[#404040]/40 border-[#404040]/10"
                          }`}>
                            {b.totalVisites}
                          </span>
                        </td>

                        <td className="px-6 py-4 hidden sm:table-cell">
                          <div className="text-xs font-medium text-[#404040]/80">
                            {b.premierRDV}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <PermissionGuard actionId="benef_action_toggle_blacklist">
                              <button
                                onClick={() => handleToggleBlacklist(b.id, b.Statut_Blacklist)}
                                title={isBlackliste ? "Retirer de la blacklist" : "Ajouter à la blacklist"}
                                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                                  isBlackliste 
                                    ? "bg-[#EF736A]/20 text-[#EF736A] border-[#EF736A]/40 hover:bg-[#EF736A] hover:text-white" 
                                    : "bg-[#F3F3F2] text-[#404040]/50 border-[#404040]/10 hover:text-[#EF736A] hover:border-[#EF736A]/40"
                                }`}
                              >
                                <NoSymbolIcon className="w-4 h-4" />
                              </button>
                            </PermissionGuard>

                            <Link
                              href={`/mediation/rencontres-numeriques/liste-beneficiaires/${b.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#005259] hover:bg-[#EA601F] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                            >
                              <span>Ouvrir</span>
                              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60">
                      🔍 Aucun résultat pour ce filtre ou cette recherche.
                      <div className="mt-3">
                        <button 
                          onClick={() => { setSearchTerm(""); setFiltreActif("Tous"); setLettreActive(null); }}
                          className="text-[#005259] hover:underline cursor-pointer font-bold"
                        >
                          Réinitialiser la vue
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* FOOTER STATS */}
        <div className="flex flex-col sm:flex-row justify-between items-center px-2 gap-2 text-xs">
          <p className="text-[#404040]/80 font-medium">
            Affichage de <span className="text-[#005259] font-bold">{filteredBeneficiaires.length}</span> bénéficiaire(s)
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
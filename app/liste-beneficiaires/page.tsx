"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, query, orderBy, where, updateDoc, doc } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  MagnifyingGlassIcon, 
  UserPlusIcon, 
  HomeIcon, 
  ArrowTopRightOnSquareIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  NoSymbolIcon // Import de l'icône de blacklist
} from "@heroicons/react/24/outline";

export default function ListeBeneficiaires() {
  const [beneficiaires, setBeneficiaires] = useState<any[]>([]);
  const [usagersDuJour, setUsagersDuJour] = useState<string[]>([]); // Stocke les noms des usagers programmés aujourd'hui
  const [searchTerm, setSearchTerm] = useState("");
  const [filtreActif, setFiltreActif] = useState<string>("Aujourd'hui"); // Activé par défaut
  const [lettreActive, setLettreActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const fetchData = async () => {
    try {
      // 1. Récupération de la date du jour au format exact du planning (YYYY-MM-DD)
      const aujourdhuiStr = new Date().toLocaleDateString('en-CA');

      // 2. Récupération des créneaux de Suresnes pour aujourd'hui
      const qPlanning = query(
        collection(db, "planning_suresnes"), 
        where("date", "==", aujourdhuiStr)
      );
      const planningSnapshot = await getDocs(qPlanning);
      
      const nomsDuJour = planningSnapshot.docs
        .map(doc => doc.data().usager)
        .filter(usager => usager && usager.trim() !== "") // Filtre les créneaux vides
        .map(usager => usager.trim().toLowerCase());
      
      setUsagersDuJour(nomsDuJour);

      // 3. Si aucun usager n'est prévu aujourd'hui, on bascule par défaut sur "Tous"
      if (nomsDuJour.length === 0 && filtreActif === "Aujourd'hui") {
        setFiltreActif("Tous");
      }

      // 4. Récupération globale de tous les bénéficiaires
      const qBenef = query(collection(db, "utilisateurs"), orderBy("Nom", "asc"));
      const querySnapshot = await getDocs(qBenef);
      
      // 5. Pour chaque bénéficiaire, on va chercher ses rendez-vous (visites)
      const docsAvecVisitesEtPremierRDV = await Promise.all(
        querySnapshot.docs.map(async (docSnap) => {
          const userData = docSnap.data();
          let datePremierRDV = "—";
          let nbVisitesPresent = 0;

          try {
            // Requête globale sur la sous-collection "visites" pour calculer le total et le premier rdv
            const qVisites = query(
              collection(db, "utilisateurs", docSnap.id, "visites"),
              orderBy("date", "asc")
            );
            const visitesSnapshot = await getDocs(qVisites);
            
            if (!visitesSnapshot.empty) {
              nbVisitesPresent = visitesSnapshot.docs.filter(doc => {
                const data = doc.data();
                return data.statut !== "Absent" && data.statut !== "Annulé" && data.presence !== "Absent" && data.presence !== false;
              }).length;

              const rdvDateRaw = visitesSnapshot.docs[0].data().date;
              if (rdvDateRaw) {
                datePremierRDV = new Date(rdvDateRaw).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
              }
            }
          } catch (err) {
            console.error(`Erreur récupération visites pour ${docSnap.id}:`, err);
          }

          return {
            id: docSnap.id,
            ...userData,
            premierRDV: datePremierRDV,
            totalVisites: nbVisitesPresent
          };
        })
      );

      setBeneficiaires(docsAvecVisitesEtPremierRDV);

    } catch (error) {
      console.error("Erreur lors de la récupération des données:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- FONCTION DE TOGGLE BLACKLIST DIRECTE ---
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
        
        // Mettre à jour l'état local sans recharger toute la page
        setBeneficiaires(prev => prev.map(b => b.id === id ? { ...b, Statut_Blacklist: nouveauStatut } : b));
      } catch (error) {
        console.error("Erreur lors de la modification de la blacklist :", error);
        alert("Une erreur est survenue.");
      }
    }
  };

  // --- REDIRECTION VERS LA PAGE DÉTAIL POUR CRÉATION VIA UN ID TEMPORAIRE ---
  const handleCreerNouveau = () => {
    const nouvelId = "user_" + Math.random().toString(36).substring(2, 11);
    router.push(`/liste-beneficiaires/${nouvelId}`);
  };

  // FILTRAGE, RECHERCHE ET ALPHABET SYNCHRONISÉS
  const filteredBeneficiaires = GridFilter(beneficiaires);

  function GridFilter(liste: any[]) {
    return liste.filter((b) => {
      // 1. Filtre par texte (Nom / Prénom)
      const nomComplet = `${b.Prénom || ""} ${b.Nom || ""}`.toLowerCase().trim();
      const matchesSearch = nomComplet.includes(searchTerm.toLowerCase());

      // 2. Filtre par bouton badge
      let matchesBadge = true;
      const situation = (b.Situation_Socio_Pro || b.Situation || "").toLowerCase();
      const statut = (b.Statut || "").toLowerCase();

      if (filtreActif === "Aujourd'hui") {
        matchesBadge = usagersDuJour.includes(nomComplet);
      } else if (filtreActif === "Suresnes") {
        matchesBadge = b.Ville?.toLowerCase() === "suresnes";
      } else if (filtreActif === "DE") {
        matchesBadge = situation.includes("emploi") || situation === "de";
      } else if (filtreActif === "Blacklistes") {
        matchesBadge = b.Statut_Blacklist === "Oui";
      } else if (filtreActif === "Actifs") {
        matchesBadge = (statut === "actif" || b.Statut === undefined) && b.Statut_Blacklist !== "Oui"; 
      }

      // 3. Filtre par première lettre du Nom
      let matchesLettre = true;
      if (lettreActive) {
        const premiereLettre = b.Nom ? b.Nom.trim().charAt(0).toUpperCase() : "";
        matchesLettre = premiereLettre === lettreActive;
      }

      return matchesSearch && matchesBadge && matchesLettre;
    });
  }

  // COMPTEURS POUR LES BADGES
  const countAujourdhui = beneficiaires.filter(b => {
    const nomComplet = `${b.Prénom || ""} ${b.Nom || ""}`.toLowerCase().trim();
    return usagersDuJour.includes(nomComplet);
  }).length;
  
  const countSuresnes = beneficiaires.filter(b => b.Ville?.toLowerCase() === "suresnes").length;
  const countDE = beneficiaires.filter(b => {
    const sit = (b.Situation_Socio_Pro || b.Situation || "").toLowerCase();
    return sit.includes("emploi") || sit === "de";
  }).length;
  const countBlacklistes = beneficiaires.filter(b => b.Statut_Blacklist === "Oui").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold animate-pulse tracking-widest text-xs uppercase">
        Chargement de la base de données...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-6xl mx-auto">
        
        {/* EN-TÊTE & NAVIGATION */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-1.5 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight uppercase italic flex items-center gap-2">
                Bénéficiaires
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">
                Gestion et suivi des accompagnements Colombbus
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Link href="/suresnes" className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl hover:bg-slate-800 hover:text-white transition-all text-slate-400 hover:border-emerald-500/30 text-xs font-bold uppercase tracking-wider shadow-md">
              <CalendarDaysIcon className="w-4 h-4 text-emerald-500" />
              <span>Agenda Suresnes</span>
            </Link>

            <Link href="/" className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl hover:bg-slate-800 hover:text-white transition-all text-slate-400 text-xs font-bold uppercase tracking-wider shadow-md">
              <HomeIcon className="w-4 h-4" />
              <span>Accueil</span>
            </Link>

            <button 
              onClick={handleCreerNouveau} 
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg text-xs font-black uppercase tracking-widest active:scale-95 cursor-pointer group"
            >
              <UserPlusIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
              <span>Nouveau</span>
            </button>
          </div>
        </div>

        {/* BARRE DE RECHERCHE */}
        <div className="relative mb-5 group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Rechercher un bénéficiaire par son nom ou son prénom..."
            className="block w-full pl-12 pr-4 py-4 bg-slate-900 border border-slate-800 rounded-2xl leading-5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-base shadow-2xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* BARRE DE FILTRAGE PAR LETTRE (ALPHABET) */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-3 mb-4 flex flex-wrap gap-1 justify-between items-center shadow-inner">
          <button
            onClick={() => setLettreActive(null)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              lettreActive === null
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            Tous (A-Z)
          </button>
          <div className="flex flex-wrap gap-0.5 justify-center flex-1 mx-2">
            {alphabet.map((lettre) => {
              const aDesBeneficiaires = GridFilter(beneficiaires).some(b => b.Nom?.[0]?.toUpperCase() === lettre);

              return (
                <button
                  key={lettre}
                  onClick={() => setLettreActive(lettre === lettreActive ? null : lettre)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    lettreActive === lettre
                      ? "bg-emerald-500 text-slate-950 font-black shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                      : aDesBeneficiaires
                      ? "text-slate-200 hover:bg-slate-800 border border-slate-800"
                      : "text-slate-600 hover:text-slate-400 hover:bg-slate-900/20 opacity-40"
                  }`}
                >
                  {lettre}
                </button>
              );
            })}
          </div>
        </div>

        {/* FILTRES RAPIDES */}
        <div className="flex flex-wrap items-center gap-2 mb-6 px-1">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">
            Filtrer par :
          </span>

          <button
            onClick={() => setFiltreActif("Aujourd'hui")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "Aujourd'hui"
                ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            📅 Aujourd'hui ({countAujourdhui})
          </button>

          <button
            onClick={() => setFiltreActif("Tous")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "Tous"
                ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            Tous ({beneficiaires.length})
          </button>

          <button
            onClick={() => setFiltreActif("Suresnes")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "Suresnes"
                ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            📍 Suresnes ({countSuresnes})
          </button>

          <button
            onClick={() => setFiltreActif("DE")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "DE"
                ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            💼 Public France Travail ({countDE})
          </button>

          {/* NOUEAU FILTRE RAPIDE BLACKLIST */}
          <button
            onClick={() => setFiltreActif("Blacklistes")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filtreActif === "Blacklistes"
                ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.25)]"
                : "bg-slate-900 text-red-400/80 border border-slate-800 hover:border-red-900/50 hover:text-red-400"
            }`}
          >
            🚫 Blacklistés ({countBlacklistes})
          </button>
        </div>

        {/* TABLEAU DES RÉSULTATS */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-widest font-black">
                  <th className="px-6 py-4">Identité</th>
                  <th className="px-6 py-4 hidden md:table-cell">Contact / Coordonnées</th>
                  <th className="px-6 py-4 hidden lg:table-cell">Localisation</th>
                  <th className="px-6 py-4 text-center hidden sm:table-cell">Visites</th>
                  <th className="px-6 py-4 hidden sm:table-cell">1er RDV</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBeneficiaires.length > 0 ? (
                  filteredBeneficiaires.map((b) => {
                    const estAdherent = b.Date_Adhesion && b.Date_Adhesion.trim() !== "";
                    const isBlackliste = b.Statut_Blacklist === "Oui";
                    const civilite = b.Civilité ? `${b.Civilité} ` : "";

                    return (
                      <tr key={b.id} className={`hover:bg-slate-950/40 transition-colors group ${isBlackliste ? "bg-red-950/5/30" : ""}`}>
                        <td className="px-6 py-4.5">
                          <div className={`font-black text-base tracking-tight uppercase italic transition-colors ${isBlackliste ? "text-red-400/80 line-through decoration-1" : "text-white group-hover:text-emerald-400"}`}>
                            <span className="text-slate-400 font-medium normal-case not-italic text-sm mr-1">{civilite}</span>
                            {b.Nom || "SANS NOM"}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400 font-medium not-italic">
                              {b.Prénom || "Sans prénom"}
                            </span>
                            {isBlackliste ? (
                              <span className="inline-flex items-center text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded border border-red-900/40">
                                🚫 Blacklisté
                              </span>
                            ) : estAdherent ? (
                              <span className="inline-flex items-center text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-900/30">
                                ✅ Adhérent
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[9px] font-black uppercase tracking-widest text-amber-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/60">
                                ⚠️ Non adhérent
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4.5 hidden md:table-cell">
                          <div className="text-xs font-mono font-bold text-slate-300">
                            {b.Téléphone || "—"}
                          </div>
                          <div className="text-xs text-slate-500 truncate max-w-[220px] mt-0.5">
                            {b.email || "—"}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4.5 hidden lg:table-cell">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                              {b.Ville || "—"}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                              {b.Code_Postal || "—"}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4.5 text-center hidden sm:table-cell">
                          <span className={`inline-flex items-center justify-center font-mono text-xs font-black px-2.5 py-1 rounded-xl border ${
                            b.totalVisites > 0 
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/40" 
                              : "bg-slate-950 text-slate-600 border-slate-850"
                          }`}>
                            {b.totalVisites}
                          </span>
                        </td>

                        <td className="px-6 py-4.5 hidden sm:table-cell">
                          <div className="text-xs font-mono font-bold text-slate-300">
                            {b.premierRDV}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4.5 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {/* BOUTON TOGGLE BLACKLIST DIRECT */}
                            <button
                              onClick={() => handleToggleBlacklist(b.id, b.Statut_Blacklist)}
                              title={isBlackliste ? "Retirer de la blacklist" : "Ajouter à la blacklist"}
                              className={`p-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                                isBlackliste 
                                  ? "bg-red-950/60 text-red-400 border-red-900 hover:bg-slate-950 hover:text-slate-400 hover:border-slate-800" 
                                  : "bg-slate-950 text-slate-500 border-slate-800 hover:border-red-900/60 hover:text-red-400"
                              }`}
                            >
                              <NoSymbolIcon className="w-4 h-4" />
                            </button>

                            <Link
                              href={`/liste-beneficiaires/${b.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-emerald-600 text-slate-400 hover:text-white text-[11px] font-black uppercase tracking-wider rounded-xl border border-slate-800 hover:border-emerald-500 transition-all active:scale-95 shadow-sm cursor-pointer"
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
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="text-slate-600 text-base font-medium">
                        🔍 Aucun résultat pour ce filtre ou cette recherche.
                      </div>
                      <button 
                        onClick={() => { setSearchTerm(""); setFiltreActif("Tous"); setLettreActive(null); }}
                        className="mt-3 text-xs text-emerald-500 hover:text-emerald-400 font-black uppercase tracking-widest hover:underline cursor-pointer"
                      >
                        Réinitialiser la vue
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* FOOTER STATS COMPACT */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center px-2 gap-2">
          <p className="text-xs text-slate-500 font-medium">
            Affichage de <span className="text-slate-300 font-mono font-bold">{filteredBeneficiaires.length}</span> bénéficiaire(s)
          </p>
          <div className="flex items-center gap-1.5 text-[9px] text-slate-600 uppercase tracking-widest font-black">
            <UserGroupIcon className="w-3.5 h-3.5 text-slate-700" />
            <span>Base Centrale Colombbus</span>
          </div>
        </div>

      </div>
    </main>
  );
}
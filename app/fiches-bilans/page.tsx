"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { 
  collectionGroup, 
  onSnapshot, 
  getDoc, 
  doc, 
  setDoc 
} from "firebase/firestore";
import Link from "next/link";
import { 
  ChevronLeftIcon, 
  MapPinIcon, 
  CalendarIcon, 
  BookmarkSquareIcon,
  DocumentTextIcon,
  FunnelIcon,
  PrinterIcon
} from "@heroicons/react/24/outline";

// --- TYPES ---
interface RDVItem {
  id: string;
  date: string;
  details: string;
  statut: string;
  mediateur: string;
}

interface FicheBilanData {
  lieu: string;
  mois: string; // Ex: "2026-01"
  atelier: string;
  commentaireGeneral: string;
  savedAt?: string;
}

export default function FichesBilansPage() {
  const [loading, setLoading] = useState(true);
  
  // Mois sélectionné (par défaut mois en cours : YYYY-MM)
  const [moisSelectionne, setMoisSelectionne] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${mm}`;
  });

  const [lieuSelectionne, setLieuSelectionne] = useState<string>("Tous");

  // Données brutes des RDV
  const [tousLesRdvs, setTousLesRdvs] = useState<{ lieu: string; rdv: RDVItem }[]>([]);
  
  // Métadonnées éditables par lieu : { [lieu]: FicheBilanData }
  const [fichesEditees, setFichesEditees] = useState<Record<string, FicheBilanData>>({});
  const [statusSauvegarde, setStatusSauvegarde] = useState<Record<string, string>>({});

  // 1. Écoute de tous les rendez-vous
  useEffect(() => {
    const unsubVisites = onSnapshot(collectionGroup(db, "visites"), (snapshot) => {
      const items: { lieu: string; rdv: RDVItem }[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        return {
          lieu: (data.lieu || "Non spécifié").trim(),
          rdv: {
            id: docSnap.id,
            date: data.date || "",
            details: data.details || "",
            statut: data.statut || "Présent",
            mediateur: data.mediateur || "—"
          }
        };
      });

      setTousLesRdvs(items);
      setLoading(false);
    });

    return () => unsubVisites();
  }, []);

  // 2. Filtrage des RDV par mois
  const rdvsDuMois = tousLesRdvs.filter((item) => {
    if (!item.rdv.date) return false;
    return item.rdv.date.startsWith(moisSelectionne) && item.rdv.statut === "Présent";
  });

  // Regroupement par lieu
  const lieuxPresents = Array.from(new Set(rdvsDuMois.map((i) => i.lieu))).sort();

  // 3. Charger les fiches bilans sauvegardées dans Firestore
  useEffect(() => {
    if (lieuxPresents.length === 0) return;

    lieuxPresents.forEach(async (lieu) => {
      const docId = `${lieu.replace(/[/\\?%*:|"<>]/g, "_")}_${moisSelectionne}`;
      try {
        const docRef = doc(db, "fiches_bilans", docId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const savedData = snap.data() as FicheBilanData;
          setFichesEditees(prev => ({ ...prev, [lieu]: savedData }));
        } else {
          // Valeurs par défaut si pas encore sauvegardé
          setFichesEditees(prev => ({
            ...prev,
            [lieu]: prev[lieu] || {
              lieu,
              mois: moisSelectionne,
              atelier: "Permanence Numérique",
              commentaireGeneral: ""
            }
          }));
        }
      } catch (err) {
        console.error("Erreur chargement fiche :", err);
      }
    });
  }, [moisSelectionne, lieuxPresents.join(",")]);

  // Handler de modification des champs de fiche
  const handleFieldChange = (lieu: string, field: keyof FicheBilanData, value: string) => {
    setFichesEditees(prev => ({
      ...prev,
      [lieu]: {
        ...(prev[lieu] || {
          lieu,
          mois: moisSelectionne,
          atelier: "Permanence Numérique",
          commentaireGeneral: ""
        }),
        [field]: value
      }
    }));
  };

  // Sauvegarde dans Firestore
  const handleSaveFiche = async (lieu: string) => {
    const docId = `${lieu.replace(/[/\\?%*:|"<>]/g, "_")}_${moisSelectionne}`;
    const dataToSave: FicheBilanData = {
      ...(fichesEditees[lieu] || {
        lieu,
        mois: moisSelectionne,
        atelier: "Permanence Numérique",
        commentaireGeneral: ""
      }),
      lieu,
      mois: moisSelectionne,
      savedAt: new Date().toISOString()
    };

    setStatusSauvegarde(prev => ({ ...prev, [lieu]: "Enregistrement..." }));

    try {
      await setDoc(doc(db, "fiches_bilans", docId), dataToSave, { merge: true });
      setStatusSauvegarde(prev => ({ ...prev, [lieu]: "✅ Sauvegardé !" }));
      setTimeout(() => {
        setStatusSauvegarde(prev => ({ ...prev, [lieu]: "" }));
      }, 2500);
    } catch (e) {
      console.error(e);
      setStatusSauvegarde(prev => ({ ...prev, [lieu]: "❌ Erreur" }));
    }
  };

  // Fonction pour lancer l'impression
  const handlePrint = () => {
    window.print();
  };

  // Formater la date en DD/MM (ex: 26/01)
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  // Lieux filtrés selon le sélecteur
  const lieuxAffiches = lieuSelectionne === "Tous" 
    ? lieuxPresents 
    : lieuxPresents.filter(l => l === lieuSelectionne);

  const inputStyle = "w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 outline-none transition-all";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold animate-pulse">
        Chargement des fiches bilans...
      </div>
    );
  }

  return (
    <>
      {/* Styles CSS pour l'impression / export PDF */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body, main {
            background-color: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .fiche-bilan-card {
            background-color: white !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            color: black !important;
            page-break-after: always;
            padding: 1.5rem !important;
            margin-bottom: 2rem !important;
          }

          .fiche-bilan-card input, 
          .fiche-bilan-card textarea {
            background-color: transparent !important;
            border: none !important;
            border-bottom: 1px solid #94a3b8 !important;
            color: black !important;
            padding: 2px 0 !important;
            font-weight: 600 !important;
          }

          .fiche-bilan-card .bg-slate-950\/60 {
            background-color: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
          }

          .fiche-bilan-card table {
            border: 1px solid #000 !important;
          }

          .fiche-bilan-card th {
            background-color: #f1f5f9 !important;
            color: black !important;
            border-bottom: 1px solid #000 !important;
            border-right: 1px solid #000 !important;
          }

          .fiche-bilan-card td {
            color: black !important;
            border-bottom: 1px solid #e2e8f0 !important;
            border-right: 1px solid #cbd5e1 !important;
          }

          .fiche-bilan-card td span {
            color: black !important;
          }
        }
      `}</style>

      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* NAV & ENTÊTE (no-print) */}
          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <Link 
                href="/liste-beneficiaires" 
                className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors group text-xs font-bold uppercase tracking-widest mb-2"
              >
                <ChevronLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>Retour au tableau de bord</span>
              </Link>
              <h1 className="text-3xl font-black tracking-tight text-white uppercase italic flex items-center gap-3">
                <DocumentTextIcon className="w-8 h-8 text-emerald-500 not-italic" />
                <span>Fiches <span className="text-emerald-500 not-italic">Bilans Mensuelles</span></span>
              </h1>
            </div>

            {/* Bouton d'impression globale */}
            {lieuxAffiches.length > 0 && (
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg self-start sm:self-auto"
              >
                <PrinterIcon className="w-4 h-4 stroke-[2.5]" />
                <span>Imprimer / PDF</span>
              </button>
            )}
          </div>

          {/* BARRE DE FILTRAGE PAR MOIS & LIEU (no-print) */}
          <section className="no-print grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
            {/* Sélection du mois */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-emerald-400" />
                <span>Mois d'intervention</span>
              </label>
              <input 
                type="month" 
                value={moisSelectionne}
                onChange={(e) => setMoisSelectionne(e.target.value)}
                className={inputStyle}
              />
            </div>

            {/* Sélection du lieu */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FunnelIcon className="w-4 h-4 text-emerald-400" />
                <span>Filtrer par Lieu</span>
              </label>
              <select
                value={lieuSelectionne}
                onChange={(e) => setLieuSelectionne(e.target.value)}
                className={inputStyle}
              >
                <option value="Tous">📍 Tous les lieux ({lieuxPresents.length})</option>
                {lieuxPresents.map((lieu) => (
                  <option key={lieu} value={lieu}>{lieu}</option>
                ))}
              </select>
            </div>
          </section>

          {/* AFFICHAGE DES FICHES BILANS */}
          {lieuxAffiches.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 font-mono text-xs">
              Aucun rendez-vous trouvé pour le mois de <span className="text-white font-bold">{moisSelectionne}</span>.
            </div>
          ) : (
            <div className="space-y-8">
              {lieuxAffiches.map((lieu) => {
                const rdvsLieu = rdvsDuMois.filter(i => i.lieu === lieu);
                rdvsLieu.sort((a, b) => new Date(a.rdv.date).getTime() - new Date(b.rdv.date).getTime());

                const ficheInfo = fichesEditees[lieu] || {
                  lieu,
                  mois: moisSelectionne,
                  atelier: "Permanence Numérique",
                  commentaireGeneral: ""
                };

                const msgStatus = statusSauvegarde[lieu];

                return (
                  <article 
                    key={lieu}
                    className="fiche-bilan-card bg-slate-900 border-2 border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6"
                  >
                    {/* HEADER FICHE BILAN */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-800 gap-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full print:border-black print:text-black">
                          FICHE BILAN
                        </span>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight mt-2 flex items-center gap-2 print:text-black">
                          <MapPinIcon className="w-5 h-5 text-emerald-500 print:hidden" />
                          <span>{lieu}</span>
                        </h2>
                      </div>

                      <div className="no-print flex items-center gap-3">
                        {msgStatus && (
                          <span className="text-xs font-bold text-emerald-400 font-mono animate-pulse">
                            {msgStatus}
                          </span>
                        )}
                        <button
                          onClick={() => handleSaveFiche(lieu)}
                          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg"
                        >
                          <BookmarkSquareIcon className="w-4 h-4 stroke-[2.5]" />
                          <span>Sauvegarder</span>
                        </button>
                      </div>
                    </div>

                    {/* FORMULAIRE MÉTADONNÉES (Lieu, Atelier, Commentaire général) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 print:text-black">
                          Lieu d’intervention :
                        </label>
                        <input 
                          type="text" 
                          readOnly 
                          value={lieu} 
                          className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-bold outline-none cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 print:text-black">
                          Atelier :
                        </label>
                        <input 
                          type="text" 
                          value={ficheInfo.atelier}
                          onChange={(e) => handleFieldChange(lieu, "atelier", e.target.value)}
                          placeholder="ex: Permanence Numérique"
                          className={inputStyle}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 print:text-black">
                          Commentaire général :
                        </label>
                        <textarea 
                          rows={2}
                          value={ficheInfo.commentaireGeneral}
                          onChange={(e) => handleFieldChange(lieu, "commentaireGeneral", e.target.value)}
                          placeholder="Remarques générales du mois..."
                          className={`${inputStyle} resize-none`}
                        />
                      </div>
                    </div>

                    {/* TABLEAU DATE | MÉDIATEUR | COMMENTAIRES */}
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between print:text-black">
                        <span>Détail des actions du mois ({rdvsLieu.length})</span>
                      </h3>

                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                              <th className="py-3 px-4 w-24 border-r border-slate-800">DATE</th>
                              <th className="py-3 px-4 w-40 border-r border-slate-800">MÉDIATEUR</th>
                              <th className="py-3 px-4">COMMENTAIRES</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 bg-slate-950/30">
                            {rdvsLieu.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="p-4 text-center text-slate-600 italic">
                                  Aucune entrée pour ce lieu.
                                </td>
                              </tr>
                            ) : (
                              rdvsLieu.map((item, index) => (
                                <tr key={item.rdv.id} className="hover:bg-slate-950/60 transition-colors">
                                  {/* Format Date (ex: 26/01) */}
                                  <td className="py-3 px-4 border-r border-slate-800 font-mono font-bold text-emerald-400 whitespace-nowrap align-top">
                                    {formatShortDate(item.rdv.date)}
                                  </td>

                                  {/* Médiateur en charge du RDV */}
                                  <td className="py-3 px-4 border-r border-slate-800 font-semibold text-indigo-300 align-top whitespace-nowrap">
                                    {item.rdv.mediateur || "—"}
                                  </td>

                                  {/* Format Commentaires : Bénéficiaire X : Détails */}
                                  <td className="py-3 px-4 text-slate-200 leading-relaxed align-top">
                                    <span className="font-bold text-white">
                                      Bénéficiaire {index + 1} :
                                    </span>{" "}
                                    <span>
                                      {item.rdv.details || "(Pas de détails renseignés)"}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

        </div>
      </main>
    </>
  );
}
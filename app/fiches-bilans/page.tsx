"use client";

import { useEffect, useState, Suspense } from "react";
import { db } from "@/lib/firebase";
import { 
  collectionGroup, 
  onSnapshot, 
  getDoc, 
  doc, 
  setDoc 
} from "firebase/firestore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  ChevronLeftIcon, 
  MapPinIcon, 
  CalendarIcon, 
  BookmarkSquareIcon,
  DocumentTextIcon,
  FunnelIcon,
  PrinterIcon,
  ClockIcon,
  ChatBubbleBottomCenterTextIcon,
  BuildingOfficeIcon
} from "@heroicons/react/24/outline";

interface RDVItem {
  id: string;
  date: string;
  details: string;
  statut: string;
  mediateur: string;
}

interface InterventionDetail {
  date: string;
  mediateur: string;
  details: string;
}

interface FicheBilanData {
  lieu: string;
  mois: string;
  atelier: string;
  commentaireGeneral: string;
  interventions?: InterventionDetail[];
  savedAt?: string;
}

function FichesBilansContent() {
  const searchParams = useSearchParams();
  const paramLieu = searchParams.get("lieu");
  const paramMois = searchParams.get("mois");

  const [loading, setLoading] = useState(true);
  
  const [moisSelectionne, setMoisSelectionne] = useState<string>(() => {
    if (paramMois) return paramMois;
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${mm}`;
  });

  const [lieuSelectionne, setLieuSelectionne] = useState<string>(paramLieu || "Tous");

  // Met à jour les filtres si les paramètres d'URL changent
  useEffect(() => {
    if (paramLieu) setLieuSelectionne(paramLieu);
    if (paramMois) setMoisSelectionne(paramMois);
  }, [paramLieu, paramMois]);

  const [tousLesRdvs, setTousLesRdvs] = useState<{ lieu: string; rdv: RDVItem }[]>([]);
  const [fichesEditees, setFichesEditees] = useState<Record<string, FicheBilanData>>({});
  const [statusSauvegarde, setStatusSauvegarde] = useState<Record<string, string>>({});

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

  const rdvsDuMois = tousLesRdvs.filter((item) => {
    if (!item.rdv.date) return false;
    return item.rdv.date.startsWith(moisSelectionne) && item.rdv.statut === "Présent";
  });

  const lieuxPresents = Array.from(new Set(rdvsDuMois.map((i) => i.lieu))).sort();

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

  const handleSaveFiche = async (lieu: string) => {
    const docId = `${lieu.replace(/[/\\?%*:|"<>]/g, "_")}_${moisSelectionne}`;

    const rdvsLieu = rdvsDuMois
      .filter((item) => item.lieu.trim().toLowerCase() === lieu.trim().toLowerCase())
      .sort((a, b) => new Date(a.rdv.date).getTime() - new Date(b.rdv.date).getTime());

    const listeInterventions: InterventionDetail[] = rdvsLieu.map((item) => ({
      date: item.rdv.date,
      mediateur: item.rdv.mediateur || "—",
      details: item.rdv.details || "(Pas de détails renseignés)"
    }));

    const dataToSave: FicheBilanData = {
      ...(fichesEditees[lieu] || {
        lieu,
        mois: moisSelectionne,
        atelier: "Permanence Numérique",
        commentaireGeneral: ""
      }),
      lieu,
      mois: moisSelectionne,
      interventions: listeInterventions,
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

  const handlePrint = () => {
    window.print();
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  const formatMoisLong = (moisStr: string) => {
    if (!moisStr) return "";
    const [annee, mois] = moisStr.split("-");
    const date = new Date(parseInt(annee), parseInt(mois) - 1, 1);
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  const lieuxAffiches = lieuSelectionne === "Tous" 
    ? lieuxPresents 
    : lieuxPresents.filter(l => l.trim().toLowerCase() === lieuSelectionne.trim().toLowerCase());

  const inputStyle = "w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 outline-none transition-all";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold animate-pulse">
        Chargement des fiches bilans...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased print:bg-white print:text-black print:p-0">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* EN-TÊTE PRINCIPAL (MASQUÉ À L'IMPRESSION) */}
        <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
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

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <Link
              href={`/fiches-bilans/historique?lieu=${encodeURIComponent(lieuSelectionne)}&mois=${moisSelectionne}`}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg"
            >
              <ClockIcon className="w-4 h-4 stroke-[2.5]" />
              <span>Historique</span>
            </Link>

            {lieuxAffiches.length > 0 && (
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer"
              >
                <PrinterIcon className="w-4 h-4 stroke-[2.5]" />
                <span>Imprimer / PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* SECTION DE FILTRES (MASQUÉE À L'IMPRESSION) */}
        <section className="print:hidden grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
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

        {lieuxAffiches.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 font-mono text-xs print:bg-white print:text-black print:border-none">
            Aucun rendez-vous trouvé pour le lieu <span className="text-white print:text-black font-bold">{lieuSelectionne}</span> le mois de <span className="text-white print:text-black font-bold">{moisSelectionne}</span>.
          </div>
        ) : (
          <div className="space-y-8">
            {lieuxAffiches.map((lieu, idx) => {
              const rdvsLieu = rdvsDuMois.filter(i => i.lieu.trim().toLowerCase() === lieu.trim().toLowerCase());
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
                  className={`bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 print:bg-white print:text-black print:border-none print:shadow-none print:p-0 ${
                    idx > 0 ? "print:break-before-page" : ""
                  }`}
                >
                  {/* EN-TÊTE DU DOCUMENT IMPRIMABLE AVEC LOGOS */}
                  <div className="border-b-2 border-slate-800 print:border-slate-300 pb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 bg-white/95 p-2.5 rounded-2xl shadow-sm print:bg-transparent print:p-0 print:shadow-none">
                      <img 
                        src="/logos/residence.png" 
                        alt="Logo Colombbus" 
                        className="h-12 w-auto object-contain"
                      />
                      <div className="h-10 w-[1px] bg-slate-300" />
                      
                    </div>

                    <div className="text-center sm:text-right">
                      <h2 className="text-2xl font-black uppercase tracking-tight text-white print:text-black">
                        Fiche Bilan Mensuelle
                      </h2>
                      <p className="text-xs text-emerald-400 print:text-emerald-700 font-bold uppercase tracking-wider mt-1">
                        {formatMoisLong(moisSelectionne)}
                      </p>
                    </div>
                  </div>

                  {/* BARRE DE CONTRÔLE / SAUVEGARDE (MASQUÉE À L'IMPRESSION) */}
                  <div className="print:hidden flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4 text-emerald-500" />
                      {lieu}
                    </span>

                    <div className="flex items-center gap-3">
                      {msgStatus && (
                        <span className="text-xs font-bold text-emerald-400 font-mono animate-pulse">
                          {msgStatus}
                        </span>
                      )}
                      <button
                        onClick={() => handleSaveFiche(lieu)}
                        className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer"
                      >
                        <BookmarkSquareIcon className="w-4 h-4 stroke-[2.5]" />
                        <span>Sauvegarder</span>
                      </button>
                    </div>
                  </div>

                  {/* SECTION 1 : INFORMATIONS DE L'ATELIER & LIEU */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 print:bg-slate-50 p-5 rounded-2xl border border-slate-800/80 print:border-slate-200">
                    <div>
                      <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600 mb-1 flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3.5 h-3.5 text-emerald-400 print:hidden" /> Lieu d’intervention
                      </label>
                      <div className="w-full bg-slate-900/50 print:bg-transparent border border-slate-800/60 print:border-b print:border-slate-400 print:rounded-none px-3 py-2 rounded-lg text-white print:text-black font-bold text-xs min-h-[36px] flex items-center">
                        {lieu}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600 mb-1 flex items-center gap-1">
                        <DocumentTextIcon className="w-3.5 h-3.5 text-emerald-400 print:hidden" /> Atelier / Type d'action
                      </label>
                      <input 
                        type="text" 
                        value={ficheInfo.atelier}
                        onChange={(e) => handleFieldChange(lieu, "atelier", e.target.value)}
                        placeholder="ex: Permanence Numérique"
                        className="w-full bg-slate-900 print:bg-transparent border border-slate-800 print:border-b print:border-slate-400 print:rounded-none px-3 py-2 rounded-xl text-slate-200 print:text-black text-xs font-semibold outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600 mb-1 flex items-center gap-1">
                        <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5 text-emerald-400 print:hidden" /> Commentaire général
                      </label>
                      <textarea 
                        rows={2}
                        value={ficheInfo.commentaireGeneral}
                        onChange={(e) => handleFieldChange(lieu, "commentaireGeneral", e.target.value)}
                        placeholder="Remarques générales du mois..."
                        className="print:hidden w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-slate-300 outline-none focus:border-emerald-500 text-xs leading-relaxed resize-none transition-all"
                      />
                      <div className="hidden print:block w-full border border-slate-300 p-3 rounded-xl text-black text-xs leading-relaxed whitespace-pre-wrap min-h-[40px]">
                        {ficheInfo.commentaireGeneral || "Aucun commentaire général."}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2 : TABLEAU DÉTAILLÉ DES ACTIONS DU MOIS */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-300 pb-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 print:text-black flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-emerald-400 print:hidden" />
                        <span>Détail des actions du mois ({rdvsLieu.length})</span>
                      </h3>
                      <span className="text-[10px] font-mono text-slate-500 print:text-slate-600 font-bold">
                        Total interventions : {rdvsLieu.length}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-slate-300">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 print:border-slate-300 bg-slate-950 print:bg-slate-100 text-slate-400 print:text-slate-700 uppercase tracking-wider text-[10px] font-black">
                            <th className="py-3 px-4 w-24 border-r border-slate-800 print:border-slate-300">DATE</th>
                            <th className="py-3 px-4 w-44 border-r border-slate-800 print:border-slate-300">MÉDIATEUR</th>
                            <th className="py-3 px-4">COMMENTAIRES & OBSERVATIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 print:divide-slate-200 bg-slate-950/30 print:bg-white">
                          {rdvsLieu.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-4 text-center text-slate-500 print:text-slate-600 italic">
                                Aucune entrée pour ce lieu durant ce mois.
                              </td>
                            </tr>
                          ) : (
                            rdvsLieu.map((item, index) => (
                              <tr key={item.rdv.id} className="hover:bg-slate-950/60 print:hover:bg-transparent">
                                <td className="py-3 px-4 border-r border-slate-800 print:border-slate-200 font-mono font-bold text-emerald-400 print:text-emerald-800 whitespace-nowrap align-top">
                                  {formatShortDate(item.rdv.date)}
                                </td>

                                <td className="py-3 px-4 border-r border-slate-800 print:border-slate-200 font-bold text-indigo-300 print:text-indigo-900 align-top whitespace-nowrap">
                                  {item.rdv.mediateur || "—"}
                                </td>

                                <td className="py-3 px-4 text-slate-200 print:text-black leading-relaxed align-top">
                                  <span className="font-bold text-white print:text-black">
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

                  {/* SECTION 3 : PIED DE PAGE & SIGNATURE IMPRIMABLE */}
                  <div className="hidden print:flex pt-6 border-t border-slate-300 justify-between items-end text-xs">
                    <div>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Fiche générée le {new Date().toLocaleDateString("fr-FR")} — Association Colombbus
                      </p>
                    </div>
                    <div className="w-56 text-right space-y-8">
                      <p className="text-xs font-bold text-slate-800">
                        Signature / Validation :
                      </p>
                      <div className="border-b border-dashed border-slate-400 h-6" />
                    </div>
                  </div>

                </article>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}

export default function FichesBilansPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold">Chargement...</div>}>
      <FichesBilansContent />
    </Suspense>
  );
}
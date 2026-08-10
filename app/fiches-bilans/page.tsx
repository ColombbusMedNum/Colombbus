"use client";

import { useEffect, useState, Suspense } from "react";
import { db } from "@/lib/firebase";
import PageGuard from "@/components/PageGuard";
import { 
  collectionGroup, 
  onSnapshot, 
  getDoc, 
  doc, 
  setDoc 
} from "firebase/firestore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Quicksand } from "next/font/google";
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
  BuildingOfficeIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from "@heroicons/react/24/outline";

// Police Quicksand pour toute la page
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

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

  const inputStyle = "w-full bg-white border border-[#404040]/15 rounded-xl p-2.5 text-xs text-[#404040] placeholder-[#404040]/40 focus:border-[#005259] focus:ring-1 focus:ring-[#005259] outline-none transition-all font-medium shadow-sm";

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement des fiches bilans...
      </div>
    );
  }

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden print:bg-white print:text-black print:p-0`}>
      
      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none print:hidden"></div>

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        
        {/* EN-TÊTE PRINCIPAL (MASQUÉ À L'IMPRESSION) */}
        <div className="print:hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
            <div>
              <Link 
                href="/liste-beneficiaires" 
                className="inline-flex items-center gap-1.5 text-[#404040]/70 hover:text-[#005259] transition-colors group text-[11px] font-bold uppercase tracking-wider mb-0.5"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5 text-[#EA601F] group-hover:-translate-x-0.5 transition-transform" />
                <span>Retour au tableau de bord</span>
              </Link>
              <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                Fiches <span className="text-[#EA601F] font-normal">bilans mensuelles</span>
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/fiches-bilans/historique?lieu=${encodeURIComponent(lieuSelectionne)}&mois=${moisSelectionne}`}
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <ClockIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Historique</span>
            </Link>

            {lieuxAffiches.length > 0 && (
              <button
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md active:scale-95 group"
              >
                <PrinterIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>Imprimer / PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* SECTION DE FILTRES (MASQUÉE À L'IMPRESSION) */}
        <section className="print:hidden grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-2xl border border-[#404040]/10 shadow-sm">
          <div>
            <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-[#EA601F]" />
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
            <label className="block text-[10px] font-bold text-[#005259] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <FunnelIcon className="w-4 h-4 text-[#EA601F]" />
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
          <div className="bg-white border border-[#404040]/10 rounded-2xl p-12 text-center text-[#404040]/60 text-xs font-bold uppercase tracking-wider print:bg-white print:text-black print:border-none">
            🔍 Aucun rendez-vous trouvé pour le lieu <span className="text-[#005259] print:text-black font-extrabold">{lieuSelectionne}</span> le mois de <span className="text-[#005259] print:text-black font-extrabold">{moisSelectionne}</span>.
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
                  className={`bg-white border border-[#404040]/10 rounded-2xl p-6 md:p-8 shadow-sm space-y-6 print:bg-white print:text-black print:border-none print:shadow-none print:p-0 ${
                    idx > 0 ? "print:break-before-page" : ""
                  }`}
                >
                  {/* EN-TÊTE DU DOCUMENT IMPRIMABLE AVEC LOGO ET TITRE CENTRÉ */}
                  <div className="border-b border-[#404040]/10 print:border-slate-300 pb-6 flex flex-col items-center gap-4 text-center">
                    <div className="w-full bg-[#F3F3F2] print:bg-transparent p-3 rounded-2xl print:p-0 flex justify-center">
                      <img 
                        src="/logos/residence.png" 
                        alt="Logo Colombbus" 
                        className="w-full h-auto max-h-24 object-contain"
                      />
                    </div>

                    <div>
                      <h2 className="text-2xl font-bold uppercase tracking-tight text-[#005259] print:text-black">
                        Fiche Bilan Mensuelle
                      </h2>
                      <p className="text-xs text-[#EA601F] print:text-slate-700 font-bold uppercase tracking-widest mt-1">
                        {formatMoisLong(moisSelectionne)}
                      </p>
                    </div>
                  </div>

                  {/* BARRE DE CONTRÔLE / SAUVEGARDE (MASQUÉE À L'IMPRESSION) */}
                  <div className="print:hidden flex justify-between items-center bg-[#F3F3F2] p-3.5 rounded-xl border border-[#404040]/10">
                    <span className="text-xs font-bold text-[#005259] uppercase tracking-wider flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4 text-[#EA601F]" />
                      {lieu}
                    </span>

                    <div className="flex items-center gap-3">
                      {msgStatus && (
                        <span className="text-xs font-bold text-[#005259] animate-pulse">
                          {msgStatus}
                        </span>
                      )}
                      <button
                        onClick={() => handleSaveFiche(lieu)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#005259] hover:bg-[#EA601F] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                      >
                        <BookmarkSquareIcon className="w-4 h-4" />
                        <span>Sauvegarder</span>
                      </button>
                    </div>
                  </div>

                  {/* SECTION 1 : INFORMATIONS DE L'ATELIER & LIEU */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F3F3F2]/60 print:bg-slate-50 p-5 rounded-xl border border-[#404040]/10 print:border-slate-200">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-[#005259] print:text-slate-600 mb-1.5 flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3.5 h-3.5 text-[#EA601F] print:hidden" /> Lieu d’intervention
                      </label>
                      <div className="w-full bg-white print:bg-transparent border border-[#404040]/15 print:border-b print:border-slate-400 print:rounded-none px-3 py-2 rounded-lg text-[#005259] print:text-black font-bold text-xs min-h-[36px] flex items-center">
                        {lieu}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-[#005259] print:text-slate-600 mb-1.5 flex items-center gap-1">
                        <DocumentTextIcon className="w-3.5 h-3.5 text-[#EA601F] print:hidden" /> Atelier / Type d'action
                      </label>
                      <input 
                        type="text" 
                        value={ficheInfo.atelier}
                        onChange={(e) => handleFieldChange(lieu, "atelier", e.target.value)}
                        placeholder="ex: Permanence Numérique"
                        className="w-full bg-white print:bg-transparent border border-[#404040]/15 print:border-b print:border-slate-400 print:rounded-none px-3 py-2 rounded-lg text-[#404040] print:text-black text-xs font-semibold outline-none focus:border-[#005259] transition-all"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-[#005259] print:text-slate-600 mb-1.5 flex items-center gap-1">
                        <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5 text-[#EA601F] print:hidden" /> Commentaire général
                      </label>
                      <textarea 
                        rows={2}
                        value={ficheInfo.commentaireGeneral}
                        onChange={(e) => handleFieldChange(lieu, "commentaireGeneral", e.target.value)}
                        placeholder="Remarques générales du mois..."
                        className="print:hidden w-full bg-white border border-[#404040]/15 p-3 rounded-xl text-[#404040] outline-none focus:border-[#005259] text-xs leading-relaxed resize-none transition-all placeholder-[#404040]/40 font-medium shadow-sm"
                      />
                      <div className="hidden print:block w-full border border-slate-300 p-3 rounded-xl text-black text-xs leading-relaxed whitespace-pre-wrap min-h-[40px]">
                        {ficheInfo.commentaireGeneral || "Aucun commentaire général."}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2 : TABLEAU DÉTAILLÉ DES ACTIONS DU MOIS */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#404040]/10 print:border-slate-300 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#005259] print:text-black flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-[#EA601F] print:hidden" />
                        <span>Détail des actions du mois ({rdvsLieu.length})</span>
                      </h3>
                      <span className="text-[10px] font-bold text-[#005259] bg-[#A9E0C9]/30 px-2.5 py-1 rounded-md border border-[#A9E0C9] print:bg-slate-100 print:text-slate-600 print:border-slate-300">
                        Total interventions : {rdvsLieu.length}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-[#404040]/10 print:border-slate-300">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 print:border-slate-300 text-[#005259] print:text-slate-700 uppercase tracking-widest text-[10px] font-bold">
                            <th className="py-3.5 px-4 w-24 border-r border-[#404040]/10 print:border-slate-300">DATE</th>
                            <th className="py-3.5 px-4 w-44 border-r border-[#404040]/10 print:border-slate-300">MÉDIATEUR</th>
                            <th className="py-3.5 px-4">COMMENTAIRES & OBSERVATIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#404040]/5 print:divide-slate-200 bg-white">
                          {rdvsLieu.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-4 text-center text-[#404040]/60 print:text-slate-600 italic">
                                Aucune entrée pour ce lieu durant ce mois.
                              </td>
                            </tr>
                          ) : (
                            rdvsLieu.map((item, index) => (
                              <tr key={item.rdv.id} className="hover:bg-[#F3F3F2]/60 print:hover:bg-transparent transition-colors">
                                <td className="py-3.5 px-4 border-r border-[#404040]/10 print:border-slate-200 font-bold text-[#005259] print:text-slate-900 whitespace-nowrap align-top">
                                  {formatShortDate(item.rdv.date)}
                                </td>

                                <td className="py-3.5 px-4 border-r border-[#404040]/10 print:border-slate-200 font-bold text-[#404040] print:text-slate-900 align-top whitespace-nowrap">
                                  {item.rdv.mediateur || "—"}
                                </td>

                                <td className="py-3.5 px-4 text-[#404040] print:text-black leading-relaxed align-top">
                                  <span className="font-bold text-[#005259] print:text-black">
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
                        Document généré le {new Date().toLocaleDateString('fr-FR')}
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
    <PageGuard pageId="page_access_fiches_bilans">
    <Suspense fallback={
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold uppercase tracking-widest text-xs`}>
        Chargement...
      </div>
    }>
      <FichesBilansContent />
    </Suspense>
    </PageGuard>
  );
}
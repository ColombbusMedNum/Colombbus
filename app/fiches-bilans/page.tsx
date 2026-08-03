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

  const inputStyle = "w-full bg-[#00383d] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-400 focus:border-[#F9C44E] focus:ring-1 focus:ring-[#F9C44E] outline-none transition-all font-medium";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#00383d] flex items-center justify-center text-[#F9C44E] font-bold animate-pulse tracking-widest text-xs uppercase antialiased">
        Chargement des fiches bilans...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#00383d] text-slate-100 p-4 md:p-8 font-medium antialiased relative overflow-hidden print:bg-white print:text-black print:p-0">
      
      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#F9C44E]/5 blur-[140px] rounded-full pointer-events-none print:hidden"></div>

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        
        {/* EN-TÊTE PRINCIPAL (MASQUÉ À L'IMPRESSION) */}
        <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link 
              href="/liste-beneficiaires" 
              className="inline-flex items-center gap-2 text-slate-300 hover:text-[#F9C44E] transition-colors group text-xs font-bold uppercase tracking-wider mb-2"
            >
              <ChevronLeftIcon className="w-4 h-4 text-[#F9C44E] group-hover:-translate-x-1 transition-transform" />
              <span>Retour au tableau de bord</span>
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white uppercase flex items-center gap-3">
              <DocumentTextIcon className="w-8 h-8 text-[#F9C44E]" />
              <span>Fiches <span className="text-[#F9C44E]">Bilans Mensuelles</span></span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <Link
              href={`/fiches-bilans/historique?lieu=${encodeURIComponent(lieuSelectionne)}&mois=${moisSelectionne}`}
              className="inline-flex items-center gap-2 bg-[#005259] hover:bg-[#00383d] text-white border border-white/10 font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md"
            >
              <ClockIcon className="w-4 h-4 text-[#F9C44E]" />
              <span>Historique</span>
            </Link>

            {lieuxAffiches.length > 0 && (
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 bg-[#F9945D] hover:bg-[#EF736A] text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                <PrinterIcon className="w-4 h-4" />
                <span>Imprimer / PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* SECTION DE FILTRES (MASQUÉE À L'IMPRESSION) */}
        <section className="print:hidden grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#005259] p-5 rounded-2xl border border-[#404040]/40 shadow-xl">
          <div>
            <label className="block text-[10px] font-bold text-[#F9C44E] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-[#F9C44E]" />
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
            <label className="block text-[10px] font-bold text-[#F9C44E] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <FunnelIcon className="w-4 h-4 text-[#F9C44E]" />
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
          <div className="bg-[#005259] border border-[#404040]/40 rounded-2xl p-12 text-center text-slate-300 text-xs font-bold uppercase tracking-wider print:bg-white print:text-black print:border-none">
            Aucun rendez-vous trouvé pour le lieu <span className="text-[#F9C44E] print:text-black font-extrabold">{lieuSelectionne}</span> le mois de <span className="text-[#F9C44E] print:text-black font-extrabold">{moisSelectionne}</span>.
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
                  className={`bg-[#005259] border border-[#404040]/40 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 print:bg-white print:text-black print:border-none print:shadow-none print:p-0 ${
                    idx > 0 ? "print:break-before-page" : ""
                  }`}
                >
                  {/* EN-TÊTE DU DOCUMENT IMPRIMABLE AVEC LOGO ET TITRE CENTRÉ */}
                  <div className="border-b border-white/10 print:border-slate-300 pb-6 flex flex-col items-center gap-4 text-center">
                    <div className="w-full bg-white p-3 rounded-2xl shadow-sm print:shadow-none print:p-0 flex justify-center">
                      <img 
                        src="/logos/residence.png" 
                        alt="Logo Colombbus" 
                        className="w-full h-auto max-h-24 object-contain"
                      />
                    </div>

                    <div>
                      <h2 className="text-2xl font-extrabold uppercase tracking-tight text-white print:text-black">
                        Fiche Bilan Mensuelle
                      </h2>
                      <p className="text-xs text-[#F9C44E] print:text-slate-700 font-bold uppercase tracking-widest mt-1">
                        {formatMoisLong(moisSelectionne)}
                      </p>
                    </div>
                  </div>

                  {/* BARRE DE CONTRÔLE / SAUVEGARDE (MASQUÉE À L'IMPRESSION) */}
                  <div className="print:hidden flex justify-between items-center bg-[#00383d] p-3.5 rounded-xl border border-white/10">
                    <span className="text-xs font-bold text-[#F9C44E] uppercase tracking-wider flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4 text-[#F9C44E]" />
                      {lieu}
                    </span>

                    <div className="flex items-center gap-3">
                      {msgStatus && (
                        <span className="text-xs font-bold text-[#F9C44E] animate-pulse">
                          {msgStatus}
                        </span>
                      )}
                      <button
                        onClick={() => handleSaveFiche(lieu)}
                        className="inline-flex items-center gap-2 bg-[#F9945D] hover:bg-[#EF736A] text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                      >
                        <BookmarkSquareIcon className="w-4 h-4" />
                        <span>Sauvegarder</span>
                      </button>
                    </div>
                  </div>

                  {/* SECTION 1 : INFORMATIONS DE L'ATELIER & LIEU */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#00383d] print:bg-slate-50 p-5 rounded-xl border border-white/10 print:border-slate-200">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-[#F9C44E] print:text-slate-600 mb-1.5 flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3.5 h-3.5 text-[#F9C44E] print:hidden" /> Lieu d’intervention
                      </label>
                      <div className="w-full bg-[#005259] print:bg-transparent border border-white/10 print:border-b print:border-slate-400 print:rounded-none px-3 py-2 rounded-lg text-white print:text-black font-bold text-xs min-h-[36px] flex items-center">
                        {lieu}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-[#F9C44E] print:text-slate-600 mb-1.5 flex items-center gap-1">
                        <DocumentTextIcon className="w-3.5 h-3.5 text-[#F9C44E] print:hidden" /> Atelier / Type d'action
                      </label>
                      <input 
                        type="text" 
                        value={ficheInfo.atelier}
                        onChange={(e) => handleFieldChange(lieu, "atelier", e.target.value)}
                        placeholder="ex: Permanence Numérique"
                        className="w-full bg-[#005259] print:bg-transparent border border-white/10 print:border-b print:border-slate-400 print:rounded-none px-3 py-2 rounded-lg text-slate-100 print:text-black text-xs font-semibold outline-none focus:border-[#F9C44E]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-[#F9C44E] print:text-slate-600 mb-1.5 flex items-center gap-1">
                        <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5 text-[#F9C44E] print:hidden" /> Commentaire général
                      </label>
                      <textarea 
                        rows={2}
                        value={ficheInfo.commentaireGeneral}
                        onChange={(e) => handleFieldChange(lieu, "commentaireGeneral", e.target.value)}
                        placeholder="Remarques générales du mois..."
                        className="print:hidden w-full bg-[#005259] border border-white/10 p-3 rounded-xl text-slate-100 outline-none focus:border-[#F9C44E] text-xs leading-relaxed resize-none transition-all placeholder-slate-400 font-medium"
                      />
                      <div className="hidden print:block w-full border border-slate-300 p-3 rounded-xl text-black text-xs leading-relaxed whitespace-pre-wrap min-h-[40px]">
                        {ficheInfo.commentaireGeneral || "Aucun commentaire général."}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2 : TABLEAU DÉTAILLÉ DES ACTIONS DU MOIS */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 print:border-slate-300 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 print:text-black flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-[#F9C44E] print:hidden" />
                        <span>Détail des actions du mois ({rdvsLieu.length})</span>
                      </h3>
                      <span className="text-[10px] font-bold text-[#F9C44E] print:text-slate-600 bg-[#00383d] px-2.5 py-1 rounded-md border border-white/10">
                        Total interventions : {rdvsLieu.length}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-white/10 print:border-slate-300">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 print:border-slate-300 bg-[#00383d] print:bg-slate-100 text-[#F9C44E] print:text-slate-700 uppercase tracking-wider text-[10px] font-bold">
                            <th className="py-3 px-4 w-24 border-r border-white/10 print:border-slate-300">DATE</th>
                            <th className="py-3 px-4 w-44 border-r border-white/10 print:border-slate-300">MÉDIATEUR</th>
                            <th className="py-3 px-4">COMMENTAIRES & OBSERVATIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 print:divide-slate-200 bg-[#005259] print:bg-white">
                          {rdvsLieu.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-4 text-center text-slate-300 print:text-slate-600 italic">
                                Aucune entrée pour ce lieu durant ce mois.
                              </td>
                            </tr>
                          ) : (
                            rdvsLieu.map((item, index) => (
                              <tr key={item.rdv.id} className="hover:bg-[#00383d]/40 print:hover:bg-transparent transition-colors">
                                <td className="py-3 px-4 border-r border-white/10 print:border-slate-200 font-bold text-[#F9C44E] print:text-slate-900 whitespace-nowrap align-top">
                                  {formatShortDate(item.rdv.date)}
                                </td>

                                <td className="py-3 px-4 border-r border-white/10 print:border-slate-200 font-bold text-slate-200 print:text-slate-900 align-top whitespace-nowrap">
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
    <Suspense fallback={<div className="min-h-screen bg-[#00383d] flex items-center justify-center text-[#F9C44E] font-bold">Chargement...</div>}>
      <FichesBilansContent />
    </Suspense>
  );
}
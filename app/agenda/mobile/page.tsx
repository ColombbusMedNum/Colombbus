"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { Quicksand } from "next/font/google";
import { HomeIcon, ChevronLeftIcon, ChevronRightIcon, DevicePhoneMobileIcon, MapPinIcon, ChatBubbleLeftRightIcon, XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import PageGuard from "@/components/PageGuard";
import { usePermissions } from "@/lib/PermissionsProvider";
import { useMediateurs } from "@/lib/MediateursProvider";
import { estActionDuMediateur, identifiantMediateur, nomCompletMediateur } from "@/lib/matchMediateur";
import { getJoursFeries } from "@/lib/activitesTypes";
import type { Mediateur, ActionPlanning } from "@/lib/types";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(date.setDate(diff));
  mon.setHours(12, 0, 0, 0);
  return mon;
}

// Vue "Mon planning" ultra-simplifiée, pensée pour un écran de smartphone.
// Pour un médiateur/ACI : toujours verrouillée sur son propre planning (pas
// de sélecteur, pas de vue d'ensemble). Pour un admin/coordinateur : sélecteur
// libre du médiateur affiché + un second onglet "Aujourd'hui" qui liste, par
// lieu, qui est positionné dessus ce jour-là, tous médiateurs confondus.
export default function AgendaMobilePage() {
  const { mediateurs: mediateursBruts } = useMediateurs();
  const { user, role, can } = usePermissions();
  const estAdminOuCoordo = role === "admin" || role === "coordinateur";
  const canViewComment = can("agenda_comment_view");
  const canEditComment = can("agenda_comment_edit");

  const mediateurs = useMemo(() => {
    return (mediateursBruts as Mediateur[])
      .filter((m) => m.actif !== false && (m.prenom || m.nom))
      .sort((a, b) => `${a.prenom || ""} ${a.nom || ""}`.localeCompare(`${b.prenom || ""} ${b.nom || ""}`, "fr"));
  }, [mediateursBruts]);

  const monProfil = useMemo(() => {
    if (!user?.email) return null;
    return mediateurs.find((m) => m.email?.toLowerCase() === user.email!.toLowerCase()) || null;
  }, [mediateurs, user]);

  const [vue, setVue] = useState<"semaine" | "aujourdhui">("semaine");
  const [selectedMedId, setSelectedMedId] = useState<string>("");

  useEffect(() => {
    if (selectedMedId || mediateurs.length === 0) return;
    if (monProfil) { setSelectedMedId(monProfil.id); return; }
    if (estAdminOuCoordo) setSelectedMedId(mediateurs[0].id);
  }, [mediateurs, monProfil, estAdminOuCoordo, selectedMedId]);

  // Le médiateur affiché en vue "Semaine" : libre pour un admin/coordinateur
  // (sélecteur), toujours soi-même sinon.
  const medAffiche = estAdminOuCoordo ? mediateurs.find((m) => m.id === selectedMedId) || null : monProfil;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [actions, setActions] = useState<ActionPlanning[]>([]);
  const [loading, setLoading] = useState(true);

  const monday = useMemo(() => getMonday(currentDate), [currentDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 6 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; }),
    [monday]
  );

  useEffect(() => {
    const debut = weekDays[0].toLocaleDateString("en-CA");
    const fin = weekDays[weekDays.length - 1].toLocaleDateString("en-CA");
    const q = query(collection(db, "planning_mediateurs"), where("date", ">=", debut), where("date", "<=", fin));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setActions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setLoading(false);
      },
      (error) => {
        console.error("Erreur de chargement du planning :", error);
        setLoading(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDays[0]?.getTime()]);

  const actionsDuMedAffiche = useMemo(() => {
    if (!medAffiche) return [];
    return actions.filter((a) => estActionDuMediateur(a, medAffiche));
  }, [actions, medAffiche]);

  const joursFeries = useMemo(() => getJoursFeries(monday.getFullYear()), [monday]);

  const parJourEtMoment = useMemo(() => {
    const map: Record<string, ActionPlanning[]> = Object.create(null);
    actionsDuMedAffiche.forEach((a) => {
      const cle = `${a.date}_${a.moment || ""}`;
      if (!map[cle]) map[cle] = [];
      map[cle].push(a);
    });
    return map;
  }, [actionsDuMedAffiche]);

  // Commentaire d'un créneau — même mécanique que app/agenda/page.tsx
  // (handleEditCommentaire/handleSaveCommentaire), version compacte pour
  // cette page mobile.
  const [activeCommentModal, setActiveCommentModal] = useState<{
    actionId: string;
    currentText: string;
    inputText: string;
    readOnly: boolean;
  } | null>(null);

  const handleEditCommentaire = (action: ActionPlanning) => {
    if (!canViewComment && !canEditComment) return;
    setActiveCommentModal({
      actionId: action.id,
      currentText: action.commentaire || "",
      inputText: action.commentaire || "",
      readOnly: !canEditComment,
    });
  };

  const handleSaveCommentaire = async (supprimer = false) => {
    if (!activeCommentModal || activeCommentModal.readOnly) return;
    const { actionId, inputText } = activeCommentModal;
    try {
      const texteFinal = supprimer ? "" : inputText.trim();
      await updateDoc(doc(db, "planning_mediateurs", actionId), { commentaire: texteFinal });

      const actionCible = actions.find((a) => a.id === actionId);
      if (actionCible?.mediatId && texteFinal !== (actionCible.commentaire || "")) {
        await addDoc(collection(db, "notifications"), {
          destinataireId: actionCible.mediatId,
          message: supprimer
            ? `🗑️ Note supprimée sur le créneau du ${actionCible.date} (${actionCible.moment || "Présence"}).`
            : `📝 Note mise à jour sur le créneau du ${actionCible.date} (${actionCible.moment || "Présence"}) : "${texteFinal}"`,
          createdAt: Date.now(),
          lue: false,
        });
      }
    } catch (error) {
      console.error("Erreur de commentaire :", error);
    } finally {
      setActiveCommentModal(null);
    }
  };

  // Vue "Aujourd'hui" (admin/coordinateur) : indépendante de la navigation
  // semaine ci-dessus, toujours centrée sur la date du jour, tous
  // médiateurs confondus, regroupée par lieu plutôt que par personne.
  const [actionsAujourdhui, setActionsAujourdhui] = useState<ActionPlanning[]>([]);
  const [loadingAujourdhui, setLoadingAujourdhui] = useState(true);
  const aujourdHuiStr = new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    if (!estAdminOuCoordo) return;
    const q = query(collection(db, "planning_mediateurs"), where("date", "==", aujourdHuiStr));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setActionsAujourdhui(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setLoadingAujourdhui(false);
      },
      (error) => {
        console.error("Erreur de chargement du planning du jour :", error);
        setLoadingAujourdhui(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estAdminOuCoordo, aujourdHuiStr]);

  const parLieuAujourdhui = useMemo(() => {
    const map: Record<string, { Matin: string[]; ["Après-midi"]: string[] }> = Object.create(null);
    actionsAujourdhui.forEach((a) => {
      const lieu = a.lieu || "Activité";
      if (!map[lieu]) map[lieu] = { Matin: [], "Après-midi": [] };
      const moment = a.moment === "Matin" ? "Matin" : "Après-midi";
      const nom = a.mediateurNom || nomCompletMediateur({ id: identifiantMediateur(a) } as Mediateur) || "?";
      map[lieu][moment].push(nom);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, "fr"));
  }, [actionsAujourdhui]);

  return (
    <PageGuard pageId="page_access_agenda_mobile">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-3 font-medium antialiased`}>
        <div className="max-w-md mx-auto space-y-4">
          {/* EN-TÊTE */}
          <div className="flex items-center justify-between pb-3 border-b border-[#404040]/10">
            <div className="flex items-center gap-2">
              <DevicePhoneMobileIcon className="w-5 h-5 text-[#EA601F]" />
              <h1 className="text-lg font-black uppercase text-[#005259] tracking-tight">
                {estAdminOuCoordo ? "Agenda Mobile" : "Mon planning"}
              </h1>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1.5 bg-white border border-[#404040]/10 px-2.5 py-1.5 rounded-lg text-[#005259] text-[10px] font-bold uppercase shadow-sm"
            >
              <HomeIcon className="w-3.5 h-3.5 text-[#EA601F]" />
              Accueil
            </Link>
          </div>

          {/* ONGLETS (admin/coordinateur uniquement) */}
          {estAdminOuCoordo && (
            <div className="flex gap-2 bg-white border border-[#404040]/10 rounded-xl p-1 shadow-sm">
              <button
                onClick={() => setVue("semaine")}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${vue === "semaine" ? "bg-[#005259] text-white" : "text-[#404040]/60"}`}
              >
                Par médiateur
              </button>
              <button
                onClick={() => setVue("aujourdhui")}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${vue === "aujourdhui" ? "bg-[#EA601F] text-white" : "text-[#404040]/60"}`}
              >
                Aujourd'hui
              </button>
            </div>
          )}

          {vue === "aujourdhui" && estAdminOuCoordo ? (
            <div className="space-y-3">
              <div className="text-center text-xs font-extrabold uppercase text-[#005259]">
                {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              {loadingAujourdhui ? (
                <div className="text-center py-12 text-[#EA601F] font-bold text-xs animate-pulse uppercase tracking-widest">Chargement...</div>
              ) : parLieuAujourdhui.length === 0 ? (
                <div className="text-center py-12 text-xs font-bold uppercase tracking-wider text-[#404040]/60 bg-white border border-[#404040]/10 rounded-xl">
                  Aucune action positionnée aujourd'hui.
                </div>
              ) : (
                <div className="space-y-2">
                  {parLieuAujourdhui.map(([lieu, moments]) => (
                    <div key={lieu} className="bg-white border border-[#404040]/10 rounded-xl p-3 shadow-sm">
                      <div className="flex items-center gap-1.5 font-bold text-[#005259] text-xs uppercase tracking-wide mb-1.5">
                        <MapPinIcon className="w-3.5 h-3.5 text-[#EA601F] shrink-0" />
                        {lieu}
                      </div>
                      <div className="space-y-1 text-xs pl-1">
                        {moments.Matin.length > 0 && (
                          <div><span className="text-[9px] font-bold uppercase text-[#404040]/50">Matin — </span>{moments.Matin.join(", ")}</div>
                        )}
                        {moments["Après-midi"].length > 0 && (
                          <div><span className="text-[9px] font-bold uppercase text-[#404040]/50">Après-midi — </span>{moments["Après-midi"].join(", ")}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* SÉLECTEUR MÉDIATEUR (admin/coordinateur uniquement) */}
              {estAdminOuCoordo && (
                <select
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#404040]/10 rounded-xl text-xs font-bold text-[#005259] shadow-sm outline-none focus:border-[#005259] cursor-pointer"
                >
                  {mediateurs.map((m) => (
                    <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                  ))}
                </select>
              )}

              {/* NAVIGATION SEMAINE */}
              <div className="flex items-center justify-between bg-white border border-[#404040]/10 rounded-xl p-2 shadow-sm">
                <button
                  onClick={() => setCurrentDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7))}
                  className="p-2 hover:bg-[#F3F3F2] rounded-lg text-[#005259]"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <span className="text-xs font-extrabold uppercase text-[#005259] text-center">
                  {weekDays[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  {" – "}
                  {weekDays[weekDays.length - 1].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
                <button
                  onClick={() => setCurrentDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7))}
                  className="p-2 hover:bg-[#F3F3F2] rounded-lg text-[#005259]"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="w-full text-center text-[10px] font-bold uppercase tracking-wider text-[#EA601F]"
              >
                Revenir à cette semaine
              </button>

              {/* CONTENU */}
              {loading ? (
                <div className="text-center py-12 text-[#EA601F] font-bold text-xs animate-pulse uppercase tracking-widest">
                  Chargement...
                </div>
              ) : !medAffiche ? (
                <div className="text-center py-12 text-xs font-bold uppercase tracking-wider text-[#404040]/60 bg-white border border-[#404040]/10 rounded-xl">
                  Aucune fiche médiateur associée à votre compte.
                </div>
              ) : (
                <div className="bg-white border border-[#404040]/10 rounded-xl overflow-hidden shadow-sm divide-y divide-[#F3F3F2]">
                  <div className="bg-[#005259] text-white grid grid-cols-3 text-[10px] font-extrabold uppercase tracking-wider">
                    <div className="p-2.5">Jour</div>
                    <div className="p-2.5 text-center">Matin</div>
                    <div className="p-2.5 text-center">Après-midi</div>
                  </div>
                  {weekDays.map((day) => {
                    const dateStr = day.toLocaleDateString("en-CA");
                    const estFerie = joursFeries.has(dateStr);
                    const matin = parJourEtMoment[`${dateStr}_Matin`] || [];
                    const apresMidi = parJourEtMoment[`${dateStr}_Après-midi`] || [];
                    return (
                      <div key={dateStr} className={`grid grid-cols-3 text-xs ${estFerie ? "bg-[#EF736A]/5" : ""}`}>
                        <div className="p-2.5">
                          <div className="font-bold text-[#005259]">{JOURS_SEMAINE[day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
                          <div className="text-[10px] text-[#404040]/60">{day.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>
                          {estFerie && <div className="text-[9px] font-black uppercase text-[#EF736A]">Férié</div>}
                        </div>
                        <div className="p-2.5 text-center break-words">
                          {matin.length > 0 ? matin.map((a) => (
                            <div key={a.id} className="flex items-center justify-center gap-1 text-[#404040] font-semibold">
                              {a.adresse ? (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.adresse)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2"
                                  title={`Ouvrir dans Google Maps : ${a.adresse}`}
                                >
                                  <MapPinIcon className="w-3 h-3 text-[#EA601F] shrink-0" />
                                  {a.lieu || "Activité"}
                                </a>
                              ) : (
                                <span>{a.lieu || "Activité"}</span>
                              )}
                              {a.commentaire && (canViewComment || canEditComment) && (
                                <button onClick={() => handleEditCommentaire(a)} className="shrink-0 cursor-pointer">
                                  <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-[#EA601F]" />
                                </button>
                              )}
                            </div>
                          )) : <span className="text-[#404040]/30">—</span>}
                        </div>
                        <div className="p-2.5 text-center break-words">
                          {apresMidi.length > 0 ? apresMidi.map((a) => (
                            <div key={a.id} className="flex items-center justify-center gap-1 text-[#404040] font-semibold">
                              {a.adresse ? (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.adresse)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2"
                                  title={`Ouvrir dans Google Maps : ${a.adresse}`}
                                >
                                  <MapPinIcon className="w-3 h-3 text-[#EA601F] shrink-0" />
                                  {a.lieu || "Activité"}
                                </a>
                              ) : (
                                <span>{a.lieu || "Activité"}</span>
                              )}
                              {a.commentaire && (canViewComment || canEditComment) && (
                                <button onClick={() => handleEditCommentaire(a)} className="shrink-0 cursor-pointer">
                                  <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-[#EA601F]" />
                                </button>
                              )}
                            </div>
                          )) : <span className="text-[#404040]/30">—</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* MODALE COMMENTAIRE */}
        {activeCommentModal && (
          <div className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[120] p-4">
            <div className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-sm space-y-4 shadow-2xl text-[#404040]">
              <div className="flex justify-between items-center border-b border-[#F3F3F2] pb-2">
                <h3 className="font-bold text-sm text-[#005259] flex items-center gap-2">
                  <ChatBubbleLeftRightIcon className="w-4 h-4 text-[#EA601F]" />
                  {activeCommentModal.readOnly ? "Note (Lecture seule)" : "Notes & Commentaires"}
                </h3>
                <button onClick={() => setActiveCommentModal(null)} className="text-[#404040]/50 hover:text-[#404040]">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#404040] font-bold">Précisions ou commentaires :</label>
                {activeCommentModal.readOnly ? (
                  <div className="w-full bg-[#F3F3F2] border border-[#404040]/10 rounded-md text-xs text-[#404040] min-h-24 p-2.5 overflow-y-auto whitespace-pre-wrap">
                    {activeCommentModal.inputText || "Aucun commentaire."}
                  </div>
                ) : (
                  <textarea
                    rows={3}
                    className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none focus:border-[#005259] transition-colors resize-none h-24"
                    placeholder="Saisissez une note..."
                    value={activeCommentModal.inputText}
                    onChange={(e) => setActiveCommentModal({ ...activeCommentModal, inputText: e.target.value })}
                  />
                )}
              </div>

              <div className="flex justify-between gap-2 pt-2 border-t border-[#F3F3F2]">
                {!activeCommentModal.readOnly && activeCommentModal.currentText ? (
                  <button
                    type="button"
                    onClick={() => handleSaveCommentaire(true)}
                    className="bg-[#EF736A]/10 border border-[#EF736A] text-[#EF736A] hover:bg-[#EF736A] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <TrashIcon className="w-3.5 h-3.5" /> Supprimer
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button type="button" onClick={() => setActiveCommentModal(null)} className="text-[#404040]/60 text-xs px-2 font-bold">
                    {activeCommentModal.readOnly ? "Fermer" : "Annuler"}
                  </button>
                  {!activeCommentModal.readOnly && (
                    <button type="button" onClick={() => handleSaveCommentaire(false)} className="bg-[#005259] hover:bg-[#003d42] text-white px-4 py-1.5 rounded-lg text-xs font-bold">
                      Enregistrer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </PageGuard>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection, onSnapshot, query, orderBy, addDoc,
  deleteDoc, doc, getDocs, where, updateDoc,
} from "firebase/firestore";
import { Quicksand } from "next/font/google";
import {
  PlusIcon, PencilSquareIcon, TrashIcon, HomeIcon,
  CalendarDaysIcon, ClockIcon, UsersIcon, LockClosedIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import PageGuard from "@/components/PageGuard";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import Accordion from "@/components/Accordion";
import { useMediateurs } from "@/lib/MediateursProvider";
import {
  type ActiviteType, BLOCS_THEMATIQUES,
  genererCreneauxPourModele, estimerNombreCreneaux, formatDateFrCourt, estModeleProtege,
} from "@/lib/activitesTypes";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const ACTIVITE_VIDE: ActiviteType = {
  lieu: "", debut: "09:00", fin: "17:00", adresse: "", territoire: "",
  couleur: "#005259", codeAnalytique: "", dateDebut: "", dateFin: "",
  blocs: [], mediateursIds: [], generationMoment: "Les deux", datesActives: [],
};

// Replie par défaut les sections avancées de la modale de modèle, sauf
// celles qui contiennent déjà des données (en édition) — évite une pop-up
// interminable tout en gardant visible ce qui a déjà été configuré.
function sectionsOuvertesInitiales(type: ActiviteType): Record<string, boolean> {
  return {
    apparence: (type.blocs || []).length > 0,
    periode: !!(type.dateDebut || type.dateFin || (type.datesActives || []).length > 0),
    mediateurs: (type.mediateursIds || []).length > 0,
  };
}

export default function ModelesPage() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { mediateurs: mediateursBruts } = useMediateurs();
  const mediateurs = React.useMemo(
    () => mediateursBruts.filter((m: any) => m.actif !== false && (m.prenom || m.nom)),
    [mediateursBruts]
  );

  const [activitesTypes, setActivitesTypes] = useState<ActiviteType[]>([]);
  const [localisations, setLocalisations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivite, setEditingActivite] = useState<ActiviteType | null>(null);
  const [selectedLieuPredefini, setSelectedLieuPredefini] = useState("");
  const [newActivite, setNewActivite] = useState<ActiviteType>(ACTIVITE_VIDE);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    const unsubActs = onSnapshot(query(collection(db, "activites_types"), orderBy("lieu", "asc")), (snap) => {
      setActivitesTypes(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActiviteType)));
      setLoading(false);
    });
    const unsubLocs = onSnapshot(collection(db, "liste_lieux"), (snap) => {
      setLocalisations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubActs(); unsubLocs(); };
  }, []);

  const modelesFiltres = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activitesTypes;
    return activitesTypes.filter(a => (a.lieu || "").toLowerCase().includes(q));
  }, [activitesTypes, search]);

  const openCreate = () => {
    setEditingActivite(null);
    setNewActivite(ACTIVITE_VIDE);
    setSelectedLieuPredefini("");
    setOpenSections({});
    setIsModalOpen(true);
  };

  const openEdit = (type: ActiviteType) => {
    setEditingActivite(type);
    setNewActivite({
      lieu: type.lieu || "",
      debut: type.debut || "09:00",
      fin: type.fin || "17:00",
      adresse: type.adresse || "",
      territoire: type.territoire || "",
      couleur: type.couleur || "#005259",
      codeAnalytique: type.codeAnalytique || "",
      dateDebut: type.dateDebut || "",
      dateFin: type.dateFin || "",
      blocs: type.blocs || [],
      mediateursIds: type.mediateursIds || [],
      generationMoment: type.generationMoment || "Les deux",
      datesActives: type.datesActives || [],
    });
    const locMatch = localisations?.find(
      (l) => `${l.adresse || ""}, ${l.codePostal || ""} ${l.ville || ""}`.trim() === (type.adresse || "").trim()
    );
    setSelectedLieuPredefini(locMatch ? (locMatch.nomCourt || locMatch.nomRaccourci || locMatch.nomComplet) : "");
    setOpenSections(sectionsOuvertesInitiales(type));
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivite.lieu.trim()) return;

    const nbCreneauxEstimes = estimerNombreCreneaux(newActivite);
    if (nbCreneauxEstimes > 0) {
      const ok = await confirm(
        `Ce modèle va générer jusqu'à ${nbCreneauxEstimes} créneau(x) sur les jours ouvrés de la période choisie, pour ${newActivite.mediateursIds!.length} médiateur(s). Les cases déjà occupées seront ignorées. Continuer ?`
      );
      if (!ok) return;
    }

    try {
      const dataPayload = {
        lieu: newActivite.lieu.trim(),
        debut: newActivite.debut,
        fin: newActivite.fin,
        adresse: newActivite.adresse.trim(),
        territoire: newActivite.territoire,
        couleur: newActivite.couleur,
        codeAnalytique: newActivite.codeAnalytique.trim(),
        dateDebut: newActivite.dateDebut,
        dateFin: newActivite.dateFin,
        blocs: newActivite.blocs || [],
        mediateursIds: newActivite.mediateursIds || [],
        generationMoment: newActivite.generationMoment || "Les deux",
        datesActives: newActivite.datesActives || [],
      };

      let idModele = editingActivite?.id;

      if (editingActivite?.id) {
        await updateDoc(doc(db, "activites_types", editingActivite.id), dataPayload);
        const qActions = query(collection(db, "planning_mediateurs"), where("lieu", "==", editingActivite.lieu));
        const snapActions = await getDocs(qActions);
        const updates = snapActions.docs.map(actionDoc =>
          updateDoc(doc(db, "planning_mediateurs", actionDoc.id), {
            codeAnalytique: newActivite.codeAnalytique.trim(),
            couleur: newActivite.couleur,
            lieu: newActivite.lieu.trim(),
            debut: newActivite.debut,
            fin: newActivite.fin,
            adresse: newActivite.adresse.trim(),
            territoire: newActivite.territoire,
          })
        );
        await Promise.all(updates);
      } else {
        const ref = await addDoc(collection(db, "activites_types"), dataPayload);
        idModele = ref.id;
      }

      if (nbCreneauxEstimes > 0) {
        const { crees, ignores } = await genererCreneauxPourModele({ ...dataPayload, id: idModele }, mediateurs);
        showToast(`${crees} créneau(x) généré(s)${ignores > 0 ? `, ${ignores} déjà occupé(s) ignoré(s)` : ""}.`);
      } else {
        showToast(editingActivite ? "Modèle mis à jour." : "Modèle créé.");
      }

      setNewActivite(ACTIVITE_VIDE);
      setEditingActivite(null);
      setSelectedLieuPredefini("");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Erreur sauvegarde modèle :", error);
      showToast("Une erreur est survenue lors de l'enregistrement du modèle.", "error");
    }
  };

  // Pour une activité récurrente (ex: "Quintinie") qui revient sur plusieurs
  // périodes distinctes dans l'année : crée un nouveau modèle avec les mêmes
  // horaires/lieu/type/médiateurs, dates vides à remplir directement dans le
  // tableau. Reste deux documents séparés (comme tout autre modèle) — juste
  // pré-rempli à partir de l'existant pour ne pas tout retaper.
  const handleDuplicate = async (type: ActiviteType) => {
    const { id, ...donnees } = type;
    await addDoc(collection(db, "activites_types"), { ...donnees, dateDebut: "", dateFin: "" });
    showToast(`"${type.lieu}" dupliqué — renseignez les nouvelles dates de début/fin.`);
  };

  const handleDelete = async (type: ActiviteType) => {
    if (estModeleProtege(type.lieu)) {
      showToast("🔒 Ce modèle est protégé (Suresnes ou grille horaire ACI) et ne peut pas être supprimé.", "error");
      return;
    }
    if (!(await confirm(`Supprimer définitivement le modèle "${type.lieu}" ? Les créneaux déjà posés sur le planning ne seront pas affectés.`))) return;
    if (type.id) await deleteDoc(doc(db, "activites_types", type.id));
    showToast("Modèle supprimé.");
  };

  return (
    <PageGuard pageId="page_access_modeles">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10 space-y-6">

        {/* EN-TÊTE ET NAVIGATION */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
              title="Retour à l'accueil"
            >
              <HomeIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Accueil</span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight">
                  Modèles <span className="text-[#EA601F] font-normal">d'Activités</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5">
                  Vue d'ensemble des modèles utilisés dans l'Agenda des Médiateurs
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <Link
              href="/agenda"
              className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              <CalendarDaysIcon className="w-4 h-4 text-[#EA601F]" />
              <span>Agenda</span>
            </Link>
            <PermissionGuard actionId="modeles_create">
              <button
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#EA601F] hover:bg-[#EF736A] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
              >
                <PlusIcon className="w-4 h-4" /> Nouveau Modèle
              </button>
            </PermissionGuard>
          </div>
        </div>

        <input
          type="text"
          placeholder="Rechercher un modèle par nom..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-3.5 py-2 bg-white border border-[#404040]/10 rounded-xl text-xs text-[#404040] outline-none focus:border-[#005259] shadow-sm"
        />

        {loading ? (
          <div className="text-center py-16 text-[#EA601F] font-bold text-xs animate-pulse uppercase tracking-widest">
            Chargement des modèles...
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modelesFiltres.map((type) => {
              const isProtege = estModeleProtege(type.lieu);
              const mediateursConcernes = mediateurs.filter((m: any) => (type.mediateursIds || []).includes(m.id));
              const aPeriode = !!(type.dateDebut || type.dateFin);

              return (
                <div key={type.id} className="bg-white border border-[#404040]/10 rounded-2xl p-4 shadow-sm flex flex-col gap-3" style={{ borderTopColor: type.couleur || "#005259", borderTopWidth: 3 }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-sm text-[#005259] uppercase tracking-wide truncate flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: type.couleur || "#005259" }}></span>
                        {type.lieu}
                      </h3>
                      {type.territoire && (
                        <span className="inline-block mt-1 text-[9px] font-bold bg-[#F3F3F2] border border-[#404040]/10 px-1.5 py-0.5 rounded text-[#404040]/70">
                          dept {type.territoire}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <PermissionGuard actionId="modeles_create">
                        <button onClick={() => handleDuplicate(type)} className="p-1.5 text-[#404040]/60 hover:text-[#EA601F] cursor-pointer" title="Dupliquer pour une nouvelle période (activité récurrente)">
                          <DocumentDuplicateIcon className="w-4 h-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard actionId="modeles_edit">
                        <button onClick={() => openEdit(type)} className="p-1.5 text-[#404040]/60 hover:text-[#005259] cursor-pointer">
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard actionId="modeles_delete">
                        {isProtege ? (
                          <span className="p-1.5 text-[#404040]/30" title="Modèle protégé : lié à Suresnes, non supprimable">
                            <LockClosedIcon className="w-4 h-4" />
                          </span>
                        ) : (
                          <button onClick={() => handleDelete(type)} className="p-1.5 text-[#404040]/60 hover:text-[#EF736A] cursor-pointer">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </PermissionGuard>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[10px] text-[#404040]/70">
                    {type.debut && (
                      <span className="inline-flex items-center gap-1 bg-[#F3F3F2] border border-[#404040]/10 px-2 py-0.5 rounded-lg font-mono font-bold">
                        <ClockIcon className="w-3 h-3 text-[#EA601F]" /> {type.debut}–{type.fin}
                      </span>
                    )}
                    {aPeriode && (
                      <span className="inline-flex items-center gap-1 bg-[#F3F3F2] border border-[#404040]/10 px-2 py-0.5 rounded-lg font-bold">
                        <CalendarDaysIcon className="w-3 h-3 text-[#EA601F]" />
                        {type.dateDebut || "…"} → {type.dateFin || "…"}
                      </span>
                    )}
                  </div>

                  {(type.blocs || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(type.blocs || []).map(blocId => {
                        const bloc = BLOCS_THEMATIQUES.find(b => b.id === blocId);
                        if (!bloc) return null;
                        return (
                          <span key={blocId} className="text-[9px] font-bold px-1.5 py-0.5 rounded border" style={{ borderColor: bloc.couleur, color: bloc.couleur }}>
                            {bloc.nom}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[10px] text-[#404040]/70 pt-1 border-t border-[#F3F3F2]">
                    <UsersIcon className="w-3.5 h-3.5 text-[#EA601F] shrink-0" />
                    {mediateursConcernes.length === 0 ? (
                      <span className="font-bold">Générique — visible par tous</span>
                    ) : (
                      <span className="truncate font-bold" title={mediateursConcernes.map((m: any) => `${m.prenom} ${m.nom}`).join(", ")}>
                        {mediateursConcernes.map((m: any) => m.prenom).join(", ")}
                        {mediateursConcernes.length > 0 && aPeriode && " · génération auto"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {modelesFiltres.length === 0 && (
              <div className="col-span-full text-center py-16 border border-dashed border-[#404040]/15 rounded-2xl text-xs font-bold uppercase tracking-wider text-[#404040]/60 bg-white shadow-sm">
                <DocumentDuplicateIcon className="w-6 h-6 mx-auto mb-2 text-[#404040]/30" />
                Aucun modèle {search ? "ne correspond à cette recherche" : "pour l'instant"}.
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALE CRÉATION/ÉDITION */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#005259]/40 backdrop-blur-xs flex items-center justify-center z-[110] p-4">
          <form onSubmit={handleSave} className="bg-white border border-[#404040]/10 p-5 rounded-xl w-full max-w-xs space-y-3 shadow-2xl text-[#404040] max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-sm text-[#005259]">{editingActivite ? "Modifier le Modèle" : "Nouveau Modèle"}</h3>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#404040] font-bold uppercase">Nom de l'activité</label>
              <input
                required
                placeholder="Ex: Atelier Numérique, RN Suresnes..."
                value={newActivite.lieu}
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none font-semibold"
                onChange={e => setNewActivite({...newActivite, lieu: e.target.value})}
              />
            </div>

            {localisations && localisations.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040]/70 font-semibold">Adresse prédéfinie (Optionnel)</label>
                <select
                  className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none"
                  value={selectedLieuPredefini}
                  onChange={(e) => {
                    const selectedLieuNom = e.target.value;
                    setSelectedLieuPredefini(selectedLieuNom);
                    if (!selectedLieuNom) return;
                    const locFound = localisations?.find(l => (l.nomCourt || l.nomRaccourci) === selectedLieuNom || l.nomComplet === selectedLieuNom);
                    if (locFound) {
                      setNewActivite(prev => ({
                        ...prev,
                        adresse: `${locFound.adresse || ""}, ${locFound.codePostal || ""} ${locFound.ville || ""}`.trim(),
                        territoire: locFound.codePostal ? locFound.codePostal.substring(0, 2) : prev.territoire
                      }));
                    }
                  }}
                >
                  <option value="">-- Choisir une adresse --</option>
                  {localisations.map((loc) => (
                    <option key={loc.id} value={loc.nomCourt || loc.nomRaccourci || loc.nomComplet}>
                      {loc.nomCourt || loc.nomRaccourci || loc.nomComplet}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] text-[#404040]/70 font-bold uppercase">Heure début</label>
                <input type="time" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.debut} onChange={e => setNewActivite({...newActivite, debut: e.target.value})} />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] text-[#404040]/70 font-bold uppercase">Heure fin</label>
                <input type="time" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.fin} onChange={e => setNewActivite({...newActivite, fin: e.target.value})} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#404040]/70 font-semibold">Code Analytique (Optionnel)</label>
              <input
                placeholder="Ex: 12345"
                value={newActivite.codeAnalytique}
                className="w-full px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs text-[#404040] outline-none"
                onChange={e => setNewActivite({...newActivite, codeAnalytique: e.target.value})}
              />
            </div>

            <Accordion title="Apparence (bloc thématique, couleur)" open={!!openSections.apparence} onToggle={() => toggleSection("apparence")}>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040]/70 font-semibold">Bloc thématique (Optionnel, plusieurs possibles)</label>
                <div className="flex flex-col gap-1.5">
                  {BLOCS_THEMATIQUES.map(bloc => {
                    const isChecked = (newActivite.blocs || []).includes(bloc.id);
                    return (
                      <label
                        key={bloc.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer text-xs font-bold transition-all"
                        style={{
                          borderColor: bloc.couleur,
                          color: bloc.couleur,
                          backgroundColor: isChecked ? `${bloc.couleur}1F` : "transparent"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const current = newActivite.blocs || [];
                            const updated = isChecked ? current.filter(b => b !== bloc.id) : [...current, bloc.id];
                            setNewActivite({...newActivite, blocs: updated});
                          }}
                          className="w-3.5 h-3.5 cursor-pointer"
                          style={{ accentColor: bloc.couleur }}
                        />
                        {bloc.nom}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040] font-bold uppercase">Couleur Charte</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newActivite.couleur}
                    onChange={e => setNewActivite({...newActivite, couleur: e.target.value})}
                    className="w-8 h-8 rounded cursor-pointer border border-[#404040]/20 bg-transparent shrink-0"
                  />
                  <input
                    type="text"
                    value={newActivite.couleur}
                    onChange={e => setNewActivite({...newActivite, couleur: e.target.value})}
                    placeholder="#005259"
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#F3F3F2] border border-[#404040]/20 rounded-md text-xs font-mono font-bold text-[#005259] outline-none"
                  />
                </div>
              </div>
            </Accordion>

            <Accordion title="Période & dates (visibilité dans la sidebar)" open={!!openSections.periode} onToggle={() => toggleSection("periode")}>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040]/70 font-semibold">Période de validité (Optionnel — sinon, toujours visible)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.dateDebut} onChange={e => setNewActivite({...newActivite, dateDebut: e.target.value})} />
                  <input type="date" className="w-full px-2 py-1 bg-[#F3F3F2] border border-[#404040]/20 rounded text-xs text-[#404040]" value={newActivite.dateFin} onChange={e => setNewActivite({...newActivite, dateFin: e.target.value})} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040]/70 font-semibold">Dates ponctuelles (Optionnel — pour une activité récurrente irrégulière, ex: Quintinie)</label>
                <div className="flex flex-wrap items-center gap-1 border border-[#404040]/10 rounded-md p-1.5">
                  {(newActivite.datesActives || []).slice().sort().map(d => (
                    <span key={d} className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#F3F3F2] border border-[#404040]/15 px-1.5 py-0.5 rounded-full text-[#404040]">
                      {formatDateFrCourt(d)}
                      <button
                        type="button"
                        onClick={() => setNewActivite({...newActivite, datesActives: (newActivite.datesActives || []).filter(x => x !== d)})}
                        className="text-[#404040]/50 hover:text-[#EF736A] cursor-pointer leading-none"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    type="date"
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) return;
                      const current = newActivite.datesActives || [];
                      if (!current.includes(val)) setNewActivite({...newActivite, datesActives: [...current, val]});
                    }}
                    title="Ajouter une date"
                    className="text-[10px] px-1.5 py-0.5 border border-dashed border-[#404040]/30 rounded-full bg-transparent text-[#404040]/60 cursor-pointer"
                  />
                </div>
              </div>
            </Accordion>

            <Accordion title="Médiateurs & génération automatique" open={!!openSections.mediateurs} onToggle={() => toggleSection("mediateurs")}>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#404040]/70 font-semibold">Médiateurs concernés (Optionnel — sinon, modèle générique pour tous)</label>
                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto border border-[#404040]/10 rounded-md p-1.5">
                  {mediateurs.map((m: any) => {
                    const isChecked = (newActivite.mediateursIds || []).includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 px-1 py-0.5 rounded text-xs font-semibold text-[#404040] cursor-pointer hover:bg-[#F3F3F2]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const current = newActivite.mediateursIds || [];
                            const updated = isChecked ? current.filter(id => id !== m.id) : [...current, m.id];
                            setNewActivite({...newActivite, mediateursIds: updated});
                          }}
                          className="w-3.5 h-3.5 cursor-pointer"
                        />
                        {m.prenom} {m.nom}
                      </label>
                    );
                  })}
                </div>
              </div>

              {(newActivite.mediateursIds || []).length > 0 && (
                <div className="flex flex-col gap-1 bg-[#EA601F]/5 border border-[#EA601F]/20 rounded-md p-2">
                  <label className="text-[10px] text-[#EA601F] font-bold uppercase">Génération automatique des créneaux</label>
                  {(!newActivite.dateDebut || !newActivite.dateFin) ? (
                    <p className="text-[10px] text-[#404040]/70">Renseignez une période ci-dessus pour générer automatiquement les créneaux de ces médiateurs sur les jours ouvrés.</p>
                  ) : (
                    <>
                      <p className="text-[10px] text-[#404040]/70">Un créneau sera posé automatiquement pour chaque médiateur choisi, sur chaque jour ouvré (hors jours fériés) de la période.</p>
                      <div className="flex gap-3 pt-0.5">
                        {(["Matin", "Après-midi", "Les deux"] as const).map(opt => (
                          <label key={opt} className="flex items-center gap-1 text-[10px] font-bold text-[#404040] cursor-pointer">
                            <input
                              type="radio"
                              name="generationMoment"
                              checked={(newActivite.generationMoment || "Les deux") === opt}
                              onChange={() => setNewActivite({...newActivite, generationMoment: opt})}
                              className="cursor-pointer"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Accordion>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-[#005259] text-white py-1.5 rounded-md text-xs font-bold">Valider</button>
              <button type="button" onClick={() => { setIsModalOpen(false); setEditingActivite(null); setSelectedLieuPredefini(""); }} className="text-[#404040]/60 text-xs px-2 font-bold">Annuler</button>
            </div>
          </form>
        </div>
      )}
    </main>
    </PageGuard>
  );
}

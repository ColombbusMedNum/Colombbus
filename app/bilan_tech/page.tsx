"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "../../lib/firebase";
import { 
  collection, 
  getDocs, 
  doc,
  setDoc,
  addDoc,
  query, 
  orderBy, 
  where, 
  onSnapshot 
} from "firebase/firestore";
import { 
  PrinterIcon, 
  DocumentCheckIcon, 
  UserIcon, 
  MapPinIcon, 
  CalendarIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
  PencilSquareIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ClockIcon,
  PlusIcon,
  CheckIcon,
  TrashIcon,
  XMarkIcon,
  FolderOpenIcon
} from "@heroicons/react/24/outline";

interface CompetencePix {
  id: string;
  label: string;
  score: number;
  categorie: string;
}

const DEFAULT_COMPETENCES: CompetencePix[] = [
  { id: "1", label: "Mener une recherche et une veille d'information", score: 0, categorie: "Information & données" },
  { id: "2", label: "Gérer des données", score: 0, categorie: "Information & données" },
  { id: "3", label: "Interagir", score: 0, categorie: "Communication & collaboration" },
  { id: "4", label: "S'insérer dans le monde numérique", score: 0, categorie: "Communication & collaboration" },
  { id: "5", label: "Développer des documents textuels", score: 0, categorie: "Création de contenu" },
  { id: "6", label: "Développer des documents multimedia", score: 0, categorie: "Création de contenu" },
  { id: "7", label: "Adapter les documents à leur finalité", score: 0, categorie: "Création de contenu" },
  { id: "8", label: "Sécuriser l'environnement numérique", score: 0, categorie: "Protection & sécurité" },
  { id: "9", label: "Protéger les données personnelles et la vie privée", score: 0, categorie: "Protection & sécurité" },
  { id: "10", label: "Protéger la santé, le bien-être et l'environnement", score: 0, categorie: "Protection & sécurité" },
  { id: "11", label: "Construire un environnement numérique", score: 0, categorie: "Environnement numérique" },
  { id: "12", label: "Connaître et utiliser l'e-administration", score: 0, categorie: "Environnement numérique" },
];

function RapportDiagnosticPixContent() {
  const searchParams = useSearchParams();
  const userIdFromUrl = searchParams.get("id");

  const [listeBeneficiaires, setListeBeneficiaires] = useState<any[]>([]);
  const [listeLieux, setListeLieux] = useState<any[]>([]);
  const [loadingBeneficiaires, setLoadingBeneficiaires] = useState(true);
  
  const [selectedBeneficiaireId, setSelectedBeneficiaireId] = useState<string>("");
  const [selectedLieuId, setSelectedLieuId] = useState<string>("");

  // ÉTATS HISTORIQUE ET FICHE COURANTE
  const [historiqueFiches, setHistoriqueFiches] = useState<any[]>([]);
  const [selectedFicheId, setSelectedFicheId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    lieu: "3 passage du Buisson Saint Louis, 75010 PARIS",
    dateDiagnostic: new Date().toISOString().split("T")[0],
    dateAbcPix: new Date().toISOString().split("T")[0],
    equipement: "//",
    niveauMaitrise: "niveau débutant / grand débutant",
    bonnesReponsesDiag: 0,
    totalQuestionsDiag: 44,
    tempsTest: "1h",
    nombreSujets: 42,
    resultatsThematiques: 8,
    niveauObserve: "Niveau correct",
    commentaireDiag: "questionnaire interne concernant les premières bases sur l’ordinateur.",
    commentaireObservations: "Apte à l'utilisation de l'ordinateur",
    nomMédiateur: "Colombbus"
  });

  const [competences, setCompetences] = useState<CompetencePix[]>(DEFAULT_COMPETENCES);

  // Auto-ajustement de la hauteur du texte
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [formData.commentaireDiag]);

  // Récupérer l'historique (Firestore + Fallback LocalStorage si hors ligne / dev local)
  const chargerHistoriqueFiches = async (userId: string) => {
    let docs: any[] = [];
    
    // 1. Essai Firestore
    try {
      const fichesRef = collection(db, "utilisateurs", userId, "fiches_bilan");
      const q = query(fichesRef, orderBy("dateMiseAJour", "desc"));
      const snap = await getDocs(q);
      docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.warn("Firestore non accessible, chargement depuis le LocalStorage local.");
    }

    // 2. Repli / Fusion avec LocalStorage pour le dev local
    const localData = localStorage.getItem(`fiches_bilan_${userId}`);
    if (localData) {
      try {
        const parsedLocal = JSON.parse(localData);
        // On fusionne les fiches locales si elles n'existent pas déjà
        parsedLocal.forEach((lf: any) => {
          if (!docs.some(d => d.id === lf.id)) {
            docs.push(lf);
          }
        });
      } catch (e) {
        console.error("Erreur de lecture du LocalStorage", e);
      }
    }

    docs.sort((a, b) => new Date(b.dateMiseAJour).getTime() - new Date(a.dateMiseAJour).getTime());
    setHistoriqueFiches(docs);
    return docs;
  };

  // Chargement des infos d'un bénéficiaire
  const chargerDonneesBeneficiaire = async (targetId: string, list: any[]) => {
    setSelectedBeneficiaireId(targetId);
    setSelectedFicheId("");

    const b = list.find(item => item.id === targetId);
    if (b) {
      setFormData(prev => ({
        ...prev,
        nom: b.Nom || "",
        prenom: b.Prénom || ""
      }));

      const fiches = await chargerHistoriqueFiches(targetId);

      if (fiches.length > 0) {
        appliquerFiche(fiches[0]);
      } else {
        try {
          const visitesRef = collection(db, "utilisateurs", targetId, "visites");
          const snapshot = await getDocs(visitesRef);

          const diagDoc = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(v => v.moment === "Diagnostic Initial" || v.moment === "Collecte Tech")
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

          if (diagDoc) {
            let scoreObtenu = 0;
            let totalMax = 44;

            if (diagDoc.score) {
              const parts = String(diagDoc.score).split("/");
              scoreObtenu = parseInt(parts[0].trim(), 10) || 0;
              if (parts[1]) {
                totalMax = parseInt(parts[1].trim(), 10) || totalMax;
              }
            } else if (diagDoc.satisfaction) {
              const scoreNode = typeof diagDoc.satisfaction === "object" 
                ? diagDoc.satisfaction.evaluationGlobale 
                : diagDoc.satisfaction;
              scoreObtenu = Number(scoreNode) || 0;
            }

            setFormData(prev => ({
              ...prev,
              bonnesReponsesDiag: scoreObtenu,
              totalQuestionsDiag: totalMax,
              dateDiagnostic: diagDoc.date || prev.dateDiagnostic,
              commentaireDiag: diagDoc.details || prev.commentaireDiag
            }));
          }
          setCompetences(DEFAULT_COMPETENCES);
        } catch (error) {
          console.error("Erreur lors de la récupération du diagnostic :", error);
        }
      }
    }
  };

  const appliquerFiche = (fiche: any) => {
    setSelectedFicheId(fiche.id);
    if (fiche.formData) {
      setFormData(fiche.formData);
    }
    if (fiche.competences && Array.isArray(fiche.competences)) {
      setCompetences(fiche.competences);
    }
  };

  // Sauvegarder dans Firestore + LocalStorage
  const handleSaveFiche = async () => {
    if (!selectedBeneficiaireId) {
      alert("Veuillez d'abord sélectionner un bénéficiaire.");
      return;
    }

    setSaving(true);
    const newId = selectedFicheId || `fiche_local_${Date.now()}`;
    const payload = {
      id: newId,
      formData,
      competences,
      dateMiseAJour: new Date().toISOString(),
      titre: `Bilan du ${formData.dateAbcPix || new Date().toISOString().split("T")[0]}`
    };

    // 1. Sauvegarde LocalStorage
    try {
      const localKey = `fiches_bilan_${selectedBeneficiaireId}`;
      const localExistants = JSON.parse(localStorage.getItem(localKey) || "[]");
      const index = localExistants.findIndex((f: any) => f.id === newId);
      if (index >= 0) {
        localExistants[index] = payload;
      } else {
        localExistants.push(payload);
      }
      localStorage.setItem(localKey, JSON.stringify(localExistants));
    } catch (e) {
      console.error("Erreur d'enregistrement local", e);
    }

    // 2. Sauvegarde Firestore
    try {
      const fichesRef = collection(db, "utilisateurs", selectedBeneficiaireId, "fiches_bilan");
      if (selectedFicheId && !selectedFicheId.startsWith("fiche_local_")) {
        await setDoc(doc(db, "utilisateurs", selectedBeneficiaireId, "fiches_bilan", selectedFicheId), payload, { merge: true });
      } else {
        const docAdded = await addDoc(fichesRef, payload);
        payload.id = docAdded.id;
      }
    } catch (error) {
      console.warn("Firestore non accessible, enregistrement gardé localement.", error);
    }

    setSelectedFicheId(payload.id);
    await chargerHistoriqueFiches(selectedBeneficiaireId);

    setSaveSuccess(true);
    setSaving(false);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSupprimerFiche = async (ficheId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette fiche de l'historique ?")) return;

    // Supprimer du LocalStorage
    const localKey = `fiches_bilan_${selectedBeneficiaireId}`;
    const localExistants = JSON.parse(localStorage.getItem(localKey) || "[]");
    const filtrés = localExistants.filter((f: any) => f.id !== ficheId);
    localStorage.setItem(localKey, JSON.stringify(filtrés));

    // Réactualiser l'historique
    await chargerHistoriqueFiches(selectedBeneficiaireId);
    if (selectedFicheId === ficheId) {
      setSelectedFicheId("");
    }
  };

  const handleNouvelleFiche = () => {
    setSelectedFicheId("");
    setCompetences(DEFAULT_COMPETENCES);
    setFormData(prev => ({
      ...prev,
      dateDiagnostic: new Date().toISOString().split("T")[0],
      dateAbcPix: new Date().toISOString().split("T")[0],
      bonnesReponsesDiag: 0,
      niveauObserve: "Niveau débutant",
      commentaireDiag: "",
      commentaireObservations: ""
    }));
  };

  useEffect(() => {
    const fetchBeneficiaires = async () => {
      try {
        const q = query(collection(db, "utilisateurs"), orderBy("Nom", "asc"));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setListeBeneficiaires(list);

        if (userIdFromUrl) {
          await chargerDonneesBeneficiaire(userIdFromUrl, list);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des bénéficiaires :", error);
      } finally {
        setLoadingBeneficiaires(false);
      }
    };

    fetchBeneficiaires();
  }, [userIdFromUrl]);

  useEffect(() => {
    const qLieux = query(collection(db, "liste_lieux"), where("actif", "==", true));
    const unsubLieux = onSnapshot(qLieux, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      data.sort((a, b) => (a.nomRaccourci || "").localeCompare(b.nomRaccourci || ""));
      setListeLieux(data);
    });

    return () => unsubLieux();
  }, []);

  const handleSelectBeneficiaire = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetId = e.target.value;
    if (targetId) {
      chargerDonneesBeneficiaire(targetId, listeBeneficiaires);
    } else {
      setSelectedBeneficiaireId("");
      setHistoriqueFiches([]);
      setSelectedFicheId("");
      setFormData(prev => ({ ...prev, nom: "", prenom: "" }));
    }
  };

  const handleSelectLieu = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetId = e.target.value;
    setSelectedLieuId(targetId);

    if (!targetId) return;

    const l = listeLieux.find(item => item.id === targetId);
    if (l) {
      const adresseFormatee = `${l.adresse || ""}${l.codePostal || l.localisation ? `, ${l.codePostal || ""} ${l.localisation || ""}` : ""}`.trim();
      setFormData(prev => ({
        ...prev,
        lieu: adresseFormatee || l.nomComplet || l.nomRaccourci || ""
      }));
    }
  };

  const handleCompetenceChange = (id: string, newScore: number) => {
    setCompetences(prev =>
      prev.map(c => (c.id === id ? { ...c, score: Math.min(100, Math.max(0, newScore)) } : c))
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans print:bg-white print:text-black print:p-0">
      
      {/* BARRE D'ACTIONS & SÉLECTEURS DYNAMIQUES */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 print:hidden">
        <div>
          <h1 className="text-lg font-black uppercase text-white flex items-center gap-2">
            <DocumentCheckIcon className="w-5 h-5 text-emerald-500" />
            Fiche de Diagnostic & ABC PIX
          </h1>
          <p className="text-xs text-slate-400">
            Sélectionnez un bénéficiaire et gérez l'historique de ses bilans.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          
          {/* Sélection du bénéficiaire */}
          <div className="relative flex items-center">
            <UserGroupIcon className="w-4 h-4 text-emerald-400 absolute left-3 pointer-events-none" />
            <select
              value={selectedBeneficiaireId}
              onChange={handleSelectBeneficiaire}
              disabled={loadingBeneficiaires}
              className="bg-slate-950 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="">
                {loadingBeneficiaires ? "Chargement..." : "-- Choisir un bénéficiaire --"}
              </option>
              {listeBeneficiaires.map(b => (
                <option key={b.id} value={b.id}>
                  {b.Nom ? b.Nom.toUpperCase() : "SANS NOM"} {b.Prénom || ""}
                </option>
              ))}
            </select>
          </div>

          {/* Sélection du lieu */}
          <div className="relative flex items-center">
            <BuildingOfficeIcon className="w-4 h-4 text-emerald-400 absolute left-3 pointer-events-none" />
            <select
              value={selectedLieuId}
              onChange={handleSelectLieu}
              className="bg-slate-950 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-emerald-500 transition-all cursor-pointer max-w-[160px] truncate"
            >
              <option value="">-- Lieu --</option>
              {listeLieux.map(l => (
                <option key={l.id} value={l.id}>
                  {l.nomRaccourci || l.nomComplet}
                </option>
              ))}
            </select>
          </div>

          {/* BOUTON HISTORIQUE (MODALE) */}
          {selectedBeneficiaireId && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-2 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer relative"
            >
              <ClockIcon className="w-4 h-4 text-indigo-400" />
              <span>Historique ({historiqueFiches.length})</span>
            </button>
          )}

          {/* BOUTON ENREGISTRER */}
          <button
            onClick={handleSaveFiche}
            disabled={saving || !selectedBeneficiaireId}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg ${
              saveSuccess 
                ? "bg-emerald-600 text-white" 
                : "bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
            }`}
          >
            {saveSuccess ? <CheckIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
            <span>{saving ? "Sauvegarde..." : saveSuccess ? "Enregistré !" : "Enregistrer la fiche"}</span>
          </button>

          {/* BOUTON IMPRIMER */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border border-slate-700"
          >
            <PrinterIcon className="w-4 h-4 text-emerald-400" />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* MODALE D'HISTORIQUE DE COMPÉTENCES */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase text-white flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-indigo-400" />
                Historique des fiches bilans
              </h3>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Bénéficiaire : <strong className="text-white">{formData.prenom} {formData.nom}</strong></span>
              <button
                onClick={() => {
                  handleNouvelleFiche();
                  setShowHistoryModal(false);
                }}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Nouvelle fiche vierge
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {historiqueFiches.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">Aucune fiche enregistrée pour le moment.</p>
              ) : (
                historiqueFiches.map((f) => (
                  <div 
                    key={f.id} 
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedFicheId === f.id 
                        ? "bg-indigo-950/60 border-indigo-500/80 text-white" 
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <div 
                      className="flex-1"
                      onClick={() => {
                        appliquerFiche(f);
                        setShowHistoryModal(false);
                      }}
                    >
                      <div className="text-xs font-bold flex items-center gap-2">
                        <FolderOpenIcon className="w-4 h-4 text-indigo-400" />
                        {f.titre || "Fiche Bilan"}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Mis à jour le : {new Date(f.dateMiseAJour).toLocaleString("fr-FR")}
                      </div>
                    </div>

                    <button
                      onClick={() => handleSupprimerFiche(f.id)}
                      className="text-slate-600 hover:text-rose-400 p-1.5 transition-colors"
                      title="Supprimer la fiche"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT IMPRIMABLE */}
      <div className="max-w-5xl mx-auto bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl space-y-8 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        
        {/* EN-TÊTE DU DOCUMENT AVEC LOGOS */}
        <div className="border-b-2 border-slate-800 print:border-slate-300 pb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 bg-white/95 p-2.5 rounded-2xl shadow-sm print:bg-transparent print:p-0 print:shadow-none">
            <img 
              src="/logos/colombbus.png" 
              alt="Logo Colombbus" 
              className="h-12 w-auto object-contain"
            />
            <div className="h-10 w-[1px] bg-slate-300" />
            <img 
              src="/logos/suresnes.png" 
              alt="Ville de Suresnes" 
              className="h-12 w-auto object-contain"
            />
          </div>

          <div className="text-center sm:text-right">
            <h2 className="text-2xl font-black uppercase tracking-tight text-white print:text-black">
              Bilan de Compétences Numériques
            </h2>
            <p className="text-xs text-emerald-400 print:text-emerald-700 font-bold uppercase tracking-wider mt-1">
              Diagnostic Initial & Test Final ABC PIX
            </p>
          </div>
        </div>

        {/* SECTION 1 : INFORMATIONS PARTICIPANT & LOGISTIQUE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/60 print:bg-slate-50 p-5 rounded-2xl border border-slate-800/80 print:border-slate-200">
          
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-300 print:text-slate-700">
              <UserIcon className="w-4 h-4 text-emerald-400 print:hidden" />
              <span>Participant</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600">Nom</label>
                <div className="w-full bg-slate-900/50 print:bg-transparent border border-slate-800/60 print:border-b print:border-slate-400 print:rounded-none px-2.5 py-1.5 rounded-lg text-white print:text-black font-bold uppercase min-h-[30px] flex items-center">
                  {formData.nom || "—"}
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600">Prénom</label>
                <div className="w-full bg-slate-900/50 print:bg-transparent border border-slate-800/60 print:border-b print:border-slate-400 print:rounded-none px-2.5 py-1.5 rounded-lg text-white print:text-black font-bold capitalize min-h-[30px] flex items-center">
                  {formData.prenom || "—"}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600 flex items-center gap-1">
                <MapPinIcon className="w-3 h-3 text-slate-400 print:hidden" /> Lieu d'intervention
              </label>
              <input
                type="text"
                className="w-full bg-slate-900 print:bg-transparent border border-slate-800 print:border-b print:border-slate-400 print:rounded-none px-2.5 py-1.5 rounded-lg text-slate-300 print:text-black outline-none focus:border-emerald-500"
                value={formData.lieu}
                onChange={e => setFormData({ ...formData, lieu: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-300 print:text-slate-700">
              <CalendarIcon className="w-4 h-4 text-emerald-400 print:hidden" />
              <span>Dates & Équipement</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600">Date du diagnostic</label>
                <input
                  type="date"
                  className="w-full bg-slate-900 print:bg-transparent border border-slate-800 print:border-b print:border-slate-400 print:rounded-none px-2.5 py-1.5 rounded-lg text-slate-300 print:text-black outline-none focus:border-emerald-500"
                  value={formData.dateDiagnostic}
                  onChange={e => setFormData({ ...formData, dateDiagnostic: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600">Date de l'ABC PIX</label>
                <input
                  type="date"
                  className="w-full bg-slate-900 print:bg-transparent border border-slate-800 print:border-b print:border-slate-400 print:rounded-none px-2.5 py-1.5 rounded-lg text-slate-300 print:text-black outline-none focus:border-emerald-500"
                  value={formData.dateAbcPix}
                  onChange={e => setFormData({ ...formData, dateAbcPix: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600">Équipement</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 print:bg-transparent border border-slate-800 print:border-b print:border-slate-400 print:rounded-none px-2.5 py-1.5 rounded-lg text-slate-300 print:text-black outline-none focus:border-emerald-500"
                  value={formData.equipement}
                  onChange={e => setFormData({ ...formData, equipement: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600">Maîtrise initiale</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 print:bg-transparent border border-slate-800 print:border-b print:border-slate-400 print:rounded-none px-2.5 py-1.5 rounded-lg text-slate-300 print:text-black outline-none focus:border-emerald-500"
                  value={formData.niveauMaitrise}
                  onChange={e => setFormData({ ...formData, niveauMaitrise: e.target.value })}
                />
              </div>
            </div>
          </div>

        </div>

        {/* SECTION 2 : RESULTAT DIAGNOSTIC INITIAL */}
        <div className="bg-slate-950/40 print:bg-slate-50/50 p-5 rounded-2xl border border-slate-800/60 print:border-slate-200 space-y-3">
          <h3 className="text-xs font-black uppercase text-emerald-400 print:text-emerald-800 flex items-center gap-2">
            <AcademicCapIcon className="w-4 h-4" />
            Résultat du test d’entrée - Diagnostic Initial
          </h3>
          
          <div className="flex flex-col gap-3 text-xs">
            <div className="flex items-center gap-2 bg-slate-900 print:bg-white p-3 rounded-xl border border-slate-800 print:border-slate-300 self-start">
              <span className="text-[10px] font-black uppercase text-slate-500 print:text-slate-600">Score :</span>
              <input
                type="number"
                className="w-12 bg-slate-950 print:bg-transparent border border-slate-800 print:border-b print:border-slate-400 text-center font-black text-emerald-400 print:text-black rounded py-0.5 outline-none"
                value={formData.bonnesReponsesDiag}
                onChange={e => setFormData({ ...formData, bonnesReponsesDiag: Number(e.target.value) })}
              />
              <span className="font-bold text-slate-400 print:text-slate-700">/ {formData.totalQuestionsDiag} bonnes réponses</span>
            </div>

            <textarea
              ref={textareaRef}
              className="print:hidden w-full overflow-hidden bg-slate-900 border border-slate-800 p-3 rounded-xl text-slate-300 outline-none focus:border-emerald-500 text-xs leading-relaxed resize-none transition-all"
              value={formData.commentaireDiag}
              onChange={e => setFormData({ ...formData, commentaireDiag: e.target.value })}
              placeholder="Synthèse ou remarques du diagnostic..."
            />

            <div className="hidden print:block w-full border border-slate-300 p-3 rounded-xl text-black text-xs leading-relaxed whitespace-pre-wrap">
              {formData.commentaireDiag || "Aucun commentaire."}
            </div>
          </div>
        </div>

        {/* SECTION 3 : CONTEXTE DU TEST ABC PIX */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase text-indigo-400 print:text-indigo-900 flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="w-4 h-4" />
            Résultat de l’ABC PIX - Test Final
          </h3>
          <p className="text-xs text-slate-400 print:text-slate-700">
            Réalisation d’un test sur PIX sur une campagne ABC PIX concernant la maîtrise de compétences numériques de base :
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-300 print:text-slate-800 list-disc list-inside bg-slate-950/20 print:bg-transparent p-3 rounded-xl border border-slate-800/40 print:border-none">
            <li>La connaissance des outils numériques</li>
            <li>La maîtrise de la navigation Internet</li>
            <li>Les services administratifs en ligne</li>
            <li>L’utilisation d’une messagerie électronique</li>
            <li>La création de texte & fichiers</li>
            <li>La sécurisation de sa pratique</li>
          </ul>

          <div className="flex flex-wrap items-center gap-6 text-xs bg-indigo-950/30 print:bg-indigo-50 p-3 rounded-xl border border-indigo-900/40 print:border-indigo-200">
            <div><strong className="text-slate-400 print:text-slate-600">Temps :</strong> <span className="font-bold text-white print:text-black">{formData.tempsTest}</span></div>
            <div><strong className="text-slate-400 print:text-slate-600">Sujets :</strong> <span className="font-bold text-white print:text-black">{formData.nombreSujets}</span></div>
            <div><strong className="text-slate-400 print:text-slate-600">Résultats thématiques :</strong> <span className="font-bold text-white print:text-black">{formData.resultatsThematiques}</span></div>
          </div>
        </div>

        {/* SECTION 4 : TABLEAU DES COMPÉTENCES */}
        <div className="space-y-4 pt-4 print:pt-0 print:break-before-page">
          <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-300 pb-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 print:text-black">
              Résultats de {formData.nom || "NOM"} {formData.prenom || "Prénom"}
            </h4>
            <span className="text-[10px] font-mono text-slate-500 print:text-slate-600">Compétences ({competences.length})</span>
          </div>

          <div className="space-y-3">
            {competences.map((c) => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs py-1 border-b border-slate-900/50 print:border-slate-100">
                <span className="sm:w-1/3 font-semibold text-slate-300 print:text-slate-800 text-[11px]">
                  {c.label}
                </span>

                <div className="flex-1 flex items-center gap-3">
                  <div className="w-12 text-right font-mono font-bold text-indigo-400 print:text-indigo-700 text-xs">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="w-10 bg-transparent text-right outline-none border-b border-transparent hover:border-slate-700 print:hover:border-transparent font-mono"
                      value={c.score}
                      onChange={e => handleCompetenceChange(c.id, Number(e.target.value))}
                    />%
                  </div>

                  <div className="flex-1 bg-slate-950 print:bg-slate-200 h-2.5 rounded-full overflow-hidden border border-slate-800/80 print:border-none">
                    <div
                      className="bg-indigo-600 print:bg-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 5 : OBSERVATIONS ET SIGNATURE */}
        <div className="space-y-4 pt-4 border-t-2 border-slate-800 print:border-slate-300">
          <h3 className="text-xs font-black uppercase text-amber-400 print:text-amber-800 flex items-center gap-2">
            <PencilSquareIcon className="w-4 h-4" />
            OBSERVATIONS à compléter par le / la médiateur.rice Colombbus
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600 mb-1">Niveau observé</label>
              <input
                type="text"
                className="w-full bg-slate-950 print:bg-transparent border border-slate-800 print:border-b print:border-slate-400 px-3 py-2 rounded-xl text-amber-300 print:text-black font-bold outline-none focus:border-amber-500"
                value={formData.niveauObserve}
                onChange={e => setFormData({ ...formData, niveauObserve: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 print:text-slate-600 mb-1">Commentaires</label>
              <textarea
                rows={2}
                className="w-full bg-slate-950 print:bg-transparent border border-slate-800 print:border-b print:border-slate-400 px-3 py-2 rounded-xl text-slate-300 print:text-black outline-none focus:border-amber-500 resize-none"
                value={formData.commentaireObservations}
                onChange={e => setFormData({ ...formData, commentaireObservations: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-8 flex justify-end">
            <div className="w-64 text-right space-y-12">
              <p className="text-xs font-bold text-slate-400 print:text-slate-800">
                Signature du médiateur.rice {formData.nomMédiateur} :
              </p>
              <div className="border-b border-dashed border-slate-700 print:border-slate-400 h-8" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function RapportDiagnosticPix() {
  return (
    <Suspense fallback={<div className="p-8 text-white text-center">Chargement du rapport...</div>}>
      <RapportDiagnosticPixContent />
    </Suspense>
  );
}
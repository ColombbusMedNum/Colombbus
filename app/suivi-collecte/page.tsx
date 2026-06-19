"use client";

import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { ChevronLeftIcon, ArrowDownTrayIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

interface BeneficiaireCollecte {
  id: string;
  annee: string; // Nouvelle propriété pour l'année
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  // Les étapes de suivi (cases à cocher)
  creationDossier: boolean;
  testEntreeForm: boolean;
  testSortiePix: boolean;
  remiseAttestation: boolean;
  devis: boolean;
  facture: boolean;
  dechargeMateriel: boolean;
  scanArchivage: boolean;
  commentaires: string;
}

export default function SuiviCollecteTech() {
  const [beneficiaires, setBeneficiaires] = useState<BeneficiaireCollecte[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentValue, setCommentValue] = useState("");

  useEffect(() => {
    // Lecture en temps réel de la collection principale des bénéficiaires
    const unsub = onSnapshot(collection(db, "utilisateurs"), (snapshot) => {
      const liste: BeneficiaireCollecte[] = [];
      
      snapshot.docs.forEach((d) => {
        const data = d.data();
        
        // Extraction de l'année (basée sur Date_Adhesion, ou un champ custom, ou fallback 2026)
        let anneeExtraite = "2026";
        if (data.anneeCollecte) {
          anneeExtraite = data.anneeCollecte;
        } else if (data.Date_Adhesion) {
          // Si Date_Adhesion est une chaîne du type "YYYY-MM-DD" ou contient une année
          const match = data.Date_Adhesion.match(/\d{4}/);
          if (match) anneeExtraite = match[0];
        }
        
        liste.push({
          id: d.id,
          annee: anneeExtraite,
          nom: data.Nom || "—",
          prenom: data.Prénom || "—",
          telephone: data.Téléphone || data.telephone || "—",
          email: data.email || data.Email || "—",
          
          creationDossier: !!data.creationDossier,
          testEntreeForm: !!data.testEntreeForm,
          testSortiePix: !!data.testSortiePix,
          remiseAttestation: !!data.remiseAttestation,
          devis: !!data.devis,
          facture: !!data.facture,
          dechargeMateriel: !!data.dechargeMateriel,
          scanArchivage: !!data.scanArchivage,
          commentaires: data.commentairesCollecte || ""
        });
      });

      // Tri par Nom de famille
      liste.sort((a, b) => a.nom.localeCompare(b.nom));
      setBeneficiaires(liste);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Changer l'année manuellement et enregistrer dans Firestore
  const handleAnneeChange = async (id: string, nouvelleAnnee: string) => {
    try {
      await updateDoc(doc(db, "utilisateurs", id), {
        anneeCollecte: nouvelleAnnee
      });
    } catch (err) {
      console.error("Erreur mise à jour de l'année:", err);
    }
  };

  // Inverser l'état d'une case à cocher et sauvegarder dans Firestore
  const handleToggleStep = async (id: string, field: keyof BeneficiaireCollecte, currentVal: boolean) => {
    try {
      await updateDoc(doc(db, "utilisateurs", id), {
        [field]: !currentVal
      });
    } catch (err) {
      console.error("Erreur mise à jour étape:", err);
    }
  };

  // Sauvegarder le commentaire à la perte de focus ou Entrée
  const handleSaveComment = async (id: string) => {
    try {
      await updateDoc(doc(db, "utilisateurs", id), {
        commentairesCollecte: commentValue
      });
      setEditingCommentId(null);
    } catch (err) {
      console.error("Erreur enregistrement commentaire:", err);
    }
  };

  // Export CSV identique aux colonnes de l'Excel avec l'Année
  const exportToCSV = () => {
    if (beneficiaires.length === 0) return;
    const headers = ["Année;Nom;Prénom;Numéro de téléphone personnel;Mail contact;Création Dossier DRIVE;Test entrée Google Form;Test sortie PIX (ABC PIX);Remise de l'attestation compétences;Devis;Facture;Décharge matériel;Scan et archivage;Commentaires\n"];
    const rows = beneficiaires.map(b => 
      `${b.annee};${b.nom};${b.prenom};${b.telephone};${b.email};${b.creationDossier?'X':''};${b.testEntreeForm?'X':''};${b.testSortiePix?'X':''};${b.remiseAttestation?'X':''};${b.devis?'X':''};${b.facture?'X':''};${b.dechargeMateriel?'X':''};${b.scanArchivage?'X':''};${b.commentaires.replace(/\n/g, " ")}`
    );
    const blob = new Blob([headers + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `suivi_collecte_tech_${new Date().toLocaleDateString('fr-FR')}.csv`);
    link.click();
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 md:p-6 font-sans selection:bg-purple-500/30">
      <div className="w-full max-w-[1600px] mx-auto">
        
        {/* BARRE HAUTE */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-slate-900 pb-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest mb-1 transition-colors">
              <ChevronLeftIcon className="w-3.5 h-3.5" /> Tableau de bord
            </Link>
            <h1 className="text-lg md:text-xl font-black uppercase text-white tracking-tight">
              Suivi <span className="bg-gradient-to-r from-teal-400 to-emerald-500 bg-clip-text text-transparent">IdF — Suresnes / Paris</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Tableau opérationnel calqué sur le modèle de suivi d'activité</p>
          </div>

          <button 
            onClick={exportToCSV}
            disabled={beneficiaires.length === 0}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-lg cursor-pointer"
          >
            <ArrowDownTrayIcon className="w-4 h-4 text-emerald-400" />
            <span>Exporter au format Excel</span>
          </button>
        </div>

        {/* AFFICHAGE DE LA GRILLE TYPE EXCEL */}
        {loading ? (
          <div className="text-center py-24 text-emerald-400 font-bold tracking-widest animate-pulse uppercase text-xs">Chargement de la base...</div>
        ) : beneficiaires.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-900 rounded-2xl bg-slate-950/20 max-w-4xl mx-auto">
            <UserGroupIcon className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-xs font-mono">Aucun bénéficiaire répertorié pour le moment.</p>
          </div>
        ) : (
          <div className="w-full bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed min-w-[1500px]">
                <thead>
                  <tr className="bg-slate-900/60 text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                    {/* NOUVELLE COLONNE DATE (ANNÉE UNIQUE) */}
                    <th className="p-3 w-24 pl-5">Année</th>
                    <th className="p-3 w-40">Nom</th>
                    <th className="p-3 w-40">Prénom</th>
                    <th className="p-3 w-44">Téléphone personnel</th>
                    <th className="p-3 w-52">Mail contact</th>
                    
                    <th className="p-2 w-28 text-center text-[9px] bg-teal-950/20 border-l border-slate-900">Création Dossier DRIVE</th>
                    <th className="p-2 w-24 text-center text-[9px] bg-teal-950/20">Test entrée Google Form</th>
                    <th className="p-2 w-24 text-center text-[9px] bg-teal-950/20">Test sortie PIX</th>
                    <th className="p-2 w-24 text-center text-[9px] bg-teal-950/20">Remise Attestation</th>
                    <th className="p-2 w-20 text-center text-[9px] bg-orange-950/20 border-l border-slate-900">Devis</th>
                    <th className="p-2 w-20 text-center text-[9px] bg-teal-950/20 border-l border-slate-900">Facture</th>
                    <th className="p-2 w-24 text-center text-[9px] bg-teal-950/20">Décharge matériel</th>
                    <th className="p-2 w-24 text-center text-[9px] bg-teal-950/20">Scan & Archivage</th>
                    
                    <th className="p-3 w-80 border-l border-slate-900">Commentaires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-[12px] text-slate-300 font-medium">
                  {beneficiaires.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-900/30 transition-colors group">
                      
                      {/* CELLULE ANNÉE (Modifiable via un sélecteur discret pour rester propre) */}
                      <td className="p-3 pl-5 font-mono text-xs text-slate-400">
                        <select
                          value={b.annee}
                          onChange={(e) => handleAnneeChange(b.id, e.target.value)}
                          className="bg-slate-900/80 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-[11px] font-mono outline-none focus:border-teal-500 cursor-pointer"
                        >
                          <option value="2024">2024</option>
                          <option value="2025">2025</option>
                          <option value="2026">2026</option>
                          <option value="2027">2027</option>
                        </select>
                      </td>

                      <td className="p-3 font-bold text-teal-400 uppercase truncate">
                        <Link href={`/liste-beneficiaires/${b.id}`} className="hover:underline">
                          {b.nom}
                        </Link>
                      </td>
                      <td className="p-3 text-white truncate">{b.prenom}</td>
                      <td className="p-3 text-slate-400 font-mono text-xs">{b.telephone}</td>
                      <td className="p-3 text-slate-400 truncate text-xs">{b.email}</td>
                      
                      {[
                        { field: "creationDossier", color: "accent-teal-500", bg: "bg-teal-950/10" },
                        { field: "testEntreeForm", color: "accent-teal-500", bg: "bg-teal-950/10" },
                        { field: "testSortiePix", color: "accent-teal-500", bg: "bg-teal-950/10" },
                        { field: "remiseAttestation", color: "accent-teal-500", bg: "bg-teal-950/10" },
                        { field: "devis", color: "accent-orange-500", bg: "bg-orange-950/10" },
                        { field: "facture", color: "accent-teal-500", bg: "bg-teal-950/10" },
                        { field: "dechargeMateriel", color: "accent-teal-500", bg: "bg-teal-950/10" },
                        { field: "scanArchivage", color: "accent-teal-500", bg: "bg-teal-950/10" }
                      ].map((cell) => {
                        const isChecked = b[cell.field as keyof BeneficiaireCollecte] as boolean;
                        return (
                          <td 
                            key={cell.field} 
                            className={`p-2 text-center border-l border-slate-900/60 ${cell.bg} ${isChecked ? 'bg-emerald-500/5' : ''}`}
                          >
                            <label className="flex items-center justify-center w-full h-full cursor-pointer py-1">
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleStep(b.id, cell.field as keyof BeneficiaireCollecte, isChecked)}
                                className={`w-4 h-4 rounded border-slate-800 bg-slate-950 ${cell.color} transition-all cursor-pointer`}
                              />
                            </label>
                          </td>
                        );
                      })}

                      <td className="p-2 border-l border-slate-900 text-[11px]" onClick={() => {
                        if (editingCommentId !== b.id) {
                          setEditingCommentId(b.id);
                          setCommentValue(b.commentaires);
                        }
                      }}>
                        {editingCommentId === b.id ? (
                          <textarea
                            autoFocus
                            value={commentValue}
                            onChange={(e) => setCommentValue(e.target.value)}
                            onBlur={() => handleSaveComment(b.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveComment(b.id);
                              }
                            }}
                            className="w-full bg-black border border-slate-700 text-white rounded p-2 text-[11px] outline-none min-h-[80px] font-mono focus:border-teal-500 resize-y"
                            placeholder="Ex: 23/02/2026 : Test pix fait..."
                          />
                        ) : (
                          <div className="w-full h-full min-h-[32px] cursor-pointer text-slate-400 font-sans whitespace-pre-wrap break-words hover:text-white transition-colors p-1" title="Cliquez pour modifier ou ajouter une ligne">
                            {b.commentaires || <span className="text-slate-700 font-light italic">Ajouter une note...</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-900/40 border-t border-slate-900 flex justify-end text-[10px] uppercase font-black text-slate-500 tracking-wider">
              Bénéficiaires suivis dans la liste : <span className="text-teal-400 ml-1.5 font-mono text-xs">{beneficiaires.length}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
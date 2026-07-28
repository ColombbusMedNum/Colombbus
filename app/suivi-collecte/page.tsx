"use client";

import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, doc, updateDoc, getDocs, addDoc } from "firebase/firestore";
import { ChevronLeftIcon, ArrowDownTrayIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

interface BeneficiaireCollecte {
  id: string;
  annee: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
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
    setLoading(true);

    // Écoute en temps réel de la liste globale des usagers
    const unsubUsers = onSnapshot(collection(db, "utilisateurs"), async (snapshot) => {
      try {
        const listeTemporaire: BeneficiaireCollecte[] = [];

        // Traitement séquentiel ou parallèle sécurisé pour chaque usager
        const promises = snapshot.docs.map(async (userDoc) => {
          const userData = userDoc.data();
          let associeACollecte = false;

          // 1. Vérification dans la sous-collection générique d'historique (actions / rendezvous / visites)
          const sousCollectionsPossibles = ["actions", "rendezvous", "visites"];
          
          for (const nomColl of sousCollectionsPossibles) {
            if (associeACollecte) break;
            try {
              const subSnap = await getDocs(collection(db, "utilisateurs", userDoc.id, nomColl));
              
              // On parcourt les actions enregistrées pour voir si l'une d'elles correspond au lieu recherché
              subSnap.docs.forEach((subDoc) => {
                const subData = subDoc.data();
                const lieu = subData.Lieu_RDV || subData.lieuRDV || subData.lieu || subData.lieu_rencontre || "";
                if (lieu.trim() === "92 - Collecte Tech") {
                  associeACollecte = true;
                }
              });
            } catch (err) {
              // Ignore les sous-collections inexistantes pour cet usager
            }
          }

          // 2. Si l'utilisateur possède une action liée, on construit sa ligne Excel
          if (associeACollecte) {
            let anneeExtraite = "2026";
            if (userData.anneeCollecte) {
              anneeExtraite = userData.anneeCollecte;
            } else if (userData.Date_Adhesion) {
              const match = userData.Date_Adhesion.match(/\d{4}/);
              if (match) anneeExtraite = match[0];
            }

            listeTemporaire.push({
              id: userDoc.id,
              annee: anneeExtraite,
              nom: userData.Nom || "—",
              prenom: userData.Prénom || "—",
              telephone: userData.Téléphone || userData.telephone || "—",
              email: userData.email || userData.Email || "—",
              creationDossier: !!userData.creationDossier,
              testEntreeForm: !!userData.testEntreeForm,
              testSortiePix: !!userData.testSortiePix,
              remiseAttestation: !!userData.remiseAttestation,
              devis: !!userData.devis,
              facture: !!userData.facture,
              dechargeMateriel: !!userData.dechargeMateriel,
              scanArchivage: !!userData.scanArchivage,
              commentaires: userData.commentairesCollecte || ""
            });
          }
        });

        await Promise.all(promises);

        // Tri final par ordre alphabétique
        listeTemporaire.sort((a, b) => a.nom.localeCompare(b.nom));
        setBeneficiaires(listeTemporaire);
      } catch (error) {
        console.error("Erreur lors du traitement des actions :", error);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Erreur d'écoute utilisateurs :", error);
      setLoading(false);
    });

    return () => unsubUsers();
  }, []);

  const handleAnneeChange = async (id: string, nouvelleAnnee: string) => {
    try {
      await updateDoc(doc(db, "utilisateurs", id), { anneeCollecte: nouvelleAnnee });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStep = async (id: string, field: keyof BeneficiaireCollecte, currentVal: boolean) => {
    const newVal = !currentVal;

    try {
      // 1. Mise à jour de l'état dans Firestore
      await updateDoc(doc(db, "utilisateurs", id), { [field]: newVal });

      // 2. Traitement si la case "devis" passe à true
      if (field === "devis" && newVal) {
        const beneficiaire = beneficiaires.find((b) => b.id === id);

        if (beneficiaire) {
          const dateJour = new Date().toLocaleDateString("fr-FR");
          const messageNotif = `📄 Demande de devis : La case devis a été cochée pour ${beneficiaire.prenom} ${beneficiaire.nom} (Tel: ${beneficiaire.telephone} / Email: ${beneficiaire.email}).`;

          // A. Ajout dans la collection "notifications" de l'application
          await addDoc(collection(db, "notifications"), {
            message: messageNotif,
            createdAt: Date.now(),
            lue: false,
            destinataireEmail: "ct92-mednum@colombbus.org",
            type: "devis_collecte"
          });

          // B. Envoi d'un email en arrière-plan via l'API interne
          fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: "ct92-mednum@colombbus.org",
              subject: `[Collecte Tech] Demande de devis - ${beneficiaire.prenom} ${beneficiaire.nom}`,
              text: `Bonjour,\n\nLa case 'Devis' a été cochée le ${dateJour} pour le bénéficiaire suivant :\n\n- Nom : ${beneficiaire.nom}\n- Prénom : ${beneficiaire.prenom}\n- Téléphone : ${beneficiaire.telephone}\n- Email : ${beneficiaire.email}\n- Année : ${beneficiaire.annee}\n\nMerci de prendre en charge cette demande.`
            })
          }).catch((err) => console.error("Erreur d'envoi d'email :", err));
        }
      }
    } catch (err) {
      console.error("Erreur lors de la mise à jour :", err);
    }
  };

  const handleSaveComment = async (id: string) => {
    try {
      await updateDoc(doc(db, "utilisateurs", id), { commentairesCollecte: commentValue });
      setEditingCommentId(null);
    } catch (err) {
      console.error(err);
    }
  };

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
              Suivi <span className="bg-gradient-to-r from-teal-400 to-emerald-500 bg-clip-text text-transparent">IdF — 92 Collecte Tech</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Tableau opérationnel filtré exclusivement sur la Collecte Tech (92)</p>
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

        {/* AFFICHAGE DE LA GRILLE */}
        {loading ? (
          <div className="text-center py-24 text-emerald-400 font-bold tracking-widest animate-pulse uppercase text-xs">Analyse des actions en cours...</div>
        ) : beneficiaires.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-900 rounded-2xl bg-slate-950/20 max-w-4xl mx-auto">
            <UserGroupIcon className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-xs font-mono">Aucun bénéficiaire avec une action enregistrée à "92 - Collecte Tech".</p>
          </div>
        ) : (
          <div className="w-full bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed min-w-[1500px]">
                <thead>
                  <tr className="bg-slate-900/60 text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 tracking-wider">
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
                          />
                        ) : (
                          <div className="w-full h-full min-h-[32px] cursor-pointer text-slate-400 font-sans whitespace-pre-wrap break-words hover:text-white transition-colors p-1">
                            {b.commentaires || <span className="text-slate-700 font-light italic">Ajouter une note...</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
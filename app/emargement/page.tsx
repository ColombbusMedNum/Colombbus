"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { PrinterIcon, BookOpenIcon, SquaresPlusIcon, PlusIcon, MinusIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function GenerateurEmargementPagesIdentiques() {
  const [logosBank, setLogosBank] = useState<any[]>([]);
  const [selectedLogos, setSelectedLogos] = useState<string[]>([]);
  const [nbLignesVoulues, setNbLignesVoulues] = useState<number>(12);
  
  const [form, setForm] = useState({
    intitule: "Café numérique",
    thematique: "",
    date: "",
    lieu: "",
    intervenantNom: "",
    horaires: ""
  });

  // 1. Récupération des logos de la bibliothèque Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "logos_emargement"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogosBank(list);

      const colombbus = list.find(l => l.nom.toLowerCase().includes("colombbus"));
      if (colombbus) setSelectedLogos([colombbus.url]);
    });
    return () => unsub();
  }, []);

  const toggleLogo = (url: string) => {
    setSelectedLogos(prev => 
      prev.includes(url) ? prev.filter(item => item !== url) : [...prev, url]
    );
  };

  // --- LOGIQUE DE DÉCOUPAGE EN PAGES ---
  const nbPages = Math.ceil(nbLignesVoulues / 12);
  const pagesIndices = Array.from({ length: nbPages }, (_, i) => i);

  // --- LOGIQUE DE POSITIONNEMENT DES LOGOS (CENTRÉS SI 1 OU 2) ---
  const nbLogos = selectedLogos.length;
  let alignementClasse = "justify-center gap-12"; 
  if (nbLogos >= 3) alignementClasse = "justify-around gap-6";

  let tailleClasse = "h-12 max-w-[140px]";
  if (nbLogos === 1) tailleClasse = "h-20 max-w-[240px]";
  if (nbLogos === 2) tailleClasse = "h-16 max-w-[180px]";

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto">
        
        {/* =========================================================
            PANNEAU DE CONFIGURATION (MASQUÉ À L'IMPRESSION)
            ========================================================= */}
        <div className="print:hidden mb-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-4">
              {/* BOUTON RETOUR DASHBOARD */}
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all shadow-md active:scale-95 text-xs font-bold uppercase tracking-wider"
                title="Retour au Dashboard"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                <span>Retour</span>
              </Link>
              
              <div>
                <h1 className="text-lg font-black text-white uppercase italic tracking-tight flex items-center gap-2">
                  <SquaresPlusIcon className="w-5 h-5 text-blue-500" />
                  Générateur d'Émargement
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">Pages identiques auto-générées</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Link href="/bibliotheque-logos" className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all">
                <BookOpenIcon className="w-4 h-4" /> Bibliothèque
              </Link>
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg">
                <PrinterIcon className="w-4 h-4" /> Imprimer {nbPages} page(s)
              </button>
            </div>
          </div>

          {/* SAISIE DES DONNÉES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {["intitule", "thematique", "date", "lieu", "intervenantNom", "horaires"].map((field) => (
              <div key={field}>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">{field}</label>
                <input 
                  type="text" 
                  value={(form as any)[field]} 
                  onChange={e => setForm({...form, [field]: e.target.value})} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500" 
                />
              </div>
            ))}
          </div>

          {/* RÉGLAGE DU NOMBRE DE BÉNÉFICIAIRES */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div className="text-xs font-bold">
              Nombre de bénéficiaires : <span className="text-blue-400">{nbLignesVoulues}</span>
              <div className="text-[10px] text-slate-500 font-normal uppercase mt-1">Générera {nbPages} page(s) complète(s)</div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setNbLignesVoulues(prev => Math.max(1, prev - 1))} className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800"><MinusIcon className="w-4 h-4"/></button>
              <button onClick={() => setNbLignesVoulues(prev => prev + 1)} className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800"><PlusIcon className="w-4 h-4"/></button>
            </div>
          </div>

          {/* SÉLECTION DES LOGOS */}
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-3">Sélectionnez les logos :</label>
            <div className="flex flex-wrap gap-3">
              {logosBank.map(logo => {
                const active = selectedLogos.includes(logo.url);
                return (
                  <button
                    key={logo.id}
                    onClick={() => toggleLogo(logo.url)}
                    className={`flex flex-col items-center p-2 border rounded-xl transition-all h-24 w-24 bg-white ${active ? 'ring-4 ring-blue-500 border-transparent shadow-md' : 'opacity-30 grayscale border-slate-200'}`}
                  >
                    <img src={logo.url} alt={logo.nom} className="h-12 w-full object-contain mb-1" />
                    <span className="text-[8px] font-bold text-black uppercase truncate w-full text-center">{logo.nom}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* =========================================================
            ZONE D'IMPRESSION : GÉNÉRATION DES PAGES IDENTIQUES
            ========================================================= */}
        <div className="flex flex-col gap-8 print:gap-0">
          {pagesIndices.map((pageIdx) => (
            <div key={pageIdx} className="bg-white text-black p-[1.8cm] font-sans shadow-2xl print:shadow-none print:p-0 print:bg-transparent min-h-[29.7cm] w-full mx-auto overflow-hidden flex flex-col page-break">
              
              {/* 1. BANDEAU LOGOS */}
              {nbLogos > 0 && (
                <div className={`flex items-center ${alignementClasse} mb-12 min-h-[2.4cm] w-full border-b border-gray-100 pb-4`}>
                  {logosBank.filter(l => selectedLogos.includes(l.url)).map((logo, idx) => (
                    <img key={idx} src={logo.url} alt={logo.nom} className={`${tailleClasse} object-contain transition-all`} />
                  ))}
                </div>
              )}

              {/* 2. TITRE */}
              <h1 className="text-xl font-bold text-center tracking-[0.15em] mb-10 uppercase">FEUILLE D’ÉMARGEMENT</h1>

              {/* 3. BLOC INFOS */}
              <div className="text-[13px] space-y-2 mb-10 pl-20">
                {[
                  { label: "intitulé", val: form.intitule, bg: "bg-amber-50/70" },
                  { label: "Thématique", val: form.thematique, bg: "bg-amber-50/30" },
                  { label: "date", val: form.date, bg: "bg-amber-50/30" },
                  { label: "lieu", val: form.lieu, bg: "bg-amber-50/30" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center">
                    <span className="w-24 text-right text-gray-400 pr-4 font-light italic text-xs">{item.label}</span>
                    <span className={`${item.bg} px-3 py-1 font-bold min-w-[220px] rounded-sm min-h-[26px] flex items-center`}>{item.val}</span>
                  </div>
                ))}
              </div>

              {/* 4. TABLEAU (SANS ERREUR HYDRATATION) */}
              <table className="w-full border-collapse border border-black text-[12px] table-fixed">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[35%]" />
                  <col className="w-[35%]" />
                  <col className="w-[25%]" />
                </colgroup>
                
                <tbody>
                  {/* BLOC INTERVENANT */}
                  <tr>
                    <td colSpan={2} rowSpan={4} className="border border-black p-4 text-center align-middle text-gray-500 font-light text-sm">Intervenant</td>
                    <td className="border border-black p-2 text-gray-500 text-center">Structure</td>
                    <td className="border border-black p-2 text-left pl-6 font-bold uppercase text-gray-700">Colombbus</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 text-gray-500 text-center">Prénom Nom</td>
                    <td className="border border-black p-2 text-left pl-6 font-medium text-black">{form.intervenantNom}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 text-gray-500 text-center h-12">Signature</td>
                    <td className="border border-black p-2"></td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 text-gray-500 text-center">Horaires</td>
                    <td className="border border-black p-2 text-left pl-6 font-medium text-black">{form.horaires}</td>
                  </tr>

                  {/* EN-TÊTE BENEFICIAIRES */}
                  <tr className="bg-gray-50/60 font-bold text-center">
                    <td className="border border-black p-2 text-center">#</td>
                    <td className="border border-black p-2 uppercase tracking-wider text-left pl-4">NOM</td>
                    <td className="border border-black p-2 text-left pl-4">Prénom</td>
                    <td className="border border-black p-2 text-center">Signatures</td>
                  </tr>

                  {/* LES 12 LIGNES DE LA PAGE ACTUELLE */}
                  {Array.from({ length: 12 }).map((_, i) => {
                    const numeroLigne = (pageIdx * 12) + (i + 1);
                    return (
                      <tr key={i} className="h-11">
                        <td className="border border-black p-2 text-center text-gray-400 font-light">{numeroLigne}</td>
                        <td className="border border-black p-2"></td>
                        <td className="border border-black p-2"></td>
                        <td className="border border-black p-2"></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* 5. PIED DE PAGE */}
              <footer className="text-center text-[10px] text-gray-400 border-t border-gray-100 pt-4 mt-auto">
                Association COLOMBBUS — 10 rue du Terrage 75010 Paris — Page {pageIdx + 1} / {nbPages}
              </footer>
            </div>
          ))}
        </div>
      </div>

      {/* Règle d'or pour l'imprimante */}
      <style jsx global>{`
        @media print {
          .page-break { 
            display: block;
            page-break-after: always; 
            break-after: page;
          }
          tr { break-inside: avoid; }
        }
      `}</style>
    </main>
  );
}
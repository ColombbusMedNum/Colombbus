"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { PrinterIcon, BookOpenIcon, SquaresPlusIcon, PlusIcon, MinusIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import PageGuard from "@/components/PageGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

interface LogoEmargement {
  id: string;
  nom: string;
  url: string;
}

export default function GenerateurEmargementPagesIdentiques() {
  const [logosBank, setLogosBank] = useState<LogoEmargement[]>([]);
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

  // 1. Récupération des logos de la bibliothèque Firestore. Chargement
  // unique : cette bibliothèque change rarement (upload manuel), pas besoin
  // d'une écoute temps réel permanente sur cette page.
  useEffect(() => {
    getDocs(collection(db, "logos_emargement")).then((snap) => {
      const list: LogoEmargement[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as LogoEmargement));
      setLogosBank(list);

      const colombbus = list.find(l => l.nom.toLowerCase().includes("colombbus"));
      if (colombbus) setSelectedLogos([colombbus.url]);
    });
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

  let tailleClasse = "h-16 max-w-[240px]"; // S'il y a 3 logos ou plus
  if (nbLogos === 1) tailleClasse = "h-28 max-w-[320px]"; // S'il est tout seul
  if (nbLogos === 2) tailleClasse = "h-24 max-w-[240px]"; // S'ils sont deux

  const inputStyle = "w-full bg-[#F3F3F2] text-[#404040] border border-[#404040]/15 text-xs font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#005259] transition-all";

  return (
    <PageGuard pageId="page_access_emargement">
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased print:bg-white print:text-black print:p-0 relative overflow-hidden`}>

      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none print:hidden"></div>

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        
        {/* =========================================================
            PANNEAU DE CONFIGURATION (MASQUÉ À L'IMPRESSION)
            ========================================================= */}
        <div className="print:hidden mb-8 bg-white border border-[#404040]/10 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center flex-wrap gap-4 border-b border-[#404040]/10 pb-4">
            <div className="flex items-center gap-4">
              {/* BOUTON RETOUR DASHBOARD */}
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-[#F3F3F2] hover:bg-[#005259] hover:text-white border border-[#404040]/15 rounded-xl text-[#005259] transition-all shadow-sm active:scale-95 text-xs font-bold uppercase tracking-wider"
                title="Retour au Dashboard"
              >
                <ArrowLeftIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Retour</span>
              </Link>
              
              <div>
                <h1 className="text-lg font-extrabold uppercase text-[#005259] tracking-tight flex items-center gap-2">
                  <SquaresPlusIcon className="w-5 h-5 text-[#EA601F]" />
                  Générateur d'Émargement
                </h1>
                <p className="text-[#404040]/70 text-xs mt-0.5">Pages identiques auto-générées</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Link 
                href="/mediation/bibliotheque-logos" 
                className="inline-flex items-center gap-2 bg-[#F3F3F2] hover:bg-[#005259] hover:text-white border border-[#404040]/15 text-[#005259] px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <BookOpenIcon className="w-4 h-4 text-[#EA601F]" /> Bibliothèque
              </Link>
              <button 
                onClick={() => window.print()} 
                className="inline-flex items-center gap-2 bg-[#EA601F] hover:bg-[#005259] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
              >
                <PrinterIcon className="w-4 h-4" /> Imprimer {nbPages} page(s)
              </button>
            </div>
          </div>

          {/* SAISIE DES DONNÉES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {["intitule", "thematique", "date", "lieu", "intervenantNom", "horaires"].map((field) => (
              <div key={field}>
                <label className="block text-[10px] font-bold uppercase text-[#005259] mb-1">{field}</label>
                <input 
                  type="text" 
                  value={(form as any)[field]} 
                  onChange={e => setForm({...form, [field]: e.target.value})} 
                  className={inputStyle} 
                />
              </div>
            ))}
          </div>

          {/* RÉGLAGE DU NOMBRE DE BÉNÉFICIAIRES */}
          <div className="bg-[#F3F3F2] border border-[#404040]/10 p-4 rounded-2xl flex items-center justify-between">
            <div className="text-xs font-bold text-[#005259]">
              Nombre de bénéficiaires : <span className="text-[#EA601F] font-extrabold">{nbLignesVoulues}</span>
              <div className="text-[10px] text-[#404040]/70 font-normal uppercase mt-1">Générera {nbPages} page(s) complète(s)</div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setNbLignesVoulues(prev => Math.max(1, prev - 1))} 
                className="p-2 bg-white border border-[#404040]/15 rounded-xl hover:bg-[#005259] hover:text-white text-[#005259] transition-all shadow-sm"
              >
                <MinusIcon className="w-4 h-4"/>
              </button>
              <button 
                onClick={() => setNbLignesVoulues(prev => prev + 1)} 
                className="p-2 bg-white border border-[#404040]/15 rounded-xl hover:bg-[#005259] hover:text-white text-[#005259] transition-all shadow-sm"
              >
                <PlusIcon className="w-4 h-4"/>
              </button>
            </div>
          </div>

          {/* SÉLECTION DES LOGOS */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#005259] mb-3">Sélectionnez les logos :</label>
            <div className="flex flex-wrap gap-3">
              {logosBank.map(logo => {
                const active = selectedLogos.includes(logo.url);
                return (
                  <button
                    key={logo.id}
                    onClick={() => toggleLogo(logo.url)}
                    className={`flex flex-col items-center p-2 border rounded-xl transition-all h-24 w-24 bg-white cursor-pointer ${
                      active ? 'ring-2 ring-[#EA601F] border-transparent shadow-sm scale-105' : 'opacity-40 grayscale border-[#404040]/20 hover:opacity-70'
                    }`}
                  >
                    <img src={logo.url} alt={logo.nom} className="h-12 w-full object-contain mb-1" />
                    <span className="text-[8px] font-bold text-[#404040] uppercase truncate w-full text-center">{logo.nom}</span>
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
            <div key={pageIdx} className="bg-white text-black p-[1.8cm] font-sans shadow-sm print:shadow-none print:p-0 print:bg-transparent min-h-[29.7cm] w-full mx-auto overflow-hidden flex flex-col page-break rounded-2xl print:rounded-none">
              
              {/* 1. BANDEAU LOGOS */}
              {nbLogos > 0 && (
                <div className={`flex items-center ${alignementClasse} mb-12 min-h-[2.4cm] w-full border-b border-gray-100 pb-4`}>
                  {logosBank.filter(l => selectedLogos.includes(l.url)).map((logo, idx) => (
                    <img key={idx} src={logo.url} alt={logo.nom} className={`${tailleClasse} object-contain transition-all`} />
                  ))}
                </div>
              )}

              {/* 2. TITRE */}
              <h1 className="text-xl font-bold text-center tracking-[0.15em] mb-10 uppercase text-gray-800">FEUILLE D’ÉMARGEMENT</h1>

              {/* 3. BLOC INFOS */}
              <div className="text-[13px] space-y-2 mb-10 pl-20">
                {[
                  { label: "intitulé", val: form.intitule, bg: "bg-orange-50/60" },
                  { label: "Thématique", val: form.thematique, bg: "bg-gray-50" },
                  { label: "date", val: form.date, bg: "bg-gray-50" },
                  { label: "lieu", val: form.lieu, bg: "bg-gray-50" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center">
                    <span className="w-24 text-right text-gray-400 pr-4 font-light italic text-xs">{item.label}</span>
                    <span className={`${item.bg} px-3 py-1 font-bold min-w-[220px] rounded-sm min-h-[26px] flex items-center`}>{item.val}</span>
                  </div>
                ))}
              </div>

              {/* 4. TABLEAU */}
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
                  <tr className="bg-gray-50/80 font-bold text-center">
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
    </PageGuard>
  );
}
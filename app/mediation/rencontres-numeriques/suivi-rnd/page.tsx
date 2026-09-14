"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import PageGuard from "@/components/PageGuard";
import { lireNom, lirePrenom, lireTelephone, formaterTelephone } from "@/lib/beneficiaireFields";
import { calculerAge } from "@/lib/dateNaissance";
import {
  HomeIcon,
  HomeModernIcon,
  TableCellsIcon,
  Squares2X2Icon,
  PhoneIcon,
  MapPinIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilSquareIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";

interface BeneficiaireRND {
  id: string;
  civilite: string;
  nom: string;
  prenom: string;
  age: number | null;
  telephone: string;
  adresse: string;
  complementAdresse: string;
  ville: string;
  codePostal: string;
  situationProfessionnelle: string;
  miseEnContact: string;
  ccasPrevenu: boolean;
  premierRdTelephone: boolean;
  anneeIntervention: string;
}

// Couleurs de badge "Mise en contact" reprises du tableur de suivi RND
// d'origine (rouge CCAS / vert Appel-Suresnes / violet Via RN-Suresnes),
// pour repérer un dossier au premier coup d'œil comme sur le tableur.
const COULEURS_CONTACT: Record<string, string> = {
  "CCAS": "bg-[#EF736A]/15 border-[#EF736A]/40 text-[#EF736A]",
  "Appel - Suresnes": "bg-[#A9E0C9]/30 border-[#A9E0C9] text-[#005259]",
  "Via RN - Suresnes": "bg-[#7A5A9E]/15 border-[#7A5A9E]/40 text-[#7A5A9E]",
};

function BadgeContact({ valeur }: { valeur: string }) {
  if (!valeur) return <span className="text-[#404040]/30 text-xs">—</span>;
  const classe = COULEURS_CONTACT[valeur] || "bg-[#F3F3F2] border-[#404040]/10 text-[#404040]/70";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${classe}`}>
      {valeur}
    </span>
  );
}

function PuceOuiNon({ valeur }: { valeur: boolean }) {
  return valeur ? (
    <CheckCircleIcon className="w-5 h-5 text-[#005259] mx-auto" />
  ) : (
    <XCircleIcon className="w-5 h-5 text-[#404040]/20 mx-auto" />
  );
}

// Page dédiée au suivi des bénéficiaires en visite à domicile (RND) —
// reprend les colonnes de l'ancien tableur de suivi (mise en contact, CCAS
// prévenu, 1er RD téléphone, année d'intervention), directement à partir des
// champs ajoutés sur la fiche bénéficiaire (voir liste-beneficiaires/[id]).
// Détection RND par le rattachement principal (Lieu_RDV contient "RND"),
// pas par un marqueur séparé — voir l'échange du 2026-09-14.
export default function SuiviRNDPage() {
  const [beneficiaires, setBeneficiaires] = useState<BeneficiaireRND[]>([]);
  const [loading, setLoading] = useState(true);
  // Cartes par défaut : cette page est consultée majoritairement depuis un
  // téléphone (en visite, pour retrouver un digicode) — le tableau, pensé
  // pour un écran large, y reste disponible en option.
  const [vue, setVue] = useState<"tableau" | "cartes">("cartes");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "utilisateurs"), (snap) => {
      const liste: BeneficiaireRND[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          const lieu = data.Lieu_RDV || data.lieuRDV || "";
          if (!/RND/i.test(lieu)) return null;
          const dateNaissance = data.Date_Naissance || "";
          return {
            id: d.id,
            civilite: data.Civilité || "",
            nom: lireNom(data),
            prenom: lirePrenom(data),
            age: dateNaissance ? calculerAge(dateNaissance) : (data.Age ? Number(data.Age) : null),
            telephone: lireTelephone(data),
            adresse: data.Adresse_Rue || "",
            complementAdresse: data.Complement_Adresse || "",
            ville: data.Ville || "",
            codePostal: data.Code_Postal || "",
            situationProfessionnelle: data.Situation_Socio_Pro || "",
            miseEnContact: data.Mise_En_Contact || "",
            ccasPrevenu: data.CCAS_Prevenu === "Oui",
            premierRdTelephone: data.Premier_RD_Telephone === "Oui",
            anneeIntervention: data.Annee_Intervention || "",
          } as BeneficiaireRND;
        })
        .filter((b): b is BeneficiaireRND => b !== null)
        .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr"));
      setBeneficiaires(liste);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const total = beneficiaires.length;

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex items-center justify-center text-[#005259] font-bold animate-pulse tracking-widest text-xs uppercase antialiased`}>
        Chargement du suivi RND...
      </div>
    );
  }

  return (
    <PageGuard pageId="page_access_suivi_rnd">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] p-4 md:p-8 font-medium antialiased relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-6xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#404040]/10">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#005259] rounded-full shadow-[0_0_15px_rgba(0,82,89,0.3)]"></div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold uppercase text-[#005259] tracking-tight flex items-center gap-2">
                  <HomeModernIcon className="w-7 h-7 text-[#EA601F]" />
                  Suivi <span className="text-[#EA601F] font-normal">Visites à Domicile</span>
                </h1>
                <p className="text-xs text-[#404040]/70 mt-0.5">{total} bénéficiaire(s) rattaché(s) à un lieu RND</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-[#404040]/15 rounded-xl p-1">
                <button
                  onClick={() => setVue("tableau")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    vue === "tableau" ? "bg-[#005259] text-white" : "text-[#404040]/60 hover:text-[#005259]"
                  }`}
                >
                  <TableCellsIcon className="w-4 h-4" /> Tableau
                </button>
                <button
                  onClick={() => setVue("cartes")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    vue === "cartes" ? "bg-[#005259] text-white" : "text-[#404040]/60 hover:text-[#005259]"
                  }`}
                >
                  <Squares2X2Icon className="w-4 h-4" /> Cartes
                </button>
              </div>
              <Link
                href="/"
                className="flex items-center gap-2 bg-white hover:bg-[#005259] hover:text-white border border-[#404040]/10 px-3.5 py-2 rounded-xl text-[#005259] transition-all text-xs font-bold uppercase tracking-wider shadow-sm w-fit"
              >
                <HomeIcon className="w-4 h-4 text-[#EA601F]" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

          {total === 0 ? (
            <div className="bg-white border border-dashed border-[#404040]/20 rounded-2xl p-12 text-center text-xs font-bold uppercase tracking-wider text-[#404040]/60 shadow-sm">
              Aucun bénéficiaire rattaché à un lieu RND pour le moment.
            </div>
          ) : vue === "tableau" ? (
            <div className="bg-white border border-[#404040]/10 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-[#F3F3F2] border-b border-[#404040]/10 text-[#005259] text-[10px] uppercase tracking-widest font-bold">
                      <th className="py-3 px-4">Bénéficiaire</th>
                      <th className="py-3 px-3">Âge</th>
                      <th className="py-3 px-3">Téléphone</th>
                      <th className="py-3 px-4">Adresse</th>
                      <th className="py-3 px-3">Situation</th>
                      <th className="py-3 px-3">Mise en contact</th>
                      <th className="py-3 px-3 text-center">CCAS prévenu</th>
                      <th className="py-3 px-3 text-center">1er RD tél.</th>
                      <th className="py-3 px-3">Année</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]/10">
                    {beneficiaires.map((b) => (
                      <tr key={b.id} className="hover:bg-[#F3F3F2]/50 transition-colors align-top">
                        <td className="py-3 px-4">
                          <div className="font-bold text-xs text-[#005259] uppercase">
                            {b.civilite && <span className="text-[#404040]/50 font-normal mr-1">{b.civilite}</span>}
                            {b.nom} <span className="font-normal normal-case text-[#404040]/70">{b.prenom}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-[#404040]">{b.age ?? "—"}</td>
                        <td className="py-3 px-3 text-xs text-[#404040] whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <PhoneIcon className="w-3.5 h-3.5 text-[#EA601F] shrink-0" />
                            {b.telephone ? formaterTelephone(b.telephone) : "—"}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-[#404040] max-w-[220px]">
                          <div className="flex items-start gap-1">
                            <MapPinIcon className="w-3.5 h-3.5 text-[#EA601F] shrink-0 mt-0.5" />
                            <div>
                              {b.adresse || "—"}{b.codePostal || b.ville ? ` — ${b.codePostal} ${b.ville}`.trim() : ""}
                              {b.complementAdresse && (
                                <div className="flex items-start gap-1.5 mt-1.5 bg-[#F9C44E]/20 border border-[#F9C44E]/60 rounded-lg p-2 text-[#8A6200]">
                                  <KeyIcon className="w-4 h-4 shrink-0 mt-0.5" />
                                  <span className="whitespace-pre-wrap text-sm font-bold leading-snug">{b.complementAdresse}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-[#404040]">
                          <div className="flex items-center gap-1">
                            <BriefcaseIcon className="w-3.5 h-3.5 text-[#EA601F] shrink-0" />
                            {b.situationProfessionnelle || "—"}
                          </div>
                        </td>
                        <td className="py-3 px-3"><BadgeContact valeur={b.miseEnContact} /></td>
                        <td className="py-3 px-3 text-center"><PuceOuiNon valeur={b.ccasPrevenu} /></td>
                        <td className="py-3 px-3 text-center"><PuceOuiNon valeur={b.premierRdTelephone} /></td>
                        <td className="py-3 px-3 text-xs font-mono text-[#404040]">{b.anneeIntervention || "—"}</td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/mediation/rencontres-numeriques/liste-beneficiaires/${b.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F3F3F2] hover:bg-[#005259] hover:text-white text-[#005259] rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors"
                          >
                            <PencilSquareIcon className="w-3.5 h-3.5" /> Éditer
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {beneficiaires.map((b) => (
                <div key={b.id} className="bg-white border border-[#404040]/10 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-sm text-[#005259] uppercase">
                      {b.civilite && <span className="text-[#404040]/50 font-normal mr-1">{b.civilite}</span>}
                      {b.nom} <span className="font-normal normal-case text-[#404040]/70">{b.prenom}</span>
                      {b.age !== null && <span className="ml-1.5 text-[#404040]/50 font-normal normal-case text-xs">({b.age} ans)</span>}
                    </div>
                    <Link
                      href={`/mediation/rencontres-numeriques/liste-beneficiaires/${b.id}`}
                      className="p-1.5 bg-[#F3F3F2] hover:bg-[#005259] hover:text-white text-[#005259] rounded-lg transition-colors shrink-0"
                      title="Éditer la fiche"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </Link>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#404040]">
                    <div className="flex items-center gap-1.5">
                      <PhoneIcon className="w-3.5 h-3.5 text-[#EA601F] shrink-0" />
                      {b.telephone ? formaterTelephone(b.telephone) : "Non renseigné"}
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MapPinIcon className="w-3.5 h-3.5 text-[#EA601F] shrink-0 mt-0.5" />
                      <span>{b.adresse || "—"}{b.codePostal || b.ville ? ` — ${b.codePostal} ${b.ville}`.trim() : ""}</span>
                    </div>
                    {b.complementAdresse && (
                      <div className="flex items-start gap-2 bg-[#F9C44E]/20 border border-[#F9C44E]/60 rounded-xl p-2.5 text-[#8A6200]">
                        <KeyIcon className="w-5 h-5 shrink-0 mt-0.5" />
                        <span className="whitespace-pre-wrap text-sm font-bold leading-snug">{b.complementAdresse}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <BriefcaseIcon className="w-3.5 h-3.5 text-[#EA601F] shrink-0" />
                      {b.situationProfessionnelle || "—"}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F3F3F2]">
                    <BadgeContact valeur={b.miseEnContact} />
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#404040]/70">
                      <PuceOuiNon valeur={b.ccasPrevenu} /> CCAS
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#404040]/70">
                      <PuceOuiNon valeur={b.premierRdTelephone} /> 1er RD tél.
                    </span>
                    {b.anneeIntervention && (
                      <span className="ml-auto text-[10px] font-mono font-bold text-[#404040]/60">{b.anneeIntervention}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </PageGuard>
  );
}

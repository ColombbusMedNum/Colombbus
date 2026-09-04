"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import PageGuard from "@/components/PageGuard";

// Redirection rapide vers la première session existante — évite de passer
// par la page des préinscriptions pour accéder au suivi de recrutement.
export default function SuiviRecrutementNumerikUpProRedirectPage() {
  const router = useRouter();
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    const rediriger = async () => {
      try {
        const snapSessions = await getDoc(doc(db, "configuration_numerikuppro", "sessions"));
        const parTerritoire = snapSessions.exists() ? snapSessions.data().parTerritoire || {} : {};
        const sessionsDistinctes: string[] = Array.from(
          new Set(Object.values(parTerritoire as Record<string, Record<string, string[]>>).flatMap((parTerr) => Object.values(parTerr).flat()))
        ).sort((a, b) => a.localeCompare(b, "fr"));
        if (sessionsDistinctes.length > 0) {
          router.replace(`/mediation/actions-collectives/reponses/numerik-up-pro/${encodeURIComponent(sessionsDistinctes[0])}`);
        } else {
          setIntrouvable(true);
        }
      } catch (error) {
        console.error("Erreur lors de la redirection vers le suivi de recrutement :", error);
        setIntrouvable(true);
      }
    };
    rediriger();
  }, [router]);

  return (
    <PageGuard pageId="page_access_actions_collectives_accueil">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-[#005259] p-8 text-center antialiased`}>
        {introuvable ? (
          <>
            <p className="font-bold uppercase tracking-widest text-xs">Aucune session NUMERIK PRO n'a encore été créée.</p>
            <Link
              href="/mediation/actions-collectives/reponses/numerik-up-pro"
              className="text-xs font-bold uppercase tracking-wider underline hover:text-[#EA601F] transition-colors"
            >
              Voir les préinscriptions
            </Link>
          </>
        ) : (
          <p className="font-bold animate-pulse tracking-widest text-xs uppercase">Redirection vers le suivi de recrutement...</p>
        )}
      </main>
    </PageGuard>
  );
}

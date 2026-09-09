"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { quicksand } from "@/lib/fonts";
import PageGuard from "@/components/PageGuard";
import { chargerConfiguration } from "@/lib/dynamicActions/store";

// Redirection rapide vers la première session existante — évite de passer
// par la page des préinscriptions pour accéder au suivi de recrutement.
// Duplicata générique de reponses/prfe/suivi-recrutement, paramétré par slug.
export default function SuiviRecrutementActionDynamiqueRedirectPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    const rediriger = async () => {
      try {
        const config = await chargerConfiguration(slug);
        const sessionsDistinctes: string[] = Array.from(
          new Set(Object.values(config.sessions).flatMap((parTerritoire) => Object.values(parTerritoire).flat()))
        ).sort((a, b) => a.localeCompare(b, "fr"));
        if (sessionsDistinctes.length > 0) {
          router.replace(`/mediation/actions-collectives/reponses/${slug}/${encodeURIComponent(sessionsDistinctes[0])}`);
        } else {
          setIntrouvable(true);
        }
      } catch (error) {
        console.error("Erreur lors de la redirection vers le suivi de recrutement :", error);
        setIntrouvable(true);
      }
    };
    rediriger();
  }, [router, slug]);

  return (
    <PageGuard pageId="page_access_action_dynamique">
      <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] flex flex-col items-center justify-center gap-4 text-[#005259] p-8 text-center antialiased`}>
        {introuvable ? (
          <>
            <p className="font-bold uppercase tracking-widest text-xs">Aucune session n'a encore été créée pour cette action.</p>
            <Link
              href={`/mediation/actions-collectives/reponses/${slug}`}
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

"use client";

import { ReactNode } from "react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { quicksand } from "@/lib/fonts";
import { usePermissions } from "../lib/PermissionsProvider";

// Protège l'accès à une page entière (à la place d'un simple bouton/lien) :
// affiche un écran "Accès Refusé" si le rôle de l'utilisateur connecté n'a pas
// le droit "pageId" dans la matrice centralisée (configuration_droits).
// Rappel : ceci reste une couche d'UX. La sécurité réelle des données est
// posée par les Firestore Security Rules, pas par ce composant.
export default function PageGuard({
  pageId,
  children,
}: {
  pageId: string;
  children: ReactNode;
}) {
  const { can, loading } = usePermissions();

  if (loading) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] flex items-center justify-center font-medium antialiased`}>
        <p className="text-xs text-[#404040]/50 font-bold uppercase tracking-widest animate-pulse">
          Vérification des droits d'accès...
        </p>
      </div>
    );
  }

  if (!can(pageId)) {
    return (
      <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] flex flex-col items-center justify-center gap-3 font-medium antialiased p-4`}>
        <div className="bg-white border border-[#404040]/10 rounded-3xl p-8 shadow-sm text-center max-w-sm">
          <LockClosedIcon className="w-12 h-12 text-[#EA601F] mx-auto mb-4" />
          <h1 className="text-xl font-bold uppercase text-[#005259] tracking-tight">Accès Refusé</h1>
          <p className="text-xs text-[#404040]/60 mt-2 leading-relaxed">
            Vous n'avez pas les droits nécessaires pour consulter cette page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

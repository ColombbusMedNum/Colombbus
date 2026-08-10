"use client";

import { ReactNode } from "react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
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
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-xs text-slate-500 animate-pulse">
          Vérification des droits d'accès...
        </p>
      </div>
    );
  }

  if (!can(pageId)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3">
        <LockClosedIcon className="w-12 h-12 text-rose-500 animate-pulse" />
        <h1 className="text-xl font-bold">Accès Refusé</h1>
        <p className="text-xs text-slate-500">
          Vous n'avez pas les droits nécessaires pour consulter cette page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

"use client";

import React from "react";
import { usePermissions } from "../lib/PermissionsProvider";

interface PermissionGuardProps {
  actionId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode; // Ce qu'on affiche si l'accès est refusé (par défaut rien)
}

// Masque un bouton/lien/champ précis si l'utilisateur connecté n'a pas le
// droit correspondant dans la matrice centralisée (configuration_droits).
// Le rôle n'est plus passé en prop : il vient de PermissionsProvider, qui le
// lit depuis Firestore pour l'utilisateur réellement authentifié.
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  actionId,
  children,
  fallback = null,
}) => {
  const { can, loading } = usePermissions();

  if (loading) return null;
  if (!can(actionId)) return <>{fallback}</>;

  return <>{children}</>;
};

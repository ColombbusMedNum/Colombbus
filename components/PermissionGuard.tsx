"use client";

import React, { useState, useEffect } from "react";

interface PermissionGuardProps {
  actionId: string;
  userRole: string; // "admin" | "mediateur" | "coordinateur" | "lecteur"
  children: React.ReactNode;
  fallback?: React.ReactNode; // Ce qu'on affiche si l'accès est refusé (par défaut rien)
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  actionId,
  userRole,
  children,
  fallback = null,
}) => {
  const [hasAccess, setHasAccess] = useState<boolean>(false);

  useEffect(() => {
    // Les admins ont toujours accès par défaut
    if (userRole === "admin") {
      setHasAccess(true);
      return;
    }

    // Récupération de la matrice depuis le localStorage (ou votre état global)
    const savedMatrix = localStorage.getItem("matrix_droits_analyse");
    if (savedMatrix) {
      try {
        const matrix = JSON.parse(savedMatrix);
        setHasAccess(!!matrix[userRole]?.[actionId]);
      } catch (e) {
        setHasAccess(false);
      }
    } else {
      setHasAccess(false);
    }
  }, [actionId, userRole]);

  if (!hasAccess) return <>{fallback}</>;

  return <>{children}</>;
};
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { normalizeRole } from "./roles";
import { DEFAULT_PERMISSIONS } from "./permissionsCatalog";

interface PermissionsContextValue {
  user: User | null;
  role: string | null;
  loading: boolean;
  can: (actionId: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  user: null,
  role: null,
  loading: true,
  can: () => false,
});

// Source unique de vérité côté client pour "qui est connecté" et "qui a le
// droit de faire quoi". Remplace les anciennes lectures de cookies/localStorage
// disséminées dans chaque page : le rôle vient d'une lecture Firestore du
// document liste_mediateurs/{uid} de l'utilisateur réellement authentifié
// (onAuthStateChanged), et la matrice de droits vient de configuration_droits.
//
// Attention : ce contexte ne fait qu'orienter l'affichage (masquer un bouton,
// rediriger d'une page). Le verrou de sécurité réel est posé par les Firestore
// Security Rules (voir firestore.rules) — un utilisateur qui contournerait ce
// contexte ne pourrait de toute façon pas lire/écrire les données protégées.
export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [authResolved, setAuthResolved] = useState(false);
  const [roleResolved, setRoleResolved] = useState(false);
  const [matrixResolved, setMatrixResolved] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthResolved(true);

      if (!firebaseUser) {
        setRole(null);
        setRoleResolved(true);
        return;
      }

      setRoleResolved(false);
      try {
        const snap = await getDoc(doc(db, "liste_mediateurs", firebaseUser.uid));
        setRole(normalizeRole(snap.exists() ? snap.data().role : null));
      } catch (err) {
        console.error("Impossible de lire le rôle de l'utilisateur :", err);
        setRole(normalizeRole(null));
      } finally {
        setRoleResolved(true);
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubMatrix = onSnapshot(
      collection(db, "configuration_droits"),
      (snap) => {
        const data: Record<string, Record<string, boolean>> = {};
        snap.docs.forEach((d) => {
          data[d.id] = d.data() as Record<string, boolean>;
        });
        setMatrix(data);
        setMatrixResolved(true);
      },
      (err) => {
        console.error("Impossible de lire la matrice de droits :", err);
        setMatrixResolved(true);
      }
    );

    return () => unsubMatrix();
  }, []);

  const can = (actionId: string): boolean => {
    if (role === "admin") return true;
    if (!role) return false;

    const explicit = matrix[actionId]?.[role];
    if (explicit !== undefined) return explicit;

    // Tant que la matrice Firestore n'a pas encore été renseignée pour cette
    // action, on retombe sur les valeurs par défaut du catalogue.
    return !!DEFAULT_PERMISSIONS[role]?.[actionId];
  };

  const loading = !authResolved || !roleResolved || !matrixResolved;

  return (
    <PermissionsContext.Provider value={{ user, role, loading, can }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

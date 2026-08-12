"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { normalizeRole } from "./roles";
import { resolvePermission } from "./permissionsCatalog";

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
  const [overrides, setOverrides] = useState<string[]>([]);
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
        setOverrides([]);
        setRoleResolved(true);
        return;
      }

      setRoleResolved(false);
      try {
        let roleRaw: string | null = null;
        let overridesRaw: string[] = [];
        let actif = true;
        const uidSnap = await getDoc(doc(db, "liste_mediateurs", firebaseUser.uid));
        if (uidSnap.exists()) {
          roleRaw = uidSnap.data().role || null;
          overridesRaw = uidSnap.data().permissionsOverrides || [];
          actif = uidSnap.data().actif !== false;
        } else if (firebaseUser.email) {
          // Repli transitoire : tant que scripts/migrate-mediateurs-to-uid.js
          // n'a pas été exécuté, les comptes existants sont encore indexés par
          // un ID Firestore aléatoire plutôt que par l'UID. Voir login/page.tsx
          // qui applique le même repli.
          const q = query(collection(db, "liste_mediateurs"), where("email", "==", firebaseUser.email.toLowerCase().trim()));
          const legacySnap = await getDocs(q);
          if (!legacySnap.empty) {
            roleRaw = legacySnap.docs[0].data().role || null;
            overridesRaw = legacySnap.docs[0].data().permissionsOverrides || [];
            actif = legacySnap.docs[0].data().actif !== false;
          }
        }
        // Un membre archivé (actif: false) n'a plus aucun droit, quel que
        // soit son rôle enregistré — voir firestore.rules pour la barrière
        // réelle côté serveur (isStaff()/isAdmin()).
        setRole(actif ? normalizeRole(roleRaw) : null);
        setOverrides(actif ? overridesRaw : []);
      } catch (err) {
        console.error("Impossible de lire le rôle de l'utilisateur :", err);
        setRole(normalizeRole(null));
        setOverrides([]);
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
    if (!role) return false;
    // Une exception individuelle (accordée sur la fiche du médiateur, en plus
    // de son rôle — voir /mediation/analyse, mode "Par personne") l'emporte
    // toujours quand elle accorde un droit que le rôle seul ne donne pas.
    if (overrides.includes(actionId)) return true;
    return resolvePermission(matrix, role, actionId);
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

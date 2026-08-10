"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

interface MediateursContextValue {
  mediateurs: any[];
  loading: boolean;
}

const MediateursContext = createContext<MediateursContextValue>({
  mediateurs: [],
  loading: true,
});

// Source unique de vérité pour la collection "liste_mediateurs" : un seul
// onSnapshot partagé par toute l'app, au lieu d'un listener indépendant par
// page (agenda, équipe, statistiques, volume-horaire, mediateurs, competences,
// admin/droits, suresnes, fiche bénéficiaire — 9 écoutes redondantes avant
// cette centralisation). Chaque page dérive ses propres transformations
// (tri, filtrage, maps par nom/id) via useMemo à partir de ce tableau brut.
export function MediateursProvider({ children }: { children: React.ReactNode }) {
  const [mediateurs, setMediateurs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "liste_mediateurs"),
      (snap) => {
        setMediateurs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Impossible de lire liste_mediateurs :", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return (
    <MediateursContext.Provider value={{ mediateurs, loading }}>
      {children}
    </MediateursContext.Provider>
  );
}

export function useMediateurs() {
  return useContext(MediateursContext);
}

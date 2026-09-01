"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { normalizeRole } from "./roles";
import { resolvePermission } from "./permissionsCatalog";

interface PermissionsContextValue {
  user: User | null;
  role: string | null;
  loading: boolean;
  can: (actionId: string) => boolean;
  terminerSession: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  user: null,
  role: null,
  loading: true,
  can: () => false,
  terminerSession: async () => {},
});

// Marque la fin de la session de connexion en cours (voir journal_connexions
// ci-dessous) — appelée explicitement par le bouton Déconnexion (qui ne
// passe pas par signOut(auth), voir app/page.tsx) et par la déconnexion
// automatique après 3 jours plus bas dans ce fichier. Best-effort : une
// écriture manquée n'empêche jamais la déconnexion de continuer.
async function terminerSessionJournal() {
  const sessionId = localStorage.getItem("journal_session_id");
  if (!sessionId) return;
  localStorage.removeItem("journal_session_id");
  try {
    await updateDoc(doc(db, "journal_connexions", sessionId), { fin: serverTimestamp() });
  } catch {
    // Ignoré : la session reste sans "fin" explicite, le dernier heartbeat
    // sert alors d'estimation (voir app/mediation/journal-connexions).
  }
}

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
  // Type de contrat (fiche liste_mediateurs.statut) — distinct du rôle
  // applicatif "aci" (droits de consultation) : un membre "Permanent" peut
  // très bien avoir le rôle "aci" sans être un ACI au sens contractuel. Sert
  // uniquement au couvre-feu 18h30 ci-dessous, qui ne doit viser que les
  // vrais contrats ACI.
  const [statut, setStatut] = useState<string | null>(null);
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
        setStatut(null);
        setOverrides([]);
        setRoleResolved(true);
        return;
      }

      // Déconnexion automatique après ~3 jours : Firebase Auth garde une
      // session active indéfiniment par défaut (persistance locale), donc on
      // fait respecter nous-mêmes une durée maximale, alignée sur celle des
      // cookies posés à la connexion (voir app/login/page.tsx). Un
      // horodatage absent (jamais posé, ex. session déjà ouverte avant ce
      // correctif, ou onAuthStateChanged qui se déclenche avant l'écriture
      // faite par login/page.tsx juste après signInWithEmailAndPassword) ne
      // doit JAMAIS être traité comme "expiré" — ça déconnecterait toute
      // connexion en cours au moment même où elle vient de réussir. On se
      // contente de démarrer le compteur maintenant.
      const TROIS_JOURS_MS = 3 * 24 * 60 * 60 * 1000;
      const loginTimestamp = Number(localStorage.getItem("login_timestamp") || 0);
      if (loginTimestamp && Date.now() - loginTimestamp > TROIS_JOURS_MS) {
        await terminerSessionJournal();
        await signOut(auth);
        localStorage.removeItem("login_timestamp");
        localStorage.removeItem("user_role");
        localStorage.removeItem("user_email");
        document.cookie = "session_token=; path=/; max-age=0";
        document.cookie = "user_role=; path=/; max-age=0";
        setUser(null);
        setRole(null);
        setStatut(null);
        setOverrides([]);
        setRoleResolved(true);
        return;
      }
      if (!loginTimestamp) {
        localStorage.setItem("login_timestamp", Date.now().toString());
      }

      setRoleResolved(false);
      try {
        let roleRaw: string | null = null;
        let statutRaw: string | null = null;
        let overridesRaw: string[] = [];
        let actif = true;
        const uidSnap = await getDoc(doc(db, "liste_mediateurs", firebaseUser.uid));
        if (uidSnap.exists()) {
          roleRaw = uidSnap.data().role || null;
          statutRaw = uidSnap.data().statut || null;
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
            statutRaw = legacySnap.docs[0].data().statut || null;
            overridesRaw = legacySnap.docs[0].data().permissionsOverrides || [];
            actif = legacySnap.docs[0].data().actif !== false;
          }
        }
        // Un membre archivé (actif: false) n'a plus aucun droit, quel que
        // soit son rôle enregistré — voir firestore.rules pour la barrière
        // réelle côté serveur (isStaff()/isAdmin()).
        setRole(actif ? normalizeRole(roleRaw) : null);
        setStatut(actif ? statutRaw : null);
        setOverrides(actif ? overridesRaw : []);
      } catch (err) {
        console.error("Impossible de lire le rôle de l'utilisateur :", err);
        setRole(normalizeRole(null));
        setStatut(null);
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

  // Journal des connexions (voir app/mediation/journal-connexions) : un
  // document par session, prolongé toutes les 3 minutes tant que l'onglet
  // reste ouvert (dernierHeartbeat), pour obtenir une durée de connexion même
  // quand la personne ferme l'onglet sans cliquer sur Déconnexion — dans ce
  // cas "fin" reste vide et dernierHeartbeat sert d'estimation de fin.
  useEffect(() => {
    // Exclut les connexions de développement/test en local, qui pollueraient
    // le journal réel du staff — seul le site déployé doit être suivi.
    if (!user || !role || window.location.hostname === "localhost") return;

    let annule = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const HEARTBEAT_MS = 3 * 60 * 1000;

    const demarrerSuivi = async () => {
      let sessionId = localStorage.getItem("journal_session_id");
      if (!sessionId) {
        try {
          const ref = await addDoc(collection(db, "journal_connexions"), {
            mediatId: user.uid,
            debut: serverTimestamp(),
            dernierHeartbeat: serverTimestamp(),
            fin: null,
          });
          sessionId = ref.id;
          localStorage.setItem("journal_session_id", sessionId);
        } catch (err) {
          console.error("Impossible de créer la session du journal des connexions :", err);
          return;
        }
      }
      if (annule || !sessionId) return;
      intervalId = setInterval(() => {
        updateDoc(doc(db, "journal_connexions", sessionId!), { dernierHeartbeat: serverTimestamp() }).catch(() => {});
      }, HEARTBEAT_MS);
    };
    demarrerSuivi();

    return () => {
      annule = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, role]);

  // Couvre-feu ACI : un compte dont le CONTRAT est "ACI" (statut, pas le
  // rôle applicatif — un membre "Permanent" peut avoir le rôle "aci" en
  // consultation sans être concerné) doit être déconnecté chaque soir à
  // 18h30, y compris en pleine session (pas seulement au prochain
  // chargement de page) — d'où la vérification chaque minute plutôt qu'une
  // seule fois à la connexion. Se réapplique tant qu'il est plus tard que
  // 18h30 le même jour ; une connexion le lendemain matin n'est pas concernée
  // (nouveau Date().setHours(18,30,...) calculé sur le jour courant).
  useEffect(() => {
    if (!user || statut !== "ACI") return;

    const verifierCouvreFeu = async () => {
      const maintenant = new Date();
      const couvreFeu = new Date(maintenant);
      couvreFeu.setHours(18, 30, 0, 0);
      if (maintenant < couvreFeu) return;

      await terminerSessionJournal();
      await signOut(auth);
      localStorage.removeItem("login_timestamp");
      localStorage.removeItem("user_role");
      localStorage.removeItem("user_email");
      document.cookie = "session_token=; path=/; max-age=0";
      document.cookie = "user_role=; path=/; max-age=0";
      setUser(null);
      setRole(null);
      setStatut(null);
      setOverrides([]);
    };

    verifierCouvreFeu();
    const intervalId = setInterval(verifierCouvreFeu, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [user, statut]);

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
    <PermissionsContext.Provider value={{ user, role, loading, can, terminerSession: terminerSessionJournal }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

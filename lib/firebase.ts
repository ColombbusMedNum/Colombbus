import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import type { FirebaseStorage } from "firebase/storage";
import { getAuth } from "firebase/auth"; // <-- Bien présent

export const firebaseConfig = {
  apiKey: "AIzaSyBps0rKBEiJV0owdmDL0b6QsTqB0kGvDoE",
  authDomain: "mediation-numerique.firebaseapp.com",
  projectId: "mediation-numerique",
  storageBucket: "mediation-numerique.firebasestorage.app",
  messagingSenderId: "315953587662",
  appId: "1:315953587662:web:52d942defa24682977b79f",
  measurementId: "G-3VQHK39Z42"
};

// Initialisation unique de l'instance Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Exportations stables des instances de services
export const db = getFirestore(app);
export const auth = getAuth(app); // <-- L'instance d'authentification liée à l'app

// Storage n'est utilisé que par app/mediation/bibliotheque-logos/page.tsx.
// Chargé en dynamique (import() plutôt qu'en haut de fichier) pour que le SDK
// firebase/storage n'atterrisse pas dans le chunk partagé par toutes les
// pages qui importent seulement `db`/`auth` depuis ce module.
let _storagePromise: Promise<FirebaseStorage> | null = null;
export function getFirebaseStorage(): Promise<FirebaseStorage> {
  if (!_storagePromise) {
    _storagePromise = import("firebase/storage").then(({ getStorage }) => getStorage(app));
  }
  return _storagePromise;
}

export const initAnalytics = async () => {
  if (typeof window !== "undefined" && await isSupported()) {
    return getAnalytics(app);
  }
};
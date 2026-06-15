import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// On n'importe Analytics que si on est côté client, car il ne marche pas côté serveur
import { getAnalytics, isSupported } from "firebase/analytics";
// 1. Ajout de l'import pour le Storage 👇
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBps0rKBEiJV0owdmDL0b6QsTqB0kGvDoE",
  authDomain: "mediation-numerique.firebaseapp.com",
  projectId: "mediation-numerique",
  storageBucket: "mediation-numerique.firebasestorage.app",
  messagingSenderId: "315953587662",
  appId: "1:315953587662:web:52d942defa24682977b79f",
  measurementId: "G-3VQHK39Z42"
};

// Initialisation sécurisée pour Next.js
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Exportation de la base de données Firestore
export const db = getFirestore(app);

// 2. Initialisation et exportation du Storage 👇
export const storage = getStorage(app);

// Exportation de Analytics (optionnel, avec vérification du support navigateur)
export const initAnalytics = async () => {
  if (typeof window !== "undefined" && await isSupported()) {
    return getAnalytics(app);
  }
};
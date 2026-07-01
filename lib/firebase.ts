import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth"; // <-- Bien présent

const firebaseConfig = {
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
export const storage = getStorage(app);
export const auth = getAuth(app); // <-- L'instance d'authentification liée à l'app

export const initAnalytics = async () => {
  if (typeof window !== "undefined" && await isSupported()) {
    return getAnalytics(app);
  }
};
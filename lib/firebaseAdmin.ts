// SDK Admin Firebase, réservé au code serveur (routes app/api/**/route.ts) —
// jamais importé depuis un composant "use client". S'appuie sur les
// Application Default Credentials fournies automatiquement par
// l'environnement Cloud Run d'App Hosting : contrairement aux scripts
// ponctuels dans scripts/ (qui pointent vers un serviceAccountKey.json local,
// périmé), aucune clé n'est nécessaire ici en production.
import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// En local, GOOGLE_APPLICATION_CREDENTIALS (voir scripts/) peut fournir des
// ADC de secours ; en production sur App Hosting, initializeApp() sans
// argument résout seul les ADC de l'environnement Cloud Run.
function getAdminApp(): App {
  const apps = getApps();
  return apps.length > 0 ? apps[0] : initializeApp();
}

export const adminApp = getAdminApp();
export const adminDb = getFirestore(adminApp);

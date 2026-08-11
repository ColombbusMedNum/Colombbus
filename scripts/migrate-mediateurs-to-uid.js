// Script ponctuel (à exécuter une seule fois, en local) qui migre les
// documents de la collection liste_mediateurs pour que leur ID Firestore
// soit l'UID Firebase Auth du membre correspondant, au lieu d'un ID
// aléatoire. C'est un prérequis pour que firestore.rules puisse vérifier le
// rôle de l'appelant via un simple get() de document.
//
// Usage :
//   npm install --save-dev firebase-admin   (dépendance de dev, pas exécutée en prod)
//   node scripts/migrate-mediateurs-to-uid.js            # dry-run (aucune écriture)
//   node scripts/migrate-mediateurs-to-uid.js --apply     # applique réellement la migration
//
// Nécessite une clé de compte de service Firebase (Console Firebase >
// Paramètres du projet > Comptes de service > Générer une nouvelle clé
// privée), à placer localement et référencer via la variable d'environnement
// GOOGLE_APPLICATION_CREDENTIALS, par ex. :
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/migrate-mediateurs-to-uid.js

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const APPLY = process.argv.includes("--apply");

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();
const auth = getAuth();

const IGNORED_DOC_IDS = new Set(["parametres_configuration", "parametres_horaires"]);

async function listAllAuthUsersByEmail() {
  const byEmail = new Map();
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    page.users.forEach((u) => {
      if (u.email) byEmail.set(u.email.toLowerCase().trim(), u.uid);
    });
    pageToken = page.pageToken;
  } while (pageToken);
  return byEmail;
}

async function main() {
  console.log(APPLY ? "Mode : APPLICATION RÉELLE" : "Mode : DRY-RUN (aucune écriture)");

  const authByEmail = await listAllAuthUsersByEmail();
  const snap = await db.collection("liste_mediateurs").get();

  const toMigrate = [];
  const alreadyOk = [];
  const noAuthAccount = [];

  snap.docs.forEach((docSnap) => {
    if (IGNORED_DOC_IDS.has(docSnap.id)) return;

    const data = docSnap.data();
    const email = (data.email || "").toLowerCase().trim();
    const uid = email ? authByEmail.get(email) : undefined;

    if (!uid) {
      noAuthAccount.push({ docId: docSnap.id, email: data.email });
      return;
    }

    if (docSnap.id === uid) {
      alreadyOk.push({ docId: docSnap.id, email: data.email });
      return;
    }

    toMigrate.push({ oldDocId: docSnap.id, uid, data });
  });

  console.log(`\n${alreadyOk.length} document(s) déjà correctement indexé(s) par UID.`);

  console.log(`\n${noAuthAccount.length} document(s) sans compte Firebase Auth correspondant (email introuvable) :`);
  noAuthAccount.forEach((m) => console.log(`  - ${m.docId} (email: ${m.email || "absent"})`));

  console.log(`\n${toMigrate.length} document(s) à migrer :`);
  toMigrate.forEach((m) => console.log(`  - ${m.oldDocId} -> ${m.uid} (email: ${m.data.email})`));

  if (!APPLY) {
    console.log("\nDry-run terminé. Relancez avec --apply pour effectuer la migration.");
    return;
  }

  for (const { oldDocId, uid, data } of toMigrate) {
    await db.collection("liste_mediateurs").doc(uid).set(data);
    await db.collection("liste_mediateurs").doc(oldDocId).delete();
    console.log(`Migré : ${oldDocId} -> ${uid}`);
  }

  console.log("\nMigration terminée.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Script ponctuel (à exécuter une seule fois, en local) qui aligne le champ
// mediateurNom de tous les documents planning_mediateurs sur le nom complet
// ACTUEL de la fiche liste_mediateurs correspondante (retrouvée via mediatId,
// l'identifiant fiable — voir lib/matchMediateur.ts). Utile après la
// correction d'une faute de frappe sur une fiche (ex. "MATTHIOT" ->
// "MATHIOT") : le rattachement des créneaux reste correct grâce à mediatId,
// mais l'ancien texte figé dans mediateurNom reste visible tel quel tant
// qu'on ne le corrige pas explicitement.
//
// Portée volontairement limitée à planning_mediateurs : planning_suresnes
// n'a pas de champ mediatId (seulement mediateurNom, avec des suffixes de
// type "(RN)"/"(RN91)"/"(RND)"), une correction fiable par identifiant n'y
// est donc pas possible avec la même méthode.
//
// Usage :
//   node scripts/normaliser-noms-planning.js            # dry-run (aucune écriture)
//   node scripts/normaliser-noms-planning.js --apply     # applique réellement la correction
//
// Nécessite une clé de compte de service Firebase (Console Firebase >
// Paramètres du projet > Comptes de service > Générer une nouvelle clé
// privée), à placer localement et référencer via la variable d'environnement
// GOOGLE_APPLICATION_CREDENTIALS, par ex. :
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/normaliser-noms-planning.js

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const APPLY = process.argv.includes("--apply");

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

async function main() {
  console.log(APPLY ? "Mode : APPLICATION RÉELLE" : "Mode : DRY-RUN (aucune écriture)");

  const mediateursSnap = await db.collection("liste_mediateurs").get();
  const nomActuelParId = new Map();
  mediateursSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const nomComplet = `${data.prenom || ""} ${data.nom || ""}`.trim();
    if (nomComplet) nomActuelParId.set(docSnap.id, nomComplet);
  });

  const planningSnap = await db.collection("planning_mediateurs").get();

  const aCorreger = [];
  planningSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const mediatId = data.mediatId || data.mediateurId;
    if (!mediatId) return;
    const nomActuel = nomActuelParId.get(mediatId);
    if (!nomActuel) return;
    if (data.mediateurNom !== nomActuel) {
      aCorreger.push({ docId: docSnap.id, mediatId, ancienNom: data.mediateurNom, nouveauNom: nomActuel });
    }
  });

  console.log(`\n${aCorreger.length} créneau(x) à corriger :`);
  const parMediateur = new Map();
  aCorreger.forEach((c) => {
    const cle = `${c.ancienNom} -> ${c.nouveauNom}`;
    parMediateur.set(cle, (parMediateur.get(cle) || 0) + 1);
  });
  parMediateur.forEach((count, cle) => console.log(`  - ${cle} (${count} créneau(x))`));

  if (!APPLY) {
    console.log("\nDry-run terminé. Relancez avec --apply pour effectuer la correction.");
    return;
  }

  // Écritures par lots de 500 max (limite Firestore par batch).
  for (let i = 0; i < aCorreger.length; i += 500) {
    const batch = db.batch();
    aCorreger.slice(i, i + 500).forEach((c) => {
      batch.update(db.collection("planning_mediateurs").doc(c.docId), { mediateurNom: c.nouveauNom });
    });
    await batch.commit();
    console.log(`Lot ${Math.floor(i / 500) + 1} appliqué (${Math.min(i + 500, aCorreger.length)}/${aCorreger.length}).`);
  }

  console.log("\nCorrection terminée.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

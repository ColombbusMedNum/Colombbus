// Script ponctuel (à exécuter une seule fois, en local) qui corrige le champ
// mediatId sur tous les documents planning_mediateurs (et planning_suresnes
// s'il existe un champ équivalent) après la migration d'identifiant réalisée
// par scripts/migrate-mediateurs-to-uid.js. Cette migration renomme l'ID
// Firestore d'une fiche liste_mediateurs (ancien ID aléatoire -> UID Firebase
// Auth), mais ne touche PAS aux créneaux déjà créés, qui gardent l'ANCIEN
// identifiant dans leur champ mediatId — cassant le rattachement fiable par
// identifiant (voir lib/matchMediateur.ts : estActionDuMediateur retombe
// alors sur une comparaison de nom, fragile face à toute correction
// orthographique ultérieure).
//
// La correspondance ancien ID -> nouvel ID est FIGÉE ci-dessous, recopiée du
// journal affiché par migrate-mediateurs-to-uid.js lors de son exécution
// (voir MAPPING). Adaptez cette liste si vous relancez ce script après une
// nouvelle migration.
//
// Usage :
//   node scripts/corriger-mediatid-planning.js            # dry-run (aucune écriture)
//   node scripts/corriger-mediatid-planning.js --apply     # applique réellement la correction
//
// Nécessite GOOGLE_APPLICATION_CREDENTIALS (voir migrate-mediateurs-to-uid.js
// pour la procédure d'obtention d'une clé de compte de service).

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const APPLY = process.argv.includes("--apply");

// Ancien ID Firestore -> nouvel ID (UID Firebase Auth), tel qu'imprimé par
// migrate-mediateurs-to-uid.js --apply.
const MAPPING = {
  "13q1C8nWSnPPFaiDbuD1": "RniftX8K7ahR2jPiJ9vmVkaopWy1",
  "3MW9lcNQUVuOX3x8GKna": "JEdr1KVV2TNvXw8ZQbJuuIXx2On2",
  "3goDhhsREPZAsZHHvTqj": "bLQZwVzXiVVPZWlHqGtwNbKYVmK2",
  "CASHFUmaYmUxc7YR92ze": "ocRB14W8Buf47cZo0dBSnFCTpM83",
  "Ea2vZT4eoiW8T49OzxVJ": "vtQDFczWvQOHRlQBEzemyVJm2jj2",
  "Fg4xW0Qd6RarRw9OtHPn": "lwx7v8lSQLTCGo1Ya4tL800kWsV2",
  "G4ih3R1XaH8fKgqUmrTq": "gplrPzc4FYScTpaHW84CvMRX5zo2",
  "KVfuJT6BHGgZMPVnxrBT": "xhSrZGd0eNZmzESguLeAQuNZ0Z53",
  "L9Jv6vWV5X30TZVoCpf1": "ind0VUBMP6bb8cUHiXNQHK2wcBC2",
  "MWVEv7gygWsMDjWlPqAU": "n0LKnIZCmKSykVx1J5tJvxtgPGY2",
  "MaiNRQ8y1ZGpA8UgMI8w": "auSMS9CxLwStmMWhB8F3pZIQERU2",
  "O4aU5tav1jRwV8SBTebe": "V2J1R0jMYmfrxz3LAJpwpShoBMA2",
  "RzFf6WvAbulKiV1iogsx": "admtDKO3rCVmFg8yyxgvZbOYIZc2",
  "WhmHWDJ43TnNNfV82P01": "XlohO9oZfyYKlCM1YxSO0ozvZ1w2",
  "YkIq7mjlXChQ2BFl24Ft": "GiBcOiN7kvSdoYNN01YOLrJhiOn1",
  "dURdaGIyomD5o9KnrdW6": "P8flWLjocngJ7fvyVlPKl3AHPum1",
  "gbTnYnMJeiLVeWms2ZVd": "IhjRFl4z3jM6MCHN2aFoOSRyA0v1",
  "hEaLBpbUM6ZNkdjvavj1kPHoCAv1": "sOkhReYTHSaT0SwIVWmg7cHSYiN2",
  "ij6mVRclPstc0AmndASu": "3yC3hmRgd1dxVZNG86QWjhk86b23",
  "oZlTzqKRsptiCGBOik3S": "cCF4OpIaQzLvA27FGb3LCgiviSX2",
  "parametres_horaires": "6G4pmvf12zVG4zGiw4zjjH3OBam1",
  "rmW34cIDxPMu0FxgyoxG": "v3k7UJxe8ST7huVFHiRy14Zzbui2",
  "s3dwakDli5j7t9oQIZnM": "6XyQdh9gJcYJzkFKbIvBULJtuM62",
  "tO6QijATHDbyGIiJGATm": "RWPP0OEGLBaYOeLBC4pXkTqS9Cp1",
  "vhdVljHvCg4qKis1cEHH": "XfydI4vgsgep59ABoiwiMDSjgW73",
  "xgOcHfZw50OQqbfEEQIt": "Uc2ms6zt2xT5QmaENyNQJFgIT222",
  "z1yyosKGh3AGby1WgBef": "vynyZBiqyiMeNZFyGa2j9ezsYCt1",
  "zEH3hW7LrjLHm1Ic2jgT": "NGP861lanKMV4PPm586mG4qh3pX2",
  "zsqzvUNerSIukWytZWvj": "FwMumC6iEidxf7p3WBP3olFKDdE3",
};

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

async function corrigerCollection(nomCollection, champId) {
  const snap = await db.collection(nomCollection).get();
  const aCorreger = [];
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const ancienId = data[champId];
    if (ancienId && MAPPING[ancienId]) {
      aCorreger.push({ docId: docSnap.id, champId, ancienId, nouvelId: MAPPING[ancienId] });
    }
  });

  console.log(`\n[${nomCollection}] ${aCorreger.length} document(s) à corriger (champ ${champId}) :`);
  const parId = new Map();
  aCorreger.forEach((c) => {
    const cle = `${c.ancienId} -> ${c.nouvelId}`;
    parId.set(cle, (parId.get(cle) || 0) + 1);
  });
  parId.forEach((count, cle) => console.log(`  - ${cle} (${count} document(s))`));

  if (!APPLY || aCorreger.length === 0) return;

  for (let i = 0; i < aCorreger.length; i += 500) {
    const batch = db.batch();
    aCorreger.slice(i, i + 500).forEach((c) => {
      batch.update(db.collection(nomCollection).doc(c.docId), { [champId]: c.nouvelId });
    });
    await batch.commit();
    console.log(`[${nomCollection}] Lot ${Math.floor(i / 500) + 1} appliqué (${Math.min(i + 500, aCorreger.length)}/${aCorreger.length}).`);
  }
}

async function main() {
  console.log(APPLY ? "Mode : APPLICATION RÉELLE" : "Mode : DRY-RUN (aucune écriture)");

  await corrigerCollection("planning_mediateurs", "mediatId");
  await corrigerCollection("planning_mediateurs", "mediateurId");
  await corrigerCollection("historique_agenda", "mediatId");

  if (!APPLY) {
    console.log("\nDry-run terminé. Relancez avec --apply pour effectuer la correction.");
  } else {
    console.log("\nCorrection terminée.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Importe le fichier "2026 _ Hauts-de-Seine_Structures - Établissement.csv"
// (annuaire de structures partenaires jeunesse/insertion des Hauts-de-Seine)
// dans la collection prospections/ (voir lib/prospections.ts).
//
// Le fichier a une structure à colonnes fixes et dupliquées (un bloc
// "Établissement" et un bloc "Gestionnaire" partageant les mêmes en-têtes
// Adresse/Code postal/Ville/Arrondissement/Téléphone/Email) — l'import
// générique par en-tête (lib/prospections.ts importerProspects) écraserait
// les valeurs du bloc Établissement avec celles du bloc Gestionnaire. Ce
// script dédié mappe donc chaque colonne par position et renomme les
// doublons ("... (établissement)" / "... (gestionnaire)") pour ne rien
// perdre. Le nom du prospect est la colonne composite "Établissement
// (Ville)" du fichier d'origine (colonne 2), qui désambiguïse déjà les
// établissements de même nom dans plusieurs villes.
//
// Usage :
//   node scripts/import-prospections-hds.js            # dry-run (aucune écriture)
//   node scripts/import-prospections-hds.js --apply     # applique réellement
//
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/import-prospections-hds.js --apply

const fs = require("fs");
const path = require("path");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const APPLY = process.argv.includes("--apply");
const CHEMIN_CSV = path.join(__dirname, "data", "hauts-de-seine-structures.csv");

// Même parseur que lib/prospections.ts (gère guillemets, retours à la ligne
// internes et séparateur ",").
function parserCSV(texte) {
  const contenu = texte.replace(/^﻿/, "");
  const separateur = ",";

  function parserLignes(texteComplet) {
    const lignes = [];
    let ligneCourante = [];
    let champCourant = "";
    let dansGuillemets = false;
    for (let i = 0; i < texteComplet.length; i++) {
      const c = texteComplet[i];
      if (dansGuillemets) {
        if (c === '"' && texteComplet[i + 1] === '"') { champCourant += '"'; i++; }
        else if (c === '"') { dansGuillemets = false; }
        else { champCourant += c; }
      } else if (c === '"') {
        dansGuillemets = true;
      } else if (c === separateur) {
        ligneCourante.push(champCourant);
        champCourant = "";
      } else if (c === "\n") {
        ligneCourante.push(champCourant);
        lignes.push(ligneCourante);
        ligneCourante = [];
        champCourant = "";
      } else if (c === "\r") {
        // ignoré, \n gère le saut de ligne
      } else {
        champCourant += c;
      }
    }
    if (champCourant !== "" || ligneCourante.length > 0) {
      ligneCourante.push(champCourant);
      lignes.push(ligneCourante);
    }
    return lignes;
  }

  return parserLignes(contenu).filter((l) => l.some((v) => v.trim() !== ""));
}

// Mappe chaque colonne (par position, 0-indexée) vers sa clé finale dans
// `champs`. `null` = colonne ignorée (vide/séparateur ou doublon de la
// colonne 1 utilisée comme nom).
const COLONNES = [
  null, // 0 — toujours vide dans ce fichier
  null, // 1 — libellé composite "Établissement (Ville)", utilisé comme nom
  "Établissement",
  "Adresse (établissement)",
  "Code postal (établissement)",
  "Ville (établissement)",
  "Arrondissement (établissement)",
  "Téléphone (établissement)",
  "Email (établissement)",
  "Directeur",
  "Contact Directeur",
  "Directeur adjoint",
  "Contact Directeur adjoint",
  "Informations diverses",
  null, // 14 — séparateur vide entre les deux blocs
  "Gestionnaire",
  "Adresse (gestionnaire)",
  "Code postal (gestionnaire)",
  "Ville (gestionnaire)",
  "Arrondissement (gestionnaire)",
  "Téléphone (gestionnaire)",
  "Email (gestionnaire)",
  "Président",
  "Contact Président",
  "Directeur Général",
  "Contact Directeur Général",
  "Directeur général adjoint / Directeur de pôle",
  "Contact Directeur général adjoint / directeur de pôle",
];

function construireProspects(lignes) {
  // La toute première ligne du fichier est entièrement vide (que des
  // virgules) — parserCSV() la filtre déjà (son filtre final retire les
  // lignes sans aucune valeur non vide). lignes[0] est donc directement la
  // ligne d'en-têtes réelle, et les données utiles commencent à l'index 1.
  return lignes.slice(1).map((valeurs) => {
    const nom = (valeurs[1] || "").replace(/\s+/g, " ").trim();
    const champs = {};
    COLONNES.forEach((cle, i) => {
      if (!cle) return;
      const valeur = (valeurs[i] || "").replace(/\s+/g, " ").trim();
      if (valeur) champs[cle] = valeur;
    });
    return { nom, champs };
  }).filter((p) => p.nom);
}

async function main() {
  const texte = fs.readFileSync(CHEMIN_CSV, "utf-8");
  const lignes = parserCSV(texte);
  const prospects = construireProspects(lignes);

  console.log(`${prospects.length} structures trouvées dans le fichier.`);
  console.log("Exemple (1ère ligne) :", JSON.stringify(prospects[0], null, 2));

  if (!APPLY) {
    console.log("\nDry-run — relance avec --apply pour écrire dans Firestore.");
    return;
  }

  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();
  const maintenant = new Date().toISOString();

  let nb = 0;
  for (let depart = 0; depart < prospects.length; depart += 450) {
    const batch = db.batch();
    for (const p of prospects.slice(depart, depart + 450)) {
      const ref = db.collection("prospections").doc();
      batch.set(ref, { nom: p.nom, champs: p.champs, annotations: [], creeLe: maintenant, majLe: maintenant });
      nb++;
    }
    await batch.commit();
    console.log(`${nb} fiches écrites...`);
  }
  console.log(`Terminé — ${nb} fiches créées dans prospections/.`);
}

main().catch((err) => { console.error(err); process.exit(1); });

// Module "Prospections" : suivi générique d'une liste de prospects importée
// depuis un fichier (CSV), avec une fiche par prospect et un journal
// d'annotations datées ("contacté le 01/10 par Trucmuche"). Les colonnes du
// fichier importé ne sont pas connues à l'avance — chaque prospect garde
// toutes ses colonnes d'origine telles quelles dans `champs` (clé = en-tête
// du fichier), plutôt qu'un schéma figé, pour s'adapter à n'importe quel
// fichier fourni sans migration.

import { db } from "@/lib/firebase";
import {
  collection, doc, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, writeBatch,
} from "firebase/firestore";

export interface AnnotationProspect {
  id: string;
  texte: string;
  auteur: string;
  date: string; // ISO — saisie au moment de l'ajout, pas serverTimestamp (affichée immédiatement, triable)
}

export interface Prospect {
  id: string;
  nom: string;
  champs: Record<string, string>; // toutes les colonnes importées, clé = en-tête d'origine du fichier
  annotations: AnnotationProspect[];
  // Statut de contact explicite, indépendant des annotations : une
  // annotation peut exister sans qu'un contact ait eu lieu (ex. "Mise en
  // annuaire"), donc on ne déduit jamais "contacté" du simple fait d'avoir
  // une note — seul ce booléen, coché à la main, compte pour les stats.
  contacte?: boolean;
  creeLe: string;
  majLe: string;
}

function refProspections() {
  return collection(db, "prospections");
}

export function ecouterProspects(callback: (prospects: Prospect[]) => void) {
  const q = query(refProspections(), orderBy("nom"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Prospect, "id">) })));
  });
}

export async function chargerProspect(id: string): Promise<Prospect | null> {
  const snap = await getDoc(doc(db, "prospections", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Prospect, "id">) };
}

export function ecouterProspect(id: string, callback: (prospect: Prospect | null) => void) {
  return onSnapshot(doc(db, "prospections", id), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Prospect, "id">) } : null);
  });
}

export async function creerProspect(nom: string, champs: Record<string, string> = {}): Promise<string> {
  const maintenant = new Date().toISOString();
  const ref = await addDoc(refProspections(), {
    nom, champs, annotations: [] as AnnotationProspect[], creeLe: maintenant, majLe: maintenant,
  });
  return ref.id;
}

export async function mettreAJourChampsProspect(id: string, nom: string, champs: Record<string, string>) {
  await updateDoc(doc(db, "prospections", id), { nom, champs, majLe: new Date().toISOString() });
}

export async function ajouterAnnotation(id: string, texte: string, auteur: string, prospect: Prospect) {
  const annotation: AnnotationProspect = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    texte, auteur, date: new Date().toISOString(),
  };
  await updateDoc(doc(db, "prospections", id), {
    annotations: [...prospect.annotations, annotation],
    majLe: new Date().toISOString(),
  });
}

export async function supprimerAnnotation(id: string, annotationId: string, prospect: Prospect) {
  await updateDoc(doc(db, "prospections", id), {
    annotations: prospect.annotations.filter((a) => a.id !== annotationId),
    majLe: new Date().toISOString(),
  });
}

export async function definirContacte(id: string, contacte: boolean) {
  await updateDoc(doc(db, "prospections", id), { contacte, majLe: new Date().toISOString() });
}

export async function supprimerProspect(id: string) {
  await deleteDoc(doc(db, "prospections", id));
}

// Écrit un lot de prospects d'un coup (import CSV) — colonneNom désigne la
// clé de `ligne` à utiliser comme nom affiché ; le reste de la ligne est
// conservé tel quel dans `champs`, colonneNom incluse, pour ne rien perdre
// du fichier d'origine.
export async function importerProspects(lignes: Record<string, string>[], colonneNom: string): Promise<number> {
  const maintenant = new Date().toISOString();
  let nb = 0;
  // writeBatch est limité à 500 écritures ; on découpe le fichier par lots.
  for (let depart = 0; depart < lignes.length; depart += 450) {
    const batch = writeBatch(db);
    for (const ligne of lignes.slice(depart, depart + 450)) {
      const nom = (ligne[colonneNom] || "").trim();
      if (!nom) continue;
      const ref = doc(refProspections());
      batch.set(ref, { nom, champs: ligne, annotations: [], creeLe: maintenant, majLe: maintenant });
      nb++;
    }
    await batch.commit();
  }
  return nb;
}

// Parseur CSV simple (gère les champs entre guillemets et les virgules ou
// points-virgules à l'intérieur) — détecte automatiquement le séparateur
// (";" est l'export par défaut d'Excel en français, "," sinon).
export function parserCSV(texte: string): { entetes: string[]; lignes: Record<string, string>[] } {
  const contenu = texte.replace(/^﻿/, ""); // retire le BOM UTF-8 si présent
  const premiereLigne = contenu.split(/\r\n|\n/)[0] || "";
  const separateur = (premiereLigne.match(/;/g)?.length || 0) > (premiereLigne.match(/,/g)?.length || 0) ? ";" : ",";

  function parserLigne(ligne: string): string[] {
    const valeurs: string[] = [];
    let courant = "";
    let dansGuillemets = false;
    for (let i = 0; i < ligne.length; i++) {
      const c = ligne[i];
      if (dansGuillemets) {
        if (c === '"' && ligne[i + 1] === '"') { courant += '"'; i++; }
        else if (c === '"') { dansGuillemets = false; }
        else { courant += c; }
      } else if (c === '"') {
        dansGuillemets = true;
      } else if (c === separateur) {
        valeurs.push(courant);
        courant = "";
      } else {
        courant += c;
      }
    }
    valeurs.push(courant);
    return valeurs.map((v) => v.trim());
  }

  const lignesBrutes = contenu.split(/\r\n|\n/).filter((l) => l.trim() !== "");
  if (lignesBrutes.length === 0) return { entetes: [], lignes: [] };

  const entetes = parserLigne(lignesBrutes[0]);
  const lignes = lignesBrutes.slice(1).map((ligne) => {
    const valeurs = parserLigne(ligne);
    const objet: Record<string, string> = {};
    entetes.forEach((entete, i) => { objet[entete] = valeurs[i] ?? ""; });
    return objet;
  });

  return { entetes, lignes };
}

// Devine la colonne la plus probable pour "Nom" parmi les en-têtes
// importées — à défaut, la première colonne.
export function devinerColonneNom(entetes: string[]): string {
  const motsClefs = ["nom", "name", "raison sociale", "structure", "entreprise", "société", "societe", "organisme"];
  const trouve = entetes.find((e) => motsClefs.some((m) => e.toLowerCase().includes(m)));
  return trouve || entetes[0] || "";
}

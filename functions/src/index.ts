import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { google as googleType } from "googleapis";

// Synchronise "planning_mediateurs" vers un calendrier Google secondaire
// dédié par personne ("COSMOS — Planning", créé lors de la connexion depuis
// /mon-compte — voir app/api/google-calendar/callback/route.ts). Un seul
// trigger Firestore couvre TOUTES les écritures existantes sur cette
// collection (création manuelle, glisser-déposer, édition en masse depuis un
// modèle, génération par lot via writeBatch...) sans qu'aucune des pages qui
// écrivent ce document n'ait besoin d'être modifiée — voir le plan validé.
//
// Sens unique COSMOS -> Google, "best effort" : une erreur ici est seulement
// loguée, jamais renvoyée à l'utilisateur ni retentée automatiquement (le
// document Firestore, source de vérité, est déjà écrit avant que cette
// fonction ne s'exécute).

initializeApp();
const db = getFirestore();

const GOOGLE_OAUTH_CLIENT_ID = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");

// Champs dont un changement doit répercuter une mise à jour de l'événement
// Google — "ordre" (position dans la demi-journée) en est volontairement
// exclu, de même que googleEventId lui-même (posé par cette fonction, sans
// quoi sa propre écriture se re-déclencherait indéfiniment).
const CHAMPS_SUIVIS = ["date", "debut", "fin", "lieu", "adresse", "commentaire", "territoire"];

function champsPertinentsIdentiques(avant: any, apres: any): boolean {
  return CHAMPS_SUIVIS.every((champ) => (avant?.[champ] || "") === (apres?.[champ] || ""));
}

// "googleapis" est un très gros paquet (des milliers de définitions d'API) :
// l'importer au niveau module ferait dépasser le délai de 10s que la CLI
// s'accorde pour inspecter le fichier au déploiement ("Cannot determine
// backend specification. Timeout after 10000"). On ne le charge donc qu'à la
// première exécution réelle du trigger, jamais pendant cette inspection.
let modeleGoogle: typeof googleType | undefined;
async function obtenirGoogle(): Promise<typeof googleType> {
  if (!modeleGoogle) {
    modeleGoogle = (await import("googleapis")).google;
  }
  return modeleGoogle;
}

// Résout le calendrier Google secondaire d'un médiateur — null si la
// personne n'a jamais connecté son compte (cas normal et fréquent, pas une
// erreur : la synchro est purement opt-in).
async function resoudreCalendrier(mediatId: string | undefined) {
  if (!mediatId) return null;
  const snap = await db.collection("oauth_google_tokens").doc(mediatId).get();
  if (!snap.exists) return null;
  const donnees = snap.data() as { refreshToken?: string; calendarId?: string };
  if (!donnees.refreshToken || !donnees.calendarId) return null;

  const google = await obtenirGoogle();
  const client = new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID.value(), GOOGLE_OAUTH_CLIENT_SECRET.value());
  client.setCredentials({ refresh_token: donnees.refreshToken });
  return { calendar: google.calendar({ version: "v3", auth: client }), calendarId: donnees.calendarId };
}

function construireEvenement(action: any) {
  const summary = action.lieu || "Action";
  const description = action.commentaire || undefined;
  const location = action.adresse || undefined;

  if (action.date && action.debut && action.fin) {
    return {
      summary,
      description,
      location,
      start: { dateTime: `${action.date}T${action.debut}:00`, timeZone: "Europe/Paris" },
      end: { dateTime: `${action.date}T${action.fin}:00`, timeZone: "Europe/Paris" },
    };
  }
  // Repli journée entière si l'horaire n'est pas renseigné (rare sur cette
  // collection, mais évite un événement invalide côté API Google).
  return {
    summary,
    description,
    location,
    start: { date: action.date },
    end: { date: action.date },
  };
}

export const synchroniserPlanningMediateurs = onDocumentWritten(
  {
    document: "planning_mediateurs/{docId}",
    region: "europe-west1",
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET],
  },
  async (event) => {
    const avantSnap = event.data?.before;
    const apresSnap = event.data?.after;
    const avant = avantSnap?.exists ? avantSnap.data() : undefined;
    const apres = apresSnap?.exists ? apresSnap.data() : undefined;
    const docRef = apresSnap?.ref || avantSnap?.ref;
    if (!docRef) return;

    try {
      // Suppression du créneau.
      if (!apres) {
        if (!avant) return;
        const ctx = await resoudreCalendrier(avant.mediatId);
        if (ctx && avant.googleEventId) {
          await ctx.calendar.events.delete({ calendarId: ctx.calendarId, eventId: avant.googleEventId }).catch((err) => {
            console.error("Suppression événement Google échouée :", err);
          });
        }
        return;
      }

      // Garde-fou anti-boucle : ignore une écriture qui ne change rien de
      // pertinent (notamment celle que cette fonction vient elle-même de
      // faire pour poser googleEventId).
      if (avant && avant.mediatId === apres.mediatId && champsPertinentsIdentiques(avant, apres)) {
        return;
      }

      // Réaffectation à une autre personne : supprime chez l'ancien
      // titulaire avant de (re)créer chez le nouveau ci-dessous.
      if (avant?.mediatId && apres.mediatId && avant.mediatId !== apres.mediatId && avant.googleEventId) {
        const ancienCtx = await resoudreCalendrier(avant.mediatId);
        if (ancienCtx) {
          await ancienCtx.calendar.events.delete({ calendarId: ancienCtx.calendarId, eventId: avant.googleEventId }).catch((err) => {
            console.error("Suppression événement Google (réaffectation) échouée :", err);
          });
        }
      }

      const ctx = await resoudreCalendrier(apres.mediatId);
      if (!ctx) return; // Personne non connectée à Google Agenda.

      const evenement = construireEvenement(apres);
      const dejaLie = !!(avant && avant.mediatId === apres.mediatId && apres.googleEventId);

      if (dejaLie) {
        await ctx.calendar.events.patch({
          calendarId: ctx.calendarId,
          eventId: apres.googleEventId,
          requestBody: evenement,
        });
      } else {
        const { data: cree } = await ctx.calendar.events.insert({
          calendarId: ctx.calendarId,
          requestBody: evenement,
        });
        await docRef.update({ googleEventId: cree.id });
      }
    } catch (err) {
      console.error("Synchronisation Google Agenda échouée :", err);
    }
  }
);

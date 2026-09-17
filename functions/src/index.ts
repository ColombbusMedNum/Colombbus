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
const CHAMPS_SUIVIS = ["date", "debut", "fin", "lieu", "adresse", "commentaire", "territoire", "codeACI"];

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

// Retente un appel à l'API Google Agenda en cas de quota dépassé
// ("rateLimitExceeded"/429) — arrive typiquement lors d'une resynchro en
// masse (bouton "Forcer la resynchronisation", ou rattrapage à la première
// connexion) qui déclenche beaucoup d'appels d'un coup pour le même compte :
// sans cette reprise, une partie des créneaux échouait silencieusement et ne
// se retrouvait jamais dans Google Agenda. Délai croissant (1s, 3s, 8s).
async function avecRelance<T>(appel: () => Promise<T>, tentatives = 4): Promise<T> {
  const delais = [1000, 3000, 8000];
  for (let essai = 0; ; essai++) {
    try {
      return await appel();
    } catch (err: any) {
      const estLimiteDebit = err?.code === 429 || err?.response?.status === 429
        || (err?.code === 403 && /rateLimitExceeded|quotaExceeded|userRateLimitExceeded/i.test(JSON.stringify(err?.errors || err?.message || "")));
      if (!estLimiteDebit || essai >= tentatives - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delais[essai] || 8000));
    }
  }
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

// Adresse email d'un médiateur/ACI (fiche liste_mediateurs.email) — null si
// absente, ce qui n'est pas une erreur (anciennes fiches non renseignées).
async function resoudreEmailMediateur(mediatId: string | undefined): Promise<string | null> {
  if (!mediatId) return null;
  const snap = await db.collection("liste_mediateurs").doc(mediatId).get();
  const email = snap.exists ? (snap.data()?.email as string | undefined) : undefined;
  return email && email.trim() ? email.trim() : null;
}

function construireEvenement(action: any, emailProprietaire: string | null) {
  // "codeACI" (ex. "#accueil"), quand renseigné sur le modèle, est ajouté en
  // préfixe du titre pour l'intégration aux agendas ACI — le commentaire va
  // dans la description, l'adresse dans le lieu (déjà gérés ci-dessous).
  const summary = action.codeACI ? `${action.codeACI} ${action.lieu || "Action"}` : (action.lieu || "Action");
  const description = action.commentaire || undefined;
  const location = action.adresse || undefined;
  // Les réglages de notification par calendrier (eventCreation/eventChange)
  // ne concernent que les changements faits par QUELQU'UN D'AUTRE sur un
  // agenda partagé — jamais les événements que le propriétaire crée
  // lui-même via sa propre autorisation API, même si l'appelant réel est
  // COSMOS. Seule méthode fiable pour obtenir un vrai email : l'inscrire
  // comme invité de son propre événement et demander l'envoi via
  // sendUpdates="all" (voir les appels events.insert/patch/delete).
  const attendees = emailProprietaire ? [{ email: emailProprietaire, responseStatus: "accepted" }] : undefined;

  if (action.date && action.debut && action.fin) {
    return {
      summary,
      description,
      location,
      attendees,
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
    attendees,
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
          await avecRelance(() => ctx.calendar.events.delete({ calendarId: ctx.calendarId, eventId: avant.googleEventId, sendUpdates: "all" })).catch((err) => {
            console.error("Suppression événement Google échouée :", err);
          });
        }
        return;
      }

      // "resyncGoogleDemande" (horodatage) permet de forcer une resynchro
      // sans rien changer d'autre — posé en masse depuis /agenda ou
      // /mediation/modeles ("Resynchroniser avec Google Agenda" sur un
      // modèle) pour rattraper des créneaux créés avant que la personne
      // n'ait connecté son compte Google. Sans ce champ, le garde-fou
      // anti-boucle ci-dessous ignorerait ces écritures de rattrapage
      // puisqu'elles ne touchent justement à aucun champ pertinent.
      const demandeResyncChangee = (avant?.resyncGoogleDemande || null) !== (apres.resyncGoogleDemande || null);

      // Garde-fou anti-boucle : ignore une écriture qui ne change rien de
      // pertinent (notamment celle que cette fonction vient elle-même de
      // faire pour poser googleEventId).
      if (avant && avant.mediatId === apres.mediatId && champsPertinentsIdentiques(avant, apres) && !demandeResyncChangee) {
        return;
      }

      // Réaffectation à une autre personne : supprime chez l'ancien
      // titulaire avant de (re)créer chez le nouveau ci-dessous.
      if (avant?.mediatId && apres.mediatId && avant.mediatId !== apres.mediatId && avant.googleEventId) {
        const ancienCtx = await resoudreCalendrier(avant.mediatId);
        if (ancienCtx) {
          await avecRelance(() => ancienCtx.calendar.events.delete({ calendarId: ancienCtx.calendarId, eventId: avant.googleEventId, sendUpdates: "all" })).catch((err) => {
            console.error("Suppression événement Google (réaffectation) échouée :", err);
          });
        }
      }

      const ctx = await resoudreCalendrier(apres.mediatId);
      if (!ctx) return; // Personne non connectée à Google Agenda.

      const emailProprietaire = await resoudreEmailMediateur(apres.mediatId);
      const evenement = construireEvenement(apres, emailProprietaire);
      const dejaLie = !!(avant && avant.mediatId === apres.mediatId && apres.googleEventId);

      if (dejaLie) {
        try {
          await avecRelance(() => ctx.calendar.events.patch({
            calendarId: ctx.calendarId,
            eventId: apres.googleEventId,
            requestBody: evenement,
            sendUpdates: "all",
          }));
        } catch (err: any) {
          // L'événement lié n'existe plus dans CE calendrier — typiquement
          // après une déconnexion/reconnexion (le calendrier "COSMOS —
          // Planning" a été recréé avec un nouvel id, mais le document garde
          // l'ancien googleEventId), ou une suppression manuelle côté
          // Google. Plutôt que d'échouer silencieusement à chaque écriture
          // suivante, on recrée l'événement et on repose le bon id.
          if (err?.code === 404 || err?.response?.status === 404) {
            const { data: cree } = await avecRelance(() => ctx.calendar.events.insert({
              calendarId: ctx.calendarId,
              requestBody: evenement,
              sendUpdates: "all",
            }));
            await docRef.update({ googleEventId: cree.id });
          } else {
            throw err;
          }
        }
      } else {
        const { data: cree } = await avecRelance(() => ctx.calendar.events.insert({
          calendarId: ctx.calendarId,
          requestBody: evenement,
          sendUpdates: "all",
        }));
        await docRef.update({ googleEventId: cree.id });
      }
    } catch (err) {
      console.error("Synchronisation Google Agenda échouée :", err);
    }
  }
);

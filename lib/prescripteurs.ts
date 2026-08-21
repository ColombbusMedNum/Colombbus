import { db } from "@/lib/firebase";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";

// Annuaire centralisé des prescripteurs (organisme + référent·e), partagé par
// les 3 formulaires d'inscription (Numérik'UP, Digital'UP, NUMERIK PRO) —
// évite que la même Mission locale / le même conseiller ressaisi à chaque
// inscription finisse par exister sous des orthographes légèrement
// différentes.
export interface Prescripteur {
  id: string;
  organisme?: string;
  referentPrenom?: string;
  referentNom?: string;
  referentTelephone?: string;
  referentEmail?: string;
}

export async function chargerPrescripteurs(): Promise<Prescripteur[]> {
  const snap = await getDocs(collection(db, "prescripteurs"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Prescripteur));
}

const normalise = (s?: string) => (s || "").trim().toLowerCase();

// Ajoute un nouveau prescripteur seulement si aucun existant ne correspond
// déjà (email normalisé en priorité, sinon nom+prénom+téléphone) — appelé
// après la création d'une inscription pour que l'annuaire s'enrichisse tout
// seul, sans jamais dupliquer une entrée déjà connue.
export async function upsertPrescripteur(
  existants: Prescripteur[],
  champs: { organisme?: string; referentPrenom?: string; referentNom?: string; referentTelephone?: string; referentEmail?: string }
): Promise<void> {
  const { organisme, referentPrenom, referentNom, referentTelephone, referentEmail } = champs;
  if (!referentNom && !referentPrenom && !organisme) return;
  const emailN = normalise(referentEmail);
  const dejaConnu = existants.some((p) =>
    emailN
      ? normalise(p.referentEmail) === emailN
      : normalise(p.referentNom) === normalise(referentNom) &&
        normalise(p.referentPrenom) === normalise(referentPrenom) &&
        normalise(p.referentTelephone) === normalise(referentTelephone)
  );
  if (dejaConnu) return;
  await addDoc(collection(db, "prescripteurs"), {
    organisme: organisme || "",
    referentPrenom: referentPrenom || "",
    referentNom: referentNom || "",
    referentTelephone: referentTelephone || "",
    referentEmail: referentEmail || "",
    createdAt: serverTimestamp(),
  });
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Quicksand } from "next/font/google";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { normalizeRole } from "@/lib/roles";
import { usePermissions } from "@/lib/PermissionsProvider";
import { useMediateurs } from "@/lib/MediateursProvider";
import { estActionDuMediateur } from "@/lib/matchMediateur";
import { getJoursFeries } from "@/lib/activitesTypes";
import type { Mediateur, ActionPlanning } from "@/lib/types";
import {
  EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, ShieldExclamationIcon,
  ArrowRightEndOnRectangleIcon, ChevronLeftIcon, ChevronRightIcon, ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(date.setDate(diff));
  mon.setHours(12, 0, 0, 0);
  return mon;
}

// Page unique "Mon planning" : formulaire de connexion et affichage du
// planning perso au même endroit (pas de redirection vers /login puis
// /agenda/mobile), pour un accès mobile le plus direct possible. Mêmes
// identifiants Firebase Auth que le reste de l'appli — même session posée
// ensuite (cookies + localStorage), donc naviguer vers le site complet
// depuis ici fonctionne normalement.
export default function PlanningPage() {
  const { user, loading: permLoading } = usePermissions();

  return (
    <main className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] font-medium antialiased`}>
      {permLoading ? (
        <div className="min-h-screen flex items-center justify-center text-[#EA601F] font-bold text-xs uppercase tracking-widest animate-pulse">
          Chargement...
        </div>
      ) : !user ? (
        <FormulaireConnexion />
      ) : (
        <MonPlanning />
      )}
    </main>
  );
}

function FormulaireConnexion() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const emailNettoye = email.trim().toLowerCase();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailNettoye, password);
      const user = userCredential.user;
      const token = await user.getIdToken();

      let roleRaw: string | null = null;
      let actif = true;
      const uidDoc = await getDoc(doc(db, "liste_mediateurs", user.uid));
      if (uidDoc.exists()) {
        roleRaw = uidDoc.data().role || null;
        actif = uidDoc.data().actif !== false;
      } else {
        const q = query(collection(db, "liste_mediateurs"), where("email", "==", emailNettoye));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          roleRaw = querySnapshot.docs[0].data().role || null;
          actif = querySnapshot.docs[0].data().actif !== false;
        }
      }

      if (!actif) {
        await signOut(auth);
        setError("Ce compte a été désactivé. Contactez un administrateur si vous pensez qu'il s'agit d'une erreur.");
        setLoading(false);
        return;
      }

      const role = normalizeRole(roleRaw);

      const premiereConnexionRef = doc(db, "premieres_connexions", user.uid);
      getDoc(premiereConnexionRef).then((snap) => {
        if (!snap.exists()) {
          setDoc(premiereConnexionRef, { effectuee: true, date: serverTimestamp() }).catch(() => {});
        }
      }).catch(() => {});

      // Même session que la connexion normale (voir app/login/page.tsx) :
      // naviguer ensuite vers le reste de l'appli depuis ici fonctionne.
      const maxAge = 3 * 24 * 60 * 60;
      document.cookie = `session_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
      document.cookie = `user_role=${role}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
      localStorage.setItem("user_role", role);
      localStorage.setItem("user_email", emailNettoye);
      localStorage.setItem("login_timestamp", Date.now().toString());
      // PermissionsProvider (global) détecte la connexion automatiquement
      // via onAuthStateChanged — pas besoin de router.push, le composant
      // parent bascule de lui-même sur <MonPlanning/>.
    } catch (err: any) {
      console.error("Erreur de connexion :", err.code, err);
      if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(err.code)) {
        setError("Identifiants incorrects. Si c'est votre première connexion, utilisez \"Mot de passe oublié\" depuis la connexion complète.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Compte temporairement bloqué suite à un trop grand nombre de tentatives. Veuillez patienter.");
      } else {
        setError(err.message || "Une erreur est survenue lors de la connexion.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-[#404040]/10 rounded-3xl p-6 shadow-sm">
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="mb-2 relative w-12 h-12">
            <Image src="/logos/Logo_Colombbus_noir_trans.png" alt="Logo Colombbus" fill sizes="48px" className="object-contain" priority />
          </div>
          <h1 className="text-xl font-black uppercase text-[#005259] tracking-tight">Mon planning</h1>
          <p className="text-xs text-[#404040]/60 font-medium mt-2">
            Connecte-toi pour afficher directement ton planning de la semaine.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-red-700 text-xs font-semibold">
            <ShieldExclamationIcon className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3 text-xs">
          <div className="relative">
            <EnvelopeIcon className="w-4 h-4 text-[#404040]/40 absolute left-3.5 top-3.5" />
            <input
              type="email" required placeholder="nom@colombbus.org" disabled={loading}
              className="w-full pl-10 pr-4 py-3 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white text-[#404040] rounded-xl outline-none transition-all font-medium"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <LockClosedIcon className="w-4 h-4 text-[#404040]/40 absolute left-3.5 top-3.5" />
            <input
              type={motDePasseVisible ? "text" : "password"} placeholder="••••••••" disabled={loading}
              className="w-full pl-10 pr-10 py-3 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white text-[#404040] rounded-xl outline-none transition-all font-medium"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setMotDePasseVisible((v) => !v)} tabIndex={-1} className="absolute right-3.5 top-3.5 text-[#404040]/40 hover:text-[#005259]">
              {motDePasseVisible ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-3.5 bg-[#EA601F] hover:bg-[#d55318] disabled:bg-[#EA601F]/50 text-white font-extrabold uppercase tracking-widest text-xs rounded-xl transition-all shadow-sm active:scale-95 mt-4 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ArrowRightEndOnRectangleIcon className="w-4 h-4" />
                <span>Afficher mon planning</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-5">
          <a href="/login" className="text-[11px] font-bold text-[#404040]/60 hover:text-[#EA601F] underline">
            Mot de passe oublié / première connexion ?
          </a>
        </div>
      </div>
    </div>
  );
}

function MonPlanning() {
  const { user } = usePermissions();
  const { mediateurs: mediateursBruts } = useMediateurs();

  const monProfil = useMemo(() => {
    if (!user?.email) return null;
    return (mediateursBruts as Mediateur[]).find((m) => m.email?.toLowerCase() === user.email!.toLowerCase()) || null;
  }, [mediateursBruts, user]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [actions, setActions] = useState<ActionPlanning[]>([]);
  const [loading, setLoading] = useState(true);

  const monday = useMemo(() => getMonday(currentDate), [currentDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 6 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; }),
    [monday]
  );

  useEffect(() => {
    const debut = weekDays[0].toLocaleDateString("en-CA");
    const fin = weekDays[weekDays.length - 1].toLocaleDateString("en-CA");
    const q = query(collection(db, "planning_mediateurs"), where("date", ">=", debut), where("date", "<=", fin));
    const unsub = onSnapshot(
      q,
      (snap) => { setActions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))); setLoading(false); },
      (error) => { console.error("Erreur de chargement du planning :", error); setLoading(false); }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDays[0]?.getTime()]);

  const mesActions = useMemo(() => {
    if (!monProfil) return [];
    return actions.filter((a) => estActionDuMediateur(a, monProfil));
  }, [actions, monProfil]);

  const joursFeries = useMemo(() => getJoursFeries(monday.getFullYear()), [monday]);

  const parJourEtMoment = useMemo(() => {
    const map: Record<string, string[]> = Object.create(null);
    mesActions.forEach((a) => {
      const cle = `${a.date}_${a.moment || ""}`;
      if (!map[cle]) map[cle] = [];
      map[cle].push(a.lieu || "Activité");
    });
    return map;
  }, [mesActions]);

  const handleLogout = async () => {
    document.cookie = "session_token=; path=/; max-age=0; SameSite=Lax; Secure";
    document.cookie = "user_role=; path=/; max-age=0; SameSite=Lax; Secure";
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    localStorage.removeItem("login_timestamp");
    await signOut(auth);
  };

  return (
    <div className="p-3">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#404040]/10">
          <div>
            <h1 className="text-lg font-black uppercase text-[#005259] tracking-tight">Mon planning</h1>
            {monProfil && <p className="text-[10px] text-[#404040]/60 font-bold uppercase">{monProfil.prenom} {monProfil.nom}</p>}
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="text-[10px] font-bold uppercase text-[#005259] underline">Site complet</a>
            <button onClick={handleLogout} title="Se déconnecter" className="p-1.5 bg-white border border-[#404040]/10 rounded-lg text-[#404040]/60 hover:text-[#EF736A] shadow-sm">
              <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white border border-[#404040]/10 rounded-xl p-2 shadow-sm">
          <button onClick={() => setCurrentDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7))} className="p-2 hover:bg-[#F3F3F2] rounded-lg text-[#005259]">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <span className="text-xs font-extrabold uppercase text-[#005259] text-center">
            {weekDays[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – {weekDays[weekDays.length - 1].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          </span>
          <button onClick={() => setCurrentDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7))} className="p-2 hover:bg-[#F3F3F2] rounded-lg text-[#005259]">
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
        <button onClick={() => setCurrentDate(new Date())} className="w-full text-center text-[10px] font-bold uppercase tracking-wider text-[#EA601F]">
          Revenir à cette semaine
        </button>

        {loading ? (
          <div className="text-center py-12 text-[#EA601F] font-bold text-xs animate-pulse uppercase tracking-widest">Chargement...</div>
        ) : !monProfil ? (
          <div className="text-center py-12 text-xs font-bold uppercase tracking-wider text-[#404040]/60 bg-white border border-[#404040]/10 rounded-xl">
            Aucune fiche médiateur associée à votre compte.
          </div>
        ) : (
          <div className="bg-white border border-[#404040]/10 rounded-xl overflow-hidden shadow-sm divide-y divide-[#F3F3F2]">
            <div className="bg-[#005259] text-white grid grid-cols-3 text-[10px] font-extrabold uppercase tracking-wider">
              <div className="p-2.5">Jour</div>
              <div className="p-2.5 text-center">Matin</div>
              <div className="p-2.5 text-center">Après-midi</div>
            </div>
            {weekDays.map((day) => {
              const dateStr = day.toLocaleDateString("en-CA");
              const estFerie = joursFeries.has(dateStr);
              const matin = parJourEtMoment[`${dateStr}_Matin`] || [];
              const apresMidi = parJourEtMoment[`${dateStr}_Après-midi`] || [];
              return (
                <div key={dateStr} className={`grid grid-cols-3 text-xs ${estFerie ? "bg-[#EF736A]/5" : ""}`}>
                  <div className="p-2.5">
                    <div className="font-bold text-[#005259]">{JOURS_SEMAINE[day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
                    <div className="text-[10px] text-[#404040]/60">{day.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>
                    {estFerie && <div className="text-[9px] font-black uppercase text-[#EF736A]">Férié</div>}
                  </div>
                  <div className="p-2.5 text-center break-words">
                    {matin.length > 0 ? matin.map((l, i) => <div key={i} className="text-[#404040] font-semibold">{l}</div>) : <span className="text-[#404040]/30">—</span>}
                  </div>
                  <div className="p-2.5 text-center break-words">
                    {apresMidi.length > 0 ? apresMidi.map((l, i) => <div key={i} className="text-[#404040] font-semibold">{l}</div>) : <span className="text-[#404040]/30">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Quicksand } from "next/font/google";
import { auth, db } from "../../lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { normalizeRole } from "../../lib/roles";
import { useRouter } from "next/navigation";
import { LockClosedIcon, EnvelopeIcon, ShieldExclamationIcon, ArrowRightEndOnRectangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!auth) {
      setError("Le service d'authentification n'est pas prêt. Veuillez rafraîchir la page.");
      return;
    }

    setLoading(true);
    const emailNettoye = email.trim().toLowerCase();

    try {
      // 1. Authentification avec Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, emailNettoye, password);
      const user = userCredential.user;
      const token = await user.getIdToken();

      // 2. Récupération du rôle utilisateur dans Firestore.
      // Le document liste_mediateurs doit être identifié par l'UID Firebase Auth
      // (requis par les Security Rules pour vérifier le rôle de l'appelant).
      let roleRaw: string | null = null;
      const uidDoc = await getDoc(doc(db, "liste_mediateurs", user.uid));
      if (uidDoc.exists()) {
        roleRaw = uidDoc.data().role || null;
      } else {
        // Repli transitoire : tant que le script de migration (voir
        // scripts/migrate-mediateurs-to-uid.js) n'a pas été exécuté, les
        // anciens comptes sont encore indexés par un ID Firestore aléatoire.
        const q = query(collection(db, "liste_mediateurs"), where("email", "==", emailNettoye));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          roleRaw = querySnapshot.docs[0].data().role || null;
        }
      }

      const role = normalizeRole(roleRaw);

      // 3. Stockage des informations de session (Cookies + LocalStorage)
      const maxAge = 7 * 24 * 60 * 60; // Durée : 7 jours
      document.cookie = `session_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
      document.cookie = `user_role=${role}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;

      localStorage.setItem("user_role", role);
      localStorage.setItem("user_email", emailNettoye);

      // 4. Redirection vers la page d'accueil principale
      router.push("/");
      
    } catch (err: any) {
      console.error("Erreur détectée :", err.code, err);
      
      // Gestion unifiée de l'erreur d'identifiants Firebase (V10+)
      if (
        err.code === "auth/invalid-credential" || 
        err.code === "auth/user-not-found" || 
        err.code === "auth/wrong-password"
      ) {
        setError(
          "Identifiants incorrects. S'il s'agit de votre première connexion, vous devez d'abord configurer votre mot de passe à l'aide du bouton de récupération ci-dessous."
        );
      } else if (err.code === "auth/too-many-requests") {
        setError(
          "Compte temporairement bloqué suite à un trop grand nombre de tentatives. Veuillez patienter un instant ou réinitialiser votre mot de passe."
        );
      } else {
        setError(err.message || "Une erreur est survenue lors de la connexion.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setSuccessMessage(null);

    const emailNettoye = email.trim().toLowerCase();

    if (!emailNettoye) {
      setError("Veuillez d'abord saisir votre adresse email dans le champ ci-dessus.");
      return;
    }

    setLoading(true);

    try {
      const q = query(collection(db, "liste_mediateurs"), where("email", "==", emailNettoye));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("Cette adresse email n'est pas répertoriée dans notre équipe.");
        return;
      }

      await sendPasswordResetEmail(auth, emailNettoye);
      setSuccessMessage(
        "Un e-mail de configuration / récupération de mot de passe vient de vous être envoyé. Pensez à vérifier vos spams !"
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue lors de l'envoi de l'e-mail.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] flex flex-col items-center justify-center p-4 relative overflow-hidden font-medium antialiased`}>
      
      {/* HALO LUMINEUX AMBIANT */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-white border border-[#404040]/10 rounded-3xl p-6 md:p-8 shadow-sm relative z-10">
        
        {/* LOGO & TITRES */}
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="mb-2 relative w-14 h-14 md:w-16 md:h-16">
            <Image 
              src="/logos/Logo_Colombbus_noir_trans.png" 
              alt="Logo Colombbus" 
              fill
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase text-[#005259]">
            Colombbus
          </h1>

          <div className="mt-1">
            <span className="inline-block px-3 py-0.5 rounded-full bg-[#EA601F]/10 border border-[#EA601F]/20 text-[#EA601F] text-[10px] font-black uppercase tracking-widest">
              Plateforme C.O.S.M.O.S.
            </span>
          </div>

          <p className="text-xs text-[#404040]/60 font-medium mt-3">
            Saisissez vos identifiants pour accéder à votre espace
          </p>
        </div>

        {/* Bloc d'affichage des erreurs */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-red-700 text-xs font-semibold">
            <ShieldExclamationIcon className="w-5 h-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Bloc d'affichage des succès */}
        {successMessage && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-800 text-xs font-semibold">
            <CheckCircleIcon className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Formulaire de saisie */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] font-black uppercase text-[#005259] mb-1.5 tracking-wider">Adresse Email *</label>
            <div className="relative">
              <EnvelopeIcon className="w-4 h-4 text-[#404040]/40 absolute left-3.5 top-3.5" />
              <input 
                type="email" 
                required 
                placeholder="nom@colombbus.org" 
                className="w-full pl-10 pr-4 py-3 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white text-[#404040] rounded-xl outline-none transition-all font-medium" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-[#005259] mb-1.5 tracking-wider">Mot de passe *</label>
            <div className="relative">
              <LockClosedIcon className="w-4 h-4 text-[#404040]/40 absolute left-3.5 top-3.5" />
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full pl-10 pr-4 py-3 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white text-[#404040] rounded-xl outline-none transition-all font-medium" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Bouton de validation */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 bg-[#EA601F] hover:bg-[#d55318] disabled:bg-[#EA601F]/50 text-white font-extrabold uppercase tracking-widest text-xs rounded-xl transition-all shadow-sm active:scale-95 mt-6 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ArrowRightEndOnRectangleIcon className="w-4 h-4" />
                <span>Se connecter</span>
              </>
            )}
          </button>
        </form>

        {/* Lien de récupération ou de première configuration */}
        <div className="text-center mt-6">
          <button
            type="button"
            disabled={loading}
            onClick={handleForgotPassword}
            className="text-[11px] font-bold text-[#404040]/60 hover:text-[#EA601F] transition-colors underline bg-transparent border-none cursor-pointer"
          >
            Première connexion ou mot de passe oublié ?
          </button>
        </div>

      </div>
    </div>
  );
}
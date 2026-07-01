"use client";

import React, { useState } from "react";
import { auth, db } from "../../lib/firebase"; 
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { LockClosedIcon, EnvelopeIcon, ShieldExclamationIcon, ArrowRightEndOnRectangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

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

      // 2. Récupération du rôle utilisateur dans Firestore
      const q = query(collection(db, "liste_mediateurs"), where("email", "==", emailNettoye));
      const querySnapshot = await getDocs(q);

      let roleRaw = "mediateur"; 
      if (!querySnapshot.empty) {
        const medData = querySnapshot.docs[0].data();
        roleRaw = medData.role || "mediateur";
      }

      const role = roleRaw.toLowerCase().trim() === "admin" ? "admin" : "mediateur";

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
    <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center p-4 font-sans selection:bg-emerald-500/30">
      <div className="w-full max-w-md bg-slate-950 border-2 border-slate-900 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        
        {/* Badge supérieur */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-emerald-400 text-xs font-black uppercase tracking-widest shadow-inner">
            <ArrowRightEndOnRectangleIcon className="w-4 h-4" />
            <span>Se connecter</span>
          </div>
        </div>

        {/* Titres */}
        <div className="text-center mb-8">
          <h1 className="text-xl md:text-2xl font-black uppercase bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent tracking-wide">
            Espace Connexion
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Saisissez vos identifiants Colombbus</p>
        </div>

        {/* Bloc d'affichage des erreurs */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-950/40 border border-red-900/60 rounded-xl flex items-center gap-2.5 text-red-400 text-xs font-semibold">
            <ShieldExclamationIcon className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Bloc d'affichage des succès */}
        {successMessage && (
          <div className="mb-5 p-3.5 bg-emerald-950/40 border border-emerald-900/60 rounded-xl flex items-start gap-2.5 text-emerald-400 text-xs font-semibold">
            <CheckCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Formulaire de saisie */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">Adresse Email *</label>
            <div className="relative">
              <EnvelopeIcon className="w-4 h-4 text-slate-600 absolute left-3 top-3.5" />
              <input 
                type="email" 
                required 
                placeholder="nom@colombbus.org" 
                className="w-full pl-10 pr-4 py-3 bg-slate-900/40 border border-slate-800 focus:border-emerald-500/80 text-white font-mono rounded-lg outline-none transition-colors" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">Mot de passe *</label>
            <div className="relative">
              <LockClosedIcon className="w-4 h-4 text-slate-600 absolute left-3 top-3.5" />
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full pl-10 pr-4 py-3 bg-slate-900/40 border border-slate-800 focus:border-emerald-500/80 text-white rounded-lg outline-none transition-colors" 
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
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg mt-6 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Valider"
            )}
          </button>
        </form>

        {/* Lien de récupération ou de première configuration */}
        <div className="text-center mt-6">
          <button
            type="button"
            disabled={loading}
            onClick={handleForgotPassword}
            className="text-[11px] font-bold text-slate-500 hover:text-emerald-400 transition-colors underline bg-transparent border-none cursor-pointer"
          >
            Première connexion ou mot de passe oublié ?
          </button>
        </div>

      </div>
    </div>
  );
}
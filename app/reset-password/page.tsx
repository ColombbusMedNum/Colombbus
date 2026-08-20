"use client";

import React, { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { Quicksand } from "next/font/google";
import { auth } from "../../lib/firebase";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { LockClosedIcon, ShieldExclamationIcon, CheckCircleIcon, KeyIcon } from "@heroicons/react/24/outline";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Page d'activation / réinitialisation de mot de passe, appelée directement
// par le lien envoyé par sendPasswordResetEmail (voir app/login/page.tsx et
// app/mediation/equipe/page.tsx, qui passent tous les deux actionCodeSettings
// avec url=.../reset-password et handleCodeInApp:true). Remplace la page
// générique hébergée par Firebase par une page à l'identique du reste du
// site, avec double saisie du mot de passe.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode") || "";

  const [verification, setVerification] = useState<"en_cours" | "valide" | "invalide">("en_cours");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setVerification("invalide");
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((emailAssocie) => {
        setEmail(emailAssocie);
        setVerification("valide");
      })
      .catch(() => setVerification("invalide"));
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    if (motDePasse.length < 6) {
      setErreur("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setEnvoiEnCours(true);
    try {
      await confirmPasswordReset(auth, oobCode, motDePasse);
      router.push("/login?motDePasseDefini=1");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/expired-action-code") {
        setErreur("Ce lien a expiré. Demande un nouvel e-mail de configuration depuis la page de connexion.");
      } else if (err.code === "auth/weak-password") {
        setErreur("Ce mot de passe est trop faible — choisis-en un autre.");
      } else {
        setErreur("Une erreur est survenue lors de la mise à jour du mot de passe.");
      }
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className={`${quicksand.className} min-h-screen bg-[#F3F3F2] text-[#404040] flex flex-col items-center justify-center p-4 relative overflow-hidden font-medium antialiased`}>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#005259]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-white border border-[#404040]/10 rounded-3xl p-6 md:p-8 shadow-sm relative z-10">

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
            {verification === "valide" ? `Choisis ton mot de passe pour ${email}` : "Configuration du mot de passe"}
          </p>
        </div>

        {verification === "en_cours" && (
          <div className="flex justify-center py-8">
            <span className="inline-block w-6 h-6 border-2 border-[#005259]/20 border-t-[#005259] rounded-full animate-spin" />
          </div>
        )}

        {verification === "invalide" && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-red-700 text-xs font-semibold">
            <ShieldExclamationIcon className="w-5 h-5 shrink-0 text-red-600" />
            <span>Ce lien est invalide ou a expiré. Demande un nouvel e-mail de configuration depuis la page de connexion.</span>
          </div>
        )}

        {verification === "valide" && (
          <>
            {erreur && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-red-700 text-xs font-semibold">
                <ShieldExclamationIcon className="w-5 h-5 shrink-0 text-red-600" />
                <span>{erreur}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-[#005259] mb-1.5 tracking-wider">Nouveau mot de passe *</label>
                <div className="relative">
                  <LockClosedIcon className="w-4 h-4 text-[#404040]/40 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white text-[#404040] rounded-xl outline-none transition-all font-medium"
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    disabled={envoiEnCours}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-[#005259] mb-1.5 tracking-wider">Confirmer le mot de passe *</label>
                <div className="relative">
                  <KeyIcon className="w-4 h-4 text-[#404040]/40 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-[#F3F3F2] border border-[#404040]/15 focus:border-[#005259] focus:bg-white text-[#404040] rounded-xl outline-none transition-all font-medium"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    disabled={envoiEnCours}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={envoiEnCours}
                className="w-full py-3.5 bg-[#EA601F] hover:bg-[#d55318] disabled:bg-[#EA601F]/50 text-white font-extrabold uppercase tracking-widest text-xs rounded-xl transition-all shadow-sm active:scale-95 mt-6 flex items-center justify-center gap-2 cursor-pointer"
              >
                {envoiEnCours ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Valider mon mot de passe</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}

"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useRef } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const ConfirmContext = createContext<((message: string) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((msg: string) => {
    setMessage(msg);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleChoice = (choice: boolean) => {
    setMessage(null);
    resolveRef.current?.(choice);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {message && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[#F9945D]/15 rounded-xl text-[#EA601F] shrink-0">
                <ExclamationTriangleIcon className="w-5 h-5" />
              </div>
              <p className="text-sm text-[#404040] font-medium pt-1.5">{message}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleChoice(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase text-[#404040] bg-[#F3F3F2] hover:bg-[#404040]/10 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => handleChoice(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase text-white bg-[#EA601F] hover:bg-[#EF736A] transition-colors cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm doit être utilisé à l'intérieur de ConfirmProvider");
  return ctx;
}

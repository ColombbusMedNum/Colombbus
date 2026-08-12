"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

type ToastType = "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<{ showToast: (message: string, type?: ToastType) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 pointer-events-auto ${
              t.type === "error" ? "bg-[#EF736A]" : "bg-[#005259]"
            }`}
          >
            {t.type === "error" ? (
              <ExclamationCircleIcon className="w-5 h-5 shrink-0" />
            ) : (
              <CheckCircleIcon className="w-5 h-5 text-[#A9E0C9] shrink-0" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé à l'intérieur de ToastProvider");
  return ctx;
}

"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Toast, type ToastType } from "@/components/Toast";

type ShowToast = (message: string, type?: ToastType) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** One app-wide toast so pages and mutation hooks share it. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType; id: number } | null>(null);

  const show = useCallback<ShowToast>((message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  }, []);
  const close = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={close} />}
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  // Outside the provider (isolated renders), fall back to a no-op.
  return useMemo(() => ctx ?? (() => {}), [ctx]);
}

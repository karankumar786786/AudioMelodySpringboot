"use client";

import { AlertTriangle, X } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  /** Destructive actions are styled in red. */
  destructive?: boolean;
  /**
   * When set, the confirm button stays disabled until the user types this text exactly.
   * Required for destructive actions such as delete and block.
   */
  typeToConfirm?: string;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  const settle = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog options={pending} onSettle={settle} />}
    </ConfirmContext.Provider>
  );
}

/** Promise-based confirmation: `if (!(await confirm({...}))) return;` */
export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
}

function ConfirmDialog({ options, onSettle }: { options: ConfirmOptions; onSettle: (ok: boolean) => void }) {
  const { title, description, confirmLabel = "Confirm", destructive = false, typeToConfirm } = options;
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const matches = !typeToConfirm || typed.trim() === typeToConfirm.trim();

  useEffect(() => {
    (typeToConfirm ? inputRef.current : confirmRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSettle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [typeToConfirm, onSettle]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onSettle(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121215] text-white shadow-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (matches) onSettle(true);
          }}
        >
          <div className="flex items-start gap-3 p-5">
            {destructive && (
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 id="confirm-title" className="text-sm font-bold">
                {title}
              </h2>
              {description && <div className="mt-1.5 text-xs text-zinc-400 leading-relaxed">{description}</div>}
              {typeToConfirm && (
                <label className="mt-4 block text-xs text-zinc-400">
                  Type <span className="font-mono font-semibold text-white select-all">{typeToConfirm}</span> to confirm
                  <input
                    ref={inputRef}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    aria-label={`Type ${typeToConfirm} to confirm`}
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 font-mono text-xs text-white focus:border-white/40 focus:outline-none"
                  />
                </label>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSettle(false)}
              className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-3.5">
            <button
              type="button"
              onClick={() => onSettle(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="submit"
              disabled={!matches}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                destructive ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-white text-black hover:bg-zinc-200"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

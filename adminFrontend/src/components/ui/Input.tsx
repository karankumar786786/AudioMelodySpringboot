"use client";

import React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = "",
      leftIcon,
      rightIcon,
      error,
      label,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-zinc-300"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-zinc-500">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={`w-full bg-[#121215] border border-white/8 hover:border-white/14 focus:border-white/30 focus:bg-[#16161a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-zinc-600 disabled:opacity-50 disabled:pointer-events-none ${
              leftIcon ? "pl-10" : ""
            } ${rightIcon ? "pr-10" : ""} ${
              error ? "border-rose-500/50 focus:border-rose-500" : ""
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-zinc-500">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-[11px] text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";


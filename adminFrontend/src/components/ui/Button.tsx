"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold transition-all duration-150 rounded-xl cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

    const sizeStyles = {
      xs: "text-[11px] px-2.5 py-1 gap-1.5 h-7",
      sm: "text-xs px-3 py-1.5 gap-2 h-8.5",
      md: "text-xs px-4 py-2 gap-2 h-10",
      lg: "text-sm px-5 py-2.5 gap-2.5 h-11.5",
    }[size];

    const variantStyles = {
      primary:
        "bg-white hover:bg-zinc-200 text-black shadow-sm shadow-white/5 font-bold",
      secondary:
        "bg-[#16161a] hover:bg-[#202026] text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.14]",
      outline:
        "bg-transparent hover:bg-white/[0.05] text-zinc-300 hover:text-white border border-white/[0.1] hover:border-white/[0.2]",
      ghost:
        "bg-transparent hover:bg-white/[0.06] text-zinc-400 hover:text-white",
      danger:
        "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/30",
    }[variant];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

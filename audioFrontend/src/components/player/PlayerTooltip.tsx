"use client";

import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlayerTooltipProps {
  content: React.ReactNode;
  shortcut?: string | string[];
  side?: "top" | "bottom" | "left" | "right";
  align?: "center" | "start" | "end";
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  autoHideMs?: number;
}

export const PlayerTooltip: React.FC<PlayerTooltipProps> = ({
  content,
  shortcut,
  side = "top",
  align = "center",
  children,
  className = "",
  disabled = false,
}) => {
  if (disabled) {
    return <>{children}</>;
  }

  const shortcuts = Array.isArray(shortcut)
    ? shortcut
    : shortcut
      ? [shortcut]
      : [];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild className={className}>
          {children}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-[#1e1e1e]/95 backdrop-blur-md border border-white/10 shadow-xl text-white rounded-lg select-none"
        >
          <span>{content}</span>
          {shortcuts.length > 0 && (
            <div className="flex items-center gap-0.5 ml-1">
              {shortcuts.map((k, i) => (
                <kbd
                  key={i}
                  className="px-1 py-0.2 rounded bg-white/10 text-[9px] font-mono text-zinc-300 border border-white/10"
                >
                  {k}
                </kbd>
              ))}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

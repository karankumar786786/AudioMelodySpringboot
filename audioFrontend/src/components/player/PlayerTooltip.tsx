import React from "react";

interface PlayerTooltipProps {
  content: React.ReactNode;
  shortcut?: string | string[];
  side?: "top" | "bottom";
  align?: "center" | "start" | "end";
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
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

  const sideClasses =
    side === "top"
      ? "bottom-full mb-2.5"
      : "top-full mt-2.5";

  const alignClasses =
    align === "center"
      ? "left-1/2 -translate-x-1/2"
      : align === "start"
        ? "left-0"
        : "right-0";

  return (
    <div className={`relative group/tooltip inline-flex items-center justify-center ${className}`}>
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute z-[100] ${sideClasses} ${alignClasses} flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-[#282828]/95 backdrop-blur-sm border border-white/15 rounded-md shadow-2xl shadow-black/80 whitespace-nowrap select-none invisible opacity-0 scale-95 group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 transition-all duration-150 ease-out`}
      >
        <span>{content}</span>
        {shortcuts.length > 0 && (
          <div className="flex items-center gap-1 ml-0.5">
            {shortcuts.map((sc, i) => (
              <kbd
                key={i}
                className="px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 bg-white/10 rounded border border-white/10 shadow-sm"
              >
                {sc}
              </kbd>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

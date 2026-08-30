import React, { useState, useRef, useEffect } from "react";

interface PlayerTooltipProps {
  content: React.ReactNode;
  shortcut?: string | string[];
  side?: "top" | "bottom";
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
  autoHideMs = 1000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    if (disabled) return;
    clearTimer();
    setIsVisible(true);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, autoHideMs);
  };

  const handleMouseLeave = () => {
    clearTimer();
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

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
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-flex items-center justify-center ${className}`}
    >
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute z-[100] ${sideClasses} ${alignClasses} flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-[#282828]/95 backdrop-blur-sm border border-white/15 rounded-md shadow-2xl shadow-black/80 whitespace-nowrap select-none transition-all duration-200 ease-out ${
          isVisible
            ? "visible opacity-100 scale-100"
            : "invisible opacity-0 scale-95"
        }`}
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

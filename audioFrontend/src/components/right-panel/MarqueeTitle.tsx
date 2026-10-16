"use client";

import React, { useEffect, useRef, useState } from "react";

export function MarqueeTitle({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    setIsOverflowing(false);

    const check = () => {
      if (containerRef.current && textRef.current) {
        setIsOverflowing(
          textRef.current.scrollWidth > containerRef.current.clientWidth
        );
      }
    };

    const raf = requestAnimationFrame(check);
    const ro = new ResizeObserver(check);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [text]);

  return (
    <div ref={containerRef} className="overflow-hidden relative w-full">
      <span
        ref={textRef}
        className={`invisible absolute whitespace-nowrap pointer-events-none ${className}`}
        aria-hidden="true"
      >
        {text}
      </span>

      {isOverflowing ? (
        <div className="flex w-max whitespace-nowrap animate-marquee">
          <span className={`pr-12 ${className}`}>{text}</span>
          <span className={`pr-12 ${className}`}>{text}</span>
        </div>
      ) : (
        <span className={`block truncate ${className}`}>{text}</span>
      )}
    </div>
  );
}

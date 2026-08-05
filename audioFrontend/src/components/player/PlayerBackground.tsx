import React from "react";

interface PlayerBackgroundProps {
  posterUrl: string;
}

export const PlayerBackground: React.FC<PlayerBackgroundProps> = ({
  posterUrl,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute -inset-20 blur-[100px] opacity-20 ambient-drift"
        style={{
          backgroundImage: `url(${posterUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-linear-to-b from-zinc-950/40 via-zinc-950/80 to-zinc-950" />
    </div>
  );
};

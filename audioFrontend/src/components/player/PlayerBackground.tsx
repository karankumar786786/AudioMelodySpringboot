import React from "react";

interface PlayerBackgroundProps {
  posterUrl: string;
}

export const PlayerBackground: React.FC<PlayerBackgroundProps> = () => {
  return (
    <div className="absolute inset-0 pointer-events-none bg-black" />
  );
};

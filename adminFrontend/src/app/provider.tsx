"use client";

import React from "react";
import { AuthProvider } from "@/lib/auth-context";
import { AudioProvider } from "@/lib/audio-context";

function Provider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AudioProvider>{children}</AudioProvider>
    </AuthProvider>
  );
}

export default Provider;

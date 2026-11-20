"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { ConfirmProvider } from "@/components/feedback/ConfirmProvider";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { AudioProvider } from "@/lib/audio-context";
import { AuthProvider } from "@/lib/auth-context";
import { createQueryClient } from "@/lib/query/client";

function Provider({ children }: { children: React.ReactNode }) {
  // One client per browser session; created lazily so it is never shared across requests.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AudioProvider>{children}</AudioProvider>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default Provider;

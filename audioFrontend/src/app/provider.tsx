"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import React from "react";
import { Toaster } from "sonner";

function Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
            networkMode: "online", // Automatically pauses queries when offline and resumes when back online
            retry: (failureCount, error: any) => {
              if (typeof navigator !== "undefined" && !navigator.onLine) {
                return false; // Stop API calls when offline
              }
              return failureCount < 2;
            },
          },
          mutations: {
            networkMode: "online", // Automatically pauses mutations when offline
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        theme="dark"
        position="bottom-left"
        richColors
        toastOptions={{
          style: {
            background: "#18181b",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default Provider;

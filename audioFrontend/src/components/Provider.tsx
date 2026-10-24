"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as ReduxProvider } from "react-redux";
import { useState } from "react";
import React from "react";
import { Toaster } from "sonner";
import { store } from "@/store";

export function Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
            networkMode: "online",
            retry: (failureCount) => {
              if (typeof navigator !== "undefined" && !navigator.onLine) {
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: {
            networkMode: "online",
          },
        },
      })
  );

  return (
    <ReduxProvider store={store}>
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
    </ReduxProvider>
  );
}

export default Provider;

"use client";

/**
 * Provides app-wide client infrastructure such as React Query.
 * Called by src/app/layout.tsx.
 * Calls @tanstack/react-query APIs.
 * A junior engineer often creates a new QueryClient per render, which defeats
 * caching and makes mutation invalidation behave unpredictably.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

// ⚠️ SENIOR NOTE: QueryClient lifetime should match the browser app lifetime,
// not an individual page render, or cache consistency falls apart quickly.

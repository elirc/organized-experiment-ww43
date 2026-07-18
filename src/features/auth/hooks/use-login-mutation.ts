"use client";

/**
 * Owns the login mutation used by the login form.
 * Called by src/features/auth/components/login-form.tsx.
 * Calls POST /api/auth/login through src/lib/http/fetcher.ts.
 * A junior engineer often submits forms directly inside components without a
 * mutation boundary, which makes loading and error states messy.
 */
import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/lib/http/fetcher";
import type { AppSession } from "@/types/auth";

export function useLoginMutation() {
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiFetch<{ session: AppSession }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

// ⚠️ SENIOR NOTE: Keeping auth mutations in hooks makes redirect and cache logic
// composable without teaching components how the transport layer works.

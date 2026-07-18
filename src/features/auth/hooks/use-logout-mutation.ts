"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/http/fetcher";

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>("/api/auth/logout", {
        method: "POST",
      }),
    onSuccess: async () => {
      await queryClient.clear();
    },
  });
}

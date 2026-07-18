"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/http/fetcher";
import type { AuditLogDto } from "@/types/note";

export function useAuditLogsQuery() {
  return useQuery({
    queryKey: ["audit-logs"],
    queryFn: () =>
      apiFetch<{ logs: AuditLogDto[] }>("/api/admin/audit-logs").then((data) => data.logs),
  });
}

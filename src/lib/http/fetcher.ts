/**
 * Small client-side fetch wrapper used by React Query hooks.
 * Called by files under src/features/[feature]/hooks.
 * A junior engineer often treats non-2xx responses as success payloads, which
 * forces every component to duplicate brittle error branching.
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | T
    | { message?: string; error?: string }
    | null;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data && data.message
        ? data.message
        : "Request failed.";
    throw new ApiClientError(message, response.status, data);
  }

  return data as T;
}

import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";

import { ok } from "@/lib/http/api-response";
import { withAuth } from "@/lib/middleware/with-auth";
import { withRole } from "@/lib/middleware/with-role";
import { adminSession, memberSession } from "../helpers/session-fixtures";

describe("route authorization", () => {
  test("member callers receive 403 on an admin-only endpoint", async () => {
    // This protects against the common production bug where the UI hides an admin page
    // but the underlying API can still be called directly by any authenticated user.
    const handler = withAuth(
      withRole(["APP_ADMIN"], async () => ok({ success: true })),
      {
        resolveSession: vi.fn().mockResolvedValue(memberSession),
      },
    );

    const response = await handler(new NextRequest("http://localhost/api/admin/audit-logs"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "FORBIDDEN",
    });
  });

  test("admin callers pass the role gate", async () => {
    const handler = withAuth(
      withRole(["APP_ADMIN"], async () => ok({ success: true })),
      {
        resolveSession: vi.fn().mockResolvedValue(adminSession),
      },
    );

    const response = await handler(new NextRequest("http://localhost/api/admin/audit-logs"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
    });
  });
});

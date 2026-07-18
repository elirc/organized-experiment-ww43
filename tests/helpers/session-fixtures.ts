import type { AppSession } from "@/types/auth";

export const memberSession: AppSession = {
  sessionId: "session-member",
  expiresAt: new Date("2026-06-01T00:00:00.000Z").toISOString(),
  user: {
    id: "user-member",
    email: "member@example.com",
    name: "Member User",
    role: "MEMBER",
  },
};

export const adminSession: AppSession = {
  sessionId: "session-admin",
  expiresAt: new Date("2026-06-01T00:00:00.000Z").toISOString(),
  user: {
    id: "user-admin",
    email: "admin@example.com",
    name: "Admin User",
    role: "APP_ADMIN",
  },
};

/**
 * Resolves cookie-based sessions into typed application session objects.
 * Called by route middleware, server pages, and auth routes.
 * A junior engineer often trusts a cookie without checking the backing session
 * record, which breaks logout and makes session revocation impossible.
 */
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { SESSION_TTL_DAYS } from "@/lib/auth/constants";
import { hashSessionToken } from "@/lib/auth/session-token";
import { env } from "@/lib/env";
import { sessionRepository } from "@/repositories/session-repository";
import type { AppSession } from "@/types/auth";

type SessionRecord = Awaited<ReturnType<typeof sessionRepository.findByTokenHash>>;

type SessionResolverDeps = {
  findSessionByTokenHash: typeof sessionRepository.findByTokenHash;
  touchSession: typeof sessionRepository.touchSession;
};

const defaultDeps: SessionResolverDeps = {
  findSessionByTokenHash: sessionRepository.findByTokenHash,
  touchSession: sessionRepository.touchSession,
};

const isExpired = (value: Date) => value.getTime() <= Date.now();

const toAppSession = (record: NonNullable<SessionRecord>): AppSession => ({
  sessionId: record.id,
  expiresAt: record.expiresAt.toISOString(),
  user: {
    id: record.user.id,
    email: record.user.email,
    name: record.user.name,
    role: record.user.role,
  },
});

const readCookieToken = (rawToken?: string | null) => rawToken?.trim() || null;

export async function resolveRequestSession(
  request: Pick<NextRequest, "cookies">,
  deps: SessionResolverDeps = defaultDeps,
) {
  const token = readCookieToken(request.cookies.get(env.SESSION_COOKIE_NAME)?.value);
  if (!token) {
    return null;
  }

  const record = await deps.findSessionByTokenHash(hashSessionToken(token));
  if (!record || isExpired(record.expiresAt)) {
    return null;
  }

  await deps.touchSession(record.id);
  return toAppSession(record);
}

export async function getServerAppSession(deps: SessionResolverDeps = defaultDeps) {
  const cookieStore = await cookies();
  const token = readCookieToken(cookieStore.get(env.SESSION_COOKIE_NAME)?.value);
  if (!token) {
    return null;
  }

  const record = await deps.findSessionByTokenHash(hashSessionToken(token));
  if (!record || isExpired(record.expiresAt)) {
    return null;
  }

  return toAppSession(record);
}

export const attachSessionCookie = (
  response: NextResponse,
  token: string,
  expiresAt: Date,
) => {
  response.cookies.set({
    name: env.SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
};

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set({
    name: env.SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
};

export const createSessionExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  return expiresAt;
};

// ⚠️ SENIOR NOTE: Touching the session only after the DB lookup prevents a
// forged cookie from generating write traffic on every anonymous request.

/**
 * Handles login and logout workflows without exposing database or cookie details
 * to route handlers.
 * Called by auth route files under src/app/api/auth.
 * A junior engineer often puts password checks and session writes directly in
 * route files, which makes testing and auditing auth flows much harder.
 */
import { auditLogRepository } from "@/repositories/audit-log-repository";
import { sessionRepository } from "@/repositories/session-repository";
import { userRepository } from "@/repositories/user-repository";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionExpiry } from "@/lib/auth/session";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { appError } from "@/lib/http/app-error";

type AuthServiceDeps = {
  userRepository: typeof userRepository;
  sessionRepository: typeof sessionRepository;
  auditLogRepository: typeof auditLogRepository;
};

const defaultDeps: AuthServiceDeps = {
  userRepository,
  sessionRepository,
  auditLogRepository,
};

export const buildAuthService = (deps: AuthServiceDeps = defaultDeps) => ({
  async login(input: { email: string; password: string }) {
    const user = await deps.userRepository.findByEmail(input.email);

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      await deps.auditLogRepository.create({
        actorId: user?.id ?? null,
        action: "LOGIN_FAILED",
        metadata: { email: input.email },
      });

      throw appError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }

    const token = createSessionToken();
    const expiresAt = createSessionExpiry();

    const session = await deps.sessionRepository.create({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });

    await deps.auditLogRepository.create({
      actorId: user.id,
      action: "LOGIN_SUCCEEDED",
      metadata: { email: user.email },
    });

    return {
      token,
      expiresAt,
      session: {
        sessionId: session.id,
        expiresAt: expiresAt.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    };
  },

  async logout(input: { token: string; actorId: string }) {
    await deps.sessionRepository.deleteByTokenHash(hashSessionToken(input.token));
    await deps.auditLogRepository.create({
      actorId: input.actorId,
      action: "LOGOUT",
    });
  },
});

export const authService = buildAuthService();

// ⚠️ SENIOR NOTE: Failed logins are audited before the 401 is returned so ops
// teams can spot brute-force patterns without digging through web logs only.

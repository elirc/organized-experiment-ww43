/**
 * Wraps password hashing and comparison behind a small boundary.
 * Called by auth service and prisma/seed.ts.
 * A junior engineer often stores plain text passwords in demos, which teaches
 * the wrong habit and hides a critical production responsibility.
 */
import { compare, hash } from "bcryptjs";

const PASSWORD_ROUNDS = 12;

export const hashPassword = (value: string) => hash(value, PASSWORD_ROUNDS);

// ⚠️ SENIOR NOTE: Password verification must stay constant-time through the
// crypto library; replacing this with direct string checks is a security bug.
export const verifyPassword = (value: string, passwordHash: string) =>
  compare(value, passwordHash);

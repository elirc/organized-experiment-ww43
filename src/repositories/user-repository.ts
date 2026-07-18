/**
 * Encapsulates database access for users and collaborator lookups.
 * Called by auth service and note sharing workflows.
 * A junior engineer often queries users directly from routes, which blurs the
 * boundary between transport code and persistence concerns.
 */
import { prisma } from "@/lib/db/prisma";

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  findSessionUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  },
};

// ⚠️ SENIOR NOTE: Keep session-safe selects explicit; returning passwordHash to
// higher layers makes accidental leakage much more likely later.

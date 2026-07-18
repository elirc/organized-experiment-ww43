/**
 * Owns session persistence and lookup queries.
 * Called by auth service and session resolution helpers.
 * A junior engineer often couples session I/O to auth route files, which makes
 * revocation and reuse across server pages much harder.
 */
import type { DatabaseClient } from "@/lib/db/prisma";
import { prisma } from "@/lib/db/prisma";

const getDb = (db?: DatabaseClient) => db ?? prisma;

export const sessionRepository = {
  create(
    input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    db?: DatabaseClient,
  ) {
    return getDb(db).session.create({
      data: input,
    });
  },

  findByTokenHash(tokenHash: string, db?: DatabaseClient) {
    return getDb(db).session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });
  },

  touchSession(sessionId: string, db?: DatabaseClient) {
    return getDb(db).session.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() },
    });
  },

  deleteByTokenHash(tokenHash: string, db?: DatabaseClient) {
    return getDb(db).session.deleteMany({
      where: { tokenHash },
    });
  },
};

// ⚠️ SENIOR NOTE: deleteMany() avoids leaking whether a token existed, which is
// a nicer operational property for logout endpoints and stale-cookie cleanup.

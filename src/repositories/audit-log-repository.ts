/**
 * Owns audit-log writes and admin read queries.
 * Called by auth and note services plus the admin reporting route.
 * A junior engineer often treats audit logs as optional side effects, but they
 * become critical during incident response and permission debugging.
 */
import type { Prisma } from "@prisma/client";

import type { DatabaseClient } from "@/lib/db/prisma";
import { prisma } from "@/lib/db/prisma";

const getDb = (db?: DatabaseClient) => db ?? prisma;

export const auditLogRepository = {
  create(
    input: {
      actorId?: string | null;
      noteId?: string | null;
      action:
        | "LOGIN_SUCCEEDED"
        | "LOGIN_FAILED"
        | "LOGOUT"
        | "NOTE_CREATED"
        | "NOTE_UPDATED"
        | "NOTE_CONFLICT_REJECTED"
        | "NOTE_STATUS_CHANGED"
        | "NOTE_COLLABORATOR_UPSERTED";
      metadata?: Prisma.InputJsonValue;
    },
    db?: DatabaseClient,
  ) {
    return getDb(db).auditLog.create({
      data: {
        ...input,
        actorId: input.actorId ?? null,
        noteId: input.noteId ?? null,
        metadata: input.metadata,
      },
    });
  },

  listRecent(limit = 40) {
    return prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        note: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  },
};

// ⚠️ SENIOR NOTE: Admin list queries should select only the fields needed for
// review; broad includes can turn observability screens into data-leak surfaces.

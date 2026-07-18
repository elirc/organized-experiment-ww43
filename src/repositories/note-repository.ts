/**
 * Owns every Prisma query that touches notes, collaborators, or revisions.
 * Called by note service methods to keep database concerns out of HTTP routes.
 * A junior engineer often mixes permission filters into route files, which
 * makes data isolation difficult to review and even harder to test.
 */
import type { NoteStatus, Prisma, SystemRole } from "@prisma/client";

import type { DatabaseClient } from "@/lib/db/prisma";
import { prisma } from "@/lib/db/prisma";

const getDb = (db?: DatabaseClient) => db ?? prisma;

export const buildAccessibleNoteWhere = ({
  sessionUserId,
  systemRole,
  noteId,
}: {
  sessionUserId: string;
  systemRole: SystemRole;
  noteId?: string;
}): Prisma.NoteWhereInput => {
  if (systemRole === "APP_ADMIN") {
    return noteId ? { id: noteId } : {};
  }

  return {
    ...(noteId ? { id: noteId } : {}),
    collaborators: {
      some: {
        userId: sessionUserId,
      },
    },
  };
};

const noteDetailInclude = {
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  collaborators: {
    orderBy: {
      createdAt: "asc" as const,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  },
  revisions: {
    take: 8,
    orderBy: {
      versionNumber: "desc" as const,
    },
    include: {
      editedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.NoteInclude;

export const noteRepository = {
  listAccessibleForUser(sessionUserId: string, systemRole: SystemRole) {
    return prisma.note.findMany({
      where: buildAccessibleNoteWhere({ sessionUserId, systemRole }),
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        collaborators: {
          where: {
            userId: sessionUserId,
          },
          select: {
            userId: true,
            permission: true,
          },
        },
      },
    });
  },

  findAccessibleById(noteId: string, sessionUserId: string, systemRole: SystemRole) {
    return prisma.note.findFirst({
      where: buildAccessibleNoteWhere({ sessionUserId, systemRole, noteId }),
      include: noteDetailInclude,
    });
  },

  listAccessibleRevisions(noteId: string, sessionUserId: string, systemRole: SystemRole) {
    return prisma.noteRevision.findMany({
      where: {
        noteId,
        note: buildAccessibleNoteWhere({ sessionUserId, systemRole, noteId }),
      },
      orderBy: {
        versionNumber: "desc",
      },
      include: {
        editedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  createNote(
    input: {
      ownerId: string;
      title: string;
      body: string;
    },
    db?: DatabaseClient,
  ) {
    return getDb(db).note.create({
      data: {
        title: input.title,
        currentBody: input.body,
        ownerId: input.ownerId,
        collaborators: {
          create: {
            userId: input.ownerId,
            permission: "OWNER",
          },
        },
        revisions: {
          create: {
            versionNumber: 1,
            titleSnapshot: input.title,
            bodySnapshot: input.body,
            editedById: input.ownerId,
            changeSummary: "Initial version",
          },
        },
      },
      include: noteDetailInclude,
    });
  },

  async updateNoteWithRevisionIfVersionMatches(
    input: {
      noteId: string;
      expectedVersionNumber: number;
      title: string;
      body: string;
      editedById: string;
      changeSummary?: string;
    },
    db?: DatabaseClient,
  ) {
    const database = getDb(db);
    const nextVersionNumber = input.expectedVersionNumber + 1;
    const now = new Date();

    const updateResult = await database.note.updateMany({
      where: {
        id: input.noteId,
        currentVersionNumber: input.expectedVersionNumber,
        status: "ACTIVE",
      },
      data: {
        title: input.title,
        currentBody: input.body,
        currentVersionNumber: nextVersionNumber,
        updatedAt: now,
        lastEditedAt: now,
      },
    });

    if (updateResult.count === 0) {
      return false;
    }

    await database.noteRevision.create({
      data: {
        noteId: input.noteId,
        versionNumber: nextVersionNumber,
        titleSnapshot: input.title,
        bodySnapshot: input.body,
        changeSummary: input.changeSummary,
        editedById: input.editedById,
      },
    });

    return true;
  },

  upsertCollaborator(
    input: {
      noteId: string;
      userId: string;
      permission: "OWNER" | "EDITOR" | "VIEWER";
    },
    db?: DatabaseClient,
  ) {
    return getDb(db).noteCollaborator.upsert({
      where: {
        noteId_userId: {
          noteId: input.noteId,
          userId: input.userId,
        },
      },
      update: {
        permission: input.permission,
      },
      create: input,
    });
  },

  updateStatus(
    noteId: string,
    status: NoteStatus,
    db?: DatabaseClient,
  ) {
    return getDb(db).note.update({
      where: { id: noteId },
      data: {
        status,
        updatedAt: new Date(),
      },
    });
  },
};

// ⚠️ SENIOR NOTE: buildAccessibleNoteWhere() is the tenant-like data isolation
// seam for this app; if this filter is wrong, every note query becomes suspect.

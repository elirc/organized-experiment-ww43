import type { NoteStatus } from "@prisma/client";

export const makeAccessibleNoteRecord = (status: NoteStatus = "ACTIVE") => ({
  id: "note-1",
  title: "Operations handoff",
  currentBody: "Current note body",
  currentVersionNumber: 3,
  status,
  ownerId: "user-owner",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-03T00:00:00.000Z"),
  lastEditedAt: new Date("2026-01-03T00:00:00.000Z"),
  owner: {
    id: "user-owner",
    name: "Owner User",
    email: "owner@example.com",
  },
  collaborators: [
    {
      id: "collab-owner",
      noteId: "note-1",
      userId: "user-owner",
      permission: "OWNER" as const,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      user: {
        id: "user-owner",
        name: "Owner User",
        email: "owner@example.com",
        role: "MEMBER" as const,
      },
    },
  ],
  revisions: [],
});

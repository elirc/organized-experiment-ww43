/**
 * Seeds a small collaboration scenario so the app has realistic roles,
 * note history, and sharing behavior on day one.
 * Called by package.json `prisma:seed` and relies on prisma/schema.prisma.
 * A junior engineer often forgets to seed relational access rows, which makes
 * auth demos look correct while silently bypassing real permission paths.
 */
import { AuditAction, NotePermission, PrismaClient, SystemRole } from "@prisma/client";
import { addDays, subDays } from "date-fns";

import { hashPassword } from "../src/lib/auth/password";

// ⚠️ SENIOR NOTE: Seed data should exercise ownership and collaborator paths,
// otherwise reviewers cannot validate that repository scoping behaves correctly.
const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.noteRevision.deleteMany();
  await prisma.noteCollaborator.deleteMany();
  await prisma.note.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const [adminHash, ownerHash, editorHash] = await Promise.all([
    hashPassword("AdminPass123!"),
    hashPassword("OwnerPass123!"),
    hashPassword("EditorPass123!"),
  ]);

  const admin = await prisma.user.create({
    data: {
      email: "admin@notes.local",
      name: "Avery Admin",
      passwordHash: adminHash,
      role: SystemRole.APP_ADMIN,
    },
  });

  const owner = await prisma.user.create({
    data: {
      email: "owner@notes.local",
      name: "Nina Owner",
      passwordHash: ownerHash,
      role: SystemRole.MEMBER,
    },
  });

  const editor = await prisma.user.create({
    data: {
      email: "editor@notes.local",
      name: "Eli Editor",
      passwordHash: editorHash,
      role: SystemRole.MEMBER,
    },
  });

  const note = await prisma.note.create({
    data: {
      title: "Q2 migration notes",
      currentBody:
        "Start with the API auth boundary, then migrate document revision writes behind a transaction.",
      ownerId: owner.id,
      collaborators: {
        create: [
          { userId: owner.id, permission: NotePermission.OWNER },
          { userId: editor.id, permission: NotePermission.EDITOR },
        ],
      },
      revisions: {
        create: [
          {
            versionNumber: 1,
            titleSnapshot: "Q2 migration notes",
            bodySnapshot: "Initial draft for the Q2 migration plan.",
            editedById: owner.id,
            createdAt: subDays(new Date(), 2),
          },
          {
            versionNumber: 2,
            titleSnapshot: "Q2 migration notes",
            bodySnapshot:
              "Added API auth sequencing and rollout checkpoints for the migration plan.",
            changeSummary: "Expanded rollout detail",
            editedById: editor.id,
            createdAt: subDays(new Date(), 1),
          },
        ],
      },
      currentVersionNumber: 2,
      lastEditedAt: subDays(new Date(), 1),
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: admin.id,
        action: AuditAction.LOGIN_SUCCEEDED,
        createdAt: subDays(new Date(), 3),
        metadata: { email: admin.email },
      },
      {
        actorId: owner.id,
        action: AuditAction.NOTE_CREATED,
        noteId: note.id,
        createdAt: subDays(new Date(), 2),
      },
      {
        actorId: editor.id,
        action: AuditAction.NOTE_UPDATED,
        noteId: note.id,
        createdAt: subDays(new Date(), 1),
        metadata: { versionNumber: 2 },
      },
      {
        actorId: owner.id,
        action: AuditAction.NOTE_COLLABORATOR_UPSERTED,
        noteId: note.id,
        createdAt: addDays(subDays(new Date(), 1), 0.1),
        metadata: { collaboratorEmail: editor.email, permission: NotePermission.EDITOR },
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

import { describe, expect, test, vi } from "vitest";

import { AppError } from "@/lib/http/app-error";
import { buildNoteService } from "@/services/note-service";
import { makeAccessibleNoteRecord } from "../helpers/note-fixtures";
import { adminSession } from "../helpers/session-fixtures";

describe("note service", () => {
  test("rejects invalid status transitions when a note is already archived", async () => {
    // This catches the class of bug where archive/restore looks like a harmless toggle
    // but the backend forgets to enforce valid state transitions.
    const noteRepository = {
      findAccessibleById: vi.fn().mockResolvedValue(makeAccessibleNoteRecord("ARCHIVED")),
      updateStatus: vi.fn(),
    } as const;

    const service = buildNoteService({
      prisma: {
        $transaction: vi.fn(async (callback) => callback({})),
      } as never,
      noteRepository: noteRepository as never,
      userRepository: {} as never,
      auditLogRepository: {
        create: vi.fn(),
      } as never,
    });

    await expect(service.updateStatus(adminSession, "note-1", "ARCHIVED")).rejects.toMatchObject<
      Partial<AppError>
    >({
      code: "INVALID_STATUS_TRANSITION",
      statusCode: 409,
    });
  });

  test("returns a version conflict when the caller saves an outdated base version", async () => {
    // This protects the collaboration contract; without it, late writes can overwrite
    // a newer revision and lose another editor's work.
    const currentNote = makeAccessibleNoteRecord("ACTIVE");

    const service = buildNoteService({
      prisma: {
        $transaction: vi.fn(async (callback) => callback({})),
      } as never,
      noteRepository: {
        findAccessibleById: vi.fn().mockResolvedValue(currentNote),
      } as never,
      userRepository: {} as never,
      auditLogRepository: {
        create: vi.fn(),
      } as never,
    });

    await expect(
      service.updateNote(adminSession, "note-1", {
        title: currentNote.title,
        body: currentNote.currentBody,
        baseVersionNumber: 2,
        changeSummary: "Stale save",
      }),
    ).rejects.toMatchObject<Partial<AppError>>({
      code: "VERSION_CONFLICT",
      statusCode: 409,
    });
  });
});

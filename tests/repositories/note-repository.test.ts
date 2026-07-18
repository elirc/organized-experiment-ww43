import { describe, expect, test } from "vitest";

import { buildAccessibleNoteWhere } from "@/repositories/note-repository";

describe("buildAccessibleNoteWhere", () => {
  test("scopes member note queries to collaborator membership", () => {
    // This guards the data-isolation seam; if the collaborator filter disappears,
    // one user can read notes that belong to somebody else.
    const where = buildAccessibleNoteWhere({
      sessionUserId: "user-1",
      systemRole: "MEMBER",
      noteId: "note-123",
    });

    expect(where).toEqual({
      id: "note-123",
      collaborators: {
        some: {
          userId: "user-1",
        },
      },
    });
  });

  test("lets app admins query notes without collaborator scoping", () => {
    const where = buildAccessibleNoteWhere({
      sessionUserId: "user-1",
      systemRole: "APP_ADMIN",
      noteId: "note-123",
    });

    expect(where).toEqual({
      id: "note-123",
    });
  });
});

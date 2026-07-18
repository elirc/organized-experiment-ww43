import { describe, expect, test } from "vitest";

import { updateNoteSchema } from "@/lib/validation/note-schemas";

describe("updateNoteSchema", () => {
  test("rejects note updates that omit the baseVersionNumber", () => {
    // This catches the production bug where clients save without a concurrency token
    // and silently overwrite a newer edit from another collaborator.
    const result = updateNoteSchema.safeParse({
      title: "Q3 notes",
      body: "Updated content",
      changeSummary: "Missing version number",
    });

    expect(result.success).toBe(false);
  });
});

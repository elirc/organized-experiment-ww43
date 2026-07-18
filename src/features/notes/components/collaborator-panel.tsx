"use client";

/**
 * Displays collaborator permissions and the owner-only sharing form.
 * Called by src/features/notes/components/notes-workspace.tsx.
 * Calls share mutation hooks from src/features/notes/hooks/use-notes.ts.
 * A junior engineer often renders sharing controls for everyone and only hopes
 * the server will sort it out; this component keeps the UI honest too.
 */
import { useState } from "react";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Select } from "@/components/ui/field";
import type { NoteDetail } from "@/types/note";

export function CollaboratorPanel({
  note,
  onShare,
  isSharing,
}: {
  note: NoteDetail;
  onShare: (input: {
    email: string;
    permission: "OWNER" | "EDITOR" | "VIEWER";
  }) => Promise<unknown>;
  isSharing: boolean;
}) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"OWNER" | "EDITOR" | "VIEWER">("VIEWER");
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-[2rem] border border-[var(--border)] bg-white p-5">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-[var(--accent-strong)]" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Collaborators
        </h3>
      </div>
      <div className="mt-4 space-y-3">
        {note.collaborators.map((collaborator) => (
          <div
            key={collaborator.id}
            className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--ink-strong)]">{collaborator.user.name}</p>
              <p className="text-xs text-[var(--ink-soft)]">{collaborator.user.email}</p>
            </div>
            <Badge tone={collaborator.permission === "VIEWER" ? "neutral" : "accent"}>
              {collaborator.permission}
            </Badge>
          </div>
        ))}
      </div>

      {note.access.canManageSharing ? (
        <form
          className="mt-5 space-y-4 rounded-[1.7rem] border border-dashed border-[var(--border-strong)] p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);

            try {
              await onShare({ email, permission });
              setEmail("");
              setPermission("VIEWER");
            } catch (shareError) {
              setError(shareError instanceof Error ? shareError.message : "Sharing failed.");
            }
          }}
        >
          <div>
            <FieldLabel htmlFor="collaborator-email">User email</FieldLabel>
            <Input
              id="collaborator-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="editor@notes.local"
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor="collaborator-permission">Permission</FieldLabel>
            <Select
              id="collaborator-permission"
              value={permission}
              onChange={(event) =>
                setPermission(event.target.value as "OWNER" | "EDITOR" | "VIEWER")
              }
            >
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
              <option value="OWNER">Owner</option>
            </Select>
          </div>
          <Button type="submit" disabled={isSharing} className="w-full">
            {isSharing ? "Updating access..." : "Save collaborator"}
          </Button>
          {error ? <p className="text-sm text-[#972b23]">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}

// ⚠️ SENIOR NOTE: The UI hides sharing controls from non-owners, but the actual
// security boundary still lives in the note service and API route.

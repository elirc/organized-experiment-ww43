/**
 * Centralizes authorization decisions for system roles and note-level access.
 * Called by route middleware and note service methods.
 * A junior engineer often spreads permission checks across components and route
 * files, which makes audits incomplete and regressions easy to introduce.
 */
import type { NotePermission, NoteStatus, SystemRole } from "@prisma/client";

import { appError } from "@/lib/http/app-error";
import type { AppSession, NoteAccessLevel } from "@/types/auth";

type NoteAccessSource = {
  ownerId: string;
  status: NoteStatus;
  collaborators: Array<{
    userId: string;
    permission: NotePermission;
  }>;
};

const permissionRank: Record<NotePermission, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export const assertSystemRole = (
  session: AppSession,
  allowedRoles: SystemRole[],
  message = "You do not have permission to perform this action.",
) => {
  if (!allowedRoles.includes(session.user.role)) {
    throw appError(message, 403, "FORBIDDEN");
  }
};

export const getNoteAccessLevel = (
  session: AppSession,
  note: NoteAccessSource,
): NoteAccessLevel => {
  if (session.user.role === "APP_ADMIN") {
    return {
      permission: "OWNER",
      isOwner: true,
      canEdit: note.status === "ACTIVE",
      canManageSharing: true,
      canArchive: true,
      noteStatus: note.status,
    };
  }

  const collaborator = note.collaborators.find((entry) => entry.userId === session.user.id);
  if (!collaborator) {
    throw appError("This note was not found for your account.", 404, "NOTE_NOT_FOUND");
  }

  const isOwner = collaborator.permission === "OWNER" || note.ownerId === session.user.id;
  const canEdit = permissionRank[collaborator.permission] >= permissionRank.EDITOR;
  const canManageSharing = isOwner;
  const canArchive = isOwner;

  return {
    permission: collaborator.permission,
    isOwner,
    canEdit: canEdit && note.status === "ACTIVE",
    canManageSharing,
    canArchive,
    noteStatus: note.status,
  };
};

export const assertCanEditNote = (access: NoteAccessLevel) => {
  if (access.noteStatus === "ARCHIVED") {
    throw appError("Archived notes must be restored before editing.", 409, "NOTE_ARCHIVED");
  }

  if (!access.canEdit) {
    throw appError("You do not have edit access for this note.", 403, "FORBIDDEN");
  }
};

export const assertCanManageSharing = (access: NoteAccessLevel) => {
  if (!access.canManageSharing) {
    throw appError(
      "Only the owner or an application admin can change collaborators.",
      403,
      "FORBIDDEN",
    );
  }
};

// ⚠️ SENIOR NOTE: Archive status is checked alongside permission because edit
// rights alone are not enough; state and authorization both govern the action.
export const assertCanChangeStatus = (access: NoteAccessLevel) => {
  if (!access.canArchive) {
    throw appError("Only the owner or an application admin can change note status.", 403, "FORBIDDEN");
  }
};

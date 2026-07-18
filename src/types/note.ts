/**
 * Defines the response DTOs consumed by React Query hooks and pages.
 * Called by note services and note-related UI components.
 * A junior engineer often returns raw ORM objects directly, which tightly
 * couples the UI to persistence details and exposes fields accidentally.
 */
import type { AuditAction, NotePermission, NoteStatus, SystemRole } from "@prisma/client";

export type NoteSummary = {
  id: string;
  title: string;
  excerpt: string;
  currentVersionNumber: number;
  status: NoteStatus;
  updatedAt: string;
  lastEditedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  currentUserPermission: NotePermission;
};

export type NoteRevisionDto = {
  id: string;
  versionNumber: number;
  titleSnapshot: string;
  bodySnapshot: string;
  changeSummary: string | null;
  createdAt: string;
  editedBy: {
    id: string;
    name: string;
    email: string;
  };
};

export type NoteCollaboratorDto = {
  id: string;
  permission: NotePermission;
  user: {
    id: string;
    name: string;
    email: string;
    role: SystemRole;
  };
};

export type NoteDetail = {
  id: string;
  title: string;
  currentBody: string;
  currentVersionNumber: number;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
  lastEditedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  access: {
    permission: NotePermission;
    canEdit: boolean;
    canManageSharing: boolean;
    canArchive: boolean;
  };
  collaborators: NoteCollaboratorDto[];
  revisions: NoteRevisionDto[];
};

export type ConflictPayload = {
  error: "VERSION_CONFLICT";
  message: string;
  latestNote: Pick<
    NoteDetail,
    "id" | "title" | "currentBody" | "currentVersionNumber" | "updatedAt" | "lastEditedAt" | "status"
  >;
};

export type AuditLogDto = {
  id: string;
  action: AuditAction;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
  note: {
    id: string;
    title: string;
  } | null;
  metadata: unknown;
};

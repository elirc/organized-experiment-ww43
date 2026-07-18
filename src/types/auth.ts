/**
 * Shared auth/session types used by route middleware, services, and pages.
 * Called by src/lib/auth/session.ts, src/lib/middleware/*.ts, and UI pages.
 * A junior engineer often leaks database models into every layer instead of
 * shaping explicit session-safe data for transport.
 */
import type { NotePermission, NoteStatus, SystemRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
};

export type AppSession = {
  sessionId: string;
  user: SessionUser;
  expiresAt: string;
};

export type NoteAccessLevel = {
  permission: NotePermission;
  isOwner: boolean;
  canEdit: boolean;
  canManageSharing: boolean;
  canArchive: boolean;
  noteStatus: NoteStatus;
};

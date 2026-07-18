/**
 * Protected page shell for the collaborative notes workspace.
 * Called when a signed-in user visits /notes.
 * Calls src/lib/auth/session.ts and src/features/notes/components/notes-workspace.tsx.
 * A junior engineer often protects the client view only, forgetting that the
 * page itself should also refuse anonymous access on the server.
 */
import { redirect } from "next/navigation";

import { NotesWorkspace } from "@/features/notes/components/notes-workspace";
import { getServerAppSession } from "@/lib/auth/session";

export default async function NotesPage() {
  const session = await getServerAppSession();
  if (!session) {
    redirect("/login");
  }

  return <NotesWorkspace session={session} />;
}

// ⚠️ SENIOR NOTE: Server-side redirects avoid flashing protected UI to anonymous
// users during hydration or slow network conditions.

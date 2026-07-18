/**
 * Admin-only page shell for reviewing audit logs.
 * Called when users visit /admin.
 * Calls src/lib/auth/session.ts and src/features/admin/components/audit-log-view.tsx.
 * A junior engineer often hides admin links but forgets to protect the page
 * itself, which leaves privileged screens reachable by direct URL entry.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AuditLogView } from "@/features/admin/components/audit-log-view";
import { getServerAppSession } from "@/lib/auth/session";

export default async function AdminPage() {
  const session = await getServerAppSession();
  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "APP_ADMIN") {
    redirect("/notes");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1180px] px-6 py-10 lg:px-10">
      <div className="mb-6 flex justify-end">
        <Link href="/notes">
          <Button variant="secondary">Back to notes</Button>
        </Link>
      </div>
      <AuditLogView />
    </main>
  );
}

// ⚠️ SENIOR NOTE: The page redirect improves UX, but the API route also enforces
// APP_ADMIN because page-level checks alone are not sufficient security.

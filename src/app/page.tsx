import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, GitBranch, LockKeyhole, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getServerAppSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getServerAppSession();

  if (session) {
    redirect("/notes");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col justify-center px-6 py-10 lg:px-10">
      <section className="grid gap-10 rounded-[2.8rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.86),rgba(255,246,238,0.92),rgba(242,114,76,0.1))] p-8 shadow-[0_30px_100px_rgba(15,23,42,0.08)] lg:grid-cols-[minmax(0,1fr)_420px] lg:p-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]">
            Production-style collaborative CRUD
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.05] text-[var(--ink-strong)]">
            Notes with version history, explicit sharing, and conflict-aware saves.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--ink-soft)]">
            Built to teach service layers, repository boundaries, Zod validation, and
            permission checks through a realistic backend-heavy product workflow.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login">
              <Button className="gap-2 px-5 py-3">
                Enter the workspace
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[2rem] border border-[var(--border)] bg-white/90 p-5">
            <GitBranch className="h-5 w-5 text-[var(--accent-strong)]" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--ink-strong)]">
              Optimistic concurrency
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Every save includes a base version, creating a new revision and rejecting stale writes.
            </p>
          </div>
          <div className="rounded-[2rem] border border-[var(--border)] bg-white/90 p-5">
            <Users className="h-5 w-5 text-[var(--accent-strong)]" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--ink-strong)]">
              Explicit share permissions
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Owner, editor, and viewer access are enforced in the service layer, not hidden in UI code.
            </p>
          </div>
          <div className="rounded-[2rem] border border-[var(--border)] bg-white/90 p-5">
            <LockKeyhole className="h-5 w-5 text-[var(--accent-strong)]" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--ink-strong)]">
              Reviewable auth boundary
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Cookie-backed sessions and server-side role checks keep authorization visible and testable.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

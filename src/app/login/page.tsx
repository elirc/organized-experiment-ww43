/**
 * Public login page that redirects authenticated users into the main workspace.
 * Called when anonymous users visit /login directly.
 * Calls src/lib/auth/session.ts and src/features/auth/components/login-form.tsx.
 * A junior engineer often forgets to redirect authenticated users away from login,
 * which creates confusing session flows and duplicate navigation states.
 */
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/components/login-form";
import { getServerAppSession } from "@/lib/auth/session";

export default async function LoginPage() {
  const session = await getServerAppSession();
  if (session) {
    redirect("/notes");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1180px] items-center px-6 py-10 lg:px-10">
      <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="rounded-[2.6rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(242,114,76,0.08))] p-8 shadow-[0_26px_90px_rgba(15,23,42,0.08)] lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--ink-soft)]">
            Sign in
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight text-[var(--ink-strong)]">
            Work on shared notes without losing authorship, history, or control.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--ink-soft)]">
            This demo exercises a backend-oriented architecture: session-backed auth,
            centralized permissions, explicit version conflict handling, and audit logging.
          </p>
        </section>

        <section className="rounded-[2.2rem] border border-[var(--border)] bg-white p-8 shadow-[0_26px_90px_rgba(15,23,42,0.08)]">
          <LoginForm />
        </section>
      </div>
    </main>
  );
}

// ⚠️ SENIOR NOTE: This redirect is convenience only; the real auth boundary still
// lives in server routes and the protected /notes page.

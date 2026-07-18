"use client";

/**
 * Renders the credential form and triggers the login API mutation.
 * Called by src/app/login/page.tsx.
 * Calls src/features/auth/hooks/use-login-mutation.ts.
 * A junior engineer often mixes navigation, validation, and transport code in
 * one place, which makes auth forms brittle and hard to extend.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/field";
import { useLoginMutation } from "@/features/auth/hooks/use-login-mutation";

const demoAccounts = [
  "admin@notes.local / AdminPass123!",
  "owner@notes.local / OwnerPass123!",
  "editor@notes.local / EditorPass123!",
];

export function LoginForm() {
  const router = useRouter();
  const loginMutation = useLoginMutation();
  const [email, setEmail] = useState("owner@notes.local");
  const [password, setPassword] = useState("OwnerPass123!");

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();

        try {
          await loginMutation.mutateAsync({ email, password });
          router.push("/notes");
          router.refresh();
        } catch {
          // The mutation already exposes a user-facing message.
        }
      }}
    >
      <div>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? "Signing in..." : "Sign in"}
      </Button>
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-muted)] p-4 text-sm text-[var(--ink-soft)]">
        <p className="font-semibold text-[var(--ink-strong)]">Seeded demo accounts</p>
        <ul className="mt-2 space-y-1">
          {demoAccounts.map((account) => (
            <li key={account}>{account}</li>
          ))}
        </ul>
      </div>
      {loginMutation.error ? (
        <p className="text-sm font-medium text-[#972b23]">{loginMutation.error.message}</p>
      ) : null}
    </form>
  );
}

// ⚠️ SENIOR NOTE: The form never trusts demo credentials alone; the server still
// validates against hashed passwords so seed data exercises the real path.

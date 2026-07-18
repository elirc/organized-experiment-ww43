/**
 * Small shared button primitive used across forms and panels.
 * Called by feature components under src/features/[feature]/components.
 * A junior engineer often copies button classes inline everywhere, which makes
 * visual consistency and disabled-state behavior drift over time.
 */
import * as React from "react";

import { cn } from "@/lib/utils/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-[var(--accent-strong)] text-white hover:bg-[var(--accent-stronger)]",
        variant === "secondary" &&
          "border border-[var(--border-strong)] bg-white text-[var(--ink-strong)] hover:bg-[var(--panel-muted)]",
        variant === "ghost" &&
          "text-[var(--ink-soft)] hover:bg-[var(--panel-muted)] hover:text-[var(--ink-strong)]",
        variant === "danger" && "bg-[#b9382f] text-white hover:bg-[#972b23]",
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";

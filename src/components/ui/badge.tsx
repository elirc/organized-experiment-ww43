import { cn } from "@/lib/utils/cn";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        tone === "neutral" && "bg-[var(--panel-muted)] text-[var(--ink-soft)]",
        tone === "accent" && "bg-[var(--accent-soft)] text-[var(--accent-stronger)]",
        tone === "danger" && "bg-[#f9d7d3] text-[#972b23]",
        className,
      )}
    >
      {children}
    </span>
  );
}

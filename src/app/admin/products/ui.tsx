"use client";

import { mn } from "@/i18n/mn";
import { appUses, type CatalogTarget } from "@/lib/catalog-refs";
import { cn } from "@/lib/utils";
import type { CatalogResult } from "../actions";

/** Small form pieces shared by the product builder screens. */

export const inputClass =
  "h-11 w-full rounded-2xl bg-subtle px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm font-medium", className)}>
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Toggle({
  label,
  on,
  onChange,
  disabled,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold disabled:opacity-50",
        on ? "bg-tint-1 text-highlight" : "bg-subtle text-muted-foreground",
      )}
    >
      <span
        className={cn("size-2.5 rounded-full", on ? "bg-highlight" : "bg-border")}
        aria-hidden
      />
      {label}
    </button>
  );
}

export function Select({
  value,
  onChange,
  options,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  label?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export type Msg = { ok: boolean; text: string } | null;

const errors = mn.admin.productsPage.errors;

/** Result of a catalog action → status line text. */
export function resultMsg(res: CatalogResult, okText: string): Msg {
  return res.ok
    ? { ok: true, text: okText }
    : { ok: false, text: errors[res.error] ?? errors.generic };
}

const usedByApp = mn.admin.productsPage.usedByApp;

/**
 * Runs a catalog action. If the server says the app's own screens use the row ("used_by_app"),
 * shows which ones and — only if the admin agrees — runs it again with the acknowledgement.
 */
export async function withAppUseConfirm(
  action: (acknowledge: boolean) => Promise<CatalogResult>,
): Promise<CatalogResult> {
  const res = await action(false);
  if (res.ok || res.error !== "used_by_app") return res;
  const uses = (res.uses ?? []).map((u) => usedByApp.uses[u]);
  return confirm(usedByApp.confirm(uses)) ? action(true) : res;
}

/** Marks a product, part or field that the app's own screens read (hover: which ones). */
export function AppUseBadge({ target }: { target: CatalogTarget }) {
  const uses = appUses(target);
  if (uses.length === 0) return null;
  return (
    <span
      title={usedByApp.hint(uses.map((u) => usedByApp.uses[u]))}
      className="rounded-full bg-tint-2 px-2 py-0.5 font-sans text-xs font-medium text-fg"
    >
      {usedByApp.badge}
    </span>
  );
}

export function Status({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role="status" className={cn("text-sm", msg.ok ? "text-highlight" : "text-destructive")}>
      {msg.text}
    </p>
  );
}

/** Lower-cases and strips what a code may not contain, as the admin types. */
export const toCode = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);

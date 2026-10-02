/** Dev-only in-memory copy of sent emails, shown at /dev/mail (useful without Mailpit). */
type OutboxEntry = { id: number; to: string; subject: string; text: string; at: Date };

const MAX = 50;
const store = globalThis as unknown as { __outbox?: OutboxEntry[]; __outboxSeq?: number };

export function recordEmail(entry: Omit<OutboxEntry, "id" | "at">) {
  if (process.env.NODE_ENV === "production") return;
  store.__outbox ??= [];
  store.__outboxSeq = (store.__outboxSeq ?? 0) + 1;
  store.__outbox.unshift({ ...entry, id: store.__outboxSeq, at: new Date() });
  store.__outbox.length = Math.min(store.__outbox.length, MAX);
}

export function listEmails(): OutboxEntry[] {
  return store.__outbox ?? [];
}

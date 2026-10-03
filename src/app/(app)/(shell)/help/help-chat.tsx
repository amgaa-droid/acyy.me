"use client";

import { ArrowUp, Bot, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { mn } from "@/i18n/mn";
import { faqMatches } from "@/lib/help-search";
import { cn } from "@/lib/utils";
import type { HelpExchange } from "@/server/help/chat";
import type { PublicFaq } from "@/server/help/faq";
import { askHelpAction, rateHelpAction } from "./actions";

const t = mn.help;
const MAX = 500;

/** A v4 UUID — also over plain-http LAN testing, where `crypto.randomUUID` is missing. */
function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Item = HelpExchange & { local?: boolean };

/**
 * The assistant's chat. While typing, matching FAQs are offered first (free); tapping one
 * answers right here without asking the AI. The conversation lives on the server — reopening
 * help within a few hours continues it; "Шинэ яриа" starts over.
 */
export function HelpChat({
  greeting,
  faqs,
  initial,
}: {
  greeting: string;
  faqs: PublicFaq[];
  initial: { conversationId: string; exchanges: HelpExchange[] } | null;
}) {
  const [conversationId, setConversationId] = useState(() => initial?.conversationId ?? newId());
  const [items, setItems] = useState<Item[]>(initial?.exchanges ?? []);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [items.length, pending]);

  const question = text.trim();
  const suggestions =
    question.length >= 4 && !pending ? faqMatches(question, faqs, { limit: 2 }) : [];

  const send = () => {
    if (question.length < 2 || pending) return;
    setError(null);
    setPending(question);
    setText("");
    startTransition(async () => {
      const res = await askHelpAction({ conversationId, question });
      setPending(null);
      if (res.ok) setItems((list) => [...list, res.exchange]);
      else {
        setText(question);
        setError(
          res.error === "limit"
            ? t.errors.limit(res.limit ?? 0)
            : ((t.errors[res.error as keyof typeof t.errors] as string | undefined) ??
                t.errors.generic),
        );
      }
    });
  };

  const showFaq = (faq: PublicFaq) => {
    setItems((list) => [
      ...list,
      {
        id: `local:${faq.id}:${list.length}`,
        question: faq.question,
        answer: faq.answer,
        source: "faq",
        feedback: null,
        local: true,
      },
    ]);
    setText("");
    setError(null);
  };

  const rate = (id: string, value: 1 | -1) => {
    const next = items.find((i) => i.id === id)?.feedback === value ? null : value;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, feedback: next } : i)));
    void rateHelpAction(id, next);
  };

  const restart = () => {
    setConversationId(newId());
    setItems([]);
    setError(null);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <span className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-full bg-tint-1 text-highlight">
            <Bot className="size-4.5" aria-hidden />
          </span>
          {t.assistant}
        </span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={restart}
            className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-subtle"
          >
            <RotateCcw className="size-4" aria-hidden /> {t.newChat}
          </button>
        )}
      </div>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        className="flex max-h-[min(28rem,55dvh)] min-h-40 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {items.length === 0 && !pending && <Bubble side="ai">{greeting}</Bubble>}
        {items.map((i) => (
          <div key={i.id} className="flex flex-col gap-3">
            <Bubble side="me">{i.question}</Bubble>
            <div className="flex flex-col gap-1">
              <Bubble side="ai">
                {i.source === "faq" && (
                  <span className="mb-1 block text-xs font-semibold text-highlight">
                    {t.fromFaq}
                  </span>
                )}
                {i.answer}
              </Bubble>
              {!i.local && (
                <div className="flex gap-1 pl-2">
                  <RateButton
                    label={t.helpful}
                    on={i.feedback === 1}
                    onClick={() => rate(i.id, 1)}
                    Icon={ThumbsUp}
                  />
                  <RateButton
                    label={t.notHelpful}
                    on={i.feedback === -1}
                    onClick={() => rate(i.id, -1)}
                    Icon={ThumbsDown}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <>
            <Bubble side="me">{pending}</Bubble>
            <Bubble side="ai">
              <span className="text-muted-foreground motion-safe:animate-pulse">{t.thinking}</span>
            </Bubble>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-3">
        {suggestions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-xs text-muted-foreground">{t.suggestions}</span>
            {suggestions.map(({ faq }) => (
              <button
                key={faq.id}
                type="button"
                onClick={() => showFaq(faq)}
                className="min-h-11 rounded-2xl bg-tint-2 px-4 py-2 text-left text-sm font-semibold"
              >
                {faq.question}
              </button>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="px-1 text-sm text-destructive">
            {error}
          </p>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            aria-label={t.placeholder}
            placeholder={t.placeholder}
            value={text}
            maxLength={MAX}
            rows={1}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            className="field-sizing-content max-h-32 min-h-11 flex-1 resize-none rounded-2xl bg-subtle px-4 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            aria-label={t.send}
            disabled={question.length < 2 || !!pending}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        </form>
        <p className="px-1 text-xs text-muted-foreground">{t.disclaimer}</p>
      </div>
    </div>
  );
}

function Bubble({ side, children }: { side: "me" | "ai"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-3xl px-4 py-2.5 leading-relaxed whitespace-pre-line",
        side === "me"
          ? "self-end rounded-br-lg bg-primary text-primary-foreground"
          : "self-start rounded-bl-lg bg-subtle",
      )}
    >
      {children}
    </div>
  );
}

function RateButton({
  label,
  on,
  onClick,
  Icon,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  Icon: typeof ThumbsUp;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-full",
        on ? "bg-tint-1 text-highlight" : "text-muted-foreground hover:bg-subtle",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

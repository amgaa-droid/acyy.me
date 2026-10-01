"use client";

import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  Monitor,
  Plus,
  RefreshCw,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { mn } from "@/i18n/mn";
import {
  DEMO_TINTS,
  LIMITS,
  MAX_DEMO_PEOPLE,
  type IssueCode,
  type LandingContent,
} from "@/lib/landing-content";
import { cn } from "@/lib/utils";
import { Field, Select, inputClass } from "../products/ui";
import {
  discardLandingDraftAction,
  publishLandingAction,
  restoreLandingAction,
  saveLandingDraftAction,
  type CmsResult,
} from "./actions";

const t = mn.admin.landing;
const tf = t.f;

type Path = (string | number)[];
type Version = {
  id: string;
  version: number;
  note: string | null;
  publishedAt: string;
  publishedBy: string | null;
};

type Props = {
  initial: LandingContent;
  revision: number;
  draftInfo: { updatedAt: string; updatedBy: string | null } | null;
  live: { version: number | null; publishedAt: string | null; publishedBy: string | null };
  versions: Version[];
  products: { code: string; name: string }[];
  avatars: string[];
  suggestions: string[];
};

/** "2026.10.01 21:16" in Mongolia — built from parts so server and browser render the same. */
const fmt = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
};

function getAt(obj: unknown, path: Path): unknown {
  return path.reduce<unknown>((o, k) => (o as Record<string | number, unknown>)?.[k], obj);
}

function setAt<T>(obj: T, path: Path, value: unknown): T {
  const next = structuredClone(obj) as Record<string | number, unknown>;
  let cur = next;
  path.slice(0, -1).forEach((k) => {
    cur = cur[k] as Record<string | number, unknown>;
  });
  cur[path[path.length - 1]] = value;
  return next as T;
}

const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

// ---------- Editing context ----------

type Ctx = {
  content: LandingContent;
  set: (path: Path, value: unknown) => void;
  error: (path: Path) => IssueCode | undefined;
  /** Any issue under this section (for the red dot on a collapsed card). */
  sectionHasIssue: (key: string) => boolean;
};
const EditorCtx = createContext<Ctx | null>(null);
const useEditor = () => useContext(EditorCtx)!;

/** Admin CMS for the signed-out landing page. Mobile-first: actions sit in a bottom bar. */
export function LandingEditor(props: Props) {
  const [content, setContent] = useState<LandingContent>(props.initial);
  const [saved, setSaved] = useState(() => JSON.stringify(props.initial));
  const [revision, setRevision] = useState(props.revision);
  const [issues, setIssues] = useState<Record<string, IssueCode>>({});
  const [status, setStatus] = useState<
    { kind: "ok" | "error"; text: string; conflict?: boolean } | null
  >(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [previewKey, setPreviewKey] = useState(0);
  const dirty = JSON.stringify(content) !== saved;
  const hasDraft = revision > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const ctx = useMemo<Ctx>(
    () => ({
      content,
      set: (path, value) => setContent((c) => setAt(c, path, value)),
      error: (path) => issues[path.join(".")],
      sectionHasIssue: (key) => Object.keys(issues).some((p) => p === key || p.startsWith(`${key}.`)),
    }),
    [content, issues],
  );

  const handle = <T,>(res: CmsResult<T>): res is { ok: true } & T => {
    if (res.ok) {
      setIssues({});
      return true;
    }
    if (res.error === "invalid") {
      setIssues(res.issues ?? {});
      setStatus({ kind: "error", text: t.invalid });
    } else if (res.error === "conflict") {
      setStatus({ kind: "error", text: t.conflict, conflict: true });
    } else {
      setStatus({ kind: "error", text: t.generic });
    }
    return false;
  };

  /** Saves if needed; returns the revision to publish from (null on failure). */
  const save = async (): Promise<number | null> => {
    if (!dirty && hasDraft) return revision;
    const res = await saveLandingDraftAction(content, revision);
    if (!handle(res)) return null;
    setRevision(res.revision);
    setSaved(JSON.stringify(content));
    setPreviewKey((k) => k + 1);
    return res.revision;
  };

  const onSave = () =>
    start(async () => {
      setStatus(null);
      if ((await save()) !== null) setStatus({ kind: "ok", text: t.saved });
    });

  const onPublish = () => {
    if (!window.confirm(t.publishConfirm)) return;
    start(async () => {
      setStatus(null);
      const rev = await save();
      if (rev === null) return;
      const res = await publishLandingAction(rev, note);
      if (!handle(res)) return;
      setNote("");
      setRevision(0);
      setPreviewKey((k) => k + 1);
      setStatus({ kind: "ok", text: t.published(res.version) });
    });
  };

  /** Puts server content into the editor as the new clean state. */
  const load = (next: LandingContent, rev: number, text: string) => {
    setContent(next);
    setSaved(JSON.stringify(next));
    setRevision(rev);
    setPreviewKey((k) => k + 1);
    setStatus({ kind: "ok", text });
  };

  const onDiscard = () => {
    if (!window.confirm(t.discardConfirm)) return;
    start(async () => {
      setStatus(null);
      const res = await discardLandingDraftAction();
      if (handle(res)) load(res.content, 0, t.discarded);
    });
  };

  const onRestore = (versionId: string | null, label: string) => {
    if (!window.confirm(label)) return;
    start(async () => {
      setStatus(null);
      const res = await restoreLandingAction(versionId, revision);
      if (handle(res)) load(res.content, res.revision, t.restored);
    });
  };

  const liveLine =
    props.live.version !== null && props.live.publishedAt
      ? t.live(props.live.version, fmt(props.live.publishedAt), props.live.publishedBy)
      : t.liveDefault;

  return (
    <EditorCtx.Provider value={ctx}>
      <div className="flex flex-col gap-5 pb-28">
        <div>
          <h1 className="text-[40px] leading-none font-semibold">{t.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.intro}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-tint-3 px-3 py-1.5">{liveLine}</span>
            <span
              className={cn(
                "rounded-full px-3 py-1.5",
                dirty ? "bg-tint-2" : hasDraft ? "bg-tint-1 text-highlight" : "bg-subtle text-muted-foreground",
              )}
            >
              {dirty
                ? t.dirty
                : hasDraft && props.draftInfo
                  ? t.draftSaved(fmt(props.draftInfo.updatedAt), props.draftInfo.updatedBy)
                  : t.noDraft}
            </span>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="rounded-2xl bg-surface px-4 py-3 text-xs text-muted-foreground">{t.tokens}</p>
            <LayoutCard />
            <SeoCard />
            <HeroCard />
            <DemoCard avatars={props.avatars} suggestions={props.suggestions} />
            <StatsCard />
            <ProductsCard products={props.products} />
            <SynastryCard suggestions={props.suggestions} />
            <PeopleCard />
            <HowCard />
            <WalletCard />
            <FaqCard />
            <FinalCard />
            <HistoryCard
              versions={props.versions}
              liveVersion={props.live.version}
              disabled={pending}
              onRestore={onRestore}
            />
          </div>
          <PreviewPane reloadKey={previewKey} />
        </div>
      </div>

      {/* ---- Action bar ---- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur lg:left-68">
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          {status && (
            <div
              role="status"
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm font-medium",
                status.kind === "ok" ? "bg-tint-3" : "bg-tint-2 text-destructive",
              )}
            >
              {status.text}
              {status.conflict ? (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="shrink-0 rounded-full bg-fg px-3 py-1.5 text-xs font-semibold text-bg"
                >
                  {t.reloadPage}
                </button>
              ) : (
                <button type="button" aria-label="×" onClick={() => setStatus(null)}>
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder={t.publishNote}
              className={cn(inputClass, "h-11 min-w-0 flex-1 basis-56 text-sm")}
            />
            <button
              type="button"
              disabled={pending || (!dirty && hasDraft)}
              onClick={onSave}
              className="h-11 rounded-full bg-subtle px-5 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? t.saving : t.save}
            </button>
            <button
              type="button"
              disabled={pending || (!dirty && !hasDraft)}
              onClick={onPublish}
              className="h-11 rounded-full bg-fg px-6 text-sm font-semibold text-bg disabled:opacity-50"
            >
              {pending ? t.publishing : t.publish}
            </button>
            <details className="relative">
              <summary className="flex h-11 cursor-pointer list-none items-center rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-subtle [&::-webkit-details-marker]:hidden">
                ⋯
              </summary>
              <div className="absolute right-0 bottom-12 flex w-56 flex-col gap-1 rounded-2xl bg-surface p-2 shadow-lg">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRestore(null, t.resetConfirm)}
                  className="h-11 rounded-xl px-3 text-left text-sm font-medium hover:bg-subtle"
                >
                  {t.resetDefaults}
                </button>
                <button
                  type="button"
                  disabled={pending || !hasDraft}
                  onClick={onDiscard}
                  className="h-11 rounded-xl px-3 text-left text-sm font-medium text-destructive hover:bg-subtle disabled:opacity-40"
                >
                  {t.discard}
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>
    </EditorCtx.Provider>
  );
}

// ---------- Preview ----------

function PreviewPane({ reloadKey }: { reloadKey: number }) {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [manual, setManual] = useState(0);
  const frame = device === "phone" ? { w: 390, h: 760, k: 1 } : { w: 1280, h: 1600, k: 0.31 };
  return (
    <aside className="flex flex-col gap-2 xl:sticky xl:top-6">
      <div className="flex items-center gap-1.5">
        <span className="mr-auto text-sm font-semibold">{t.preview}</span>
        {(["phone", "desktop"] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={device === d}
            aria-label={d === "phone" ? t.phone : t.desktop}
            onClick={() => setDevice(d)}
            className={cn(
              "flex size-10 items-center justify-center rounded-full",
              device === d ? "bg-fg text-bg" : "bg-surface",
            )}
          >
            {d === "phone" ? <Smartphone className="size-4.5" /> : <Monitor className="size-4.5" />}
          </button>
        ))}
        <button
          type="button"
          aria-label={t.reload}
          onClick={() => setManual((n) => n + 1)}
          className="flex size-10 items-center justify-center rounded-full bg-surface"
        >
          <RefreshCw className="size-4.5" />
        </button>
        <a
          href="/preview/landing"
          target="_blank"
          rel="noreferrer"
          aria-label={t.preview}
          className="flex size-10 items-center justify-center rounded-full bg-surface"
        >
          <ExternalLink className="size-4.5" />
        </a>
      </div>
      <div
        className="mx-auto overflow-hidden rounded-[28px] border-4 border-fg bg-bg"
        style={{ width: frame.w * frame.k + 8, height: Math.min(frame.h * frame.k, 760) + 8 }}
      >
        <iframe
          key={`${reloadKey}-${manual}-${device}`}
          src="/preview/landing"
          title={t.preview}
          style={{
            width: frame.w,
            height: frame.h,
            transform: `scale(${frame.k})`,
            transformOrigin: "0 0",
          }}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">{t.previewHint}</p>
    </aside>
  );
}

// ---------- Field building blocks ----------

function Card({ id, children, open }: { id: string; children: React.ReactNode; open?: boolean }) {
  const issues = useEditor().sectionHasIssue(id);
  return (
    <details open={open || issues || undefined} className="group rounded-3xl bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {t.sections[id]}
          {issues && <span className="size-2 rounded-full bg-destructive" aria-hidden />}
        </span>
        <ArrowDown className="size-4 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-4 px-5 pb-5">{children}</div>
    </details>
  );
}

function ErrorText({ path }: { path: Path }) {
  const code = useEditor().error(path);
  return code ? <span className="text-xs font-medium text-destructive">{t.errors[code]}</span> : null;
}

function Text({
  path,
  label,
  max,
  multiline,
  hint,
  list,
}: {
  path: Path;
  label: string;
  max: number;
  multiline?: boolean;
  hint?: string;
  list?: string;
}) {
  const { content, set, error } = useEditor();
  const id = useId();
  const value = String(getAt(content, path) ?? "");
  const bad = !!error(path);
  const cls = cn(inputClass, bad && "ring-2 ring-destructive", multiline && "h-auto min-h-24 py-3");
  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={3}
          onChange={(e) => set(path, e.target.value)}
          aria-invalid={bad}
          className={cls}
        />
      ) : (
        <input
          id={id}
          value={value}
          list={list}
          onChange={(e) => set(path, e.target.value)}
          aria-invalid={bad}
          className={cls}
        />
      )}
      <span className="flex justify-between gap-2">
        <ErrorText path={path} />
        <span
          className={cn(
            "ml-auto text-xs font-normal",
            value.length > max ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {t.chars(value.length, max)}
        </span>
      </span>
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </div>
  );
}

function MoveButtons({
  i,
  n,
  onMove,
  onRemove,
}: {
  i: number;
  n: number;
  onMove: (from: number, to: number) => void;
  onRemove?: () => void;
}) {
  const btn = "flex size-9 items-center justify-center rounded-full hover:bg-subtle disabled:opacity-30";
  return (
    <span className="flex shrink-0 items-center">
      <button type="button" aria-label={t.up} disabled={i === 0} onClick={() => onMove(i, i - 1)} className={btn}>
        <ArrowUp className="size-4" />
      </button>
      <button type="button" aria-label={t.down} disabled={i === n - 1} onClick={() => onMove(i, i + 1)} className={btn}>
        <ArrowDown className="size-4" />
      </button>
      {onRemove && (
        <button type="button" aria-label={t.remove} onClick={onRemove} className={cn(btn, "text-destructive")}>
          <Trash2 className="size-4" />
        </button>
      )}
    </span>
  );
}

const move = <T,>(arr: T[], from: number, to: number) => {
  const next = [...arr];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
};

function StringList({
  path,
  label,
  max,
  maxItems,
  list,
  hint,
}: {
  path: Path;
  label: string;
  max: number;
  maxItems: number;
  list?: string;
  hint?: string;
}) {
  const { content, set, error } = useEditor();
  const items = (getAt(content, path) as string[]) ?? [];
  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            value={v}
            list={list}
            maxLength={max * 2}
            onChange={(e) => set([...path, i], e.target.value)}
            aria-label={`${label} ${i + 1}`}
            className={cn(inputClass, error([...path, i]) && "ring-2 ring-destructive")}
          />
          <MoveButtons
            i={i}
            n={items.length}
            onMove={(a, b) => set(path, move(items, a, b))}
            onRemove={() => set(path, items.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <ErrorText path={path} />
      {items.length < maxItems && (
        <AddButton onClick={() => set(path, [...items, ""])} />
      )}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </div>
  );
}

function AddButton({ onClick, label = t.add }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-fit items-center gap-1.5 rounded-full bg-subtle px-4 text-sm font-semibold"
    >
      <Plus className="size-4" aria-hidden /> {label}
    </button>
  );
}

function ItemList<T>({
  path,
  label,
  itemLabel,
  maxItems,
  blank,
  render,
  onRemove,
}: {
  path: Path;
  label: string;
  itemLabel: (item: T, i: number) => string;
  maxItems: number;
  blank: () => T;
  render: (itemPath: Path, item: T, i: number) => React.ReactNode;
  onRemove?: (item: T) => void;
}) {
  const { content, set } = useEditor();
  const items = (getAt(content, path) as T[]) ?? [];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-muted-foreground">{itemLabel(item, i)}</span>
            <MoveButtons
              i={i}
              n={items.length}
              onMove={(a, b) => set(path, move(items, a, b))}
              onRemove={() => {
                set(path, items.filter((_, j) => j !== i));
                onRemove?.(item);
              }}
            />
          </div>
          {render([...path, i], item, i)}
        </div>
      ))}
      <ErrorText path={path} />
      {items.length < maxItems && <AddButton onClick={() => set(path, [...items, blank()])} />}
    </div>
  );
}

// ---------- Sections ----------

function LayoutCard() {
  const { content, set } = useEditor();
  const layout = content.layout;
  return (
    <Card id="layout" open>
      <p className="text-xs text-muted-foreground">{t.layoutHint}</p>
      <ul className="flex flex-col gap-1.5">
        {layout.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 rounded-2xl bg-subtle py-1 pr-1 pl-4">
            <span className={cn("flex-1 text-sm font-semibold", !s.visible && "text-muted-foreground line-through")}>
              {t.sections[s.key]}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={s.visible}
              onClick={() => set(["layout", i, "visible"], !s.visible)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
                s.visible ? "bg-tint-1 text-highlight" : "bg-surface text-muted-foreground",
              )}
            >
              {s.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              {s.visible ? t.visible : t.hidden}
            </button>
            <MoveButtons i={i} n={layout.length} onMove={(a, b) => set(["layout"], move(layout, a, b))} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SeoCard() {
  return (
    <Card id="seo">
      <Text path={["seo", "title"]} label={tf.title} max={LIMITS.title} />
      <Text path={["seo", "description"]} label={tf.description} max={300} multiline />
    </Card>
  );
}

function HeroCard() {
  return (
    <Card id="hero">
      <Text path={["hero", "eyebrow"]} label={tf.eyebrow} max={LIMITS.short * 2} />
      <Text path={["hero", "title"]} label={tf.title} max={LIMITS.title} />
      <Text path={["hero", "subtitle"]} label={tf.subtitle} max={LIMITS.text} multiline />
      <Text path={["hero", "pickBirthday"]} label={tf.pickBirthday} max={LIMITS.short} />
      <Text path={["hero", "hint"]} label={tf.hint} max={LIMITS.title} />
    </Card>
  );
}

type DemoPerson = LandingContent["demo"]["people"][number];
type DemoLink = LandingContent["demo"]["links"][number];

function DemoCard({ avatars, suggestions }: { avatars: string[]; suggestions: string[] }) {
  const { content, set } = useEditor();
  const people = content.demo.people;
  const options = [{ value: "", label: "—" }, ...people.map((p) => ({ value: p.id, label: p.name || p.id }))];
  return (
    <Card id="demo">
      <p className="text-xs text-muted-foreground">{t.demoHint}</p>
      <datalist id="relation-chips">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <ItemList<DemoPerson>
        path={["demo", "people"]}
        label={tf.people}
        maxItems={MAX_DEMO_PEOPLE}
        itemLabel={(p, i) => `${i + 1}. ${p.name || tf.person}`}
        blank={() => ({ id: newId("p"), name: "", birthDate: "2000-01-01", seed: 0, tint: "bg-tint-1" })}
        onRemove={(p) =>
          set(
            ["demo", "links"],
            content.demo.links.filter((l) => l.a !== p.id && l.b !== p.id),
          )
        }
        render={(path, p) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Text path={[...path, "name"]} label={tf.name} max={LIMITS.short} />
              <Field label={tf.birthDate}>
                <input
                  type="date"
                  min="1900-01-01"
                  value={p.birthDate}
                  onChange={(e) => set([...path, "birthDate"], e.target.value)}
                  className={inputClass}
                />
                <ErrorText path={[...path, "birthDate"]} />
              </Field>
            </div>
            <div className="flex flex-col gap-1.5 text-sm font-medium">
              {tf.avatar}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {avatars.map((uri, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={p.seed === i}
                    aria-label={`${tf.avatar} ${i + 1}`}
                    onClick={() => set([...path, "seed"], i)}
                    className={cn(
                      "size-11 shrink-0 overflow-hidden rounded-full border-2",
                      p.tint,
                      p.seed === i ? "border-highlight" : "border-transparent",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
                    <img src={uri} alt="" className="size-full dark:invert" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              {tf.tint}
              {DEMO_TINTS.map((tint) => (
                <button
                  key={tint}
                  type="button"
                  aria-pressed={p.tint === tint}
                  aria-label={tint}
                  onClick={() => set([...path, "tint"], tint)}
                  className={cn("size-9 rounded-full border-2", tint, p.tint === tint ? "border-highlight" : "border-border")}
                />
              ))}
            </div>
          </>
        )}
      />
      <ItemList<DemoLink>
        path={["demo", "links"]}
        label={tf.links}
        maxItems={8}
        itemLabel={(l) =>
          `${people.find((p) => p.id === l.a)?.name ?? "?"} × ${people.find((p) => p.id === l.b)?.name ?? "?"}`
        }
        blank={() => ({
          id: newId("l"),
          a: people[0]?.id ?? "",
          b: people[1]?.id ?? "",
          goodFor: [],
          cautionFor: [],
          text: "",
        })}
        render={(path, l) => (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tf.personA}>
                <Select value={l.a} onChange={(v) => set([...path, "a"], v)} options={options} label={tf.personA} />
              </Field>
              <Field label={tf.personB}>
                <Select value={l.b} onChange={(v) => set([...path, "b"], v)} options={options} label={tf.personB} />
                <ErrorText path={[...path, "b"]} />
              </Field>
            </div>
            <StringList
              path={[...path, "goodFor"]}
              label={tf.goodFor}
              max={LIMITS.short}
              maxItems={6}
              list="relation-chips"
              hint={t.chipsHint}
            />
            <StringList
              path={[...path, "cautionFor"]}
              label={tf.cautionFor}
              max={LIMITS.short}
              maxItems={6}
              list="relation-chips"
            />
            <Text path={[...path, "text"]} label={tf.text} max={LIMITS.text} multiline />
          </>
        )}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Text path={["demo", "goodLabel"]} label={tf.goodLabel} max={LIMITS.short} />
        <Text path={["demo", "cautionLabel"]} label={tf.cautionLabel} max={LIMITS.short} />
        <Text path={["demo", "example"]} label={tf.example} max={LIMITS.short} />
        <Text path={["demo", "cta"]} label={tf.cta} max={LIMITS.short} />
      </div>
    </Card>
  );
}

function StatsCard() {
  return (
    <Card id="stats">
      <ItemList<{ value: string; label: string }>
        path={["stats", "items"]}
        label={tf.items}
        maxItems={4}
        itemLabel={(s, i) => `${i + 1}. ${s.value}`}
        blank={() => ({ value: "", label: "" })}
        render={(path) => (
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <Text path={[...path, "value"]} label={tf.value} max={LIMITS.short} />
            <Text path={[...path, "label"]} label={tf.label} max={LIMITS.title} />
          </div>
        )}
      />
    </Card>
  );
}

function ProductsCard({ products }: { products: { code: string; name: string }[] }) {
  const { content, set } = useEditor();
  const items = content.products.items;
  const upsert = (code: string, key: "hook" | "badge", value: string) => {
    const i = items.findIndex((x) => x.code === code);
    if (i >= 0) set(["products", "items", i, key], value);
    else set(["products", "items"], [...items, { code, hook: "", badge: "", [key]: value }]);
  };
  return (
    <Card id="products">
      <Text path={["products", "title"]} label={tf.title} max={LIMITS.title} />
      <Text path={["products", "subtitle"]} label={tf.subtitle} max={LIMITS.text} multiline />
      <Text path={["products", "open"]} label={tf.open} max={LIMITS.short} />
      {products.map((p) => {
        const item = items.find((x) => x.code === p.code);
        return (
          <div key={p.code} className="flex flex-col gap-3 rounded-2xl border border-border p-3">
            <span className="text-sm font-semibold">{p.name}</span>
            <Field label={tf.hook}>
              <textarea
                rows={2}
                value={item?.hook ?? ""}
                maxLength={LIMITS.text}
                onChange={(e) => upsert(p.code, "hook", e.target.value)}
                className={cn(inputClass, "h-auto py-3")}
              />
            </Field>
            <Field label={tf.badge}>
              <input
                value={item?.badge ?? ""}
                maxLength={LIMITS.short}
                onChange={(e) => upsert(p.code, "badge", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        );
      })}
    </Card>
  );
}

function SynastryCard({ suggestions }: { suggestions: string[] }) {
  return (
    <Card id="synastry">
      <datalist id="relation-chips-2">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Text path={["synastry", "eyebrow"]} label={tf.eyebrow} max={LIMITS.short * 2} />
      <Text path={["synastry", "title"]} label={tf.title} max={LIMITS.title} />
      <Text path={["synastry", "body"]} label={tf.body} max={LIMITS.text} multiline />
      <StringList path={["synastry", "points"]} label={tf.points} max={LIMITS.short * 2} maxItems={6} />
      <Text path={["synastry", "invite"]} label={tf.invite} max={LIMITS.title * 2} />
      <Text path={["synastry", "cta"]} label={tf.cta} max={LIMITS.short} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Text path={["synastry", "example"]} label={tf.example} max={LIMITS.short} />
        <Text path={["synastry", "pair", 0]} label={tf.pairA} max={LIMITS.short} />
        <Text path={["synastry", "pair", 1]} label={tf.pairB} max={LIMITS.short} />
      </div>
      <StringList
        path={["synastry", "goodFor"]}
        label={tf.goodFor}
        max={LIMITS.short}
        maxItems={6}
        list="relation-chips-2"
        hint={t.chipsHint}
      />
    </Card>
  );
}

function PeopleCard() {
  return (
    <Card id="people">
      <Text path={["people", "eyebrow"]} label={tf.eyebrow} max={LIMITS.short * 2} />
      <Text path={["people", "title"]} label={tf.title} max={LIMITS.title} />
      <Text path={["people", "body"]} label={tf.body} max={LIMITS.text} multiline />
      <StringList path={["people", "relations"]} label={tf.relations} max={LIMITS.short} maxItems={12} />
    </Card>
  );
}

function HowCard() {
  return (
    <Card id="how">
      <Text path={["how", "title"]} label={tf.title} max={LIMITS.title} />
      <ItemList<{ title: string; body: string }>
        path={["how", "steps"]}
        label={tf.steps}
        maxItems={6}
        itemLabel={(s, i) => `${tf.step} ${i + 1}`}
        blank={() => ({ title: "", body: "" })}
        render={(path) => (
          <>
            <Text path={[...path, "title"]} label={tf.title} max={LIMITS.title} />
            <Text path={[...path, "body"]} label={tf.body} max={LIMITS.text} multiline />
          </>
        )}
      />
    </Card>
  );
}

function WalletCard() {
  return (
    <Card id="wallet">
      <Text path={["wallet", "title"]} label={tf.title} max={LIMITS.title} />
      <Text path={["wallet", "subtitle"]} label={tf.subtitle} max={LIMITS.text} multiline />
    </Card>
  );
}

function FaqCard() {
  return (
    <Card id="faq">
      <Text path={["faq", "title"]} label={tf.title} max={LIMITS.title} />
      <ItemList<{ q: string; a: string }>
        path={["faq", "items"]}
        label={tf.items}
        maxItems={20}
        itemLabel={(f, i) => `${i + 1}. ${f.q || tf.faqItem}`}
        blank={() => ({ q: "", a: "" })}
        render={(path) => (
          <>
            <Text path={[...path, "q"]} label={tf.question} max={LIMITS.title * 2} />
            <Text path={[...path, "a"]} label={tf.answer} max={LIMITS.long} multiline />
          </>
        )}
      />
    </Card>
  );
}

function FinalCard() {
  return (
    <Card id="final">
      <Text path={["final", "title"]} label={tf.title} max={LIMITS.title} />
      <Text path={["final", "body"]} label={tf.body} max={LIMITS.text} multiline />
      <Text path={["final", "cta"]} label={tf.cta} max={LIMITS.short} />
    </Card>
  );
}

function HistoryCard({
  versions,
  liveVersion,
  disabled,
  onRestore,
}: {
  versions: Version[];
  liveVersion: number | null;
  disabled: boolean;
  onRestore: (id: string, confirm: string) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="group rounded-3xl bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 font-semibold [&::-webkit-details-marker]:hidden">
        {t.history}
        <ArrowDown className="size-4 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-2 px-5 pb-5">
        {versions.length === 0 && <p className="text-sm text-muted-foreground">{t.historyEmpty}</p>}
        {versions.map((v) => (
          <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-subtle px-4 py-2.5 text-sm">
            <span className="font-semibold">v{v.version}</span>
            {v.version === liveVersion && (
              <span className="rounded-full bg-tint-3 px-2 py-0.5 text-[11px] font-semibold">{t.current}</span>
            )}
            <span className="text-muted-foreground">
              {fmt(v.publishedAt)}
              {v.publishedBy ? ` · ${v.publishedBy}` : ""}
            </span>
            {v.note && <span className="w-full text-xs text-muted-foreground">“{v.note}”</span>}
            <span className="ml-auto flex gap-1.5">
              <a
                href={`/preview/landing?v=${v.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 items-center rounded-full bg-surface px-3 text-xs font-semibold"
              >
                {t.view}
              </a>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRestore(v.id, t.restoreConfirm(v.version))}
                className="h-9 rounded-full bg-surface px-3 text-xs font-semibold disabled:opacity-50"
              >
                {t.restore}
              </button>
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

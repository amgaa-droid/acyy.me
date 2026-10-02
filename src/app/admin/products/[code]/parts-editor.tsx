"use client";

import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import {
  CODE_PATTERN,
  FIELD_KINDS,
  KEY_TYPES,
  KEY_TYPE_ARITY,
  type FieldKind,
  type KeyType,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  addFieldAction,
  addPartAction,
  archiveFieldAction,
  archivePartAction,
  deleteFieldAction,
  deletePartAction,
  moveItemAction,
  updateFieldAction,
  updatePartAction,
  type CatalogResult,
} from "../../actions";
import {
  AppUseBadge,
  Field,
  Select,
  Status,
  Toggle,
  inputClass,
  resultMsg,
  toCode,
  withAppUseConfirm,
  type Msg,
} from "../ui";

const t = mn.admin.productsPage;

export type EditorField = {
  code: string;
  nameMn: string;
  kind: FieldKind;
  isFree: boolean;
  required: boolean;
  archived: boolean;
  /** Texts with a value in this field — only an unused field can be deleted. */
  used: number;
};
export type EditorPart = {
  code: string;
  nameMn: string;
  keyType: KeyType;
  byGender: boolean;
  archived: boolean;
  /** Real texts (deleting / re-keying them needs a confirmation) and seeded placeholders. */
  realTexts: number;
  placeholders: number;
  fields: EditorField[];
};

const kindOptions = FIELD_KINDS.map((k) => ({
  value: k,
  label: `${mn.admin.fieldKinds[k]} — ${mn.admin.fieldKindHints[k]}`,
}));

/**
 * Runs a catalog action, shows its result and refreshes the page data on success. `fn` gets
 * `acknowledge`: true once the admin agreed to change a row the app's own screens use.
 */
function useCatalogAction() {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: (acknowledge: boolean) => Promise<CatalogResult>, onOk?: () => void) =>
    startTransition(async () => {
      const res = await withAppUseConfirm(fn);
      setMsg(res.ok ? null : resultMsg(res, t.saved));
      if (res.ok) {
        onOk?.();
        router.refresh();
      }
    });
  return { msg, pending, run };
}

/**
 * Parts (what the texts are keyed by) and their sub-sections, in reading order. Field codes are
 * the Excel column names and the keys in stored texts, so they can't be renamed — only archived.
 */
export function PartsEditor({
  productCode,
  personCount,
  hasPurchases,
  parts,
}: {
  productCode: string;
  personCount: number;
  hasPurchases: boolean;
  parts: EditorPart[];
}) {
  const activeCount = parts.filter((p) => !p.archived).length;
  return (
    <section className="flex flex-col gap-4" aria-label={t.parts}>
      <div>
        <h2 className="text-2xl font-semibold">{t.parts}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.partsHint}</p>
      </div>
      {parts.map((part, i) => (
        <PartCard
          key={part.code}
          productCode={productCode}
          personCount={personCount}
          hasPurchases={hasPurchases}
          part={part}
          isOnlyActive={!part.archived && activeCount <= 1}
          first={i === 0}
          last={i === parts.length - 1}
        />
      ))}
      <AddPart productCode={productCode} personCount={personCount} />
    </section>
  );
}

function PartCard({
  productCode,
  personCount,
  hasPurchases,
  part,
  isOnlyActive,
  first,
  last,
}: {
  productCode: string;
  personCount: number;
  hasPurchases: boolean;
  part: EditorPart;
  isOnlyActive: boolean;
  first: boolean;
  last: boolean;
}) {
  const { msg, pending, run } = useCatalogAction();
  const [editing, setEditing] = useState(false);
  const [nameMn, setName] = useState(part.nameMn);
  const [keyType, setKeyType] = useState<KeyType>(part.keyType);
  const [byGender, setByGender] = useState(part.byGender && personCount === 1);
  // Bought readings keep their keys: a bought product's parts can't be re-keyed.
  const keysLocked = hasPurchases;
  const single = !(first && last);

  const save = () => {
    const keysChange = keyType !== part.keyType || byGender !== part.byGender;
    let ok = true;
    if (keysChange && part.realTexts > 0) {
      const split = keyType === part.keyType && !part.byGender && byGender;
      ok = confirm(
        split ? t.confirmSplitTexts(part.realTexts) : t.confirmDeleteTexts(part.realTexts),
      );
    }
    if (!ok) return;
    run(
      (acknowledge) =>
        updatePartAction({
          productCode,
          code: part.code,
          nameMn,
          keyType,
          byGender,
          confirm: keysChange,
          acknowledge,
        }),
      () => setEditing(false),
    );
  };

  const remove = () => {
    const text = part.realTexts > 0 ? t.deletePartWithTexts(part.realTexts) : t.deletePartConfirm;
    if (confirm(text)) {
      run((acknowledge) =>
        deletePartAction({ productCode, partCode: part.code, confirm: true, acknowledge }),
      );
    }
  };

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-3xl bg-surface p-5",
        part.archived && "opacity-70",
      )}
    >
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            {part.nameMn}
            {part.archived && <Badge className="text-xs font-medium">{t.archived}</Badge>}
            <AppUseBadge target={{ product: productCode, part: part.code }} />
          </h3>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{part.code}</span> · {mn.admin.keyTypes[part.keyType]}
            {part.byGender && ` · ${t.byGender}`} · {t.texts(part.realTexts, part.placeholders)}
          </p>
          {part.archived && (
            <p className="mt-1 text-xs text-muted-foreground">{t.partArchivedHint}</p>
          )}
        </div>
        <div className="flex gap-1">
          {single && (
            <>
              <IconButton
                label={t.up}
                disabled={first || pending}
                onClick={() =>
                  run(() =>
                    moveItemAction({ productCode, partCode: null, code: part.code, dir: "up" }),
                  )
                }
              >
                <ChevronUp />
              </IconButton>
              <IconButton
                label={t.down}
                disabled={last || pending}
                onClick={() =>
                  run(() =>
                    moveItemAction({ productCode, partCode: null, code: part.code, dir: "down" }),
                  )
                }
              >
                <ChevronDown />
              </IconButton>
            </>
          )}
          <IconButton label={t.edit} onClick={() => setEditing((v) => !v)}>
            <Pencil />
          </IconButton>
          {hasPurchases ? (
            <IconButton
              label={part.archived ? t.restore : t.archivePart}
              disabled={pending || isOnlyActive}
              onClick={() =>
                run((acknowledge) =>
                  archivePartAction({
                    productCode,
                    partCode: part.code,
                    archived: !part.archived,
                    acknowledge,
                  }),
                )
              }
            >
              {part.archived ? <ArchiveRestore /> : <Archive />}
            </IconButton>
          ) : (
            <IconButton label={t.delete} disabled={pending || isOnlyActive} onClick={remove}>
              <Trash2 />
            </IconButton>
          )}
        </div>
      </header>

      {editing && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl bg-subtle/60 p-4 sm:grid-cols-2">
          <Field label={t.partName}>
            <input
              className={cn(inputClass, "bg-surface")}
              value={nameMn}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            label={t.keyType}
            hint={
              keysLocked
                ? t.keysLocked
                : part.realTexts > 0 && (keyType !== part.keyType || byGender !== part.byGender)
                  ? keyType === part.keyType && byGender
                    ? t.confirmSplitTexts(part.realTexts)
                    : t.confirmDeleteTexts(part.realTexts)
                  : undefined
            }
          >
            <Select
              value={keyType}
              disabled={keysLocked}
              onChange={(v) => setKeyType(v as KeyType)}
              options={KEY_TYPES.filter((k) => KEY_TYPE_ARITY[k] === personCount).map((k) => ({
                value: k,
                label: mn.admin.keyTypes[k],
              }))}
            />
          </Field>
          {personCount === 1 && (
            <Field label={t.byGender}>
              <div>
                <Toggle
                  label={t.byGender}
                  on={byGender}
                  disabled={keysLocked}
                  onChange={setByGender}
                />
              </div>
            </Field>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <Button className="rounded-full" disabled={pending || !nameMn.trim()} onClick={save}>
              {t.save}
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => setEditing(false)}>
              {t.cancel}
            </Button>
          </div>
        </div>
      )}
      <Status msg={msg} />

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-muted-foreground">{t.fields}</h4>
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {part.fields.map((f, i) => (
            <FieldRow
              key={f.code}
              productCode={productCode}
              partCode={part.code}
              field={f}
              first={i === 0}
              last={i === part.fields.length - 1}
            />
          ))}
        </ul>
      </div>
      <AddField
        productCode={productCode}
        partCode={part.code}
        taken={part.fields.map((f) => f.code)}
      />
    </article>
  );
}

function FieldRow({
  productCode,
  partCode,
  field,
  first,
  last,
}: {
  productCode: string;
  partCode: string;
  field: EditorField;
  first: boolean;
  last: boolean;
}) {
  const { msg, pending, run } = useCatalogAction();
  const [editing, setEditing] = useState(false);
  const [nameMn, setName] = useState(field.nameMn);
  const [kind, setKind] = useState<FieldKind>(field.kind);
  const [isFree, setFree] = useState(field.isFree);
  const [required, setRequired] = useState(field.required);
  const ref = { productCode, partCode, code: field.code };

  return (
    <li className={cn("flex flex-col gap-3 px-4 py-3", field.archived && "bg-subtle/60")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn("font-semibold", field.archived && "text-muted-foreground line-through")}
          >
            {field.nameMn}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{field.code}</span>
            <Badge>{mn.admin.fieldKinds[field.kind]}</Badge>
            {field.isFree && <Badge className="bg-tint-3 text-fg">{mn.admin.content.free}</Badge>}
            {field.required && <Badge>{t.required}</Badge>}
            {field.archived && <Badge>{t.archived}</Badge>}
            <AppUseBadge target={{ product: productCode, part: partCode, field: field.code }} />
            {field.used > 0 && <span>{t.usedIn(field.used)}</span>}
          </span>
        </div>
        <div className="flex gap-1">
          <IconButton
            label={t.up}
            disabled={first || pending}
            onClick={() => run(() => moveItemAction({ ...ref, dir: "up" }))}
          >
            <ChevronUp />
          </IconButton>
          <IconButton
            label={t.down}
            disabled={last || pending}
            onClick={() => run(() => moveItemAction({ ...ref, dir: "down" }))}
          >
            <ChevronDown />
          </IconButton>
          {!field.archived && (
            <IconButton label={t.edit} onClick={() => setEditing((v) => !v)}>
              <Pencil />
            </IconButton>
          )}
          <IconButton
            label={field.archived ? t.restore : t.archive}
            disabled={pending}
            onClick={() =>
              run((acknowledge) =>
                archiveFieldAction({ ...ref, archived: !field.archived, acknowledge }),
              )
            }
          >
            {field.archived ? <ArchiveRestore /> : <Archive />}
          </IconButton>
          {field.used === 0 && (
            <IconButton
              label={t.delete}
              disabled={pending}
              onClick={() => {
                if (confirm(t.deleteFieldConfirm)) {
                  run((acknowledge) => deleteFieldAction({ ...ref, acknowledge }));
                }
              }}
            >
              <Trash2 />
            </IconButton>
          )}
        </div>
      </div>
      {editing && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.fieldName}>
            <input
              className={inputClass}
              value={nameMn}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label={t.fieldKind}>
            <Select value={kind} onChange={(v) => setKind(v as FieldKind)} options={kindOptions} />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Toggle label={t.free} on={isFree} onChange={setFree} />
            <Toggle label={t.required} on={required} onChange={setRequired} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button
              className="rounded-full"
              disabled={pending || !nameMn.trim()}
              onClick={() =>
                run(
                  (acknowledge) =>
                    updateFieldAction({ ...ref, nameMn, kind, isFree, required, acknowledge }),
                  () => setEditing(false),
                )
              }
            >
              {t.save}
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => setEditing(false)}>
              {t.cancel}
            </Button>
          </div>
        </div>
      )}
      <Status msg={msg} />
    </li>
  );
}

function AddField({
  productCode,
  partCode,
  taken,
}: {
  productCode: string;
  partCode: string;
  taken: string[];
}) {
  const { msg, pending, run } = useCatalogAction();
  const [code, setCode] = useState("");
  const [nameMn, setName] = useState("");
  const [kind, setKind] = useState<FieldKind>("text");
  const [isFree, setFree] = useState(false);
  const [required, setRequired] = useState(false);
  const valid = CODE_PATTERN.test(code) && !taken.includes(code) && nameMn.trim();

  const add = () =>
    run(
      () => addFieldAction({ productCode, partCode, code, nameMn, kind, isFree, required }),
      () => {
        setCode("");
        setName("");
        setKind("text");
        setFree(false);
        setRequired(false);
      },
    );

  return (
    <details className="rounded-2xl bg-subtle/60 p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
        <Plus className="size-4" aria-hidden /> {t.addField}
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t.fieldName}>
          <input
            className={cn(inputClass, "bg-surface")}
            value={nameMn}
            maxLength={80}
            placeholder="Эрүүл мэнд"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t.fieldCode}>
          <input
            className={cn(inputClass, "bg-surface font-mono")}
            value={code}
            placeholder="health"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setCode(toCode(e.target.value))}
          />
        </Field>
        <Field label={t.fieldKind}>
          <Select value={kind} onChange={(v) => setKind(v as FieldKind)} options={kindOptions} />
        </Field>
        <div className="flex gap-2 sm:col-span-2">
          <Toggle label={t.free} on={isFree} onChange={setFree} />
          <Toggle label={t.required} on={required} onChange={setRequired} />
        </div>
        <div className="sm:col-span-2">
          <Button className="rounded-full" disabled={pending || !valid} onClick={add}>
            {t.addField}
          </Button>
        </div>
      </div>
      <Status msg={msg} />
    </details>
  );
}

function AddPart({ productCode, personCount }: { productCode: string; personCount: number }) {
  const { msg, pending, run } = useCatalogAction();
  const options = KEY_TYPES.filter((k) => KEY_TYPE_ARITY[k] === personCount);
  const [code, setCode] = useState("");
  const [nameMn, setName] = useState("");
  const [keyType, setKeyType] = useState<KeyType>(options[0]);
  const [byGender, setByGender] = useState(false);

  const add = () =>
    run(
      () => addPartAction({ productCode, code, nameMn, keyType, byGender }),
      () => {
        setCode("");
        setName("");
      },
    );

  return (
    <details className="rounded-3xl border-2 border-dashed border-border p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <Plus className="size-5" aria-hidden /> {t.addPart}
      </summary>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t.partName}>
          <input
            className={inputClass}
            value={nameMn}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t.partCode}>
          <input
            className={cn(inputClass, "font-mono")}
            value={code}
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setCode(toCode(e.target.value))}
          />
        </Field>
        <Field label={t.keyType}>
          <Select
            value={keyType}
            onChange={(v) => setKeyType(v as KeyType)}
            options={options.map((k) => ({ value: k, label: mn.admin.keyTypes[k] }))}
          />
        </Field>
        {personCount === 1 && (
          <Field label={t.byGender}>
            <div>
              <Toggle label={t.byGender} on={byGender} onChange={setByGender} />
            </div>
          </Field>
        )}
        <div className="sm:col-span-2">
          <Button
            className="rounded-full"
            disabled={pending || !CODE_PATTERN.test(code) || !nameMn.trim()}
            onClick={add}
          >
            {t.addPart}
          </Button>
        </div>
      </div>
      <Status msg={msg} />
    </details>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full bg-subtle disabled:opacity-40 [&_svg]:size-4.5"
    >
      {children}
    </button>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-full bg-subtle px-2 py-0.5 font-medium", className)}>
      {children}
    </span>
  );
}

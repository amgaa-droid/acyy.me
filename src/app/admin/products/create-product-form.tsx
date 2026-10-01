"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { CODE_PATTERN, KEY_TYPES, KEY_TYPE_ARITY, type KeyType } from "@/lib/domain";
import { createProductAction } from "../actions";
import { Field, Select, Status, Toggle, inputClass, resultMsg, toCode, type Msg } from "./ui";

const t = mn.admin.productsPage;

/** A new product: code, name, price, 1 or 2 people and what its texts are keyed by. */
export function CreateProductForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("1000");
  const [personCount, setPersonCount] = useState<1 | 2>(1);
  const [keyType, setKeyType] = useState<KeyType>("sign");
  const [byGender, setByGender] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();

  const keyOptions = KEY_TYPES.filter((k) => KEY_TYPE_ARITY[k] === personCount);
  const setCount = (n: 1 | 2) => {
    setPersonCount(n);
    setKeyType(n === 1 ? "sign" : "sign_pair");
    setByGender(false);
  };

  const submit = () =>
    startTransition(async () => {
      const res = await createProductAction({
        code,
        nameMn: name,
        price: Number(price),
        personCount,
        keyType,
        byGender,
      });
      setMsg(resultMsg(res, t.saved));
      if (res.ok) router.push(`/admin/products/${code}`);
    });

  return (
    <details className="group rounded-3xl bg-surface p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <Plus className="size-5" aria-hidden /> {t.new}
      </summary>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Field label={t.code} hint={t.codeHint}>
          <input
            className={inputClass}
            value={code}
            onChange={(e) => setCode(toCode(e.target.value))}
            autoCapitalize="off"
            spellCheck={false}
          />
        </Field>
        <Field label={t.name}>
          <input
            className={inputClass}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t.price}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <fieldset className="flex flex-col gap-1.5 text-sm font-medium">
          <legend className="mb-1.5">{t.personCount}</legend>
          <div className="flex gap-2">
            {([1, 2] as const).map((n) => (
              <Toggle
                key={n}
                label={t.persons(n)}
                on={personCount === n}
                onChange={() => setCount(n)}
              />
            ))}
          </div>
        </fieldset>
        <Field label={t.keyType}>
          <Select
            value={keyType}
            onChange={(v) => setKeyType(v as KeyType)}
            options={keyOptions.map((k) => ({ value: k, label: mn.admin.keyTypes[k] }))}
          />
        </Field>
        {personCount === 1 && (
          <Field label={t.byGender} hint={t.byGenderHint}>
            <div>
              <Toggle label={t.byGender} on={byGender} onChange={setByGender} />
            </div>
          </Field>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Status msg={msg} />
        <Button
          className="rounded-full lg:w-48"
          disabled={pending || !CODE_PATTERN.test(code) || !name.trim()}
          onClick={submit}
        >
          {t.create}
        </Button>
      </div>
    </details>
  );
}

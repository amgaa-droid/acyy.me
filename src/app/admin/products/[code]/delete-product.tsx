"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { deleteProductAction } from "../../actions";
import { Status, resultMsg, withAppUseConfirm, type Msg } from "../ui";

const t = mn.admin.productsPage;

/** Only shown for products nobody has bought (the server checks again). */
export function DeleteProduct({ code }: { code: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="destructive"
        className="self-start rounded-full"
        disabled={pending}
        onClick={() => {
          if (!confirm(t.deleteConfirm)) return;
          startTransition(async () => {
            const res = await withAppUseConfirm((acknowledge) =>
              deleteProductAction(code, acknowledge),
            );
            setMsg(resultMsg(res, t.deleted));
            if (res.ok) router.push("/admin/products");
          });
        }}
      >
        <Trash2 aria-hidden /> {t.deleteProduct}
      </Button>
      <Status msg={msg} />
    </div>
  );
}

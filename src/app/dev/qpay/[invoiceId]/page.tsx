import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatMnt, mn } from "@/i18n/mn";
import { safeNext } from "@/lib/safe-next";
import { mockQPay } from "@/server/qpay";

export const dynamic = "force-dynamic";

/** Mock QPay "bank app" (QPAY_MODE=mock only, never in production builds). */
export default async function MockQPayPage({
  params,
  searchParams,
}: PageProps<"/dev/qpay/[invoiceId]">) {
  const mock = process.env.NODE_ENV === "production" ? null : mockQPay();
  if (!mock) notFound();
  const { invoiceId } = await params;
  const { next } = await searchParams;
  const inv = mock.get(invoiceId);
  const t = mn.wallet.mock;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-3xl bg-surface p-6 text-center">
        <span className="text-xs font-semibold tracking-widest text-highlight uppercase">
          {t.title}
        </span>
        {inv ? (
          <>
            <p className="font-heading text-6xl font-semibold tabular-nums">
              {formatMnt(inv.amount)}
            </p>
            <p className="text-sm text-muted-foreground">{t.body}</p>
            {inv.paid ? (
              <p className="rounded-2xl bg-tint-3 p-3 font-semibold">✓</p>
            ) : (
              <form method="post" action="/api/dev/qpay" className="grid grid-cols-2 gap-2">
                <input type="hidden" name="invoiceId" value={invoiceId} />
                <input
                  type="hidden"
                  name="next"
                  value={safeNext(typeof next === "string" ? next : undefined, "/wallet")}
                />
                <Button
                  type="submit"
                  name="op"
                  value="cancel"
                  variant="outline"
                  size="lg"
                  className="w-full rounded-full"
                >
                  {t.cancel}
                </Button>
                <Button
                  type="submit"
                  name="op"
                  value="pay"
                  size="lg"
                  className="w-full rounded-full"
                >
                  {t.pay}
                </Button>
              </form>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t.notFound}</p>
        )}
      </div>
    </main>
  );
}

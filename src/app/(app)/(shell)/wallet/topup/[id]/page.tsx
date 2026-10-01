import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mn } from "@/i18n/mn";
import { safeNext } from "@/lib/safe-next";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { mockQPay } from "@/server/qpay";
import { TopupNotFoundError, getTopupForUser } from "@/server/topups";
import { getBalance } from "@/server/wallet";
import { InvoiceView } from "./invoice-view";

export const metadata: Metadata = { title: mn.wallet.invoice.title };

export default async function TopupInvoicePage({
  params,
  searchParams,
}: PageProps<"/wallet/topup/[id]">) {
  const { id } = await params;
  const { next } = await searchParams;
  const { user } = await requireOnboardedUser();
  const topup = await getTopupForUser(db, user.id, id).catch((err) => {
    if (err instanceof TopupNotFoundError) notFound();
    throw err;
  });
  const mock = mockQPay();

  return (
    <InvoiceView
      topup={{
        id: topup.id,
        amount: topup.amount,
        bonus: topup.bonus,
        status: topup.status,
        invoice: topup.invoiceData,
      }}
      balance={await getBalance(db, user.id)}
      next={safeNext(typeof next === "string" ? next : undefined, "/wallet")}
      mockPayUrl={mock && topup.invoiceId ? `/dev/qpay/${topup.invoiceId}` : null}
    />
  );
}

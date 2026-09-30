import Link from "next/link";

import { APP_NAME } from "@/env";
import { WalletChip } from "./wallet-chip";

/** Top bar: logo + wallet balance chip. Balance is a placeholder until C5. */
export function Header({ balance = 0 }: { balance?: number }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-(--header-h) max-w-md items-center justify-between px-4">
        <Link href="/home" className="font-heading text-2xl font-semibold tracking-tight">
          {APP_NAME}
        </Link>
        <WalletChip balance={balance} />
      </div>
    </header>
  );
}

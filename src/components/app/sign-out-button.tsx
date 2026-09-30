"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      size="lg"
      className="rounded-full lg:w-auto"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      <LogOut aria-hidden /> {mn.me.signOut}
    </Button>
  );
}

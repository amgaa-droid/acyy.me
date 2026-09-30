import type { Metadata } from "next";

import { mn } from "@/i18n/mn";
import { avatarOptions } from "@/lib/avatars";
import { NewPersonFlow } from "./new-person-flow";

export const metadata: Metadata = { title: mn.people.newTitle };

export default function NewPersonPage() {
  return <NewPersonFlow avatars={avatarOptions()} />;
}

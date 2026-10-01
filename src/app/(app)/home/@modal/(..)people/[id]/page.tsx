import Screen from "@/app/(app)/(shell)/people/[id]/page";
import { RouteModal } from "@/components/app/route-modal";
import { mn } from "@/i18n/mn";

export default function Popup(props: PageProps<"/people/[id]">) {
  return (
    <RouteModal label={mn.people.title}>
      <Screen {...props} />
    </RouteModal>
  );
}

import Screen from "@/app/(app)/(shell)/people/new/page";
import { RouteModal } from "@/components/app/route-modal";
import { mn } from "@/i18n/mn";

export default function Popup(props: PageProps<"/people/new">) {
  return (
    <RouteModal label={mn.people.newTitle}>
      <Screen {...props} />
    </RouteModal>
  );
}

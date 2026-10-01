import Screen from "@/app/(app)/(shell)/people/page";
import { RouteModal } from "@/components/app/route-modal";
import { mn } from "@/i18n/mn";

export default function Popup() {
  return (
    <RouteModal label={mn.people.title}>
      <Screen />
    </RouteModal>
  );
}

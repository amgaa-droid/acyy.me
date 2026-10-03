import Screen from "@/app/(app)/(shell)/help/page";
import { RouteModal } from "@/components/app/route-modal";
import { mn } from "@/i18n/mn";

export default function Popup() {
  return (
    <RouteModal label={mn.help.title}>
      <Screen />
    </RouteModal>
  );
}

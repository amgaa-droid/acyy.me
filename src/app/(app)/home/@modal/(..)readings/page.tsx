import Screen from "@/app/(app)/(shell)/readings/page";
import { RouteModal } from "@/components/app/route-modal";
import { mn } from "@/i18n/mn";

export default function Popup(props: PageProps<"/readings">) {
  return (
    <RouteModal label={mn.readings.title}>
      <Screen {...props} />
    </RouteModal>
  );
}

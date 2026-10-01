import Screen from "@/app/(app)/(shell)/buy/[product]/page";
import { RouteModal } from "@/components/app/route-modal";
import { mn } from "@/i18n/mn";

export default function Popup(props: PageProps<"/buy/[product]">) {
  return (
    <RouteModal label={mn.readings.title}>
      <Screen {...props} />
    </RouteModal>
  );
}

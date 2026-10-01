import Screen from "@/app/(app)/(shell)/r/[purchaseId]/page";
import { RouteModal } from "@/components/app/route-modal";
import { mn } from "@/i18n/mn";

export default function Popup(props: PageProps<"/r/[purchaseId]">) {
  return (
    <RouteModal label={mn.readings.title}>
      <Screen {...props} />
    </RouteModal>
  );
}

import Screen from "@/app/(app)/(shell)/wallet/topup/[id]/page";
import { RouteModal } from "@/components/app/route-modal";
import { mn } from "@/i18n/mn";

export default function Popup(props: PageProps<"/wallet/topup/[id]">) {
  return (
    <RouteModal label={mn.header.wallet}>
      <Screen {...props} />
    </RouteModal>
  );
}

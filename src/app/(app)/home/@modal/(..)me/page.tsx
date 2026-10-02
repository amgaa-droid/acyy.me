import Screen from "@/app/(app)/(shell)/me/page";
import { RouteModal } from "@/components/app/route-modal";
import { mn } from "@/i18n/mn";

export default function Popup(props: PageProps<"/me">) {
  return (
    <RouteModal label={mn.me.title}>
      <Screen {...props} />
    </RouteModal>
  );
}

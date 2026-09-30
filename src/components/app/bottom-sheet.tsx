"use client";

import { X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";
import { mn } from "@/i18n/mn";

type BottomSheetProps = {
  title: string;
  description?: string;
  /** Element that opens the sheet (uncontrolled usage). */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
  /** Primary actions, pinned to the bottom of the sheet. */
  footer?: ReactNode;
};

/**
 * Choices and confirmations: a swipeable bottom sheet on mobile,
 * a centered dialog on desktop (`lg`+).
 */
export function BottomSheet(props: BottomSheetProps) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <CenteredDialog {...props} /> : <MobileSheet {...props} />;
}

function MobileSheet({
  title,
  description,
  trigger,
  open,
  onOpenChange,
  children,
  footer,
}: BottomSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      {trigger && <DrawerTrigger render={trigger} />}
      <DrawerContent className="mx-auto max-w-md pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-semibold">{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        {children && <div className="overflow-y-auto px-4 py-4">{children}</div>}
        {footer && <DrawerFooter>{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}

function CenteredDialog({
  title,
  description,
  trigger,
  open,
  onOpenChange,
  children,
  footer,
}: BottomSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent showCloseButton={false} className="gap-5 rounded-2xl p-7 sm:max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <DialogTitle className="font-heading text-3xl font-semibold">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </div>
          <DialogClose
            aria-label={mn.common.close}
            className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-subtle"
          >
            <X className="size-5" aria-hidden />
          </DialogClose>
        </div>
        {children}
        {footer && <div className="flex flex-col gap-2">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}

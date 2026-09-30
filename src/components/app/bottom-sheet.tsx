"use client";

import type { ReactElement, ReactNode } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

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

/** Mobile bottom sheet (swipe down to close). Use for choices and confirmations. */
export function BottomSheet({
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
          <DrawerTitle className="text-xl">{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        {children && <div className="overflow-y-auto px-4 py-4">{children}</div>}
        {footer && <DrawerFooter>{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}

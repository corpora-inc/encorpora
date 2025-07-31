import * as React from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "./ui/scroll-area";

const DrawerDialog = ({
  children,
  title,
  description,
  trigger,
  drawerCloseButton,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  title: string;
  drawerCloseButton?: React.ReactNode;

  description: string;
}) => {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="flex flex-col max-h-[90vh]">
        <DrawerHeader className="text-left flex-shrink-0">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
          <div className="px-4">{children}</div>
        <DrawerFooter className="pt-2 flex-shrink-0">
          {drawerCloseButton && (
            <DrawerClose asChild>{drawerCloseButton}</DrawerClose>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default DrawerDialog;

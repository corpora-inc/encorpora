import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useState } from "react";
import { SettingsIcon } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { SettingsComponent, SettingsProps } from "./SettingsComponent";

export const DrawerDialogSetting: React.FC<SettingsProps> = ({
  onSettingsChange,
  settings,
}) => {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-md p-0">
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <SettingsComponent
            onSettingsChange={onSettingsChange}
            settings={settings}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-md p-0">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Settings</DrawerTitle>
        </DrawerHeader>
        <SettingsComponent
          onSettingsChange={onSettingsChange}
          settings={settings}
        />
      </DrawerContent>
    </Drawer>
  );
};

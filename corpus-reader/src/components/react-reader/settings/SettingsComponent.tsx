import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FontSettings from "./FontSettings";
import LayoutSettings from "./LayoutSettings";
import { ThemeSettings } from "./ThemeSettings";
import { useSettingsStore } from "@/store/useSettingsStore";
import { ScrollArea } from "@/components/ui/scroll-area";

export type Settings = {
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  lineHeight: number;
  textAlign: "left" | "center" | "right" | "justify";
  spread: "none" | "auto";
  theme: string;
};

// Props are managed via zustand store

export const SettingsComponent = () => {
  const settings = useSettingsStore((state) => state.settings);
  const onSettingsChange = useSettingsStore((state) => state.setSettings);
  return (
    <div className="px-4 h-[50vh]">
      <Tabs defaultValue="font" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="font">Font</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
        </TabsList>
        <TabsContent value="font">
          <FontSettings
            onSettingsChange={onSettingsChange}
            settings={settings}
          />
        </TabsContent>
        <TabsContent value="layout">
          <LayoutSettings
            onSettingsChange={onSettingsChange}
            settings={settings}
          />
        </TabsContent>
        <TabsContent value="theme">
          <ScrollArea className="max-h-[50vh] overflow-y-auto">
            <ThemeSettings
              onSettingsChange={onSettingsChange}
              settings={settings}
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

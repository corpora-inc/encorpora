import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FontSettings from "./FontSettings";
import LayoutSettings from "./LayoutSettings";
import { ThemeSettings } from "./ThemeSettings";

export type Settings = {
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  lineHeight: number;
  textAlign: "left" | "center" | "right" | "justify";
  spread: "none" | "auto";
  theme: string;
};

export type SettingsProps = {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
};

export const SettingsComponent = ({
  settings,
  onSettingsChange,
}: SettingsProps) => {
  return (
    <div className="px-4">
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
          <ThemeSettings
            onSettingsChange={onSettingsChange}
            settings={settings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

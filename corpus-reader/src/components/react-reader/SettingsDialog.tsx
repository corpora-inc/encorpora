import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { SettingsIcon } from "lucide-react";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

export type ReaderTheme = {
  name: string;
  styles: {
    body: {
      background: string;
      color: string;
    };
  };
};

export type Settings = {
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  lineHeight: number;
  textAlign: "left" | "center" | "right" | "justify";
  spread: "none" | "auto";
  theme: string;
};

type SettingsDialogProps = {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
  themes: ReaderTheme[];
};

export const SettingsDialog = ({
  settings,
  onSettingsChange,
  themes,
}: SettingsDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-md p-0">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="font" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="font">Font</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="theme">Theme</TabsTrigger>
          </TabsList>
          <TabsContent value="font">
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Font Size ({settings.fontSize}%)</Label>
                <Slider
                  value={[settings.fontSize]}
                  onValueChange={([value]) =>
                    onSettingsChange({ fontSize: value })
                  }
                  min={80}
                  max={200}
                  step={10}
                />
              </div>
              <div className="space-y-2">
                <Label>Font Weight</Label>
                <Select
                  value={settings.fontWeight}
                  onValueChange={(value) =>
                    onSettingsChange({ fontWeight: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select font weight" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="300">300</SelectItem>
                    <SelectItem value="400">400 (Normal)</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="600">600</SelectItem>
                    <SelectItem value="700">700 (Bold)</SelectItem>
                    <SelectItem value="800">800</SelectItem>
                    <SelectItem value="900">900</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select
                  value={settings.fontFamily}
                  onValueChange={(value) =>
                    onSettingsChange({ fontFamily: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select font family" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="'Arial', sans-serif">Arial</SelectItem>
                    <SelectItem value="'Georgia', serif">Georgia</SelectItem>
                    <SelectItem value="'Times New Roman', serif">
                      Times New Roman
                    </SelectItem>
                    <SelectItem value="'Verdana', sans-serif">Verdana</SelectItem>
                    <SelectItem value="'Inter', sans-serif">Inter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="layout">
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Line Height ({settings.lineHeight})</Label>
                <Slider
                  value={[settings.lineHeight]}
                  onValueChange={([value]) =>
                    onSettingsChange({ lineHeight: value })
                  }
                  min={1}
                  max={2}
                  step={0.1}
                />
              </div>
              <div className="space-y-2">
                <Label>Text Align</Label>
                <RadioGroup
                  value={settings.textAlign}
                  onValueChange={(value) =>
                    onSettingsChange({
                      textAlign: value as Settings["textAlign"],
                    })
                  }
                  className="grid grid-cols-2 gap-2"
                >
                  <div>
                    <RadioGroupItem value="left" id="left" className="sr-only peer" />
                    <Label htmlFor="left" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Left</Label>
                  </div>
                  <div>
                    <RadioGroupItem value="center" id="center" className="sr-only peer" />
                    <Label htmlFor="center" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Center</Label>
                  </div>
                  <div>
                    <RadioGroupItem value="right" id="right" className="sr-only peer" />
                    <Label htmlFor="right" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Right</Label>
                  </div>
                  <div>
                    <RadioGroupItem value="justify" id="justify" className="sr-only peer" />
                    <Label htmlFor="justify" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Justify</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Page Layout</Label>
                <RadioGroup
                  value={settings.spread}
                  onValueChange={(value) =>
                    onSettingsChange({
                      spread: value as Settings["spread"],
                    })
                  }
                  className="grid grid-cols-2 gap-2"
                >
                  <div>
                    <RadioGroupItem value="auto" id="auto" className="sr-only peer" />
                    <Label htmlFor="auto" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Double Page</Label>
                  </div>
                  <div>
                    <RadioGroupItem value="none" id="none" className="sr-only peer" />
                    <Label htmlFor="none" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Single Page</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="theme">
            <div className="space-y-4 py-4">
              <RadioGroup
                value={settings.theme}
                onValueChange={(value) => onSettingsChange({ theme: value })}
                className="grid grid-cols-3 gap-2"
              >
                {themes.map((theme) => (
                  <div key={theme.name}>
                    <RadioGroupItem value={theme.name} id={theme.name} className="sr-only peer" />
                    <Label htmlFor={theme.name} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                      {theme.name}
                      <span
                        className="block w-full h-6 rounded-sm mt-2"
                        style={{ backgroundColor: theme.styles.body.background }}
                      />
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MinusIcon, PlusIcon } from "lucide-react";

interface FontSettingsProps {
  onSettingsChange: (settings: Partial<Settings>) => void;
  settings: Settings;
}

interface Settings {
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  lineHeight: number;
  textAlign: "left" | "center" | "right" | "justify";
  spread: "none" | "auto";
  theme: string;
}

const FontSettings = ({ onSettingsChange, settings }: FontSettingsProps) => {
  const handleFontSizeChange = (increment: number) => {
    const newSize = settings.fontSize + increment;
    if (newSize >= 50 && newSize <= 200) {
      onSettingsChange({ fontSize: newSize });
    }
  };

  const handleFontWeightChange = (fontWeight: string) => {
    onSettingsChange({ fontWeight });
  };

  return (
    <div className="space-y-8 py-6 ">
      {/* Font Size Control */}
      <div className="flex items-center justify-between">
        <Label>Font Size ({settings.fontSize}%)</Label>
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleFontSizeChange(-10)}
            className="h-8 w-8 p-0 !rounded-full"
          >
            <MinusIcon className="h-1 w-1" />
          </Button>
          <span className="min-w-[3rem] text-center">{settings.fontSize}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleFontSizeChange(10)}
            className="h-8 w-8 p-0 !rounded-full"
          >
            <PlusIcon className="h-1 w-1" />
          </Button>
        </div>
      </div>

      {/* Font Weight Section */}
      <div className="flex items-center justify-between">
        <Label>Font Weight</Label>
        <Select
          value={settings.fontWeight}
          onValueChange={handleFontWeightChange}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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

      {/* Font Family Section */}
      <div className="flex items-center justify-between">
        <Label>Font</Label>
        <Select
          value={settings.fontFamily}
          onValueChange={(value) => onSettingsChange({ fontFamily: value })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="serif">Serif</SelectItem>
            <SelectItem value="sans-serif">Sans-serif</SelectItem>
            <SelectItem value="monospace">Monospace</SelectItem>
            <SelectItem value="'Arial', sans-serif">Arial</SelectItem>
            <SelectItem value="'Georgia', serif">Georgia</SelectItem>
            <SelectItem value="'Times New Roman', serif">
              Times New Roman
            </SelectItem>
            <SelectItem value="'Helvetica', sans-serif">Helvetica</SelectItem>
            <SelectItem value="'Verdana', sans-serif">Verdana</SelectItem>
            <SelectItem value="'Courier New', monospace">
              Courier New
            </SelectItem>
            <SelectItem value="'Monaco', monospace">Monaco</SelectItem>
            <SelectItem value="'Consolas', monospace">Consolas</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default FontSettings;

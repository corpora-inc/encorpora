import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Settings, SettingsProps } from "./SettingsComponent";
import { useMediaQuery } from "@/hooks/use-media-query";

const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left", id: "left" },
  { value: "center", label: "Center", id: "center" },
  { value: "right", label: "Right", id: "right" },
  { value: "justify", label: "Justify", id: "justify" },
];

const PAGE_LAYOUT_OPTIONS = [
  { value: "auto", label: "Double Page", id: "auto" },
  { value: "none", label: "Single Page", id: "none" },
];

// Reusable radio option component
const RadioOption = ({
  value,
  label,
  id,
}: {
  value: string;
  label: string;
  id: string;
}) => (
  <div>
    <RadioGroupItem value={value} id={id} className="sr-only peer" />
    <Label
      htmlFor={id}
      className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
    >
      {label}
    </Label>
  </div>
);

const LayoutSettings: React.FC<SettingsProps> = ({
  onSettingsChange,
  settings,
}) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <Label>Line Height ({settings.lineHeight})</Label>
        <Slider
          value={[settings.lineHeight]}
          onValueChange={([value]) => onSettingsChange({ lineHeight: value })}
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
          {TEXT_ALIGN_OPTIONS.map((option) => (
            <RadioOption
              key={option.value}
              value={option.value}
              label={option.label}
              id={option.id}
            />
          ))}
        </RadioGroup>
      </div>
      {isDesktop && (
        <div className="space-y-2">
          <Label>Pages</Label>
          <RadioGroup
            value={settings.spread}
            onValueChange={(value) =>
              onSettingsChange({
                spread: value as Settings["spread"],
              })
            }
            className="grid grid-cols-2 gap-2"
          >
            {PAGE_LAYOUT_OPTIONS.map((option) => (
              <RadioOption
                key={option.value}
                value={option.value}
                label={option.label}
                id={option.id}
              />
            ))}
          </RadioGroup>
        </div>
      )}
    </div>
  );
};

export default LayoutSettings;

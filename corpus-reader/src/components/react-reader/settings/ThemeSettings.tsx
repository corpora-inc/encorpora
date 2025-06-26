import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { SettingsProps } from "./SettingsComponent";

type ReaderTheme = {
  name: string;
  styles: {
    body: {
      background: string;
      color: string;
    };
  };
};

export const THEMES: ReaderTheme[] = [
  {
    name: "Light",
    styles: {
      body: {
        background: "#fff",
        color: "#000",
      },
    },
  },
  {
    name: "Dark",
    styles: {
      body: {
        background: "#121212",
        color: "#e0e0e0",
      },
    },
  },
  {
    name: "Sepia",
    styles: {
      body: {
        background: "#4b4231",
        color: "#d5c3a1",
      },
    },
  },
  {
    name: "Gray",
    styles: {
      body: {
        background: "#4e4e4e",
        color: "#e0e0e0",
      },
    },
  },
  {
    name: "Grass",
    styles: {
      body: {
        background: "#333d2b",
        color: "#e0e0e0",
      },
    },
  },
  {
    name: "Cherry",
    styles: {
      body: {
        background: "#422930",
        color: "#e0e0e0",
      },
    },
  },
  {
    name: "Sky",
    styles: {
      body: {
        background: "#2c334e",
        color: "#e0e0e0",
      },
    },
  },
  {
    name: "Solarized",
    styles: {
      body: {
        background: "#002b36",
        color: "#839496",
      },
    },
  },
  {
    name: "Gruvbox",
    styles: {
      body: {
        background: "#282828",
        color: "#ebdbb2",
      },
    },
  },
  {
    name: "Nord",
    styles: {
      body: {
        background: "#2e3440",
        color: "#d8dee9",
      },
    },
  },
  {
    name: "Contrast",
    styles: {
      body: {
        background: "#000000",
        color: "#ffffff",
      },
    },
  },
  {
    name: "Sunset",
    styles: {
      body: {
        background: "#4d3c37",
        color: "#e0e0e0",
      },
    },
  },
];

export const ThemeSettings: React.FC<SettingsProps> = ({
  onSettingsChange,
  settings,
}) => {
  return (
    <div className="space-y-4 py-4">
      <RadioGroup
        value={settings.theme}
        onValueChange={(value) => onSettingsChange({ theme: value })}
        className="grid grid-cols-3 gap-2"
      >
        {THEMES.map((theme) => (
          <div key={theme.name}>
            <RadioGroupItem
              value={theme.name}
              id={theme.name}
              className="sr-only peer"
            />
            <Label
              htmlFor={theme.name}
              style={{ backgroundColor: theme.styles.body.background }}
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
            >
              <span style={{ color: theme.styles.body.color }}>
                {theme.name}
              </span>

              <span
                className={cn("block w-full h-6 rounded-sm mt-2")}
                style={{ backgroundColor: theme.styles.body.background }}
              />
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

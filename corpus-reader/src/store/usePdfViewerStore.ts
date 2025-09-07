import { create } from "zustand";
import { persist } from "zustand/middleware";

// Function to detect if device is mobile
const isMobile = () => {
  if (typeof window !== "undefined") {
    return window.matchMedia("(max-width: 767px)").matches;
  }
  return false;
};

// Get initial settings based on device type
const getInitialSettings = (): PdfViewerSettings => {
  const mobile = isMobile();
  return {
    scale: mobile ? 0.45 : 1.2,
    rotation: 0,
    viewMode: "single",
    readingMode: mobile ? "vertical" : "page",
    theme: "system",
    brightness: 100,
  };
};

export interface PdfViewerSettings {
  scale: number;
  rotation: number;
  viewMode: "single" | "grid";
  readingMode: "page" | "vertical";
  theme: "light" | "dark" | "system";
  brightness: number; // 0-100, where 100 is normal brightness
}

interface PdfViewerState {
  settings: PdfViewerSettings;
  setScale: (scale: number) => void;
  setRotation: (rotation: number) => void;
  setViewMode: (viewMode: "single" | "grid") => void;
  setReadingMode: (readingMode: "page" | "vertical") => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setBrightness: (brightness: number) => void;
  updateSettings: (partial: Partial<PdfViewerSettings>) => void;
  resetSettings: () => void;
}

// Default PDF viewer settings
const initialSettings: PdfViewerSettings = getInitialSettings();

export const usePdfViewerStore = create<PdfViewerState>()(
  persist(
    (set) => ({
      settings: initialSettings,
      
      setScale: (scale: number) => {
        const clampedScale = Math.max(0.5, Math.min(3, scale));
        set((state) => ({
          settings: { ...state.settings, scale: clampedScale }
        }));
      },
      
      setRotation: (rotation: number) => {
        set((state) => ({
          settings: { ...state.settings, rotation: rotation % 360 }
        }));
      },
      
      setViewMode: (viewMode: "single" | "grid") => {
        set((state) => {
          // When switching to grid view, automatically set reading mode to page
          const newReadingMode = viewMode === "grid" ? "page" : state.settings.readingMode;
          return {
            settings: { 
              ...state.settings, 
              viewMode,
              readingMode: newReadingMode
            }
          };
        });
      },
      
      setReadingMode: (readingMode: "page" | "vertical") => {
        set((state) => ({
          settings: { ...state.settings, readingMode }
        }));
      },
      
      setTheme: (theme: "light" | "dark" | "system") => {
        set((state) => ({
          settings: { ...state.settings, theme }
        }));
      },
      
      setBrightness: (brightness: number) => {
        const clampedBrightness = Math.max(20, Math.min(150, brightness));
        set((state) => ({
          settings: { ...state.settings, brightness: clampedBrightness }
        }));
      },
      
      updateSettings: (partial: Partial<PdfViewerSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...partial }
        }));
      },
      
      resetSettings: () => {
        set({ settings: getInitialSettings() });
      },
    }),
    {
      name: "pdf-viewer-settings",
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
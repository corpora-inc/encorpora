import { JSX } from "react";
import { FaAppStore, FaGooglePlay, FaGamepad } from "react-icons/fa";
import appsData from "@/data/apps.json";

const ICON_MAP: Record<string, JSX.Element> = {
  appStore: <FaAppStore />,
  googlePlay: <FaGooglePlay />,
  gamepad: <FaGamepad />,
};

interface App {
  id: string;
  title: string;
  description: string;
  icon: string;
  featured?: boolean;
  status?: string;
  landingUrl?: string;
  github?: string;
  platforms: {
    name: string;
    link: string;
    icon?: JSX.Element;
  }[];
}

export const APPS_INFO: App[] = appsData.map((app) => ({
  ...app,
  platforms: app.platforms.map((p) => ({
    ...p,
    icon: ICON_MAP[p.iconKey],
  })),
}));

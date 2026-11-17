import { createContext, useContext } from "react";

/** Whether this screen sits in the app's frame (app/AppShell.tsx), whose bar
 * already holds the one logo and the one menu: a card's own brand row
 * (ui/PageFrame `FrameBrand`) stays out of it. */
export const InAppFrame = createContext(false);
export const useInAppFrame = () => useContext(InAppFrame);

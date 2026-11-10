import type { MouseEvent } from "react";
import { AppLogo } from "../../../ui/AppLogo";
import { QrCode } from "../../../ui/QrCode";
import { Tabs, type TabItem } from "../../../ui/Tabs";
import { WaveMark } from "../../../ui/WaveMark";
import { Section, Specimen } from "../Gallery";
import bar from "../../../ui/AppBar.module.css";
import styles from "../Design.module.css";

const progress: TabItem[] = [
  { id: "overview", label: "Overview", path: "me" },
  { id: "pathways", label: "Pathways", path: "pathways" },
  { id: "inventory", label: "Inventory", path: "inventory" },
];
const school: TabItem[] = [
  "Today",
  "Map",
  "Gradebook",
  "Time",
  "Roster",
  "Settings",
].map((label) => ({
  id: label.toLowerCase(),
  label,
  path: `school/design/classes/design/${label.toLowerCase()}`,
}));
/** Tabs are real links; in the gallery a press stays on the page. */
const stay = (event: MouseEvent) => event.preventDefault();

export function NavigationSections() {
  return (
    <Section
      id="navigation"
      title="Logo, tabs and codes"
      source={[
        "ui/AppLogo.tsx",
        "ui/WaveMark.tsx",
        "ui/Tabs.tsx",
        "ui/AppBar.module.css",
        "ui/QrCode.tsx",
      ]}
      note="The bar and drawer themselves (app/AppShell.tsx, features/navigation) read the session; open any app screen to see them."
    >
      <Specimen label="App logo (opens the drawer)">
        <div className={styles.barStage}>
          <header className={bar.bar}>
            <div className={bar.logoCell}>
              <AppLogo aria-label="Open AMP menu" />
            </div>
          </header>
        </div>
      </Specimen>
      <Specimen label="Wave mark">
        <span className={styles.mark}>
          <WaveMark />
        </span>
      </Specimen>
      <Specimen label="Tabs: Progress" wide>
        <div onClickCapture={stay}>
          <Tabs label="Progress" items={progress} active="overview" />
        </div>
      </Specimen>
      <Specimen label="Tabs: a class (scrolls on a phone)" wide>
        <div onClickCapture={stay}>
          <Tabs label="Class" items={school} active="gradebook" />
        </div>
      </Specimen>
      <Specimen label="QR code (a sign-in card)">
        <QrCode
          value="https://amp.corpora.inc/c#design-fixture"
          label="Sign-in code for Ada"
          className={styles.qr}
        />
      </Specimen>
    </Section>
  );
}

import { Link } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
import { NavigationSheet, WaveMark } from "../../ui/NavigationSheet";
import { Tabs, type TabItem } from "../../ui/Tabs";
import styles from "./SchoolFrame.module.css";

export type SchoolNavItem = {
  id: string;
  label: string;
  /** The item's URL path, without the leading slash. */
  path: string;
  search?: Record<string, unknown>;
};
export type SchoolNavSection = {
  label?: string;
  items: readonly SchoolNavItem[];
};
export type SchoolCrumb = { label: string; path?: string };

function SchoolNav({
  sections,
  active,
  label,
  onNavigate,
}: {
  sections: readonly SchoolNavSection[];
  active?: string;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label={label} className={styles.nav}>
      {sections.map((section, index) => (
        <div key={section.label ?? index} className={styles.navSection}>
          {section.label && (
            <div className={styles.navLabel}>{section.label}</div>
          )}
          {section.items.map((item) => (
            <Link
              key={item.id}
              to="/$"
              params={{ _splat: item.path }}
              search={item.search ?? {}}
              activeOptions={{ exact: true }}
              activeProps={{}}
              aria-current={item.id === active ? "page" : undefined}
              className={styles.navLink}
              onClick={onNavigate}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

/** The wordmark. `for` names the product line beside it; an adult's own
 * practice is plain AMP. */
export function Brand({ for: line = "for Schools" }: { for?: string | null }) {
  return (
    <span className={styles.brand}>
      <WaveMark />
      <span className={styles.brandName}>AMP</span>
      {line && <span className={styles.brandFor}>{line}</span>}
    </span>
  );
}

/**
 * The staff shell. On a wide screen: a quiet rail, a breadcrumb and a class's
 * tabs over a wide content area. On a phone: a compact bar and the navigation
 * drawer. A lone teacher (`lone`) has one class and no school around it, so
 * the rail lists that class's tabs and everything else collapses away.
 *
 * The legacy global element rules (filled buttons, 76 px headings, bordered
 * nav and header) load first and are reset below for this subtree, with the
 * specificity of a single element, so any component's class still wins.
 */
export function SchoolFrame({
  title,
  orgSwitcher,
  sections,
  activeNav,
  breadcrumb = [],
  tabs,
  activeTab,
  tabsLabel = "Class",
  lone = false,
  account,
  brand = "for Schools",
  navLabel = "School",
  mark,
  action,
  children,
}: {
  /** What this place is called, in the phone's bar: the class, usually. */
  title: string;
  /** Where this is, and the way to the person's other places. A lone
   * teacher's class shows it only when they have somewhere else to go. */
  orgSwitcher?: ReactNode;
  sections: readonly SchoolNavSection[];
  activeNav?: string;
  breadcrumb?: readonly SchoolCrumb[];
  tabs?: readonly TabItem[];
  activeTab?: string;
  tabsLabel?: string;
  lone?: boolean;
  /** The signed-in person, at the foot of the rail. */
  account?: ReactNode;
  /** The product line beside the wordmark; null for plain AMP. */
  brand?: string | null;
  /** What the navigation is called to a screen reader. */
  navLabel?: string;
  /** A quiet label beside the place's name ("Demo"). */
  mark?: ReactNode;
  /** The bar's one action, at its edge. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const main = useRef<HTMLElement>(null);
  const navSections: readonly SchoolNavSection[] =
    lone && tabs ? [{ items: tabs }] : sections;
  const navActive = lone ? activeTab : activeNav;
  const showTabs = !lone && tabs && activeTab;
  const showCrumbs = !lone && breadcrumb.length > 0;
  return (
    <div className={styles.frame} data-dense data-lone={lone || undefined}>
      <a
        className={styles.skip}
        href="#school-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <header className={styles.bar}>
        <NavigationSheet open={drawer} onOpenChange={setDrawer}>
          <div className={styles.drawer} data-dense>
            {orgSwitcher && <div className={styles.org}>{orgSwitcher}</div>}
            <SchoolNav
              sections={navSections}
              active={navActive}
              label={navLabel}
              onNavigate={() => setDrawer(false)}
            />
          </div>
        </NavigationSheet>
        <span className={styles.barTitle}>{title}</span>
        {mark}
        {action && <span className={styles.barAction}>{action}</span>}
      </header>
      <aside className={styles.rail}>
        <div className={styles.railInner}>
          <Brand for={brand} />
          {orgSwitcher && <div className={styles.org}>{orgSwitcher}</div>}
          <SchoolNav
            sections={navSections}
            active={navActive}
            label={navLabel}
          />
          {account && <div className={styles.account}>{account}</div>}
        </div>
      </aside>
      <div className={styles.column}>
        {(showCrumbs || showTabs || action) && (
          <div className={styles.head}>
            {(showCrumbs || action) && (
              <div className={styles.headLine}>
                {showCrumbs ? (
                  <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                    <ol>
                      {breadcrumb.map((crumb) => (
                        <li key={crumb.label}>
                          {crumb.path ? (
                            <Link
                              to="/$"
                              params={{ _splat: crumb.path }}
                              activeOptions={{ exact: true }}
                              className={styles.crumb}
                            >
                              {crumb.label}
                            </Link>
                          ) : (
                            <span aria-current="page">{crumb.label}</span>
                          )}
                        </li>
                      ))}
                      {mark && <li className={styles.crumbMark}>{mark}</li>}
                    </ol>
                  </nav>
                ) : (
                  <span className={styles.headTitle}>
                    {title}
                    {mark}
                  </span>
                )}
                {action && <span className={styles.headAction}>{action}</span>}
              </div>
            )}
            {showTabs && (
              <Tabs label={tabsLabel} items={tabs} active={activeTab} />
            )}
          </div>
        )}
        <main
          ref={main}
          id="school-content"
          tabIndex={-1}
          className={styles.content}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

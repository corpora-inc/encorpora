// Every user-visible string in the shell, in one module.
//
// There is no i18n runtime yet — the gate and the five locale bundles land in
// PR-1.6. Collecting the strings here now means that PR is a mechanical
// substitution of one accessor rather than a hunt through JSX, and it makes
// the cost of a new string visible: each one is five translations.
//
// "Dynawalla" is a proper noun and is never translated. The store display name
// is still open (ADR-0016); the wordmark deliberately uses the short form,
// which is the part of the name that will not change.

export const strings = {
  appName: "Dynawalla",

  destinations: {
    practice: "Practice",
    world: "World",
    progress: "Progress",
    profiles: "Profiles",
    settings: "Settings",
  },

  theme: {
    label: "Theme",
    system: "System",
    light: "Light",
    dark: "Dark",
  },
} as const

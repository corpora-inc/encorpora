/**
 * The people of the local design preview (`scripts/design-personas.ts` seeds
 * them; `/dev/personas` signs in as each). Development only: the router adds
 * the switcher only when `import.meta.env.DEV`, so none of this reaches a
 * production bundle. Every name is made up, and the passphrase opens accounts
 * that exist only in a loopback database.
 */
export const PERSONA_PASSPHRASE = "design pass persona passphrase";
export const PERSONA_DOMAIN = "personas.amp.test";

export type PersonaGroup = "Adults" | "Families" | "Teaching";
export type PreviewPersona = {
  slug: string;
  group: PersonaGroup;
  /** The account's own name, as a real sign-up would carry it. */
  name: string;
  /** What this person is, in a few words. */
  label: string;
  /** What state they are in: day 0, day 1, weeks in. */
  stage: string;
  /** Where the switcher sends them; "/" lets the app decide. */
  home: string;
};

export const personaEmail = (slug: string) => `${slug}@${PERSONA_DOMAIN}`;

export const PREVIEW_PERSONAS: readonly PreviewPersona[] = [
  {
    slug: "signed-up",
    group: "Adults",
    name: "Robin Achterberg",
    label: "Just signed up",
    stage: "No place yet: “What brings you to AMP?”",
    home: "/",
  },
  {
    slug: "adult-new",
    group: "Adults",
    name: "Rowan Ellery",
    label: "Adult learner, day 0",
    stage: "Chose “Myself”, no answers yet",
    home: "/",
  },
  {
    slug: "adult-day1",
    group: "Adults",
    name: "Noel Brandt",
    label: "Adult learner, day 1",
    stage: "One session yesterday, free problems",
    home: "/",
  },
  {
    slug: "adult-3wk",
    group: "Adults",
    name: "Mara Quill",
    label: "Adult learner, 3 weeks",
    stage: "Paid, three weeks of practice",
    home: "/",
  },
  {
    slug: "adult-paused",
    group: "Adults",
    name: "Iris Calder",
    label: "Adult learner, free problems used",
    stage: "100 free problems over a week: the pause and Continue",
    home: "/",
  },
  {
    slug: "parent-new",
    group: "Families",
    name: "Tess Harlow",
    label: "Parent, day 0",
    stage: "Two unnamed children, no answers yet",
    home: "/",
  },
  {
    slug: "parent-day1",
    group: "Families",
    name: "Lena Ashby",
    label: "Parent, day 1",
    stage: "One unnamed child, one session yesterday",
    home: "/",
  },
  {
    slug: "family",
    group: "Families",
    name: "Jonah Pell",
    label: "Homeschool family",
    stage: "Pip (K), Wren (4), Theo (10); paid, weeks of history, second parent",
    home: "/",
  },
  {
    slug: "second-parent",
    group: "Families",
    name: "Ivy Pell",
    label: "Second parent",
    stage: "Joined the Pell family by invitation",
    home: "/",
  },
  {
    slug: "tutor",
    group: "Teaching",
    name: "Avery Lund",
    label: "Tutor, class of 6",
    stage: "Six students from other families, five weeks",
    home: "/",
  },
  {
    slug: "teacher",
    group: "Teaching",
    name: "Dana Calloway",
    label: "Teacher, class of 24",
    stage: "The teacher demo: Grade 5, twelve weeks",
    home: "/",
  },
  {
    slug: "school",
    group: "Teaching",
    name: "Imogen Hale",
    label: "School leader",
    stage: "The demo school: six classes, twelve weeks",
    home: "/",
  },
];

import type { Space } from "./space";

/**
 * Every user-visible noun that differs by space, in one typed table
 * (docs/architecture/spaces.md, "Vocabulary"). Screens and the shell take
 * their words from here, and shared widgets take them as props, so a
 * family never reads "student" and a class never reads "your children".
 * English only for now; a translation is another table of the same shape.
 */
export type SpaceWords = {
  /** One of the people the space is about. */
  learner: string;
  /** Several of them. */
  learners: string;
  /** Several of them, starting a line. */
  Learners: string;
  /** Whose names a sign-in list shows: "your children’s", "the class’s". */
  names: string;
  /** The group they belong to. */
  group: string;
  /** The screen that lists the people of the group. */
  people: string;
  /** A map key's line when a class has no course. */
  ownGrade: string;
  /** How sign-in on another device is introduced. */
  signIn: string;
  /** The switcher's heading for places of this space. */
  places: string;
  /** The row of tabs, to a screen reader. */
  tabs: string;
};

const SCHOOL_PEOPLE: Omit<SpaceWords, "group" | "people" | "places" | "tabs"> =
  {
    learner: "student",
    learners: "students",
    Learners: "Students",
    names: "the class’s",
    ownGrade: "Each student’s own grade",
    signIn: "Students sign in",
  };

const WORDS = {
  family: {
    learner: "child",
    learners: "children",
    Learners: "Children",
    names: "your children’s",
    group: "family",
    people: "People",
    ownGrade: "Each child’s own grade",
    signIn: "Sign in on their own device",
    places: "Family",
    tabs: "Family",
  },
  classroom: {
    ...SCHOOL_PEOPLE,
    group: "class",
    people: "Students",
    places: "Teaching",
    tabs: "Class",
  },
  school: {
    ...SCHOOL_PEOPLE,
    group: "school",
    people: "Staff",
    places: "Teaching",
    tabs: "School",
  },
  me: {
    learner: "you",
    learners: "you",
    Learners: "You",
    names: "your",
    group: "practice",
    people: "Profiles",
    ownGrade: "Your own grade",
    signIn: "Sign in on another device",
    places: "My practice",
    tabs: "My practice",
  },
  student: {
    learner: "you",
    learners: "you",
    Learners: "You",
    names: "the class’s",
    group: "class",
    people: "Class",
    ownGrade: "Your own grade",
    signIn: "Sign in",
    places: "Class",
    tabs: "Progress",
  },
  account: {
    learner: "learner",
    learners: "learners",
    Learners: "Learners",
    names: "your",
    group: "account",
    people: "Learners",
    ownGrade: "Each learner’s own grade",
    signIn: "Sign in on another device",
    places: "Account",
    tabs: "Account",
  },
  public: {
    learner: "learner",
    learners: "learners",
    Learners: "Learners",
    names: "your",
    group: "account",
    people: "Learners",
    ownGrade: "Each learner’s own grade",
    signIn: "Sign in",
    places: "",
    tabs: "AMP",
  },
} as const satisfies Record<Space, SpaceWords>;

/** The words of one space. */
export function spaceWords(space: Space): SpaceWords {
  return WORDS[space];
}

/** The data agreement a school accepts during setup. Plain and complete: it is
 * read in a sheet on a phone by the person signing, and published as written at
 * `/schools/trust`. Changing what it promises means a new version. It describes
 * what the product does; `src/privacy/retention-periods.ts` holds the periods. */
export const AGREEMENT_VERSION = "2026-11-06";

export type AgreementSection = { heading: string; paragraphs: string[] };

export const agreementTitle = "Student data agreement";
export const agreementLead =
  "Between Corpora Inc, which provides AMP (Adaptive Math Pathways), and the school or district named at acceptance (the School). It takes effect when an authorized person at the School accepts it, and it applies to student data the School gives Corpora or that students create in AMP through the School.";

/** The four promises the setup screen states before anyone opens the full text. */
export const agreementPromises = [
  {
    title: "The data stays the School’s",
    detail: "Used only to provide AMP to the School, and only as it directs.",
  },
  {
    title: "No sale and no advertising",
    detail: "Student data is never sold or used for advertising of any kind.",
  },
  {
    title: "No general AI training",
    detail: "Student data never trains general-purpose AI models.",
  },
  {
    title: "Export and deletion on request",
    detail:
      "Kept for 24 months after the later of last activity and license end, or removed sooner when the School directs.",
  },
] as const;

export const agreementSections: readonly AgreementSection[] = [
  {
    heading: "1. Student data",
    paragraphs: [
      "Student data means information about an identifiable student that the School provides or that a student creates by using AMP through the School: name, optional display name, grade level, optional email address and school-assigned identifier, class enrollments, sign-in records, the problems a student was given, their answers, and what AMP works out from those answers, such as skill evidence, working levels and suggested grades.",
      "The School decides which students and which of these details to add. AMP does not ask for a home address, phone number or government identifier. Students can sign in with a card or a class code and pictures, so a student needs no email address.",
    ],
  },
  {
    heading: "2. How Corpora uses student data",
    paragraphs: [
      "Corpora uses student data only to provide AMP to the School: to schedule practice, show progress and reports to the School’s staff, keep the service secure and working, give support the School asks for, and meet legal obligations.",
      "Corpora does not sell student data. Corpora does not use student data for targeted or behavioral advertising, or for any other advertising. Students using AMP through the School get no advertising trackers and no marketing mail. Corpora does not build profiles of students for any purpose unrelated to the School’s use of AMP, and does not use student data to train general-purpose AI models.",
      "Corpora may use data with personal identifiers removed, in a form that cannot reasonably be linked back to a student or school, to measure and improve AMP’s teaching.",
    ],
  },
  {
    heading: "3. FERPA",
    paragraphs: [
      "Where the School is subject to the Family Educational Rights and Privacy Act, it designates Corpora as a school official with a legitimate educational interest, performing an institutional service for which the School would otherwise use its own staff. Student data that is part of an education record remains under the School’s direct control. Corpora will use it only for the purposes above and will not disclose it further except as this agreement or the law permits.",
    ],
  },
  {
    heading: "4. COPPA",
    paragraphs: [
      "Where students are under 13, the School authorizes Corpora to collect personal information from them for this educational purpose only, in place of a parent, as the Federal Trade Commission’s Children’s Online Privacy Protection Rule guidance allows for school-authorized use. The School is responsible for any notice to parents its policies or local law require. Corpora will tell the School what it collects, as set out here, and on the School’s direction will delete it or stop collecting it.",
    ],
  },
  {
    heading: "5. Who can see student data",
    paragraphs: [
      "Within AMP, teachers see the classes they teach, and admins see their school. The School manages who holds these roles, and ending a role stops that person’s access on their next request.",
      "Corpora limits its own staff’s access to those who need it to run and support AMP. Corpora uses service providers to host AMP and to deliver email, under written obligations consistent with this agreement, and remains responsible for their handling of student data. A current list is available from support@corpora.inc.",
      "If the law requires Corpora to disclose student data, it will disclose only what is required and will tell the School first unless the law forbids it.",
    ],
  },
  {
    heading: "6. Security",
    paragraphs: [
      "Corpora maintains reasonable administrative, technical and physical safeguards for student data, including encryption in transit, access limited by role, and sign-in credentials stored only in hashed form.",
      "If Corpora learns that student data was acquired, accessed or disclosed without authorization, it will notify the School without undue delay and within 72 hours of confirming the incident, with what is known about the data and students affected and what is being done, and will send updates as it learns more. The School decides on any notice to its families; Corpora will give the help it reasonably can.",
    ],
  },
  {
    heading: "7. Access, correction, export and deletion",
    paragraphs: [
      "The School directs export and deletion. Admins can correct a student’s details in AMP at any time. Removing a student in AMP deletes that student’s learning data at once and frees their seat; final grades the School recorded stay with the School’s records unless it asks for full erasure.",
      "For a whole-school export or deletion, an admin writes to support@corpora.inc. Corpora will complete it within 30 days and confirm when it is done. Requests from parents or students go to the School, and Corpora will send on any it receives directly.",
    ],
  },
  {
    heading: "8. Retention",
    paragraphs: [
      "Corpora keeps student data for 24 months after the later of the student’s last activity and the end of the School’s license, then deletes it automatically. It is removed from backups as they expire, and restored backups stay subject to deletions already made. Corpora does not keep student data past that period unless the law requires it, and then only what is required, kept apart from ordinary use.",
    ],
  },
  {
    heading: "9. Term and changes",
    paragraphs: [
      "This agreement lasts as long as Corpora holds student data for the School. If the license ends, practice stops, and retention follows section 8 unless the School directs earlier deletion. Either party may end the School’s use of AMP for a material breach not fixed within 30 days of written notice.",
      "Corpora will not reduce these protections for data it already holds without the School’s written agreement, and a changed agreement gets a new version the School must accept. Laws that cannot be set aside by contract take priority over this agreement. Where a state requires its own form, the School and Corpora will complete it, and that form controls where the two differ. Notices to Corpora go to support@corpora.inc.",
    ],
  },
];

import type { Article } from "./types.js";
import { workbookImages } from "./workbook-images.js";

export const productArticles: Article[] = [
  {
    path: "/personalized-workbooks/",
    label: "Infinite personalized math workbooks",
    title: "The next workbook belongs to this learner.",
    description:
      "Generate unlimited personalized AMP math workbooks from each learner’s levels. Choose the length, areas and paper size, with fresh problems and worked answers.",
    introduction:
      "A great workbook starts with the learner. AMP creates fresh, printable mathematics from their working levels, with a thoughtful mix of practice, clear diagrams, room to reason and a complete worked key.",
    image: {
      src: "/product/workbook-practice-page.webp",
      alt: "An actual AMP workbook page with mathematical diagrams and space to work",
      caption: "Real AMP mathematics, designed for paper.",
      width: 1020,
      height: 1320,
    },
    sections: [
      {
        id: "personal",
        title: "Make the work fit the person.",
        paragraphs: [
          "A learner may be confident with geometry and need more work on fractions. AMP keeps separate working levels across mathematical strands. The workbook draws on that picture, so the paper session can support the same learning path as online practice.",
          "For teaching preparation, select a saved practice profile or create a starting level of your own. A tutor can prepare different kinds of work from one adult account: early arithmetic for one session, fraction repair for another and algebra for the next.",
        ],
        shot: "practice-profile",
      },
      {
        id: "controls",
        title: "Choose the session. AMP prepares the mathematics.",
        paragraphs: [
          "Choose a 30-, 45- or 60-minute workbook, US Letter or A4, the difficulty and the mathematical areas to include. Create a broad mixed session or focus the work where you want a closer look.",
          "The result is a coherent paper session with a brief lesson when useful, practice, review and challenge, followed by worked answers. Freshly generated quantities and situations give the learner another opportunity to reason.",
        ],
        shot: "workbook-controls",
      },
      {
        id: "infinite",
        title: "A fresh edition whenever you need one.",
        paragraphs: [
          "Paid AMP access includes unlimited personalized workbook creation. Generate a new edition for another day, a different focus or a different practice profile. You do not need to buy another volume when the learner needs more work.",
          "The same mathematical generators supply online practice and paper. That connection keeps the explanations, figures and answers aligned while allowing each new workbook to contain fresh problems.",
        ],
      },
      {
        id: "paper",
        title: "Paper is a place to think.",
        images: workbookImages,
        links: [{ href: "/workbooks/", label: "Choose a free workbook to print" }],
        paragraphs: [
          "Working space matters. A learner can draw a model, annotate a figure, arrange a calculation and explain a step in their own handwriting. AMP’s page layout gives that work room and keeps mathematical notation readable.",
          "The worked key shows the reasoning as well as the answer. Use it for checking, discussion and teaching, then return to an independent problem to see what the learner can use.",
        ],
      },
      {
        id: "results",
        title: "Bring the paper evidence back into the path.",
        links: [{ href: "/amp/how-it-works/", label: "See how paper fits the complete AMP routine" }],
        paragraphs: [
          "In an account-created workbook, record the paper results in AMP. Entering the learner’s answer lets AMP grade it; parent-marked results also contribute evidence. The system distinguishes those kinds of evidence when choosing later work.",
          "A screen-free session can therefore stay connected to future practice. The learner gets the space of paper and the continuity of an adaptive curriculum.",
        ],
      },
      {
        id: "free",
        title: "Start with a workbook you can print today.",
        links: [{ href: "/workbooks/", label: "Browse free workbooks by grade" }, { href: "/plans/", label: "See free and paid access" }],
        paragraphs: [
          "The free workbook library offers grade and course samples from kindergarten through precalculus, in both Letter and A4. Each includes a worked key and requires no account or email.",
          "Create a free AMP account to try five personalized workbooks as well as online practice. A paid plan opens unlimited fresh workbooks for the learners and practice profiles its access covers.",
        ],
      },
    ],
    related: ["/workbooks/", "/grades/", "/tutors/", "/plans/"],
    questions: [
      {
        question: "Can I print a workbook without signing up?",
        answer:
          "Yes. The public workbook library has free downloadable PDFs by grade and course, with worked answers. Personalized workbooks use the levels in an AMP account.",
      },
      {
        question: "Can a tutor create work at several levels?",
        answer:
          "Yes. An adult’s covered practice profiles can represent different starting levels and strengths. Select the appropriate profile and create a workbook for that teaching session.",
      },
      {
        question: "Does the answer key explain the work?",
        answer:
          "Yes. AMP workbooks include worked solutions, so learners and adults can follow the reasoning behind each answer.",
      },
    ],
  },
  {
    path: "/tutors/",
    label: "AMP for tutors",
    title: "One teaching license. A room full of starting points.",
    description:
      "Use one AMP adult license to simulate learners at different math levels, switch practice profiles and prepare personalized workbooks for tutor-led sessions.",
    introduction:
      "A tutor’s day can move from counting to fractions to algebra. AMP’s practice profiles let you simulate those different starting points, adjust strengths by area and prepare suitable work through your own adult access.",
    sections: [
      {
        id: "profiles",
        title: "Set up the learner you want to teach.",
        paragraphs: [
          "Choose a grade and pace, then adjust mathematical strands individually. Save the profile under a useful label and switch to it when preparing or teaching. A profile can represent a beginning arithmetic learner or an algebra student who needs stronger fraction foundations.",
          "Practice profiles belong to your adult account. They let you explore the problems, hints, explanations and workbook choices that fit that pattern of levels.",
        ],
        shot: "practice-profile",
      },
      {
        id: "contrast",
        title: "Prepare two different sessions in minutes.",
        paragraphs: [
          "For an early arithmetic session, start with counting, joining and separating. Use a picture to discuss what changes, then try a fresh problem. Prepare a short workbook with enough room for drawings.",
          "For an algebra session, keep algebra advanced and set fractions lower. Explore the resulting mixture, open an explanation and prepare paper practice. The teaching preparation follows the student’s mathematical needs instead of forcing every area into one grade.",
        ],
        diagram: "strands",
      },
      {
        id: "copy",
        title: "Rehearse from a student’s starting picture.",
        paragraphs: [
          "When you have access to a student’s record, you can make a one-time copy of their levels into a practice profile. Work through likely questions, inspect explanations and plan a session from that snapshot.",
          "The simulation has its own practice history. Your rehearsal leaves the student’s answers and progress record intact, so you can explore freely before teaching.",
        ],
      },
      {
        id: "workbooks",
        title: "Bring a prepared workbook to the session.",
        paragraphs: [
          "Choose the practice profile, length, paper size and areas. AMP creates fresh questions with worked answers. Use the pages during the lesson or as follow-up work.",
          "The same profile can support a different focus next time. Adjust a strand, save the levels and create another edition. Your adult access covers these teaching simulations and their personalized workbooks.",
        ],
        shot: "workbook-controls",
      },
      {
        id: "license",
        title: "Understand what one license covers.",
        paragraphs: [
          "An individual adult license covers your own learning and your tutor-led practice profiles. You can use those simulations to prepare and lead sessions at different levels.",
          "Students who sign in independently and maintain their own progress use learner access of their own, or the applicable family or school access. A tutor class organizes those learners, while practice profiles remain your flexible teaching workspace.",
        ],
      },
      {
        id: "start",
        title: "Try the workflow with real mathematics.",
        paragraphs: [
          "Create a free adult account and choose the tutor or co-op route during setup. Open your practice profile, choose a starting level and try a problem. Adjust the levels and create a workbook to see the whole teaching routine.",
          "If you already have covered adult access through a paid family or licensed school, that access covers your practice profiles too.",
        ],
      },
    ],
    related: [
      "/personalized-workbooks/",
      "/adult-learners/",
      "/plans/",
      "/resources/",
    ],
    questions: [
      {
        question: "Can I switch between different levels?",
        answer:
          "Yes. Save named practice profiles, select a grade and pace, and adjust levels by strand. Switch profiles to prepare different teaching sessions.",
      },
      {
        question: "Does practicing as a student change the student’s progress?",
        answer:
          "No. A one-time level copy creates a separate simulation. Your rehearsal and answers belong to that practice profile.",
      },
    ],
  },
  {
    path: "/adult-learners/",
    label: "AMP for adult learners",
    title: "Pick up mathematics where it becomes useful.",
    description:
      "Rebuild math foundations and progress through precalculus with AMP. Adaptive mixed practice, clear explanations and printable workbooks for adult learners.",
    introduction:
      "You may remember algebra and want to strengthen fractions, prepare for another course or understand mathematics more deeply. AMP follows your working levels across areas, so you can rebuild foundations while using your strengths.",
    sections: [
      {
        id: "starting",
        title: "Begin with the mathematics you want to strengthen.",
        paragraphs: [
          "Choose your starting point from counting through precalculus. Continuing practice refines that picture. A single school grade or an old course result does not have to define your whole path.",
          "For example, an equation may feel familiar while a fractional rate is harder to interpret. AMP can keep the equation work moving and bring the fraction relationship back into focus.",
        ],
        shot: "progress",
      },
      {
        id: "meaning",
        title: "Give a remembered procedure its reason.",
        paragraphs: [
          "A diagram can explain why multiplying a fraction scales a quantity. A graph can show what an equation describes. A worked solution can reveal the structure that makes a calculation shorter.",
          "AMP keeps those explanations beside the problem. Read the relevant lesson, use a hint, then try another question independently. The aim is understanding you can carry into a fresh situation.",
        ],
        diagram: "loop",
      },
      {
        id: "routine",
        title: "Build a study routine that connects.",
        paragraphs: [
          "Mixed practice asks you to recognize the method that fits the problem. Earlier mathematics returns alongside newer work, so foundations stay in use as you move ahead.",
          "For a paper session, create a personalized workbook and work through the steps by hand. The worked key supports self-checking; recorded results inform the continuing practice path.",
        ],
        shot: "workbook-controls",
      },
      {
        id: "explore",
        title: "Explore another level without changing your own path.",
        paragraphs: [
          "Practice profiles let you simulate a different starting point. Try earlier material, preview a later level or rehearse a topic you are helping someone else learn.",
          "Your personal learner keeps its own progress. The simulation has separate levels and answers, and your covered adult access includes those profiles.",
        ],
      },
      {
        id: "access",
        title: "Start free. Keep the learning when you continue.",
        paragraphs: [
          "Choose “Myself” during account setup and select a starting point. Free access includes online practice and five personalized workbooks; an individual plan continues your own learner’s access.",
          "Parents with a paid child and teachers at a licensed school receive covered adult practice. A paid family also includes practice for one invited second parent. Explore the plan that matches your situation.",
        ],
      },
    ],
    sample: 2,
    related: [
      "/plans/",
      "/resources/",
      "/philosophy/adaptive-learning/",
      "/personalized-workbooks/",
    ],
  },
];

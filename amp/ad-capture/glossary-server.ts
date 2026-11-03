/**
 * Serves the real AMP practice workspace (PracticeWorkspace, its Glossary,
 * TermCard and FocusDialog) through vite middleware, with real payloads for
 * the `pythagorean-converse` template: the generated problem, the server's
 * own glossary payload on the outcome (as `withGlossary` in
 * src/server/app.ts builds it), and the problem lesson. No API, no database.
 * Adapted from scripts/verify-glossary-ui.ts and scripts/verify-calculator-ui.ts.
 *
 * Modes (?mode=):
 *   why    the learner answered correctly, then tapped "See why"
 *   wrong  the learner answered "Not a right triangle"; the explanation shows
 *   lesson the practice panel's lesson ("Lesson" from the problem)
 */
import assert from "node:assert/strict";
import { createServer as httpServer } from "node:http";
import { createServer } from "vite";
import {
  lessonGlossaryContext,
  problemLesson,
  screenBand,
} from "../src/content/problem-lessons";
import { glossaryPayload } from "../src/glossary/resolve";
import { generateProblem } from "../src/math/engine";

export const TEMPLATE = "pythagorean-converse";
export const SEED = "glossary-review";

export const generated = generateProblem(TEMPLATE, SEED);
export const lesson = problemLesson(TEMPLATE, SEED);
const problem = generated.public;
const outcomeFor = (response: string) => ({
  id: `ad-capture-${response}`,
  problemId: problem.id,
  requestId: `ad-capture-${response}`,
  skillId: problem.skillId,
  templateId: TEMPLATE,
  correct: response === generated.answer,
  assisted: false,
  response,
  explanation: generated.explanation,
  answer: generated.answer,
  createdAt: "2026-11-02T15:00:00.000Z",
  // Exactly what the server adds to an attempt response (withGlossary).
  ...glossaryPayload(
    generated.explanation,
    lessonGlossaryContext(TEMPLATE),
    [],
    screenBand(TEMPLATE),
  ),
});
const wrong = problem.response.kind === "choice"
  ? problem.response.options.find((o) => o.id !== generated.answer)!.id
  : "";
export const outcomes = {
  why: outcomeFor(generated.answer),
  wrong: outcomeFor(wrong),
};

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PracticeWorkspace, usePracticeViewport} from '/src/web/PracticeWorkspace.tsx';
import '/src/web/app/styles.ts';
const problem=${JSON.stringify(problem)};
const outcomes=${JSON.stringify(outcomes)};
const lesson=${JSON.stringify(lesson)};
const mode=new URLSearchParams(location.search).get('mode')??'why';
const noop=()=>{};
function App(){
  usePracticeViewport(true);
  const outcome=mode==='lesson'?null:outcomes[mode];
  const [response,setResponse]=React.useState(outcome?outcome.response:'');
  return React.createElement('div',{className:'shell app-shell practice-shell immersive'},
    React.createElement(PracticeWorkspace,{problem,lesson:null,response,setResponse,outcome,hint:'',pending:false,busy:false,
      calculator:false,submit:noop,next:noop,requestHint:noop,exit:noop,exitHref:'/',
      requestLesson:()=>Promise.resolve(lesson)}));
}
createRoot(document.getElementById('root')).render(React.createElement(App));
`;

export async function serve() {
  const server = httpServer();
  const vite = await createServer({
    root: new URL("../", import.meta.url).pathname,
    server: { middlewareMode: true, hmr: { server } },
    appType: "custom",
    logLevel: "warn",
    plugins: [
      {
        name: "glossary-ad-capture",
        resolveId(id) {
          if (id === "/glossary-ad-entry.tsx") return id;
        },
        load(id) {
          if (id === "/glossary-ad-entry.tsx") return entry;
        },
        configureServer(vite) {
          vite.middlewares.use("/glossary-ad", async (_req, res) => {
            res.setHeader("Content-Type", "text/html");
            res.end(
              await vite.transformIndexHtml(
                "/glossary-ad",
                '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>AMP</title></head><body><div id="root"></div><script type="module" src="/glossary-ad-entry.tsx"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  server.on("request", vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  return {
    url: (mode: string) =>
      `http://127.0.0.1:${address.port}/glossary-ad?mode=${mode}`,
    close: async () => {
      await vite.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

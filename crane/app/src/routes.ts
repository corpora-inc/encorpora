/** Every screen has a URL. Builders keep links consistent. */
const enc = encodeURIComponent;
export const readerPath = (sectionId: string) => `/read/${enc(sectionId)}`;
export const askQueryPath = (q: string) => `/ask/q/${enc(q)}`;
export const answerPath = (id: string) => `/ask/a/${enc(id)}`;
export const procPath = (id: string) => `/do/${enc(id)}`;
export const runStepPath = (runId: string, step: number) => `/do/run/${enc(runId)}/${step + 1}`;
export const runReportPath = (runId: string) => `/do/runs/${enc(runId)}`;
export const topicPath = (id: string) => `/learn/topic/${enc(id)}`;
export const lessonPath = (id: string) => `/learn/lesson/${enc(id)}`;
export const termPath = (id: string) => `/learn/glossary/${enc(id)}`;
export const examPath = (id: string) => `/practice/exam/${enc(id)}`;
export const examItemPath = (id: string, n: number) => `/practice/exam/${enc(id)}/${n}`;
export const examReviewPath = (id: string) => `/practice/exam/${enc(id)}/review`;
export const examResultsPath = (id: string) => `/practice/exam/${enc(id)}/results`;
export const signalPath = (id: string) => `/tools/signals/${enc(id)}`;

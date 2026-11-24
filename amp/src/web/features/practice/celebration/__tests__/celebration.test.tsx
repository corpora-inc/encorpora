import "./css-stub";
import { act, cleanup, render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../../lib/query";
import { practiceSettingsOptions } from "../../practice-settings";
import { creditAnswer, isCredited, usePoints } from "../../points";
import { Celebration, preloadColorful } from "../Celebration";
import { dropStage } from "../stage";
import { useCelebrationStore } from "../store";
import { GOLDEN_ANGLE, hueAt, startHue, useHueStore } from "../hue";

const who = vi.hoisted(() => ({ learner: "kid-1" as string | null }));
vi.mock("../../../../lib/session", async (actual) => ({
  ...(await actual<typeof import("../../../../lib/session")>()),
  useSessionOrNull: () => ({ accountId: "account-1", token: "t" }),
}));
vi.mock("../../../spaces/useAddressed", () => ({
  useAddressedIdentity: () =>
    who.learner ? { kind: "learner", id: who.learner } : null,
}));
const server = vi.hoisted(() => ({ points: 88 as number | undefined }));
vi.mock("../../../../lib/api", async (actual) => ({
  ...(await actual<typeof import("../../../../lib/api")>()),
  request: vi.fn(async () => ({
    revision: 1,
    epoch: 0,
    workingTogether: false,
    focusSkillId: null,
    gradeLevelShown: true,
    strandStarts: {},
    look: "bold",
    effectiveLook: "bold",
    lookLocked: false,
    ...(server.points == null ? {} : { points: server.points }),
  })),
}));

const scope = { identity: "account-1", learnerId: "kid-1", token: "t" };
let n = 0;
const answer = (correct: boolean, assisted = false) => ({
  id: `answer-${++n}`,
  skillId: "skill-a",
  correct,
  assisted,
});
type Outcome = ReturnType<typeof answer> | null;

function Host({
  outcome,
  problem,
  prompt = "What is 3 + 4?",
}: {
  outcome: Outcome;
  problem: string;
  prompt?: string;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <Celebration outcome={outcome} problem={{ id: problem, prompt }} />
    </QueryClientProvider>
  );
}
const part = (name: string) =>
  document.querySelector<HTMLElement>(`[data-part="${name}"]`);
const running = () =>
  [...document.querySelectorAll<HTMLElement>("[data-part][data-run]")].map(
    (node) => `${node.dataset.part}:${node.dataset.kind}`,
  );
// A frame: moments start on the frame after the verdict.
const settle = () => act(async () => new Promise((r) => setTimeout(r, 40)));
const total = () =>
  queryClient.getQueryData(practiceSettingsOptions(scope).queryKey)?.points;

beforeEach(async () => {
  // As the app has it when the look resolves, before any answer.
  await preloadColorful();
  queryClient.clear();
  useCelebrationStore.setState({ runs: {}, played: {}, streakOf: {} });
  server.points = 88;
  who.learner = "kid-1";
});
afterEach(() => {
  cleanup();
  dropStage();
  document.documentElement.removeAttribute("data-look");
  document.documentElement.removeAttribute("style");
  localStorage.clear();
  useHueStore.setState({ learners: {} });
});

/** Mounts practice on a problem, as the workspace does, and answers it. */
async function answerWith(outcome: NonNullable<Outcome>, look = "bold") {
  if (look === "bold") document.documentElement.setAttribute("data-look", look);
  const view = render(<Host outcome={null} problem="p1" />);
  await settle();
  // The server graded it and counted its point before the page heard: a
  // read of practice-state from here on has it (practice reads it again
  // with each answer where no stream feeds the tab: look-feed.ts).
  if (outcome.correct && !outcome.assisted && server.points != null)
    server.points++;
  view.rerender(<Host outcome={outcome} problem="p1" />);
  await settle();
  return view;
}

describe("Celebration", () => {
  it("a right answer in Colorful: the burst, the +1 and the chip's tick", async () => {
    await answerWith(answer(true));
    expect(running()).toEqual(
      expect.arrayContaining(["burst:right", "flyer:right", "chip:tick"]),
    );
    expect(total()).toBe(89);
    expect(part("total")?.textContent).toBe("89");
    expect(part("chip")?.hasAttribute("data-shown")).toBe(true);
  });

  it("a miss plays nothing and changes no points", async () => {
    await answerWith(answer(false));
    expect(running().filter((r) => !r.startsWith("chip:"))).toEqual([]);
    expect(total()).toBe(88);
  });

  it("a right answer with help: kind, plain feedback, no point", async () => {
    await answerWith(answer(true, true));
    expect(running().filter((r) => !r.startsWith("chip:"))).toEqual([]);
    expect(total()).toBe(88);
  });

  it("Calm plays nothing and builds no overlay, but the point counts", async () => {
    await answerWith(answer(true), "calm");
    expect(document.querySelector("[data-celebration]")).toBeNull();
    expect(total()).toBe(89);
  });

  it("an answer already on screen when practice remounts is not replayed", async () => {
    document.documentElement.setAttribute("data-look", "bold");
    const done = answer(true);
    render(<Host outcome={done} problem="p1" />);
    await settle();
    expect(running().filter((r) => !r.startsWith("chip:"))).toEqual([]);
    expect(total()).toBe(88);
  });

  it("three right in a row: the chip's streak moment; a miss resets silently", async () => {
    server.points = 40;
    document.documentElement.setAttribute("data-look", "bold");
    const view = render(<Host outcome={null} problem="p1" />);
    await settle();
    const play = async (outcome: NonNullable<Outcome>, problem: string) => {
      view.rerender(<Host outcome={null} problem={problem} />);
      view.rerender(<Host outcome={outcome} problem={problem} />);
      await settle();
      return part("chipSparks")?.dataset.kind ?? null;
    };
    expect(await play(answer(true), "p1")).toBeNull();
    expect(await play(answer(true), "p2")).toBeNull();
    expect(await play(answer(true), "p3")).toBe("streak-3");
    const sparks = part("chipSparks")!;
    delete sparks.dataset.run;
    delete sparks.dataset.kind;
    expect(await play(answer(false), "p4")).toBeNull();
    expect(useCelebrationStore.getState().runs["account-1:kid-1"]?.streak).toBe(
      0,
    );
  });

  it("the tenth point has its own moment", async () => {
    server.points = 9;
    await answerWith(answer(true));
    expect(running()).toEqual(
      expect.arrayContaining(["chip:points-10", "chipSparks:points-10"]),
    );
  });
});

describe("the world's hue", () => {
  const hue = () =>
    document.documentElement.style.getPropertyValue("--look-hue");
  it("turns by the golden angle with each new problem, from the learner's own start", async () => {
    document.documentElement.setAttribute("data-look", "bold");
    const view = render(<Host outcome={null} problem="p1" />);
    await settle();
    expect(hue()).toBe(`${startHue("kid-1")}deg`);
    view.rerender(<Host outcome={null} problem="p2" />);
    await settle();
    expect(hue()).toBe(`${hueAt("kid-1", 1)}deg`);
    expect(hueAt("kid-1", 1)).toBe(
      Math.round((startHue("kid-1") + GOLDEN_ANGLE) % 360),
    );
  });
  it("keeps a problem's hue when it comes back (a reload, Back)", async () => {
    document.documentElement.setAttribute("data-look", "bold");
    const view = render(<Host outcome={null} problem="p1" />);
    await settle();
    view.rerender(<Host outcome={null} problem="p2" />);
    await settle();
    const second = hue();
    view.rerender(<Host outcome={null} problem="p1" />);
    await settle();
    view.rerender(<Host outcome={null} problem="p2" />);
    await settle();
    expect(hue()).toBe(second);
  });
  it("leaves the figure's marks as Calm's when the words name them", async () => {
    document.documentElement.setAttribute("data-look", "bold");
    const view = render(
      <Host
        outcome={null}
        problem="p1"
        prompt="Some pieces are teal and some rust."
      />,
    );
    await settle();
    expect(document.documentElement.dataset.figureColors).toBe("named");
    view.rerender(<Host outcome={null} problem="p2" />);
    await settle();
    expect(document.documentElement.dataset.figureColors).toBeUndefined();
  });
  it("sets nothing in Calm", async () => {
    render(<Host outcome={null} problem="p1" />);
    await settle();
    expect(hue()).toBe("");
  });
});

describe("usePoints", () => {
  function Shown({ after }: { after?: Outcome }) {
    const points = usePoints(after);
    return <output>{points ?? "none"}</output>;
  }
  const shown = async (after?: Outcome) => {
    const view = render(
      <QueryClientProvider client={queryClient}>
        <Shown after={after} />
      </QueryClientProvider>,
    );
    await settle();
    const text = view.container.textContent;
    view.unmount();
    return text;
  };

  it("is the server's total, with an answer counted once from the first frame", async () => {
    expect(await shown()).toBe("88");
    const right = answer(true);
    // Before the credit lands: the answer already counts in what shows.
    expect(await shown(right)).toBe("89");
    expect(creditAnswer(scope, right)).toBe(true);
    expect(isCredited(scope, right.id)).toBe(true);
    expect(await shown(right)).toBe("89");
    expect(await shown()).toBe("89");
    // Never twice.
    expect(creditAnswer(scope, right)).toBe(false);
    expect(await shown()).toBe("89");
  });

  it("counts nothing for a miss or a helped answer", async () => {
    await shown();
    expect(creditAnswer(scope, answer(false))).toBe(false);
    expect(creditAnswer(scope, answer(true, true))).toBe(false);
    expect(await shown(answer(true, true))).toBe("88");
    expect(total()).toBe(88);
  });

  it("is unknown without a learner or a total", async () => {
    who.learner = null;
    expect(await shown()).toBe("none");
    who.learner = "kid-1";
    server.points = undefined;
    expect(await shown()).toBe("none");
  });
});

import { afterEach, beforeAll, expect, test } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { glossaryPayload } from "../../../glossary/resolve";
import { termsIn, type LinkContext } from "../../../glossary/link";
import { MathText } from "../../MathText";
import { Glossary, GlossaryProvider } from "../Glossary";
afterEach(cleanup);

beforeAll(() => {
  // jsdom has no modal dialogs: open and close are all a card needs here.
  const proto = HTMLDialogElement.prototype;
  proto.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  // A phone-width viewport: the card is a sheet.
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
});

function Linked({
  texts,
  context,
}: {
  texts: string[];
  context?: LinkContext;
}) {
  return (
    <Glossary payload={glossaryPayload(texts, context)} texts={texts}>
      {texts.map((text) => (
        <p key={text}>
          <MathText text={text} />
        </p>
      ))}
    </Glossary>
  );
}
/** Text as read: the terms' "?" badges are decoration. */
const read = (element: Element) => {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll(".glossary-term-mark").forEach((mark) => mark.remove());
  return copy.textContent ?? "";
};
const term = (word: string) =>
  screen.queryAllByRole("button", { name: `${word}, what does this mean?` });

test("links only the first use of each term in a block", () => {
  render(
    <Linked
      texts={[
        "The hypotenuse is across from the right angle. The hypotenuse is longest.",
        "Find the hypotenuse of each right triangle.",
      ]}
    />,
  );
  expect(term("hypotenuse")).toHaveLength(1);
  expect(term("right angle")).toHaveLength(1);
  expect(term("right triangle")).toHaveLength(1);
  // The first text owns hypotenuse; the second links only its new term.
  const [first, second] = screen.getAllByRole("paragraph");
  expect(within(first!).getAllByRole("button")).toHaveLength(2);
  expect(within(second!).getAllByRole("button")).toHaveLength(1);
});

test("never links inside a formula", () => {
  render(<Linked texts={["Use $\\text{area} = 12$ to find the area."]} />);
  const links = term("area");
  expect(links).toHaveLength(1);
  // The linked word is the prose one, after the formula.
  expect(links[0]!.closest(".math")).toBeNull();
  expect(document.querySelector(".math button")).toBeNull();
});

test("an ambiguous word links only where a sense names its meaning", () => {
  const text = "The range is every output the function reaches.";
  render(<Linked texts={[text]} />);
  expect(term("range")).toHaveLength(0);
  cleanup();
  render(
    <Linked texts={[text]} context={{ senses: { range: "range-function" } }} />,
  );
  const [range] = term("range");
  expect(range?.dataset.termId).toBe("range-function");
});

test("noLink keeps a word ordinary", () => {
  render(
    <Linked
      texts={["The area of the garden is the area we plant."]}
      context={{ noLink: ["area"] }}
    />,
  );
  expect(term("area")).toHaveLength(0);
});

test("without a glossary block MathText renders exactly as before", () => {
  const text = "The hypotenuse is $c$ in $a^2 + b^2 = c^2$.";
  const plain = renderToStaticMarkup(<MathText text={text} />);
  // No provider, an empty payload, or a provider with no block: unchanged.
  expect(
    renderToStaticMarkup(
      <GlossaryProvider payload={undefined}>
        <MathText text={text} />
      </GlossaryProvider>,
    ),
  ).toBe(plain);
  expect(
    renderToStaticMarkup(
      <GlossaryProvider payload={glossaryPayload([text])}>
        <MathText text={text} />
      </GlossaryProvider>,
    ),
  ).toBe(plain);
  expect(
    renderToStaticMarkup(
      <Glossary payload={{}} texts={[text]}>
        <MathText text={text} />
      </Glossary>,
    ),
  ).toBe(plain);
});

test("a term opens its card, drills down, comes back and returns focus", async () => {
  const user = userEvent.setup();
  render(<Linked texts={["Find the hypotenuse."]} />);
  const origin = term("hypotenuse")[0]!;
  expect(origin).toHaveProperty("type", "button");
  await user.click(origin);
  const dialog = screen.getByRole("dialog", { name: "hypotenuse" });
  expect(dialog.hasAttribute("open")).toBe(true);
  expect(read(dialog)).toContain(
    "The longest side of a right triangle, across from the right angle.",
  );
  expect(read(dialog)).toContain("legs 3 and 4");
  expect(dialog.querySelector("svg")).not.toBeNull();
  expect(document.activeElement).toBe(
    within(dialog).getByRole("heading", { name: "hypotenuse" }),
  );
  // The definition's own words open their cards inside the same dialog.
  await user.click(
    within(dialog).getByRole("button", { name: /^right angle,/ }),
  );
  expect(
    within(dialog).getByRole("heading", { name: "right angle" }),
  ).toBeDefined();
  const back = within(dialog).getByRole("button", {
    name: "Back to hypotenuse",
  });
  expect(read(dialog)).toContain("hypotenuse ›");
  await user.click(back);
  expect(
    within(dialog).getByRole("heading", { name: "hypotenuse" }),
  ).toBeDefined();
  expect(document.activeElement).toBe(
    within(dialog).getByRole("button", { name: /^right angle,/ }),
  );
  // Escape (the dialog's cancel) closes the card and refocuses the word.
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(origin);
});

test("Close and the scrim close the card; a click inside does not", async () => {
  const user = userEvent.setup();
  render(<Linked texts={["Find the hypotenuse."]} />);
  await user.click(term("hypotenuse")[0]!);
  const dialog = screen.getByRole("dialog");
  await user.click(dialog.querySelector(".term-card-plain")!);
  expect(screen.queryByRole("dialog")).not.toBeNull();
  await user.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(term("hypotenuse")[0]!);
  // A press inside that ends on the scrim (selecting text) keeps it open.
  const open = screen.getByRole("dialog");
  fireEvent.pointerDown(open.querySelector(".term-card-plain")!);
  fireEvent.click(open);
  expect(screen.queryByRole("dialog")).not.toBeNull();
  fireEvent.pointerDown(open);
  fireEvent.click(open);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("Escape in a card never closes the panel beneath it", async () => {
  const user = userEvent.setup();
  let outerCancels = 0;
  render(
    <dialog
      open
      onCancel={() => {
        outerCancels++;
      }}
    >
      <Linked texts={["Find the hypotenuse."]} />
    </dialog>,
  );
  await user.click(term("hypotenuse")[0]!);
  fireEvent(
    screen.getByRole("dialog", { name: "hypotenuse" }),
    new Event("cancel", { cancelable: true }),
  );
  expect(outerCancels).toBe(0);
  expect(screen.queryByRole("dialog", { name: "hypotenuse" })).toBeNull();
});

test("links exactly the terms the server's linker finds, around formulas too", () => {
  for (const text of [
    "Mark ($y$)-intercept and the slope.",
    "The value $x = 3$, an integer, is a solution.",
    "Its $y$-intercept is 4, so the line crosses the $y$-axis there.",
    "Halve $\\frac{1}{2}$: the numerator stays, the denominator doubles.",
  ]) {
    cleanup();
    render(<Linked texts={[text]} />);
    const shown = [...document.querySelectorAll<HTMLElement>(".glossary-term")]
      .map((el) => el.dataset.termId)
      .filter((id, i, all) => all.indexOf(id) === i);
    expect(shown, text).toEqual(termsIn(text));
  }
});

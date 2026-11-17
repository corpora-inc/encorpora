import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Page } from "../Page";
import { PageHeader } from "../PageHeader";
import { PageSection } from "../PageSection";

afterEach(cleanup);

test("a Page is the screen's one main, its column of the chosen kind", () => {
  const { container } = render(
    <Page width="narrow" className="stack" aria-busy id="screen">
      <p>Body</p>
    </Page>,
  );
  const main = container.querySelector("main")!;
  expect(main.dataset.page).toBe("narrow");
  expect(main.id).toBe("screen");
  expect(main.getAttribute("aria-busy")).toBe("true");
  const column = main.querySelector(":scope > [data-page-column]")!;
  // The screen's class styles the column, never the main's geometry.
  expect(column.className).toContain("stack");
  expect(main.className).not.toContain("stack");
  expect(column.textContent).toBe("Body");
});

test("standard is the default, and full has no column of its own", () => {
  const { container } = render(
    <>
      <Page>a</Page>
      <Page width="full">b</Page>
    </>,
  );
  const [standard, full] = container.querySelectorAll("main");
  expect(standard!.dataset.page).toBe("standard");
  expect(full!.dataset.page).toBe("full");
  expect(full!.querySelector("[data-page-column]")).toBeNull();
});

test("a header's way back sits above its title, one label style", () => {
  const back = vi.fn();
  render(
    <PageHeader
      back={{ label: "Billing", onClick: back }}
      title="Receipt"
      subtitle="Paid Nov 1"
      actions={<button type="button">Print</button>}
    />,
  );
  const header = document.querySelector("[data-page-header]")!;
  // Read as the screen it returns to; the chevron is drawn, not said.
  const link = screen.getByRole("button", { name: "Billing" });
  expect(link.textContent).toBe("‹Billing");
  const title = screen.getByRole("heading", { level: 1, name: "Receipt" });
  // The way back comes first, the title after it.
  expect(
    link.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(header.firstElementChild).toBe(link);
  expect(screen.getByText("Paid Nov 1").tagName).toBe("P");
  fireEvent.click(link);
  expect(back).toHaveBeenCalledOnce();
});

test("a section is labelled by its title, with its action beside it", () => {
  render(
    <PageSection title="Your plans" actions={<button>Manage</button>}>
      <p>Rows</p>
    </PageSection>,
  );
  const section = screen.getByRole("region", { name: "Your plans" });
  expect(section.querySelector("h2")!.textContent).toBe("Your plans");
  expect(screen.getByRole("button", { name: "Manage" })).toBeTruthy();
});

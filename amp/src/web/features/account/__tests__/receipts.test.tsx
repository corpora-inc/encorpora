import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { queryClient } from "../../../lib/query";
import { Receipts } from "../Receipts";

/* A receipt the server refuses for a reason the parent can fix says what to
   do, next to the download, and goes when they fix it; a name the PDF can't
   print is said before anything is sent. */

const SESSION = { accountId: "amp|parent", token: "t" };
const RECORD = {
  id: "pay-1",
  status: "verified",
  productTitle: "AMP annual",
  paidAt: 1767225600,
  paidMinor: 59900,
  netPaidMinor: 59900,
  observedAt: "2026-01-01T00:00:00.000Z",
  testMode: false,
  adjustments: [],
};

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

function serve(receipt: () => Response) {
  const receipts: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/reimbursement-programs"))
        return Response.json({ programs: [] });
      if (url.endsWith("/receipt.pdf")) {
        receipts.push(url);
        return receipt();
      }
      if (url.includes("/api/v1/payments"))
        return Response.json({ records: [RECORD], nextCursor: null });
      return Response.json({});
    }),
  );
  return receipts;
}

async function open() {
  queryClient.setQueryData(["session"], SESSION);
  render(
    <QueryClientProvider client={queryClient}>
      <Receipts selected="pay-1" onSelect={() => undefined} />
    </QueryClientProvider>,
  );
  return screen.findByRole("button", { name: "Download receipt" });
}

test("a program's required learner name is asked for, and the ask goes once typed", async () => {
  serve(() =>
    Response.json({ error: "receipt_learner_name_required" }, { status: 400 }),
  );
  fireEvent.click(await open());
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Enter the learner name required by your program.",
  );
  fireEvent.change(screen.getByRole("textbox", { name: /Learner name/ }), {
    target: { value: "Élodie Muñoz" },
  });
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a name the PDF can't print is said before anything is sent", async () => {
  const receipts = serve(() => new Response("%PDF", { status: 200 }));
  const download = await open();
  fireEvent.change(screen.getByRole("textbox", { name: /Learner name/ }), {
    target: { value: "测试" },
  });
  fireEvent.click(download);
  expect((await screen.findByRole("alert")).textContent).toMatch(
    /basic Latin letters/,
  );
  expect(receipts).toEqual([]);
});

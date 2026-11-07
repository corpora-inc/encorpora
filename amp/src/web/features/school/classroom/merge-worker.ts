import { PDFDocument } from "pdf-lib";

/** Joins many workbooks into one file off the main thread, so the progress grid
 * keeps moving. This file is its own chunk: pdf-lib loads only when a teacher
 * prints a stack. */
export type MergeRequest = { files: ArrayBuffer[] };
export type MergeResponse =
  | { ok: true; bytes: Uint8Array; pages: number }
  | { ok: false; message: string };

const post = (message: MergeResponse, transfer: Transferable[] = []) =>
  (
    self as unknown as {
      postMessage(message: MergeResponse, transfer: Transferable[]): void;
    }
  ).postMessage(message, transfer);

self.addEventListener("message", (event: MessageEvent<MergeRequest>) => {
  void (async () => {
    try {
      const merged = await PDFDocument.create();
      for (const file of event.data.files) {
        const source = await PDFDocument.load(file);
        const pages = await merged.copyPages(source, source.getPageIndices());
        for (const page of pages) merged.addPage(page);
      }
      const bytes = await merged.save();
      post({ ok: true, bytes, pages: merged.getPageCount() }, [
        bytes.buffer as ArrayBuffer,
      ]);
    } catch (error) {
      post({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })();
});

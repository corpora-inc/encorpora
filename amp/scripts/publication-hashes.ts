/** Worker for scripts/publications.ts: the SHA-256 of the print HTML of
 * documents [start, end) in catalog order. Building the HTML is the costly part
 * of an incremental release (thousands of documents), so it is split across
 * threads; only the hashes come back. */
import { createHash } from "node:crypto";
import { parentPort, workerData } from "node:worker_threads";
import { publicationDocuments } from "./publication-documents";

const { start, end } = workerData as { start: number; end: number };
const hashes = publicationDocuments()
  .slice(start, end)
  .map((doc) => createHash("sha256").update(doc.html()).digest("hex"));
parentPort!.postMessage({ start, hashes });

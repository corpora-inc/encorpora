/**
 * The sentence-embedding model behind nearest-neighbour search, pinned by
 * repository revision and SHA-256. The image build fetches it once
 * (`scripts/fetch-search-model.mjs`, its own Docker stage); nothing fetches it
 * at runtime. all-MiniLM-L6-v2, int8-quantized ONNX: 384 dimensions, 23 MB.
 * The pins live in model.json so the fetch script reads them without a
 * TypeScript toolchain.
 */
import { fileURLToPath } from "node:url";
import pins from "./model.json";

export const searchModel = pins;

/**
 * Where the model and the document vectors live: `amp/models/search`
 * (ignored by git). Source and the compiled server both sit two levels
 * below `amp/`, so the same relative path holds for both.
 */
export const searchRoot =
  process.env.AMP_SEARCH_DIR ??
  fileURLToPath(new URL("../../models/search", import.meta.url));
export const modelDir = `${searchRoot}/all-minilm-l6-v2`;
export const indexDir = `${searchRoot}/index`;

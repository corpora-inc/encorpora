/**
 * Sentence embeddings with the vendored model (model.ts), in-process on the
 * CPU through onnxruntime-node: mean-pooled, unit length. Node only.
 */
import { readFile } from "node:fs/promises";
import { modelDir, searchModel } from "./model";

export type Embedder = {
  /** Unit-length embeddings, one per text. */
  embed(texts: readonly string[]): Promise<Float32Array[]>;
  close(): Promise<void>;
};

export async function loadEmbedder(dir = modelDir): Promise<Embedder> {
  // Loaded on demand: a host without the model still serves lexical search.
  const [ort, { Tokenizer }] = await Promise.all([
    import("onnxruntime-node"),
    import("@huggingface/tokenizers"),
  ]);
  const json = async (name: string) =>
    JSON.parse(await readFile(`${dir}/${name}`, "utf8")) as object;
  const tokenizer = new Tokenizer(
    await json("tokenizer.json"),
    await json("tokenizer_config.json"),
  );
  const session = await ort.InferenceSession.create(
    `${dir}/model_quantized.onnx`,
    {
      // One thread: a query costs a few milliseconds, and the API's other
      // requests keep the rest of the CPU.
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
      executionMode: "sequential",
      graphOptimizationLevel: "all",
    },
  );
  const { dims, maxTokens } = searchModel;
  async function embed(texts: readonly string[]) {
    if (!texts.length) return [];
    const encoded = texts.map((text) => {
      const ids = tokenizer.encode(text).ids;
      // Keep [CLS] … [SEP] within the model's window.
      return ids.length > maxTokens
        ? [...ids.slice(0, maxTokens - 1), ids[ids.length - 1]!]
        : ids;
    });
    const width = Math.max(...encoded.map((ids) => ids.length));
    const size = texts.length * width;
    const inputIds = new BigInt64Array(size);
    const mask = new BigInt64Array(size);
    encoded.forEach((ids, row) =>
      ids.forEach((id, column) => {
        inputIds[row * width + column] = BigInt(id);
        mask[row * width + column] = 1n;
      }),
    );
    const shape = [texts.length, width];
    const output = await session.run({
      input_ids: new ort.Tensor("int64", inputIds, shape),
      attention_mask: new ort.Tensor("int64", mask, shape),
      token_type_ids: new ort.Tensor("int64", new BigInt64Array(size), shape),
    });
    const hidden = output.last_hidden_state!.data as Float32Array;
    return encoded.map((ids, row) => {
      const vector = new Float32Array(dims);
      for (let t = 0; t < ids.length; t++) {
        const offset = (row * width + t) * dims;
        for (let d = 0; d < dims; d++) vector[d]! += hidden[offset + d]!;
      }
      let norm = 0;
      for (let d = 0; d < dims; d++) norm += vector[d]! * vector[d]!;
      norm = Math.sqrt(norm) || 1;
      for (let d = 0; d < dims; d++) vector[d]! /= norm;
      return vector;
    });
  }
  return { embed, close: () => session.release() };
}

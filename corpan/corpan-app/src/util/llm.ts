import { invoke } from "@tauri-apps/api/core";

export interface LlmGenerateRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  repeat_penalty?: number;
  repeat_last_n?: number;
  stop_sequences?: string[];
}

/**
 * Load an LLM model from a file path or pack:// URL
 * @param modelPath - Path to the model file (supports pack://pack_id/path/to/model.gguf)
 * @param modelId - Unique identifier for this model instance
 */
export async function loadModel(
  modelPath: string,
  modelId: string
): Promise<void> {
  await invoke("llm_load_model", { modelPath, modelId });
}

/**
 * Unload an LLM model from memory
 * @param modelId - Identifier of the model to unload
 */
export async function unloadModel(modelId: string): Promise<void> {
  await invoke("llm_unload_model", { modelId });
}

/**
 * Generate text using a loaded LLM model
 * @param modelId - Identifier of the model to use
 * @param request - Generation parameters
 * @returns Array of token strings that can be joined to form the complete response
 */
export async function generate(
  modelId: string,
  request: LlmGenerateRequest
): Promise<string[]> {
  return await invoke<string[]>("llm_generate", { modelId, request });
}

/**
 * Generate text and return as a single string
 * @param modelId - Identifier of the model to use
 * @param request - Generation parameters
 * @returns Complete generated text
 */
export async function generateText(
  modelId: string,
  request: LlmGenerateRequest
): Promise<string> {
  const tokens = await generate(modelId, request);
  return tokens.join("");
}

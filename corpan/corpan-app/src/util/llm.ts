import { invoke } from "@tauri-apps/api/core";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmGenerateRequest {
  messages: ChatMessage[];
  system_message?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
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
  console.log("[LLM] Starting generation:", {
    modelId,
    messageCount: request.messages.length,
    maxTokens: request.max_tokens,
  });

  const startTime = performance.now();
  const result = await invoke<string[]>("llm_generate", { modelId, request });

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`[LLM] Completed in ${elapsed}s, received ${result.length} tokens`);

  return result;
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
  const text = tokens.join("");
  console.log("[LLM] Generated text length:", text.length, "chars");
  console.log("[LLM] First 100 chars:", text.substring(0, 100));
  return text;
}

/**
 * Generate a response in a conversation
 * @param modelId - Identifier of the model to use
 * @param messages - Conversation history
 * @param systemMessage - System message/character personality
 * @param options - Generation options
 * @returns Assistant's response
 */
export async function generateChatResponse(
  modelId: string,
  messages: ChatMessage[],
  systemMessage?: string,
  options?: {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
  }
): Promise<string> {
  return await generateText(modelId, {
    messages,
    system_message: systemMessage,
    max_tokens: options?.max_tokens ?? 100,
    temperature: options?.temperature ?? 0.7,
    top_p: options?.top_p ?? 0.9,
  });
}

/**
 * Crane's settings for the shared app kit (harvest/appkit): its key
 * namespace, its bundled speech model, vocabulary and bundle id. Every crane
 * module that uses the kit imports it through lib/ and store/, which import this first.
 */
import VOICE_MODEL from "../../src-tauri/voice-model.json";
import { setNamespace } from "../../../../harvest/appkit/src/namespace.ts";
import { configureNative } from "../../../../harvest/appkit/src/native.ts";
import { PRODUCT } from "../config.ts";
import { VOCAB_PROMPT } from "../voice/prompt.ts";

setNamespace("crane");
configureNative({ voiceModel: VOICE_MODEL.file, voicePrompt: VOCAB_PROMPT, bundleId: PRODUCT.bundleId });

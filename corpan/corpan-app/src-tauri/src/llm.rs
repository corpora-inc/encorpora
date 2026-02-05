use candle_core::quantized::gguf_file;
use candle_core::{Device, Tensor};
use candle_transformers::models::quantized_llama as model;
use candle_transformers::generation::LogitsProcessor;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use tokenizers::Tokenizer;

const DEFAULT_MAX_TOKENS: usize = 512;
const DEFAULT_TEMPERATURE: f64 = 0.7;
const DEFAULT_TOP_P: f64 = 0.9;

fn apply_repetition_penalty(
    logits: &Tensor,
    token_ids: &[u32],
    penalty: f32,
    device: &Device,
) -> Result<Tensor, String> {
    let mut logits_vec = logits.to_vec1::<f32>().map_err(|e| format!("Failed to convert logits: {:?}", e))?;

    // Apply penalty to tokens that have already been generated
    for &token_id in token_ids.iter() {
        let idx = token_id as usize;
        if idx < logits_vec.len() {
            if logits_vec[idx] > 0.0 {
                logits_vec[idx] /= penalty;
            } else {
                logits_vec[idx] *= penalty;
            }
        }
    }

    Tensor::from_vec(logits_vec.clone(), logits_vec.len(), device)
        .map_err(|e| format!("Failed to create tensor from penalized logits: {:?}", e))
}

fn format_chat_prompt(messages: &[ChatMessage], system_message: Option<&str>) -> String {
    // TinyLlama chat format: <|system|>\n{system}</s>\n<|user|>\n{user}</s>\n<|assistant|>\n{assistant}</s>\n...
    let mut formatted = String::new();

    // Add system message
    let system = system_message.unwrap_or("You are a helpful AI assistant.");
    formatted.push_str(&format!("<|system|>\n{}</s>\n", system));

    // Add conversation history
    for msg in messages {
        match msg.role.as_str() {
            "user" => formatted.push_str(&format!("<|user|>\n{}</s>\n", msg.content)),
            "assistant" => formatted.push_str(&format!("<|assistant|>\n{}</s>\n", msg.content)),
            "system" => {}, // Already added above
            _ => {},
        }
    }

    // Add assistant prompt for next response
    formatted.push_str("<|assistant|>\n");

    formatted
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String, // "system", "user", or "assistant"
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmGenerateRequest {
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub system_message: Option<String>,
    #[serde(default)]
    pub max_tokens: Option<usize>,
    #[serde(default)]
    pub temperature: Option<f64>,
    #[serde(default)]
    pub top_p: Option<f64>,
    #[serde(default)]
    pub stop_sequences: Option<Vec<String>>,
}

#[derive(Clone)]
struct ModelInstance {
    model: Arc<Mutex<model::ModelWeights>>,
    tokenizer: Arc<Tokenizer>,
    device: Device,
}

#[derive(Clone)]
pub struct LlmState {
    models: Arc<Mutex<HashMap<String, ModelInstance>>>,
}

impl LlmState {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            models: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub fn load_model(&self, model_path: &str, model_id: &str) -> Result<(), String> {
        let path = PathBuf::from(model_path);
        if !path.exists() {
            return Err(format!("Model file not found: {}", model_path));
        }

        // Try to use Metal GPU on macOS, fall back to CPU
        let device = Device::new_metal(0).unwrap_or_else(|_| {
            println!("[LLM Rust] Metal not available, using CPU");
            Device::Cpu
        });

        match &device {
            Device::Metal(_) => println!("[LLM Rust] Using Metal GPU acceleration"),
            Device::Cpu => println!("[LLM Rust] Using CPU"),
            _ => {}
        }

        // Load the model from GGUF file
        let mut file = std::fs::File::open(&path)
            .map_err(|e| format!("Failed to open model file: {}", e))?;

        let content = gguf_file::Content::read(&mut file)
            .map_err(|e| format!("Failed to read GGUF file: {:?}", e))?;

        let model_weights = model::ModelWeights::from_gguf(content, &mut file, &device)
            .map_err(|e| format!("Failed to create model from GGUF: {:?}", e))?;

        // Try to find tokenizer in the same directory
        let model_dir = path.parent().ok_or("Invalid model path")?;
        let tokenizer_path = model_dir.join("tokenizer.json");

        let tokenizer = if tokenizer_path.exists() {
            Tokenizer::from_file(&tokenizer_path)
                .map_err(|e| format!("Failed to load tokenizer: {}", e))?
        } else {
            return Err(format!("Tokenizer not found at {:?}. Please ensure tokenizer.json is in the same directory as the model.", tokenizer_path));
        };

        let instance = ModelInstance {
            model: Arc::new(Mutex::new(model_weights)),
            tokenizer: Arc::new(tokenizer),
            device,
        };

        let mut models = self.models.lock().map_err(|_| "Lock poisoned")?;
        models.insert(model_id.to_string(), instance);

        Ok(())
    }

    pub fn unload_model(&self, model_id: &str) -> Result<(), String> {
        let mut models = self.models.lock().map_err(|_| "Lock poisoned")?;
        models
            .remove(model_id)
            .ok_or_else(|| format!("Model not found: {}", model_id))?;
        Ok(())
    }

    pub fn generate(
        &self,
        model_id: &str,
        request: LlmGenerateRequest,
    ) -> Result<Vec<String>, String> {
        println!("[LLM Rust] Starting generation for model: {}", model_id);

        let models = self.models.lock().map_err(|_| "Lock poisoned")?;
        let instance = models
            .get(model_id)
            .ok_or_else(|| format!("Model not loaded: {}", model_id))?
            .clone();
        drop(models); // Release lock

        let max_tokens = request.max_tokens.unwrap_or(DEFAULT_MAX_TOKENS);
        let temperature = request.temperature.unwrap_or(DEFAULT_TEMPERATURE);
        let top_p = request.top_p.unwrap_or(DEFAULT_TOP_P);

        println!("[LLM Rust] Max tokens: {}", max_tokens);
        println!("[LLM Rust] Message count: {}", request.messages.len());
        println!("[LLM Rust] Temperature: {}, Top-p: {}", temperature, top_p);

        // Create logits processor for sampling
        let mut logits_processor = LogitsProcessor::new(299792458, Some(temperature), Some(top_p));

        // Format the prompt with chat template
        let formatted_prompt = format_chat_prompt(&request.messages, request.system_message.as_deref());
        println!("[LLM Rust] Formatted prompt: {}...", &formatted_prompt[..formatted_prompt.len().min(200)]);

        // Encode the prompt
        println!("[LLM Rust] Encoding prompt...");
        let tokens = instance
            .tokenizer
            .encode(formatted_prompt, true)
            .map_err(|e| format!("Failed to encode prompt: {}", e))?;

        let mut token_ids: Vec<u32> = tokens.get_ids().to_vec();
        let prompt_token_count = token_ids.len();
        println!("[LLM Rust] Encoded {} initial tokens", prompt_token_count);

        println!("[LLM Rust] Acquiring model lock...");
        let mut model = instance.model.lock().map_err(|_| "Model lock poisoned")?;
        println!("[LLM Rust] Model lock acquired, starting generation loop...");

        // Generate tokens (greedy sampling for now)
        for i in 0..max_tokens {
            if i % 10 == 0 {
                println!("[LLM Rust] Generated {} tokens so far", i);
            }
            let context_size = if i == 0 {
                token_ids.len()
            } else {
                1
            };
            let start_pos = token_ids.len().saturating_sub(context_size);
            let input_ids = Tensor::new(&token_ids[start_pos..], &instance.device)
                .map_err(|e| format!("Failed to create input tensor: {:?}", e))?
                .unsqueeze(0)
                .map_err(|e| format!("Failed to unsqueeze: {:?}", e))?;

            // Forward pass
            let logits = model
                .forward(&input_ids, start_pos)
                .map_err(|e| format!("Forward pass failed: {:?}", e))?;

            // Get logits for the last token
            let logits = logits
                .squeeze(0)
                .map_err(|e| format!("Failed to squeeze logits: {:?}", e))?;

            // Apply repetition penalty - penalize tokens we've already generated
            let logits = apply_repetition_penalty(&logits, &token_ids, 1.1, &instance.device)?;

            // Sample next token using temperature and top-p
            let next_token_id = logits_processor
                .sample(&logits)
                .map_err(|e| format!("Sampling failed: {:?}", e))?;

            token_ids.push(next_token_id);

            // Check for EOS token (2 is common for TinyLlama)
            if next_token_id == 2 {
                println!("[LLM Rust] Hit EOS token");
                break;
            }
        }

        // Decode only the generated tokens (skip prompt tokens)
        let mut generated_text = instance
            .tokenizer
            .decode(&token_ids[prompt_token_count..], true)
            .map_err(|e| format!("Failed to decode generated tokens: {}", e))?;

        // Clean up template markers if they leaked through
        let markers = ["<|user|>", "<|assistant|>", "<|system|>", "</s>"];
        for marker in &markers {
            if let Some(pos) = generated_text.find(marker) {
                generated_text = generated_text[..pos].to_string();
            }
        }

        generated_text = generated_text.trim().to_string();

        println!("[LLM Rust] Generation complete! Generated {} tokens", token_ids.len() - prompt_token_count);

        // Log first 100 chars safely
        let preview: String = generated_text.chars().take(100).collect();
        println!("[LLM Rust] Generated text: {}", preview);

        Ok(vec![generated_text])
    }
}

pub fn resolve_model_path(app: &AppHandle, path: &str) -> Result<String, String> {
    // Handle pack:// protocol
    if let Some(stripped) = path.strip_prefix("pack://") {
        // Extract pack_id and relative path
        let parts: Vec<&str> = stripped.splitn(2, '/').collect();
        if parts.len() < 2 {
            return Err("Invalid pack:// URL".to_string());
        }

        let pack_id = parts[0];
        let relative_path = parts[1];

        // Get pack installation directory
        let pack_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?
            .join("content_packs")
            .join(pack_id);

        let full_path = pack_dir.join(relative_path);

        Ok(full_path.to_str().ok_or("Invalid path")?.to_string())
    } else {
        // Absolute path
        Ok(path.to_string())
    }
}

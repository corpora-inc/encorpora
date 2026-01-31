use candle_core::quantized::gguf_file;
use candle_core::{Device, Tensor};
use candle_transformers::models::quantized_llama as model;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use tokenizers::Tokenizer;

const DEFAULT_MAX_TOKENS: usize = 512;
const DEFAULT_TEMPERATURE: f64 = 0.7;
const DEFAULT_TOP_P: f64 = 0.9;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmGenerateRequest {
    pub prompt: String,
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

        // Use CPU for now (Metal support can be added later)
        let device = Device::Cpu;

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
        let models = self.models.lock().map_err(|_| "Lock poisoned")?;
        let instance = models
            .get(model_id)
            .ok_or_else(|| format!("Model not loaded: {}", model_id))?
            .clone();
        drop(models); // Release lock

        let max_tokens = request.max_tokens.unwrap_or(DEFAULT_MAX_TOKENS);
        let _temperature = request.temperature.unwrap_or(DEFAULT_TEMPERATURE);
        let _top_p = request.top_p.unwrap_or(DEFAULT_TOP_P);

        // Encode the prompt
        let tokens = instance
            .tokenizer
            .encode(request.prompt.clone(), true)
            .map_err(|e| format!("Failed to encode prompt: {}", e))?;

        let mut token_ids: Vec<u32> = tokens.get_ids().to_vec();
        let mut generated_strings = Vec::new();

        let mut model = instance.model.lock().map_err(|_| "Model lock poisoned")?;

        // Generate tokens (greedy sampling for now)
        for _ in 0..max_tokens {
            let context_size = if generated_strings.is_empty() {
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

            // Greedy sampling - take highest logit
            let next_token_id = logits
                .argmax(candle_core::D::Minus1)
                .map_err(|e| format!("Argmax failed: {:?}", e))?
                .to_scalar::<u32>()
                .map_err(|e| format!("Failed to convert to scalar: {:?}", e))?;

            token_ids.push(next_token_id);

            // Check for EOS token (2 is common EOS)
            if next_token_id == 2 {
                break;
            }

            // Decode token
            let token_str = instance
                .tokenizer
                .decode(&[next_token_id], false)
                .map_err(|e| format!("Failed to decode token: {}", e))?;

            generated_strings.push(token_str.clone());

            // Check stop sequences
            if let Some(ref stops) = request.stop_sequences {
                let current_text: String = generated_strings.join("");
                if stops.iter().any(|stop| current_text.contains(stop)) {
                    break;
                }
            }
        }

        Ok(generated_strings)
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

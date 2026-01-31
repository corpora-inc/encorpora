import { useState, useRef } from "react";
import { loadModel, unloadModel, generateText } from "../util/llm";
import { Button } from "./ui/button";

export function LlmTest() {
  const [modelPath, setModelPath] = useState("");
  const [modelId] = useState("default");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleLoadModel = async () => {
    if (!modelPath.trim()) {
      setLoadError("Please enter a model path");
      return;
    }

    setLoadError("");
    setIsLoaded(false);

    try {
      await loadModel(modelPath, modelId);
      setIsLoaded(true);
      setLoadError("");
    } catch (err) {
      setLoadError(`Failed to load model: ${err}`);
      console.error(err);
    }
  };

  const handleUnloadModel = async () => {
    try {
      await unloadModel(modelId);
      setIsLoaded(false);
      setResponse("");
      setError("");
    } catch (err) {
      setError(`Failed to unload model: ${err}`);
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setError("");
    setResponse("");

    abortControllerRef.current = new AbortController();

    try {
      const result = await generateText(modelId, {
        prompt: prompt,
        max_tokens: 256,
        temperature: 0.7,
        top_p: 0.9,
      });

      setResponse(result);
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        setError(`Generation failed: ${err}`);
        console.error(err);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
          <div className="border-b pb-4">
            <h1 className="text-2xl font-bold">LLM Test Interface</h1>
            <p className="text-sm text-gray-600 mt-1">
              Test on-device LLM inference
            </p>
          </div>

          {/* Model Loading Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Model Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="/path/to/model.gguf or pack://pack_id/model.gguf"
                value={modelPath}
                onChange={(e) => setModelPath(e.target.value)}
                disabled={isLoaded}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {!isLoaded ? (
                <Button onClick={handleLoadModel}>Load Model</Button>
              ) : (
                <Button onClick={handleUnloadModel} variant="destructive">
                  Unload
                </Button>
              )}
            </div>
            {loadError && (
              <p className="text-sm text-red-500">{loadError}</p>
            )}
            {isLoaded && (
              <p className="text-sm text-green-600">
                Model loaded successfully!
              </p>
            )}
          </div>

          {/* Generation Section */}
          {isLoaded && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prompt</label>
                <textarea
                  placeholder="Enter your prompt here..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isGenerating}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
                />
              </div>

              <div className="flex gap-2">
                {!isGenerating ? (
                  <Button onClick={handleGenerate} disabled={!prompt.trim()}>
                    Generate
                  </Button>
                ) : (
                  <Button onClick={handleStop} variant="destructive">
                    Stop
                  </Button>
                )}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              {isGenerating && (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" />
                  <span className="text-sm">Generating...</span>
                </div>
              )}

              {response && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Response</label>
                  <div className="p-4 bg-gray-50 rounded-md whitespace-pre-wrap border border-gray-200">
                    {response}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 rounded-md border border-blue-200">
            <h3 className="text-sm font-semibold mb-2">Instructions:</h3>
            <ol className="text-sm space-y-1 list-decimal list-inside text-gray-700">
              <li>
                Run <code className="bg-white px-1 rounded">./download_test_model.sh</code> to download a test model
              </li>
              <li>
                Make sure tokenizer.json is in the same directory as the model
              </li>
              <li>Enter the full path to the model file</li>
              <li>Click "Load Model" to load it into memory</li>
              <li>Enter a prompt and click "Generate" to test</li>
            </ol>
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-gray-600">
                <strong>Note:</strong> First generation may take 10-30 seconds
                to load. Subsequent generations will be faster.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

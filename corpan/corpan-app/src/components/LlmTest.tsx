import { useState, useRef, useEffect } from "react";
import { loadModel, unloadModel, generateChatResponse, type ChatMessage } from "../util/llm";
import { Button } from "./ui/button";

const DEFAULT_SYSTEM_MESSAGE = `Eres María de México. Habla español natural y responde en 1-2 oraciones cortas.`;

export function LlmTest() {
  const [modelPath, setModelPath] = useState("");
  const [modelId] = useState("default");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  // Conversation state
  const [systemMessage, setSystemMessage] = useState(DEFAULT_SYSTEM_MESSAGE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showSystemEditor, setShowSystemEditor] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleSendMessage = async () => {
    if (!userInput.trim()) {
      setError("Please enter a message");
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: userInput.trim(),
    };

    // Add user message to conversation
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setUserInput("");
    setIsGenerating(true);
    setError("");

    abortControllerRef.current = new AbortController();

    try {
      console.log("[LlmTest] Generating response with", updatedMessages.length, "messages");
      const response = await generateChatResponse(
        modelId,
        updatedMessages,
        systemMessage,
        {
          max_tokens: 50,
          temperature: 0.8,
          top_p: 0.9,
        }
      );

      console.log("[LlmTest] Got response:", response.substring(0, 50));

      // Add assistant response to conversation
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.trim(),
      };
      setMessages([...updatedMessages, assistantMessage]);
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

  const handleClearConversation = () => {
    setMessages([]);
    setError("");
  };

  const handleResetSystem = () => {
    setSystemMessage(DEFAULT_SYSTEM_MESSAGE);
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-[90vh]">
          {/* Header */}
          <div className="border-b p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <h1 className="text-2xl font-bold">Conversational AI Character</h1>
            <p className="text-sm text-blue-100 mt-1">
              Chat with AI personas powered by on-device LLM
            </p>
          </div>

          {/* Model Loading Section */}
          {!isLoaded && (
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Model Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="/path/to/model.gguf"
                    value={modelPath}
                    onChange={(e) => setModelPath(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button onClick={handleLoadModel}>Load Model</Button>
                </div>
                {loadError && (
                  <p className="text-sm text-red-500">{loadError}</p>
                )}
              </div>
              <div className="p-4 bg-blue-50 rounded-md border border-blue-200 text-sm">
                <p className="font-semibold mb-2">Quick Start:</p>
                <p>Default path: <code className="bg-white px-2 py-1 rounded">/Users/skyl/corpan-models/TinyLlama-1.1B-Chat-v1.0.Q4_K_M.gguf</code></p>
              </div>
            </div>
          )}

          {/* Chat Interface */}
          {isLoaded && (
            <>
              {/* System Message Editor */}
              <div className="border-b bg-gray-50">
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Character Personality</span>
                    <button
                      onClick={() => setShowSystemEditor(!showSystemEditor)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      {showSystemEditor ? "Hide" : "Edit"}
                    </button>
                    <button
                      onClick={handleResetSystem}
                      className="text-xs text-gray-600 hover:text-gray-700"
                    >
                      Reset
                    </button>
                  </div>
                  <Button
                    onClick={handleUnloadModel}
                    variant="destructive"
                    className="text-xs py-1 px-3 h-auto"
                  >
                    Unload Model
                  </Button>
                </div>
                {showSystemEditor && (
                  <div className="px-3 pb-3">
                    <textarea
                      value={systemMessage}
                      onChange={(e) => setSystemMessage(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                      placeholder="Define the character's personality, background, and behavior..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This system message defines who the AI character is and how they should respond.
                    </p>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 mt-8">
                    <p className="text-lg font-medium">Start a conversation!</p>
                    <p className="text-sm mt-2">Type a message below to chat with the AI character.</p>
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-900"
                      }`}
                    >
                      <p className="text-xs font-semibold mb-1 opacity-70">
                        {msg.role === "user" ? "You" : "María"}
                      </p>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isGenerating && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" />
                        <span className="text-sm">Typing...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Error Display */}
              {error && (
                <div className="px-4 pb-2">
                  <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded p-2">
                    {error}
                  </p>
                </div>
              )}

              {/* Input Area */}
              <div className="border-t p-4 bg-gray-50">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !isGenerating) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isGenerating}
                    placeholder="Type your message... (Press Enter to send)"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  {!isGenerating ? (
                    <Button
                      onClick={handleSendMessage}
                      disabled={!userInput.trim()}
                      className="px-6"
                    >
                      Send
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStop}
                      variant="destructive"
                      className="px-6"
                    >
                      Stop
                    </Button>
                  )}
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{messages.length} messages in conversation</span>
                  {messages.length > 0 && (
                    <button
                      onClick={handleClearConversation}
                      className="text-red-600 hover:text-red-700"
                    >
                      Clear conversation
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { speakKO, speakEN } from "./util/speak";
import "./index.css";

const HISTORY_KEY = "korean_sentence_history";

export type Sentence = {
  text_korean: string;
  text_english: string;
};

export default function App() {
  const [history, setHistory] = useState<Sentence[]>([]);
  const [index, setIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  // Load from localStorage or fetch first
  useEffect(() => {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      try {
        const arr: Sentence[] = JSON.parse(raw);
        if (arr.length) {
          setHistory(arr);
          setIndex(arr.length - 1);
          return;
        }
      } catch { }
    }
    fetchRandom();
  }, []);

  // Persist history
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const fetchRandom = useCallback(async () => {
    setLoading(true);
    try {
      const s = await invoke<Sentence>("get_random_sentence");
      setHistory((h) => [...h.slice(0, index + 1), s]);
      setIndex((i) => i + 1);
    } finally {
      setLoading(false);
    }
  }, [index]);

  const handlePrev = () => {
    if (index > 0) setIndex(index - 1);
  };
  const handleNext = () => {
    if (index < history.length - 1) setIndex(index + 1);
    else fetchRandom();
  };

  const curr = history[index];

  return (
    <div className="h-full w-full flex items-center justify-center bg-gray-50">
      <div className="flex flex-col h-full w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Top third: Hangul */}
        <div className="flex-none h-1/3 flex flex-col items-center justify-center p-4">
          {curr ? (
            <>
              <p className="text-6xl font-extrabold text-center">
                {curr.text_korean}
              </p>
              <Button
                onClick={() => speakKO(curr.text_korean)}
                className="mt-4 px-8 py-4 text-xl"
                variant="outline"
              >
                Speak Korean
              </Button>
            </>
          ) : (
            <p>Loading…</p>
          )}
        </div>

        {/* Middle third: English */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {curr && (
            <>
              <p className="text-2xl text-gray-700 text-center mb-4">
                {curr.text_english}
              </p>
              <Button
                onClick={() => speakEN(curr.text_english)}
                className="px-8 py-4 text-xl"
                variant="outline"
              >
                Speak English
              </Button>
            </>
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex-none bg-gray-100 border-t">
          <div className="flex justify-between items-center p-4">
            <Button
              onClick={handlePrev}
              disabled={index <= 0}
              className="px-8 py-4 text-xl"
            >
              Prev
            </Button>
            <Button
              onClick={fetchRandom}
              disabled={loading}
              className="px-8 py-4 text-xl"
            >
              Random
            </Button>
            <Button
              onClick={handleNext}
              disabled={loading}
              className="px-8 py-4 text-xl"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

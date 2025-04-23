// src/App.tsx
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { speakKO, speakEN } from "./util/speak";

import "./index.css";

const HISTORY_KEY = "korean_sentence_history";

export type Sentence = {
  text_korean: string;
  text_english: string;
  romanization?: string; // placeholder for future
  imageUrl?: string;     // placeholder for future
};

export default function App() {
  const [history, setHistory] = useState<Sentence[]>([]);
  const [index, setIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);

  // Load history from localStorage on mount
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
      } catch {
        /* ignore */
      }
    }
    // otherwise fetch one
    handleRandom();
  }, []);

  // Persist history whenever it changes
  useEffect(() => {
    if (history.length) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
  }, [history]);

  const fetchRandom = useCallback(async (): Promise<Sentence> => {
    const s = await invoke<Sentence>("get_random_sentence");
    return s;
  }, []);

  const handleRandom = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchRandom();
      setHistory((h) => [...h.slice(0, index + 1), s]);
      setIndex((i) => i + 1);
      // speakKO(s.text_korean);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [fetchRandom, index]);

  const handleNext = () => {
    if (index < history.length - 1) {
      setIndex(index + 1);
      // speak(history[index + 1].text_korean);
    } else {
      handleRandom();
    }
  };

  const handlePrev = () => {
    if (index > 0) {
      setIndex(index - 1);
      // speak(history[index - 1].text_korean);
    }
  };

  const curr = history[index];

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
        {curr ? (
          <>
            <div className="text-center">
              <div className="">
                <h1 className="text-5xl font-bold">{curr.text_korean}</h1>
                <Button onClick={() => speakKO(curr.text_korean)} variant="outline">
                  Speak Korean
                </Button>

                {curr.romanization && (
                  <p className="text-xl text-gray-500">{curr.romanization}</p>
                )}
              </div>
              {curr.imageUrl && (
                <div className="m-10 h-48 bg-gray-100 rounded flex items-center justify-center">

                  <img
                    src={curr.imageUrl}
                    alt="illustration"
                    className="max-h-full"
                  />

                </div>
              )}
              <div className="">
                <p className="text-lg text-gray-700">{curr.text_english}</p>
                <Button onClick={() => speakEN(curr.text_english)} variant="outline">
                  Speak English
                </Button>
              </div>
            </div>

          </>
        ) : (
          <p className="text-center">Loading…</p>
        )}

        <div className="flex justify-between mt-10">
          <Button onClick={handlePrev} disabled={index <= 0 || loading}>
            Prev
          </Button>
          <Button onClick={handleNext} disabled={loading}>
            Next
          </Button>
          <Button onClick={handleRandom} disabled={loading}>
            Random
          </Button>
        </div>
      </div>
    </div >
  );
}

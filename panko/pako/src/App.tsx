import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { speakKO, speakEN } from "./util/speak";
import {
  ChevronLeft as ChevronLeftIcon,
  RefreshCw as RefreshIcon,
  ChevronRight as ChevronRightIcon,
  Info,
} from "lucide-react";
import "./index.css";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import About from "./components/About";

const HISTORY_KEY = "korean_sentence_history";

export type Sentence = {
  text_korean: string;
  text_english: string;
};

export default function App() {
  const [history, setHistory] = useState<Sentence[]>([]);
  const [index, setIndex] = useState<number>(-1);
  const [loading, setLoading] = useState<boolean>(true);

  // keep a ref to the "current" index for async use
  const indexRef = useRef<number>(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Single initial load: try storage, else fetch one
  useEffect(() => {
    (async () => {
      try {
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
            // invalid JSON → fall back
          }
        }
        // no valid history → fetch one
        const s = await invoke<Sentence>("get_random_sentence");
        setHistory([s]);
        setIndex(0);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Persist every time history changes
  useEffect(() => {
    if (history.length) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
  }, [history]);

  // Always-fresh fetcher
  const fetchRandomSentence = async () => {
    setLoading(true);
    try {
      const s = await invoke<Sentence>("get_random_sentence");
      setHistory((prev) => {
        // drop any "future" entries if user navigated back
        const truncated = prev.slice(0, indexRef.current + 1);
        return [...truncated, s];
      });
      // move to new last
      setIndex((_) => indexRef.current + 1);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    if (index > 0) {
      setIndex((i) => i - 1);
    }
  };
  const handleNext = () => {
    if (index < history.length - 1) {
      setIndex((i) => i + 1);
    } else {
      fetchRandomSentence();
    }
  };

  const curr = history[index];

  return (
    <div className="h-full w-full flex items-center justify-center bg-gray-50">
      <Drawer>
        <DrawerTrigger asChild>
          <div>
            <Info className="absolute top-3 right-3   w-6 h-6 text-gray-500" />
          </div>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="font-bold text-2xl">About Pako</DrawerTitle>
            <DrawerDescription>Learn Korean or 영어를 배우다</DrawerDescription>
          </DrawerHeader>
          <About />
        </DrawerContent>
      </Drawer>
      <div className="flex flex-col h-full w-full bg-white rounded-lg shadow-lg overflow-scroll">
        {/* Top third: Hangul */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {loading ? (
            <p>Loading…</p>
          ) : curr ? (
            <>
              {/* <p className="text-6xl font-extrabold text-center mt-6 p-3"> */}
              <p className="text-6xl md:text-7xl lg:text-8xl xl:text-[6rem] font-extrabold text-center mt-6 p-3">
                {curr.text_korean}
              </p>
              <Button
                onClick={() => speakKO(curr.text_korean)}
                className="m-3"
                size="lg"
                variant="outline"
              >
                Speak Korean
              </Button>
            </>
          ) : (
            <p>No sentence available.</p>
          )}
        </div>

        {/* Middle third: English */}
        <div className="flex-1 flex flex-col items-center justify-center px-12">
          {curr && !loading && (
            <>
              {/* <p className="text-2xl text-gray-700 text-center"> */}
              <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-gray-700 text-center">
                {curr.text_english}
              </p>
              <Button
                onClick={() => speakEN(curr.text_english)}
                className="m-3"
                variant="outline"
                size="lg"
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
              disabled={loading || index <= 0}
              className="p-2"
              variant="outline"
              aria-label="Previous sentence"
            >
              <ChevronLeftIcon className="w-6 h-6" />
            </Button>

            <Button
              onClick={fetchRandomSentence}
              disabled={loading}
              className="p-2"
              variant="outline"
              aria-label="Random sentence"
            >
              <RefreshIcon className="w-6 h-6" />
            </Button>

            <Button
              onClick={handleNext}
              disabled={loading}
              className="p-2"
              variant="outline"
              aria-label="Next sentence"
            >
              <ChevronRightIcon className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

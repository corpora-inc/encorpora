import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core'

function speak(text: string) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  speechSynthesis.speak(u);
}


type Sentence = {
  text_korean: string;
  text_english: string;
};

export default function App() {
  const [sentence, setSentence] = useState<Sentence | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadSentence() {
    setLoading(true);
    try {
      const s = await invoke<Sentence>('get_random_sentence');
      speak(s.text_korean);
      setSentence(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSentence();
  }, []);

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl mb-4">Korean Flash-Card MVP</h1>
      {sentence ? (
        <div className="space-y-2">
          <p className="text-3xl font-bold">{sentence.text_korean}</p>
          <p className="text-lg text-gray-600">{sentence.text_english}</p>
          <div className="flex space-x-2 mt-4">
            <button
              onClick={loadSentence}
              className="px-4 py-2 bg-blue-600 text-white rounded"
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Next'}
            </button>
          </div>
        </div>
      ) : (
        <p>Loading…</p>
      )}
    </div>
  );
}


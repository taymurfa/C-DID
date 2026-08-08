'use client';

import { useState, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { api } from '@/lib/api';

const OPENAI_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'cedar',
  'coral',
  'echo',
  'fable',
  'marin',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
] as const;

const OPENAI_MODELS = [
  { value: 'tts-1', label: 'tts-1 (fast)' },
  { value: 'tts-1-hd', label: 'tts-1-hd (higher quality)' },
  { value: 'gpt-4o-mini-tts', label: 'gpt-4o-mini-tts (newest)' },
];

const MAGIC_HOUR_VOICES = [
  'Elon Musk',
  'Mark Zuckerberg',
  'Joe Rogan',
  'Barack Obama',
  'Morgan Freeman',
  'Kanye West',
  'Donald Trump',
  'Joe Biden',
  'Kim Kardashian',
  'Taylor Swift',
  'James Earl Jones',
  'Samuel L. Jackson',
  'Jeff Goldblum',
  'David Attenborough',
  'Sean Connery',
  'Cillian Murphy',
  'Anne Hathaway',
  'Julia Roberts',
  'Natalie Portman',
  'Steve Carell',
  'Amy Poehler',
  'Stephen Colbert',
  'Jimmy Fallon',
  'David Letterman',
  'Alex Trebek',
  'Katy Perry',
  'Prince',
  'Kevin Bacon',
  'Tom Hiddleston',
  'Adam Driver',
  'Alan Rickman',
  'Kristen Bell',
  'Lorde',
  'Matt Smith',
  'Marilyn Monroe',
  'Charlie Chaplin',
  'Albert Einstein',
  'Abraham Lincoln',
  'John F. Kennedy',
  'Lucille Ball',
];

export default function VoicePage() {
  const [text, setText] = useState('');
  const [provider, setProvider] = useState<'openai' | 'magic_hour'>('openai');
  const [openaiVoice, setOpenaiVoice] = useState<string>('alloy');
  const [openaiModel, setOpenaiModel] = useState<string>('tts-1');
  const [openaiSpeed, setOpenaiSpeed] = useState<number>(1);
  const [voiceName, setVoiceName] = useState<string>('Elon Musk');
  const [name, setName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError('Please enter some text.');
      return;
    }
    setError(null);
    setAudioUrl(null);
    setIsLoading(true);
    try {
      const blob = await api.generateVoice({
        text: text.trim(),
        provider,
        ...(provider === 'openai'
          ? { voice: openaiVoice, model: openaiModel, speed: openaiSpeed }
          : { voice_name: voiceName, name: name.trim() || undefined }),
      });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate voice.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Voice Message Generator</h1>
        <p className="text-gray-600 mb-6">
          Choose OpenAI TTS for fast results, or Magic Hour for celebrity-style voices (can take 1–2 minutes).
        </p>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="text" className="block text-sm font-medium text-gray-700">
              Text
            </label>
            <textarea
              id="text"
              rows={5}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Type or paste the text you want to convert to speech..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700">
              Provider
            </label>
            <select
              id="provider"
              className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-indigo-500 focus:border-indigo-500"
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'openai' | 'magic_hour')}
              disabled={isLoading}
            >
              <option value="openai">OpenAI TTS (faster)</option>
              <option value="magic_hour">Magic Hour (celebrity voices)</option>
            </select>
          </div>

          {provider === 'openai' && (
            <>
              <div className="space-y-2">
                <label htmlFor="openai-voice" className="block text-sm font-medium text-gray-700">
                  Voice
                </label>
                <select
                  id="openai-voice"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-indigo-500 focus:border-indigo-500"
                  value={openaiVoice}
                  onChange={(e) => setOpenaiVoice(e.target.value)}
                  disabled={isLoading}
                >
                  {OPENAI_VOICES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="openai-model" className="block text-sm font-medium text-gray-700">
                  Model
                </label>
                <select
                  id="openai-model"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-indigo-500 focus:border-indigo-500"
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  disabled={isLoading}
                >
                  {OPENAI_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="openai-speed" className="block text-sm font-medium text-gray-700">
                  Speed ({openaiSpeed.toFixed(1)}x)
                </label>
                <input
                  id="openai-speed"
                  type="range"
                  min={0.25}
                  max={4}
                  step={0.05}
                  value={openaiSpeed}
                  onChange={(e) => setOpenaiSpeed(parseFloat(e.target.value))}
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
            </>
          )}

          {provider === 'magic_hour' && (
            <>
              <div className="space-y-2">
                <label htmlFor="voice" className="block text-sm font-medium text-gray-700">
                  Voice
                </label>
                <select
                  id="voice"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-indigo-500 focus:border-indigo-500"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  disabled={isLoading}
                >
                  {MAGIC_HOUR_VOICES.map((voice) => (
                    <option key={voice} value={voice}>{voice}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Project name (optional)
                </label>
                <input
                  id="name"
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Welcome message"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : 'Generate Voice'}
          </button>

          {audioUrl && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-gray-700 mb-2">Audio</p>
              <audio
                ref={audioRef}
                src={audioUrl}
                controls
                className="w-full"
              />
            </div>
          )}
        </div>

        <p className="mt-4 text-sm text-gray-500">
          OpenAI TTS: set <code className="bg-gray-100 px-1 rounded">OPENAI_API_KEY</code> in backend <code className="bg-gray-100 px-1 rounded">.env</code>.
          Magic Hour: set <code className="bg-gray-100 px-1 rounded">MAGICHOUR_API_KEY</code> (from{' '}
          <a href="https://magichour.ai/developer?tab=api-keys" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Magic Hour</a>).
        </p>
      </div>
    </div>
  );
}

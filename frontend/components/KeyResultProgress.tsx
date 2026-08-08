'use client';

import { useState, FormEvent } from 'react';
import { api, KeyResult } from '@/lib/api';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { InlineHelp } from '@/components/shared/InlineHelp';

interface KeyResultProgressProps {
  keyResult: KeyResult;
  onUpdate?: () => void;
}

export default function KeyResultProgress({ keyResult, onUpdate }: KeyResultProgressProps) {
  const [score, setScore] = useState<string>(keyResult.score != null ? String(keyResult.score) : '');
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notes = Array.isArray(keyResult.notes) ? keyResult.notes : [];

  const handleSaveScore = async (e: FormEvent) => {
    e.preventDefault();
    if (!keyResult._id) return;
    setError(null);
    setLoading(true);
    try {
      const num = score === '' ? undefined : Number(score);
      if (num !== undefined && (num < 0 || num > 100)) {
        setError('Score must be between 0 and 100');
        setLoading(false);
        return;
      }
      await api.updateKeyResult(keyResult._id, { score: num });
      onUpdate?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update score');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!keyResult._id || !noteText.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const newNote = { text: noteText.trim(), createdAt: new Date().toISOString() };
      const updatedNotes = [...notes, newNote];
      await api.updateKeyResult(keyResult._id, { notes: updatedNotes });
      setNoteText('');
      onUpdate?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-gray-900">{keyResult.title}</span>
        {keyResult.target && (
          <span className="text-sm text-gray-500">
            Target: {keyResult.target} {keyResult.unit || ''}
          </span>
        )}
      </div>
      {keyResult.currentValue != null && keyResult.currentValue !== '' && (
        <p className="mt-1 text-sm text-gray-600">
          Current: {keyResult.currentValue} {keyResult.unit || ''}
        </p>
      )}
      {error && <ErrorMessage message={error} className="mt-2" />}
      <InlineHelp className="mt-2">
        Score is 0–100% of target achieved. Enter a number and click Save.
      </InlineHelp>
      <form onSubmit={handleSaveScore} className="mt-2 flex items-center gap-2">
        <label className="text-sm text-gray-600">Score (0–100):</label>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-indigo-600 px-2 py-1 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Save
        </button>
      </form>
      <div className="mt-3 border-t border-gray-100 pt-2">
        <p className="text-xs font-medium text-gray-500">Notes (feedback loop)</p>
        <form onSubmit={handleAddNote} className="mt-1 flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add progress note..."
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !noteText.trim()}
            className="rounded bg-gray-600 px-2 py-1 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {notes.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            {notes.map((n, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{(n as { text?: string }).text ?? String(n)}</span>
                <span className="text-xs text-gray-400">
                  {(n as { createdAt?: string }).createdAt
                    ? new Date((n as { createdAt: string }).createdAt).toLocaleDateString()
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

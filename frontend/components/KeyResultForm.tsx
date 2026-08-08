'use client';

import { useState, FormEvent } from 'react';
import { api, KeyResult } from '@/lib/api';
import { FieldLabel } from '@/components/shared/FieldLabel';
import { ErrorMessage } from '@/components/shared/ErrorMessage';

interface KeyResultFormProps {
  objectiveId: string;
  keyResult?: KeyResult;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function KeyResultForm({ objectiveId, keyResult, onSuccess, onCancel }: KeyResultFormProps) {
  const [title, setTitle] = useState(keyResult?.title ?? '');
  const [target, setTarget] = useState(keyResult?.target ?? '');
  const [currentValue, setCurrentValue] = useState(keyResult?.currentValue ?? '');
  const [unit, setUnit] = useState(keyResult?.unit ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (keyResult?._id) {
        await api.updateKeyResult(keyResult._id, { title, target, currentValue, unit });
      } else {
        await api.createKeyResult({ objectiveId, title, target, currentValue, unit });
      }
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save key result');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4">
      {error && <ErrorMessage message={error} />}
      <div>
        <FieldLabel
          tooltip="A measurable outcome that indicates progress toward the objective."
          required
        >
          Key Result Title
        </FieldLabel>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel tooltip="The target value to achieve (e.g. 100%, 5 deployments).">
            Target
          </FieldLabel>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g. 100% or 5 deployments"
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <FieldLabel tooltip="Unit of measure (e.g. %, count, days).">
            Unit
          </FieldLabel>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="%, count, etc."
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div>
        <FieldLabel tooltip="Current progress toward the target; used with score for roll-up.">
          Current Value
        </FieldLabel>
        <input
          type="text"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : keyResult ? 'Update' : 'Add Key Result'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

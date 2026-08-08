'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, FileText, Sparkles, Loader2 } from 'lucide-react';
import { useFocusTrap, useRestoreFocusWhenActive } from '@/lib/useFocusTrap';

export interface PresentationChoiceDialogProps {
  open: boolean;
  onClose: () => void;
  objectiveIds: string[];
  /** Start presentation using slides only (info to tell the story). */
  onInfoOnly: () => void;
  /** Called when user has generated a story and clicks "Start presentation with story". */
  onStartWithNarrative: (story: string) => void;
  /** Call this to generate the story (dialog will call and show result). */
  generateStory: () => Promise<string>;
  disabled?: boolean;
}

export function PresentationChoiceDialog({
  open,
  onClose,
  objectiveIds,
  onInfoOnly,
  onStartWithNarrative,
  generateStory,
  disabled = false,
}: PresentationChoiceDialogProps) {
  const [step, setStep] = useState<'choice' | 'generating' | 'story'>('choice');
  const [story, setStory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useRestoreFocusWhenActive(open);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleInfoOnly = () => {
    setStep('choice');
    setStory(null);
    setError(null);
    onInfoOnly();
    onClose();
  };

  const handleGenerateClick = async () => {
    setError(null);
    setStep('generating');
    try {
      const text = await generateStory();
      setStory(text);
      setStep('story');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate story');
      setStep('choice');
    }
  };

  const handleStartWithStory = () => {
    if (story) {
      setStep('choice');
      setStory(null);
      setError(null);
      onClose();
      onStartWithNarrative(story);
    }
  };

  const handleBack = () => {
    setStep('choice');
    setStory(null);
    setError(null);
  };

  const canGenerate = objectiveIds.length > 0 && !disabled;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="presentation-choice-title"
      aria-describedby={step === 'choice' ? 'presentation-choice-desc' : undefined}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={step === 'choice' ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl text-card-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="presentation-choice-title" className="text-lg font-semibold text-foreground">
            OKR presentation
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        {step === 'choice' && (
          <>
            <p id="presentation-choice-desc" className="text-sm text-muted-foreground mb-4">
              Present from slides only, or add an AI-generated narrative that turns your OKRs into a clear, presentable story.
            </p>
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="h-auto flex-col items-start gap-2 py-3 text-left"
                onClick={handleInfoOnly}
                disabled={disabled}
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileText className="h-4 w-4" />
                  Slides only
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Present using the deck as-is: title, agenda, objectives, and key results. No narrative.
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col items-start gap-2 py-3 text-left"
                onClick={handleGenerateClick}
                disabled={!canGenerate}
              >
                <span className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-4 w-4" />
                  AI narrative
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Generate a concise narrative from your OKRs via AI—ready to read aloud or use as speaker notes.
                </span>
              </Button>
            </div>
          </>
        )}

        {step === 'generating' && (
          <div
            className="flex flex-col items-center justify-center py-8 gap-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">Generating your OKR narrative…</p>
          </div>
        )}

        {step === 'story' && story && (
          <>
            <p className="text-sm text-muted-foreground mb-3">Your professional OKR narrative:</p>
            <div
              className="max-h-64 overflow-y-auto rounded-lg border bg-muted/50 p-4 text-sm text-foreground whitespace-pre-wrap mb-4"
              tabIndex={0}
            >
              {story}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleStartWithStory}>
                Start presentation with story
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

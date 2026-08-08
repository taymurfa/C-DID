'use client';

import { AlertCircle } from 'lucide-react';

export interface ErrorMessageProps {
  message: string;
  /** Actionable steps to resolve the error */
  suggestions?: string[];
  className?: string;
}

/** Maps common error messages to resolution suggestions */
export function getErrorSuggestions(message: string): string[] {
  const lower = message.toLowerCase();
  if (lower.includes('auth') || lower.includes('401') || lower.includes('session') || lower.includes('login')) {
    return ['Sign out and sign back in to refresh your session.', 'If the problem continues, clear cookies for this site or try a different browser.'];
  }
  if (lower.includes('403') || lower.includes('forbidden') || lower.includes('permission')) {
    return ['Your account may not have access to this resource.', 'Ask an admin to assign the correct role or permissions.'];
  }
  if (lower.includes('409') || lower.includes('conflict')) {
    return ['Someone else may have updated this item. Reload the page to see the latest version, then try again.'];
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return ['Check your internet connection.', 'Ensure the backend server is running and the API URL is correct in your environment.'];
  }
  if (lower.includes('validation') || lower.includes('required') || lower.includes('invalid')) {
    return ['Review the form: ensure all required fields are filled and values are in the expected format.'];
  }
  if (lower.includes('500') || lower.includes('server error')) {
    return ['The server encountered an error. Try again in a few moments.', 'If it persists, contact your administrator or check server logs.'];
  }
  return [];
}

export function ErrorMessage({
  message,
  suggestions: propSuggestions,
  className = '',
}: ErrorMessageProps) {
  const suggestions = propSuggestions ?? getErrorSuggestions(message);

  return (
    <div
      className={`rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 ${className}`}
      role="alert"
    >
      <div className="flex gap-2">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{message}</p>
          {suggestions.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-red-700 dark:text-red-300">
              {suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

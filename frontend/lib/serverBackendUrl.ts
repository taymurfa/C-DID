/**
 * Server-side URL for the Flask API (Next route handlers, not the browser).
 * In Docker, set BACKEND_URL=http://backend:5001. Do not rely on NEXT_PUBLIC_API_URL being empty
 * (empty is falsy and would wrongly fall back to localhost:5001 inside the frontend container).
 */
export function getServerBackendUrl(): string {
  const internal = process.env.BACKEND_URL || process.env.INTERNAL_API_URL;
  if (internal && internal.trim() !== '') {
    return internal.replace(/\/$/, '');
  }
  const pub = process.env.NEXT_PUBLIC_API_URL;
  if (pub && pub.trim() !== '') {
    return pub.replace(/\/$/, '');
  }
  return 'http://127.0.0.1:5001';
}

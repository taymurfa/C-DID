import { auth0 } from './lib/auth0';

/**
 * Next 16 proxy layer.
 *
 * Do **not** rewrite `/api/*` to Flask here. A server-side rewrite makes Flask see the client as
 * 127.0.0.1 and the forwarded request does not include the browser’s **host-only session cookie**
 * for the API domain — so `/api/auth/token` stays 401 after OAuth. The browser must call Flask
 * directly (see `window.__OKR_BACKEND_ORIGIN__` in `layout.tsx` + `apiFetchUrl`).
 *
 * `/auth/*` only: Auth0 SDK. `/api/auth/*` is handled by route handlers or direct backend fetches.
 */
export async function proxy(request: Request) {
  try {
    return await auth0.middleware(request);
  } catch (error) {
    console.error('Auth0 proxy error:', error);
    return new Response(JSON.stringify({ error: 'Authentication error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  matcher: ['/auth/:path*'],
};

import { NextResponse } from 'next/server';
import { getServerBackendUrl } from '@/lib/serverBackendUrl';

/** Return JSON { auth_url } so the client can window.location.href = auth_url (browser fetch cannot follow OAuth redirect usefully). */
export async function GET() {
  try {
    const backend = getServerBackendUrl();
    const response = await fetch(`${backend}/api/auth/login`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to initiate login' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerBackendUrl } from '@/lib/serverBackendUrl';

const appOrigin = () =>
  process.env.AUTH0_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET() {
  try {
    const backend = getServerBackendUrl();
    const response = await fetch(`${backend}/api/auth/logout`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();

    if (data.logout_url) {
      return NextResponse.redirect(data.logout_url);
    }

    return NextResponse.redirect(new URL('/', appOrigin()));
  } catch {
    return NextResponse.redirect(new URL('/', appOrigin()));
  }
}

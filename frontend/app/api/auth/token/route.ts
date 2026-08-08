import { NextResponse } from 'next/server';
import { getServerBackendUrl } from '@/lib/serverBackendUrl';

export async function GET(request: Request) {
  try {
    const backend = getServerBackendUrl();
    const response = await fetch(`${backend}/api/auth/token`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get access token' },
      { status: 500 }
    );
  }
}

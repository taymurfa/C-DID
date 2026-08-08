import { NextResponse } from 'next/server';
import { getServerBackendUrl } from '@/lib/serverBackendUrl';

export async function GET(request: Request) {
  try {
    const backend = getServerBackendUrl();
    const tokenResponse = await fetch(`${backend}/api/auth/token`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
      credentials: 'include',
    });

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.accessToken;

    // Get user info from backend
    const userResponse = await fetch(`${backend}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Cookie': request.headers.get('cookie') || '',
      },
      credentials: 'include',
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to get user info' },
        { status: userResponse.status }
      );
    }

    const userData = await userResponse.json();
    return NextResponse.json(userData);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get profile' },
      { status: 500 }
    );
  }
}

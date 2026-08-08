import { Auth0Client } from '@auth0/nextjs-auth0/server';

// Extract domain from AUTH0_ISSUER_BASE_URL if it includes https://
const getDomain = () => {
  const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL || '';
  if (issuerBaseUrl.startsWith('https://')) {
    return issuerBaseUrl.replace('https://', '');
  }
  return issuerBaseUrl;
};

// Public URL of this Next app (Auth0 callbacks). On Render, RENDER_EXTERNAL_URL is set automatically.
const getBaseURL = () => {
  const baseURL =
    process.env.AUTH0_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://localhost:3000';
  if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
    return `http://${baseURL}`;
  }
  return baseURL;
};

export const auth0 = new Auth0Client({
  domain: getDomain(),
  clientId: process.env.AUTH0_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  secret: process.env.AUTH0_SECRET || '',
  appBaseUrl: getBaseURL(),
  routes: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    callback: '/api/auth/callback',
    profile: '/api/auth/profile',
    accessToken: '/api/auth/token',
    backchannelLogout: '/api/auth/backchannel-logout',
  } as Record<string, string>,
});

import { User } from '../types';

export const GOOGLE_CLIENT_ID_STORAGE_KEY = 'jarvis_google_client_id';
export const GOOGLE_USER_STORAGE_KEY = 'jarvis_user';

export function getGoogleClientId(): string {
  // Check localStorage first, then environment variable
  const stored = localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
  if (stored && stored.trim()) {
    return stored.trim();
  }
  const envKey = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (envKey && envKey.trim() && !envKey.includes('YOUR_GOOGLE_CLIENT_ID')) {
    return envKey.trim();
  }
  return '';
}

export function setGoogleClientId(clientId: string): void {
  if (clientId && clientId.trim()) {
    localStorage.setItem(GOOGLE_CLIENT_ID_STORAGE_KEY, clientId.trim());
  } else {
    localStorage.removeItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
  }
}

export function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.warn('Failed to parse JWT payload:', err);
    return null;
  }
}

export function createGoogleUserFromPayload(payload: any, rawToken?: string): User {
  const name = payload.name || `${payload.given_name || 'Google'} ${payload.family_name || 'User'}`.trim();
  const email = payload.email || 'user@gmail.com';
  const avatar = payload.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0ea5e9&color=fff`;

  return {
    name,
    email,
    avatar,
    authProvider: 'google',
    idToken: rawToken,
    googleSub: payload.sub || payload.id,
    verifiedEmail: payload.email_verified ?? true,
    authenticatedAt: new Date().toISOString(),
  };
}

export function createDemoGoogleUser(email = 'tafesetadios@gmail.com', name = 'Tafese Tadios'): User {
  const simulatedToken = `eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.${btoa(
    JSON.stringify({
      iss: 'https://accounts.google.com',
      sub: 'google-oauth2-' + Math.random().toString(36).substring(2, 10),
      email: email.trim(),
      email_verified: true,
      name: name.trim(),
      picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=0ea5e9&color=fff`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
    })
  )}.signature`;

  return {
    name: name.trim(),
    email: email.trim(),
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=0ea5e9&color=fff`,
    authProvider: 'google',
    idToken: simulatedToken,
    googleSub: 'google-sub-' + Math.random().toString(36).substring(2, 10),
    verifiedEmail: true,
    authenticatedAt: new Date().toISOString(),
  };
}

export function signOutGoogle(): void {
  try {
    if ((window as any).google?.accounts?.id?.disableAutoSelect) {
      (window as any).google.accounts.id.disableAutoSelect();
    }
  } catch (err) {
    console.debug('Google auto-select disable failed:', err);
  }
  localStorage.removeItem(GOOGLE_USER_STORAGE_KEY);
}

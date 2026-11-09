const TOKEN_KEY = 'brewlite-access-token';
const AUTH_EVENT = 'brewlite-auth-changed';

export function getAccessToken(): string | null {
  return typeof window === 'undefined'
    ? null
    : window.sessionStorage.getItem(TOKEN_KEY);
}

export function getAccessTokenSubject(token: string | null): string | null {
  if (!token) return null;
  const payloadSegment = token.split('.')[1];
  if (!payloadSegment) return null;

  try {
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    const bytes = Uint8Array.from(atob(paddedBase64), (character) =>
      character.charCodeAt(0),
    );
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'sub' in payload &&
      typeof payload.sub === 'string' &&
      payload.sub.length > 0
    ) {
      return payload.sub;
    }
  } catch (error) {
    console.error('Unable to read the access token subject for cart scoping.', error);
  }
  return null;
}

export function setAccessToken(token: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearAccessToken() {
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function subscribeToAuth(callback: () => void) {
  window.addEventListener(AUTH_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(AUTH_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

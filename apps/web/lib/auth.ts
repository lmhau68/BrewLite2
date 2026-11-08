const TOKEN_KEY = 'brewlite-access-token';
const AUTH_EVENT = 'brewlite-auth-changed';

export function getAccessToken(): string | null {
  return typeof window === 'undefined'
    ? null
    : window.sessionStorage.getItem(TOKEN_KEY);
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

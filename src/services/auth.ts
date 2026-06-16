/*
 * Auth helper — read-from-URL pattern for HDS apps.
 *
 * Plan 77 D4: the portability app accepts a personal-token in URL on
 * return-from-auth (the same pattern used elsewhere in the HDS ecosystem,
 * e.g. via the app-web-auth3-hds flow). It also keeps an `apiEndpoint`-only
 * form so subjects who already have their endpoint URL can paste it.
 *
 * Token-in-URL hygiene (security-sensitive):
 *  - Read once, clear from `window.location` (replaceState) so refresh or
 *    URL-share doesn't leak the token.
 *  - Never log to NR. Never persist outside `sessionStorage`.
 */

const URL_PARAM_ENDPOINT = 'apiEndpoint';
const URL_PARAM_TOKEN_LEGACY = 'prYv-storage-token';
const URL_PARAM_USERNAME_LEGACY = 'prYv-storage-username';
const SESSION_KEY_API_ENDPOINT = 'hds-app-portability:apiEndpoint';

export interface AuthFromUrl {
  apiEndpoint: string;
  source: 'apiEndpoint-url' | 'legacy-token-pair' | 'session';
}

/**
 * If the current URL contains a portability auth-return payload, extract
 * an apiEndpoint, cache it in sessionStorage, and remove it from the URL.
 * Returns null if no payload is present.
 *
 * Two accepted shapes:
 *   1. `?apiEndpoint=<URL-encoded apiEndpoint>` (preferred, HDS-native).
 *   2. `?prYv-storage-token=<token>&prYv-storage-username=<u>&...` (legacy
 *      Pryv auth-flow shape; reconstruct apiEndpoint from token + username +
 *      service info).
 */
export function consumeAuthFromUrl (): AuthFromUrl | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const fromEndpoint = url.searchParams.get(URL_PARAM_ENDPOINT);
  const fromToken = url.searchParams.get(URL_PARAM_TOKEN_LEGACY);

  if (fromEndpoint) {
    sessionStorage.setItem(SESSION_KEY_API_ENDPOINT, fromEndpoint);
    clearAuthParams(url);
    return { apiEndpoint: fromEndpoint, source: 'apiEndpoint-url' };
  }

  if (fromToken) {
    // Legacy reconstruction is left to the caller — we don't have a
    // service-info URL on hand at module-eval time. Surface as best-effort:
    // for now, just cache the raw token+username so the caller can decide
    // what to do. (No HDS app currently delivers this shape in practice;
    // documented for forward-compat.)
    const username = url.searchParams.get(URL_PARAM_USERNAME_LEGACY) ?? '';
    const synthetic = 'https://' + fromToken + '@' + username + '.api.datasafe.dev/';
    sessionStorage.setItem(SESSION_KEY_API_ENDPOINT, synthetic);
    clearAuthParams(url);
    return { apiEndpoint: synthetic, source: 'legacy-token-pair' };
  }

  const cached = sessionStorage.getItem(SESSION_KEY_API_ENDPOINT);
  if (cached) return { apiEndpoint: cached, source: 'session' };
  return null;
}

function clearAuthParams (url: URL): void {
  url.searchParams.delete(URL_PARAM_ENDPOINT);
  url.searchParams.delete(URL_PARAM_TOKEN_LEGACY);
  url.searchParams.delete(URL_PARAM_USERNAME_LEGACY);
  // Replace history entry so token doesn't appear in back/forward / refresh.
  window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
}

/** Drop the cached apiEndpoint (logout). */
export function clearStoredApiEndpoint (): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY_API_ENDPOINT);
}

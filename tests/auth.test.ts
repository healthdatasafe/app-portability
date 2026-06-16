import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { consumeAuthFromUrl, clearStoredApiEndpoint } from '../src/services/auth';

const ENDPOINT = 'https://token@user.api.example/';

function setUrl (search: string) {
  window.history.replaceState({}, '', '/' + (search ? '?' + search : ''));
}

describe('consumeAuthFromUrl', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setUrl('');
  });
  afterEach(() => {
    setUrl('');
  });

  it('returns null when no params and no cached session', () => {
    expect(consumeAuthFromUrl()).toBeNull();
  });

  it('reads ?apiEndpoint=... from URL, caches in session, scrubs URL', () => {
    setUrl('apiEndpoint=' + encodeURIComponent(ENDPOINT));
    const r = consumeAuthFromUrl();
    expect(r).toEqual({ apiEndpoint: ENDPOINT, source: 'apiEndpoint-url' });
    expect(window.location.search).toBe('');
    expect(sessionStorage.getItem('hds-app-portability:apiEndpoint')).toBe(ENDPOINT);
  });

  it('falls back to legacy ?prYv-storage-token=...&prYv-storage-username=...', () => {
    setUrl('prYv-storage-token=tok&prYv-storage-username=alice');
    const r = consumeAuthFromUrl();
    expect(r?.source).toBe('legacy-token-pair');
    expect(r?.apiEndpoint).toContain('tok@alice.');
    expect(window.location.search).toBe('');
  });

  it('returns session-cached value on subsequent calls', () => {
    setUrl('apiEndpoint=' + encodeURIComponent(ENDPOINT));
    consumeAuthFromUrl(); // first call caches
    setUrl(''); // URL no longer has the param
    const r = consumeAuthFromUrl();
    expect(r).toEqual({ apiEndpoint: ENDPOINT, source: 'session' });
  });

  it('clearStoredApiEndpoint drops the session cache', () => {
    sessionStorage.setItem('hds-app-portability:apiEndpoint', ENDPOINT);
    clearStoredApiEndpoint();
    expect(consumeAuthFromUrl()).toBeNull();
  });
});

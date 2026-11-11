import { describe, it, expect } from 'vitest';
import { SERVICE_INFO_URL, handOffServiceInfoUrl, overrideServiceInfoUrl, parseBackTo } from '../src/lib/handOff';

const q = (params: Record<string, string>) => '?' + new URLSearchParams(params).toString();

describe('handOffServiceInfoUrl (B-2026-10-28-11)', () => {
  it('takes an HDS platform the account app hands over, trailing slash or not', () => {
    expect(handOffServiceInfoUrl(q({ pryvServiceInfoUrl: SERVICE_INFO_URL.prod }))).toBe(SERVICE_INFO_URL.prod);
    expect(handOffServiceInfoUrl(q({ pryvServiceInfoUrl: SERVICE_INFO_URL.dev + '/' }))).toBe(SERVICE_INFO_URL.dev);
  });

  it('ignores any other platform, so a link cannot send the password elsewhere', () => {
    expect(handOffServiceInfoUrl(q({ pryvServiceInfoUrl: 'https://evil.example/reg/service/info' }))).toBeNull();
    expect(handOffServiceInfoUrl(q({ pryvServiceInfoUrl: 'not a url' }))).toBeNull();
    expect(handOffServiceInfoUrl('')).toBeNull();
  });
});

describe('overrideServiceInfoUrl (B-2026-11-11-2)', () => {
  const evil = q({ serviceInfoUrl: 'https://evil.example/reg/service/info' });

  it('on a deployed page: an HDS platform only, so a link cannot send the password elsewhere', () => {
    expect(overrideServiceInfoUrl(evil, 'portability.hds.ngo')).toBeNull();
    expect(overrideServiceInfoUrl(evil, 'demo-portability.datasafe.dev')).toBeNull();
    expect(overrideServiceInfoUrl(q({ serviceInfoUrl: SERVICE_INFO_URL.dev }), 'portability.hds.ngo')).toBe(SERVICE_INFO_URL.dev);
  });

  it('on a local dev host: any http(s) platform, for testing', () => {
    expect(overrideServiceInfoUrl(evil, 'app-portability.backloop.dev')).toBe('https://evil.example/reg/service/info');
    expect(overrideServiceInfoUrl(q({ serviceInfoUrl: 'javascript:alert(1)' }), 'app-portability.backloop.dev')).toBeNull();
  });

  it('nothing without the parameter', () => {
    expect(overrideServiceInfoUrl('', 'app-portability.backloop.dev')).toBeNull();
    expect(overrideServiceInfoUrl(q({ serviceInfoUrl: '' }), 'portability.hds.ngo')).toBeNull();
  });
});

describe('parseBackTo (B-2026-10-28-11)', () => {
  it('reads the way back with its label and host', () => {
    expect(parseBackTo(q({ backUrl: 'https://account.hds.ngo/account/data?x=1', backLabel: ' Account ' }))).toEqual({
      url: 'https://account.hds.ngo/account/data?x=1', label: 'Account', host: 'account.hds.ngo'
    });
  });

  it('http(s) only, and nothing without a backUrl', () => {
    expect(parseBackTo(q({ backUrl: 'javascript:alert(1)', backLabel: 'x' }))).toBeNull();
    expect(parseBackTo(q({ backUrl: 'data:text/html,hi' }))).toBeNull();
    expect(parseBackTo(q({ backLabel: 'Account' }))).toBeNull();
  });

  it('no label: the host stands in', () => {
    expect(parseBackTo(q({ backUrl: 'https://account.hds.ngo/' }))).toMatchObject({ label: null, host: 'account.hds.ngo' });
  });
});

/**
 * What the account app hands over when it opens this app (app-web-user-account `DataRights.tsx` `exportUrl`):
 * `pryvServiceInfoUrl` (the platform the person is signed in to), `backUrl` and `backLabel` (a way back).
 *
 * A link to this page can come from anywhere, and the platform decides where the password is sent, so the
 * hand-off platform is taken only when it is one of the HDS platforms; anything else is ignored and the
 * deployment's own platform stays. `backUrl` is http(s) only, and its host is shown next to the label so a
 * link to an unexpected site is visible as such. It never carries a token.
 */

/** HDS service-info URLs, as in `dev-deploy/config/apps.yml` `serviceInfoURL` */
export const SERVICE_INFO_URL = {
  dev: 'https://demo.datasafe.dev/reg/service/info',
  prod: 'https://reg.api.datasafe.dev/service/info'
} as const;

function normalized (raw: string): string | null {
  try {
    return new URL(raw).href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function knownPlatform (raw: string | null): string | null {
  if (raw == null) return null;
  const wanted = normalized(raw);
  return Object.values(SERVICE_INFO_URL).find(known => normalized(known) === wanted) ?? null;
}

/** The hand-off platform when it is one of the HDS platforms, else null */
export function handOffServiceInfoUrl (search: string): string | null {
  return knownPlatform(new URLSearchParams(search).get('pryvServiceInfoUrl'));
}

/**
 * The `?serviceInfoUrl=` override (testing another platform): one of the HDS platforms, or any http(s) URL when
 * this page runs on a local dev host (`*.backloop.dev`). On a deployed page a link could otherwise send the password
 * typed here to any server (B-2026-11-11-2).
 */
export function overrideServiceInfoUrl (search: string, hostname: string): string | null {
  const raw = new URLSearchParams(search).get('serviceInfoUrl');
  if (raw == null || raw === '') return null;
  if (hostname === 'backloop.dev' || hostname.endsWith('.backloop.dev')) {
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
      return null;
    }
  }
  return knownPlatform(raw);
}

export interface BackTo {
  url: string;
  label: string | null;
  /** host of `url`, shown next to the label */
  host: string;
}

/** The way back the opener handed over (http(s) only), or null */
export function parseBackTo (search: string): BackTo | null {
  const params = new URLSearchParams(search);
  const raw = params.get('backUrl');
  if (raw == null) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return { url: url.href, label: params.get('backLabel')?.trim() || null, host: url.host };
}

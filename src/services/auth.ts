/*
 * Email-or-username resolver — mirrors hds-webapp's AuthContext.login.
 *
 * Pryv's API accepts usernames only. To let subjects sign in with the
 * email they remember, we look the email up against the registration host
 * (`<register>/<email>/uid`) and call the standard `service.login()` with
 * the returned uid.
 *
 * Returns the input unchanged when it's not an email. Throws
 * `UNKNOWN_EMAIL` if no account is registered with the given email.
 */

import * as pryv from 'pryv';

interface PryvServiceInfo {
  register?: string;
  [k: string]: unknown;
}

export async function resolveUsernameFromEmail (
  serviceInfoUrl: string,
  identifier: string
): Promise<string> {
  const trimmed = identifier.trim().toLowerCase();
  if (!trimmed.includes('@')) return trimmed;

  const service = new (pryv as any).Service(serviceInfoUrl);
  const serviceInfo = (await service.info()) as PryvServiceInfo;
  if (typeof serviceInfo.register !== 'string') {
    throw new Error('UNKNOWN_EMAIL');
  }

  const lookupUrl = `${serviceInfo.register}${encodeURIComponent(trimmed)}/uid`;
  const res = await fetch(lookupUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('UNKNOWN_EMAIL');
  const body = await res.json() as { uid?: string };
  if (!body.uid) throw new Error('UNKNOWN_EMAIL');
  return body.uid;
}

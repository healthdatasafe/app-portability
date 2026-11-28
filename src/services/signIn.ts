/*
 * Password sign-in with the multi-factor (MFA) step — adapted from
 * pryv/pryv-account-backup-webapp v0.3.0 src/app.js signIn() / verifyMfaCode()
 * (BSD-3-Clause).
 *
 * `Service.login` throws `MfaRequiredError` for an account with MFA active
 * (pryv 3.20+; `method`: 'totp' = authenticator app, 'sms' = code sent by SMS
 * at login; absent on older cores, which only offered SMS). The login form then
 * asks for the code and `Service.mfaVerify` completes the sign-in. Recovery
 * codes are not a sign-in path (on the platform they turn MFA off). The MFA
 * token and the code are never logged.
 */

import * as pryv from 'pryv';
import { isMfaRequired } from 'pryv-account-backup/src/lib/signInWithMfa.js';
import { resolveUsernameFromEmail } from './auth';
import type { PryvConnection } from './backupRunner';

export const APP_ID = 'hds-app-portability';
export const MAX_MFA_ATTEMPTS = 3;

export type MfaKind = 'totp' | 'sms' | 'other';

export interface PendingMfa {
  service: any;
  username: string;
  mfaToken: string;
  method?: string;
  attempts: number;
}

export type SignInResult =
  | { kind: 'connected'; connection: PryvConnection }
  | { kind: 'mfa'; mfa: PendingMfa };

/** The code was not checked or not accepted: `restart` drops the MFA step (sign in again). */
export type MfaVerifyResult =
  | { kind: 'connected'; connection: PryvConnection }
  | { kind: 'retry'; message: string }
  | { kind: 'restart'; message: string };

/** 'totp', 'sms' (also when the core sends no method), or 'other'. */
export function mfaKind (method?: string): MfaKind {
  if (method === 'totp') return 'totp';
  if (method === 'sms' || method == null) return 'sms';
  return 'other';
}

function checkConnection (connection: any): PryvConnection {
  if (!connection || !connection.endpoint || !connection.token) {
    throw new Error('Login failed: the platform returned no access.');
  }
  return connection;
}

/** Signs in with a password; an account with MFA active resolves with the pending step. */
export async function signIn (serviceInfoUrl: string, identifier: string, password: string): Promise<SignInResult> {
  if (!serviceInfoUrl || !identifier || !password) {
    throw new Error('serviceInfoUrl, username (or email), and password are required.');
  }
  // Email → username via the registration host (no-op for a bare username).
  const username = await resolveUsernameFromEmail(serviceInfoUrl, identifier);
  const service = new (pryv as any).Service(serviceInfoUrl);
  await service.info();
  try {
    return { kind: 'connected', connection: checkConnection(await service.login(username, password, APP_ID)) };
  } catch (err) {
    if (!isMfaRequired(err)) throw err;
    const e = err as { mfaToken: string; method?: string };
    return { kind: 'mfa', mfa: { service, username, mfaToken: e.mfaToken, method: e.method, attempts: 0 } };
  }
}

/** Checks the code typed for `mfa`; throws only on an unexpected error. */
export async function verifyMfaCode (mfa: PendingMfa, rawCode: string): Promise<MfaVerifyResult> {
  const code = rawCode.trim();
  if (code === '') return { kind: 'retry', message: 'Enter the code.' };
  let connection;
  try {
    connection = await mfa.service.mfaVerify(mfa.username, mfa.mfaToken, code);
  } catch (err) {
    const id = (err as { id?: string })?.id;
    const message = (err as Error)?.message || String(err);
    if (id === 'invalid-mfa-code') {
      mfa.attempts++;
      if (mfa.attempts >= MAX_MFA_ATTEMPTS) {
        return { kind: 'restart', message: 'The code was not accepted ' + MAX_MFA_ATTEMPTS + ' times. Sign in again.' };
      }
      return { kind: 'retry', message: 'Code not accepted (' + message + '). Try again.' };
    }
    // The platform ended this sign-in (expired, or too many attempts).
    if (id === 'invalid-access-token') return { kind: 'restart', message: 'Your sign-in expired. Sign in again.' };
    // Network failure or a temporary refusal: the step stays usable.
    if (!id || id === 'too-many-attempts') {
      return { kind: 'retry', message: 'The code could not be checked (' + message + '). Try again in a moment.' };
    }
    throw err;
  }
  return { kind: 'connected', connection: checkConnection(connection) };
}

/** Asks the platform to send a new SMS code (at most one per 30 seconds). */
export async function resendMfaCode (mfa: PendingMfa): Promise<void> {
  await mfa.service.mfaChallenge(mfa.username, mfa.mfaToken);
}

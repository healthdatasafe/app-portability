import { describe, it, expect, vi, beforeEach } from 'vitest';

const fake = vi.hoisted(() => ({
  login: vi.fn(),
  mfaVerify: vi.fn(),
  mfaChallenge: vi.fn()
}));

vi.mock('pryv', () => ({
  Service: class {
    info = async () => ({ register: 'https://reg.example/' });
    login = fake.login;
    mfaVerify = fake.mfaVerify;
    mfaChallenge = fake.mfaChallenge;
  }
}));

const { signIn, verifyMfaCode, resendMfaCode, mfaKind, MAX_MFA_ATTEMPTS } = await import('../src/services/signIn');

const SERVICE_URL = 'https://reg.example/service/info';
const connection = { endpoint: 'https://u.example/', apiEndpoint: 'https://tok@u.example/', token: 'tok' };

function mfaRequired (method?: string) {
  const err = new Error('MFA required') as Error & { mfaToken: string; method?: string };
  err.name = 'MfaRequiredError';
  err.mfaToken = 'mfa-token';
  err.method = method;
  return err;
}

function apiError (id: string | undefined, message = 'nope') {
  return Object.assign(new Error(message), { id });
}

async function pendingStep (method?: string) {
  fake.login.mockRejectedValueOnce(mfaRequired(method));
  const res = await signIn(SERVICE_URL, 'alice', 'pw');
  if (res.kind !== 'mfa') throw new Error('expected the MFA step');
  return res.mfa;
}

describe('signIn (pryv-account-backup 0.10.0 MFA flow)', () => {
  beforeEach(() => {
    fake.login.mockReset();
    fake.mfaVerify.mockReset();
    fake.mfaChallenge.mockReset();
  });

  it('an account without MFA signs in at once', async () => {
    fake.login.mockResolvedValueOnce(connection);
    await expect(signIn(SERVICE_URL, 'Alice', 'pw')).resolves.toEqual({ kind: 'connected', connection });
    expect(fake.login).toHaveBeenCalledWith('alice', 'pw', 'hds-app-portability');
  });

  it('requires all the fields', async () => {
    await expect(signIn(SERVICE_URL, 'alice', '')).rejects.toThrow(/required/);
  });

  it('a wrong password is thrown as is', async () => {
    fake.login.mockRejectedValueOnce(apiError('invalid-credentials'));
    await expect(signIn(SERVICE_URL, 'alice', 'bad')).rejects.toMatchObject({ id: 'invalid-credentials' });
  });

  it('a login answer without a token is refused', async () => {
    fake.login.mockResolvedValueOnce({ endpoint: 'https://u.example/' });
    await expect(signIn(SERVICE_URL, 'alice', 'pw')).rejects.toThrow(/no access/);
  });

  it('an account with MFA resolves with the pending step and its method', async () => {
    const mfa = await pendingStep('totp');
    expect(mfa).toMatchObject({ username: 'alice', mfaToken: 'mfa-token', method: 'totp', attempts: 0 });
  });

  it('the right code completes the sign-in', async () => {
    const mfa = await pendingStep('sms');
    fake.mfaVerify.mockResolvedValueOnce(connection);
    await expect(verifyMfaCode(mfa, ' 123456 ')).resolves.toEqual({ kind: 'connected', connection });
    expect(fake.mfaVerify).toHaveBeenCalledWith('alice', 'mfa-token', '123456');
  });

  it('an empty code is not sent', async () => {
    const mfa = await pendingStep();
    await expect(verifyMfaCode(mfa, '  ')).resolves.toMatchObject({ kind: 'retry' });
    expect(fake.mfaVerify).not.toHaveBeenCalled();
  });

  it('a wrong code can be retyped, ' + MAX_MFA_ATTEMPTS + ' attempts in all', async () => {
    const mfa = await pendingStep();
    fake.mfaVerify.mockRejectedValue(apiError('invalid-mfa-code', 'Invalid code'));
    for (let i = 1; i < MAX_MFA_ATTEMPTS; i++) {
      await expect(verifyMfaCode(mfa, '000000')).resolves.toMatchObject({ kind: 'retry', message: expect.stringContaining('Invalid code') });
    }
    await expect(verifyMfaCode(mfa, '000000')).resolves.toMatchObject({ kind: 'restart', message: expect.stringContaining('Sign in again') });
  });

  it('an expired sign-in goes back to the password step', async () => {
    const mfa = await pendingStep();
    fake.mfaVerify.mockRejectedValueOnce(apiError('invalid-access-token'));
    await expect(verifyMfaCode(mfa, '123456')).resolves.toMatchObject({ kind: 'restart', message: expect.stringContaining('expired') });
  });

  it('a network failure or a rate limit keeps the step open', async () => {
    const mfa = await pendingStep();
    fake.mfaVerify.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(verifyMfaCode(mfa, '123456')).resolves.toMatchObject({ kind: 'retry' });
    fake.mfaVerify.mockRejectedValueOnce(apiError('too-many-attempts'));
    await expect(verifyMfaCode(mfa, '123456')).resolves.toMatchObject({ kind: 'retry' });
    expect(mfa.attempts).toBe(0);
  });

  it('any other error is thrown', async () => {
    const mfa = await pendingStep();
    fake.mfaVerify.mockRejectedValueOnce(apiError('unexpected-error'));
    await expect(verifyMfaCode(mfa, '123456')).rejects.toMatchObject({ id: 'unexpected-error' });
  });

  it('a new SMS code is asked with the MFA token', async () => {
    const mfa = await pendingStep('sms');
    fake.mfaChallenge.mockResolvedValueOnce(undefined);
    await resendMfaCode(mfa);
    expect(fake.mfaChallenge).toHaveBeenCalledWith('alice', 'mfa-token');
  });

  it('mfaKind: totp, sms (also without a method), other', () => {
    expect(mfaKind('totp')).toBe('totp');
    expect(mfaKind('sms')).toBe('sms');
    expect(mfaKind(undefined)).toBe('sms');
    expect(mfaKind('webauthn')).toBe('other');
  });
});

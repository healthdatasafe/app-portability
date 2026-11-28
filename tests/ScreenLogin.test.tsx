import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const svc = vi.hoisted(() => ({
  signIn: vi.fn(),
  verifyMfaCode: vi.fn(),
  resendMfaCode: vi.fn()
}));

vi.mock('../src/services/signIn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/signIn')>()),
  ...svc
}));

const { ScreenLogin } = await import('../src/components/ScreenLogin');

const connection = { endpoint: 'https://u.example/', apiEndpoint: 'https://tok@u.example/', token: 'tok' };
const pending = { service: {}, username: 'alice', mfaToken: 't', method: 'sms', attempts: 0 };

function setup () {
  const onSubmit = vi.fn();
  const onError = vi.fn();
  render(<ScreenLogin serviceInfoUrl='https://reg.example/service/info' onSubmit={onSubmit} onError={onError} />);
  fireEvent.change(screen.getByLabelText(/Email or username/), { target: { value: 'alice' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
  return { onSubmit, onError };
}

describe('ScreenLogin sign-in', () => {
  beforeEach(() => {
    svc.signIn.mockReset();
    svc.verifyMfaCode.mockReset();
    svc.resendMfaCode.mockReset();
  });

  it('without MFA, starts the backup with the connection', async () => {
    svc.signIn.mockResolvedValueOnce({ kind: 'connected', connection });
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start backup' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(svc.signIn).toHaveBeenCalledWith('https://reg.example/service/info', 'alice', 'pw');
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ connection, zipSizeMb: 100 });
  });

  it('a sign-in failure goes to onError', async () => {
    svc.signIn.mockRejectedValueOnce(new Error('Invalid credentials'));
    const { onSubmit, onError } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start backup' }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('with MFA, asks for the code, shows a wrong code inline, then starts the backup', async () => {
    svc.signIn.mockResolvedValueOnce({ kind: 'mfa', mfa: pending });
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start backup' }));
    const code = await screen.findByLabelText('Code sent by SMS');
    expect(screen.getByLabelText('Password')).toHaveAttribute('readonly');
    expect(screen.getByText(/Recovery codes are not accepted/)).toBeInTheDocument();

    svc.verifyMfaCode.mockResolvedValueOnce({ kind: 'retry', message: 'Code not accepted (Invalid code). Try again.' });
    fireEvent.change(code, { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code and start backup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Code not accepted');
    expect(svc.verifyMfaCode).toHaveBeenLastCalledWith(pending, '000000');

    svc.verifyMfaCode.mockResolvedValueOnce({ kind: 'connected', connection });
    fireEvent.change(screen.getByLabelText('Code sent by SMS'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code and start backup' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ connection });
  });

  it('an authenticator-app account gets no resend button', async () => {
    svc.signIn.mockResolvedValueOnce({ kind: 'mfa', mfa: { ...pending, method: 'totp' } });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start backup' }));
    await screen.findByLabelText('Code from your authenticator app');
    expect(screen.queryByRole('button', { name: 'Send a new code' })).toBeNull();
  });

  it('an SMS account can ask for a new code', async () => {
    svc.signIn.mockResolvedValueOnce({ kind: 'mfa', mfa: pending });
    svc.resendMfaCode.mockResolvedValueOnce(undefined);
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start backup' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Send a new code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A new code was sent by SMS.');
    expect(svc.resendMfaCode).toHaveBeenCalledWith(pending);
  });

  it('restart and cancel go back to the password step', async () => {
    svc.signIn.mockResolvedValueOnce({ kind: 'mfa', mfa: pending });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start backup' }));
    await screen.findByLabelText('Code sent by SMS');
    svc.verifyMfaCode.mockResolvedValueOnce({ kind: 'restart', message: 'Your sign-in expired. Sign in again.' });
    fireEvent.change(screen.getByLabelText('Code sent by SMS'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code and start backup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('expired');
    expect(screen.queryByLabelText('Code sent by SMS')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start backup' })).toBeInTheDocument();

    svc.signIn.mockResolvedValueOnce({ kind: 'mfa', mfa: pending });
    fireEvent.click(screen.getByRole('button', { name: 'Start backup' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Code sent by SMS')).toBeNull();
  });
});

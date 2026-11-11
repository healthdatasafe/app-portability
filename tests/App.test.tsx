import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('renders the page heading', () => {
    render(<App />);
    expect(screen.getByText('Download all my data', { selector: 'h1' })).toBeInTheDocument();
  });

  it('lists the legal frameworks the app implements', () => {
    render(<App />);
    expect(screen.getByText(/GDPR Art\. 15 \/ 20/)).toBeInTheDocument();
    expect(screen.getByText(/HIPAA §164\.524/)).toBeInTheDocument();
    expect(screen.getByText(/Swiss nLPD Art\. 25/)).toBeInTheDocument();
  });

  it('offers the way back the account app handed over, with its host (B-2026-10-28-11)', () => {
    window.history.replaceState({}, '', '/?' + new URLSearchParams({ backUrl: 'https://account.hds.ngo/account/data', backLabel: 'Account' }).toString());
    render(<App />);
    const back = screen.getByRole('link', { name: /Back to Account/ });
    expect(back).toHaveAttribute('href', 'https://account.hds.ngo/account/data');
    expect(back).toHaveTextContent('(account.hds.ngo)');
  });

  it('no way back without a backUrl', () => {
    render(<App />);
    expect(screen.queryByRole('link', { name: /Back to/ })).toBeNull();
  });

  it('renders the login form by default', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Start backup' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Email or username/i })).toBeInTheDocument();
  });
});

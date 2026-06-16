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
    expect(screen.getByText('HDS — Download all my data', { selector: 'h1' })).toBeInTheDocument();
  });

  it('lists the legal frameworks the app implements', () => {
    render(<App />);
    expect(screen.getByText(/GDPR Art\. 15 \/ 20/)).toBeInTheDocument();
    expect(screen.getByText(/HIPAA §164\.524/)).toBeInTheDocument();
    expect(screen.getByText(/Swiss nLPD Art\. 25/)).toBeInTheDocument();
  });

  it('renders the login form by default (no URL params, no session cache)', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Start backup' })).toBeInTheDocument();
    // The text-input named "Username" — disambiguates from the "Username + password" radio
    expect(screen.getByRole('textbox', { name: /^Username$/i })).toBeInTheDocument();
  });

  it('preselects the apiEndpoint auth mode when arriving with ?apiEndpoint=...', () => {
    const endpoint = 'https://tok@alice.api.example/';
    window.history.replaceState({}, '', '/?apiEndpoint=' + encodeURIComponent(endpoint));
    render(<App />);
    const radio = screen.getByLabelText('API endpoint URL') as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });
});

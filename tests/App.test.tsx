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

  it('renders the login form by default', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Start backup' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Email or username/i })).toBeInTheDocument();
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Settings } from './Settings';
import { LAST_BACKUP_KEY } from '../App';

const NOOP = () => {};
const SETTINGS = { theme: 'dark' as const, highContrast: false, largeText: false };

const renderSettings = () =>
  render(
    <Settings
      settings={SETTINGS}
      onUpdateSettings={NOOP}
      onBack={NOOP}
      onOpenTerms={NOOP}
    />,
  );

describe('Settings backup prominence', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('warns when no backup has ever been taken', () => {
    renderSettings();
    expect(screen.getByText(/never backed up/i)).toBeTruthy();
    expect(screen.getByText(/cannot be recovered/i)).toBeTruthy();
  });

  it('warns when the last backup is older than 30 days', () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(LAST_BACKUP_KEY, old);
    renderSettings();
    expect(screen.getByText(/cannot be recovered/i)).toBeTruthy();
  });

  it('shows no warning after a recent backup', () => {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
    renderSettings();
    expect(screen.queryByText(/cannot be recovered/i)).toBeNull();
    expect(screen.getByText(/last backup/i)).toBeTruthy();
  });
});

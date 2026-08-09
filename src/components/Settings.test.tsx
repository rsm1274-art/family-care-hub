import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Settings } from './Settings';

const NOOP = () => {};
const SETTINGS = { theme: 'dark' as const, highContrast: false, largeText: false };

const renderSettings = (lastBackup: string | null) =>
  render(
    <Settings
      settings={SETTINGS}
      onUpdateSettings={NOOP}
      onBack={NOOP}
      onOpenTerms={NOOP}
      lastBackup={lastBackup}
    />,
  );

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe('Settings backup prominence', () => {
  afterEach(cleanup);

  it('warns when no backup has ever been taken', () => {
    renderSettings(null);
    expect(screen.getByText(/never backed up/i)).toBeTruthy();
    expect(screen.getByText(/cannot be recovered/i)).toBeTruthy();
  });

  it('warns when the last backup is older than 30 days', () => {
    renderSettings(daysAgo(31));
    expect(screen.getByText(/cannot be recovered/i)).toBeTruthy();
  });

  it('shows no warning after a recent backup', () => {
    renderSettings(daysAgo(1));
    expect(screen.queryByText(/cannot be recovered/i)).toBeNull();
    expect(screen.getByText(/last backup/i)).toBeTruthy();
  });
});

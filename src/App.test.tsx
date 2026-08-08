import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import App from './App';
import { cryptoService } from './services/cryptoService';
import { isEncrypted, saveSecure } from './services/secureStorage';
import { seedV1Vault } from './services/testSupport';
import type { Person } from './types';

const STORAGE_KEY_PEOPLE = 'fch_secure_people';
const PIN = '123456';

const ADA: Person = {
  id: '1',
  name: 'Ada Lovelace',
  dob: '1815-12-10',
  bloodType: 'O+',
  insuranceProvider: 'Acme',
  policyNumber: 'P-1',
  medicalConditions: 'none',
  allergies: 'penicillin',
  primaryPhysician: 'Dr Babbage',
  physicianContact: '555-0100',
};

// happy-dom does not implement window.alert, so there is nothing to spy on --
// define it outright.
const alertMock = vi.fn();

const enterPin = (pin: string) => {
  for (const digit of pin) {
    fireEvent.click(screen.getByRole('button', { name: digit }));
  }
};

describe('App data-at-rest wiring', () => {
  beforeEach(async () => {
    localStorage.clear();
    cryptoService.lock();
    // Establish a PIN, then lock so the UI starts at the unlock prompt.
    await cryptoService.setupPin(PIN);
    cryptoService.lock();
    alertMock.mockClear();
    window.alert = alertMock;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('migrates pre-encryption plaintext records on first unlock', async () => {
    localStorage.setItem(STORAGE_KEY_PEOPLE, JSON.stringify([ADA]));
    expect(isEncrypted(localStorage.getItem(STORAGE_KEY_PEOPLE)!)).toBe(false);

    render(<App />);
    enterPin(PIN);

    // Records decrypt and reach the dashboard...
    await waitFor(() => expect(screen.getByText(/Ada Lovelace/)).toBeTruthy(), {
      timeout: 5000,
    });

    // ...and the save effect seals them on the way through.
    await waitFor(() => {
      const raw = localStorage.getItem(STORAGE_KEY_PEOPLE)!;
      expect(isEncrypted(raw)).toBe(true);
      expect(raw).not.toContain('penicillin');
    }, { timeout: 5000 });
  });

  it('keeps records encrypted across a normal unlock', async () => {
    await cryptoService.setupPin(PIN);
    await saveSecure(STORAGE_KEY_PEOPLE, [ADA]);
    cryptoService.lock();

    render(<App />);
    enterPin(PIN);

    await waitFor(() => expect(screen.getByText(/Ada Lovelace/)).toBeTruthy(), {
      timeout: 5000,
    });
    expect(isEncrypted(localStorage.getItem(STORAGE_KEY_PEOPLE)!)).toBe(true);
  });

  // The regression this whole design exists to prevent: a failed decrypt must
  // not land on an empty dashboard, because the save effect would then write
  // those empty lists straight over the user's real medical records.
  it('does not overwrite records it failed to decrypt', async () => {
    await cryptoService.setupPin(PIN);
    await saveSecure(STORAGE_KEY_PEOPLE, [ADA]);

    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY_PEOPLE)!);
    const bytes = atob(envelope.data).split('');
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 0xff);
    envelope.data = btoa(bytes.join(''));
    const corrupted = JSON.stringify(envelope);
    localStorage.setItem(STORAGE_KEY_PEOPLE, corrupted);
    cryptoService.lock();

    render(<App />);
    enterPin(PIN);

    await waitFor(() => expect(alertMock).toHaveBeenCalled(), { timeout: 5000 });

    // Still locked, and the ciphertext on disk is byte-for-byte untouched.
    expect(screen.queryByText(/Ada Lovelace/)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY_PEOPLE)).toBe(corrupted);
  });
});

describe('App recovery wiring', () => {
  beforeEach(() => {
    localStorage.clear();
    cryptoService.lock();
    alertMock.mockClear();
    window.alert = alertMock;
  });
  afterEach(cleanup);

  it('shows the recovery code after first-time setup', async () => {
    render(<App />);
    enterPin(PIN); // create
    await waitFor(() => expect(screen.getByText(/confirm|re-enter/i)).toBeTruthy(), {
      timeout: 10000,
    }).catch(() => {}); // heading wording is not the assertion
    enterPin(PIN); // confirm

    await waitFor(() => expect(screen.getByText(/save your recovery code/i)).toBeTruthy(), {
      timeout: 15000,
    });
    expect(screen.getByText(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){7}$/)).toBeTruthy();
  }, 30000);

  // The Phase 1 regression this task exists to close: a v1 user could see the
  // unlock screen but never actually get in, because unlock() reads a v2 vault.
  it('lets a v1 user in with their existing PIN', async () => {
    await seedV1Vault(PIN, { [STORAGE_KEY_PEOPLE]: [ADA] });

    render(<App />);
    enterPin(PIN);

    await waitFor(() => expect(screen.getByText(/save your recovery code/i)).toBeTruthy(), {
      timeout: 15000,
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_PEOPLE)!).v).toBe(2);
  }, 30000);

  it('rejects a wrong PIN on a v1 vault without destroying data', async () => {
    await seedV1Vault(PIN, { [STORAGE_KEY_PEOPLE]: [ADA] });
    const before = localStorage.getItem(STORAGE_KEY_PEOPLE);

    render(<App />);
    enterPin('999999');

    await waitFor(() => expect(screen.getByText(/invalid pin/i)).toBeTruthy(), {
      timeout: 15000,
    });
    expect(localStorage.getItem(STORAGE_KEY_PEOPLE)).toBe(before);
  }, 30000);

  it('offers a forgot-PIN route to recovery', async () => {
    await cryptoService.setupPin(PIN);
    cryptoService.lock();

    render(<App />);
    fireEvent.click(screen.getByText(/forgot your pin/i));
    expect(screen.getByLabelText(/recovery code/i)).toBeTruthy();
  }, 30000);
});

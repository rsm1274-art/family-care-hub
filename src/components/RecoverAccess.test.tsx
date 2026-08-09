import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { RecoverAccess } from './RecoverAccess';
import { cryptoService } from '../services/cryptoService';

describe('RecoverAccess', () => {
  let code: string;

  beforeEach(async () => {
    localStorage.clear();
    cryptoService.lock();
    code = await cryptoService.setupPin('123456');
    cryptoService.lock();
  });
  afterEach(cleanup);

  it('rejects a malformed code without attempting an unlock', () => {
    render(<RecoverAccess onRecovered={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText(/recovery code/i), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/doesn't look like a valid/i)).toBeTruthy();
  });

  it('rejects a well-formed but wrong code', async () => {
    render(<RecoverAccess onRecovered={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText(/recovery code/i), {
      target: { value: 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(screen.getByText(/did not match/i)).toBeTruthy(), {
      timeout: 10000,
    });
  });

  it('recovers, sets a new PIN, and issues a fresh code', async () => {
    const onRecovered = vi.fn();
    render(<RecoverAccess onRecovered={onRecovered} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText(/recovery code/i), { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByLabelText(/new pin/i)).toBeTruthy(), {
      timeout: 10000,
    });
    fireEvent.change(screen.getByLabelText(/new pin/i), { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: /set pin/i }));

    await waitFor(() => expect(onRecovered).toHaveBeenCalled(), { timeout: 10000 });

    const issued = onRecovered.mock.calls[0][0] as string;
    expect(issued).not.toBe(code);

    cryptoService.lock();
    expect(await cryptoService.unlock('999999')).toBe(true);
    expect(await cryptoService.unlockWithRecovery(code)).toBe(false);
    expect(await cryptoService.unlockWithRecovery(issued)).toBe(true);
  }, 30000);
});

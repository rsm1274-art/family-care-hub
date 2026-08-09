import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import { cryptoService } from '../services/cryptoService';
import { isValidRecoveryCode } from '../services/recoveryCode';

interface RecoverAccessProps {
  /** Receives the freshly issued recovery code so App can display it. */
  onRecovered: (newRecoveryCode: string) => void;
  onCancel: () => void;
}

export const RecoverAccess: React.FC<RecoverAccessProps> = ({ onRecovered, onCancel }) => {
  const [stage, setStage] = useState<'code' | 'pin'>('code');
  const [code, setCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCodeSubmit = async () => {
    setError('');

    // Checked locally first so an obvious typo does not cost a 600k-iteration
    // key derivation before failing.
    if (!isValidRecoveryCode(code)) {
      setError("That doesn't look like a valid recovery code.");
      return;
    }

    setBusy(true);
    try {
      if (await cryptoService.unlockWithRecovery(code)) {
        setStage('pin');
      } else {
        setError('That code did not match. Check it and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePinSubmit = async () => {
    setError('');
    if (!/^\d{6}$/.test(newPin)) {
      setError('Enter exactly 6 digits.');
      return;
    }

    setBusy(true);
    try {
      await cryptoService.changePin(newPin);
      // The old code was just typed into a field and may sit in clipboard or
      // form history, so recovery retires it rather than leaving it valid.
      onRecovered(await cryptoService.regenerateRecoveryCode());
    } catch (e) {
      console.error('Recovery failed', e);
      setError('Something went wrong. Your data has not been changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary p-6 text-mainText">
      <div className="w-full max-w-sm">
        <button
          onClick={onCancel}
          className="mb-6 flex items-center gap-2 text-sm text-mutedText"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-semibold">
            {stage === 'code' ? 'Recover access' : 'Choose a new PIN'}
          </h1>
        </div>

        {stage === 'code' ? (
          <>
            <p className="mb-4 text-sm text-mutedText">
              Enter the recovery code you saved when you set up your PIN.
            </p>
            <label htmlFor="recovery-code" className="mb-1 block text-sm">
              Recovery code
            </label>
            <input
              id="recovery-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              className="mb-3 w-full rounded border border-borderColor bg-surface p-3 font-mono text-sm"
            />
            {error && <p className="mb-3 text-sm text-danger">{error}</p>}
            <button
              onClick={handleCodeSubmit}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded bg-accent py-2 font-bold text-white disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Continue
            </button>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-mutedText">
              Your data is unlocked. Choose a new 6-digit PIN.
            </p>
            <label htmlFor="new-pin" className="mb-1 block text-sm">
              New PIN
            </label>
            <input
              id="new-pin"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              className="mb-3 w-full rounded border border-borderColor bg-surface p-3 text-center font-mono text-lg tracking-widest"
            />
            {error && <p className="mb-3 text-sm text-danger">{error}</p>}
            <button
              onClick={handlePinSubmit}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded bg-accent py-2 font-bold text-white disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Set PIN
            </button>
          </>
        )}
      </div>
    </div>
  );
};

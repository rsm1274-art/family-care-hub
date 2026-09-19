import React, { useState } from 'react';
import { Cloud, Loader2, X } from 'lucide-react';

interface JoinVaultModalProps {
  cloudConnected: boolean;
  cloudSyncing: boolean;
  onConnectGoogleDrive: () => Promise<void>;
  /** Returns an error message, or null on success. */
  onJoin: (code: string, pin: string) => Promise<string | null>;
  onCancel: () => void;
}

/**
 * Lets a caregiver on a fresh device join a vault another caregiver already
 * created, instead of creating a brand new (and un-shareable) one. Requires
 * the same Drive folder to already be shared with this Google account --
 * that part happens in Drive itself, outside this app.
 */
export const JoinVaultModal: React.FC<JoinVaultModalProps> = ({
  cloudConnected,
  cloudSyncing,
  onConnectGoogleDrive,
  onJoin,
  onCancel,
}) => {
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(pin)) {
      setError('Choose a 6-digit PIN.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setJoining(true);
    try {
      const result = await onJoin(code, pin);
      if (result) setError(result);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-sm rounded-lg border border-borderColor bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-mainText">Join a Shared Vault</h2>
          <button onClick={onCancel} className="text-mutedText hover:text-mainText" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!cloudConnected ? (
          <>
            <p className="mb-4 text-sm text-mutedText">
              First, connect the same Google Drive account the inviting caregiver shared their
              "Family Care Hub Data" folder with.
            </p>
            <button
              onClick={() => void onConnectGoogleDrive()}
              disabled={cloudSyncing}
              className="flex w-full items-center justify-center gap-2 rounded bg-accent py-2 font-bold text-white disabled:opacity-60"
            >
              {cloudSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
              {cloudSyncing ? 'Connecting…' : 'Connect Google Drive'}
            </button>
          </>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <p className="text-sm text-mutedText">
              Enter the invite code the other caregiver shared with you, then choose your own
              6-digit PIN for this device.
            </p>
            <div>
              <label className="mb-1 block text-sm text-mutedText">Invite code</label>
              <input
                type="text"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-…"
                className="w-full rounded border border-borderColor bg-primary p-3 font-mono text-sm text-mainText focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-mutedText">Choose a 6-digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded border border-borderColor bg-primary p-3 text-mainText focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-mutedText">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded border border-borderColor bg-primary p-3 text-mainText focus:border-accent focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={joining}
              className="flex w-full items-center justify-center gap-2 rounded bg-accent py-2 font-bold text-white disabled:opacity-60"
            >
              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {joining ? 'Joining…' : 'Join Vault'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

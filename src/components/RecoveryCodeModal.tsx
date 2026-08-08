import React, { useState } from 'react';
import { ShieldCheck, Copy, Download } from 'lucide-react';

interface RecoveryCodeModalProps {
  code: string;
  onConfirmed: () => void;
}

/**
 * Shown exactly once, when the vault is created or migrated. There is
 * deliberately no dismiss-without-confirming path: with no server and no
 * account, losing this code alongside the PIN means the records are gone.
 */
export const RecoveryCodeModal: React.FC<RecoveryCodeModalProps> = ({ code, onConfirmed }) => {
  const [saved, setSaved] = useState(false);

  const handleDownload = () => {
    const blob = new Blob([`Family Care Hub recovery code\n\n${code}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'FamilyCareHub_RecoveryCode.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-md rounded-lg border border-borderColor bg-surface p-6">
        <div className="mb-4 flex items-center gap-2 text-mainText">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Save your recovery code</h2>
        </div>

        <p className="mb-4 text-sm text-mutedText">
          This is the only way back into your data if you forget your PIN. We cannot
          recover it for you. Store it somewhere safe and separate from this device.
        </p>

        <div className="mb-4 select-all rounded border border-borderColor bg-primary p-3 text-center font-mono text-sm tracking-wider text-mainText">
          {code}
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(code)}
            className="flex flex-1 items-center justify-center gap-2 rounded border border-borderColor py-2 text-sm text-mainText"
          >
            <Copy className="h-4 w-4" /> Copy
          </button>
          <button
            onClick={handleDownload}
            className="flex flex-1 items-center justify-center gap-2 rounded border border-borderColor py-2 text-sm text-mainText"
          >
            <Download className="h-4 w-4" /> Download
          </button>
        </div>

        <label className="mb-4 flex items-start gap-2 text-sm text-mainText">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="mt-1"
          />
          I have saved this code somewhere safe
        </label>

        <button
          onClick={onConfirmed}
          disabled={!saved}
          className="w-full rounded bg-accent py-2 font-bold text-white disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { Copy, UserPlus, X } from 'lucide-react';

interface InviteCodeModalProps {
  code: string;
  onClose: () => void;
}

/**
 * Shown after Settings creates an invite. Unlike RecoveryCodeModal this one
 * is dismissible without a checkbox -- losing this code just means creating
 * another invite, not losing data.
 */
export const InviteCodeModal: React.FC<InviteCodeModalProps> = ({ code, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
    <div className="w-full max-w-md rounded-lg border border-borderColor bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-mainText">
          <UserPlus className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Invite code created</h2>
        </div>
        <button onClick={onClose} className="text-mutedText hover:text-mainText" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <p className="mb-4 text-sm text-mutedText">
        Share this code with the other caregiver directly -- text, call, or hand them your
        screen. Anyone with this code and access to your shared Drive folder can read your
        records, so don't post it anywhere public. It works once.
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
      </div>

      <p className="mb-4 text-xs text-mutedText">
        On their device: connect the same Drive folder (share it from your Drive first, if you
        haven't), then choose "Joining a caregiver who already set this up?" and enter this code.
      </p>

      <button onClick={onClose} className="w-full rounded bg-accent py-2 font-bold text-white">
        Done
      </button>
    </div>
  </div>
);

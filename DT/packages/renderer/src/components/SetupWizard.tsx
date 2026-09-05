import React, { useEffect } from 'react';
import { HeartPulse, Loader2, AlertTriangle } from 'lucide-react';
import type { HostStatus } from '../electron.d';
import { apiClient } from '../services/apiClient';

/**
 * First-run wizard (Electron only): starts the local database and server on
 * this computer, then hands off to the app once they're ready.
 */

interface SetupWizardProps {
  onComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [hostStatus, setHostStatus] = React.useState<HostStatus>({ state: 'idle', message: '' });

  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubscribe = window.electronAPI.onHostStatus(setHostStatus);
    void window.electronAPI.startLocal();
    const poll = setInterval(async () => {
      setHostStatus(await window.electronAPI!.getHostStatus());
    }, 1000);
    return () => {
      unsubscribe();
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (hostStatus.state === 'ready') {
      apiClient.setServerUrl('http://localhost:4000');
      onComplete();
    }
  }, [hostStatus.state, onComplete]);

  const retry = () => {
    void window.electronAPI!.startLocal();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary text-mainText p-6">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-4">
          <HeartPulse className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-2xl font-bold mb-1">Welcome to Family Care Hub</h1>
        <p className="text-mutedText text-sm">One-time setup for this computer</p>
      </div>

      <div className="w-full max-w-lg bg-surface border border-borderColor rounded-2xl p-8 text-center">
        {hostStatus.state === 'error' ? (
          <>
            <AlertTriangle className="w-10 h-10 text-danger mx-auto mb-4" />
            <h2 className="font-bold text-lg mb-2">Something went wrong</h2>
            <p className="text-sm text-mutedText mb-6">{hostStatus.message}</p>
            <button onClick={retry} className="text-accent font-medium hover:underline">
              Try again
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-4" />
            <h2 className="font-bold text-lg mb-2">Setting up Family Care Hub</h2>
            <p className="text-sm text-mutedText">
              {hostStatus.message || 'Preparing the family database…'}
            </p>
            <p className="text-xs text-mutedText mt-4">This can take a minute the first time.</p>
          </>
        )}
      </div>
    </div>
  );
};

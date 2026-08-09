import React, { useState, useEffect, useRef } from 'react';
import { cryptoService } from '../services/cryptoService';
import { needsMigration } from '../services/migrateVault';
import { Delete, KeyRound, Upload } from 'lucide-react';
import { Logo } from './Logo';

interface PinPadProps {
  /**
   * `wasSetup` is true when this call created the vault, so App knows to run
   * setupPin and surface the recovery code rather than treating it as an
   * ordinary unlock. Resolves false when the PIN was not accepted -- App
   * verifies it itself on the migration path, where unlock() cannot.
   */
  onUnlock: (pin: string, wasSetup: boolean) => Promise<boolean>;
  onForgotPin: () => void;
}

export const PinPad: React.FC<PinPadProps> = ({ onUnlock, onForgotPin }) => {
  const [pin, setPin] = useState<string>('');
  const [isSetupMode, setIsSetupMode] = useState<boolean>(!cryptoService.isSetup());
  const [confirmPin, setConfirmPin] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- RESTORE FUNCTIONALITY ---
  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Restoring a backup will overwrite any current data. Are you sure?")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        // 1. Clear current empty state
        localStorage.clear();
        
        // 2. Load backup data
        Object.keys(json).forEach((key) => {
          localStorage.setItem(key, json[key]);
        });
        
        // 3. Reload to initialize crypto service with restored keys
        alert("Backup restored successfully! The application will now reload.");
        window.location.reload();
      } catch {
        setError("Failed to restore. Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  const handleNumberClick = (num: number) => {
    if (pin.length < 6 && !loading) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setTimeout(async () => {
      try {
        if (isSetupMode) {
          if (!confirmPin) {
            setConfirmPin(pin);
            setPin('');
            setLoading(false);
            return;
          }
          if (pin !== confirmPin) {
            setError("PINs do not match. Try again.");
            setConfirmPin(null);
            setPin('');
            return;
          }
          // App owns setupPin: it returns the recovery code, which has to be
          // displayed, and this component has nowhere to put it.
          setIsSetupMode(false);
          await onUnlock(pin, true);
        } else {
          // On a v1 vault unlock() always fails -- there is no v2 pin slot yet.
          // App migrates instead, and the migration verifies the PIN itself.
          if (!needsMigration() && !(await cryptoService.unlock(pin))) {
            setError("Invalid PIN.");
            setPin('');
            return;
          }
          if (!(await onUnlock(pin, false))) {
            setError("Invalid PIN.");
            setPin('');
          }
        }
      } catch {
        setError("Security Error.");
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  // TODO: auto-submit belongs in handleNumberClick, not an effect (see
  // react.dev/learn/you-might-not-need-an-effect). Moving it means threading the
  // submitted PIN through handleSubmit instead of reading it from closure, which
  // touches the unlock path and needs manual testing of both setup and unlock.
  useEffect(() => {
    if (pin.length === 6) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary text-mainText p-6">
      <div className="mb-8 flex flex-col items-center">
        <Logo className="w-20 h-20 mb-4" />
        <h1 className="text-2xl font-bold mb-2 text-mainText">
          {isSetupMode 
            ? (confirmPin ? "Confirm Master PIN" : "Create Master PIN") 
            : "Family Care Hub Login"}
        </h1>
        
        {isSetupMode ? (
           <div className="flex flex-col items-center gap-4 w-full max-w-xs">
             {/* Informational, not a danger warning: forgetting the PIN is now
                 survivable. Losing the PIN *and* the recovery code is not, and
                 that is the part still worth saying up front. */}
             <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 w-full animate-in fade-in zoom-in duration-300">
               <div className="flex items-center justify-center gap-2 mb-2 text-accent">
                 <KeyRound className="w-5 h-5" />
                 <span className="font-bold text-sm uppercase tracking-wider">Recovery Code</span>
               </div>
               <p className="text-mutedText text-xs text-center leading-relaxed">
                 <strong className="text-mainText">You will get a one-time recovery code next.</strong><br/>
                 It is the only way back in if you forget this PIN, so save it
                 somewhere safe.
               </p>
             </div>

             {/* RESTORE BUTTON - Only shows in setup mode */}
             <div className="w-full border-t border-gray-200 pt-4 flex flex-col items-center">
                <p className="text-xs text-gray-500 mb-2">Did you lose your data?</p>
                <input 
                  type="file" 
                  accept=".json"
                  ref={fileInputRef}
                  onChange={handleRestore}
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium px-4 py-2 rounded-full hover:bg-blue-50 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Restore from Backup
                </button>
             </div>
           </div>
        ) : (
          <p className="text-mutedText text-sm text-center max-w-xs">
            Enter your 6-digit PIN to decrypt your health records.
          </p>
        )}
      </div>

      {/* PIN Dots */}
      <div className="flex gap-4 mb-8">
        {[...Array(6)].map((_, i) => (
          <div 
            key={i} 
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < pin.length ? 'bg-accent scale-110' : 'bg-surface-hover'
            }`}
          />
        ))}
      </div>

      {error && (
        <div className="mb-6 text-danger font-medium animate-pulse">
          {error}
        </div>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-6 w-full max-w-xs">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num)}
            className="h-16 w-16 rounded-full bg-surface hover:bg-surface-hover active:bg-accent active:text-white flex items-center justify-center text-2xl font-semibold transition-colors text-mainText border border-borderColor shadow-sm"
          >
            {num}
          </button>
        ))}
        <div /> {/* Spacer */}
        <button
          onClick={() => handleNumberClick(0)}
          className="h-16 w-16 rounded-full bg-surface hover:bg-surface-hover active:bg-accent active:text-white flex items-center justify-center text-2xl font-semibold transition-colors text-mainText border border-borderColor shadow-sm"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="h-16 w-16 rounded-full bg-transparent text-mutedText hover:text-mainText flex items-center justify-center transition-colors"
        >
          <Delete className="w-8 h-8" />
        </button>
      </div>

      {!isSetupMode && (
        <button onClick={onForgotPin} className="mt-4 text-sm text-mutedText underline">
          Forgot your PIN?
        </button>
      )}
    </div>
  );
};

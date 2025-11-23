import React, { useState, useEffect, useRef } from 'react';
import { cryptoService } from '../services/cryptoService';
import { Lock, Unlock, ShieldCheck, Delete, AlertTriangle, Upload } from 'lucide-react';

interface PinPadProps {
  onUnlock: () => void;
}

export const PinPad: React.FC<PinPadProps> = ({ onUnlock }) => {
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
      } catch (error) {
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
          } else {
            if (pin === confirmPin) {
              await cryptoService.setupPin(pin);
              setIsSetupMode(false);
              onUnlock();
            } else {
              setError("PINs do not match. Try again.");
              setConfirmPin(null);
              setPin('');
            }
          }
        } else {
          const isValid = await cryptoService.unlock(pin);
          if (isValid) {
            onUnlock();
          } else {
            setError("Invalid PIN.");
            setPin('');
          }
        }
      } catch (e) {
        setError("Security Error.");
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  useEffect(() => {
    if (pin.length === 6) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary text-mainText p-6">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-4">
          {isSetupMode ? <ShieldCheck className="w-8 h-8 text-accent" /> : <Lock className="w-8 h-8 text-accent" />}
        </div>
        <h1 className="text-2xl font-bold mb-2 text-mainText">
          {isSetupMode 
            ? (confirmPin ? "Confirm Master PIN" : "Create Master PIN") 
            : "Family Care Hub Login"}
        </h1>
        
        {isSetupMode ? (
           <div className="flex flex-col items-center gap-4 w-full max-w-xs">
             <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 w-full animate-in fade-in zoom-in duration-300">
               <div className="flex items-center justify-center gap-2 mb-2 text-danger">
                 <AlertTriangle className="w-5 h-5" />
                 <span className="font-bold text-sm uppercase tracking-wider">No Recovery</span>
               </div>
               <p className="text-danger/90 text-xs text-center leading-relaxed">
                 <strong>This PIN cannot be recovered if lost.</strong><br/>
                 Please verify you have recorded it safely.
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
    </div>
  );
};

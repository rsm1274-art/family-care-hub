import React, { useState } from 'react';
import type { SettingsState } from '../types';
import { Moon, Sun, Type, FileText, ArrowLeft, Download, Upload, Shield, Info, AlertTriangle } from 'lucide-react';

interface SettingsProps {
  settings: SettingsState;
  onUpdateSettings: (settings: SettingsState) => void;
  onBack: () => void;
  onOpenTerms: () => void;
  /** ISO timestamp of the last export, or null if there has never been one. */
  lastBackup: string | null;
}

export const Settings: React.FC<SettingsProps> = ({ 
  settings, 
  onUpdateSettings, 
  onBack,
  onOpenTerms,
  lastBackup
}) => {
  // Captured once per mount rather than read during render: the clock is an
  // impure source, and this panel does not need it to tick.
  const [now] = useState(() => Date.now());
  const backupAgeDays = lastBackup
    ? (now - new Date(lastBackup).getTime()) / 86_400_000
    : Infinity;
  const backupIsStale = backupAgeDays > 30;

  const toggleTheme = () => {
    onUpdateSettings({ ...settings, theme: settings.theme === 'light' ? 'dark' : 'light' });
  };

  const toggleContrast = () => {
    onUpdateSettings({ ...settings, highContrast: !settings.highContrast });
  };

  const toggleLargeText = () => {
    onUpdateSettings({ ...settings, largeText: !settings.largeText });
  };

  return (
    // UPDATED: Used 'bg-primary' instead of 'bg-gray-50' to react to theme
    <div className="min-h-screen bg-primary text-mainText p-4 sm:p-6 pb-20 transition-colors duration-200">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-surface-hover rounded-full transition-colors text-mainText"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-mainText">Application Settings</h1>
        </div>

        {/* --- HOW TO BACKUP GUIDE --- */}
        {/* UPDATED: Used 'bg-surface' and 'border-borderColor' */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-borderColor">
          <div className="flex items-center gap-3 mb-4 text-blue-500">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">Data Security & Backup</h2>
          </div>
          
          <div className="space-y-4">
            {backupIsStale && (
              <div className="flex gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <p className="text-sm text-mainText">
                  Your data lives only on this device. If you lose it, these records
                  cannot be recovered. Export a backup.
                </p>
              </div>
            )}

            <p className="text-sm text-mutedText">
              {lastBackup
                ? `Last backup: ${new Date(lastBackup).toLocaleDateString()}`
                : 'You have never backed up'}
            </p>

            <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/20">
              <h3 className="font-semibold text-blue-500 flex items-center gap-2 mb-2">
                <Download className="w-4 h-4" />
                How to Backup
              </h3>
              <p className="text-sm text-mainText/80 leading-relaxed">
                Click the <strong>Download Icon</strong> <span className="inline-block align-middle"><Download className="w-3 h-3" /></span> in the top-right corner of the dashboard to save a full copy of your medical records.
                <br/><br/>
                The file is <strong>encrypted</strong> — it can only be opened with your PIN, so it is safe to store on a cloud drive or USB stick.
                <br/><br/>
                <strong>Recommendation:</strong> Do this after every major update.
              </p>
            </div>

            <div className="bg-amber-500/5 rounded-xl p-4 border border-amber-500/20">
              <h3 className="font-semibold text-amber-500 flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4" />
                How to Restore
              </h3>
              <p className="text-sm text-mainText/80 leading-relaxed">
                If you clear your browser history or switch devices, you will see a <strong>"Restore from Backup"</strong> option on the initial PIN creation screen.
                <br/><br/>
                <strong>Important:</strong> a restored backup can only be opened with the PIN that was in use when the backup was taken. Choosing a different PIN will not work, because the file is encrypted with the original one.
              </p>
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-borderColor">
          <h2 className="text-lg font-bold text-mainText mb-6">Display & Accessibility</h2>
          
          <div className="space-y-6">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${settings.theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-orange-500/20 text-orange-600'}`}>
                  {settings.theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-medium text-mainText">App Theme</p>
                  <p className="text-sm text-mutedText">Switch between light and dark mode</p>
                </div>
              </div>
              <button 
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-400'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* High Contrast */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-surface-hover text-mutedText rounded-lg">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-mainText">High Contrast</p>
                  <p className="text-sm text-mutedText">Increase visual distinction</p>
                </div>
              </div>
              <button 
                onClick={toggleContrast}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.highContrast ? 'bg-accent' : 'bg-gray-400'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.highContrast ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Large Text */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-surface-hover text-mutedText rounded-lg">
                  <Type className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-mainText">Large Text</p>
                  <p className="text-sm text-mutedText">Increase font size for readability</p>
                </div>
              </div>
              <button 
                onClick={toggleLargeText}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.largeText ? 'bg-accent' : 'bg-gray-400'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.largeText ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Legal */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-borderColor">
          <h2 className="text-lg font-bold text-mainText mb-4">About</h2>
          <button 
            onClick={onOpenTerms}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-hover transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-hover text-mutedText rounded-lg group-hover:bg-accent group-hover:text-white transition-all">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-medium text-mainText">Terms & Privacy Policy</p>
                <p className="text-xs text-mutedText">Read our legal documentation</p>
              </div>
            </div>
            <div className="text-mutedText">→</div>
          </button>
          
          <div className="mt-4 pt-4 border-t border-borderColor flex gap-2 text-xs text-mutedText">
             <Info className="w-4 h-4" />
             <p>Family Care Hub v1.0.0 • Local Offline Storage</p>
          </div>
        </div>

      </div>
    </div>
  );
};

import React, { useRef, useState } from 'react';
import type { UserDto } from '@familycarehub/shared-types';
import type { SettingsState } from '../types';
import { Moon, Sun, Type, FileText, ArrowLeft, Download, Upload, Shield, Info, LogOut, Users, Copy, Check, Loader2 } from 'lucide-react';

interface SettingsProps {
  settings: SettingsState;
  user: UserDto | null;
  onUpdateSettings: (settings: SettingsState) => void;
  onBack: () => void;
  onOpenTerms: () => void;
  onLogout: () => void;
  onImportBackup: (file: File) => Promise<void>;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  user,
  onUpdateSettings,
  onBack,
  onOpenTerms,
  onLogout,
  onImportBackup
}) => {

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleTheme = () => {
    onUpdateSettings({ ...settings, theme: settings.theme === 'light' ? 'dark' : 'light' });
  };

  const toggleContrast = () => {
    onUpdateSettings({ ...settings, highContrast: !settings.highContrast });
  };

  const toggleLargeText = () => {
    onUpdateSettings({ ...settings, largeText: !settings.largeText });
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      await onImportBackup(file);
    } finally {
      setImporting(false);
    }
  };

  const copyInviteCode = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(`Invite code: ${user.inviteCode}`);
    }
  };

  return (
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

        {/* --- HOUSEHOLD & ACCOUNT --- */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-borderColor">
          <div className="flex items-center gap-3 mb-4 text-accent">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">Household & Account</h2>
          </div>

          {user && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-mainText">{user.displayName}</p>
                  <p className="text-sm text-mutedText">
                    @{user.username} · {user.householdName}
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 text-danger font-medium px-4 py-2 rounded-lg border border-danger/30 hover:bg-danger/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Log Out
                </button>
              </div>

              <div className="bg-accent/5 rounded-xl p-4 border border-accent/20">
                <h3 className="font-semibold text-accent mb-1">Add Another Login</h3>
                <p className="text-sm text-mainText/80 mb-3">
                  Share this code with someone using this same computer — they choose <strong>Join</strong> on
                  the sign-in screen and create their own login for this household.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-surface-hover rounded-lg px-4 py-2 font-mono text-lg tracking-widest text-mainText">
                    {user.inviteCode}
                  </code>
                  <button
                    onClick={copyInviteCode}
                    className="p-2 text-mutedText hover:text-accent hover:bg-surface-hover rounded-lg transition-colors"
                    aria-label="Copy invite code"
                  >
                    {copied ? <Check className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- DATA & BACKUP --- */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-borderColor">
          <div className="flex items-center gap-3 mb-4 text-blue-500">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">Data & Backup</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/20">
              <h3 className="font-semibold text-blue-500 flex items-center gap-2 mb-2">
                <Download className="w-4 h-4" />
                Download a Backup
              </h3>
              <p className="text-sm text-mainText/80 leading-relaxed">
                Click the <strong>Download Icon</strong> <span className="inline-block align-middle"><Download className="w-3 h-3" /></span> in
                the top-right corner of the dashboard, then choose who to include — one person or
                everyone. Their medications, documents, and photos all go in the file. Move it to
                another computer to bring those records there too.
              </p>
            </div>

            <div className="bg-amber-500/5 rounded-xl p-4 border border-amber-500/20">
              <h3 className="font-semibold text-amber-500 flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4" />
                Import a Backup
              </h3>
              <p className="text-sm text-mainText/80 leading-relaxed mb-3">
                Restore a <strong>FamilyCare_Backup_*.json</strong> file — including backups made with the old
                Family Care Hub web app. Everything in the file (people, medications, documents, and
                photos) will be added to this household.
              </p>
              <input
                type="file"
                accept=".json,application/json"
                ref={fileInputRef}
                onChange={handleFileChosen}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-500 font-medium px-4 py-2 rounded-lg border border-amber-500/30 hover:bg-amber-500/10 transition-colors disabled:opacity-60"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Importing…' : 'Import Backup File'}
              </button>
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
             <p>Family Care Hub v1.0.0 • Local Edition</p>
          </div>
        </div>

      </div>
    </div>
  );
};

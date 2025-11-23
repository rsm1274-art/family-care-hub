import React from 'react';
import { SettingsState } from '../types';
import { Moon, Sun, Type, FileText, ArrowLeft, Download, Upload, Shield, Info } from 'lucide-react';

interface SettingsProps {
  settings: SettingsState;
  onUpdateSettings: (settings: SettingsState) => void;
  onBack: () => void;
  onOpenTerms: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  settings, 
  onUpdateSettings, 
  onBack,
  onOpenTerms
}) => {
  
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
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-gray-200 rounded-full transition-colors text-gray-700"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Application Settings</h1>
        </div>

        {/* --- HOW TO BACKUP GUIDE --- */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100">
          <div className="flex items-center gap-3 mb-4 text-blue-800">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">Data Security & Backup</h2>
          </div>
          
          <div className="space-y-4">
            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2 mb-2">
                <Download className="w-4 h-4" />
                How to Backup
              </h3>
              <p className="text-sm text-blue-800/80 leading-relaxed">
                Click the <strong>Download Icon</strong> <span className="inline-block align-middle"><Download className="w-3 h-3" /></span> in the top-right corner of the dashboard to save a full copy of your medical records. 
                <br/><br/>
                <strong>Recommendation:</strong> Do this after every major update. Save the file to a secure cloud drive or USB stick.
              </p>
            </div>

            <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
              <h3 className="font-semibold text-amber-900 flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4" />
                How to Restore
              </h3>
              <p className="text-sm text-amber-800/80 leading-relaxed">
                If you clear your browser history or switch devices, you will see a <strong>"Restore from Backup"</strong> option on the initial PIN creation screen. 
                <br/><br/>
                Simply upload your backup file there to recover all your data instantly.
              </p>
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Display & Accessibility</h2>
          
          <div className="space-y-6">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${settings.theme === 'dark' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                  {settings.theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-medium text-gray-900">App Theme</p>
                  <p className="text-sm text-gray-500">Switch between light and dark mode</p>
                </div>
              </div>
              <button 
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-200'
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
                <div className="p-2 bg-gray-100 text-gray-600 rounded-lg">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">High Contrast</p>
                  <p className="text-sm text-gray-500">Increase visual distinction</p>
                </div>
              </div>
              <button 
                onClick={toggleContrast}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.highContrast ? 'bg-blue-600' : 'bg-gray-200'
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
                <div className="p-2 bg-gray-100 text-gray-600 rounded-lg">
                  <Type className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Large Text</p>
                  <p className="text-sm text-gray-500">Increase font size for readability</p>
                </div>
              </div>
              <button 
                onClick={toggleLargeText}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.largeText ? 'bg-blue-600' : 'bg-gray-200'
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
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">About</h2>
          <button 
            onClick={onOpenTerms}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 text-gray-600 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Terms & Privacy Policy</p>
                <p className="text-xs text-gray-500">Read our legal documentation</p>
              </div>
            </div>
            <div className="text-gray-400">→</div>
          </button>
          
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2 text-xs text-gray-400">
             <Info className="w-4 h-4" />
             <p>Family Care Hub v1.0.0 • Local Offline Storage</p>
          </div>
        </div>

      </div>
    </div>
  );
};

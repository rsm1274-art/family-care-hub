
import React, { useState } from 'react';
import { ArrowLeft, Moon, Sun, Type, Eye, ChevronDown, ChevronUp, ShieldCheck, Users, Pill, Database, FileText, ChevronRight, Download } from 'lucide-react';
import { SettingsState } from '../types';

interface SettingsProps {
  settings: SettingsState;
  onUpdateSettings: (newSettings: SettingsState) => void;
  onBack: () => void;
  onOpenTerms: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings, onBack, onOpenTerms }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const toggleTheme = () => {
    onUpdateSettings({ ...settings, theme: settings.theme === 'light' ? 'dark' : 'light' });
  };

  const toggleContrast = () => {
    onUpdateSettings({ ...settings, highContrast: !settings.highContrast });
  };

  const toggleLargeText = () => {
    onUpdateSettings({ ...settings, largeText: !settings.largeText });
  };

  const ManualSection = ({ title, icon: Icon, id, children }: any) => (
    <div className="border border-borderColor rounded-lg overflow-hidden mb-3 bg-surface">
      <button 
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-3 text-mainText">
          <Icon className="w-5 h-5 text-accent" />
          <span className="font-medium">{title}</span>
        </div>
        {expandedSection === id ? (
          <ChevronUp className="w-5 h-5 text-mutedText" />
        ) : (
          <ChevronDown className="w-5 h-5 text-mutedText" />
        )}
      </button>
      {expandedSection === id && (
        <div className="p-4 pt-0 text-mutedText text-sm border-t border-borderColor bg-surface/50">
          <div className="pt-3 space-y-2">
            {children}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-primary text-mainText">
      <div className="p-4 bg-surface flex items-center gap-4 shadow-md z-10 border-b border-borderColor">
        <button onClick={onBack} className="p-2 -ml-2 text-mutedText hover:text-mainText">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold">Settings & Help</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-10">
        
        {/* Accessibility & Theme */}
        <section>
          <h3 className="text-sm font-bold text-mutedText uppercase tracking-wider mb-3">Appearance</h3>
          <div className="bg-surface rounded-xl border border-borderColor overflow-hidden">
            
            <div className="flex items-center justify-between p-4 border-b border-borderColor">
              <div className="flex items-center gap-3">
                {settings.theme === 'dark' ? <Moon className="w-5 h-5 text-accent" /> : <Sun className="w-5 h-5 text-accent" />}
                <div>
                  <p className="font-medium text-mainText">App Theme</p>
                  <p className="text-xs text-mutedText">{settings.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
                </div>
              </div>
              <button 
                onClick={toggleTheme}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.theme === 'light' ? 'bg-slate-300' : 'bg-accent'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.theme === 'light' ? 'translate-x-0' : 'translate-x-6'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 border-b border-borderColor">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-accent" />
                <div>
                  <p className="font-medium text-mainText">High Contrast</p>
                  <p className="text-xs text-mutedText">Increase visual distinction</p>
                </div>
              </div>
              <button 
                onClick={toggleContrast}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.highContrast ? 'bg-accent' : 'bg-slate-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.highContrast ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Type className="w-5 h-5 text-accent" />
                <div>
                  <p className="font-medium text-mainText">Large Text</p>
                  <p className="text-xs text-mutedText">Increase font size</p>
                </div>
              </div>
              <button 
                onClick={toggleLargeText}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.largeText ? 'bg-accent' : 'bg-slate-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.largeText ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

          </div>
        </section>

        {/* User Manual */}
        <section>
          <h3 className="text-sm font-bold text-mutedText uppercase tracking-wider mb-3">User Manual</h3>
          
          <ManualSection title="Installation" icon={Download} id="install">
            <p><strong>iOS (Chrome/Safari):</strong> Tap the "Share" icon (box with arrow) in the browser bar, scroll down, and select "Add to Home Screen".</p>
            <p><strong>Android:</strong> Tap the menu icon (three dots) and select "Install App" or "Add to Home Screen".</p>
          </ManualSection>

          <ManualSection title="Security & Login" icon={ShieldCheck} id="sec">
            <p><strong>Zero-Knowledge Architecture:</strong> Your data is encrypted on this device using your 6-digit PIN. We do not have access to your PIN or your data.</p>
            <p><strong>Master Key:</strong> The app creates a master key when you first sign up. If you lose your PIN, your data cannot be recovered.</p>
          </ManualSection>

          <ManualSection title="Managing Profiles" icon={Users} id="users">
            <p><strong>Adding People:</strong> Tap the "+" button on the dashboard to add family members.</p>
            <p><strong>Editing:</strong> Open a profile and tap the pencil icon in the top right to update medical conditions, insurance, or contact info.</p>
          </ManualSection>

          <ManualSection title="Medications & Labels" icon={Pill} id="meds">
            <p><strong>Adding Photos:</strong> Inside a profile, go to the "Meds" tab and tap "Add Med".</p>
            <p><strong>Label Capture:</strong> Point your camera at a pill bottle to take a photo of the label. This photo is stored securely with the medication record.</p>
            <p><strong>Manual Entry:</strong> After taking the photo, enter the medication details (Name, Dosage, Frequency) manually.</p>
          </ManualSection>

          <ManualSection title="Data Privacy" icon={Database} id="privacy">
            <p><strong>Local Storage:</strong> All photos and text records are stored in an encrypted database on your phone's physical storage.</p>
            <p><strong>Offline First:</strong> This app works entirely without an internet connection (except for initially loading the web app).</p>
          </ManualSection>

        </section>

        {/* Legal */}
        <section>
          <h3 className="text-sm font-bold text-mutedText uppercase tracking-wider mb-3">Legal</h3>
          <div className="bg-surface rounded-xl border border-borderColor overflow-hidden">
             <button 
               onClick={onOpenTerms}
               className="w-full flex items-center justify-between p-4 hover:bg-surface-hover transition-colors"
             >
               <div className="flex items-center gap-3 text-mainText">
                 <FileText className="w-5 h-5 text-accent" />
                 <span className="font-medium">Terms of Service</span>
               </div>
               <ChevronRight className="w-5 h-5 text-mutedText" />
             </button>
          </div>
        </section>

        <div className="text-center text-xs text-mutedText pt-8">
          <p>Family Care Hub v1.1.0</p>
          <p>&copy; 2025 Secure Health Systems</p>
        </div>

      </div>
    </div>
  );
};

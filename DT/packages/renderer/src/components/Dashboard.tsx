import React from 'react';
import type { Person } from '../types';
import { Plus, User, ChevronRight, Settings } from 'lucide-react';

interface DashboardProps {
  people: Person[];
  onAddPerson: () => void;
  onSelectPerson: (id: string) => void;
  onOpenSettings: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ people, onAddPerson, onSelectPerson, onOpenSettings }) => {
  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Emergency Summary */}
      <div className="emergency-summary bg-red-950/70 border border-red-900 p-4 rounded-lg">
        <h3 className="text-lg font-bold text-red-100">Emergency Summary</h3>
        <p className="text-sm text-red-200/90">Ensure all critical information is up-to-date and accessible.</p>
      </div>

      <header className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-mainText">Family Care Hub</h2>
          <p className="text-mutedText text-sm">Your household's shared health records</p>
        </div>
        <button 
          onClick={onOpenSettings}
          className="p-2 text-mutedText hover:text-mainText hover:bg-surface-hover rounded-full transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-6 h-6" />
        </button>
      </header>

      {people.length === 0 ? (
        <div className="text-center py-12 bg-surface/50 rounded-xl border border-borderColor border-dashed">
          <User className="w-12 h-12 text-mutedText mx-auto mb-3" />
          <p className="text-mutedText">No profiles found.</p>
          <button 
            onClick={onAddPerson}
            className="mt-4 text-accent font-medium hover:underline"
          >
            Add your first family member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {people.map((person) => (
            <button
              key={person.id}
              onClick={() => onSelectPerson(person.id)}
              className="bg-surface p-4 rounded-xl border border-borderColor flex items-center justify-between hover:bg-surface-hover transition-all active:scale-95 text-left group shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                  {person.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-mainText text-lg">{person.name}</h3>
                  <p className="text-mutedText text-sm">{person.insuranceProvider || 'No Insurance'}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-mutedText group-hover:text-mainText" />
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onAddPerson}
        className="fixed bottom-6 right-6 w-14 h-14 bg-accent hover:opacity-90 rounded-full flex items-center justify-center shadow-lg shadow-sky-900/20 transition-transform hover:scale-105 active:scale-90"
      >
        <Plus className="w-8 h-8 text-white" />
      </button>
    </div>
  );
};
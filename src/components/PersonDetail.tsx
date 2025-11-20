
import React, { useState } from 'react';
import { Person, Medication } from '../types';
import { ArrowLeft, Pill, FileText, Info, Camera, Plus, AlertTriangle, Stethoscope, Shield, Pencil, Eye } from 'lucide-react';

interface PersonDetailProps {
  person: Person;
  medications: Medication[];
  onBack: () => void;
  onAddMedication: () => void;
  onEdit: () => void;
  onViewImage: (base64: string) => void;
  onEditMedication: (id: string) => void;
}

export const PersonDetail: React.FC<PersonDetailProps> = ({ person, medications, onBack, onAddMedication, onEdit, onViewImage, onEditMedication }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'meds'>('meds');

  return (
    <div className="flex flex-col h-screen bg-primary">
      {/* Header */}
      <div className="p-4 bg-surface flex items-center justify-between shadow-md z-10 border-b border-borderColor">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-mutedText hover:text-mainText">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-mainText">{person.name}</h2>
        </div>
        <button 
          onClick={onEdit}
          className="p-2 text-accent hover:bg-surface-hover rounded-full transition-colors"
          aria-label="Edit Profile"
        >
          <Pencil className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-borderColor bg-surface">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'info' ? 'text-accent border-b-2 border-accent' : 'text-mutedText'
          }`}
        >
          <Info className="w-4 h-4" /> Info
        </button>
        <button
          onClick={() => setActiveTab('meds')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'meds' ? 'text-accent border-b-2 border-accent' : 'text-mutedText'
          }`}
        >
          <Pill className="w-4 h-4" /> Meds
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'info' ? (
          <div className="space-y-4 pb-10">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-surface p-4 rounded-lg border border-borderColor shadow-sm">
                <label className="text-xs text-mutedText uppercase tracking-wider block mb-1">Date of Birth</label>
                <p className="text-mainText font-medium">{person.dob}</p>
              </div>
              <div className="bg-surface p-4 rounded-lg border border-borderColor shadow-sm">
                <label className="text-xs text-mutedText uppercase tracking-wider block mb-1">Blood Type</label>
                <p className="text-mainText font-medium">{person.bloodType || "N/A"}</p>
              </div>
            </div>

            {(person.medicalConditions || person.allergies) && (
              <div className="bg-surface p-4 rounded-lg border border-borderColor shadow-sm">
                 <div className="flex items-center gap-2 mb-3 text-accent">
                   <AlertTriangle className="w-5 h-5" />
                   <h3 className="font-bold">Medical Alert</h3>
                 </div>
                 
                 {person.allergies && (
                   <div className="mb-3">
                     <label className="text-xs text-mutedText uppercase tracking-wider block">Allergies</label>
                     <p className="text-mainText">{person.allergies}</p>
                   </div>
                 )}
                 
                 {person.medicalConditions && (
                   <div>
                     <label className="text-xs text-mutedText uppercase tracking-wider block">Conditions</label>
                     <p className="text-mainText">{person.medicalConditions}</p>
                   </div>
                 )}
              </div>
            )}

            {person.primaryPhysician && (
              <div className="bg-surface p-4 rounded-lg border border-borderColor shadow-sm">
                <div className="flex items-center gap-2 mb-3 text-emerald-500">
                   <Stethoscope className="w-5 h-5" />
                   <h3 className="font-bold">Primary Physician</h3>
                 </div>
                <p className="text-mainText font-medium text-lg">{person.primaryPhysician}</p>
                {person.physicianContact && (
                  <p className="text-accent mt-1">{person.physicianContact}</p>
                )}
              </div>
            )}

            <div className="bg-surface p-4 rounded-lg border border-borderColor shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-blue-500">
                  <Shield className="w-5 h-5" />
                  <h3 className="font-bold">Insurance</h3>
              </div>
              <label className="text-xs text-mutedText uppercase tracking-wider block">Provider</label>
              <p className="text-mainText font-medium mb-2">{person.insuranceProvider || "None"}</p>
              
              {person.policyNumber && (
                <>
                  <label className="text-xs text-mutedText uppercase tracking-wider block">Policy #</label>
                  <p className="text-mainText font-mono opacity-80">{person.policyNumber}</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-24">
            {medications.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-mutedText mb-4">No medications listed.</p>
                <button 
                  onClick={onAddMedication}
                  className="bg-accent/10 text-accent px-4 py-2 rounded-lg font-medium border border-accent/20 hover:bg-accent/20"
                >
                  Add Medication
                </button>
              </div>
            ) : (
              medications.map(med => (
                <div key={med.id} className="bg-surface p-4 rounded-lg border border-borderColor flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 bg-surface-hover rounded-lg flex items-center justify-center shrink-0">
                    <Pill className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-mainText font-bold truncate">{med.name}</h3>
                    <p className="text-accent text-sm truncate">{med.dosage}</p>
                    <p className="text-mutedText text-sm mt-1 truncate">{med.frequency}</p>
                  </div>
                  
                  <div className="flex gap-2 shrink-0">
                    {med.labelPhotoData && (
                      <button 
                        onClick={() => onViewImage(med.labelPhotoData!)}
                        className="p-2 text-mutedText hover:text-accent hover:bg-surface-hover rounded-full transition-colors"
                        aria-label="View Label"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    )}
                    <button 
                      onClick={() => onEditMedication(med.id)}
                      className="p-2 text-mutedText hover:text-accent hover:bg-surface-hover rounded-full transition-colors"
                      aria-label="Edit Medication"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* FAB for Meds */}
      {activeTab === 'meds' && (
        <button
          onClick={onAddMedication}
          className="fixed bottom-6 right-6 h-14 px-6 bg-accent hover:opacity-90 rounded-full flex items-center gap-2 shadow-lg shadow-sky-900/20 transition-transform active:scale-95 text-white font-semibold"
        >
          <Plus className="w-5 h-5" />
          <span>Add Med</span>
        </button>
      )}
    </div>
  );
};

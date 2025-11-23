import React, { useState, useEffect } from 'react';
import { AppState, ViewState, Person, Medication, SettingsState } from './types';
import { PinPad } from './components/PinPad';
import { Dashboard } from './components/Dashboard';
import { PersonDetail } from './components/PersonDetail';
import { Scanner } from './components/Scanner';
import { Settings } from './components/Settings';
import { Terms } from './components/Terms';
import { X, Save, Camera, Trash2, Maximize2, Download } from 'lucide-react';

// Storage Keys
const STORAGE_KEY_PEOPLE = 'fch_secure_people';
const STORAGE_KEY_MEDS = 'fch_secure_meds';

const INITIAL_FORM_STATE = {
  name: '',
  dob: '',
  bloodType: '',
  insuranceProvider: '',
  policyNumber: '',
  medicalConditions: '',
  allergies: '',
  primaryPhysician: '',
  physicianContact: ''
};

const INITIAL_MED_FORM = {
  name: '',
  dosage: '',
  frequency: ''
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    view: ViewState.LOCKED,
    people: [],
    medications: [],
    documents: [],
    activePersonId: null,
    isSetup: false,
    settings: {
      theme: 'dark',
      highContrast: false,
      largeText: false
    }
  });

  // Apply global theme classes
  useEffect(() => {
    const root = document.documentElement;
    
    // Theme
    if (state.settings.theme === 'light') {
      root.classList.add('light-mode');
    } else {
      root.classList.remove('light-mode');
    }

    // Contrast
    if (state.settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Text Size
    if (state.settings.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }
  }, [state.settings]);

  // Persist data changes when unlocked
  useEffect(() => {
    if (state.view !== ViewState.LOCKED) {
      try {
        localStorage.setItem(STORAGE_KEY_PEOPLE, JSON.stringify(state.people));
        localStorage.setItem(STORAGE_KEY_MEDS, JSON.stringify(state.medications));
      } catch (e) {
        console.error("Failed to save to local storage", e);
      }
    }
  }, [state.people, state.medications, state.view]);

  // Simulate loading encrypted data on unlock
  const handleUnlock = () => {
    let loadedPeople: Person[] = [];
    let loadedMeds: Medication[] = [];

    try {
      const storedPeople = localStorage.getItem(STORAGE_KEY_PEOPLE);
      const storedMeds = localStorage.getItem(STORAGE_KEY_MEDS);
      if (storedPeople) loadedPeople = JSON.parse(storedPeople);
      if (storedMeds) loadedMeds = JSON.parse(storedMeds);
    } catch (e) {
      console.error("Failed to load from local storage", e);
    }

    setState(prev => ({
      ...prev,
      view: ViewState.DASHBOARD,
      people: loadedPeople,
      medications: loadedMeds
    }));
  };

  // --- GLOBAL BACKUP FUNCTION ---
  const handleBackup = () => {
    // 1. Gather all data
    const backupData = {
      [STORAGE_KEY_PEOPLE]: localStorage.getItem(STORAGE_KEY_PEOPLE),
      [STORAGE_KEY_MEDS]: localStorage.getItem(STORAGE_KEY_MEDS),
      // Add other keys here if you have them (e.g. settings)
      'fch_settings': JSON.stringify(state.settings)
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    
    // 2. Create download link
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().slice(0, 10);
    link.download = `FamilyCare_Backup_${date}.json`;
    
    // 3. Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Optional: Show a tiny alert or toast
    alert("Backup saved to your Downloads folder!");
  };

  const handleSelectPerson = (id: string) => {
    setState(prev => ({ ...prev, view: ViewState.PERSON_DETAIL, activePersonId: id }));
  };

  const handleBack = () => {
    setState(prev => ({ ...prev, view: ViewState.DASHBOARD, activePersonId: null }));
  };

  const handleStartCamera = () => {
    setState(prev => ({ ...prev, view: ViewState.SCAN_MEDICATION }));
  };

  const handleOpenSettings = () => {
    setState(prev => ({ ...prev, view: ViewState.SETTINGS }));
  };

  const handleUpdateSettings = (newSettings: SettingsState) => {
    setState(prev => ({ ...prev, settings: newSettings }));
  };

  // --- Medication Form Logic ---
  const [showMedForm, setShowMedForm] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [medFormData, setMedFormData] = useState(INITIAL_MED_FORM);
  const [tempMedImage, setTempMedImage] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const handleAddMedicationClick = () => {
    setEditingMedId(null);
    setMedFormData(INITIAL_MED_FORM);
    setTempMedImage(null);
    setShowMedForm(true);
  };

  const handleScanResult = (image: string) => {
    setTempMedImage(image);
    setState(prev => ({ ...prev, view: ViewState.PERSON_DETAIL }));
    setShowMedForm(true);
  };

  const handleMedInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMedFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditMedication = (medId: string) => {
    const med = state.medications.find(m => m.id === medId);
    if (med) {
      setEditingMedId(medId);
      setMedFormData({
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency
      });
      setTempMedImage(med.labelPhotoData || null);
      setShowMedForm(true);
    }
  };

  const closeMedForm = () => {
    setShowMedForm(false);
    setEditingMedId(null);
    setMedFormData(INITIAL_MED_FORM);
    setTempMedImage(null);
  };

  const handleMedFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.activePersonId) return;

    if (editingMedId) {
      setState(prev => ({
        ...prev,
        medications: prev.medications.map(m => m.id === editingMedId ? {
          ...m,
          name: medFormData.name,
          dosage: medFormData.dosage,
          frequency: medFormData.frequency,
          labelPhotoData: tempMedImage || m.labelPhotoData
        } : m)
      }));
    } else {
      const newMed: Medication = {
        id: Date.now().toString(),
        personId: state.activePersonId,
        name: medFormData.name,
        dosage: medFormData.dosage,
        frequency: medFormData.frequency,
        labelPhotoData: tempMedImage || undefined
      };
      setState(prev => ({
        ...prev,
        medications: [...prev.medications, newMed]
      }));
    }

    closeMedForm();
  };

  // --- Person Form Logic ---
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddPersonClick = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM_STATE);
    setShowPersonForm(true);
  };

  const handleEditPersonClick = () => {
    const person = state.people.find(p => p.id === state.activePersonId);
    if (person) {
      setEditingId(person.id);
      setFormData({
        name: person.name,
        dob: person.dob,
        bloodType: person.bloodType,
        insuranceProvider: person.insuranceProvider,
        policyNumber: person.policyNumber,
        medicalConditions: person.medicalConditions,
        allergies: person.allergies,
        primaryPhysician: person.primaryPhysician,
        physicianContact: person.physicianContact
      });
      setShowPersonForm(true);
    }
  };

  const handlePersonFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      setState(prev => ({
        ...prev,
        people: prev.people.map(p => 
          p.id === editingId ? { ...p, ...formData } : p
        )
      }));
    } else {
      const newPerson: Person = {
        id: Date.now().toString(),
        ...formData
      };
      setState(prev => ({
        ...prev,
        people: [...prev.people, newPerson]
      }));
    }

    setShowPersonForm(false);
    setEditingId(null);
    setFormData(INITIAL_FORM_STATE);
  };

  // --- Renders ---

  if (state.view === ViewState.LOCKED) {
    return <PinPad onUnlock={handleUnlock} />;
  }

  if (state.view === ViewState.SCAN_MEDICATION) {
    return (
      <Scanner 
        onResult={handleScanResult}
        onCancel={() => setState(prev => ({ ...prev, view: ViewState.PERSON_DETAIL }))}
      />
    );
  }

  if (state.view === ViewState.SETTINGS) {
    return (
      <Settings 
        settings={state.settings}
        onUpdateSettings={handleUpdateSettings}
        onBack={() => setState(prev => ({ ...prev, view: ViewState.DASHBOARD }))}
        onOpenTerms={() => setState(prev => ({ ...prev, view: ViewState.TERMS }))}
      />
    );
  }

  if (state.view === ViewState.TERMS) {
    return (
      <Terms onBack={() => setState(prev => ({ ...prev, view: ViewState.SETTINGS }))} />
    );
  }

  const activePerson = state.people.find(p => p.id === state.activePersonId);
  const activeMeds = state.medications.filter(m => m.personId === state.activePersonId);

  return (
    <div className="min-h-screen bg-primary text-mainText font-sans selection:bg-accent selection:text-white relative">
      
      {/* --- GLOBAL BACKUP BUTTON --- */}
      {/* Positioned absolute top-right, visible in Dashboard & Details */}
      {state.view !== ViewState.LOCKED && (
        <button
          onClick={handleBackup}
          className="absolute top-4 right-16 z-50 p-2 bg-surface/80 hover:bg-surface border border-borderColor rounded-full text-accent shadow-sm backdrop-blur-sm transition-all hover:scale-105"
          title="Download Backup"
        >
          <Download className="w-5 h-5" />
        </button>
      )}

      {state.view === ViewState.DASHBOARD && (
        <Dashboard 
          people={state.people}
          onAddPerson={handleAddPersonClick}
          onSelectPerson={handleSelectPerson}
          onOpenSettings={handleOpenSettings}
        />
      )}
      
      {state.view === ViewState.PERSON_DETAIL && activePerson && (
        <PersonDetail 
          person={activePerson}
          medications={activeMeds}
          onBack={handleBack}
          onAddMedication={handleAddMedicationClick}
          onEdit={handleEditPersonClick}
          onViewImage={(img) => setViewingImage(img)}
          onEditMedication={handleEditMedication}
        />
      )}

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col justify-center items-center" onClick={() => setViewingImage(null)}>
          
          {/* Remove Button (Only shown when editing/adding medication and viewing the temp image) */}
          {showMedForm && viewingImage === tempMedImage && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setTempMedImage(null);
                setViewingImage(null);
              }}
              className="absolute top-4 left-4 z-[70] bg-red-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-medium">Remove</span>
            </button>
          )}

          {/* Close Button */}
          <button 
            onClick={() => setViewingImage(null)}
            className="absolute top-4 right-4 z-[70] text-white/80 hover:text-white bg-black/40 hover:bg-black/60 p-2 rounded-full backdrop-blur-sm transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <img 
            src={`data:image/jpeg;base64,${viewingImage}`} 
            alt="Full size label" 
            className="max-w-full max-h-full object-contain p-1"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
          />
        </div>
      )}

      {/* Medication Form Modal */}
      {showMedForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface p-6 rounded-2xl w-full max-w-sm border border-borderColor shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-mainText">{editingMedId ? 'Edit Medication' : 'Add Medication'}</h3>
              <button onClick={closeMedForm} className="text-mutedText hover:text-mainText"><X className="w-6 h-6" /></button>
            </div>
            
            {/* Image Capture Section */}
            <div className="mb-5">
              {tempMedImage ? (
                <div 
                  onClick={() => setViewingImage(tempMedImage)}
                  className="relative w-full h-40 bg-black rounded-xl overflow-hidden border border-borderColor group cursor-pointer hover:opacity-90 transition-all shadow-md"
                >
                  <img src={`data:image/jpeg;base64,${tempMedImage}`} alt="Captured Label" className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
                  
                  <div className="absolute bottom-2 right-2 text-xs text-white bg-black/60 px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
                    <Maximize2 className="w-3 h-3" /> Tap to view
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleStartCamera}
                  className="w-full h-32 border-2 border-dashed border-borderColor rounded-xl flex flex-col items-center justify-center text-mutedText hover:text-accent hover:border-accent transition-colors bg-surface-hover/30"
                >
                  <div className="p-3 bg-surface-hover rounded-full mb-2">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium">Add Photo of Label</span>
                </button>
              )}
            </div>

            <form onSubmit={handleMedFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-mutedText mb-1">Medication Name</label>
                <input 
                  type="text" 
                  name="name"
                  required
                  autoFocus
                  value={medFormData.name}
                  onChange={handleMedInputChange}
                  className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="e.g. Lisinopril"
                />
              </div>
              <div>
                <label className="block text-sm text-mutedText mb-1">Dosage</label>
                <input 
                  type="text" 
                  name="dosage"
                  value={medFormData.dosage}
                  onChange={handleMedInputChange}
                  className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="e.g. 10mg"
                />
              </div>
              <div>
                <label className="block text-sm text-mutedText mb-1">Frequency</label>
                <input 
                  type="text" 
                  name="frequency"
                  value={medFormData.frequency}
                  onChange={handleMedInputChange}
                  className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="e.g. Once daily"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-accent text-white font-bold py-3 rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> {editingMedId ? 'Update Medication' : 'Save Medication'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Person Form Modal */}
      {showPersonForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface p-6 rounded-2xl w-full max-w-md border border-borderColor shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-mainText">
                {editingId ? 'Edit Profile' : 'New Profile'}
              </h3>
              <button onClick={() => setShowPersonForm(false)} className="text-mutedText hover:text-mainText"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handlePersonFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-mutedText mb-1">Full Name</label>
                <input 
                  type="text" 
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="e.g. Alex Smith"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-mutedText mb-1">Date of Birth</label>
                  <input 
                    type="date" 
                    name="dob"
                    required
                    value={formData.dob}
                    onChange={handleInputChange}
                    className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:dark]"
                    style={state.settings.theme === 'light' ? { colorScheme: 'light' } : { colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="block text-sm text-mutedText mb-1">Blood Type</label>
                  <select 
                    name="bloodType"
                    value={formData.bloodType}
                    onChange={handleInputChange}
                    className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Select...</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              {/* Medical Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="block text-sm text-mutedText mb-1">Known Allergies</label>
                    <input 
                      type="text" 
                      name="allergies"
                      value={formData.allergies}
                      onChange={handleInputChange}
                      className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      placeholder="e.g. Penicillin, Peanuts"
                    />
                </div>
                <div className="col-span-2">
                    <label className="block text-sm text-mutedText mb-1">Medical Conditions</label>
                    <textarea 
                      name="medicalConditions"
                      value={formData.medicalConditions}
                      onChange={handleInputChange}
                      className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none h-20"
                      placeholder="e.g. Asthma, Diabetes Type 2"
                    />
                </div>
              </div>

              <div className="border-t border-borderColor pt-4">
                <h4 className="text-sm font-semibold text-mainText mb-3">Primary Care Physician</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-mutedText mb-1 uppercase">Doctor Name</label>
                    <input 
                      type="text" 
                      name="primaryPhysician"
                      value={formData.primaryPhysician}
                      onChange={handleInputChange}
                      className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      placeholder="Dr. Jane Doe"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-mutedText mb-1 uppercase">Contact Phone</label>
                    <input 
                      type="tel" 
                      name="physicianContact"
                      value={formData.physicianContact}
                      onChange={handleInputChange}
                      className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-borderColor pt-4">
                <h4 className="text-sm font-semibold text-mainText mb-3">Insurance Details</h4>
                <div>
                  <label className="block text-sm text-mutedText mb-1">Provider</label>
                  <input 
                    type="text" 
                    name="insuranceProvider"
                    value={formData.insuranceProvider}
                    onChange={handleInputChange}
                    className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="e.g. Blue Cross"
                  />
                </div>

                <div className="mt-3">
                  <label className="block text-sm text-mutedText mb-1">Policy Number</label>
                  <input 
                    type="text" 
                    name="policyNumber"
                    value={formData.policyNumber}
                    onChange={handleInputChange}
                    className="w-full bg-surface-hover border border-borderColor rounded-lg p-3 text-mainText focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="e.g. XJ-9922-00"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-accent text-white font-bold py-3 rounded-lg hover:opacity-90 transition-colors shadow-lg shadow-sky-900/20"
                >
                  {editingId ? 'Save Changes' : 'Create Secure Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

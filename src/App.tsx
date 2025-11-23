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
        <div className="fixed inset-0 bg-

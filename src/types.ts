
export interface Person {
  id: string;
  name: string;
  dob: string;
  bloodType: string;
  insuranceProvider: string;
  policyNumber: string;
  medicalConditions: string;
  allergies: string;
  primaryPhysician: string;
  physicianContact: string;
}

export interface Medication {
  id: string;
  personId: string;
  name: string;
  dosage: string;
  frequency: string;
  labelPhotoData?: string; // Base64
}

export interface Document {
  id: string;
  personId: string;
  type: 'Insurance' | 'ID' | 'Other';
  frontPhotoData?: string;
}

export enum ViewState {
  LOCKED,
  DASHBOARD,
  PERSON_DETAIL,
  ADD_PERSON,
  SCAN_MEDICATION,
  SETTINGS,
  TERMS
}

export interface SettingsState {
  theme: 'light' | 'dark';
  highContrast: boolean;
  largeText: boolean;
}

export interface AppState {
  view: ViewState;
  people: Person[];
  medications: Medication[];
  documents: Document[];
  activePersonId: string | null;
  isSetup: boolean; // False if no PIN is set
  settings: SettingsState;
}
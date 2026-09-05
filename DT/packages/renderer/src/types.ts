import type { PersonDto } from '@familycarehub/shared-types';

// The renderer's Person is exactly the API's PersonDto.
export type Person = PersonDto;

export interface Medication {
  id: string;
  personId: string;
  name: string;
  dosage: string;
  frequency: string;
  /** Server-side filename of the label photo (null if none). */
  labelImageFile?: string | null;
  /** Base64 payload hydrated from the API for display. */
  labelPhotoData?: string;
}

export interface Document {
  id: string;
  personId: string;
  type: 'Insurance' | 'ID' | 'Other';
  frontPhotoData?: string;
}

export const ViewState = {
  LOCKED: 'LOCKED',
  DASHBOARD: 'DASHBOARD',
  PERSON_DETAIL: 'PERSON_DETAIL',
  ADD_PERSON: 'ADD_PERSON',
  SCAN_MEDICATION: 'SCAN_MEDICATION',
  SETTINGS: 'SETTINGS',
  TERMS: 'TERMS'
} as const;

export type ViewState = typeof ViewState[keyof typeof ViewState];

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
  settings: SettingsState;
}

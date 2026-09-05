// DTOs shared between the API server and the renderer.
// Field shapes intentionally mirror the legacy localStorage models so the
// renderer swap and the legacy-backup import stay 1:1.

export interface PersonDto {
  id: string;
  name: string;
  dob: string;
  bloodType: string;
  insuranceProvider: string;
  policyNumber: string;
  /** Free-text, matching the legacy PWA shape (not an array). */
  medicalConditions: string;
  /** Free-text, matching the legacy PWA shape (not an array). */
  allergies: string;
  primaryPhysician: string;
  physicianContact: string;
}

export type PersonInput = Omit<PersonDto, 'id'>;

export interface MedicationDto {
  id: string;
  personId: string;
  name: string;
  dosage: string;
  frequency: string;
  /**
   * Filename of the label photo on the host, or null.
   * Fetch via GET /api/images/:personId/:filename (authenticated).
   */
  labelImageFile: string | null;
}

export interface MedicationInput {
  name: string;
  dosage: string;
  frequency: string;
}

export type DocumentType = 'Insurance' | 'ID' | 'Other';

export interface DocumentDto {
  id: string;
  personId: string;
  type: DocumentType;
  frontImageFile: string | null;
}

export type UserRole = 'admin' | 'member';

export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  householdId: string;
  householdName: string;
  /** Share this code with family members so they can join the household. */
  inviteCode: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

export interface RegisterCreateRequest {
  mode: 'create';
  householdName: string;
  username: string;
  password: string;
  displayName: string;
}

export interface RegisterJoinRequest {
  mode: 'join';
  inviteCode: string;
  username: string;
  password: string;
  displayName: string;
}

export type RegisterRequest = RegisterCreateRequest | RegisterJoinRequest;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface HealthResponse {
  status: 'ok';
  app: 'family-care-hub';
  version: string;
}

export interface ImportLegacyResult {
  people: number;
  medications: number;
  images: number;
}

/**
 * Shape of the legacy PWA's FamilyCare_Backup_*.json export:
 * localStorage keys mapped to their raw string values.
 */
export interface LegacyBackupFile {
  fch_secure_people?: string | null;
  fch_secure_meds?: string | null;
  fch_settings?: string | null;
  [key: string]: string | null | undefined;
}

export interface ApiError {
  error: string;
}

/**
 * Full household export: every person, medication, and document, with
 * photos embedded as base64 so the whole household moves in one file.
 */
export interface HouseholdExportMedication {
  name: string;
  dosage: string;
  frequency: string;
  labelPhotoBase64: string | null;
}

export interface HouseholdExportDocument {
  type: DocumentType;
  frontImageBase64: string | null;
}

export interface HouseholdExportPerson extends PersonInput {
  medications: HouseholdExportMedication[];
  documents: HouseholdExportDocument[];
}

export interface HouseholdExport {
  format: 'family-care-hub-export';
  version: 1;
  exportedAt: string;
  people: HouseholdExportPerson[];
}

export interface ImportResult {
  people: number;
  medications: number;
  documents: number;
  images: number;
}

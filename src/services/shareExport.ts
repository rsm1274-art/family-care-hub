import type { Document, Medication, Person } from '../types';

/**
 * A shareable export is plain JSON, not sealed by this device's vault --
 * unlike the locked backup (see App.tsx handleBackup), it is meant to be
 * opened by someone else's app (a sibling's phone, the desktop app). The
 * shape matches the Family Care Hub desktop app's household export exactly,
 * so files move freely between the two.
 */

export const SHARE_FORMAT = 'family-care-hub-export';
export const SHARE_VERSION = 1;

export interface ShareMedication {
  name: string;
  dosage: string;
  frequency: string;
  labelPhotoBase64: string | null;
}

export interface ShareDocument {
  type: Document['type'];
  frontImageBase64: string | null;
}

export interface SharePerson {
  name: string;
  dob: string;
  bloodType: string;
  insuranceProvider: string;
  policyNumber: string;
  medicalConditions: string;
  allergies: string;
  primaryPhysician: string;
  physicianContact: string;
  medications: ShareMedication[];
  documents: ShareDocument[];
}

export interface ShareExport {
  format: typeof SHARE_FORMAT;
  version: typeof SHARE_VERSION;
  exportedAt: string;
  people: SharePerson[];
}

export function isShareExport(data: unknown): data is ShareExport {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as Record<string, unknown>).format === SHARE_FORMAT &&
    Array.isArray((data as Record<string, unknown>).people)
  );
}

/** Builds a shareable export containing only the chosen people. */
export function buildShareExport(
  people: Person[],
  medications: Medication[],
  documents: Document[],
  personIds: string[]
): ShareExport {
  const selected = people.filter((p) => personIds.includes(p.id));
  return {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    exportedAt: new Date().toISOString(),
    people: selected.map((p) => ({
      name: p.name,
      dob: p.dob,
      bloodType: p.bloodType,
      insuranceProvider: p.insuranceProvider,
      policyNumber: p.policyNumber,
      medicalConditions: p.medicalConditions,
      allergies: p.allergies,
      primaryPhysician: p.primaryPhysician,
      physicianContact: p.physicianContact,
      medications: medications
        .filter((m) => m.personId === p.id)
        .map((m) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          labelPhotoBase64: m.labelPhotoData ?? null,
        })),
      documents: documents
        .filter((d) => d.personId === p.id)
        .map((d) => ({
          type: d.type,
          frontImageBase64: d.frontPhotoData ?? null,
        })),
    })),
  };
}

export interface ApplyShareResult {
  people: Person[];
  medications: Medication[];
  documents: Document[];
  counts: { people: number; medications: number; documents: number };
}

/** Adds everyone in a shareable export as new people -- never overwrites. */
export function applyShareImport(
  data: ShareExport,
  existingPeople: Person[],
  existingMedications: Medication[],
  existingDocuments: Document[]
): ApplyShareResult {
  const newPeople: Person[] = [];
  const newMedications: Medication[] = [];
  const newDocuments: Document[] = [];

  for (const sp of data.people) {
    const personId = crypto.randomUUID();
    newPeople.push({
      id: personId,
      name: sp.name || 'Unnamed',
      dob: sp.dob ?? '',
      bloodType: sp.bloodType ?? '',
      insuranceProvider: sp.insuranceProvider ?? '',
      policyNumber: sp.policyNumber ?? '',
      medicalConditions: sp.medicalConditions ?? '',
      allergies: sp.allergies ?? '',
      primaryPhysician: sp.primaryPhysician ?? '',
      physicianContact: sp.physicianContact ?? '',
    });

    for (const sm of sp.medications ?? []) {
      newMedications.push({
        id: crypto.randomUUID(),
        personId,
        name: sm.name || 'Unnamed medication',
        dosage: sm.dosage ?? '',
        frequency: sm.frequency ?? '',
        labelPhotoData: sm.labelPhotoBase64 ?? undefined,
      });
    }

    for (const sd of sp.documents ?? []) {
      newDocuments.push({
        id: crypto.randomUUID(),
        personId,
        type: (['Insurance', 'ID', 'Other'] as const).includes(sd.type) ? sd.type : 'Other',
        frontPhotoData: sd.frontImageBase64 ?? undefined,
      });
    }
  }

  return {
    people: [...existingPeople, ...newPeople],
    medications: [...existingMedications, ...newMedications],
    documents: [...existingDocuments, ...newDocuments],
    counts: {
      people: newPeople.length,
      medications: newMedications.length,
      documents: newDocuments.length,
    },
  };
}

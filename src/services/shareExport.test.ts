import { describe, it, expect } from 'vitest';
import { buildShareExport, applyShareImport, isShareExport, SHARE_FORMAT } from './shareExport';
import type { Person, Medication, Document } from '../types';

const person = (id: string, name: string): Person => ({
  id, name, dob: '1990-01-01', bloodType: 'O+', insuranceProvider: '', policyNumber: '',
  medicalConditions: '', allergies: '', primaryPhysician: '', physicianContact: '',
});

const med = (id: string, personId: string, name: string, photo?: string): Medication => ({
  id, personId, name, dosage: '10mg', frequency: 'Once daily', labelPhotoData: photo,
});

const doc = (id: string, personId: string, photo?: string): Document => ({
  id, personId, type: 'Insurance', frontPhotoData: photo,
});

describe('buildShareExport', () => {
  it('includes only the selected people, not everyone', () => {
    const people = [person('p1', 'Dad'), person('p2', 'Kid')];
    const meds = [med('m1', 'p1', 'Lisinopril'), med('m2', 'p2', 'Vitamins')];
    const docs = [doc('d1', 'p1'), doc('d2', 'p2')];

    const share = buildShareExport(people, meds, docs, ['p1']);

    expect(share.people).toHaveLength(1);
    expect(share.people[0].name).toBe('Dad');
    expect(share.people.map(p => p.name)).not.toContain('Kid');
  });

  it('nests each person\'s own medications and documents, not another person\'s', () => {
    const people = [person('p1', 'Dad'), person('p2', 'Kid')];
    const meds = [med('m1', 'p1', 'Lisinopril'), med('m2', 'p2', 'Vitamins')];
    const docs = [doc('d1', 'p1'), doc('d2', 'p2')];

    const share = buildShareExport(people, meds, docs, ['p1', 'p2']);

    const dad = share.people.find(p => p.name === 'Dad')!;
    const kid = share.people.find(p => p.name === 'Kid')!;
    expect(dad.medications.map(m => m.name)).toEqual(['Lisinopril']);
    expect(kid.medications.map(m => m.name)).toEqual(['Vitamins']);
  });

  it('carries photos through as base64, null when absent', () => {
    const people = [person('p1', 'Dad')];
    const meds = [med('m1', 'p1', 'Lisinopril', 'aGVsbG8=')];
    const docs = [doc('d1', 'p1')];

    const share = buildShareExport(people, meds, docs, ['p1']);

    expect(share.people[0].medications[0].labelPhotoBase64).toBe('aGVsbG8=');
    expect(share.people[0].documents[0].frontImageBase64).toBeNull();
  });

  it('stamps the format/version the desktop app also uses', () => {
    const share = buildShareExport([], [], [], []);
    expect(share.format).toBe(SHARE_FORMAT);
    expect(share.version).toBe(1);
  });
});

describe('isShareExport', () => {
  it('accepts a well-formed export', () => {
    expect(isShareExport(buildShareExport([], [], [], []))).toBe(true);
  });

  it('rejects a locked-backup file (wrong shape)', () => {
    expect(isShareExport({ fch_secure_people: '[]', fch_secure_meds: '[]' })).toBe(false);
  });

  it('rejects garbage', () => {
    expect(isShareExport(null)).toBe(false);
    expect(isShareExport('a string')).toBe(false);
    expect(isShareExport({ format: SHARE_FORMAT })).toBe(false); // missing people[]
  });
});

describe('applyShareImport', () => {
  it('adds imported people without touching existing ones', () => {
    const existingPeople = [person('existing', 'Mom')];
    const share = buildShareExport([person('p1', 'Dad')], [], [], ['p1']);

    const result = applyShareImport(share, existingPeople, [], []);

    expect(result.people.map(p => p.name).sort()).toEqual(['Dad', 'Mom']);
    expect(result.counts).toEqual({ people: 1, medications: 0, documents: 0 });
  });

  it('gives imported people new local ids rather than reusing the sender\'s', () => {
    const share = buildShareExport([person('sender-id', 'Dad')], [], [], ['sender-id']);
    const result = applyShareImport(share, [], [], []);
    expect(result.people[0].id).not.toBe('sender-id');
  });

  it('attaches imported medications/documents to the newly created person, not a stale id', () => {
    const share = buildShareExport(
      [person('p1', 'Dad')],
      [med('m1', 'p1', 'Lisinopril')],
      [doc('d1', 'p1')],
      ['p1'],
    );

    const result = applyShareImport(share, [], [], []);
    const newPersonId = result.people[0].id;

    expect(result.medications[0].personId).toBe(newPersonId);
    expect(result.documents[0].personId).toBe(newPersonId);
  });
});

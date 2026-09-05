import fs from 'fs';
import { Router } from 'express';
import type {
  DocumentType,
  HouseholdExport,
  HouseholdExportDocument,
  HouseholdExportMedication,
  HouseholdExportPerson,
  ImportLegacyResult,
  ImportResult,
  LegacyBackupFile,
} from '@familycarehub/shared-types';
import { imagePath, saveBase64Image } from '../imageStore';
import { prisma } from '../prisma';

export const backupRouter = Router();

function readImageBase64(personId: string, filename: string | null): string | null {
  if (!filename) return null;
  try {
    return fs.readFileSync(imagePath(personId, filename)).toString('base64');
  } catch {
    return null; // file missing on disk — export the record without its photo
  }
}

// Shapes as stored by the legacy PWA in localStorage.
interface LegacyPerson {
  id: string;
  name?: string;
  dob?: string;
  bloodType?: string;
  insuranceProvider?: string;
  policyNumber?: string;
  medicalConditions?: string;
  allergies?: string;
  primaryPhysician?: string;
  physicianContact?: string;
}

interface LegacyMedication {
  id: string;
  personId: string;
  name?: string;
  dosage?: string;
  frequency?: string;
  labelPhotoData?: string; // base64
}

function parseJsonArray<T>(raw: string | null | undefined, label: string): T[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Backup field ${label} is not valid JSON`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Backup field ${label} is not an array`);
  }
  return parsed as T[];
}

/**
 * Accepts the legacy PWA's FamilyCare_Backup_*.json file unchanged and
 * imports its contents into the caller's household. Legacy IDs are replaced
 * with server-generated ones; embedded base64 label photos are written to
 * the image store.
 */
backupRouter.post('/import-legacy', async (req, res) => {
  const body = req.body as LegacyBackupFile;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Expected a legacy backup JSON object' });
    return;
  }

  let legacyPeople: LegacyPerson[];
  let legacyMeds: LegacyMedication[];
  try {
    legacyPeople = parseJsonArray<LegacyPerson>(body.fch_secure_people, 'fch_secure_people');
    legacyMeds = parseJsonArray<LegacyMedication>(body.fch_secure_meds, 'fch_secure_meds');
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
    return;
  }

  if (legacyPeople.length === 0 && legacyMeds.length === 0) {
    res.status(400).json({ error: 'Backup contains no people or medications' });
    return;
  }

  const householdId = req.auth!.householdId;
  const idMap = new Map<string, string>(); // legacy person id -> new id
  const result: ImportLegacyResult = { people: 0, medications: 0, images: 0 };

  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  for (const lp of legacyPeople) {
    const person = await prisma.person.create({
      data: {
        householdId,
        name: str(lp.name) || 'Unnamed',
        dob: str(lp.dob),
        bloodType: str(lp.bloodType),
        insuranceProvider: str(lp.insuranceProvider),
        policyNumber: str(lp.policyNumber),
        medicalConditions: str(lp.medicalConditions),
        allergies: str(lp.allergies),
        primaryPhysician: str(lp.primaryPhysician),
        physicianContact: str(lp.physicianContact),
      },
    });
    if (lp.id) idMap.set(String(lp.id), person.id);
    result.people += 1;
  }

  for (const lm of legacyMeds) {
    const personId = idMap.get(String(lm.personId));
    if (!personId) continue; // orphaned medication — nothing to attach it to

    let labelImageFile: string | null = null;
    if (typeof lm.labelPhotoData === 'string' && lm.labelPhotoData) {
      try {
        labelImageFile = saveBase64Image(personId, lm.labelPhotoData);
        result.images += 1;
      } catch {
        // Unreadable photo — import the medication without it.
      }
    }

    await prisma.medication.create({
      data: {
        personId,
        name: str(lm.name) || 'Unnamed medication',
        dosage: str(lm.dosage),
        frequency: str(lm.frequency),
        labelImageFile,
      },
    });
    result.medications += 1;
  }

  res.json(result);
});

/**
 * Full household export: every person, their medications, and their
 * documents, with photos embedded as base64. Meant to move a household to
 * another install (see POST /import).
 */
backupRouter.get('/export', async (req, res) => {
  const householdId = req.auth!.householdId;

  // Optional ?personIds=id1,id2 — export only those people instead of the
  // whole household (e.g. sharing one relative's records with a sibling).
  const personIdsParam = req.query.personIds;
  let personIds: string[] | undefined;
  if (typeof personIdsParam === 'string' && personIdsParam.length > 0) {
    personIds = personIdsParam.split(',').map((id) => id.trim()).filter(Boolean);
  }

  const people = await prisma.person.findMany({
    where: { householdId, ...(personIds ? { id: { in: personIds } } : {}) },
    orderBy: { createdAt: 'asc' },
    include: { medications: true, documents: true },
  });

  if (personIds && people.length !== personIds.length) {
    res.status(404).json({ error: 'One or more selected people were not found' });
    return;
  }

  const exportPeople: HouseholdExportPerson[] = people.map((p) => {
    const medications: HouseholdExportMedication[] = p.medications.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      labelPhotoBase64: readImageBase64(p.id, m.labelImageFile),
    }));
    const documents: HouseholdExportDocument[] = p.documents.map((d) => ({
      type: d.type as DocumentType,
      frontImageBase64: readImageBase64(p.id, d.frontImageFile),
    }));
    return {
      name: p.name,
      dob: p.dob,
      bloodType: p.bloodType,
      insuranceProvider: p.insuranceProvider,
      policyNumber: p.policyNumber,
      medicalConditions: p.medicalConditions,
      allergies: p.allergies,
      primaryPhysician: p.primaryPhysician,
      physicianContact: p.physicianContact,
      medications,
      documents,
    };
  });

  const body: HouseholdExport = {
    format: 'family-care-hub-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    people: exportPeople,
  };
  res.json(body);
});

/**
 * Imports a full household export (see GET /export) into the caller's
 * household. Always adds new records — it does not replace or merge with
 * anything already there.
 */
backupRouter.post('/import', async (req, res) => {
  const body = req.body as HouseholdExport;
  if (!body || body.format !== 'family-care-hub-export' || !Array.isArray(body.people)) {
    res.status(400).json({ error: 'Expected a Family Care Hub export file' });
    return;
  }

  const householdId = req.auth!.householdId;
  const result: ImportResult = { people: 0, medications: 0, documents: 0, images: 0 };
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  for (const ep of body.people) {
    const person = await prisma.person.create({
      data: {
        householdId,
        name: str(ep.name) || 'Unnamed',
        dob: str(ep.dob),
        bloodType: str(ep.bloodType),
        insuranceProvider: str(ep.insuranceProvider),
        policyNumber: str(ep.policyNumber),
        medicalConditions: str(ep.medicalConditions),
        allergies: str(ep.allergies),
        primaryPhysician: str(ep.primaryPhysician),
        physicianContact: str(ep.physicianContact),
      },
    });
    result.people += 1;

    for (const em of ep.medications ?? []) {
      let labelImageFile: string | null = null;
      if (em.labelPhotoBase64) {
        try {
          labelImageFile = saveBase64Image(person.id, em.labelPhotoBase64);
          result.images += 1;
        } catch {
          // Unreadable photo — import the medication without it.
        }
      }
      await prisma.medication.create({
        data: {
          personId: person.id,
          name: str(em.name) || 'Unnamed medication',
          dosage: str(em.dosage),
          frequency: str(em.frequency),
          labelImageFile,
        },
      });
      result.medications += 1;
    }

    for (const ed of ep.documents ?? []) {
      let frontImageFile: string | null = null;
      if (ed.frontImageBase64) {
        try {
          frontImageFile = saveBase64Image(person.id, ed.frontImageBase64);
          result.images += 1;
        } catch {
          // Unreadable photo — import the document without it.
        }
      }
      const type: DocumentType = (['Insurance', 'ID', 'Other'] as DocumentType[]).includes(ed.type)
        ? ed.type
        : 'Other';
      await prisma.document.create({
        data: { personId: person.id, type, frontImageFile },
      });
      result.documents += 1;
    }
  }

  res.json(result);
});

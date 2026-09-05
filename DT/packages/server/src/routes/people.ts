import { Router } from 'express';
import type { PersonInput } from '@familycarehub/shared-types';
import { toMedicationDto, toDocumentDto, toPersonDto } from '../dto';
import { deletePersonImages } from '../imageStore';
import { prisma } from '../prisma';

export const peopleRouter = Router();

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function personData(body: Partial<PersonInput>) {
  return {
    name: str(body.name).trim(),
    dob: str(body.dob),
    bloodType: str(body.bloodType),
    insuranceProvider: str(body.insuranceProvider),
    policyNumber: str(body.policyNumber),
    medicalConditions: str(body.medicalConditions),
    allergies: str(body.allergies),
    primaryPhysician: str(body.primaryPhysician),
    physicianContact: str(body.physicianContact),
  };
}

peopleRouter.get('/', async (req, res) => {
  const people = await prisma.person.findMany({
    where: { householdId: req.auth!.householdId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(people.map(toPersonDto));
});

peopleRouter.post('/', async (req, res) => {
  const data = personData(req.body ?? {});
  if (!data.name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const person = await prisma.person.create({
    data: { ...data, householdId: req.auth!.householdId },
  });
  res.status(201).json(toPersonDto(person));
});

peopleRouter.get('/:id', async (req, res) => {
  const person = await prisma.person.findFirst({
    where: { id: req.params.id, householdId: req.auth!.householdId },
  });
  if (!person) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  res.json(toPersonDto(person));
});

peopleRouter.put('/:id', async (req, res) => {
  const data = personData(req.body ?? {});
  if (!data.name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const { count } = await prisma.person.updateMany({
    where: { id: req.params.id, householdId: req.auth!.householdId },
    data,
  });
  if (count === 0) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  const person = await prisma.person.findUnique({ where: { id: req.params.id } });
  res.json(toPersonDto(person!));
});

peopleRouter.delete('/:id', async (req, res) => {
  const { count } = await prisma.person.deleteMany({
    where: { id: req.params.id, householdId: req.auth!.householdId },
  });
  if (count === 0) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  deletePersonImages(req.params.id);
  res.status(204).end();
});

// --- Nested: medications & documents of a person ---

async function ownedPerson(personId: string, householdId: string) {
  return prisma.person.findFirst({ where: { id: personId, householdId } });
}

peopleRouter.get('/:personId/medications', async (req, res) => {
  const person = await ownedPerson(req.params.personId, req.auth!.householdId);
  if (!person) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  const meds = await prisma.medication.findMany({
    where: { personId: person.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json(meds.map(toMedicationDto));
});

peopleRouter.post('/:personId/medications', async (req, res) => {
  const person = await ownedPerson(req.params.personId, req.auth!.householdId);
  if (!person) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  const name = str(req.body?.name).trim();
  if (!name) {
    res.status(400).json({ error: 'Medication name is required' });
    return;
  }
  const med = await prisma.medication.create({
    data: {
      personId: person.id,
      name,
      dosage: str(req.body?.dosage),
      frequency: str(req.body?.frequency),
    },
  });
  res.status(201).json(toMedicationDto(med));
});

peopleRouter.get('/:personId/documents', async (req, res) => {
  const person = await ownedPerson(req.params.personId, req.auth!.householdId);
  if (!person) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  const docs = await prisma.document.findMany({
    where: { personId: person.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json(docs.map(toDocumentDto));
});

peopleRouter.post('/:personId/documents', async (req, res) => {
  const person = await ownedPerson(req.params.personId, req.auth!.householdId);
  if (!person) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  const type = str(req.body?.type);
  if (!['Insurance', 'ID', 'Other'].includes(type)) {
    res.status(400).json({ error: 'type must be Insurance, ID, or Other' });
    return;
  }
  const doc = await prisma.document.create({
    data: { personId: person.id, type },
  });
  res.status(201).json(toDocumentDto(doc));
});

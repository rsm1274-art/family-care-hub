import { Router } from 'express';
import { toMedicationDto } from '../dto';
import { deleteImage, saveBase64Image } from '../imageStore';
import { prisma } from '../prisma';

export const medicationsRouter = Router();

/** Load a medication only if it belongs to the caller's household. */
async function ownedMedication(medId: string, householdId: string) {
  return prisma.medication.findFirst({
    where: { id: medId, person: { householdId } },
  });
}

medicationsRouter.put('/:id', async (req, res) => {
  const med = await ownedMedication(req.params.id, req.auth!.householdId);
  if (!med) {
    res.status(404).json({ error: 'Medication not found' });
    return;
  }
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : med.name;
  if (!name) {
    res.status(400).json({ error: 'Medication name is required' });
    return;
  }
  const updated = await prisma.medication.update({
    where: { id: med.id },
    data: {
      name,
      dosage: typeof req.body?.dosage === 'string' ? req.body.dosage : med.dosage,
      frequency: typeof req.body?.frequency === 'string' ? req.body.frequency : med.frequency,
    },
  });
  res.json(toMedicationDto(updated));
});

medicationsRouter.delete('/:id', async (req, res) => {
  const med = await ownedMedication(req.params.id, req.auth!.householdId);
  if (!med) {
    res.status(404).json({ error: 'Medication not found' });
    return;
  }
  await prisma.medication.delete({ where: { id: med.id } });
  deleteImage(med.personId, med.labelImageFile);
  res.status(204).end();
});

// Body: { imageBase64: string } — matches what Scanner.tsx produces.
medicationsRouter.post('/:id/image', async (req, res) => {
  const med = await ownedMedication(req.params.id, req.auth!.householdId);
  if (!med) {
    res.status(404).json({ error: 'Medication not found' });
    return;
  }
  const imageBase64 = req.body?.imageBase64;
  if (typeof imageBase64 !== 'string' || !imageBase64) {
    res.status(400).json({ error: 'imageBase64 is required' });
    return;
  }
  let filename: string;
  try {
    filename = saveBase64Image(med.personId, imageBase64);
  } catch {
    res.status(400).json({ error: 'Invalid image payload' });
    return;
  }
  deleteImage(med.personId, med.labelImageFile);
  const updated = await prisma.medication.update({
    where: { id: med.id },
    data: { labelImageFile: filename },
  });
  res.json(toMedicationDto(updated));
});

medicationsRouter.delete('/:id/image', async (req, res) => {
  const med = await ownedMedication(req.params.id, req.auth!.householdId);
  if (!med) {
    res.status(404).json({ error: 'Medication not found' });
    return;
  }
  deleteImage(med.personId, med.labelImageFile);
  const updated = await prisma.medication.update({
    where: { id: med.id },
    data: { labelImageFile: null },
  });
  res.json(toMedicationDto(updated));
});

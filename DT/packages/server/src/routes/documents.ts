import { Router } from 'express';
import { toDocumentDto } from '../dto';
import { deleteImage, saveBase64Image } from '../imageStore';
import { prisma } from '../prisma';

export const documentsRouter = Router();

async function ownedDocument(docId: string, householdId: string) {
  return prisma.document.findFirst({
    where: { id: docId, person: { householdId } },
  });
}

documentsRouter.put('/:id', async (req, res) => {
  const doc = await ownedDocument(req.params.id, req.auth!.householdId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const type = req.body?.type;
  if (!['Insurance', 'ID', 'Other'].includes(type)) {
    res.status(400).json({ error: 'type must be Insurance, ID, or Other' });
    return;
  }
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { type },
  });
  res.json(toDocumentDto(updated));
});

documentsRouter.delete('/:id', async (req, res) => {
  const doc = await ownedDocument(req.params.id, req.auth!.householdId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  await prisma.document.delete({ where: { id: doc.id } });
  deleteImage(doc.personId, doc.frontImageFile);
  res.status(204).end();
});

documentsRouter.post('/:id/image', async (req, res) => {
  const doc = await ownedDocument(req.params.id, req.auth!.householdId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const imageBase64 = req.body?.imageBase64;
  if (typeof imageBase64 !== 'string' || !imageBase64) {
    res.status(400).json({ error: 'imageBase64 is required' });
    return;
  }
  let filename: string;
  try {
    filename = saveBase64Image(doc.personId, imageBase64);
  } catch {
    res.status(400).json({ error: 'Invalid image payload' });
    return;
  }
  deleteImage(doc.personId, doc.frontImageFile);
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { frontImageFile: filename },
  });
  res.json(toDocumentDto(updated));
});

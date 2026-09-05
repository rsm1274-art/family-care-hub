import fs from 'fs';
import { Router } from 'express';
import { imagePath } from '../imageStore';
import { prisma } from '../prisma';

export const imagesRouter = Router();

/**
 * Serve a stored image, but only to members of the household that owns the
 * person. Filenames are server-generated UUIDs; imagePath() basenames both
 * segments so traversal via the URL is not possible.
 */
imagesRouter.get('/:personId/:filename', async (req, res) => {
  const person = await prisma.person.findFirst({
    where: { id: req.params.personId, householdId: req.auth!.householdId },
  });
  if (!person) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const filePath = imagePath(person.id, req.params.filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.type('image/jpeg');
  fs.createReadStream(filePath).pipe(res);
});

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import type { LoginRequest, RegisterRequest } from '@familycarehub/shared-types';
import { signToken } from '../auth';
import { toUserDto } from '../dto';
import { prisma } from '../prisma';

export const authRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;

function newInviteCode(): string {
  // 8 chars, unambiguous alphabet — easy to read out loud to family.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(8), (b) => alphabet[b % alphabet.length]).join('');
}

authRouter.post('/register', async (req, res) => {
  const body = req.body as RegisterRequest;
  const { username, password, displayName } = body;

  if (!USERNAME_RE.test(username || '')) {
    res.status(400).json({ error: 'Username must be 3-32 characters (letters, numbers, . _ -)' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  if (typeof displayName !== 'string' || !displayName.trim()) {
    res.status(400).json({ error: 'Display name is required' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    res.status(409).json({ error: 'That username is already taken' });
    return;
  }

  let householdId: string;
  let role: string;
  if (body.mode === 'create') {
    if (typeof body.householdName !== 'string' || !body.householdName.trim()) {
      res.status(400).json({ error: 'Household name is required' });
      return;
    }
    const household = await prisma.household.create({
      data: { name: body.householdName.trim(), inviteCode: newInviteCode() },
    });
    householdId = household.id;
    role = 'admin';
  } else if (body.mode === 'join') {
    const code = (body.inviteCode || '').trim().toUpperCase();
    const household = await prisma.household.findUnique({ where: { inviteCode: code } });
    if (!household) {
      res.status(404).json({ error: 'No household found for that invite code' });
      return;
    }
    householdId = household.id;
    role = 'member';
  } else {
    res.status(400).json({ error: 'mode must be "create" or "join"' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { householdId, username, passwordHash, displayName: displayName.trim(), role },
    include: { household: true },
  });

  const token = signToken({ userId: user.id, householdId });
  res.status(201).json({ token, user: toUserDto(user, user.household) });
});

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body as LoginRequest;
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { household: true },
  });
  // Uniform error for unknown user vs wrong password.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const token = signToken({ userId: user.id, householdId: user.householdId });
  res.json({ token, user: toUserDto(user, user.household) });
});

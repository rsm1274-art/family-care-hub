import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';

export interface AuthPayload {
  userId: string;
  householdId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

/**
 * JWT auth. Accepts "Authorization: Bearer <token>" or a ?token= query
 * parameter (the latter so <img>-style GETs can authenticate).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  let token: string | undefined;
  if (header?.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length);
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    if (typeof decoded.userId !== 'string' || typeof decoded.householdId !== 'string') {
      throw new Error('malformed payload');
    }
    req.auth = { userId: decoded.userId, householdId: decoded.householdId };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthenticatedUser } from './types.js';

const jwtSecret = process.env.JWT_SECRET ?? '';
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function signToken(user: AuthenticatedUser) {
  return jwt.sign({ email: user.email, role: user.role }, jwtSecret, {
    subject: user.id,
    expiresIn: '7d',
    issuer: 'agri-opportunity-api',
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const value = req.header('authorization');
  if (!value?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  try {
    const payload = jwt.verify(value.slice(7), jwtSecret, {
      issuer: 'agri-opportunity-api',
    });
    if (typeof payload === 'string' || !payload.sub || !payload.email) {
      res.status(401).json({ error: 'Invalid authentication token.' });
      return;
    }
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role === 'admin' ? 'admin' : 'user',
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required.' });
    return;
  }
  next();
}

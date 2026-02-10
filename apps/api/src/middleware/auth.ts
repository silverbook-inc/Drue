import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { NextFunction, Request, Response } from 'express';
import { env } from '../env.js';

const jwks = createRemoteJWKSet(new URL(`${env.supabaseUrl}/auth/v1/.well-known/jwks.json`));

async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: env.supabaseJwtIssuer
  });

  return payload;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const token = authHeader.substring('Bearer '.length);

  try {
    const payload = await verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token', detail: (error as Error).message });
  }
}

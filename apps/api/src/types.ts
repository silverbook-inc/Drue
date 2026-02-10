import { JWTPayload } from 'jose';

export type VerifiedUser = JWTPayload & {
  sub: string;
  email?: string;
};

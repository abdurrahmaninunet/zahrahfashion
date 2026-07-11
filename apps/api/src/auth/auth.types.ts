import { Request } from 'express';
import { Capability } from './capabilities';

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  status: string;
  totpEnabled: boolean;
  capabilities: Set<Capability>;
}

export interface AuthedRequest extends Request {
  user: AuthedUser;
  sessionId: string;
  stepUpUntil: Date | null;
}

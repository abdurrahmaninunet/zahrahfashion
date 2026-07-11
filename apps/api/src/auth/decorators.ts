import { SetMetadata } from '@nestjs/common';
import { Capability } from './capabilities';

export const IS_PUBLIC = 'isPublic';
export const REQUIRED_CAPABILITY = 'requiredCapability';

/** Route requires no session (login, invite acceptance, webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route requires the given capability — FR-RBAC-03, deny-by-default. */
export const Cap = (capability: Capability | Capability[]) =>
  SetMetadata(REQUIRED_CAPABILITY, Array.isArray(capability) ? capability : [capability]);

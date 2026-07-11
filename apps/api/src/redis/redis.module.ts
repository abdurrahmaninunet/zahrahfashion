import { Global, Module } from '@nestjs/common';
import { EphemeralStore } from './ephemeral-store.service';

/** Global so any service can inject EphemeralStore for shared short-lived state. */
@Global()
@Module({
  providers: [EphemeralStore],
  exports: [EphemeralStore],
})
export class RedisModule {}

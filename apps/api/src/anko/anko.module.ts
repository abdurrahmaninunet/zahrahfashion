import { Module } from '@nestjs/common';
import { AnkoService } from './anko.service';
import { AnkoController } from './anko.controller';

@Module({
  controllers: [AnkoController],
  providers: [AnkoService],
  exports: [AnkoService],
})
export class AnkoModule {}

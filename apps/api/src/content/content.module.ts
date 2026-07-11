import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { MediaService } from './media.service';
import { ContentController } from './content.controller';

@Module({
  controllers: [ContentController],
  providers: [ContentService, MediaService],
  exports: [ContentService, MediaService],
})
export class ContentModule {}

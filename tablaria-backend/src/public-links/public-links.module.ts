import { Module } from '@nestjs/common';
import {
  PublicLinksController,
  PublicTableController,
} from './public-links.controller';
import { PublicLinksService } from './public-links.service';

@Module({
  controllers: [PublicLinksController, PublicTableController],
  providers: [PublicLinksService],
})
export class PublicLinksModule {}

import { Module } from '@nestjs/common';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  controllers: [RecordsController],
  providers: [RecordsService],
  // The AI assistant reads through it, with the same permissions (ADR-042).
  exports: [RecordsService],
})
export class RecordsModule {}

import { Module } from '@nestjs/common';
import {
  ImportsController,
  NewTableImportsController,
} from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  controllers: [ImportsController, NewTableImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}

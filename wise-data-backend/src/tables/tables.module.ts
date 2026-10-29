import { Module } from '@nestjs/common';
import {
  OrganizationTablesController,
  TablesController,
} from './tables.controller';
import { TablesService } from './tables.service';

@Module({
  controllers: [TablesController, OrganizationTablesController],
  providers: [TablesService],
})
export class TablesModule {}

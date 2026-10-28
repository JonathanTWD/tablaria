import { Module } from '@nestjs/common';
import {
  InvitationsController,
  TableSharingController,
} from './sharing.controller';
import { SharingService } from './sharing.service';

@Module({
  controllers: [TableSharingController, InvitationsController],
  providers: [SharingService],
})
export class SharingModule {}

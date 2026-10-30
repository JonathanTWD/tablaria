import { Module } from '@nestjs/common';
import { InvitationSender } from './invitations';
import {
  InvitationsController,
  TableSharingController,
} from './sharing.controller';
import { SharingService } from './sharing.service';

@Module({
  controllers: [TableSharingController, InvitationsController],
  providers: [SharingService, InvitationSender],
  exports: [InvitationSender],
})
export class SharingModule {}

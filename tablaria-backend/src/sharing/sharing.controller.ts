import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type AcceptedInvitation,
  type InvitationPreview,
  invitationTokenSchema,
  type InvitationTokenInput,
  inviteSchema,
  type PendingInvitation,
  type TableShareMember,
  type TableSharing,
  updateShareSchema,
} from '@tablaria/shared';
import type { z } from 'zod';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SharingService } from './sharing.service';

/** Each invitation sends an email, so it gets a tighter limit than the API default. */
export const INVITE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('tables/:tableId')
export class TableSharingController {
  constructor(private readonly sharing: SharingService) {}

  @Get('sharing')
  get(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<TableSharing> {
    return this.sharing.sharing(userId, tableId);
  }

  @Post('invitations')
  @Throttle(INVITE_THROTTLE)
  invite(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body(new ZodValidationPipe(inviteSchema))
    body: z.output<typeof inviteSchema>,
  ): Promise<PendingInvitation> {
    return this.sharing.invite(userId, tableId, body);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    return this.sharing.revokeInvitation(userId, tableId, invitationId);
  }

  @Patch('shares/:memberId')
  updateShare(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body(new ZodValidationPipe(updateShareSchema))
    body: z.output<typeof updateShareSchema>,
  ): Promise<TableShareMember> {
    return this.sharing.updateShare(userId, tableId, memberId, body.role);
  }

  @Delete('shares/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeShare(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    return this.sharing.removeShare(userId, tableId, memberId);
  }
}

/** The token travels in the body, never in a URL that could end up in logs. */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly sharing: SharingService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(invitationTokenSchema))
    body: InvitationTokenInput,
  ): Promise<InvitationPreview> {
    return this.sharing.preview(userId, body.token);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(invitationTokenSchema))
    body: InvitationTokenInput,
  ): Promise<AcceptedInvitation> {
    return this.sharing.accept(userId, body.token);
  }
}

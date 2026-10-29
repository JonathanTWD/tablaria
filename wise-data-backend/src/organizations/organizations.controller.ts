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
  type OrganizationDetail,
  organizationInputSchema,
  organizationInviteSchema,
  type OrganizationMember,
  type OrganizationSummary,
  type PendingInvitation,
  updateMemberSchema,
} from '@wisedata/shared';
import type { z } from 'zod';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { INVITE_THROTTLE } from '../sharing/sharing.controller';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(@CurrentUserId() userId: string): Promise<OrganizationSummary[]> {
    return this.organizations.list(userId);
  }

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(organizationInputSchema))
    body: z.output<typeof organizationInputSchema>,
  ): Promise<OrganizationDetail> {
    return this.organizations.create(userId, body);
  }

  @Get(':organizationId')
  get(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<OrganizationDetail> {
    return this.organizations.get(userId, organizationId);
  }

  @Patch(':organizationId')
  rename(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body(new ZodValidationPipe(organizationInputSchema))
    body: z.output<typeof organizationInputSchema>,
  ): Promise<OrganizationDetail> {
    return this.organizations.rename(userId, organizationId, body);
  }

  @Delete(':organizationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<void> {
    return this.organizations.remove(userId, organizationId);
  }

  @Patch(':organizationId/members/:memberId')
  updateMember(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body(new ZodValidationPipe(updateMemberSchema))
    body: z.output<typeof updateMemberSchema>,
  ): Promise<OrganizationMember> {
    return this.organizations.updateMember(
      userId,
      organizationId,
      memberId,
      body.role,
    );
  }

  @Delete(':organizationId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    return this.organizations.removeMember(userId, organizationId, memberId);
  }

  @Post(':organizationId/invitations')
  @Throttle(INVITE_THROTTLE)
  invite(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body(new ZodValidationPipe(organizationInviteSchema))
    body: z.output<typeof organizationInviteSchema>,
  ): Promise<PendingInvitation> {
    return this.organizations.invite(userId, organizationId, body);
  }

  @Delete(':organizationId/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeInvitation(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    return this.organizations.revokeInvitation(
      userId,
      organizationId,
      invitationId,
    );
  }
}

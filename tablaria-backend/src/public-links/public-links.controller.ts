import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type CreatedPublicLink,
  PUBLIC_TOKEN_HEADER,
  type PublicLinkStatus,
  type PublicTable,
  type RecordListQuery,
  recordListQuerySchema,
} from '@tablaria/shared';
import type { Response } from 'express';
import { CurrentUserId, Public } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PublicLinksService } from './public-links.service';

/** Anyone may try links, so guesses are slowed down more than the API default. */
const PUBLIC_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

@Controller('tables/:tableId/public-link')
export class PublicLinksController {
  constructor(private readonly links: PublicLinksService) {}

  @Get()
  status(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<PublicLinkStatus> {
    return this.links.status(userId, tableId);
  }

  @Put()
  create(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<CreatedPublicLink> {
    return this.links.create(userId, tableId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<void> {
    return this.links.remove(userId, tableId);
  }
}

@Controller('public/table')
export class PublicTableController {
  constructor(private readonly links: PublicLinksService) {}

  @Get()
  @Public()
  @Throttle(PUBLIC_THROTTLE)
  read(
    @Headers(PUBLIC_TOKEN_HEADER) token: string | undefined,
    @Query(new ZodValidationPipe(recordListQuerySchema)) query: RecordListQuery,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicTable> {
    // Shared data: never kept by caches or listed by search engines.
    response.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    return this.links.read(token, query);
  }
}

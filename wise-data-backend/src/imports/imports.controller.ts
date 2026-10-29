import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type ImportCheck,
  type ImportResult,
  importSchema,
} from '@wisedata/shared';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { ImportRequest } from './import-analysis';
import { ImportsService } from './imports.service';

/** Each request carries up to a whole file, so it gets a tighter limit. */
const IMPORT_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('tables/:tableId/import')
@Throttle(IMPORT_THROTTLE)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('check')
  @HttpCode(HttpStatus.OK)
  check(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body(new ZodValidationPipe(importSchema)) body: ImportRequest,
  ): Promise<ImportCheck> {
    return this.imports.check(userId, tableId, body);
  }

  @Post()
  import(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body(new ZodValidationPipe(importSchema)) body: ImportRequest,
  ): Promise<ImportResult> {
    return this.imports.import(userId, tableId, body);
  }
}

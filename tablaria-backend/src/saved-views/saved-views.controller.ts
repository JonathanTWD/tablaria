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
import {
  type SavedView,
  type SavedViewInput,
  savedViewInputSchema,
  type SavedViewUpdate,
  savedViewUpdateSchema,
} from '@tablaria/shared';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SavedViewsService } from './saved-views.service';

@Controller('tables/:tableId/views')
export class SavedViewsController {
  constructor(private readonly views: SavedViewsService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<SavedView[]> {
    return this.views.list(userId, tableId);
  }

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body(new ZodValidationPipe(savedViewInputSchema)) body: SavedViewInput,
  ): Promise<SavedView> {
    return this.views.create(userId, tableId, body);
  }

  @Patch(':viewId')
  update(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('viewId', ParseUUIDPipe) viewId: string,
    @Body(new ZodValidationPipe(savedViewUpdateSchema)) body: SavedViewUpdate,
  ): Promise<SavedView> {
    return this.views.update(userId, tableId, viewId, body);
  }

  @Delete(':viewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('viewId', ParseUUIDPipe) viewId: string,
  ): Promise<void> {
    return this.views.remove(userId, tableId, viewId);
  }
}

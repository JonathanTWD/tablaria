import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { DisabledStorage, FileStorage } from './storage/file-storage';
import { LocalStorage } from './storage/local.storage';
import { S3Storage } from './storage/s3.storage';

@Module({
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    {
      provide: FileStorage,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): FileStorage => {
        const bucket = config.get('STORAGE_BUCKET', { infer: true });
        if (bucket) {
          // The env schema requires the rest of the bucket settings with it.
          return new S3Storage({
            endpoint: config.get('STORAGE_ENDPOINT', { infer: true }) ?? '',
            region: config.get('STORAGE_REGION', { infer: true }),
            bucket,
            accessKeyId:
              config.get('STORAGE_ACCESS_KEY_ID', { infer: true }) ?? '',
            secretAccessKey:
              config.get('STORAGE_SECRET_ACCESS_KEY', { infer: true }) ?? '',
          });
        }
        if (config.get('NODE_ENV', { infer: true }) === 'production') {
          return new DisabledStorage();
        }
        return new LocalStorage(
          config.get('STORAGE_DIR', { infer: true }) ??
            join(process.cwd(), '.storage'),
        );
      },
    },
  ],
})
export class AttachmentsModule {}

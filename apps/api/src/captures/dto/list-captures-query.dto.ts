import type { CaptureStatus } from '@devbrain/shared';
import { IsIn, IsOptional } from 'class-validator';

const CAPTURE_STATUSES: CaptureStatus[] = ['raw', 'distilled', 'archived'];

/** `GET /captures?status=raw` — status is optional (omit it to list everything). */
export class ListCapturesQueryDto {
  @IsOptional()
  @IsIn(CAPTURE_STATUSES)
  status?: CaptureStatus;
}

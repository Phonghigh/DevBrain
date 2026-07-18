import type { CaptureDto, CaptureStatus } from '@devbrain/shared';
import type { Capture } from '../generated/prisma/client';

/**
 * Prisma's `Capture.status` is a plain string (no enum in the schema, spec §5); this
 * narrows it to the shared `CaptureStatus` union for the DTO boundary.
 */
export function toCaptureDto(capture: Capture): CaptureDto {
  return {
    id: capture.id,
    source: capture.source,
    task: capture.task,
    rawText: capture.rawText,
    status: capture.status as CaptureStatus,
    createdAt: capture.createdAt.toISOString(),
  };
}

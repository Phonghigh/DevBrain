import { describe, expect, it } from 'vitest';
import type { Capture } from '../generated/prisma/client';
import { toCaptureDto } from './capture.mapper';

describe('toCaptureDto', () => {
  it('maps a Prisma Capture row to the shared CaptureDto shape', () => {
    const capture: Capture = {
      id: 'cuid-123',
      source: 'chatgpt',
      task: 'debugging',
      rawText: 'raw dump text',
      status: 'raw',
      createdAt: new Date('2026-07-18T00:00:00.000Z'),
    };

    expect(toCaptureDto(capture)).toEqual({
      id: 'cuid-123',
      source: 'chatgpt',
      task: 'debugging',
      rawText: 'raw dump text',
      status: 'raw',
      createdAt: '2026-07-18T00:00:00.000Z',
    });
  });

  it('preserves a null task', () => {
    const capture: Capture = {
      id: 'cuid-456',
      source: 'manual',
      task: null,
      rawText: 'raw dump text',
      status: 'raw',
      createdAt: new Date('2026-07-18T00:00:00.000Z'),
    };

    expect(toCaptureDto(capture).task).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { CaptureDto, CaptureStatus, CreateCaptureDto } from '../capture.js';

describe('Capture DTOs', () => {
  it('CreateCaptureDto accepts an optional task and round-trips through JSON', () => {
    const withTask: CreateCaptureDto = {
      source: 'chatgpt',
      task: 'debugging a flaky test',
      rawText: 'raw dump text',
    };
    const withoutTask: CreateCaptureDto = { source: 'manual', rawText: 'raw dump text' };

    expect(JSON.parse(JSON.stringify(withTask))).toEqual(withTask);
    expect(JSON.parse(JSON.stringify(withoutTask))).toEqual(withoutTask);
  });

  it('CaptureDto carries a nullable task and an ISO-string createdAt', () => {
    const capture: CaptureDto = {
      id: 'cuid-123',
      source: 'claude',
      task: null,
      rawText: 'raw dump text',
      status: 'raw',
      createdAt: new Date(0).toISOString(),
    };

    expect(JSON.parse(JSON.stringify(capture))).toEqual(capture);
  });

  it('CaptureStatus only allows the 3 spec-defined states', () => {
    const statuses: CaptureStatus[] = ['raw', 'distilled', 'archived'];
    expect(statuses).toHaveLength(3);
  });
});

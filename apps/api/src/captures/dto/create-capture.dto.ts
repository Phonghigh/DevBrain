import type { CreateCaptureDto as CreateCaptureShape } from '@devbrain/shared';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * class-validator decorators need a real class to attach to — the shared
 * `CreateCaptureDto` interface (packages/shared) can't carry them. `implements`
 * keeps this in sync with the shared shape at compile time.
 */
export class CreateCaptureDto implements CreateCaptureShape {
  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsOptional()
  @IsString()
  task?: string;

  @IsString()
  @IsNotEmpty()
  rawText!: string;
}

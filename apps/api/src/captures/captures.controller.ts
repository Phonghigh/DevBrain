import type { CaptureDto } from '@devbrain/shared';
import { Body, Controller, Post } from '@nestjs/common';
import { CapturesService } from './captures.service';
import { CreateCaptureDto } from './dto/create-capture.dto';

@Controller('captures')
export class CapturesController {
  constructor(private readonly captures: CapturesService) {}

  @Post()
  create(@Body() dto: CreateCaptureDto): Promise<CaptureDto> {
    return this.captures.create(dto);
  }
}

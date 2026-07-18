import type { CaptureDto } from '@devbrain/shared';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CapturesService } from './captures.service';
import { CreateCaptureDto } from './dto/create-capture.dto';
import { ListCapturesQueryDto } from './dto/list-captures-query.dto';

@Controller('captures')
export class CapturesController {
  constructor(private readonly captures: CapturesService) {}

  @Post()
  create(@Body() dto: CreateCaptureDto): Promise<CaptureDto> {
    return this.captures.create(dto);
  }

  @Get()
  findAll(@Query() query: ListCapturesQueryDto): Promise<CaptureDto[]> {
    return this.captures.findAll(query.status);
  }
}

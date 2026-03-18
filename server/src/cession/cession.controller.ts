import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CessionService } from './cession.service';
import { StartCessionDto } from './start-cession.dto';

@Controller('api/procedures/cession')
export class CessionController {
  constructor(private readonly service: CessionService) {}

  @Get('permis/:permisId/actionnaires')
  async getActionnairesForPermis(
    @Param('permisId', ParseIntPipe) permisId: number,
  ) {
    return this.service.getActionnairesForPermis(permisId);
  }

  @Post('start')
  async startCession(@Body() payload: StartCessionDto) {
    return this.service.startCession(payload);
  }
}


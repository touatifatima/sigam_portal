import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { StatutProcedure } from '@prisma/client';
import { CreateExtensionDto } from './create-extension.dto';
import { ProcedureExtensionPerimetreService } from './procedure-extension-perimetre.service';
import { SessionService } from 'src/session/session.service';

@Controller('api/procedures')
export class ProcedureExtensionPerimetreController {
  constructor(
    private readonly extensionService: ProcedureExtensionPerimetreService,
    private readonly sessionService: SessionService,
  ) {}

  private extractAuthToken(req: any): string | null {
    const cookieToken = req?.cookies?.auth_token;
    if (cookieToken) return cookieToken;

    const authHeader = req?.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }
    return null;
  }

  private async resolveAuthenticatedUserId(req: any): Promise<number> {
    const token = this.extractAuthToken(req);
    if (!token) {
      throw new HttpException('Non authentifie', HttpStatus.UNAUTHORIZED);
    }
    const session = await this.sessionService.validateSession(token);
    const userId = session?.user?.id ?? session?.userId;
    if (!userId) {
      throw new HttpException('Session invalide', HttpStatus.UNAUTHORIZED);
    }
    return Number(userId);
  }

  @Get('extension/perimetre/latest')
  async getLatestPerimeter(@Query('permisId') permisId?: string) {
    if (!permisId) {
      throw new BadRequestException('permisId requis');
    }
    return this.extensionService.getLatestAcceptedPerimeter(Number(permisId));
  }

  @Get('extension/perimetre/list')
  async listPerimeters(@Query('permisId') permisId?: string) {
    if (!permisId) {
      throw new BadRequestException('permisId requis');
    }
    return this.extensionService.listPerimetersByPermis(Number(permisId));
  }

  @Post('extension/:id/perimetres')
  async saveExtensionPerimeter(
    @Param('id') id: string,
    @Body() body: { points: any[]; commentaires?: string },
  ) {
    if (!body?.points || !Array.isArray(body.points) || body.points.length < 3) {
      throw new BadRequestException('Au moins trois points sont requis');
    }
    return this.extensionService.saveExtensionPerimeter(Number(id), body);
  }

  @Post('extension/start')
  async startExtension(@Req() req: any, @Body() dto: CreateExtensionDto) {
    const userId = await this.resolveAuthenticatedUserId(req);
    return this.extensionService.startExtensionWithOriginalData(
      dto.permisId,
      dto.date_demande,
      StatutProcedure.EN_COURS,
      userId,
    );
  }
}

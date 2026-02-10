import {
  Controller,
  Body,
  DefaultValuePipe,
  Delete,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Permisdashboard2Service } from './permis.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdatePermisDashboardDto } from './update-permis.dto';
import { SessionService } from '../session/session.service';
import { Request } from 'express';

@ApiTags('Permisdashboard')
@Controller('Permisdashboard')
export class PermisDashboard2Controller {
  constructor(
    private readonly permisService: Permisdashboard2Service,
    private readonly sessionService: SessionService,
  ) {}

  private async resolveAntenneId(req: Request, id_antenne?: string) {
    const parsed = id_antenne ? Number(id_antenne) : undefined;
    if (Number.isFinite(parsed)) return parsed as number;
    const token = req.cookies?.auth_token;
    if (!token) return undefined;
    const session = await this.sessionService.validateSession(token);
    const user = session?.user as { id_antenne?: number } | undefined;
    return user?.id_antenne ?? undefined;
  }

  @Get('paginated')
  @ApiOperation({ summary: 'Get all permis with pagination' })
  async getAllPermisPaginated(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Req() req: Request,
    @Query('id_antenne') id_antenne?: string,
  ) {
    const antenneId = await this.resolveAntenneId(req, id_antenne);
    return this.permisService.findAll1({
      skip: (page - 1) * limit,
      take: limit,
      ...(Number.isFinite(antenneId) ? { antenneId: antenneId as number } : {}),
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all permis' })
  @ApiResponse({
    status: 200,
    description: 'All permis retrieved successfully',
  })
  async getAllPermis(
    @Req() req: Request,
    @Query('id_antenne') id_antenne?: string,
  ) {
    const antenneId = await this.resolveAntenneId(req, id_antenne);
    return this.permisService.findAll(Number.isFinite(antenneId) ? antenneId : undefined);
  }

  @Get('actifs')
  @ApiOperation({ summary: 'Get active permis' })
  @ApiResponse({
    status: 200,
    description: 'Active permis retrieved successfully',
  })
  async getActivePermis(
    @Req() req: Request,
    @Query('id_antenne') id_antenne?: string,
  ) {
    const antenneId = await this.resolveAntenneId(req, id_antenne);
    return this.permisService.findActive(Number.isFinite(antenneId) ? antenneId : undefined);
  }

  @Get('expires')
  @ApiOperation({ summary: 'Get expired permis' })
  @ApiResponse({
    status: 200,
    description: 'Expired permis retrieved successfully',
  })
  async getExpiredPermis(
    @Req() req: Request,
    @Query('id_antenne') id_antenne?: string,
  ) {
    const antenneId = await this.resolveAntenneId(req, id_antenne);
    return this.permisService.findExpired(Number.isFinite(antenneId) ? antenneId : undefined);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current active permis with pagination' })
  async getCurrentPermis(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
    @Req() req: Request,
    @Query('id_antenne') id_antenne?: string,
  ) {
    const antenneId = await this.resolveAntenneId(req, id_antenne);
    return this.permisService.findCurrent({
      skip: (page - 1) * limit,
      take: limit,
      ...(Number.isFinite(antenneId) ? { antenneId: antenneId as number } : {}),
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a permis' })
  async deletePermis(@Param('id') id: string) {
    return this.permisService.delete(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update permis details' })
  async updatePermis(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePermisDashboardDto,
  ) {
    return this.permisService.updateDetails(id, body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.permisService.findOneWithDetails(+id);
  }

  @Get(':id/documents')
  @ApiOperation({
    summary: 'Get all documents for a permis organized by procedure',
  })
  @ApiResponse({ status: 200, description: 'Documents organized by procedure' })
  @ApiResponse({ status: 404, description: 'Permis not found' })
  async getDocumentsForPermis(@Param('id') id: string) {
    const documents = await this.permisService.getAllDocumentsForPermis(
      parseInt(id),
    );
    return { data: documents };
  }

  @Get(':id/historique')
  @ApiOperation({
    summary: 'Get permis history by code_permis',
  })
  async getHistorique(@Param('id') id: string) {
    return this.permisService.getHistorique(parseInt(id));
  }

  @Post(':id/expire')
  @ApiOperation({ summary: 'Validate expiration and move permit perimeter' })
  async expirePermis(
    @Param('id', ParseIntPipe) id: number,
    @Body('typeProcedureId') typeProcedureId?: number,
    @Body('procId') procId?: number,
  ) {
    return this.permisService.expirePermis(id, procId, typeProcedureId);
  }

  @Post(':id/expiration/start')
  @ApiOperation({ summary: 'Start expiration procedure' })
  async startExpiration(
    @Param('id', ParseIntPipe) id: number,
    @Body('typeProcedureId') typeProcedureId?: number,
  ) {
    return this.permisService.startExpiration(id, typeProcedureId);
  }

  @Post(':id/expiration/validate')
  @ApiOperation({ summary: 'Validate expiration procedure' })
  async validateExpiration(
    @Param('id', ParseIntPipe) id: number,
    @Body('procId') procId?: number,
    @Body('observations') observations?: string,
  ) {
    return this.permisService.expirePermis(id, procId, undefined, observations);
  }

  @Post(':id/annulation/start')
  @ApiOperation({ summary: 'Start cancellation procedure' })
  async startAnnulation(
    @Param('id', ParseIntPipe) id: number,
    @Body('typeProcedureId') typeProcedureId?: number,
  ) {
    return this.permisService.startAnnulation(id, typeProcedureId);
  }

  @Post(':id/annulation/validate')
  @ApiOperation({ summary: 'Validate cancellation procedure' })
  async validateAnnulation(
    @Param('id', ParseIntPipe) id: number,
    @Body('procId') procId?: number,
    @Body('observations') observations?: string,
  ) {
    return this.permisService.annulePermis(id, procId, undefined, observations);
  }


}

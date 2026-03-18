import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionService } from 'src/session/session.service';
import { ProcedureDeclarationsService } from './procedure-declarations.service';

type CreateProcedureDeclarationDto = {
  typeProcedureId?: number;
  typeProcedure?: string;
  ordre?: number;
  texte: string;
  actif?: boolean;
};

type UpdateProcedureDeclarationDto = {
  typeProcedureId?: number;
  typeProcedure?: string;
  ordre?: number;
  texte?: string;
  actif?: boolean;
};

@Controller('api/procedure-declarations')
export class ProcedureDeclarationsController {
  constructor(
    private readonly procedureDeclarationsService: ProcedureDeclarationsService,
    private readonly sessionService: SessionService,
  ) {}

  private async assertAdminAccess(req: any) {
    const token = req?.cookies?.auth_token;
    if (!token) {
      throw new UnauthorizedException('Non authentifie');
    }

    const session = await this.sessionService.validateSession(token);
    if (!session?.user?.id) {
      throw new UnauthorizedException('Session invalide');
    }

    const permissions =
      session.user.role?.rolePermissions?.map((rp: any) => rp.permission?.name) ??
      [];
    const roleName = String(session.user.role?.name ?? '').toLowerCase();
    const isAdminByRole = roleName.includes('admin');
    const hasAdminPermission = permissions.includes('Admin-Panel');

    if (!isAdminByRole && !hasAdminPermission) {
      throw new ForbiddenException('Acces refuse');
    }
  }

  @Get('admin/all')
  async getAllForAdmin(@Req() req: any) {
    await this.assertAdminAccess(req);
    return this.procedureDeclarationsService.getAllDeclarationsForAdmin();
  }

  @Get('admin/type/:typeProcedure')
  async getByTypeForAdmin(
    @Req() req: any,
    @Param('typeProcedure') typeProcedure: string,
  ) {
    await this.assertAdminAccess(req);
    return this.procedureDeclarationsService.getDeclarationsByTypeForAdmin(
      typeProcedure,
    );
  }

  @Post('admin')
  async createForAdmin(@Req() req: any, @Body() body: CreateProcedureDeclarationDto) {
    await this.assertAdminAccess(req);
    return this.procedureDeclarationsService.createDeclaration(body);
  }

  @Patch('admin/:id')
  async updateForAdmin(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProcedureDeclarationDto,
  ) {
    await this.assertAdminAccess(req);
    return this.procedureDeclarationsService.updateDeclaration(id, body);
  }

  @Patch('admin/:id/move')
  async moveForAdmin(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { direction: 'up' | 'down' },
  ) {
    await this.assertAdminAccess(req);
    return this.procedureDeclarationsService.moveDeclaration(id, body.direction);
  }

  @Delete('admin/:id')
  async deleteForAdmin(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.assertAdminAccess(req);
    return this.procedureDeclarationsService.deleteDeclaration(id);
  }

  @Get(':typeProcedure')
  async getActiveByType(@Param('typeProcedure') typeProcedure: string) {
    return this.procedureDeclarationsService.getActiveDeclarationsByType(
      typeProcedure,
    );
  }
}

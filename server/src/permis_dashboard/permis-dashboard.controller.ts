import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Req,
} from '@nestjs/common';
import { PermisDashboardService } from './permis-dashboard.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SessionService } from '../session/session.service';
import { Request } from 'express';

@ApiTags('Dashboard')
@Controller('api/dashboard')
export class PermisDashboardController {
  constructor(
    private readonly dashboardService: PermisDashboardService,
    private readonly sessionService: SessionService,
  ) {}

  private extractAuthToken(req: Request): string | null {
    const cookieToken = req.cookies?.auth_token;
    if (cookieToken) return cookieToken;

    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }

    return null;
  }

  @Get('public-stats')
  @ApiOperation({ summary: 'Get public aggregate dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Public aggregate dashboard statistics retrieved successfully',
  })
  async getPublicStats() {
    return this.dashboardService.getPublicDashboardStats();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
  })
  async getStats(@Req() req: Request) {
    const token = this.extractAuthToken(req);
    if (!token) {
      throw new HttpException('Non authentifie', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.sessionService.validateSession(token);
    const userId = session?.user?.id ?? session?.userId;
    if (!userId) {
      throw new HttpException('Session invalide', HttpStatus.UNAUTHORIZED);
    }

    const sessionUser = session?.user;
    const roleName = String(sessionUser?.role?.name ?? '').toLowerCase();
    if (
      roleName.includes('admin') ||
      roleName.includes('administrateur') ||
      roleName.includes('cadastre') ||
      roleName.includes('operateur')
    ) {
      return this.dashboardService.getDashboardStats();
    }

    return this.dashboardService.getUserDashboardStats({
      userId: Number(userId),
      detenteurId: sessionUser?.detenteurId ?? null,
    });
  }

  @Get('payments')
  @ApiOperation({
    summary: 'Get dashboard payments for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard payments retrieved successfully',
  })
  async getPayments(@Req() req: Request) {
    const token = this.extractAuthToken(req);
    if (!token) {
      throw new HttpException('Non authentifie', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.sessionService.validateSession(token);
    const userId = session?.user?.id ?? session?.userId;
    if (!userId) {
      throw new HttpException('Session invalide', HttpStatus.UNAUTHORIZED);
    }

    return this.dashboardService.getDashboardPayments(Number(userId));
  }

  @Get('investor-repartition')
  @ApiOperation({
    summary: 'Get investor repartition by country',
  })
  @ApiResponse({
    status: 200,
    description: 'Investor repartition retrieved successfully',
  })
  async getInvestorRepartition(@Req() req: Request) {
    const token = this.extractAuthToken(req);
    if (!token) {
      throw new HttpException('Non authentifie', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.sessionService.validateSession(token);
    if (!session?.user && !session?.userId) {
      throw new HttpException('Session invalide', HttpStatus.UNAUTHORIZED);
    }

    return this.dashboardService.getInvestorRepartition();
  }

  @Get('encaissements')
  @ApiOperation({
    summary: 'Get encaissements repartition and trends',
  })
  @ApiResponse({
    status: 200,
    description: 'Encaissements overview retrieved successfully',
  })
  async getEncaissements(
    @Req() req: Request,
    @Query('period') period?: string,
  ) {
    const token = this.extractAuthToken(req);
    if (!token) {
      throw new HttpException('Non authentifie', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.sessionService.validateSession(token);
    const userId = session?.user?.id ?? session?.userId;
    if (!userId) {
      throw new HttpException('Session invalide', HttpStatus.UNAUTHORIZED);
    }

    const sessionUser = session?.user;
    const roleName = String(sessionUser?.role?.name ?? '').toLowerCase();
    const scope =
      roleName.includes('admin') ||
      roleName.includes('administrateur') ||
      roleName.includes('cadastre') ||
      roleName.includes('operateur')
        ? 'global'
        : 'user';

    return this.dashboardService.getEncaissementsOverview({
      period,
      scope,
      userId: Number(userId),
    });
  }

  @Get('evolution')
  @ApiOperation({ summary: 'Get permis evolution data' })
  @ApiResponse({
    status: 200,
    description: 'Evolution data retrieved successfully',
  })
  async getEvolution() {
    return this.dashboardService.getPermisEvolution();
  }

  @Get('types')
  @ApiOperation({ summary: 'Get permis type distribution' })
  @ApiResponse({
    status: 200,
    description: 'Type distribution retrieved successfully',
  })
  async getTypes() {
    return this.dashboardService.getPermisTypesDistribution();
  }

  @Get('status-distribution')
  @ApiOperation({ summary: 'Get permis status distribution' })
  @ApiResponse({
    status: 200,
    description: 'Status distribution retrieved successfully',
  })
  async getStatusDistribution() {
    return this.dashboardService.getPermisStatusDistribution();
  }

  @Get('recent')
  async getRecentActivities() {
    return this.dashboardService.getRecentActivities();
  }

  @Get('expiring-soon')
  @ApiOperation({ summary: 'Liste des permis expirant dans 6 mois' })
  async getExpiringSoon() {
    return this.dashboardService.getExpiringSoonPermis();
  }

  @Get('top-surfaces')
  @ApiOperation({ summary: 'Top permis par superficie' })
  async getTopSurfaces() {
    return this.dashboardService.getTopSurfacePermis();
  }

  @Get('by-wilaya')
  @ApiOperation({ summary: 'Répartition des permis par wilaya' })
  async getByWilaya() {
    return this.dashboardService.getPermisByWilaya();
  }

  @Get('by-antenne')
  @ApiOperation({ summary: 'Répartition des permis par antenne' })
  async getByAntenne() {
    return this.dashboardService.getPermisByAntenne();
  }

  @Get('top-substances')
  @ApiOperation({ summary: 'Top substances associées aux permis' })
  async getTopSubstances() {
    return this.dashboardService.getTopSubstances();
  }
}

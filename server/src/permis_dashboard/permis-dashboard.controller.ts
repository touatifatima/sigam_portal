import { Controller, Get, Param } from '@nestjs/common';
import { PermisDashboardService } from './permis-dashboard.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Dashboard')
@Controller('api/dashboard')
export class PermisDashboardController {
  constructor(private readonly dashboardService: PermisDashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
  })
  async getStats() {
    return this.dashboardService.getDashboardStats();
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


import { BadRequestException, Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { GisPointInput, GisService } from './gis.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('gis')
export class GisController {
  constructor(
    private readonly gisService: GisService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('perimeters')
  async getPerimeters() {
    const rows = await this.gisService.getPerimetersAsGeoJSON();
    return {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: r.geometry,
        properties: {
          id: r.id,
          sigam_proc_id: r.sigam_proc_id,
          // Underlying titre/permis identifier
          permis_id: r.sigam_permis_id,
          source: r.source,
          type_code: r.type_code,
          // Expose titre_id as the numeric permis_code when possible,
          // falling back to the internal idtitre (sigam_permis_id)
          titre_id: r.permis_code
            ? parseInt(r.permis_code, 10) || r.permis_code
            : r.idtitre,
          type_titre: r.typetitre,
          substance: r.substance1,
          substances: r.substances,
          titulaire: [r.tprenom, r.tnom].filter(Boolean).join(' '),
          sig_area: r.sig_area,
        },
      })),
    };
  }

  @Get('perimeters/by-permis/:permisId')
  async getPerimetersByPermis(@Param('permisId') permisId: string) {
    const id = Number(permisId);
    if (!Number.isFinite(id)) {
      return { type: 'FeatureCollection', features: [] };
    }
    const rows = await this.gisService.getPerimetersByPermisAsGeoJSON(id);

    // Enrich with procedure type label (TypeProcedure.libelle) from sigam DB.
    // This makes the frontend dropdown stable even when /api/procedures/:id/demande can't be called.
    const procIds: number[] = Array.from(
      new Set(
        rows
          .map((r) => r.sigam_proc_id)
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
          .map((v) => Number(v)),
      ),
    );

    const demandeMeta: Array<{
      id_proc: number | null;
      code_demande: string | null;
      typeProcedure: { libelle: string | null } | null;
    }> = procIds.length
      ? await this.prisma.demandePortail.findMany({
          where: { id_proc: { in: procIds } },
          select: {
            id_proc: true,
            code_demande: true,
            typeProcedure: { select: { libelle: true } },
          },
        })
      : [];

    const procMetaMap = new Map<
      number,
      { procedure_type_label?: string | null; code_demande?: string | null }
    >();
    demandeMeta.forEach((d) => {
      if (typeof d.id_proc === 'number') {
        procMetaMap.set(d.id_proc, {
          procedure_type_label: d.typeProcedure?.libelle ?? null,
          code_demande: d.code_demande ?? null,
        });
      }
    });

    return {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: r.geometry,
        properties: {
          id: r.id,
          sigam_proc_id: r.sigam_proc_id,
          permis_id: r.sigam_permis_id,
          source: r.source,
          type_code: r.type_code,
          procedure_type_label: procMetaMap.get(r.sigam_proc_id ?? -1)?.procedure_type_label,
          code_demande: procMetaMap.get(r.sigam_proc_id ?? -1)?.code_demande ?? r.permis_code,
          titre_id: r.permis_code
            ? parseInt(r.permis_code, 10) || r.permis_code
            : r.idtitre,
          type_titre: r.typetitre,
          substance: r.substance1,
          substances: r.substances,
          titulaire: [r.tprenom, r.tnom].filter(Boolean).join(' '),
          sig_area: r.sig_area,
        },
      })),
    };
  }

  @Get('promotion-zones')
  async getPromotionZones() {
    const rows = await this.gisService.getPromotionZonesAsGeoJSON();
    return {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: r.geometry,
        properties: {
          id: r.id,
          idzone: r.idzone,
          nom: r.nom,
          sig_area: r.sig_area,
        },
      })),
    };
  }

  @Get('wilayas')
  async getWilayas() {
    const rows = await this.gisService.getWilayasAsGeoJSON();
    return {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: r.geometry,
        properties: {
          id: r.id,
          wilaya: r.wilaya,
          sig_area: r.sig_area,
        },
      })),
    };
  }

  @Get('communes')
  async getCommunes() {
    const rows = await this.gisService.getCommunesAsGeoJSON();
    return {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: r.geometry,
        properties: {
          id: r.id,
          commune: r.commune,
          wilaya: r.wilaya,
          code: r.code,
          sig_area: r.sig_area,
        },
      })),
    };
  }

  @Get('villes')
  async getVilles() {
    const rows = await this.gisService.getVillesAsGeoJSON();
    return {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: r.geometry,
        properties: {
          id: r.id,
          city_name: r.city_name,
          admin_name: r.admin_name,
          status: r.status,
          pop_rank: r.pop_rank,
        },
      })),
    };
  }

  @Post('analyze-perimeter')
  async analyzePerimeter(
    @Body('points') points: GisPointInput[],
    @Body('layers') layers?: Record<string, boolean>,
  ) {
    const safePoints = Array.isArray(points) ? points : [];
    return this.gisService.analyzePerimeter({
      points: safePoints,
      layers: layers || undefined,
    });
  }

  @Post('admin-location')
  async detectAdminLocation(
    @Body() payload: GisPointInput | { points?: GisPointInput[] },
  ) {
    return this.gisService.detectAdminByPoint(payload);
  }

  @Get('titres')
  async getTitres() {
    const rows = await this.gisService.getTitresAsGeoJSON();
    return {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: r.geometry,
        properties: {
          id: r.id,
          idtitre: r.idtitre,
          code: r.code,
          typetitre: r.typetitre,
          substance1: r.substance1,
          substances: r.substances,
          pp: r.pp,
          tprenom: r.tprenom,
          tnom: r.tnom,
          dateoctroi: r.dateoctroi,
          dateexpiration: r.dateexpiration,
          carte: r.carte,
          lieudit: r.lieudit,
          commune: r.commune,
          daira: r.daira,
          wilaya: r.wilaya,
          idtypetitre: r.idtypetitre,
          idsubstance: r.idsubstance,
          idtitulair: r.idtitulair,
          idstatustitre: r.idstatustitre,
          sig_area: r.sig_area,
          codetype: r.codetype,
          shape_length: r.shape_length,
          shape_area: r.shape_area,
        },
      })),
    };
  }

  @Post('promotion/:id/delete')
  async deletePromotionToTrash(
    @Param('id') id: string,
    @Body()
    body: { deletedBy?: string; commentaire?: string; targetLayer?: string },
  ) {
    const objectId = Number(id);
    if (!Number.isFinite(objectId)) {
      throw new BadRequestException('Invalid promotion id');
    }
    await this.gisService.movePromotionToTrash({
      objectId,
      deletedBy: body?.deletedBy,
      commentaire: body?.commentaire,
      targetLayer: body?.targetLayer,
    });
    return { ok: true };
  }

  @Post('arcgis-token')
  async getArcgisToken(
    @Body('referer') referer?: string,
    @Headers('origin') origin?: string,
  ) {
    const token = await this.gisService.getArcgisToken({
      referer: referer || origin || null,
    });
    if (!token) {
      throw new BadRequestException('ArcGIS token unavailable');
    }
    return token;
  }
}

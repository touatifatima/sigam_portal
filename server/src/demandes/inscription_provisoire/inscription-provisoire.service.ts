import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CoordonneesService } from '../cadastre/coordonnees.service'
import { GisPointInput, GisService } from '../gis/gis.service';
;
type ProvisionalPoint = {
  x: number;
  y: number;
  z?: number;
  system?: string;
  zone?: number;
  hemisphere?: string;
};

type ProcedureGisMeta = {
  code_demande?: string | null;
  detenteur?: string | null;
  superficie_ha?: number | null;
  substance_principale?: string | null;
  substances?: string | null;
};

@Injectable()
export class InscriptionProvisoireService implements OnModuleInit {
  private readonly logger = new Logger(InscriptionProvisoireService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly coordService: CoordonneesService,
    private readonly gisService: GisService,
  ) {}

  async onModuleInit() {
    // Best effort one-time sync: existing provisional rows -> sig_gis layer.
    this.syncAllToGisLayer().catch((err) => {
      this.logger.warn(
        'Failed to bootstrap provisional GIS sync',
        err as Error,
      );
    });
  }

  private toFiniteNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private normalizePointsForGis(points: unknown): GisPointInput[] {
    if (!Array.isArray(points)) return [];
    return points
      .map((p: any) => {
        const x = this.toFiniteNumber(p?.x);
        const y = this.toFiniteNumber(p?.y);
        if (x == null || y == null) return null;
        const zoneRaw = this.toFiniteNumber(p?.zone);
        return {
          x,
          y,
          system: p?.system ? String(p.system) : 'UTM',
          zone: zoneRaw == null ? null : Math.trunc(zoneRaw),
          hemisphere: p?.hemisphere ? String(p.hemisphere) : 'N',
        } as GisPointInput;
      })
      .filter((p): p is GisPointInput => !!p);
  }

  private pickDetenteurName(
    links:
      | Array<{
          role_detenteur?: string | null;
          detenteur?: { nom_societeFR?: string | null; nom_societeAR?: string | null } | null;
        }>
      | null
      | undefined,
  ): string | null {
    const items = Array.isArray(links) ? links : [];
    const preferred =
      items.find((l) =>
        (l.role_detenteur ?? '').toLowerCase().includes('deten'),
      ) || items[0];
    const det = preferred?.detenteur;
    return det?.nom_societeFR ?? det?.nom_societeAR ?? null;
  }

  private extractSubstanceMeta(
    rows:
      | Array<{
          priorite?: string | null;
          substance?: { nom_subFR?: string | null; nom_subAR?: string | null } | null;
        }>
      | null
      | undefined,
  ): { substance_principale: string | null; substances: string | null } {
    const links = Array.isArray(rows) ? rows : [];
    const primary =
      links.find((s) =>
        String(s?.priorite ?? '')
          .toLowerCase()
          .includes('princip'),
      ) ?? links[0];

    const labels = links
      .map((s) => s?.substance?.nom_subFR ?? s?.substance?.nom_subAR ?? null)
      .filter((v): v is string => !!v && !!v.trim())
      .map((v) => v.trim());

    const uniqueLabels: string[] = [];
    const seen = new Set<string>();
    for (const label of labels) {
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueLabels.push(label);
    }

    return {
      substance_principale:
        primary?.substance?.nom_subFR ??
        primary?.substance?.nom_subAR ??
        null,
      substances: uniqueLabels.length ? uniqueLabels.join(', ') : null,
    };
  }

  private async loadProcedureGisMeta(
    id_proc: number,
    id_demande?: number | null,
  ): Promise<ProcedureGisMeta> {
    const select = {
      code_demande: true,
      superficie: true,
      detenteurdemande: {
        select: {
          role_detenteur: true,
          detenteur: {
            select: {
              nom_societeFR: true,
              nom_societeAR: true,
            },
          },
        },
      },
      procedure: {
        select: {
          SubstanceAssocieeDemande: {
            select: {
              priorite: true,
              substance: {
                select: {
                  nom_subFR: true,
                  nom_subAR: true,
                },
              },
            },
          },
        },
      },
    } as const;

    const demande = id_demande
      ? await this.prisma.demandePortail.findUnique({
          where: { id_demande },
          select,
        })
      : await this.prisma.demandePortail.findFirst({
          where: { id_proc },
          select,
        });

    if (!demande) {
      return {
        code_demande: null,
        detenteur: null,
        superficie_ha: null,
        substance_principale: null,
        substances: null,
      };
    }

    const substanceMeta = this.extractSubstanceMeta(
      demande.procedure?.SubstanceAssocieeDemande,
    );
    const superficieHa =
      typeof demande.superficie === 'number' ? demande.superficie : null;

    return {
      code_demande: demande.code_demande ?? null,
      detenteur: this.pickDetenteurName(demande.detenteurdemande),
      superficie_ha:
        superficieHa != null && Number.isFinite(superficieHa)
          ? superficieHa
          : null,
      ...substanceMeta,
    };
  }

  private async syncRecordToGisLayer(
    record: {
      id_proc: number;
      id_demande?: number | null;
      points: unknown;
      createdAt?: Date;
      updatedAt?: Date;
    },
  ) {
    const meta = await this.loadProcedureGisMeta(
      record.id_proc,
      record.id_demande ?? null,
    );
    await this.gisService.upsertInscriptionProvisoirePerimeter({
      id_proc: record.id_proc,
      id_demande: record.id_demande ?? null,
      code_demande: meta.code_demande ?? null,
      detenteur: meta.detenteur ?? null,
      superficie_ha: meta.superficie_ha ?? null,
      substance_principale: meta.substance_principale ?? null,
      substances: meta.substances ?? null,
      createdAt: record.createdAt ?? null,
      updatedAt: record.updatedAt ?? null,
      points: this.normalizePointsForGis(record.points),
    });
  }

  async syncAllToGisLayer() {
    const records = await this.prisma.inscriptionProvisoirePortail.findMany({
      select: {
        id_proc: true,
        id_demande: true,
        points: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    for (const rec of records) {
      await this.syncRecordToGisLayer(rec);
    }
  }

  async upsertByProcedure(payload: {
    id_proc: number;
    id_demande?: number;
    points?: ProvisionalPoint[];
    system?: string;
    zone?: number;
    hemisphere?: string;
    superficie_declaree?: number;
    createdAt?: Date | string;
  }) {
    const {
      id_proc,
      id_demande,
      points,
      system,
      zone,
      hemisphere,
      superficie_declaree,
      createdAt,
    } = payload;

    const normalizedIncomingPoints = (Array.isArray(points) ? points : [])
      .map((p) => {
        const x = this.toFiniteNumber(p?.x);
        const y = this.toFiniteNumber(p?.y);
        if (x == null || y == null) return null;
        const z = this.toFiniteNumber(p?.z) ?? 0;
        const pointSystem = p?.system ? String(p.system) : system ?? 'UTM';
        const pointZoneRaw = this.toFiniteNumber(p?.zone ?? zone);
        return {
          x,
          y,
          z,
          system: pointSystem,
          zone: pointZoneRaw == null ? undefined : Math.trunc(pointZoneRaw),
          hemisphere: p?.hemisphere ? String(p.hemisphere) : hemisphere || 'N',
        } as ProvisionalPoint;
      })
      .filter((p): p is ProvisionalPoint => !!p);
    const hasIncomingPoints = normalizedIncomingPoints.length > 0;

    // Resolve demande from procedure if not provided
    let demandeId = id_demande;

    if (!demandeId) {
      const demande = await this.prisma.demandePortail.findFirst({
        where: { id_proc },
        select: { id_demande: true },
      });
      if (!demande) {
        throw new NotFoundException(
          `Aucune demande associee a la procedure ${id_proc}`,
        );
      }
      demandeId = demande.id_demande;
    }

    // Avoid overwriting superficie_declaree when not provided
    const superficieValue =
      superficie_declaree === undefined || superficie_declaree === null
        ? undefined
        : Number.isFinite(Number(superficie_declaree))
          ? Number(superficie_declaree)
          : undefined;
    const createdAtValue =
      createdAt === undefined || createdAt === null
        ? undefined
        : (() => {
            const parsed =
              createdAt instanceof Date ? createdAt : new Date(createdAt);
            return Number.isNaN(parsed.getTime()) ? undefined : parsed;
          })();

    const existing = await this.prisma.inscriptionProvisoirePortail.findUnique({
      where: { id_proc },
      select: { id: true },
    });

    const baseData: any = {
      id_demande: demandeId,
      system,
      zone,
      hemisphere: hemisphere || 'N',
    };

    let record: any;
    if (existing) {
      const updateData: any = { ...baseData };
      if (hasIncomingPoints) {
        updateData.points = normalizedIncomingPoints as any;
      }
      if (superficieValue !== undefined) {
        updateData.superficie_declaree = superficieValue;
      }
      record = await this.prisma.inscriptionProvisoirePortail.update({
        where: { id_proc },
        data: updateData,
      });
    } else {
      let createPoints = normalizedIncomingPoints;
      if (!createPoints.length) {
        const definitiveCoords = await this.prisma.procedureCoord.findMany({
          where: { id_proc },
          include: { coordonnee: true },
          orderBy: { id_coordonnees: 'asc' },
        });
        createPoints = definitiveCoords
          .map((link) => {
            const point = link?.coordonnee;
            const x = this.toFiniteNumber(point?.x);
            const y = this.toFiniteNumber(point?.y);
            if (x == null || y == null) return null;
            return {
              x,
              y,
              z: this.toFiniteNumber(point?.z) ?? 0,
              system: point?.system ? String(point.system) : 'UTM',
              zone:
                point?.zone == null
                  ? undefined
                  : Math.trunc(Number(point.zone)),
              hemisphere: point?.hemisphere ? String(point.hemisphere) : 'N',
            } as ProvisionalPoint;
          })
          .filter((p): p is ProvisionalPoint => !!p);
      }

      const createData: any = {
        id_proc,
        ...baseData,
        // Allow creating a "superficie only" provisional row before points are drawn.
        // This keeps declared area persisted without overwriting existing points.
        points: (createPoints.length ? createPoints : []) as any,
      };
      if (createdAtValue) {
        createData.createdAt = createdAtValue;
      }
      if (superficieValue !== undefined) {
        createData.superficie_declaree = superficieValue;
      }
      record = await this.prisma.inscriptionProvisoirePortail.create({
        data: createData,
      });
    }

    await this.syncRecordToGisLayer(record);
    return record;
  }

  async findByProcedure(id_proc: number) {
    const rec = await this.prisma.inscriptionProvisoirePortail.findUnique({
      where: { id_proc },
    });
    if (rec) {
      const recPoints = Array.isArray(rec.points) ? rec.points : [];
      if (recPoints.length > 0) return rec;

      // If provisional row exists but points are empty, fallback to definitive coordinates
      // while preserving provisional metadata (e.g. superficie_declaree).
      const fallbackLinks = await this.prisma.procedureCoord.findMany({
        where: { id_proc },
        include: { coordonnee: true },
        orderBy: { id_coordonnees: 'asc' },
      });
      const fallbackPoints = fallbackLinks.map((l) => ({
        x: l.coordonnee!.x,
        y: l.coordonnee!.y,
        z: l.coordonnee!.z,
        system: l.coordonnee!.system,
        zone: l.coordonnee!.zone as any,
        hemisphere: l.coordonnee!.hemisphere as any,
      }));
      if (fallbackPoints.length > 0) {
        return {
          ...rec,
          points: fallbackPoints,
        } as any;
      }
      return rec;
    }

    // Fallback: if no provisional entry exists, return definitive coordinates
    // in the same payload shape so frontend can still display points.
    const links = await this.prisma.procedureCoord.findMany({
      where: { id_proc },
      include: { coordonnee: true },
      orderBy: { id_coordonnees: 'asc' },
    });

    const points = links.map((l) => ({
      x: l.coordonnee!.x,
      y: l.coordonnee!.y,
      z: l.coordonnee!.z,
      system: l.coordonnee!.system,
      zone: l.coordonnee!.zone as any,
      hemisphere: l.coordonnee!.hemisphere as any,
    }));

    return {
      id: undefined,
      id_proc,
      id_demande: undefined,
      points,
      system: null,
      zone: null,
      hemisphere: null,
      superficie_declaree: null,
    } as any;
  }

  async findByDemande(id_demande: number) {
    const rec = await this.prisma.inscriptionProvisoirePortail.findUnique({
      where: { id_demande },
    });
    return rec || null;
  }

  async promoteToDefinitive(id_proc: number) {
    const rec = await this.prisma.inscriptionProvisoirePortail.findUnique({
      where: { id_proc },
    });
    if (!rec) {
      throw new NotFoundException(
        'Aucune inscription provisoire pour cette procedure',
      );
    }

    const points = Array.isArray(rec.points) ? rec.points : [];
    if (points.length < 3) {
      throw new NotFoundException('Polygone insuffisant pour promotion');
    }

    const payloadPoints = points.map((p: any) => ({
      x: String(p.x),
      y: String(p.y),
      z: String(p.z ?? '0'),
      system: p.system,
      zone: p.zone,
      hemisphere: p.hemisphere,
    }));

    // Persist to definitive coordinates and link to procedure
    await this.coordService.updateCoordonnees(
      id_proc,
      null as any,
      payloadPoints,
      'NOUVEAU',
      undefined,
    );

    // Remove from blocking provisional GIS layer after promotion.
    // The provisional row in SIGAM is intentionally kept for history.
    await this.gisService.deleteInscriptionProvisoirePerimeter(id_proc);

    return {
      message:
        'Coordonnees promues en definitives (couche GIS inscription_provisoire supprimee)',
    };
  }
}

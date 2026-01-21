import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GisService, GisPointInput } from '../../gis/gis.service';

@Injectable()
export class CoordonneesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gisService: GisService,
  ) {}

  async getPerimeterHistoryByPermisCode(code: string) {
    const raw = (code ?? '').toString().trim();
    if (!raw) {
      return { permisId: null, permisCode: null, polygons: [] };
    }

    const numericSuffix = raw.match(/(\d+)$/)?.[1] || null;

    // Prefer exact match; fall back to matching by numeric suffix (e.g. "APM 8012" vs "8012").
    let permis =
      (await this.prisma.permisPortail.findFirst({
        where: { code_permis: { equals: raw, mode: 'insensitive' } },
        select: { id: true, code_permis: true },
        orderBy: { id: 'desc' },
      })) || null;

    if (!permis && numericSuffix) {
      permis = await this.prisma.permisPortail.findFirst({
        where: { code_permis: { endsWith: numericSuffix, mode: 'insensitive' } },
        select: { id: true, code_permis: true },
        orderBy: { id: 'desc' },
      });
    }

    if (!permis) {
      return { permisId: null, permisCode: null, polygons: [] };
    }

    const permisLinks = await this.prisma.permisProcedure.findMany({
      where: { id_permis: permis.id },
      select: {
        id_proc: true,
        procedure: { select: { id_proc: true, num_proc: true } },
      },
      orderBy: { id_proc: 'asc' },
    });

    const procIds = Array.from(
      new Set(
        (permisLinks || [])
          .map((l) => l.id_proc)
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v)),
      ),
    );

    if (!procIds.length) {
      return { permisId: permis.id, permisCode: permis.code_permis ?? null, polygons: [] };
    }

    const numProcById = new Map<number, string>();
    for (const link of permisLinks) {
      if (typeof link.id_proc === 'number') {
        numProcById.set(
          link.id_proc,
          link.procedure?.num_proc ?? String(link.id_proc),
        );
      }
    }

    // Pull latest demande metadata per procedure (typeProcedure + code_demande)
    const demandes = await this.prisma.demandePortail.findMany({
      where: { id_proc: { in: procIds } },
      select: {
        id_proc: true,
        id_demande: true,
        date_demande: true,
        code_demande: true,
        typeProcedure: { select: { libelle: true } },
      },
      orderBy: [{ date_demande: 'desc' }, { id_demande: 'desc' }],
    });

    const metaByProc = new Map<number, { typeLabel?: string; codeDemande?: string }>();
    for (const d of demandes) {
      if (typeof d.id_proc !== 'number') continue;
      if (metaByProc.has(d.id_proc)) continue; // keep the most recent
      metaByProc.set(d.id_proc, {
        typeLabel: d.typeProcedure?.libelle ?? undefined,
        codeDemande: d.code_demande ?? undefined,
      });
    }

    const procCoords = await this.prisma.procedureCoord.findMany({
      where: { id_proc: { in: procIds } },
      include: { coordonnee: true },
      orderBy: [{ id_proc: 'asc' }, { id_coordonnees: 'asc' }],
    });

    const coordsByProc = new Map<
      number,
      {
        coordinates: [number, number][];
        system?: string | null;
        zone?: number | null;
        hemisphere?: string | null;
      }
    >();

    for (const row of procCoords) {
      if (typeof row.id_proc !== 'number') continue;
      if (!row.coordonnee) continue;
      if (!Number.isFinite(row.coordonnee.x) || !Number.isFinite(row.coordonnee.y)) continue;

      const entry =
        coordsByProc.get(row.id_proc) ||
        (() => {
          const init = {
            coordinates: [] as [number, number][],
            system: null as string | null,
            zone: null as number | null,
            hemisphere: null as string | null,
          };
          coordsByProc.set(row.id_proc, init);
          return init;
        })();

      entry.coordinates.push([row.coordonnee.x, row.coordonnee.y]);
      if (!entry.system && row.coordonnee.system) entry.system = row.coordonnee.system;
      if (entry.zone === null && row.coordonnee.zone !== null && row.coordonnee.zone !== undefined) {
        entry.zone = row.coordonnee.zone;
      }
      if (!entry.hemisphere && row.coordonnee.hemisphere) entry.hemisphere = row.coordonnee.hemisphere;
    }

    const polygons = procIds.map((pid) => {
      const meta = metaByProc.get(pid);
      const geo = coordsByProc.get(pid);
      const coords = (geo?.coordinates || []).slice();

      // Close ring if needed
      if (coords.length >= 3) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coords.push(first);
        }
      }

      const system = (geo?.system || '').toString().toUpperCase();
      const isWGS =
        system === 'WGS84' ||
        system === 'EPSG:4326' ||
        system === '4326';

      const hemisphereRaw = (geo?.hemisphere || '').toString().toUpperCase();
      const hemisphere = hemisphereRaw.startsWith('S') ? 'S' : 'N';

      return {
        idProc: pid,
        num_proc: numProcById.get(pid) ?? String(pid),
        coordinates: coords,
        zone: geo?.zone ?? undefined,
        hemisphere,
        isWGS,
        typeLabel: meta?.typeLabel,
        codeDemande: meta?.codeDemande,
      };
    });

    return {
      permisId: permis.id,
      permisCode: permis.code_permis ?? null,
      polygons,
    };
  }

  async createCoordonnees(
    id_proc: number,
    id_zone_interdite: number,
    points: {
      x: string;
      y: string;
      z: string;
      system?: string;
      zone?: number;
      hemisphere?: string;
    }[],
    statut_coord: 'NOUVEAU' | 'ANCIENNE' | 'DEMANDE_INITIALE' = 'NOUVEAU',
  ) {
    try {
      const demande = await this.prisma.demandePortail.findFirst({
        where: { id_proc },
        include: { typeProcedure: true, typePermis: true },
      });

      if (!demande) {
        throw new Error(`No demande found for procedure ${id_proc}`);
      }

      const libelle = demande.typeProcedure?.libelle?.toLowerCase() ?? '';
      const isDemandeInitiale = libelle === 'demande';
      const effectiveStatut: 'DEMANDE_INITIALE' | 'NOUVEAU' | 'ANCIENNE' =
        isDemandeInitiale ? 'DEMANDE_INITIALE' : (statut_coord ?? 'NOUVEAU');

      const createdCoords = await this.prisma.$transaction(async (tx) => {
        const coords = await Promise.all(
          points.map((p) =>
            tx.coordonneePortail.create({
              data: {
                id_zone_interdite,
                x: parseFloat(p.x),
                y: parseFloat(p.y),
                z: parseFloat(p.z),
                system: p.system || 'WGS84',
                zone: p.zone || null,
                hemisphere: 'N',
                point: JSON.stringify({
                  x: p.x,
                  y: p.y,
                  z: p.z,
                  system: p.system,
                  zone: p.zone,
                  hemisphere: 'N',
                }),
              },
            }),
          ),
        );

        await Promise.all(
          coords.map((coord) =>
            tx.procedureCoord.create({
              data: {
                id_proc,
                id_coordonnees: coord.id_coordonnees,
                statut_coord: effectiveStatut,
              },
            }),
          ),
        );

        return coords;
      });

      // Sync with GIS database (sig_gis)
      try {
        const typeCode = demande.typePermis?.code_type ?? null;
        const gisPoints: GisPointInput[] = points.map((p) => ({
          x: parseFloat(p.x),
          y: parseFloat(p.y),
          system: p.system,
          zone: p.zone ?? null,
          hemisphere: p.hemisphere ?? 'N',
        }));
        await this.gisService.upsertProcedurePerimeter({
          id_proc,
          source: effectiveStatut,
          typeCode,
          points: gisPoints,
        });
      } catch (e) {
        console.error('GIS sync failed in createCoordonnees:', e);
      }

      return {
        message: 'Coordonnées liées à la procédure avec succès.',
        data: createdCoords,
      };
    } catch (error) {
      console.error('Erreur lors de la création des coordonnées:', error);
      throw new InternalServerErrorException(
        'Erreur serveur lors de la sauvegarde.',
      );
    }
  }

  async getExistingPerimeters() {
    try {
      const raw = await this.prisma.procedureCoord.findMany({
        include: {
          procedure: {
            select: {
              id_proc: true,
              num_proc: true,
            },
          },
          coordonnee: true,
        },
      });

      const grouped = raw.reduce(
        (acc, entry) => {
          if (!entry.procedure || !entry.coordonnee) {
            return acc;
          }
          const id = entry.procedure.id_proc;
          const code = entry.procedure.num_proc ?? '';
          if (!acc[id]) {
            acc[id] = {
              id_proc: id,
              num_proc: code,
              coordinates: [] as [number, number][],
            };
          }
          acc[id].coordinates.push([entry.coordonnee.x, entry.coordonnee.y]);
          return acc;
        },
        {} as Record<
          number,
          { id_proc: number; num_proc: string; coordinates: [number, number][] }
        >,
      );

      return Object.values(grouped).map((poly) => {
        const coordinates = (poly as {
          id_proc: number;
          num_proc: string;
          coordinates: [number, number][];
        }).coordinates;
        if (coordinates && coordinates.length >= 3) {
          const first = coordinates[0];
          const last = coordinates[coordinates.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coordinates.push(first);
          }
        }
        return poly as {
          id_proc: number;
          num_proc: string;
          coordinates: [number, number][];
        };
      });
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des périmètres existants:',
        error,
      );
      throw new InternalServerErrorException(
        'Erreur serveur lors de la récupération.',
      );
    }
  }

  async getCoordonneesByProcedure(id_proc: number) {
    return this.prisma.procedureCoord.findMany({
      where: { id_proc },
      include: {
        coordonnee: true,
      },
      orderBy: {
        id_coordonnees: 'asc',
      },
    });
  }

  async deleteCoordonneesByProcedure(id_proc: number) {
    const links = await this.prisma.procedureCoord.findMany({
      where: { id_proc },
      select: { id_coordonnees: true },
    });

    const coordIds = links
      .map((link) => link.id_coordonnees)
      .filter((id): id is number => id !== null && id !== undefined);

    await this.prisma.procedureCoord.deleteMany({
      where: { id_proc },
    });

    if (coordIds.length === 0) {
      return { count: 0 };
    }

    return this.prisma.coordonneePortail.deleteMany({
      where: { id_coordonnees: { in: coordIds } },
    });
  }

  async getCoordonneesByPermis(id_permis: number) {
    // Récupère toutes les procédures liées au permis puis toutes leurs coordonnés
    const procLinks = await this.prisma.permisProcedure.findMany({
      where: { id_permis },
      select: { id_proc: true },
    });

    const procIds = procLinks.map((p) => p.id_proc).filter(Boolean);
    if (procIds.length === 0) return [];

    return this.prisma.procedureCoord.findMany({
      where: { id_proc: { in: procIds } },
      include: { coordonnee: true, procedure: true },
      orderBy: { id_coordonnees: 'asc' },
    });
  }

  async updateCoordonnees(
    id_proc: number,
    id_zone_interdite: number,
    points: {
      x: string;
      y: string;
      z: string;
      system?: string;
      zone?: number;
      hemisphere?: string;
    }[],
    statut_coord: 'DEMANDE_INITIALE' | 'NOUVEAU' | 'ANCIENNE' = 'NOUVEAU',
    superficie?: number,
  ) {
    try {
      const existingCoords = await this.prisma.procedureCoord.findMany({
        where: { id_proc },
        select: { id_coordonnees: true },
      });

      const coordIds = existingCoords
        .map((l) => l.id_coordonnees)
        .filter((id): id is number => id !== null && id !== undefined);

      const finalStatutCoord: 'DEMANDE_INITIALE' | 'NOUVEAU' | 'ANCIENNE' =
        statut_coord ??
        (existingCoords.length === 0 ? 'DEMANDE_INITIALE' : 'NOUVEAU');

      if (coordIds.length > 0) {
        await this.prisma.procedureCoord.deleteMany({
          where: { id_proc },
        });

        await this.prisma.coordonneePortail.deleteMany({
          where: { id_coordonnees: { in: coordIds } },
        });
      }

      const created = await this.prisma.$transaction(async (tx) => {
        const newCoords = await Promise.all(
          points.map((p) =>
            tx.coordonneePortail.create({
              data: {
                id_zone_interdite,
                x: parseFloat(p.x),
                y: parseFloat(p.y),
                z: parseFloat(p.z),
                system: p.system || 'WGS84',
                zone: p.zone || null,
                hemisphere: 'N',
                point: JSON.stringify({
                  x: p.x,
                  y: p.y,
                  z: p.z,
                  system: p.system,
                  zone: p.zone,
                  hemisphere: 'N',
                }),
              },
            }),
          ),
        );

        await Promise.all(
          newCoords.map((coord) =>
            tx.procedureCoord.create({
              data: {
                id_proc,
                id_coordonnees: coord.id_coordonnees,
                statut_coord: finalStatutCoord,
              },
            }),
          ),
        );

        return newCoords;
      });

      if (superficie !== undefined) {
        await this.prisma.procedurePortail.update({
          where: { id_proc },
          data: {
            observations: `Superficie mise à jour: ${superficie} m²`,
          },
        });
      }

      // Sync with GIS database
      try {
        const demande = await this.prisma.demandePortail.findFirst({
          where: { id_proc },
          include: { typePermis: true },
        });
        const typeCode = demande?.typePermis?.code_type ?? null;
        const gisPoints: GisPointInput[] = points.map((p) => ({
          x: parseFloat(p.x),
          y: parseFloat(p.y),
          system: p.system,
          zone: p.zone ?? null,
          hemisphere: p.hemisphere ?? 'N',
        }));
        await this.gisService.upsertProcedurePerimeter({
          id_proc,
          source: finalStatutCoord,
          typeCode,
          points: gisPoints,
        });
      } catch (e) {
        console.error('GIS sync failed in updateCoordonnees:', e);
      }

      return {
        message: 'Coordonnées mises à jour avec succès.',
        data: created,
      };
    } catch (err) {
      console.error('Erreur update:', err);
      throw new InternalServerErrorException(
        'Erreur lors de la mise à jour des coordonnées.',
      );
    }
  }

  async convertCoordinate(
    x: number,
    y: number,
    from: string,
    to: string,
    zone?: number,
    hemisphere?: string,
  ) {
    if (from === 'WGS84' && to === 'UTM') {
      return {
        x: (x * 111320 * Math.cos((y * Math.PI) / 180)).toFixed(2),
        y: (y * 110574).toFixed(2),
        system: 'UTM',
        zone: zone || 31,
        hemisphere: hemisphere || 'N',
      };
    } else if (from === 'UTM' && to === 'WGS84') {
      return {
        x: (
          x /
          (111320 * Math.cos((((zone || 31) * 6 - 183) * Math.PI) / 180))
        ).toFixed(6),
        y: (y / 110574).toFixed(6),
        system: 'WGS84',
      };
    }

    return { x, y, system: to };
  }
}
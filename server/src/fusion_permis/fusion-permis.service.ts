import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatutProcedure } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { DocumentsService } from '../demandes/documents/documents.service';
import { GisService } from 'src/gis/gis.service';
import { buildDemandeCode } from 'src/demandes/utils/demande-code';
import { NotificationsService } from 'src/notifications/notifications.service';
import proj4 = require('proj4');

@Injectable()
export class FusionPermisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly gisService: GisService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private readonly defaultUtmZone = 31;
  private readonly defaultHemisphere: 'N' | 'S' = 'N';

  private utmProj(zone?: number) {
    return (
      `+proj=utm +zone=${zone ?? this.defaultUtmZone} +a=6378249.138 +b=6356514.9999 +units=m ` +
      `+k=0.9996 +x_0=500000 +y_0=0 +no_defs`
    );
  }

  private toWgs(point: {
    x: number;
    y: number;
    zone?: number | null;
    hemisphere?: string | null;
    system?: string | null;
  }): [number, number] {
    // If the point looks already in lon/lat, return it as-is
    if (Math.abs(point.x) <= 180 && Math.abs(point.y) <= 90) {
      return [point.x, point.y];
    }
    const zone = point.zone ?? this.defaultUtmZone;
    return proj4(this.utmProj(zone), 'EPSG:4326', [point.x, point.y]) as [
      number,
      number,
    ];
  }

  private toUtm(lngLat: [number, number], zone?: number) {
    return proj4('EPSG:4326', this.utmProj(zone), lngLat) as [number, number];
  }

  private async pickLatestAcceptedProcedure(permisId: number) {
    // 1) Procédures terminées + demande acceptée, triées du plus récent au plus ancien
    const acceptedStatuses = ['ACCEPTEE', 'ACCEPTE', 'ACCEPTÉE', 'ACCEPTÉ'];
    const procTerminees = await this.prisma.procedurePortail.findMany({
      where: {
        statut_proc: 'TERMINEE',
        permisProcedure: { some: { id_permis: permisId } },
        demandes: {
          some: {
            OR: acceptedStatuses.map((s) => ({
              statut_demande: { equals: s, mode: 'insensitive' },
            })),
          },
        },
      },
      include: {
        coordonnees: {
          include: { coordonnee: true },
          orderBy: { id_coordonnees: 'asc' },
        },
        demandes: true,
      },
      orderBy: [{ date_fin_proc: 'desc' }, { id_proc: 'desc' }],
      take: 30,
    });
    console.log(
      'pickLatestAcceptedProcedure: TERMINEE+ACCEPTEE candidates for permis',
      permisId,
      procTerminees.map((p) => ({
        id_proc: p.id_proc,
        statut_proc: p.statut_proc,
        date_fin_proc: p.date_fin_proc,
        coordonnees: p.coordonnees?.length || 0,
        demandes_statuts: (p.demandes || []).map((d) => d.statut_demande),
      })),
    );

    // Toujours regarder d'abord la toute derni褍re proc TERMIN蝫E + ACCEP蝫EE
    const latestTerminee = procTerminees[0] || null;
    const latestHasCoords =
      (latestTerminee?.coordonnees?.length || 0) >= 3 ? latestTerminee : null;

    // Sinon, on prend la premi褍re TERMIN蝫E + ACCEP蝫EE qui a des coordonn褍es (classement d褍j褍 tri褍)
    const nextWithCoords =
      latestHasCoords ||
      procTerminees.find((p) => (p.coordonnees?.length || 0) >= 3) ||
      null;

    let selected = nextWithCoords || latestTerminee;
    if (selected) {
      console.log(
        'pickLatestAcceptedProcedure: selected TERMINEE+ACCEPTEE for permis',
        permisId,
        '->',
        selected.id_proc,
        'coordonnees:',
        selected.coordonnees?.length || 0,
      );
      return selected;
    }

    // 2) Fallback : n'importe quelle procédure avec coordonnées, la plus récente
    const procAny = await this.prisma.procedurePortail.findMany({
      where: {
        permisProcedure: { some: { id_permis: permisId } },
        coordonnees: { some: {} },
      },
      include: {
        coordonnees: {
          include: { coordonnee: true },
          orderBy: { id_coordonnees: 'asc' },
        },
        demandes: true,
      },
      orderBy: [{ date_fin_proc: 'desc' }, { id_proc: 'desc' }],
      take: 30,
    });
    console.log(
      'pickLatestAcceptedProcedure: fallback ANY+coords candidates for permis',
      permisId,
      procAny.map((p) => ({
        id_proc: p.id_proc,
        statut_proc: p.statut_proc,
        date_fin_proc: p.date_fin_proc,
        coordonnees: p.coordonnees?.length || 0,
        demandes_statuts: (p.demandes || []).map((d) => d.statut_demande),
      })),
    );
    selected = procAny[0] || null;
    if (selected) {
      console.log(
        'pickLatestAcceptedProcedure: selected FALLBACK for permis',
        permisId,
        '->',
        selected.id_proc,
        'coordonnees:',
        selected.coordonnees?.length || 0,
      );
    } else {
      console.log(
        'pickLatestAcceptedProcedure: no procedure found for permis',
        permisId,
      );
    }
    return selected;
  }

  private buildPolygonFromProcedure(proc: any) {
    if (!proc) return null;
    const coords = proc.coordonnees || [];
    if (!coords.length) return null;
    const zoneHint =
      // Priorité au champ dédié "zone"
      coords.find((c: any) => c?.coordonnee?.zone)?.coordonnee?.zone ??
      // Fallback : certains jeux de données stockent le fuseau dans "z"
      coords
        .map((c: any) => Number(c?.coordonnee?.z))
        .find((z: number) => Number.isFinite(z) && z >= 1 && z <= 60) ??
      this.defaultUtmZone;
    const ringWgs: [number, number][] = coords
      .map((c: any) => {
        const pt = c?.coordonnee;
        if (!pt) return null;
        return this.toWgs({
          x: Number(pt.x),
          y: Number(pt.y),
          zone: pt.zone ?? zoneHint,
          hemisphere: pt.hemisphere ?? this.defaultHemisphere,
          system: pt.system ?? 'UTM',
        });
      })
      .filter(Boolean) as [number, number][];

    if (ringWgs.length < 3) return null;
    const first = ringWgs[0];
    const last = ringWgs[ringWgs.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ringWgs.push([first[0], first[1]]);
    }

    const wkt = `POLYGON((${ringWgs
      .map(([lng, lat]) => `${lng} ${lat}`)
      .join(', ')}))`;

    return { wkt, ringWgs, zoneHint };
  }

  private buildPolygonFromPoints(
    points: {
      x: number;
      y: number;
      z?: number;
      zone?: number | null;
      hemisphere?: string | null;
      system?: string | null;
    }[],
  ) {
    if (!points || points.length < 3) return null;
    const zoneHint =
      points.find((p) => p.zone)?.zone ??
      points
        .map((p) => Number(p.z))
        .find((z) => Number.isFinite(z) && z >= 1 && z <= 60) ??
      this.defaultUtmZone;

    const ringWgs: [number, number][] = points.map((pt) =>
      this.toWgs({
        x: Number(pt.x),
        y: Number(pt.y),
        zone: pt.zone ?? zoneHint,
        hemisphere: pt.hemisphere ?? this.defaultHemisphere,
        system: pt.system ?? 'UTM',
      }),
    );

    const first = ringWgs[0];
    const last = ringWgs[ringWgs.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ringWgs.push([first[0], first[1]]);
    }

    const wkt = `POLYGON((${ringWgs
      .map(([lng, lat]) => `${lng} ${lat}`)
      .join(', ')}))`;

    return { wkt, ringWgs, zoneHint };
  }

  private cleanRingCoords(ring: [number, number][]) {
    if (!ring || ring.length < 3) return ring;

    // Assure un anneau fermé pour le nettoyage
    const closed =
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? [...ring]
        : [...ring, ring[0]];

    const cleaned: [number, number][] = [];
    const n = closed.length;
    for (let i = 0; i < n; i++) {
      const prev = closed[(i - 1 + n) % n];
      const curr = closed[i];
      const next = closed[(i + 1) % n];

      // Supprime les points colinéaires (croix produit ~ 0)
      const cross =
        (curr[0] - prev[0]) * (next[1] - curr[1]) -
        (curr[1] - prev[1]) * (next[0] - curr[0]);
      if (i !== 0 && i !== n - 1 && Math.abs(cross) < 1e-9) {
        continue;
      }
      // Supprime les doublons immédiats
      if (
        cleaned.length &&
        cleaned[cleaned.length - 1][0] === curr[0] &&
        cleaned[cleaned.length - 1][1] === curr[1]
      ) {
        continue;
      }
      cleaned.push(curr);
    }

    // Ré-ouvre si nécessaire
    if (
      cleaned.length &&
      (cleaned[0][0] !== cleaned[cleaned.length - 1][0] ||
        cleaned[0][1] !== cleaned[cleaned.length - 1][1])
    ) {
      cleaned.push([cleaned[0][0], cleaned[0][1]]);
    }

    // Enlève le dernier point si doublon final
    if (
      cleaned.length > 3 &&
      cleaned[0][0] === cleaned[cleaned.length - 1][0] &&
      cleaned[0][1] === cleaned[cleaned.length - 1][1]
    ) {
      cleaned.pop();
    }

    return cleaned;
  }

  // Fallback simple (UTM, segments axis-aligned) pour mesurer la frontière commune envoyée par le front
  private sharedBoundaryFromUtmPoints(
    ptsA?: { x: number; y: number }[] | null,
    ptsB?: { x: number; y: number }[] | null,
  ): number {
    if (!ptsA || !ptsB || ptsA.length < 2 || ptsB.length < 2) return 0;
    const close = (arr: { x: number; y: number }[]) =>
      arr[0].x === arr[arr.length - 1].x && arr[0].y === arr[arr.length - 1].y
        ? arr
        : [...arr, arr[0]];

    const ringA = close(ptsA);
    const ringB = close(ptsB);

    const edges = (ring: { x: number; y: number }[]) =>
      ring.slice(0, -1).map((p, i) => {
        const n = ring[i + 1];
        return { p1: p, p2: n };
      });

    const edgesA = edges(ringA);
    const edgesB = edges(ringB);

    let total = 0;
    for (const ea of edgesA) {
      const { p1: a1, p2: a2 } = ea;
      const vaX = a2.x - a1.x;
      const vaY = a2.y - a1.y;
        const verticalA = Math.abs(vaX) < 1; // tolérance 1 m
        const horizontalA = Math.abs(vaY) < 1; // tolérance 1 m

      for (const eb of edgesB) {
        const { p1: b1, p2: b2 } = eb;
        const vbX = b2.x - b1.x;
        const vbY = b2.y - b1.y;
        const verticalB = Math.abs(vbX) < 1;
        const horizontalB = Math.abs(vbY) < 1;

        // même orientation et colinéarité
        if (verticalA && verticalB && Math.abs(a1.x - b1.x) < 1) {
          const yA1 = a1.y;
          const yA2 = a2.y;
          const yB1 = b1.y;
          const yB2 = b2.y;
          const minA = Math.min(yA1, yA2);
          const maxA = Math.max(yA1, yA2);
          const minB = Math.min(yB1, yB2);
          const maxB = Math.max(yB1, yB2);
          const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
          if (overlap > 0) total += overlap;
        } else if (horizontalA && horizontalB && Math.abs(a1.y - b1.y) < 1) {
          const xA1 = a1.x;
          const xA2 = a2.x;
          const xB1 = b1.x;
          const xB2 = b2.x;
          const minA = Math.min(xA1, xA2);
          const maxA = Math.max(xA1, xA2);
          const minB = Math.min(xB1, xB2);
          const maxB = Math.max(xB1, xB2);
          const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
          if (overlap > 0) total += overlap;
        }
      }
    }
    return total;
  }

  private resolvePermisDetenteurId(permis: any): number | null {
    const direct = Number(permis?.id_detenteur);
    if (Number.isFinite(direct) && direct > 0) return direct;

    const fromDemandes = new Set<number>();
    const procedures = Array.isArray(permis?.procedures) ? permis.procedures : [];
    procedures.forEach((p: any) => {
      const demandes = Array.isArray(p?.demandes) ? p.demandes : [];
      demandes.forEach((d: any) => {
        const rel = Array.isArray(d?.detenteurdemande) ? d.detenteurdemande : [];
        rel.forEach((item: any) => {
          const id = Number(item?.detenteur?.id_detenteur ?? item?.id_detenteur);
          if (Number.isFinite(id) && id > 0) {
            fromDemandes.add(id);
          }
        });
      });
    });

    if (fromDemandes.size === 1) {
      return Array.from(fromDemandes)[0];
    }
    return null;
  }

  private resolveUtilisateurId(
    permisA: any,
    permisB: any,
    initialDemandeA: any,
    initialDemandeB: any,
  ): number | null {
    const candidates = [
      Number(initialDemandeA?.utilisateurId),
      Number(initialDemandeB?.utilisateurId),
    ].filter((n) => Number.isFinite(n) && n > 0) as number[];

    if (candidates.length > 0) return candidates[0];

    const fromPermis = (permis: any): number | null => {
      const procedures = Array.isArray(permis?.procedures) ? permis.procedures : [];
      for (const proc of procedures) {
        const demandes = Array.isArray(proc?.demandes) ? proc.demandes : [];
        for (const d of demandes) {
          const uid = Number(d?.utilisateurId);
          if (Number.isFinite(uid) && uid > 0) {
            return uid;
          }
        }
      }
      return null;
    };

    return fromPermis(permisA) || fromPermis(permisB) || null;
  }

  async fusionner(
    id_principal: number,
    id_secondaire: number,
    motif_fusion: string,
  ) {
    if (id_principal === id_secondaire) {
      throw new BadRequestException(
        'Le permis A et le permis B doivent être différents',
      );
    }
    const permisPrincipalData = await this.prisma.permisPortail.findUnique({
      where: { id: id_principal },
      include: {
        typePermis: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    typeProcedure: true,
                    detenteurdemande: {
                      include: { detenteur: true },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const permisPrincipal = permisPrincipalData
      ? {
          ...permisPrincipalData,
          procedures: permisPrincipalData.permisProcedure
            .map((pp) => pp.procedure)
            .filter(Boolean)
            .sort(
              (a, b) =>
                (a.date_debut_proc?.getTime() || 0) -
                (b.date_debut_proc?.getTime() || 0),
            ),
        }
      : null;

    const permisSecondaireData = await this.prisma.permisPortail.findUnique({
      where: { id: id_secondaire },
      include: {
        typePermis: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    typeProcedure: true,
                    detenteurdemande: {
                      include: { detenteur: true },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const permisSecondaire = permisSecondaireData
      ? {
          ...permisSecondaireData,
          procedures: permisSecondaireData.permisProcedure
            .map((pp) => pp.procedure)
            .filter(Boolean)
            .sort(
              (a, b) =>
                (a.date_debut_proc?.getTime() || 0) -
                (b.date_debut_proc?.getTime() || 0),
            ),
        }
      : null;

    if (!permisPrincipal || !permisSecondaire) {
      throw new NotFoundException('Permis principal ou secondaire introuvable');
    }

    // Vérifier si l'un des permis est déjà impliqué dans une fusion en cours
    const existingFusion = await this.prisma.fusionPermisSource.findFirst({
      where: {
        id_permis: { in: [id_principal, id_secondaire] },
        demFusion: {
          statut_fusion: { not: 'Terminee' },
        },
      },
      include: { demFusion: true },
    });
    if (existingFusion) {
      throw new BadRequestException(
        'Le permis sélectionné est déjà impliqué dans une fusion en cours.',
      );
    }

    const pickInitialDemande = (proc?: any | null) =>
      proc?.demandes?.find(
        (demande: any) =>
          demande.typeProcedure?.libelle?.toLowerCase() === 'demande',
      ) || proc?.demandes?.[0] || null;

    const initialProcedureA = permisPrincipal.procedures[0] || null;
    const initialProcedureB = permisSecondaire.procedures[0] || null;

    const initialDemandeA = pickInitialDemande(initialProcedureA);
    const initialDemandeB = pickInitialDemande(initialProcedureB);

    let typeProcedure =
      (await this.prisma.typeProcedure.findFirst({
        where: { libelle: { equals: 'fusion', mode: 'insensitive' } },
      })) ||
      (await this.prisma.typeProcedure.findFirst({
        where: { libelle: { contains: 'fusion', mode: 'insensitive' } },
      }));

    // Créer le type de procédure "fusion" si absent, pour éviter un 404 artificiel
    if (!typeProcedure) {
      typeProcedure = await this.prisma.typeProcedure.create({
        data: {
          libelle: 'fusion',
          description: 'Fusion de permis',
        },
      });
    }

    const codeType = permisPrincipal.typePermis?.code_type ?? 'UNK';
    const fusionProcCode = `FUS-${Date.now()}`;

    const procedure = await this.prisma.procedurePortail.create({
      data: {
        num_proc: fusionProcCode,
        date_debut_proc: new Date(),
        statut_proc: 'EN_COURS',
        typeProcedureId: typeProcedure.id,
      },
    });

    // Attacher la nouvelle procedure aux deux permis impliques
    await this.prisma.permisProcedure.createMany({
      data: [
        { id_permis: id_principal, id_proc: procedure.id_proc },
        { id_permis: id_secondaire, id_proc: procedure.id_proc },
      ],
    });

    const detenteurPrincipal = this.resolvePermisDetenteurId(permisPrincipal);
    const detenteurSecondaire = this.resolvePermisDetenteurId(permisSecondaire);

    if (!detenteurPrincipal || !detenteurSecondaire) {
      throw new NotFoundException(
        "Impossible de déterminer le détenteur pour les permis à fusionner.",
      );
    }

    if (detenteurPrincipal !== detenteurSecondaire) {
      throw new BadRequestException(
        'Fusion impossible : les deux permis doivent appartenir au même détenteur.',
      );
    }

    const detenteurId = detenteurPrincipal;

    if (!detenteurId) {
      throw new NotFoundException(
        "Le permis principal n'a pas de detenteur associe.",
      );
    }

    const utilisateurId = this.resolveUtilisateurId(
      permisPrincipal,
      permisSecondaire,
      initialDemandeA,
      initialDemandeB,
    );

    if (!utilisateurId) {
      throw new BadRequestException(
        'utilisateurId introuvable pour créer la demande de fusion.',
      );
    }

    const newDemande = await this.prisma.demandePortail.create({
      data: {
        utilisateurId,
        id_proc: procedure.id_proc,
        id_typeProc: typeProcedure.id,
        id_typePermis: permisPrincipal.id_typePermis,
        code_demande: null,
        date_demande: new Date(),
        date_instruction: new Date(),
        statut_demande: 'EN_COURS',
        detenteurdemande: {
          create: {
            id_detenteur: detenteurId,
            role_detenteur: 'Demandeur',
          },
        },
      },
    });

    const generatedCode = buildDemandeCode(
      'FUS',
      codeType,
      newDemande.id_demande,
    );

    await this.prisma.demandePortail.update({
      where: { id_demande: newDemande.id_demande },
      data: {
        code_demande: generatedCode,
      },
      select: { id_demande: true },
    });

    try {
      await this.notificationsService.createAdminNewDemandeNotification({
        demandeId: newDemande.id_demande,
        demandeCode: generatedCode,
        requesterUserId: utilisateurId,
      });
    } catch (error) {
      console.warn(
        'Failed to create admin notification for fusion demande',
        error,
      );
    }

    const newFusion = await this.prisma.demFusion.create({
      data: {
        id_permisResultant: id_principal,
        id_demande: newDemande.id_demande,
        date_fusion: new Date(),
        motif_fusion: motif_fusion || null,
        statut_fusion: 'En cours',
      },
    });

    await this.prisma.fusionPermisSource.createMany({
      data: [
        { id_permis: id_principal, id_fusion: newFusion.id_fusion },
        { id_permis: id_secondaire, id_fusion: newFusion.id_fusion },
      ],
    });

    // Initialiser les phases de la procedure en fonction de la configuration (typeProc x typePermis)
    const phaseRelations = await this.prisma.relationPhaseTypeProc.findMany({
      where: {
        combinaison: {
          id_typeProc: typeProcedure.id,
          id_typePermis: permisPrincipal.id_typePermis,
        },
      },
      include: {
        manyEtape: {
          include: { phase: true },
        },
      },
      orderBy: [{ ordre: 'asc' }],
    });

    if (phaseRelations.length > 0) {
      const byPhase = new Map<number, { ordre: number; id_phase: number }>();
      phaseRelations.forEach((relation, index) => {
        const phaseId = relation.manyEtape?.id_phase;
        if (phaseId == null) return;
        const ordre = relation.ordre ?? index + 1;
        if (!byPhase.has(phaseId) || ordre < (byPhase.get(phaseId)?.ordre ?? ordre)) {
          byPhase.set(phaseId, { ordre, id_phase: phaseId });
        }
      });

      const procedurePhasesData = Array.from(byPhase.values()).map(
        (p, index) => ({
          id_proc: procedure.id_proc,
          id_phase: p.id_phase,
          ordre: p.ordre ?? index + 1,
          statut:
            index === 0
              ? StatutProcedure.EN_COURS
              : StatutProcedure.EN_ATTENTE,
        }),
      );

      await this.prisma.procedurePhase.createMany({
        data: procedurePhasesData,
      });
    }

    const result = {
      id_procedure: procedure.id_proc,
      original_demande_idA: initialDemandeA?.id_demande ?? null,
      original_demande_idB: initialDemandeB?.id_demande ?? null,
      new_proc_idA: initialProcedureA?.id_proc ?? null,
      new_proc_idB: initialProcedureB?.id_proc ?? null,
    };

    console.log('Resultat de fusionner:', result);

    return result;
  }

  async getDocumentsForFusion(id_permis: number, id_typePermis: number) {
    const demandeFusion = await this.prisma.demandePortail.findFirst({
      where: {
        typeProcedure: {
          libelle: 'fusion',
        },
        code_demande: { startsWith: 'DEM-FUS-' },
      },
      orderBy: { date_demande: 'desc' },
    });

    if (!demandeFusion) {
      throw new NotFoundException('Demande de fusion introuvable');
    }

    return this.documentsService.getDocumentsByDemande(
      demandeFusion.id_demande,
    );
  }

  async findExistingFusion(
    id_principal: number,
    id_secondaire: number,
  ): Promise<{
    exists: boolean;
    id_demande?: number | null;
    id_procedure?: number | null;
    id_fusion?: number | null;
    original_demande_idA?: number | null;
    original_demande_idB?: number | null;
    new_proc_idA?: number | null;
    new_proc_idB?: number | null;
    fusion_permis?: { id_permis: number; code_permis?: string | null }[];
    statut_fusion?: string | null;
  }> {
    const fusion = await this.prisma.fusionPermisSource.findFirst({
      where: {
        id_permis: { in: [id_principal, id_secondaire] },
        demFusion: {
          statut_fusion: { not: 'Terminee' },
        },
      },
      include: {
        demFusion: {
          include: {
            demande: true,
            fusionPermisSource: {
              include: { permis: true },
            },
          },
        },
      },
    });

    if (!fusion || !fusion.demFusion) {
      return { exists: false };
    }

    const demande = fusion.demFusion.demande;
    return {
      exists: true,
      id_demande: demande?.id_demande ?? null,
      id_procedure: demande?.id_proc ?? null,
      id_fusion: fusion.demFusion.id_fusion,
      original_demande_idA: null,
      original_demande_idB: null,
      new_proc_idA: null,
      new_proc_idB: null,
      fusion_permis: fusion.demFusion.fusionPermisSource?.map((fps) => ({
        id_permis: fps.id_permis,
        code_permis: (fps as any)?.permis?.code_permis ?? null,
      })),
      statut_fusion: fusion.demFusion.statut_fusion,
    };
  }

  async fusionnerGeometries(params: {
    id_permis_A: number;
    id_permis_B: number;
    id_proc_fusion?: number | null;
    id_permis_resultant?: number | null;
    id_proc_A?: number | null;
    id_proc_B?: number | null;
    source?: string;
    pointsA?: {
      x: number;
      y: number;
      z?: number;
      zone?: number | null;
      hemisphere?: string | null;
      system?: string | null;
    }[];
    pointsB?: {
      x: number;
      y: number;
      z?: number;
      zone?: number | null;
      hemisphere?: string | null;
      system?: string | null;
    }[];
  }) {
    const {
      id_permis_A,
      id_permis_B,
      id_proc_fusion,
      id_permis_resultant,
      id_proc_A,
      id_proc_B,
      source,
      pointsA,
      pointsB,
    } = params;

    const getProcById = async (id_proc?: number | null) => {
      if (!id_proc) return null;
      return this.prisma.procedurePortail.findUnique({
        where: { id_proc },
        include: {
          coordonnees: { include: { coordonnee: true }, orderBy: { id_coordonnees: 'asc' } },
          demandes: true,
        },
      });
    };

    const isTermineeEtAcceptee = (proc?: any | null) =>
      proc?.statut_proc === 'TERMINEE' &&
      (proc?.demandes || []).some(
        (d: any) => (d?.statut_demande || '').toUpperCase() === 'ACCEPTEE',
      );

    const pickProcForPermis = async (
      permisId: number,
      preferredProcId?: number | null,
      label: 'A' | 'B' = 'A',
    ) => {
      const preferred = await getProcById(preferredProcId);
      if (preferredProcId && (!preferred || (preferred.coordonnees?.length || 0) < 3)) {
        throw new NotFoundException(
          `Il manque des coordonnÇ¸es pour le permis ${label} (proc ${preferredProcId}).`,
        );
      }
      if (isTermineeEtAcceptee(preferred)) {
        return preferred;
      }
      // Si la procÇ¸dure prÇ¸fÇ¸rÇ¸e n'est pas terminÇ¸e + acceptÇ¸e,
      // on prend la plus rÇ¸cente qui l'est.
      const latest = await this.pickLatestAcceptedProcedure(permisId);
      if (latest) {
        return latest;
      }
      return preferred;
    };

    const procA = await pickProcForPermis(id_permis_A, id_proc_A, 'A');
    const procB = await pickProcForPermis(id_permis_B, id_proc_B, 'B');

    if (!procA || !procB) {
      throw new NotFoundException(
        'Impossible de trouver des périmètres terminés et acceptés pour les deux permis',
      );
    }

    const polyA =
      pointsA && pointsA.length >= 3
        ? this.buildPolygonFromPoints(pointsA)
        : this.buildPolygonFromProcedure(procA);
    const polyB =
      pointsB && pointsB.length >= 3
        ? this.buildPolygonFromPoints(pointsB)
        : this.buildPolygonFromProcedure(procB);

    if (!polyA || !polyB) {
      throw new NotFoundException(
        'Coordonnées insuffisantes pour construire les polygones',
      );
    }

    console.log(
      'Fusion geom: permis A',
      id_permis_A,
      'procA',
      procA?.id_proc,
      'WKT A:',
      polyA.wkt,
    );
    console.log(
      'Fusion geom: permis B',
      id_permis_B,
      'procB',
      procB?.id_proc,
      'WKT B:',
      polyB.wkt,
    );

    let row: any;
    try {
      row = await this.gisService.unionPolygons({
        wktA: polyA.wkt,
        wktB: polyB.wkt,
        distanceMeters: 100,
      });
    } catch (e) {
      throw new BadRequestException(
        `Erreur PostGIS lors de la fusion des périmètres: ${
          (e as any)?.message || 'inconnue'
        }`,
      );
    }

    const threshold = 100;
    let shared_boundary_m = Number(row?.shared_boundary_m || 0);

    // Fallback sur les points envoyés par le front (UTM) si PostGIS renvoie < seuil
    if (shared_boundary_m < threshold && pointsA && pointsB) {
      shared_boundary_m = this.sharedBoundaryFromUtmPoints(
        pointsA.map((p) => ({ x: Number(p.x), y: Number(p.y) })),
        pointsB.map((p) => ({ x: Number(p.x), y: Number(p.y) })),
      );
    }

    // Second fallback : si pas de points fournis, calculer l'overlap à partir des anneaux déjà construits
    if (shared_boundary_m < threshold && (!pointsA || !pointsB)) {
      const utmA =
        polyA?.ringWgs?.map((lnglat: [number, number]) => {
          const [ux, uy] = this.toUtm(lnglat, polyA?.zoneHint);
          return { x: ux, y: uy };
        }) || null;
      const utmB =
        polyB?.ringWgs?.map((lnglat: [number, number]) => {
          const [ux, uy] = this.toUtm(lnglat, polyB?.zoneHint);
          return { x: ux, y: uy };
        }) || null;
      shared_boundary_m = this.sharedBoundaryFromUtmPoints(utmA, utmB);
    }

    const within100 = shared_boundary_m >= threshold;
    const distance_m = Number(row?.distance_m || 0);
    const overlap_area_ha = Number(row?.overlap_area_ha || 0);
    if (!within100) {
      return {
        success: false,
        within100,
        distance_m,
        message:
          'Fusion refusée : il faut au moins 100 m de frontière commune (pas seulement un point).',
      };
    }

    // Rejeter une fusion si les pÇ¸rimÇùtres ne partagent qu'un point ou une ligne trop courte (<100 m)
    const hasSufficientCommonEdge = shared_boundary_m >= 100 || overlap_area_ha > 0;
    if (!hasSufficientCommonEdge) {
      return {
        success: false,
        within100,
        distance_m,
        shared_boundary_m,
        overlap_area_ha,
        message:
          'Fusion refusÇ¸e : les pÇ¸rimÇùtres sont seulement tangents (contact ponctuel / <100m de bord commun).',
      };
    }

    const geo =
      row?.geojson ||
      row?.outer_geojson ||
      (row?.geojson && JSON.parse(row.geojson)) ||
      null;
    if (!geo || !geo.coordinates) {
      throw new BadRequestException('Union géométrique invalide (PostGIS).');
    }

    // Extraire les anneaux : si MultiPolygon, on concatène les extérieurs pour conserver uniquement les points des deux titres
    let ring: [number, number][] = [];
    if (geo.type === 'Polygon') {
      ring = geo.coordinates?.[0] || [];
    } else if (geo.type === 'MultiPolygon') {
      const polys: any[] = geo.coordinates || [];
      ring = polys.flatMap((p) => p?.[0] || []);
    } else if (geo.type === 'LineString') {
      ring = geo.coordinates || [];
    }

    ring = this.cleanRingCoords(ring as [number, number][]);

    if (!ring || ring.length < 3) {
      throw new BadRequestException('Périmètre fusionné vide ou incomplet.');
    }

    // Nettoyer le dernier point identique
    if (
      ring.length > 3 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
    ) {
      ring = ring.slice(0, -1);
    }

    const fusionZone =
      polyA.zoneHint || polyB.zoneHint || this.defaultUtmZone;

    const utmRing = ring.map((lngLat: [number, number]) => {
      const [x, y] = this.toUtm(
        lngLat as [number, number],
        fusionZone || this.defaultUtmZone,
      );
      return {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        // On renseigne le fuseau utilisé dans Z pour l'affichage du périmètre fusionné
        z: fusionZone || this.defaultUtmZone,
        system: 'UTM' as const,
        zone: fusionZone || this.defaultUtmZone,
        hemisphere: this.defaultHemisphere,
      };
    });

    // Persist in SIGAM (coordonnee / procedureCoord) si id_proc_fusion fourni
    if (id_proc_fusion) {
      await this.prisma.procedureCoord.deleteMany({
        where: { id_proc: id_proc_fusion },
      });

      const createdCoords = await this.prisma.$transaction(
        utmRing.map((p) =>
          this.prisma.coordonneePortail.create({
            data: {
              x: p.x,
              y: p.y,
              z: p.z,
              system: 'UTM',
              zone: p.zone,
              hemisphere: p.hemisphere,
            },
          }),
        ),
      );

      await this.prisma.$transaction(
        createdCoords.map((c) =>
          this.prisma.procedureCoord.create({
            data: {
              id_proc: id_proc_fusion,
              id_coordonnees: c.id_coordonnees,
              statut_coord: 'NOUVEAU',
            },
          }),
        ),
      );

      // Sauvegarde dans sig_gis
      try {
        await this.gisService.upsertFullPerimeter({
          geomWkt: row.wkt,
          id_proc: id_proc_fusion,
          id_permis: id_permis_resultant ?? id_permis_A ?? null,
          source: params.source || 'FUSION',
          status: 'ACTIF',
          areaHa: Number(row.area_ha || 0),
        });
      } catch (err) {
        console.warn('Impossible de pousser le périmètre fusionné vers sig_gis', err);
      }
    }

    return {
      success: true,
      within100,
      distance_m,
      shared_boundary_m,
      overlap_area_ha,
      area_ha: Number(row.area_ha || 0),
      wkt: row.wkt,
      ring_utm: utmRing,
      ring_wgs: ring,
      message: 'Fusion possible : périmètres contigus (PostGIS).',
    };
  }
}

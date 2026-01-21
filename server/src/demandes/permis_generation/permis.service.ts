import { Injectable, Logger } from '@nestjs/common';
import { unescape } from 'querystring';
import { PrismaService } from 'src/prisma/prisma.service';
import { GisService } from '../gis/gis.service';
import * as crypto from 'crypto';

@Injectable()
export class GeneratePermisService {
  private readonly logger = new Logger(GeneratePermisService.name);

  constructor(
    private prisma: PrismaService,
    private gisService: GisService,
  ) {}

  private pad2(n: number) {
    return String(n).padStart(2, '0');
  }

  private generateUniqueQr(
    codePermis: string,
    typeCode: string,
    dateDemandeRaw: any,
    codeWilaya: string,
    nomSociete: string,
  ) {
    const dateSysteme = new Date();
    const dateHeureSysteme = `${dateSysteme.getFullYear()}-${this.pad2(dateSysteme.getMonth() + 1)}-${this.pad2(dateSysteme.getDate())}T${this.pad2(dateSysteme.getHours())}:${this.pad2(dateSysteme.getMinutes())}:${this.pad2(dateSysteme.getSeconds())}`;
    const horodatageHash = dateHeureSysteme.replace(/[-:TZ.]/g, '');
    const dateDemande = String(dateDemandeRaw || '').replace(/[^0-9]/g, '');
    const combined = `${codePermis}${typeCode}${dateDemande}${codeWilaya}${nomSociete}${horodatageHash}`;
    const hash = crypto
      .createHash('sha256')
      .update(combined)
      .digest('hex')
      .toUpperCase();
    const base = hash.substring(0, 20);
    const codeUnique = (base.match(/.{1,5}/g) || [base]).join('-');
    return { codeUnique, dateHeureSysteme };
  }

  async generatePermisFromDemande(
    demandeId: number,
    options?: { codeNumber?: number | string },
  ) {
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande: demandeId },
      include: {
        typePermis: true,
        wilaya: { include: { antenne: true } },
        daira: true,
        procedure: true,
        detenteurdemande: { include: { detenteur: true }, take: 1 },
      },
    });

    if (!demande) {
      throw new Error('Demande not found');
    }
    if (!demande.typePermis) {
      throw new Error('TypePermis missing');
    }
    if (!demande.procedure) {
      throw new Error('Procedure missing');
    }
    const detenteurRel = demande.detenteurdemande?.[0]?.detenteur || null;
    if (!detenteurRel) {
      throw new Error('Detenteur missing');
    }
    const expirationDate = new Date();
    expirationDate.setFullYear(
      expirationDate.getFullYear() + demande.typePermis.duree_initiale!,
    );

    // Resolve default statut if available (e.g., "En vigueur"). If not found, leave unset.
    const defaultStatut = await this.prisma.statutPermis.findFirst({
      where: { lib_statut: { contains: 'En vigueur', mode: 'insensitive' } },
      select: { id: true },
    });

    // Generate code_permis as the next available integer (no prefix)
    let code_permis: string | null = null;

    // If caller provided a fixed designation number, try to use it if free; otherwise fall back to next available
    if (
      options?.codeNumber !== undefined &&
      options?.codeNumber !== null &&
      `${options.codeNumber}`.trim() !== ''
    ) {
      const fixedNum = `${options.codeNumber}`.trim();
      const exists = await this.prisma.permisPortail.findFirst({
        where: { code_permis: fixedNum },
      });
      if (!exists) {
        code_permis = fixedNum;
      } else {
        this.logger.warn(
          `Code permis ${fixedNum} already exists, computing next available code.`,
        );
      }
    }

    if (!code_permis) {
      // Fallback: derive the next integer strictly greater than the MAX numeric suffix
      // present in the permis table (works even if code_permis has a prefix, e.g. "APM 8012").
      const maxRow = await this.prisma.$queryRaw<
        Array<{ max_num: bigint | number | null }>
      >`SELECT COALESCE(MAX((regexp_match(code_permis, '([0-9]+)$'))[1]::INTEGER), 0) AS max_num FROM permis WHERE code_permis ~ '([0-9]+)$'`;

      const currentMax = maxRow?.[0]?.max_num ?? 0;
      let pSeq = Number(currentMax);
      if (!Number.isFinite(pSeq) || pSeq < 0) pSeq = 0;

      // Increment once to get the next available number
      pSeq += 1;
      code_permis = String(pSeq);

      // Safety: if collision occurs (unlikely), keep incrementing until free
      while (await this.prisma.permisPortail.findFirst({ where: { code_permis } })) {
        pSeq += 1;
        code_permis = String(pSeq);
      }
    }

    const newPermis = await this.prisma.permisPortail.create({
      data: {
        id_typePermis: demande.typePermis.id,
        id_antenne: demande.wilaya?.id_antenne ?? null,
        id_detenteur: detenteurRel.id_detenteur,
        id_statut: defaultStatut?.id ?? undefined,
        code_permis,
        date_adjudication: null,
        date_octroi: new Date(),
        date_expiration: expirationDate,
        duree_validite: demande.typePermis.duree_initiale!,
        lieu_ditFR: demande.lieu_ditFR || '',
        lieu_ditAR: demande.lieu_dit_ar || '',
        utilisation: '',
        statut_activites: demande.procedure.statut_proc || '',
        commentaires: null,
        nombre_renouvellements: 0,
      },
    });

    await this.prisma.cahierChargePortail.updateMany({
      where: { demandeId: demandeId },
      data: { permisId: newPermis.id },
    });

    // Link permis to procedure via join table
    if (demande.id_proc) {
      await this.prisma.permisProcedure.create({
        data: {
          id_permis: newPermis.id,
          id_proc: demande.id_proc,
        },
      });

      // Also link this permis to the GIS perimeter for this procedure
      try {
        await this.gisService.linkPermisToPerimeter(
          demande.id_proc,
          newPermis.id,
          {
            codePermis: newPermis.code_permis ?? null,
            typeCode: demande.typePermis.code_type ?? null,
            typeLabel: demande.typePermis.lib_type ?? null,
            titulaire:
              detenteurRel.nom_societeFR || detenteurRel.nom_societeAR || null,
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to link permis ${newPermis.id} to GIS perimeter for procedure ${demande.id_proc}`,
          err as Error,
        );
      }
    }

    return newPermis;
  }

  async generateQrCode(permisId: number, insertedBy?: string) {
    const permis = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      include: {
        typePermis: true,
        detenteur: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    wilaya: true,
                    detenteurdemande: { include: { detenteur: true }, take: 1 },
                  },
                  orderBy: { date_demande: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!permis) {
      throw new Error('Permis not found');
    }

    const procDemande = permis.permisProcedure?.[0]?.procedure?.demandes?.[0];
    const wilaya = procDemande?.wilaya || null;
    const detDem = procDemande?.detenteurdemande?.[0]?.detenteur || null;
    const codePermis = permis.code_permis || '';
    const typeCode = permis.typePermis?.code_type || '';
    const codeWilaya = (wilaya?.code_wilaya || wilaya?.id_wilaya || '')
      .toString()
      .padStart(2, '0');
    const nomSociete =
      detDem?.nom_societeAR ||
      detDem?.nom_societeFR ||
      permis.detenteur?.nom_societeAR ||
      permis.detenteur?.nom_societeFR ||
      '';
    const dateDemande =
      procDemande?.date_demande ||
      permis.date_adjudication ||
      permis.date_octroi ||
      new Date();

    const { codeUnique, dateHeureSysteme } = this.generateUniqueQr(
      codePermis,
      typeCode,
      dateDemande,
      codeWilaya,
      nomSociete,
    );

    const updated = await this.prisma.permisPortail.update({
      where: { id: permis.id },
      data: {
        qr_code: codeUnique,
        date_heure_systeme: new Date(dateHeureSysteme),
        qr_inserer_par: insertedBy || null,
        code_wilaya: codeWilaya || null,
      },
      select: {
        id: true,
        qr_code: true,
        date_heure_systeme: true,
        qr_inserer_par: true,
        code_wilaya: true,
      },
    });

    return {
      ok: true,
      QrCode: updated.qr_code,
      DateHeureSysteme: updated.date_heure_systeme,
      insertedBy: updated.qr_inserer_par,
      code_wilaya: updated.code_wilaya,
    };
  }

  async getPermisPdfInfo(demandeId: number) {
    return this.prisma.demandePortail.findUnique({
      where: { id_demande: demandeId },
      include: {
        typePermis: true,
        wilaya: true,
        daira: true,
        commune: true,
        detenteurdemande: { include: { detenteur: true }, take: 1 },
        procedure: true,
      },
    });
  }

  /*async getTemplates(codepermis?: string) {
  // First find the permis by its code
  const permis = await this.prisma.permis.findUnique({
    where: { code_permis: codepermis },
  });

  if (!permis) {
    return []; // Return empty array if no permis found
  }

  // Then find all templates associated with this permis
  return this.prisma.permisTemplate.findMany({
    where: { 
      permisId: permis.id 
    },
    orderBy: { 
      createdAt: 'desc' 
    }
  });
}*/
  // In your GeneratePermisService
  async saveTemplate(templateData: any) {
    const { elements, permisId, templateId, name } = templateData;

    // Allow null/undefined permisId for templates that aren't yet associated with a permis
    const parsedPermisId = permisId ? parseInt(permisId, 10) : undefined;
    if (parsedPermisId && isNaN(parsedPermisId)) {
      throw new Error('Invalid permisId');
    }

    // Only fetch permis if we have a valid ID
    let typePermisId = 1; // Default value
    if (parsedPermisId) {
      const permis = await this.prisma.permisPortail.findUnique({
        where: { id: parsedPermisId },
        select: { typePermis: true },
      });

      if (!permis) {
        throw new Error('Permis not found');
      }
      typePermisId = permis.typePermis.id;
    }

    // Ensure elements is properly formatted
    if (!elements) {
      throw new Error('Elements data is required');
    }

    if (templateId) {
      // Update existing template
      return this.prisma.permisTemplate.update({
        where: { id: templateId },
        data: {
          elements,
          name: name || undefined,
          updatedAt: new Date(),
          version: { increment: 1 },
          permisId: parsedPermisId, // Update permis association if needed
        },
      });
    } else {
      // Create new template
      return this.prisma.permisTemplate.create({
        data: {
          name: name || `Template ${new Date().toLocaleDateString()}`,
          elements: elements,
          typePermisId: typePermisId,
          permisId: parsedPermisId, // Can be null for unassociated templates
        },
      });
    }
  }

  async deleteTemplate(id: string) {
    return this.prisma.permisTemplate.delete({
      where: { id: parseInt(id) },
    });
  }
}

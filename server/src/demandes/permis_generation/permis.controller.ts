import { GeneratePermisService } from './permis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './generate_permis_pdf.service';
import { Controller, Get, Param, Post, ParseIntPipe, Query, Body, Res, Patch, Delete, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { Response } from 'express'; // ✅ add this


@Controller('api/permis')
export class GeneratePermisController {
  constructor( private readonly pdfService: PdfGeneratorService,private service: GeneratePermisService,private readonly prisma: PrismaService
) {}

  @Patch('templates/:id')
  async renameTemplate(
  @Param('id') id: string,
  @Body() body: { name: string }
) {
  try {
    const template = await this.prisma.permisTemplate.update({
      where: { id: parseInt(id) },
      data: { name: body.name }
    });
    
    return template;
  } catch (error) {
    console.error('Error renaming template:', error);
    throw new HttpException('Failed to rename template', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

  @Post('generate/:id')
  async generatePermis(@Param('id') id: string, @Body() body?: { codeNumber?: number | string }) {
    return this.service.generatePermisFromDemande(parseInt(id), { codeNumber: body?.codeNumber });
  }

  @Get('summary/:id')
  async getPdfData(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPermisPdfInfo(id);
  }

   @Post('generate-pdf')
  async generatePdf(@Body() design: any, @Res() res: Response) {
    try {
      const pdfBuffer = await this.pdfService.generatePdf(design);
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=permis-${design.data.code_demande}.pdf`,
      });
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }


/* @Get('templates')
async getTemplates(
  @Query('permisId') code_permis?: string
) {
  return this.service.getTemplates(
    code_permis ? (code_permis) : undefined
  );
}*/

  /*@Post('templates')
async saveTemplate(@Body() body: any) {
  const result = await this.service.saveTemplate(body);
  return result; // Return the full template with id
}*/

@Delete('templates/:id')
async deleteTemplate(@Param('id') id: string) {
  return this.service.deleteTemplate(id);
}

  // List prior titres (APM/TEM/TEC) with current detenteur
  @Get('prior-titres')
  async listPriorTitres() {
  const prior = await this.prisma.permisPortail.findMany({
    where: {
      // APM (prospection), TEM/TEC (exploration)
      typePermis: {
        is: { code_type: { in: ['APM', 'TEM', 'TEC'] } },
      },
    },
    include: {
      typePermis: true,
      detenteur: true,
      permisProcedure: {
        include: {
          procedure: {
            include: {
              demandes: {
                select: {
                  id_demande: true,
                  id_commune: true,
                  date_demande: true,
                },
                orderBy: { date_demande: 'desc' },
              },
            },
          },
        },
      },
    },
    orderBy: { id: 'desc' },
  });

  return prior.map((p) => {
    const match = (p.code_permis || '').match(/(\d+)$/);
    const codeNumber = match ? match[1] : null;
    const demandes =
      p.permisProcedure?.flatMap((relation) => relation.procedure?.demandes ?? []) ?? [];
    const latestDemande = demandes.sort((a, b) => {
      const dateA = a.date_demande ? new Date(a.date_demande).getTime() : 0;
      const dateB = b.date_demande ? new Date(b.date_demande).getTime() : 0;
      return dateB - dateA;
    })[0];
    return {
      id: p.id,
      code_permis: p.code_permis,
      type_code: p.typePermis?.code_type ?? null,
      type_lib: p.typePermis?.lib_type ?? null,
        detenteur: p.detenteur
        ? {
            id_detenteur: p.detenteur.id_detenteur,
            nom: p.detenteur.nom_societeFR ?? null,
          }
        : null,
        communeId: latestDemande?.id_commune ?? null,
        codeNumber,
      };
    });
  }


@Post('save-permis')
async savePermis(@Body() body: { id_demande: number; codeNumber?: number | string }) {
  // Use codeNumber if provided; otherwise service will generate a sequential number
  const permis = await this.service.generatePermisFromDemande(body.id_demande, { codeNumber: body.codeNumber });
  
  return { 
    id: permis.id,
    code_permis: permis.code_permis
  };
}

// Save just the template (can be called after permis is created)
@Post('save-template')
async saveTemplate(@Body() body: any) {
  const { elements, permisId, templateId, name } = body;
  
  const template = await this.service.saveTemplate({
    elements,
    permisId,
    templateId,
    name
  });
  
  return template;
}

// In your GeneratePermisController
  @Get('procedure/:idProc/permis')
  async getPermisByProcedure(@Param('idProc') idProc: string) { // Change to string
    try {
      // Convert idProc to number
      const procedureId = parseInt(idProc, 10);
    if (isNaN(procedureId)) {
      return { exists: false, error: 'Invalid procedure ID' };
    }
    
    // First get the demande associated with this procedure
    const procedure = await this.prisma.procedurePortail.findUnique({
      where: { 
        id_proc: procedureId // Use the converted number
      },
      include: { 
        demandes: true 
      }
    });
    
    if (!procedure || procedure.demandes.length === 0) {
      return { exists: false };
    }
    
    const demandeId = procedure.demandes[0].id_demande;
    
    // Check if a permis already exists for this procedure via the join table
    const permis = await this.prisma.permisPortail.findFirst({
      where: {
        permisProcedure: {
          some: { id_proc: procedureId }
        }
      },
      select: {
        id: true,
        code_permis: true,
        is_signed: true,
        date_remise_titre: true,
        nom_remise_titre: true,
      }
    });
    
    return { 
      exists: !!permis, 
      permisId: permis?.id || null,
      permisCode: permis?.code_permis || null,
      isSigned: permis?.is_signed ?? null,
      takenDate: permis?.date_remise_titre ?? null,
      takenBy: permis?.nom_remise_titre ?? null,
    };
    } catch (error) {
      console.error('Error checking permis:', error);
      return { exists: false, error: 'Internal server error' };
    }
  }

  @Get('procedure/:idProc/permis/full')
  async getPermisByProcedureFull(@Param('idProc') idProc: string) {
    try {
      const procedureId = parseInt(idProc, 10);
      if (isNaN(procedureId)) {
        return { exists: false, error: 'Invalid procedure ID' };
      }

      const permis = await this.prisma.permisPortail.findFirst({
        where: {
          permisProcedure: {
            some: { id_proc: procedureId },
          },
        },
        include: {
          typePermis: true,
        },
      });

      return {
        exists: !!permis,
        permisId: permis?.id || null,
        permisCode: permis?.code_permis || null,
        typeCode: permis?.typePermis?.code_type || null,
      };
    } catch (error) {
      console.error('Error checking permis full:', error);
      return { exists: false, error: 'Internal server error' };
    }
  }
  

  // Return the next available numeric code_permis (max + 1) as computed from the database
  @Get('next-code')
  async getNextPermisCode() {
    const rows = await this.prisma.$queryRaw<
      Array<{ max_num: bigint | number | null }>
    >`SELECT COALESCE(MAX((regexp_match(code_permis, '([0-9]+)$'))[1]::INTEGER), 0) AS max_num FROM permis WHERE code_permis ~ '([0-9]+)$'`;

    const currentMax = rows?.[0]?.max_num ?? 0;
    const next = Number.isFinite(Number(currentMax)) && Number(currentMax) >= 0
      ? Number(currentMax) + 1
      : 1;

    // Ensure uniqueness (very unlikely to collide, but check once)
    let candidate = String(next);
    while (await this.prisma.permisPortail.findFirst({ where: { code_permis: candidate } })) {
      candidate = String(Number(candidate) + 1);
    }

    return { nextCode: candidate };
  }

  @Get(':permisId/templates')
async getTemplatesByPermis(@Param('permisId', ParseIntPipe) permisId: number) {
  try {
    const templates = await this.prisma.permisTemplate.findMany({
      where: { 
        permisId: permisId 
      },
      orderBy: { 
        createdAt: 'desc' 
      }
    });
    
    return templates;
  } catch (error) {
    console.error('Error fetching templates by permis:', error);
    throw new HttpException('Failed to fetch templates', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

  @Patch(':id/signed')
  async setSigned(
    @Param('id') id: string,
    @Body() body: { isSigned?: boolean; is_signed?: boolean; value?: any },
  ) {
    // Accept either a numeric id or a code_permis string
    const parsedId = parseInt(id, 10);
    const permis = isNaN(parsedId)
      ? await this.prisma.permisPortail.findFirst({ where: { code_permis: id } })
      : await this.prisma.permisPortail.findUnique({ where: { id: parsedId } }) ||
        await this.prisma.permisPortail.findFirst({ where: { code_permis: id } });

    if (!permis) {
      throw new BadRequestException('Permis not found');
    }

    const isSigned = !!(body?.isSigned ?? body?.is_signed ?? body?.value);

    const updated = await this.prisma.permisPortail.update({
      where: { id: permis.id },
      data: { is_signed: isSigned },
      select: { id: true, is_signed: true },
    });

    return updated;
  }

  @Patch(':id/collection')
  async setCollectionInfo(
    @Param('id') id: string,
    @Body() body: { takenDate?: string | Date | null; takenBy?: string },
  ) {
    const parsedId = parseInt(id, 10);
    const permis = isNaN(parsedId)
      ? await this.prisma.permisPortail.findFirst({ where: { code_permis: id } })
      : await this.prisma.permisPortail.findUnique({ where: { id: parsedId } }) ||
        await this.prisma.permisPortail.findFirst({ where: { code_permis: id } });

    if (!permis) {
      throw new BadRequestException('Permis not found');
    }

    const takenDate = body?.takenDate;
    const takenBy = body?.takenBy ?? '';

    let dateValue: Date | null = null;
    if (takenDate) {
      const d = new Date(takenDate);
      if (!isNaN(d.getTime())) {
        dateValue = d;
      }
    }

    const updated = await this.prisma.permisPortail.update({
      where: { id: permis.id },
      data: {
        date_remise_titre: dateValue,
        nom_remise_titre: takenBy.trim() || null,
      },
      select: {
        id: true,
        date_remise_titre: true,
      nom_remise_titre: true,
    },
  });

  return updated;
  }

  @Post(':id/qrcode/generate')
  async generateQrCode(@Param('id') id: string, @Body() body: { by?: string }) {
    const permisId = parseInt(id, 10);
    if (isNaN(permisId)) {
      throw new BadRequestException('Invalid permis id');
    }
    return this.service.generateQrCode(permisId, body?.by || body?.by === '' ? body.by : undefined);
  }

  // Expose minimal persisted info (collection/signature) for the designer
  @Get(':id/details')
  async getPermisDetails(@Param('id') id: string) {
    const permisId = parseInt(id, 10);
    if (isNaN(permisId)) {
      throw new BadRequestException('Invalid permis id');
    }
    const permis = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      select: {
        id: true,
        is_signed: true,
        date_remise_titre: true,
        nom_remise_titre: true,
      },
    });
    if (!permis) {
      throw new BadRequestException('Permis not found');
    }
    return permis;
  }
}

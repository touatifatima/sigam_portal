import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { Request } from 'express';
import {
  CanalVerificationCadastre,
  TypePieceCadastre,
} from '@prisma/client';
import { CadastreDocumentService } from './cadastre-document.service';

@Controller('api/cadastre/demandes-documents-cadastraux')
export class CadastreDocumentController {
  constructor(private readonly service: CadastreDocumentService) {}

  @Get('document-references')
  listDocumentReferences(@Req() req: Request) {
    return this.service.listDocumentReferences(req);
  }

  @Post('verify-title')
  verifyTitle(
    @Body()
    body: {
      permisId?: number | string;
      qrCodeTitre?: string;
      codePermis?: string;
      typePermis?: string;
    },
    @Req() req: Request,
  ) {
    return this.service.verifyTitleInformation(body, req);
  }

  @Post('verify-contact')
  verifyContact(
    @Body()
    body: {
      permisId?: number | string;
      qrCodeTitre?: string;
      codePermis?: string;
      emailContact?: string;
      telephoneContact?: string;
      canalVerification?: CanalVerificationCadastre | string;
    },
    @Req() req: Request,
  ) {
    return this.service.verifyDetenteurContact(body, req);
  }

  @Post()
  createRequest(
    @Body()
    body: {
      typeDocument?: string;
      permisId?: number | string;
      qrCodeTitre?: string;
      codePermis?: string;
      titulaire?: string;
      numeroRc?: string;
      typePermis?: string;
      nin?: string;
      nom?: string;
      prenom?: string;
      emailContact?: string;
      telephoneContact?: string;
      canalVerification?: CanalVerificationCadastre | string;
      qualiteDemandeur?: string;
      objetDemande?: string;
      objetDemandeAutre?: string;
      baseCommunication?: string;
    },
    @Req() req: Request,
  ) {
    return this.service.createRequest(body, req);
  }

  @Post(':id/otp/resend')
  resendOtp(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.resendOtp(id, req);
  }

  @Post(':id/otp/verify')
  verifyOtp(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { code: string },
    @Req() req: Request,
  ) {
    return this.service.verifyOtp(id, body, req);
  }

  @Post(':id/pieces-jointes/:typePiece')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const demandeId = req.params?.id;
          const uploadPath = path.join(
            process.cwd(),
            'public',
            'uploads',
            'cadastre',
            'demandes',
            String(demandeId ?? 'unknown'),
          );
          fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const typePiece = String(req.params?.typePiece || 'piece').toLowerCase();
          const ext = path.extname(file.originalname || '').toLowerCase();
          cb(null, `${typePiece}_${Date.now()}${ext}`);
        },
      }),
      limits: {
        fileSize: 12 * 1024 * 1024,
      },
      fileFilter: (_req, file, cb) => {
        const allowed = new Set([
          'image/png',
          'image/jpeg',
          'image/jpg',
          'application/pdf',
        ]);
        if (!allowed.has(file.mimetype)) {
          return cb(
            new BadRequestException('Seuls les fichiers PDF, PNG, JPG et JPEG sont autorises.'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadPiece(
    @Param('id', ParseIntPipe) id: number,
    @Param('typePiece') typePiece: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni.');
    }

    const normalizedType = String(typePiece || '').trim().toUpperCase();
    if (
      normalizedType !== TypePieceCadastre.SCAN_TITRE &&
      normalizedType !== TypePieceCadastre.SCAN_CARTE_IDENTITE
    ) {
      throw new BadRequestException('Type de piece joint valide requis.');
    }

    return this.service.uploadPiece(
      id,
      normalizedType as TypePieceCadastre,
      file,
      req,
    );
  }

  @Post(':id/submit')
  submitRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      typeDocument?: string;
      qualiteDemandeur?: string;
      objetDemande?: string;
      objetDemandeAutre?: string;
      baseCommunication?: string;
    },
    @Req() req: Request,
  ) {
    return this.service.submitRequest(id, body, req);
  }

  @Get('admin/list')
  listAdminRequests(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('statut') statut?: string,
    @Query('typeDocument') typeDocument?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('societe') societe?: string,
    @Query('referenceDemande') referenceDemande?: string,
    @Query('codePermis') codePermis?: string,
    @Query('emailDemandeur') emailDemandeur?: string,
    @Query('nomDemandeur') nomDemandeur?: string,
  ) {
    return this.service.listAdminRequests(req, { page, pageSize, search, statut, typeDocument, dateFrom, dateTo, societe, referenceDemande, codePermis, emailDemandeur, nomDemandeur });
  }

  @Get('admin/stats')
  getAdminStats(@Req() req: Request) {
    return this.service.getAdminStats(req);
  }

  @Post(':id/admin/status')
  updateAdminStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { statut?: string; commentaire?: string },
    @Req() req: Request,
  ) {
    return this.service.updateAdminStatus(id, body, req);
  }

  @Post(':id/admin/note')
  addAdminNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { note?: string },
    @Req() req: Request,
  ) {
    return this.service.addAdminNote(id, body.note || '', req);
  }

  @Get()
  listRequests(@Req() req: Request, @Query('statut') statut?: string) {
    return this.service.listMyRequests(req, { statut });
  }

  @Get(':id')
  getRequest(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.getAuthenticatedDemandById(id, req);
  }
}

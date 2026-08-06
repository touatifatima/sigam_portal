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
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { Request } from 'express';
import { Response } from 'express';
import {
  CanalVerificationCadastre,
  TypePieceCadastre,
} from '@prisma/client';
import { CadastreDocumentService } from './cadastre-document.service';

@Controller('api/cadastre/demandes-documents-cadastraux')
export class CadastreDocumentController {
  constructor(private readonly service: CadastreDocumentService) {}

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
      baseCommunication?: string;
    },
    @Req() req: Request,
  ) {
    return this.service.createRequest(body, req);
  }

  @Post('verification-contact')
  validateOtpContact(
    @Body()
    body: {
      typeDocument?: string;
      permisId?: number | string;
      qrCodeTitre?: string;
      codePermis?: string;
      typePermis?: string;
      qualiteDemandeur?: string;
      emailContact?: string;
      telephoneContact?: string;
      canalVerification?: CanalVerificationCadastre | string;
    },
    @Req() req: Request,
  ) {
    return this.service.validateOtpContact(body, req);
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
      baseCommunication?: string;
    },
    @Req() req: Request,
  ) {
    return this.service.submitRequest(id, body, req);
  }

  @Get()
  listRequests(@Req() req: Request, @Query('statut') statut?: string) {
    return this.service.listMyRequests(req, { statut });
  }

  @Get('references')
  getWorkflowReferences() {
    return this.service.getWorkflowReferences();
  }

  @Get(':id')
  getRequest(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.getAuthenticatedDemandById(id, req);
  }

  @Get(':id/accuse-reception')
  async downloadAccuseReception(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const receipt = await this.service.getAccuseReceptionFile(id, req);
    return res.download(receipt.absolutePath, receipt.filename ?? 'accuse-reception.pdf');
  }
}

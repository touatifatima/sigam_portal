import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Body,
  Put,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { Response } from 'express';
import { Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { SessionService } from 'src/session/session.service';

@Controller('api')
export class DocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly sessionService: SessionService,
  ) {}

  private extractAuthToken(req: any): string | null {
    const cookieToken = req?.cookies?.auth_token || req?.cookies?.token;
    if (cookieToken) return String(cookieToken).trim();

    const authHeader = req?.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }

    return null;
  }

  private async requireAuthenticatedActorUserId(req: any): Promise<number> {
    const token = this.extractAuthToken(req);
    if (!token) {
      throw new UnauthorizedException('Non authentifie');
    }

    const session = await this.sessionService.validateSession(token);
    const rawUserId =
      session?.user?.id ??
      session?.userId ??
      req?.user?.id ??
      req?.user?.sub ??
      req?.session?.userId;
    const actorUserId = Number(rawUserId);
    const normalizedActorUserId =
      Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

    if (!normalizedActorUserId) {
      throw new UnauthorizedException('Session invalide');
    }

    return normalizedActorUserId;
  }

  @Get('procedure/:id_demande/documents')
  async getDocs(@Param('id_demande', ParseIntPipe) id_demande: number) {
    return this.service.getDocumentsByDemande(id_demande);
  }

  @Post('demande/:id_demande/dossier-fournis')
  async createOrUpdateDossierFournis(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Body()
    body: {
      documents: {
        id_doc: number;
        status: 'present' | 'manquant';
        file_url?: string;
      }[];
      remarques?: string;
    },
  ) {
    return this.service.createOrUpdateDossierFournis(
      id_demande,
      body.documents,
      body.remarques,
    );
  }

  @Put('demande/:id_demande/recevabilite')
  async updateDemandeRecevabilite(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Body() body: { dossier_recevable: boolean },
  ) {
    return this.service.updateDemandeRecevabilite(
      id_demande,
      body.dossier_recevable,
    );
  }

  @Put('demande/:id_demande/status')
  async updateDemandeStatus(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Body()
    body: {
      statut_demande: 'ACCEPTEE' | 'REJETEE' | 'EN_COMPLEMENT';
      rejectionReason?: string;
      motif_rejet?: string;
      complementDetails?: unknown;
    },
  ) {
    const reason = body.rejectionReason ?? body.motif_rejet;
    return this.service.updateDemandeStatus(
      id_demande,
      body.statut_demande,
      reason,
      body.complementDetails,
    );
  }

  @Get('demande/:id_demande/complements/latest')
  async getLatestComplement(
    @Param('id_demande', ParseIntPipe) id_demande: number,
  ) {
    return this.service.getLatestComplementByDemande(id_demande);
  }

  @Put('demande/:id_demande/complement/submit')
  async submitComplement(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Req() req: any,
  ) {
    const actorUserId = await this.requireAuthenticatedActorUserId(req);
    return this.service.submitDemandeComplement(id_demande, actorUserId);
  }

  @Put('demande/:id_demande/complement/items/validate')
  async validateComplementItems(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Body()
    body: {
      itemIds?: number[];
      noteTraitement?: string;
    },
    @Req() req: any,
  ) {
    const actorUserId = await this.requireAuthenticatedActorUserId(req);

    return this.service.validateComplementItems(
      id_demande,
      Array.isArray(body?.itemIds) ? body.itemIds : [],
      actorUserId,
      body?.noteTraitement,
    );
  }

  @Get('demande/:id_demande/letters')
  async getLetters(@Param('id_demande', ParseIntPipe) id_demande: number) {
    return this.service.generateLetters(id_demande);
  }

  // Alias route to be tolerant with existing client patterns
  @Get('procedure/:id_demande/letters')
  async getLettersAlias(@Param('id_demande', ParseIntPipe) id_demande: number) {
    return this.service.generateLetters(id_demande);
  }

  @Post('demande/:id_demande/document/:id_doc/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const id_demande = req.params?.id_demande;
          const uploadPath = path.join(
            process.cwd(),
            'public',
            'uploads',
            'demandes',
            id_demande ?? 'unknown',
          );
          fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const id_doc = req.params?.id_doc ?? 'doc';
          const ext = path.extname(file.originalname || '').toLowerCase();
          const ts = Date.now();
          cb(null, `${id_doc}_${ts}${ext}`);
        },
      }),
    }),
  )
  async uploadDocument(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Param('id_doc', ParseIntPipe) id_doc: number,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    const fileUrl = `/uploads/demandes/${id_demande}/${file.filename}`;
    const contextRaw =
      req?.body?.context ?? req?.query?.context ?? req?.headers?.['x-upload-context'];
    const context = typeof contextRaw === 'string' ? contextRaw.trim() : null;
    const complementItemIdRaw =
      req?.body?.itemId ??
      req?.body?.id_item ??
      req?.query?.itemId ??
      req?.query?.id_item ??
      req?.headers?.['x-complement-item-id'];
    const complementItemId = Number(complementItemIdRaw);
    const normalizedComplementItemId =
      Number.isFinite(complementItemId) && complementItemId > 0
        ? Math.trunc(complementItemId)
        : null;

    console.info('[DocumentsController] uploadDocument', {
      id_demande,
      id_doc,
      fileUrl,
      context,
      complementItemId: normalizedComplementItemId,
      originalName: file.originalname,
      branch:
        context === 'complement' && normalizedComplementItemId
          ? 'complement-via-generic-upload'
          : 'standard-upload',
    });

    try {
      if (context === 'complement' && normalizedComplementItemId) {
        console.info(
          '[DocumentsController] routing to markComplementDocumentAsUploaded',
          {
            id_demande,
            id_doc,
            complementItemId: normalizedComplementItemId,
          },
        );
        return await this.service.markComplementDocumentAsUploaded(
          id_demande,
          normalizedComplementItemId,
          fileUrl,
        );
      }

      return await this.service.markDocumentAsUploaded(id_demande, id_doc, fileUrl, {
        context,
        complementItemId: normalizedComplementItemId,
      });
    } catch (error) {
      console.error('[DocumentsController] uploadDocument failed', {
        id_demande,
        id_doc,
        context,
        complementItemId: normalizedComplementItemId,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      });
      throw error;
    }
  }

  @Post('demande/:id_demande/complement/item/:id_item/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const id_demande = req.params?.id_demande;
          const uploadPath = path.join(
            process.cwd(),
            'public',
            'uploads',
            'demandes',
            id_demande ?? 'unknown',
          );
          fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const id_item = req.params?.id_item ?? 'item';
          const ext = path.extname(file.originalname || '').toLowerCase();
          const ts = Date.now();
          cb(null, `complement_item_${id_item}_${ts}${ext}`);
        },
      }),
    }),
  )
  async uploadComplementDocument(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Param('id_item', ParseIntPipe) id_item: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    const fileUrl = `/uploads/demandes/${id_demande}/${file.filename}`;
    console.info('[DocumentsController] uploadComplementDocument', {
      id_demande,
      id_item,
      fileUrl,
      originalName: file.originalname,
      route: 'complement-item-upload',
    });
    try {
      return await this.service.markComplementDocumentAsUploaded(
        id_demande,
        id_item,
        fileUrl,
      );
    } catch (error) {
      console.error('[DocumentsController] uploadComplementDocument failed', {
        id_demande,
        id_item,
        fileUrl,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      });
      throw error;
    }
  }

  @Get('demande/:id_demande/document/:id_doc/file')
  async openDemandeDocument(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Param('id_doc', ParseIntPipe) id_doc: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const actorUserId = await this.requireAuthenticatedActorUserId(req);
    const file = await this.service.getDemandeDocumentFilePayload(
      id_demande,
      id_doc,
      actorUserId,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.filename}"`,
    );
    return res.sendFile(file.absolutePath);
  }

  @Get('demande/:id_demande/complement/item/:id_item/file')
  async openComplementItemDocument(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Param('id_item', ParseIntPipe) id_item: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const actorUserId = await this.requireAuthenticatedActorUserId(req);
    const file = await this.service.getComplementItemFilePayload(
      id_demande,
      id_item,
      actorUserId,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.filename}"`,
    );
    return res.sendFile(file.absolutePath);
  }

  @Get('demande/:id_demande/recepisse.pdf')
  async downloadRecepisse(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.service.generateRecepissePdf(id_demande);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  }

  @Get('demande/:id_demande/mise-en-demeure.pdf')
  async downloadMiseEnDemeure(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.service.generateMiseEnDemeurePdf(id_demande);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  }

  @Get('demande/:id_demande/complement/recepisse.pdf')
  async downloadComplementRecepisse(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.service.generateComplementRecepissePdf(id_demande);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  }
}

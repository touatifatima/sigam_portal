import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MissingAction, Prisma } from '@prisma/client';

import { CessionService } from 'src/cession/cession.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

type DocStatus = 'present' | 'manquant' | 'attente';

type MissingSummaryEntry = {
  id_doc: number;
  nom_doc: string;
  missing_action?: MissingAction;
  reject_message?: string | null;
};

type MissingSummary = {
  requiredMissing: MissingSummaryEntry[];
  blocking: MissingSummaryEntry[];
  blockingNext: MissingSummaryEntry[];
  warnings: MissingSummaryEntry[];
};

type DeadlinePayload = {
  miseEnDemeure: string | null;
  instruction: string | null;
};

type ComplementDocDecision = 'conforme' | 'manquant' | 'probleme';

type ComplementProblemCode =
  | 'expire'
  | 'date_invalide'
  | 'illisible'
  | 'non_signe'
  | 'incoherent'
  | 'autre';

type ComplementItemPayload = {
  id_doc: number | null;
  nom_doc: string;
  decision: ComplementDocDecision;
  problems: ComplementProblemCode[];
  comment: string | null;
  statutActuel: string | null;
};

type NormalizedComplementPayload = {
  motif: string | null;
  adminMessage: string | null;
  delaiJours: number | null;
  effetAbsence: string | null;
  modeNotification: string | null;
  pdfUrl: string | null;
  pdfFilename: string | null;
  documents: ComplementItemPayload[];
};

type StoredDocumentFilePayload = {
  absolutePath: string;
  filename: string;
  contentType: string;
};

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private readonly cessionService: CessionService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private addBusinessDays(base: Date, businessDays: number) {
    const result = new Date(base);
    let added = 0;

    while (added < businessDays) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) {
        added += 1;
      }
    }

    return result;
  }

  private addDays(base: Date, days: number) {
    const result = new Date(base);
    result.setDate(result.getDate() + days);
    return result;
  }

  private generateReference(prefix: string) {
    const uniquePart = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${uniquePart}-${Date.now()}`;
  }

  private getFileContentType(filePath: string) {
    const extension = path.extname(filePath || '').toLowerCase();
    switch (extension) {
      case '.pdf':
        return 'application/pdf';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.doc':
        return 'application/msword';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return 'application/octet-stream';
    }
  }

  private resolveStoredDocumentFile(
    fileUrl: string,
    fallbackFilename?: string | null,
  ): StoredDocumentFilePayload {
    const rawValue = String(fileUrl || '').trim();
    if (!rawValue) {
      throw new NotFoundException('Fichier introuvable');
    }

    let pathname = rawValue;
    if (/^https?:\/\//i.test(rawValue)) {
      try {
        pathname = new URL(rawValue).pathname || rawValue;
      } catch {
        pathname = rawValue;
      }
    }

    const normalizedRelativePath = pathname
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');

    if (!normalizedRelativePath.toLowerCase().startsWith('uploads/')) {
      throw new BadRequestException('Chemin de fichier invalide');
    }

    const publicRoot = path.resolve(process.cwd(), 'public');
    const absolutePath = path.resolve(publicRoot, normalizedRelativePath);
    const normalizedPublicRoot = `${publicRoot}${path.sep}`;

    if (
      absolutePath !== publicRoot &&
      !absolutePath.startsWith(normalizedPublicRoot)
    ) {
      throw new ForbiddenException('Acces au fichier refuse');
    }

    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('Fichier introuvable sur le serveur');
    }

    return {
      absolutePath,
      filename:
        String(fallbackFilename || '').trim() || path.basename(absolutePath),
      contentType: this.getFileContentType(absolutePath),
    };
  }

  private tryResolveStoredDocumentFile(
    fileUrl?: string | null,
    fallbackFilename?: string | null,
  ): StoredDocumentFilePayload | null {
    const rawValue = String(fileUrl || '').trim();
    if (!rawValue) {
      return null;
    }

    try {
      return this.resolveStoredDocumentFile(rawValue, fallbackFilename);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  private findLatestDemandUploadFile(
    id_demande: number,
    prefixes: string[],
  ): StoredDocumentFilePayload | null {
    const demandUploadsDir = path.resolve(
      process.cwd(),
      'public',
      'uploads',
      'demandes',
      String(id_demande),
    );

    if (!fs.existsSync(demandUploadsDir)) {
      return null;
    }

    const normalizedPrefixes = prefixes
      .map((prefix) => String(prefix || '').trim())
      .filter((prefix) => prefix.length > 0);

    if (normalizedPrefixes.length === 0) {
      return null;
    }

    const matches = fs
      .readdirSync(demandUploadsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .filter((entry) =>
        normalizedPrefixes.some((prefix) => entry.name.startsWith(prefix)),
      )
      .map((entry) => {
        const absolutePath = path.join(demandUploadsDir, entry.name);
        const stats = fs.statSync(absolutePath);
        return {
          absolutePath,
          filename: entry.name,
          mtimeMs: stats.mtimeMs,
        };
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs);

    const latestMatch = matches[0];
    if (!latestMatch) {
      return null;
    }

    return {
      absolutePath: latestMatch.absolutePath,
      filename: latestMatch.filename,
      contentType: this.getFileContentType(latestMatch.absolutePath),
    };
  }

  private async assertDemandeAccess(
    id_demande: number,
    actorUserId?: number | null,
  ) {
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
      select: {
        id_demande: true,
        utilisateurId: true,
      },
    });

    if (!demande) {
      throw new NotFoundException('Demande introuvable');
    }

    const safeActorUserId = Number(actorUserId);
    if (!Number.isFinite(safeActorUserId) || safeActorUserId <= 0) {
      throw new ForbiddenException('Acces non autorise');
    }

    const isAdmin = await this.notificationsService.isAdminUser(safeActorUserId);
    const isOwner = Number(demande.utilisateurId) === safeActorUserId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'Vous n avez pas le droit de consulter ce document',
      );
    }

    return {
      demande,
      actorUserId: safeActorUserId,
      isAdmin,
      isOwner,
    };
  }

  private normalizeComplementDetails(
    rejectionReason?: string,
    payload?: unknown,
  ): NormalizedComplementPayload {
    const detailsObject =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};
    const rawDocuments = Array.isArray(detailsObject.documents)
      ? detailsObject.documents
      : [];

    const normalizedDocs: ComplementItemPayload[] = rawDocuments
      .map((entry) => {
        const raw = entry && typeof entry === 'object'
          ? (entry as Record<string, unknown>)
          : {};
        const idDocRaw = Number(raw.id_doc);
        const normalizedDecision = String(raw.decision || '')
          .trim()
          .toLowerCase();
        const decision: ComplementDocDecision =
          normalizedDecision === 'manquant' || normalizedDecision === 'probleme'
            ? normalizedDecision
            : 'conforme';

        const problems = Array.isArray(raw.problems)
          ? raw.problems
              .map((item) => String(item || '').trim().toLowerCase())
              .filter(
                (item): item is ComplementProblemCode =>
                  item === 'expire' ||
                  item === 'date_invalide' ||
                  item === 'illisible' ||
                  item === 'non_signe' ||
                  item === 'incoherent' ||
                  item === 'autre',
              )
          : [];

        const nomDoc = String(raw.nom_doc || '').trim();
        const comment = String(raw.comment || '').trim();
        const statutActuel = String(raw.statutActuel || '').trim();

        return {
          id_doc: Number.isFinite(idDocRaw) && idDocRaw > 0 ? idDocRaw : null,
          nom_doc: nomDoc || 'Document',
          decision,
          problems,
          comment: comment || null,
          statutActuel: statutActuel || null,
        } as ComplementItemPayload;
      })
      .filter((entry) => entry.decision !== 'conforme');

    const delayRaw = Number(detailsObject.delaiJours);
    const delaiJours =
      Number.isFinite(delayRaw) && delayRaw > 0 ? Math.trunc(delayRaw) : null;
    const motif = String(rejectionReason || '').trim() || null;
    const adminMessage =
      String(detailsObject.adminMessage || '').trim() || null;
    const effetAbsence =
      String(detailsObject.effetAbsence || '').trim() || null;
    const modeNotification =
      String(detailsObject.modeNotification || '').trim() || null;
    const pdfUrl =
      String(detailsObject.pdfUrl || detailsObject.pdf_url || '').trim() || null;
    const pdfFilename =
      String(detailsObject.pdfFilename || detailsObject.pdf_filename || '').trim() ||
      null;

    return {
      motif,
      adminMessage,
      delaiJours,
      effetAbsence,
      modeNotification,
      pdfUrl,
      pdfFilename,
      documents: normalizedDocs,
    };
  }

  private mapComplementRecord(complement: any) {
    if (!complement) return null;
    const items = Array.isArray(complement.items) ? complement.items : [];
    return {
      id_complement: Number(complement.id_complement),
      id_demande: Number(complement.id_demande),
      motif: complement.motif ?? null,
      adminMessage: complement.admin_message ?? null,
      delaiJours:
        complement.delai_jours != null ? Number(complement.delai_jours) : null,
      effetAbsence: complement.effet_absence ?? null,
      modeNotification: complement.mode_notification ?? null,
      pdfUrl: complement.pdf_url ?? null,
      pdfFilename: complement.pdf_filename ?? null,
      recepissePdfUrl: complement.recepisse_pdf_url ?? null,
      recepissePdfFilename: complement.recepisse_pdf_filename ?? null,
      statut: complement.statut_complement ?? null,
      createdAt: complement.created_at ?? null,
      submittedAt: complement.submitted_at ?? null,
      updatedAt: complement.updated_at ?? null,
      documents: items.map((item: any) => ({
        id_item: Number(item.id_item),
        id_doc: item.id_doc != null ? Number(item.id_doc) : null,
        nom_doc: item.nom_doc_snapshot ?? 'Document',
        decision: item.decision ?? 'manquant',
        problems: Array.isArray(item.problems) ? item.problems : [],
        comment: item.commentaire ?? null,
        statutActuel: item.statut_actuel_snapshot ?? null,
        statutReponse: item.statut_reponse ?? 'EN_ATTENTE',
        reponduAt: item.repondu_at ?? null,
        responseFileUrl: item.reponse_file_url ?? null,
        statutTraitement: item.statut_traitement ?? 'A_TRAITER',
        traiteAt: item.traite_at ?? null,
        traiteBy: item.traite_by != null ? Number(item.traite_by) : null,
        noteTraitement: item.note_traitement ?? null,
      })),
    };
  }

  private hasComplementItemUserResponse(
    item: any,
    currentDocsById: Map<number, any>,
    complementCreatedTs: number,
  ) {
    const responseStatus = String(item?.statut_reponse || '')
      .trim()
      .toUpperCase();
    if (responseStatus === 'DOCUMENT_REMPLACE' || responseStatus === 'SOUMIS') {
      return true;
    }

    const docId = Number(item?.id_doc);
    if (!Number.isFinite(docId) || docId <= 0) {
      return false;
    }

    const currentDoc = currentDocsById.get(docId);
    const currentStatus = String(currentDoc?.status || '').trim().toLowerCase();
    const hasCurrentFile = Boolean(String(currentDoc?.file_url || '').trim());
    const isPresent = currentStatus === 'present' || hasCurrentFile;
    const currentDocTs = currentDoc?.updated_at
      ? new Date(currentDoc.updated_at).getTime()
      : currentDoc?.created_at
      ? new Date(currentDoc.created_at).getTime()
      : -1;
    const replacedAfterRequest =
      complementCreatedTs > 0 &&
      currentDocTs > 0 &&
      currentDocTs >= complementCreatedTs;
    const decision = String(item?.decision || '').trim().toLowerCase();

    if (decision === 'manquant') {
      return isPresent;
    }

    return isPresent && replacedAfterRequest;
  }

  private isComplementItemSubmittedForReview(
    item: any,
    currentDocsById: Map<number, any>,
    complementCreatedTs: number,
    complementStatus?: string | null,
  ) {
    const responseStatus = String(item?.statut_reponse || '')
      .trim()
      .toUpperCase();
    if (responseStatus === 'SOUMIS') {
      return true;
    }

    const globalStatus = String(complementStatus || '').trim().toUpperCase();
    if (globalStatus !== 'SOUMISE') {
      return false;
    }

    return this.hasComplementItemUserResponse(
      item,
      currentDocsById,
      complementCreatedTs,
    );
  }

  private async markExplicitComplementItemAsResponded(
    prisma: any,
    id_demande: number,
    id_item: number,
    id_doc: number,
    file_url: string,
    respondedAt: Date,
  ) {
    if (!Number.isFinite(Number(id_item)) || Number(id_item) <= 0) {
      throw new BadRequestException(
        "L'identifiant de l'item de complÃ©tude est obligatoire pour cet upload",
      );
    }

    const targetItem = await (prisma as any).demandeComplementItem.findUnique({
      where: { id_item },
      include: {
        complement: true,
      },
    });

    if (!targetItem?.id_item) {
      throw new NotFoundException(
        'Document de complÃ©tude introuvable pour cet upload',
      );
    }

    if (Number(targetItem?.complement?.id_demande) !== Number(id_demande)) {
      throw new BadRequestException(
        'Le document de complÃ©tude ne correspond pas Ã  cette demande',
      );
    }

    if (
      targetItem?.id_doc != null &&
      Number(targetItem.id_doc) !== Number(id_doc)
    ) {
      throw new BadRequestException(
        'Le document tÃ©lÃ©versÃ© ne correspond pas Ã  la piÃ¨ce de complÃ©tude attendue',
      );
    }

    const complementStatus = String(
      targetItem?.complement?.statut_complement || '',
    )
      .trim()
      .toUpperCase();
    if (complementStatus !== 'OUVERTE') {
      throw new BadRequestException(
        'Cette complÃ©tude n accepte plus de correction de document',
      );
    }

    await (prisma as any).demandeComplementItem.update({
      where: { id_item: Number(targetItem.id_item) },
      data: {
        statut_reponse: 'DOCUMENT_REMPLACE',
        repondu_at: respondedAt,
        reponse_file_url: file_url,
      },
    });

    const refreshedComplement = await (prisma as any).demandeComplement.findUnique({
      where: {
        id_complement: Number(targetItem.complement.id_complement),
      },
      include: {
        items: {
          orderBy: { id_item: 'asc' },
        },
      },
    });

    return refreshedComplement;
  }

  private async createDemandeComplementRecord(
    id_demande: number,
    rejectionReason?: string,
    complementDetails?: unknown,
  ) {
    const normalized = this.normalizeComplementDetails(
      rejectionReason,
      complementDetails,
    );

    const created = await (this.prisma as any).demandeComplement.create({
      data: {
        id_demande,
        motif: normalized.motif,
        admin_message: normalized.adminMessage,
        delai_jours: normalized.delaiJours,
        effet_absence: normalized.effetAbsence,
        mode_notification: normalized.modeNotification,
        pdf_url: normalized.pdfUrl,
        pdf_filename: normalized.pdfFilename,
        statut_complement: 'OUVERTE',
        ...(normalized.documents.length > 0
          ? {
              items: {
                create: normalized.documents.map((item) => ({
                  id_doc: item.id_doc,
                  nom_doc_snapshot: item.nom_doc,
                  decision: item.decision,
                  problems:
                    item.problems.length > 0
                      ? (item.problems as unknown as Prisma.InputJsonValue)
                      : Prisma.JsonNull,
                  commentaire: item.comment,
                  statut_actuel_snapshot: item.statutActuel,
                })),
              },
            }
          : {}),
      },
      include: {
        items: {
          orderBy: { id_item: 'asc' },
        },
      },
    });

    return this.mapComplementRecord(created);
  }

  private async ensureUploadableDossier(
    prisma: any,
    id_demande: number,
    now: Date,
  ) {
    const demande = await prisma.demandePortail.findUnique({
      where: { id_demande },
      include: {
        dossiersFournis: {
          include: { documents: true },
          orderBy: { date_depot: 'desc' },
          take: 1,
        },
      },
    });

    if (!demande) {
      throw new NotFoundException('Demande introuvable');
    }

    const dossierDef = await prisma.dossierAdministratif.findFirst({
      where: {
        id_typeproc: demande.id_typeProc ?? undefined,
        id_typePermis: demande.id_typePermis ?? undefined,
      },
    });
    if (!dossierDef) {
      throw new NotFoundException(
        'Aucun dossier administratif configurÃƒÂ© pour cette demande',
      );
    }

    const existingDossier = demande.dossiersFournis[0];
    const dossier =
      existingDossier ??
      (await prisma.dossierFournisPortail.create({
        data: {
          id_demande,
          statut_dossier: 'incomplet',
          verification_phase: 'RECEVABILITE',
          date_depot: now,
          numero_accuse: `ACC-${Date.now()}`,
          date_accuse: now,
          mise_en_demeure_envoyee: false,
          pieces_manquantes: Prisma.NullableJsonNullValueInput.JsonNull,
        },
        include: { documents: true },
      }));

    return { demande, dossier };
  }

  private sanitizeGeneratedFilename(
    value: string | null | undefined,
    fallback = 'document.pdf',
  ) {
    const raw = String(value || '').trim();
    const source = raw.length > 0 ? raw : fallback;
    const sanitized = source
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!sanitized) return fallback;
    return sanitized.toLowerCase().endsWith('.pdf')
      ? sanitized
      : `${sanitized}.pdf`;
  }

  private resolveComplementStorageFolder(id_demande: number) {
    return path.join(
      process.cwd(),
      'public',
      'uploads',
      'demandes',
      String(id_demande),
      'complements',
    );
  }

  private async persistComplementPdfForDemande(
    id_demande: number,
    complementOverride: any,
  ) {
    const { buffer, filename } = await this.generateMiseEnDemeurePdf(
      id_demande,
      {
        complementOverride,
      },
    );

    const complementFolder = this.resolveComplementStorageFolder(id_demande);
    fs.mkdirSync(complementFolder, { recursive: true });

    const safeBaseName = this.sanitizeGeneratedFilename(
      filename,
      `demande_complement_${id_demande}.pdf`,
    );
    const stampedFilename = `${Date.now()}_${Number(
      complementOverride?.id_complement || 0,
    )}_${safeBaseName}`;
    const fullPath = path.join(complementFolder, stampedFilename);
    fs.writeFileSync(fullPath, buffer);

    return {
      pdfUrl: `/uploads/demandes/${id_demande}/complements/${stampedFilename}`,
      pdfFilename: stampedFilename,
    };
  }

  private async persistComplementRecepissePdfForDemande(
    id_demande: number,
    complementOverride: any,
  ) {
    const { buffer, filename } = await this.generateComplementRecepissePdf(
      id_demande,
      {
        complementOverride,
      },
    );

    const complementFolder = this.resolveComplementStorageFolder(id_demande);
    fs.mkdirSync(complementFolder, { recursive: true });

    const safeBaseName = this.sanitizeGeneratedFilename(
      filename,
      `recepisse_complement_${id_demande}.pdf`,
    );
    const stampedFilename = `${Date.now()}_${Number(
      complementOverride?.id_complement || 0,
    )}_${safeBaseName}`;
    const fullPath = path.join(complementFolder, stampedFilename);
    fs.writeFileSync(fullPath, buffer);

    return {
      recepissePdfUrl: `/uploads/demandes/${id_demande}/complements/${stampedFilename}`,
      recepissePdfFilename: stampedFilename,
    };
  }

  private summariseMissing(
    definitions: Array<{
      id_doc: number;
      nom_doc: string;
      is_required: boolean;
      missing_action: MissingAction;
      reject_message: string | null;
    }>,
    statuses: Array<{ id_doc: number; status: string }>,
  ) {
    const missingRequired = definitions.filter((def) => {
      if (!def.is_required) {
        return false;
      }
      const match = statuses.find((s) => s.id_doc === def.id_doc);
      return !match || match.status !== 'present';
    });

    const blocking = missingRequired.filter(
      (def) => def.missing_action === MissingAction.REJECT,
    );
    const blockingNext = missingRequired.filter(
      (def) => def.missing_action === MissingAction.BLOCK_NEXT,
    );
    const warnings = missingRequired.filter(
      (def) => def.missing_action === MissingAction.WARNING,
    );

    const summary: MissingSummary = {
      requiredMissing: missingRequired.map((def) => ({
        id_doc: def.id_doc,
        nom_doc: def.nom_doc,
        missing_action: def.missing_action,
        reject_message: def.reject_message,
      })),
      blocking: blocking.map((def) => ({
        id_doc: def.id_doc,
        nom_doc: def.nom_doc,
        reject_message: def.reject_message,
      })),
      blockingNext: blockingNext.map((def) => ({
        id_doc: def.id_doc,
        nom_doc: def.nom_doc,
      })),
      warnings: warnings.map((def) => ({
        id_doc: def.id_doc,
        nom_doc: def.nom_doc,
      })),
    };

    const allPresent = definitions.every((def) => {
      if (!def.is_required) {
        return true;
      }
      const match = statuses.find((s) => s.id_doc === def.id_doc);
      return Boolean(match) && match!.status === 'present';
    });

    let dossierStatus: 'complet' | 'incomplet' | 'reserve' | 'rejete';
    if (blocking.length > 0) {
      dossierStatus = 'rejete';
    } else if (blockingNext.length > 0) {
      dossierStatus = 'incomplet';
    } else if (warnings.length > 0) {
      dossierStatus = 'reserve';
    } else {
      dossierStatus = allPresent ? 'complet' : 'incomplet';
    }

    return { summary, dossierStatus };
  }

  private computeDeadlines(
    summary: MissingSummary,
    options: {
      dateDepot?: Date | null;
      dateMiseEnDemeure?: Date | null;
      dateRecepisse?: Date | null;
    },
  ): DeadlinePayload {
    const depot = options.dateDepot ? new Date(options.dateDepot) : null;
    const miseBase = options.dateMiseEnDemeure
      ? new Date(options.dateMiseEnDemeure)
      : depot;
    const recepisseBase = options.dateRecepisse
      ? new Date(options.dateRecepisse)
      : depot;

    // 30 jours calendaires (pas jours ouvrables)
    const miseEnDemeureDeadline =
      summary.blockingNext.length > 0 && miseBase
        ? this.addDays(miseBase, 30).toISOString()
        : null;

    const instructionDeadline =
      summary.blocking.length === 0 &&
      summary.blockingNext.length === 0 &&
      recepisseBase
        ? this.addBusinessDays(recepisseBase, 10).toISOString()
        : null;

    return {
      miseEnDemeure: miseEnDemeureDeadline,
      instruction: instructionDeadline,
    };
  }

  async getLatestComplementByDemande(id_demande: number) {
    const complement = await (this.prisma as any).demandeComplement.findFirst({
      where: { id_demande },
      orderBy: [{ created_at: 'desc' }, { id_complement: 'desc' }],
      include: {
        items: {
          orderBy: { id_item: 'asc' },
        },
      },
    });

    return this.mapComplementRecord(complement);
  }

  async getDocumentsByDemande(id_demande: number) {
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
      include: {
        procedure: true,
        typePermis: true,
        typeProcedure: true,
        dossiersFournis: {
          include: {
            documents: {
              include: {
                document: true,
              },
            },
          },
          orderBy: { date_depot: 'desc' },
          take: 1,
        },
      },
    });

    if (!demande) {
      return {
        documents: [],
        dossierFournis: null,
        missingSummary: {
          requiredMissing: [],
          blocking: [],
          blockingNext: [],
          warnings: [],
        },
        deadlines: { miseEnDemeure: null, instruction: null },
        demande: {
          id_demande,
          date_demande: null,
          date_instruction: null,
          date_refus: null,
          statut_demande: null,
          dossier_recevable: null,
          dossier_complet: null,
          duree_instruction: null,
        },
      };
    }

    if (!demande?.id_typeProc || !demande?.id_typePermis) {
      return {
        documents: [],
        dossierFournis: null,
        missingSummary: {
          requiredMissing: [],
          blocking: [],
          blockingNext: [],
          warnings: [],
        },
        deadlines: { miseEnDemeure: null, instruction: null },
        demande: {
          id_demande: demande?.id_demande ?? id_demande,
          date_demande: demande?.date_demande ?? null,
          date_instruction: demande?.date_instruction ?? null,
          date_refus: demande?.date_refus ?? null,
          statut_demande: demande?.statut_demande ?? null,
          dossier_recevable: demande?.dossier_recevable ?? null,
          dossier_complet: demande?.dossier_complet ?? null,
          duree_instruction: demande?.duree_instruction ?? null,
        },
      };
    }

    const dossier = await this.prisma.dossierAdministratif.findFirst({
      where: {
        id_typeproc: demande.id_typeProc,
        id_typePermis: demande.id_typePermis,
      },
      include: {
        dossierDocuments: {
          include: {
            document: true,
          },
        },
      },
    });

    if (!dossier) {
      return {
        documents: [],
        dossierFournis: null,
        missingSummary: {
          requiredMissing: [],
          blocking: [],
          blockingNext: [],
          warnings: [],
        },
        deadlines: { miseEnDemeure: null, instruction: null },
        demande: {
          id_demande: demande.id_demande,
          date_demande: demande.date_demande,
          date_instruction: demande.date_instruction,
          date_refus: demande.date_refus,
          statut_demande: demande.statut_demande,
          dossier_recevable: demande.dossier_recevable ?? null,
          dossier_complet: demande.dossier_complet ?? null,
          duree_instruction: demande.duree_instruction ?? null,
        },
      };
    }

    const docDefinitions = dossier.dossierDocuments.map((dd) => ({
      id_doc: dd.document.id_doc,
      nom_doc: dd.document.nom_doc,
      document: dd.document,
      is_required: dd.is_obligatoire ?? false,
      missing_action: dd.missing_action ?? MissingAction.BLOCK_NEXT,
      reject_message: dd.reject_message ?? null,
    }));

    const latestDossierFournis = demande.dossiersFournis[0];
    const existingStatuses =
      latestDossierFournis?.documents?.map((doc) => ({
        id_doc: doc.id_doc,
        status: doc.status as DocStatus,
        file_url: doc.file_url ?? null,
        created_at: doc.created_at ?? null,
        updated_at: doc.updated_at ?? null,
      })) ?? [];

    const { summary, dossierStatus } = this.summariseMissing(
      docDefinitions.map(
        ({ id_doc, nom_doc, is_required, missing_action, reject_message }) => ({
          id_doc,
          nom_doc,
          is_required,
          missing_action,
          reject_message,
        }),
      ),
      existingStatuses,
    );

    const documents = docDefinitions.map((def) => {
      const status = existingStatuses.find((s) => s.id_doc === def.id_doc);
      const statut = status?.status ?? 'manquant';
      return {
        id_doc: def.id_doc,
        nom_doc: def.document.nom_doc,
        description: def.document.description,
        format: def.document.format,
        taille_doc: def.document.taille_doc,
        statut,
        file_url: status?.file_url ?? null,
        created_at: status?.created_at ?? null,
        updated_at: status?.updated_at ?? null,
        is_required: def.is_required,
        missing_action: def.missing_action,
        reject_message: def.reject_message,
      };
    });

    const deadlines = this.computeDeadlines(summary, {
      dateDepot: latestDossierFournis?.date_depot ?? null,
      dateMiseEnDemeure: latestDossierFournis?.date_mise_en_demeure ?? null,
      dateRecepisse: latestDossierFournis?.date_recepisse ?? null,
    });

    return {
      documents,
      dossierFournis: latestDossierFournis
        ? {
            id_dossierFournis: latestDossierFournis.id_dossierFournis,
            statut_dossier: dossierStatus,
            remarques: latestDossierFournis.remarques,
            date_depot: latestDossierFournis.date_depot,
            numero_accuse: latestDossierFournis.numero_accuse,
            date_accuse: latestDossierFournis.date_accuse,
            numero_recepisse: latestDossierFournis.numero_recepisse,
            date_recepisse: latestDossierFournis.date_recepisse,
            mise_en_demeure_envoyee:
              latestDossierFournis.mise_en_demeure_envoyee,
            date_mise_en_demeure: latestDossierFournis.date_mise_en_demeure,
            pieces_manquantes: latestDossierFournis.pieces_manquantes,
            verification_phase: latestDossierFournis.verification_phase,
            date_preannotation: latestDossierFournis.date_preannotation,
          }
        : null,
      missingSummary: summary,
      deadlines,
      demande: {
        id_demande: demande.id_demande,
        date_demande: demande.date_demande,
        date_instruction: demande.date_instruction,
        date_refus: demande.date_refus,
        statut_demande: demande.statut_demande,
        dossier_recevable: demande.dossier_recevable ?? null,
        dossier_complet: demande.dossier_complet ?? null,
        duree_instruction: demande.duree_instruction ?? null,
      },
    };
  }

  async getDemandeDocumentFilePayload(
    id_demande: number,
    id_doc: number,
    actorUserId?: number | null,
  ) {
    await this.assertDemandeAccess(id_demande, actorUserId);

    const documentsPayload = await this.getDocumentsByDemande(id_demande);
    const targetDocument = Array.isArray(documentsPayload?.documents)
      ? documentsPayload.documents.find(
          (doc: any) => Number(doc?.id_doc) === Number(id_doc),
        )
      : null;

    if (!targetDocument?.file_url) {
      const fallbackFile = this.findLatestDemandUploadFile(id_demande, [
        `${id_doc}_`,
      ]);
      if (fallbackFile) {
        return fallbackFile;
      }
      throw new NotFoundException(
        'Aucun fichier n est disponible pour ce document',
      );
    }

    return (
      this.tryResolveStoredDocumentFile(
        targetDocument.file_url,
        path.basename(targetDocument.file_url) || `document-${id_doc}`,
      ) ||
      this.findLatestDemandUploadFile(id_demande, [`${id_doc}_`]) ||
      (() => {
        throw new NotFoundException('Fichier introuvable sur le serveur');
      })()
    );
  }

  async getComplementItemFilePayload(
    id_demande: number,
    id_item: number,
    actorUserId?: number | null,
  ) {
    await this.assertDemandeAccess(id_demande, actorUserId);

    const targetItem = await (this.prisma as any).demandeComplementItem.findUnique({
      where: { id_item },
      include: {
        complement: true,
      },
    });

    if (!targetItem?.id_item) {
      throw new NotFoundException('Document de completude introuvable');
    }

    if (Number(targetItem?.complement?.id_demande) !== Number(id_demande)) {
      throw new BadRequestException(
        'Le document de completude ne correspond pas a cette demande',
      );
    }

    let fileUrl = String(targetItem.reponse_file_url || '').trim() || null;
    if (!fileUrl) {
      const documentsPayload = await this.getDocumentsByDemande(id_demande);
      const matchingDocument = Array.isArray(documentsPayload?.documents)
        ? documentsPayload.documents.find(
            (doc: any) => Number(doc?.id_doc) === Number(targetItem?.id_doc),
          )
        : null;
      fileUrl = String(matchingDocument?.file_url || '').trim() || null;
    }

    if (!fileUrl) {
      throw new NotFoundException(
        'Aucun fichier corrige n est disponible pour ce document de completude',
      );
    }

    return (
      this.tryResolveStoredDocumentFile(
        fileUrl,
        path.basename(fileUrl) || `complement-item-${id_item}`,
      ) ||
      this.findLatestDemandUploadFile(id_demande, [
        `complement_item_${id_item}_`,
        `${Number(targetItem?.id_doc)}_`,
      ]) ||
      (() => {
        throw new NotFoundException('Fichier introuvable sur le serveur');
      })()
    );
  }

  async createOrUpdateDossierFournis(
    id_demande: number,
    documents: {
      id_doc: number;
      status: DocStatus;
      file_url?: string | null;
    }[],
    remarques?: string,
  ) {
    return this.prisma.$transaction(async (prisma) => {
      const demande = await prisma.demandePortail.findUnique({
        where: { id_demande },
        include: {
          procedure: true,
        },
      });

      if (!demande?.id_typeProc || !demande?.id_typePermis) {
        throw new Error('Type procedure or type permis data is missing.');
      }

      const dossierDefinition = await prisma.dossierAdministratif.findFirst({
        where: {
          id_typeproc: demande.id_typeProc,
          id_typePermis: demande.id_typePermis,
        },
        include: {
          dossierDocuments: {
            include: {
              document: true,
            },
          },
        },
      });

      if (!dossierDefinition) {
        throw new Error(
          'No dossier administratif configured for this procedure/permis.',
        );
      }

      const definitionMap = new Map<
        number,
        {
          nom_doc: string;
          is_required: boolean;
          missing_action: MissingAction;
          reject_message: string | null;
        }
      >();

      dossierDefinition.dossierDocuments.forEach((def) => {
        definitionMap.set(def.document.id_doc, {
          nom_doc: def.document.nom_doc,
          is_required: def.is_obligatoire ?? false,
          missing_action: def.missing_action ?? MissingAction.BLOCK_NEXT,
          reject_message: def.reject_message ?? null,
        });
      });

      const statusEntries = documents.map((doc) => ({
        id_doc: doc.id_doc,
        status: doc.status,
        file_url: doc.file_url ?? null,
      }));

      const summarySource = statusEntries.map((entry) => ({
        id_doc: entry.id_doc,
        status: entry.status === 'present' ? 'present' : 'manquant',
      }));

      const { summary, dossierStatus } = this.summariseMissing(
        Array.from(definitionMap.entries()).map(([id_doc, meta]) => ({
          id_doc,
          nom_doc: meta.nom_doc,
          is_required: meta.is_required,
          missing_action: meta.missing_action,
          reject_message: meta.reject_message,
        })),
        summarySource,
      );

      const now = new Date();

      const existingDossier = await prisma.dossierFournisPortail.findFirst({
        where: { id_demande },
        include: { documents: true },
      });

      const piecesManquantes: MissingSummaryEntry[] =
        summary.requiredMissing.map((item) => ({
          id_doc: item.id_doc,
          nom_doc: item.nom_doc,
          missing_action: item.missing_action,
          reject_message: item.reject_message,
        }));

      // 30 jours calendaires (pas jours ouvrables)
      const miseEnDemeureDeadlineDate =
        summary.blockingNext.length > 0 ? this.addDays(now, 30) : null;

      const piecesManquantesValue:
        | Prisma.NullableJsonNullValueInput
        | Prisma.InputJsonValue =
        piecesManquantes.length > 0
          ? ({
              generated_at: now.toISOString(),
              deadline: miseEnDemeureDeadlineDate?.toISOString() ?? null,
              deadlines: {
                mise_en_demeure:
                  miseEnDemeureDeadlineDate?.toISOString() ?? null,
                instruction: null,
              },
              items: piecesManquantes,
            } as Prisma.InputJsonValue)
          : Prisma.NullableJsonNullValueInput.JsonNull;

      const verificationPhase =
        summary.blocking.length > 0
          ? 'REJET'
          : summary.blockingNext.length > 0
            ? 'MISE_EN_DEMEURE'
            : 'RECEVABILITE';

      const commonData: {
        statut_dossier: string;
        remarques: string | null | undefined;
        date_depot: Date;
        verification_phase: string;
        mise_en_demeure_envoyee: boolean;
        date_mise_en_demeure: Date | null;
        pieces_manquantes:
          | Prisma.NullableJsonNullValueInput
          | Prisma.InputJsonValue;
      } = {
        statut_dossier: dossierStatus,
        remarques,
        date_depot: now,
        verification_phase: verificationPhase,
        mise_en_demeure_envoyee: summary.blockingNext.length > 0,
        date_mise_en_demeure: summary.blockingNext.length > 0 ? now : null,
        pieces_manquantes: piecesManquantesValue,
      };

      const createDocumentsPayload = statusEntries.map((item) => ({
        id_doc: item.id_doc,
        status: item.status,
        file_url: item.file_url,
      }));

      let dossierResult;
      if (existingDossier) {
        await prisma.dossierFournisDocumentPortail.deleteMany({
          where: { id_dossierFournis: existingDossier.id_dossierFournis },
        });

        dossierResult = await prisma.dossierFournisPortail.update({
          where: { id_dossierFournis: existingDossier.id_dossierFournis },
          data: {
            ...commonData,
            numero_accuse:
              existingDossier.numero_accuse ?? this.generateReference('ACC'),
            date_accuse: existingDossier.date_accuse ?? now,
            numero_recepisse:
              piecesManquantes.length === 0
                ? (existingDossier.numero_recepisse ??
                  this.generateReference('REC'))
                : existingDossier.numero_recepisse,
            date_recepisse:
              piecesManquantes.length === 0
                ? (existingDossier.date_recepisse ?? now)
                : existingDossier.date_recepisse,
            date_preannotation:
              piecesManquantes.length === 0
                ? (existingDossier.date_preannotation ?? now)
                : existingDossier.date_preannotation,
            documents: {
              createMany: {
                data: createDocumentsPayload,
              },
            },
          },
          include: { documents: true },
        });
      } else {
        dossierResult = await prisma.dossierFournisPortail.create({
          data: {
            id_demande,
            ...commonData,
            numero_accuse: this.generateReference('ACC'),
            date_accuse: now,
            numero_recepisse:
              piecesManquantes.length === 0
                ? this.generateReference('REC')
                : null,
            date_recepisse: piecesManquantes.length === 0 ? now : null,
            date_preannotation: piecesManquantes.length === 0 ? now : null,
            documents: {
              createMany: {
                data: createDocumentsPayload,
              },
            },
          },
          include: { documents: true },
        });
      }

      if (piecesManquantes.length === 0) {
        dossierResult = await prisma.dossierFournisPortail.update({
          where: { id_dossierFournis: dossierResult.id_dossierFournis },
          data: {
            mise_en_demeure_envoyee: false,
            date_mise_en_demeure: null,
            pieces_manquantes: Prisma.NullableJsonNullValueInput.JsonNull,
          },
          include: { documents: true },
        });
      }

      if (false && summary.blocking.length > 0) {
        const reason = summary.blocking
          .map((item) => item.reject_message || 'Document obligatoire manquant')
          .join(', ');

        await prisma.demandePortail.update({
          where: { id_demande },
          data: {
            statut_demande: 'REJETEE',
            remarques: reason,
            date_refus: now,
          },
        });

        // Do not auto-close the whole procedure when saving documents
        // Saving an Ã©tape should only update the step's status, not the procedure's.
        // If a rejection needs to close the procedure, call the explicit
        // procedure termination endpoint or updateDemandeStatus instead.
        // Keeping the procedure open here avoids premature TERMINEE status.
        // if (demande.id_proc) {
        //   await prisma.procedure.update({
        //     where: { id_proc: demande.id_proc },
        //     data: {
        //       statut_proc: StatutProcedure.TERMINEE,
        //       date_fin_proc: now,
        //     },
        //   });
        // }
      }

      const deadlines = this.computeDeadlines(summary, {
        dateDepot: dossierResult.date_depot,
        dateMiseEnDemeure: dossierResult.date_mise_en_demeure,
        dateRecepisse: dossierResult.date_recepisse,
      });

      // Synchronise le statut de complÃ©tude du dossier au niveau de la demande
      await prisma.demandePortail.update({
        where: { id_demande },
        data: {
          dossier_complet: dossierStatus === 'complet',
        },
      });

      return {
        message: 'Dossier fournis enregistre',
        dossierFournis: dossierResult,
        missingSummary: summary,
        deadlines,
      };
    });
  }

  async markDocumentAsUploaded(
    id_demande: number,
    id_doc: number,
    file_url: string,
    options?: {
      context?: string | null;
      complementItemId?: number | null;
    },
  ) {
    const now = new Date();
    const updatedComplement = await this.prisma.$transaction(async (prisma) => {
      const demande = await prisma.demandePortail.findUnique({
        where: { id_demande },
        include: {
          dossiersFournis: {
            include: { documents: true },
            orderBy: { date_depot: 'desc' },
            take: 1,
          },
        },
      });

      if (!demande) {
        throw new NotFoundException('Demande introuvable');
      }

      const dossierDef = await prisma.dossierAdministratif.findFirst({
        where: {
          id_typeproc: demande.id_typeProc ?? undefined,
          id_typePermis: demande.id_typePermis ?? undefined,
        },
      });
      if (!dossierDef) {
        throw new NotFoundException(
          'Aucun dossier administratif configurÃ© pour cette demande',
        );
      }

      const existingDossier = demande.dossiersFournis[0];
      const dossier =
        existingDossier ??
        (await prisma.dossierFournisPortail.create({
          data: {
            id_demande,
            statut_dossier: 'incomplet',
            verification_phase: 'RECEVABILITE',
            date_depot: now,
            numero_accuse: `ACC-${Date.now()}`,
            date_accuse: now,
            mise_en_demeure_envoyee: false,
            pieces_manquantes: Prisma.NullableJsonNullValueInput.JsonNull,
          },
          include: { documents: true },
        }));

      await prisma.dossierFournisDocumentPortail.upsert({
        where: {
          id_dossierFournis_id_doc: {
            id_dossierFournis: dossier.id_dossierFournis,
            id_doc,
          },
        },
        update: {
          status: 'present',
          file_url,
          updated_at: now,
        },
        create: {
          id_dossierFournis: dossier.id_dossierFournis,
          id_doc,
          status: 'present',
          file_url,
        },
      });

      const normalizedContext = String(options?.context || '')
        .trim()
        .toLowerCase();
      return normalizedContext === 'complement'
        ? this.markExplicitComplementItemAsResponded(
            prisma,
            id_demande,
            Number(options?.complementItemId || 0),
            id_doc,
            file_url,
            now,
          )
        : null;
    });

    const documentsPayload = await this.getDocumentsByDemande(id_demande);

    return {
      fileUrl: file_url,
      ...documentsPayload,
      complement: this.mapComplementRecord(updatedComplement),
    };
  }


  async markComplementDocumentAsUploaded(
    id_demande: number,
    id_item: number,
    file_url: string,
  ) {
    console.info('[DocumentsService] markComplementDocumentAsUploaded:start', {
      id_demande,
      id_item,
      file_url,
    });
    try {
      const now = new Date();
      const updatedComplement = await this.prisma.$transaction(async (prisma) => {
        const targetItem = await (prisma as any).demandeComplementItem.findUnique({
          where: { id_item },
          include: {
            complement: true,
          },
        });

        if (!targetItem?.id_item) {
          throw new NotFoundException(
            'Document de compl??tude introuvable pour cet upload',
          );
        }

        if (Number(targetItem?.complement?.id_demande) !== Number(id_demande)) {
          throw new BadRequestException(
            'Le document de compl??tude ne correspond pas ?? cette demande',
          );
        }

        const id_doc = Number(targetItem?.id_doc);
        if (!Number.isFinite(id_doc) || id_doc <= 0) {
          throw new BadRequestException(
            "Cette demande de compl??tude n'est pas li??e ?? un document t??l??versable",
          );
        }

        const complementStatus = String(
          targetItem?.complement?.statut_complement || '',
        )
          .trim()
          .toUpperCase();
        if (complementStatus !== 'OUVERTE') {
          throw new BadRequestException(
            'Cette completude n accepte plus de correction de document',
          );
        }

        const { dossier } = await this.ensureUploadableDossier(
          prisma,
          id_demande,
          now,
        );

        await prisma.dossierFournisDocumentPortail.upsert({
          where: {
            id_dossierFournis_id_doc: {
              id_dossierFournis: dossier.id_dossierFournis,
              id_doc,
            },
          },
          update: {
            status: 'present',
            file_url,
            updated_at: now,
          },
          create: {
            id_dossierFournis: dossier.id_dossierFournis,
            id_doc,
            status: 'present',
            file_url,
          },
        });

        return this.markExplicitComplementItemAsResponded(
          prisma,
          id_demande,
          Number(targetItem.id_item),
          id_doc,
          file_url,
          now,
        );
      });

      const documentsPayload = await this.getDocumentsByDemande(id_demande);
      console.info('[DocumentsService] markComplementDocumentAsUploaded:done', {
        id_demande,
        id_item,
        complementStatus: updatedComplement?.statut_complement ?? null,
        itemStatus:
          updatedComplement?.items?.find(
            (item: any) => Number(item.id_item) === Number(id_item),
          )?.statut_reponse ?? null,
        documentsCount: Array.isArray(updatedComplement?.items)
          ? updatedComplement.items.length
          : 0,
        responseFileUrl:
          updatedComplement?.items?.find(
            (item: any) => Number(item.id_item) === Number(id_item),
          )?.reponse_file_url ?? null,
      });

      return {
        fileUrl: file_url,
        ...documentsPayload,
        complement: this.mapComplementRecord(updatedComplement),
      };
    } catch (error) {
      console.error('[DocumentsService] markComplementDocumentAsUploaded:error', {
        id_demande,
        id_item,
        file_url,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      });
      throw error;
    }
  }

  async submitDemandeComplement(id_demande: number, actorUserId?: number | null) {
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
      include: {
        typePermis: {
          select: {
            code_type: true,
            lib_type: true,
          },
        },
      },
    });

    if (!demande) {
      throw new NotFoundException('Demande introuvable');
    }

    const safeActorUserId = Number(actorUserId);
    if (Number.isFinite(safeActorUserId) && safeActorUserId > 0) {
      const isAdmin = await this.notificationsService.isAdminUser(safeActorUserId);
      const isOwner = Number(demande.utilisateurId) === safeActorUserId;
      if (!isAdmin && !isOwner) {
        throw new ForbiddenException(
          'Vous n avez pas le droit de soumettre ce complement',
        );
      }
    }

    const latestComplement = await (this.prisma as any).demandeComplement.findFirst({
      where: { id_demande },
      orderBy: [{ created_at: 'desc' }, { id_complement: 'desc' }],
      include: {
        items: {
          orderBy: { id_item: 'asc' },
        },
      },
    });

    if (!latestComplement) {
      throw new NotFoundException(
        'Aucune demande de complement active pour cette demande',
      );
    }

    const status = String(latestComplement.statut_complement || '')
      .trim()
      .toUpperCase();
    if (status === 'SOUMISE') {
      throw new BadRequestException('Ce complement a deja ete soumis');
    }
    if (status === 'CLOTUREE' || status === 'TRAITEE') {
      throw new BadRequestException('Ce complement est deja cloture');
    }

    const latestDossier = await this.prisma.dossierFournisPortail.findFirst({
      where: { id_demande },
      select: {
        id_dossierFournis: true,
        documents: {
          select: {
            id_doc: true,
            status: true,
            file_url: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
      orderBy: [{ date_depot: 'desc' }, { id_dossierFournis: 'desc' }],
    });

    const currentDocsById = new Map<number, any>(
      (latestDossier?.documents || [])
        .map((doc: any) => [Number(doc.id_doc), doc] as const)
        .filter(([docId]) => Number.isFinite(docId) && docId > 0),
    );
    const complementCreatedTs = latestComplement.created_at
      ? new Date(latestComplement.created_at).getTime()
      : -1;
    const pendingResponseItems = (latestComplement.items || []).filter((item: any) => {
      const itemStatus = String(item.statut_traitement || 'A_TRAITER')
        .trim()
        .toUpperCase();
      if (itemStatus === 'TRAITEE') {
        return false;
      }

      return !this.hasComplementItemUserResponse(
        item,
        currentDocsById,
        complementCreatedTs,
      );
    });

    if ((latestComplement.items || []).length > 0 && pendingResponseItems.length > 0) {
      throw new BadRequestException(
        'Veuillez corriger ou remplacer tous les documents demandes avant de soumettre le complement',
      );
    }

    const now = new Date();
    let updatedComplement = await this.prisma.$transaction(async (prisma) => {
      const readyItemIds = (latestComplement.items || [])
        .filter((item: any) =>
          this.hasComplementItemUserResponse(
            item,
            currentDocsById,
            complementCreatedTs,
          ),
        )
        .map((item: any) => Number(item.id_item))
        .filter((itemId: number) => Number.isFinite(itemId) && itemId > 0);

      for (const itemId of readyItemIds) {
        const matchingDocId = Number(
          latestComplement.items.find((item: any) => Number(item.id_item) === itemId)?.id_doc,
        );
        const currentDoc = Number.isFinite(matchingDocId)
          ? currentDocsById.get(matchingDocId)
          : null;
        await (prisma as any).demandeComplementItem.update({
          where: { id_item: itemId },
          data: {
            statut_reponse: 'SOUMIS',
            repondu_at:
              latestComplement.items.find((item: any) => Number(item.id_item) === itemId)
                ?.repondu_at ?? now,
            reponse_file_url:
              currentDoc?.file_url ??
              latestComplement.items.find((item: any) => Number(item.id_item) === itemId)
                ?.reponse_file_url ??
              null,
          },
        });
      }

      const updated = await (prisma as any).demandeComplement.update({
        where: { id_complement: latestComplement.id_complement },
        data: {
          statut_complement: 'SOUMISE',
          submitted_at: now,
        },
        include: {
          items: {
            orderBy: { id_item: 'asc' },
          },
        },
      });

      await prisma.demandePortail.update({
        where: { id_demande },
        data: {
          statut_demande: 'EN_COURS',
          date_refus: null,
          remarques: 'Complement soumis par le demandeur',
        },
      });

      const latestDossier = await prisma.dossierFournisPortail.findFirst({
        where: { id_demande },
        select: { id_dossierFournis: true },
        orderBy: [{ date_depot: 'desc' }, { id_dossierFournis: 'desc' }],
      });

      if (latestDossier) {
        await prisma.dossierFournisPortail.update({
          where: { id_dossierFournis: latestDossier.id_dossierFournis },
          data: {
            verification_phase: 'COMPLEMENT_SOUMIS',
            mise_en_demeure_envoyee: false,
          },
        });
      }

      return updated;
    });

    try {
      const savedRecepisse = await this.persistComplementRecepissePdfForDemande(
        id_demande,
        updatedComplement,
      );
      updatedComplement = await (this.prisma as any).demandeComplement.update({
        where: { id_complement: latestComplement.id_complement },
        data: {
          recepisse_pdf_url: savedRecepisse.recepissePdfUrl,
          recepisse_pdf_filename: savedRecepisse.recepissePdfFilename,
        },
        include: {
          items: {
            orderBy: { id_item: 'asc' },
          },
        },
      });
    } catch (error) {
      console.warn(
        `Impossible de sauvegarder le recepisse de completude pour demande ${id_demande}`,
        error,
      );
    }

    try {
      await this.notificationsService.createAdminComplementSubmittedNotification({
        demandeId: demande.id_demande,
        demandeCode: demande.code_demande || `DEM-${demande.id_demande}`,
        typePermisLabel:
          demande.typePermis?.lib_type || demande.typePermis?.code_type || null,
        demandeurUserId: demande.utilisateurId,
      });
    } catch (error) {
      console.warn(
        `Notification admin complement soumis non envoyee pour demande ${demande.id_demande}`,
        error,
      );
    }

    return {
      message: 'Complement soumis avec succes',
      complement: this.mapComplementRecord(updatedComplement),
    };
  }

  async validateComplementItems(
    id_demande: number,
    itemIds: number[],
    actorUserId?: number | null,
    noteTraitement?: string | null,
  ) {
    const safeActorUserId = Number(actorUserId);
    if (!Number.isFinite(safeActorUserId) || safeActorUserId <= 0) {
      throw new ForbiddenException('Utilisateur admin invalide');
    }

    const isAdmin = await this.notificationsService.isAdminUser(safeActorUserId);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Vous n avez pas le droit de traiter ce complement',
      );
    }

    const safeItemIds = Array.from(
      new Set(
        (itemIds || [])
          .map((itemId) => Number(itemId))
          .filter((itemId) => Number.isFinite(itemId) && itemId > 0),
      ),
    );
    if (!safeItemIds.length) {
      throw new BadRequestException(
        'Selectionnez au moins un document de complement',
      );
    }

    const latestComplement = await (this.prisma as any).demandeComplement.findFirst({
      where: { id_demande },
      orderBy: [{ created_at: 'desc' }, { id_complement: 'desc' }],
      include: {
        items: {
          orderBy: { id_item: 'asc' },
        },
      },
    });

    if (!latestComplement) {
      throw new NotFoundException('Aucun complement trouve pour cette demande');
    }

    const complementStatus = String(latestComplement.statut_complement || '')
      .trim()
      .toUpperCase();
    if (complementStatus === 'CLOTUREE') {
      throw new BadRequestException('Ce complement est deja cloture');
    }

    const existingItems = Array.isArray(latestComplement.items)
      ? latestComplement.items
      : [];
    const targetItems = existingItems.filter((item: any) =>
      safeItemIds.includes(Number(item.id_item)),
    );

    if (!targetItems.length) {
      throw new NotFoundException(
        'Aucun document de complement correspondant a la selection',
      );
    }

    const latestDossier = await this.prisma.dossierFournisPortail.findFirst({
      where: { id_demande },
      select: {
        documents: {
          select: {
            id_doc: true,
            status: true,
            file_url: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
      orderBy: [{ date_depot: 'desc' }, { id_dossierFournis: 'desc' }],
    });

    const currentDocsById = new Map<number, any>(
      (latestDossier?.documents || [])
        .map((doc: any) => [Number(doc.id_doc), doc] as const)
        .filter(([docId]) => Number.isFinite(docId) && docId > 0),
    );
    const complementCreatedTs = latestComplement.created_at
      ? new Date(latestComplement.created_at).getTime()
      : -1;

    const pendingTargetIds = targetItems
      .filter(
        (item: any) => {
          const itemStatus = String(item.statut_traitement || 'A_TRAITER')
            .trim()
            .toUpperCase();
          if (itemStatus === 'TRAITEE') {
            return false;
          }

          const docId = Number(item.id_doc);
          if (!Number.isFinite(docId) || docId <= 0) {
            return false;
          }

          const currentDoc = currentDocsById.get(docId);
          const currentStatus = String(currentDoc?.status || '')
            .trim()
            .toLowerCase();
          const hasCurrentFile = Boolean(String(currentDoc?.file_url || '').trim());
          const isPresent = currentStatus === 'present' || hasCurrentFile;
          if (!isPresent) {
            return false;
          }

          return this.isComplementItemSubmittedForReview(
            item,
            currentDocsById,
            complementCreatedTs,
            complementStatus,
          );
        },
      )
      .map((item: any) => Number(item.id_item));

    if (!pendingTargetIds.length) {
      throw new BadRequestException(
        'Les documents selectionnes ne sont pas encore soumis au service pour verification',
      );
    }

    const now = new Date();
    const trimmedNote = String(noteTraitement || '').trim() || null;

    const updatedComplement = await this.prisma.$transaction(async (prisma) => {
      await (prisma as any).demandeComplementItem.updateMany({
        where: {
          id_complement: latestComplement.id_complement,
          id_item: { in: pendingTargetIds },
        },
        data: {
          statut_traitement: 'TRAITEE',
          traite_at: now,
          traite_by: safeActorUserId,
          note_traitement: trimmedNote,
        },
      });

      const refreshed = await (prisma as any).demandeComplement.findUnique({
        where: { id_complement: latestComplement.id_complement },
        include: {
          items: {
            orderBy: { id_item: 'asc' },
          },
        },
      });

      const remaining = (refreshed?.items || []).filter(
        (item: any) =>
          String(item.statut_traitement || 'A_TRAITER')
            .trim()
            .toUpperCase() !== 'TRAITEE',
      ).length;

      const nextStatus = remaining === 0 ? 'TRAITEE' : 'SOUMISE';

      const complementAfterStatus = await (prisma as any).demandeComplement.update({
        where: { id_complement: latestComplement.id_complement },
        data: {
          statut_complement: nextStatus,
          ...(complementStatus === 'OUVERTE' && !latestComplement.submitted_at
            ? { submitted_at: now }
            : {}),
        },
        include: {
          items: {
            orderBy: { id_item: 'asc' },
          },
        },
      });

      await prisma.demandePortail.update({
        where: { id_demande },
        data: {
          statut_demande: 'EN_COURS',
          date_refus: null,
          remarques:
            nextStatus === 'TRAITEE'
              ? 'Complement traite par l administration'
              : 'Complement en cours de verification administrative',
        },
      });

      return complementAfterStatus;
    });

    return {
      message:
        String(updatedComplement?.statut_complement || '').toUpperCase() ===
        'TRAITEE'
          ? 'Complement entierement traite'
          : 'Documents de complement traites',
      complement: this.mapComplementRecord(updatedComplement),
    };
  }

  async updateDemandeStatus(
    id_demande: number,
    statut_demande: 'ACCEPTEE' | 'REJETEE' | 'EN_COMPLEMENT',
    rejectionReason?: string,
    complementDetails?: unknown,
  ) {
    let createdComplement: any = null;
    if (statut_demande === 'EN_COMPLEMENT') {
      createdComplement = await this.createDemandeComplementRecord(
        id_demande,
        rejectionReason,
        complementDetails,
      );
    }

    // Update demande with correct fields present in schema
    const now = new Date();
    const updatedDemande = await this.prisma.demandePortail.update({
      where: { id_demande },
      data: {
        statut_demande,
        ...(statut_demande === 'ACCEPTEE'
          ? {
              date_demande: now,
              remarques: null,
              num_enregist: this.generateReference('ENR'),
            }
          : {}),
        ...(statut_demande === 'REJETEE'
          ? {
              date_refus: now,
              remarques: rejectionReason || 'Reason not specified',
            }
          : {}),
        ...(statut_demande === 'EN_COMPLEMENT'
          ? {
              date_refus: null,
              remarques: rejectionReason || 'Complement requis',
            }
          : {}),
      },
      include: {
        procedure: true,
        typePermis: {
          select: {
            code_type: true,
            lib_type: true,
          },
        },
      },
    });

    if (statut_demande === 'ACCEPTEE' || statut_demande === 'REJETEE') {
      const latestComplement = await (this.prisma as any).demandeComplement.findFirst({
        where: { id_demande },
        orderBy: [{ created_at: 'desc' }, { id_complement: 'desc' }],
        select: {
          id_complement: true,
          statut_complement: true,
        },
      });

      const latestComplementStatus = String(
        latestComplement?.statut_complement || '',
      )
        .trim()
        .toUpperCase();

      if (
        latestComplement?.id_complement &&
        (latestComplementStatus === 'SOUMISE' ||
          latestComplementStatus === 'OUVERTE')
      ) {
        await (this.prisma as any).demandeComplement.update({
          where: { id_complement: latestComplement.id_complement },
          data: {
            statut_complement:
              statut_demande === 'ACCEPTEE' ? 'TRAITEE' : 'CLOTUREE',
          },
        });
      }
    }

    if (statut_demande === 'EN_COMPLEMENT') {
      const latestDossier = await this.prisma.dossierFournisPortail.findFirst({
        where: { id_demande },
        select: { id_dossierFournis: true },
        orderBy: [{ date_depot: 'desc' }, { id_dossierFournis: 'desc' }],
      });

      if (latestDossier) {
        await this.prisma.dossierFournisPortail.update({
          where: { id_dossierFournis: latestDossier.id_dossierFournis },
          data: {
            mise_en_demeure_envoyee: true,
            date_mise_en_demeure: now,
            remarques: rejectionReason || 'Complement requis',
            verification_phase: 'EN_COMPLEMENT',
          },
        });
      }
    }

    if (statut_demande === 'EN_COMPLEMENT' && createdComplement?.id_complement) {
      try {
        const savedPdf = await this.persistComplementPdfForDemande(
          id_demande,
          createdComplement,
        );
        await (this.prisma as any).demandeComplement.update({
          where: { id_complement: createdComplement.id_complement },
          data: {
            pdf_url: savedPdf.pdfUrl,
            pdf_filename: savedPdf.pdfFilename,
          },
        });
      } catch (error) {
        console.warn(
          `Impossible de sauvegarder la fiche de complement pour demande ${id_demande}`,
          error,
        );
      }
    }

    if (statut_demande === 'ACCEPTEE') {
      await this.cessionService.applyAcceptedCessionByDemandeId(
        updatedDemande.id_demande,
      );
    }

    try {
      await this.notificationsService.createDemandeStatusNotification({
        userId: updatedDemande.utilisateurId,
        demandeId: updatedDemande.id_demande,
        demandeCode:
          updatedDemande.code_demande ||
          `DEM-${updatedDemande.id_demande}`,
        typePermisLabel:
          updatedDemande.typePermis?.lib_type ||
          updatedDemande.typePermis?.code_type ||
          null,
        statut: statut_demande,
        motifRejet: rejectionReason || null,
      });
    } catch (error) {
      console.warn(
        `Notification demande ${updatedDemande.id_demande} non envoyee`,
        error,
      );
    }

    // Do not auto-close the procedure here on rejection.
    // Keep procedure open until an explicit finalization endpoint is called.
    // if (statut_demande === 'REJETEE' && updatedDemande.id_proc) {
    //   await this.prisma.procedure.update({
    //     where: { id_proc: updatedDemande.id_proc! },
    //     data: {
    //       statut_proc: StatutProcedure.TERMINEE,
    //       date_fin_proc: now,
    //     },
    //   });
    // }

    return updatedDemande;
  }

  async updateDemandeRecevabilite(
    id_demande: number,
    dossier_recevable: boolean,
  ) {
    const now = new Date();
    const data: Prisma.demandePortailUpdateInput = {
      dossier_recevable,
      date_instruction: dossier_recevable ? now : null,
    };

    return this.prisma.demandePortail.update({
      where: { id_demande },
      data,
    });
  }

  async generateLetters(id_demande: number) {
    const data = await this.getDocumentsByDemande(id_demande);
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
      include: {
        detenteurdemande: { include: { detenteur: true } },
        procedure: true,
      },
    });

    if (!demande) {
      throw new Error('Demande not found');
    }

    const now = new Date();
    const detenteurName =
      demande.detenteurdemande?.[0]?.detenteur?.nom_societeFR || 'Le demandeur';
    const dossier = data.dossierFournis;

    const missingList = data.missingSummary.requiredMissing
      .map((m: any) => `- ${m.nom_doc}`)
      .join('\n');
    const blockingNext = data.missingSummary.blockingNext.length > 0;
    const blocking = data.missingSummary.blocking.length > 0;
    const isComplete = data.missingSummary.requiredMissing.length === 0;

    const miseEnDemeure = blockingNext
      ? {
          type: 'MISE_EN_DEMEURE' as const,
          createdAt: now.toISOString(),
          deadline: data.deadlines.miseEnDemeure,
          content:
            `Objet: Mise en demeure de complÃ©ter le dossier\n\n` +
            `${detenteurName},\n\n` +
            `Suite au dÃ©pÃ´t de votre dossier (ACC: ${dossier?.numero_accuse ?? 'N/A'}), ` +
            `nous constatons l'absence des piÃ¨ces suivantes:\n\n${missingList}\n\n` +
            `ConformÃ©ment aux procÃ©dures en vigueur, vous disposez d'un dÃ©lai maximum de 30 jours ` +
            `Ã  compter de la date de cette notification pour complÃ©ter votre dossier. ` +
            `PassÃ© ce dÃ©lai, votre demande sera rejetÃ©e.\n\n` +
            `Date: ${now.toLocaleDateString()}\n` +
            (data.deadlines.miseEnDemeure
              ? `Date limite: ${new Date(data.deadlines.miseEnDemeure).toLocaleDateString()}\n`
              : ''),
          items: data.missingSummary.requiredMissing,
        }
      : null;

    const rejet = blocking
      ? {
          type: 'REJET' as const,
          createdAt: now.toISOString(),
          content:
            `Objet: Notification de rejet de la demande\n\n` +
            `${detenteurName},\n\n` +
            `Votre demande a Ã©tÃ© rejetÃ©e en raison des manquements suivants:\n\n${missingList}\n\n` +
            `Vous pouvez dÃ©poser une nouvelle demande aprÃ¨s correction.\n\nDate: ${now.toLocaleDateString()}`,
          items: data.missingSummary.blocking,
        }
      : null;

    const recepisse = isComplete
      ? {
          type: 'RECEPISSE' as const,
          createdAt: now.toISOString(),
          numero_recepisse:
            dossier?.numero_recepisse ?? this.generateReference('REC'),
          content:
            `Objet: RÃ©cÃ©pissÃ© de recevabilitÃ©\n\n` +
            `${detenteurName},\n\n` +
            `Nous accusons rÃ©ception d'un dossier complet et recevable pour instruction. ` +
            `Le dÃ©lai d'instruction dÃ©marre Ã  compter de ce jour.\n\n` +
            `NumÃ©ro de rÃ©cÃ©pissÃ©: ${dossier?.numero_recepisse ?? 'A attribuer'}\n` +
            `Date: ${now.toLocaleDateString()}`,
        }
      : null;

    return {
      demande: {
        id_demande,
        code_demande: demande.code_demande,
        num_enregist: demande.num_enregist,
      },
      dossierFournis: dossier,
      letters: { miseEnDemeure, rejet, recepisse },
    };
  }

  async generateRecepissePdf(
    id_demande: number,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.getDocumentsByDemande(id_demande);
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
      include: {
        typePermis: true,
        detenteurdemande: { include: { detenteur: true } },
        wilaya: true,
        daira: true,
        commune: true,
      },
    });

    if (!demande) throw new Error('Demande not found');

    const dossier = data.dossierFournis;
    if (!dossier || data.missingSummary.requiredMissing.length > 0) {
      throw new Error('Recepisse is only available for complete dossiers');
    }

    // PDF layout helpers (margins, wrapping, pagination)
    const pdf = await PDFDocument.create();
    // A4 size in points
    const PAGE = { w: 595, h: 842 };
    // Slightly larger margins to keep text inside a clear border
    const MARGIN = { l: 60, r: 60, t: 70, b: 70 };
    const maxWidth = PAGE.w - MARGIN.l - MARGIN.r;

    const fontPath = path.resolve(
      __dirname,
      '../permis_generation/Amiri-Regular.ttf',
    );
    let font = null as any;
    try {
      const fontBytes = fs.readFileSync(fontPath);
      font = await pdf.embedFont(fontBytes);
    } catch {
      font = await pdf.embedFont(StandardFonts.Helvetica);
    }

    let page = pdf.addPage([PAGE.w, PAGE.h]);
    let cursorY = PAGE.h - MARGIN.t;
    const lineGap = 6;
    // Draw a subtle border on the page to keep content visually contained
    const drawPageBorder = () => {
      page.drawRectangle({
        x: MARGIN.l - 10,
        y: MARGIN.b - 10,
        width: PAGE.w - (MARGIN.l + MARGIN.r) + 20,
        height: PAGE.h - (MARGIN.t + MARGIN.b) + 20,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
      });
    };
    drawPageBorder();

    const measure = (text: string, size: number) =>
      font.widthOfTextAtSize(text, size);

    const wrapLines = (text: string, size: number): string[] => {
      const words = (text || '').split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let current = '';
      for (const w of words) {
        const test = current ? `${current} ${w}` : w;
        if (measure(test, size) <= maxWidth) {
          current = test;
        } else {
          if (current) lines.push(current);
          // If single word exceeds width, hard split
          if (measure(w, size) > maxWidth) {
            let acc = '';
            for (const ch of w) {
              const testCh = acc + ch;
              if (measure(testCh, size) > maxWidth) {
                if (acc) lines.push(acc);
                acc = ch;
              } else {
                acc = testCh;
              }
            }
            current = acc;
          } else {
            current = w;
          }
        }
      }
      if (current) lines.push(current);
      return lines;
    };

    const ensureSpace = (heightNeeded: number) => {
      if (cursorY - heightNeeded < MARGIN.b) {
        page = pdf.addPage([PAGE.w, PAGE.h]);
        cursorY = PAGE.h - MARGIN.t;
        drawPageBorder();
      }
    };

    const drawParagraph = (text: string, size = 12) => {
      const lh = size + lineGap;
      const lines = wrapLines(text, size);
      ensureSpace(lh * lines.length);
      for (const line of lines) {
        if (line === '') {
          cursorY -= lh; // paragraph spacing
        } else {
          page.drawText(line, {
            x: MARGIN.l,
            y: cursorY,
            size,
            font,
            color: rgb(0, 0, 0),
          });
          cursorY -= lh;
        }
      }
    };

    const drawTitle = (text: string, size = 16) => {
      const width = measure(text, size);
      const x = MARGIN.l + Math.max(0, (maxWidth - width) / 2);
      ensureSpace(size + 10);
      page.drawText(text, { x, y: cursorY, size, font, color: rgb(0, 0, 0) });
      cursorY -= size + 10;
    };

    // Header
    drawParagraph('RÃ©publique AlgÃ©rienne DÃ©mocratique et Populaire', 11);
    drawParagraph('MinistÃ¨re de lâ€™Ã‰nergie et des Mines', 11);
    cursorY -= 8;
    drawTitle('RÃ‰CÃ‰PISSÃ‰ DE RECEVABILITÃ‰', 14);

    // Body
    const num = dossier.numero_recepisse || 'â€”';
    const dateStr = (
      dossier.date_recepisse ? new Date(dossier.date_recepisse) : new Date()
    ).toLocaleDateString('fr-DZ');
    const demandeCode = demande.code_demande || String(id_demande);
    const detenteur =
      demande.detenteurdemande?.[0]?.detenteur?.nom_societeFR || 'Le demandeur';
    const typePermis = demande.typePermis?.lib_type || 'â€”';

    drawParagraph(`NumÃ©ro de rÃ©cÃ©pissÃ©: ${num}`, 12);
    drawParagraph(`Date: ${dateStr}`, 12);
    drawParagraph(`Code de la demande: ${demandeCode}`, 12);
    drawParagraph(`DÃ©tenteur: ${detenteur}`, 12);
    drawParagraph(`Type de permis: ${typePermis}`, 12);
    cursorY -= 6;
    drawParagraph(
      `Nous accusons rÃ©ception d'un dossier complet et recevable pour instruction.`,
      12,
    );
    cursorY -= 12;
    drawParagraph(
      'Ce rÃ©cÃ©pissÃ© marque le dÃ©part des dÃ©lais dâ€™instruction.',
      10,
    );

    const buffer = Buffer.from(await pdf.save());
    const filename = `recepisse-${demandeCode}.pdf`;
    return { buffer, filename };
  }

  private async createAdministrativePdfKit(title: string, badgeText: string) {
    const pdf = await PDFDocument.create();
    const PAGE = { w: 595, h: 842 };
    const MARGIN = { l: 42, r: 42, t: 34, b: 40 };
    const HEADER_H = 96;
    const FOOTER_H = 28;
    const CONTENT_W = PAGE.w - MARGIN.l - MARGIN.r;
    const COLORS = {
      navy: rgb(0.1, 0.25, 0.38),
      navyStrong: rgb(0.06, 0.18, 0.29),
      gold: rgb(0.84, 0.67, 0.27),
      border: rgb(0.82, 0.86, 0.9),
      text: rgb(0.16, 0.2, 0.26),
      muted: rgb(0.45, 0.5, 0.56),
      panel: rgb(0.97, 0.98, 0.99),
      infoBg: rgb(0.94, 0.97, 1),
      warningBg: rgb(1, 0.97, 0.9),
      successBg: rgb(0.93, 0.98, 0.95),
    };

    const bodyFontPath = path.resolve(
      __dirname,
      '../permis_generation/Amiri-Regular.ttf',
    );
    let bodyFont = null as any;
    try {
      const fontBytes = fs.readFileSync(bodyFontPath);
      bodyFont = await pdf.embedFont(fontBytes);
    } catch {
      bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
    }
    const headingFont = await pdf.embedFont(StandardFonts.HelveticaBold);

    let pageNumber = 0;
    let page = null as any;
    let cursorY = 0;

    const measure = (text: string, fontRef: any, size: number) =>
      fontRef.widthOfTextAtSize(text, size);

    const wrapLines = (
      text: string,
      fontRef: any,
      size: number,
      maxWidth: number,
    ): string[] => {
      const paragraphs = String(text || '').split(/\r?\n/);
      const lines: string[] = [];
      for (const para of paragraphs) {
        const words = para.split(/\s+/).filter(Boolean);
        let current = '';
        for (const word of words) {
          const probe = current ? `${current} ${word}` : word;
          if (measure(probe, fontRef, size) <= maxWidth) {
            current = probe;
            continue;
          }
          if (current) lines.push(current);
          if (measure(word, fontRef, size) > maxWidth) {
            let token = '';
            for (const ch of word) {
              const probeChar = token + ch;
              if (measure(probeChar, fontRef, size) > maxWidth) {
                if (token) lines.push(token);
                token = ch;
              } else {
                token = probeChar;
              }
            }
            current = token;
          } else {
            current = word;
          }
        }
        if (current) lines.push(current);
        if (para !== paragraphs[paragraphs.length - 1]) lines.push('');
      }
      return lines;
    };

    const drawChrome = () => {
      page.drawRectangle({
        x: 0,
        y: PAGE.h - HEADER_H,
        width: PAGE.w,
        height: HEADER_H,
        color: COLORS.navy,
      });
      page.drawRectangle({
        x: 0,
        y: PAGE.h - HEADER_H,
        width: PAGE.w,
        height: 8,
        color: COLORS.gold,
      });
      page.drawText('REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE', {
        x: MARGIN.l,
        y: PAGE.h - 28,
        size: 8.5,
        font: headingFont,
        color: rgb(1, 1, 1),
      });
      page.drawText("MINISTERE DE L'ENERGIE ET DES MINES", {
        x: MARGIN.l,
        y: PAGE.h - 42,
        size: 8,
        font: bodyFont,
        color: rgb(0.93, 0.95, 0.98),
      });
      page.drawText('AGENCE NATIONALE DES ACTIVITES MINIERES', {
        x: MARGIN.l,
        y: PAGE.h - 54,
        size: 8,
        font: bodyFont,
        color: rgb(0.93, 0.95, 0.98),
      });

      page.drawText(title, {
        x: MARGIN.l,
        y: PAGE.h - 80,
        size: 18,
        font: headingFont,
        color: rgb(1, 1, 1),
      });

      const badgeSize = 8.5;
      const badgeW = measure(badgeText, headingFont, badgeSize) + 20;
      const badgeH = 22;
      const badgeX = PAGE.w - MARGIN.r - badgeW;
      const badgeY = PAGE.h - 74;
      page.drawRectangle({
        x: badgeX,
        y: badgeY,
        width: badgeW,
        height: badgeH,
        color: rgb(1, 1, 1),
        borderColor: COLORS.gold,
        borderWidth: 1.2,
      });
      page.drawText(badgeText, {
        x: badgeX + 10,
        y: badgeY + 7,
        size: badgeSize,
        font: headingFont,
        color: COLORS.navyStrong,
      });

      page.drawLine({
        start: { x: MARGIN.l, y: FOOTER_H },
        end: { x: PAGE.w - MARGIN.r, y: FOOTER_H },
        color: COLORS.border,
        thickness: 1,
      });
      page.drawText('Document officiel genere automatiquement par le systeme ANAM', {
        x: MARGIN.l,
        y: 16,
        size: 7.5,
        font: bodyFont,
        color: COLORS.muted,
      });
      page.drawText(`Page ${pageNumber}`, {
        x: PAGE.w - MARGIN.r - 36,
        y: 16,
        size: 7.5,
        font: bodyFont,
        color: COLORS.muted,
      });
    };

    const startPage = () => {
      pageNumber += 1;
      page = pdf.addPage([PAGE.w, PAGE.h]);
      drawChrome();
      cursorY = PAGE.h - HEADER_H - 26;
    };

    const ensureSpace = (heightNeeded: number) => {
      if (!page) {
        startPage();
        return;
      }
      if (cursorY - heightNeeded < FOOTER_H + 18) {
        startPage();
      }
    };

    const drawSectionTitle = (label: string) => {
      ensureSpace(26);
      page.drawText(label.toUpperCase(), {
        x: MARGIN.l,
        y: cursorY,
        size: 9,
        font: headingFont,
        color: COLORS.navyStrong,
      });
      page.drawLine({
        start: { x: MARGIN.l, y: cursorY - 6 },
        end: { x: PAGE.w - MARGIN.r, y: cursorY - 6 },
        color: COLORS.border,
        thickness: 1,
      });
      cursorY -= 18;
    };

    const drawParagraph = (
      text: string,
      options?: {
        size?: number;
        color?: any;
        font?: any;
        gapAfter?: number;
      },
    ) => {
      const size = options?.size ?? 11;
      const fontRef = options?.font ?? bodyFont;
      const lineHeight = size + 4;
      const lines = wrapLines(text, fontRef, size, CONTENT_W);
      ensureSpace(lines.length * lineHeight + (options?.gapAfter ?? 0));
      for (const line of lines) {
        if (!line) {
          cursorY -= lineHeight;
          continue;
        }
        page.drawText(line, {
          x: MARGIN.l,
          y: cursorY,
          size,
          font: fontRef,
          color: options?.color ?? COLORS.text,
        });
        cursorY -= lineHeight;
      }
      cursorY -= options?.gapAfter ?? 0;
    };

    const drawInfoGrid = (items: Array<{ label: string; value: string }>) => {
      const gap = 12;
      const colWidth = (CONTENT_W - gap) / 2;
      for (let index = 0; index < items.length; index += 2) {
        const rowItems = items.slice(index, index + 2);
        const rowLayout = rowItems.map((item) => {
          const valueLines = wrapLines(item.value || '--', headingFont, 10.5, colWidth - 20);
          return {
            item,
            valueLines,
            height: Math.max(48, 22 + valueLines.length * 13),
          };
        });
        const rowHeight = Math.max(...rowLayout.map((entry) => entry.height));
        ensureSpace(rowHeight + gap);

        rowLayout.forEach((entry, idx) => {
          const x = MARGIN.l + idx * (colWidth + gap);
          const y = cursorY - rowHeight;
          page.drawRectangle({
            x,
            y,
            width: colWidth,
            height: rowHeight,
            color: COLORS.panel,
            borderColor: COLORS.border,
            borderWidth: 1,
          });
          page.drawText(entry.item.label.toUpperCase(), {
            x: x + 10,
            y: cursorY - 14,
            size: 7.2,
            font: headingFont,
            color: COLORS.muted,
          });
          entry.valueLines.forEach((line, lineIndex) => {
            page.drawText(line, {
              x: x + 10,
              y: cursorY - 30 - lineIndex * 12,
              size: 10.5,
              font: lineIndex === 0 ? headingFont : bodyFont,
              color: COLORS.text,
            });
          });
        });

        cursorY -= rowHeight + gap;
      }
    };

    const drawCallout = (
      titleText: string,
      bodyText: string,
      tone: 'info' | 'warning' | 'success' = 'info',
    ) => {
      const bg =
        tone === 'warning'
          ? COLORS.warningBg
          : tone === 'success'
          ? COLORS.successBg
          : COLORS.infoBg;
      const borderColor =
        tone === 'warning' ? COLORS.gold : tone === 'success' ? rgb(0.3, 0.63, 0.43) : rgb(0.36, 0.56, 0.82);
      const bodyLines = wrapLines(bodyText, bodyFont, 10.5, CONTENT_W - 24);
      const height = 34 + bodyLines.length * 12;
      ensureSpace(height + 10);
      const boxY = cursorY - height;
      page.drawRectangle({
        x: MARGIN.l,
        y: boxY,
        width: CONTENT_W,
        height,
        color: bg,
        borderColor,
        borderWidth: 1,
      });
      page.drawText(titleText, {
        x: MARGIN.l + 12,
        y: cursorY - 16,
        size: 9,
        font: headingFont,
        color: COLORS.navyStrong,
      });
      bodyLines.forEach((line, idx) => {
        page.drawText(line, {
          x: MARGIN.l + 12,
          y: cursorY - 32 - idx * 12,
          size: 10.5,
          font: bodyFont,
          color: COLORS.text,
        });
      });
      cursorY -= height + 10;
    };

    const drawDocumentCards = (
      items: Array<{ title: string; detail: string; note?: string | null }>,
      tone: 'warning' | 'success' = 'warning',
    ) => {
      const bg = tone === 'warning' ? rgb(1, 0.99, 0.96) : rgb(0.96, 0.99, 0.97);
      const accent = tone === 'warning' ? COLORS.gold : rgb(0.26, 0.6, 0.42);

      items.forEach((item, index) => {
        const detailLines = wrapLines(item.detail, bodyFont, 10.4, CONTENT_W - 36);
        const noteLines = item.note
          ? wrapLines(item.note, bodyFont, 9.6, CONTENT_W - 36)
          : [];
        const height = 34 + detailLines.length * 12 + noteLines.length * 11;
        ensureSpace(height + 10);
        const boxY = cursorY - height;
        page.drawRectangle({
          x: MARGIN.l,
          y: boxY,
          width: CONTENT_W,
          height,
          color: bg,
          borderColor: COLORS.border,
          borderWidth: 1,
        });
        page.drawRectangle({
          x: MARGIN.l,
          y: boxY,
          width: 5,
          height,
          color: accent,
        });
        page.drawText(`${index + 1}. ${item.title}`, {
          x: MARGIN.l + 16,
          y: cursorY - 16,
          size: 10.8,
          font: headingFont,
          color: COLORS.navyStrong,
        });
        detailLines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: MARGIN.l + 16,
            y: cursorY - 32 - lineIndex * 12,
            size: 10.4,
            font: bodyFont,
            color: COLORS.text,
          });
        });
        noteLines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: MARGIN.l + 16,
            y: cursorY - 32 - detailLines.length * 12 - lineIndex * 11,
            size: 9.6,
            font: bodyFont,
            color: COLORS.muted,
          });
        });
        cursorY -= height + 10;
      });
    };

    startPage();

    return {
      pdf,
      drawSectionTitle,
      drawParagraph,
      drawInfoGrid,
      drawCallout,
      drawDocumentCards,
    };
  }

  async generateMiseEnDemeurePdf(
    id_demande: number,
    options?: { complementOverride?: any },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const [data, latestComplement] = await Promise.all([
      this.getDocumentsByDemande(id_demande),
      options?.complementOverride
        ? Promise.resolve(options.complementOverride)
        : this.getLatestComplementByDemande(id_demande),
    ]);
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
      include: {
        detenteurdemande: { include: { detenteur: true } },
        typePermis: true,
      },
    });

    if (!demande) throw new Error('Demande not found');
    const hasLegacyMissing =
      Array.isArray(data?.missingSummary?.requiredMissing) &&
      data.missingSummary.requiredMissing.length > 0;
    if (!latestComplement && !hasLegacyMissing) {
      throw new Error(
        'Aucune demande de complement disponible pour cette demande',
      );
    }
    const complementRecord = latestComplement ?? {
      motif: null,
      adminMessage: null,
      delaiJours: null,
      effetAbsence: null,
      modeNotification: null,
      createdAt: null,
      documents: [] as Array<{
        nom_doc: string;
        decision: string;
        problems: string[];
        comment: string | null;
      }>,
    };

    const detenteur =
      demande.detenteurdemande?.[0]?.detenteur?.nom_societeFR || 'Le demandeur';
    const codeDemande = demande.code_demande || String(id_demande);
    const typePermis = demande.typePermis?.lib_type || '--';
    const complementCreatedAt = complementRecord.createdAt
      ? new Date(complementRecord.createdAt)
      : new Date();
    const explicitDeadline =
      complementRecord.delaiJours && complementRecord.delaiJours > 0
        ? this.addDays(complementCreatedAt, complementRecord.delaiJours)
        : null;
    const fallbackDeadline = data.deadlines?.miseEnDemeure
      ? new Date(data.deadlines.miseEnDemeure)
      : null;
    const deadlineDate = explicitDeadline ?? fallbackDeadline;
    const deadlineStr = deadlineDate
      ? deadlineDate.toLocaleDateString('fr-DZ')
      : '--';
    const pdfKit = await this.createAdministrativePdfKit(
      'MISE EN DEMEURE DE COMPLETUDE',
      codeDemande,
    );

    const complementProblemLabels: Record<string, string> = {
      expire: 'Document expire',
      date_invalide: 'Date invalide',
      illisible: 'Document illisible',
      non_signe: 'Document non signe',
      incoherent: 'Information incoherente',
      autre: 'Autre probleme',
    };
    const items =
      complementRecord.documents.length > 0
        ? complementRecord.documents.map((item) => {
            const kind =
              item.decision === 'manquant'
                ? 'Piece manquante'
                : 'Correction demandee';
            const problems = Array.isArray(item.problems) ? item.problems : [];
            const problemsLabel =
              problems.length > 0
                ? problems
                    .map((problem) => complementProblemLabels[problem] || problem)
                    .join(', ')
                : 'Probleme signale';
            const comment = String(item.comment || '').trim();
            return {
              title: item.nom_doc,
              detail:
                item.decision === 'manquant'
                  ? `${kind}. Cette piece doit etre televersee pour permettre la reprise de l'instruction.`
                  : `${kind}. Controle demande : ${problemsLabel}.`,
              note: comment ? `Observation admin : ${comment}` : null,
            };
          })
        : data.missingSummary.requiredMissing.map((item) => ({
            title: item.nom_doc,
            detail:
              'Piece complementaire requise par le service instructeur pour regulariser le dossier.',
            note: null,
          }));
    const delayDays =
      complementRecord.delaiJours && complementRecord.delaiJours > 0
        ? complementRecord.delaiJours
        : 30;

    pdfKit.drawInfoGrid([
      { label: 'Demandeur', value: detenteur },
      { label: 'Reference dossier', value: codeDemande },
      { label: 'Type de permis', value: typePermis },
      {
        label: 'Date de notification',
        value: complementCreatedAt.toLocaleDateString('fr-DZ'),
      },
      { label: 'Delai de reponse', value: `${delayDays} jours` },
      { label: 'Date limite', value: deadlineStr },
    ]);

    pdfKit.drawSectionTitle('Objet');
    pdfKit.drawParagraph(
      "Votre dossier fait l'objet d'une demande de completude. La regularisation des pieces ci-dessous est necessaire avant poursuite de l'instruction administrative.",
      { size: 11, gapAfter: 6 },
    );

    if (complementRecord.motif || complementRecord.adminMessage) {
      pdfKit.drawCallout(
        'Motif de la demande',
        String(complementRecord.motif || complementRecord.adminMessage || '').trim(),
        'info',
      );
    }

    pdfKit.drawSectionTitle('Pieces a corriger ou a fournir');
    pdfKit.drawDocumentCards(
      items.length > 0
        ? items
        : [
            {
              title: 'Pieces complementaires',
              detail:
                'Des pieces supplementaires sont requises par le service instructeur.',
              note: null,
            },
          ],
      'warning',
    );

    pdfKit.drawSectionTitle('Instruction au demandeur');
    pdfKit.drawCallout(
      'Action attendue',
      `Vous disposez d'un delai maximum de ${delayDays} jours a compter de cette notification pour televerser les documents corriges et soumettre le complement via votre espace investisseur.`,
      'warning',
    );

    if (complementRecord.effetAbsence) {
      pdfKit.drawCallout(
        "Effet en cas d'absence de reponse",
        complementRecord.effetAbsence,
        'warning',
      );
    }

    if (complementRecord.modeNotification) {
      pdfKit.drawParagraph(
        `Mode de notification retenu : ${complementRecord.modeNotification}.`,
        { size: 10.5 },
      );
    }

    pdfKit.drawParagraph(
      'Le dossier sera repris par le service instructeur apres reception et verification des documents corriges.',
      { size: 10.5, gapAfter: 4 },
    );

    const buffer = Buffer.from(await pdfKit.pdf.save());
    const filename = `mise-en-demeure-${codeDemande}.pdf`;
    return { buffer, filename };
  }

  async generateComplementRecepissePdf(
    id_demande: number,
    options?: { complementOverride?: any },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const [data, latestComplement] = await Promise.all([
      this.getDocumentsByDemande(id_demande),
      options?.complementOverride
        ? Promise.resolve(options.complementOverride)
        : this.getLatestComplementByDemande(id_demande),
    ]);
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
      include: {
        detenteurdemande: { include: { detenteur: true } },
        typePermis: true,
      },
    });

    if (!demande) throw new Error('Demande not found');
    if (!latestComplement) {
      throw new Error(
        'Aucune demande de complement disponible pour cette demande',
      );
    }

    const mappedComplement =
      latestComplement &&
      typeof latestComplement === 'object' &&
      ('documents' in latestComplement || 'statut' in latestComplement)
        ? latestComplement
        : this.mapComplementRecord(latestComplement);
    const complementStatus = String(
      mappedComplement?.statut || latestComplement?.statut_complement || '',
    )
      .trim()
      .toUpperCase();

    if (
      complementStatus !== 'SOUMISE' &&
      complementStatus !== 'TRAITEE' &&
      complementStatus !== 'CLOTUREE'
    ) {
      throw new Error(
        'Le recepisse de completude est disponible apres soumission du complement',
      );
    }

    const detenteur =
      demande.detenteurdemande?.[0]?.detenteur?.nom_societeFR || 'Le demandeur';
    const codeDemande = demande.code_demande || String(id_demande);
    const typePermis = demande.typePermis?.lib_type || '--';
    const submittedDate =
      mappedComplement?.submittedAt ||
      mappedComplement?.updatedAt ||
      mappedComplement?.createdAt ||
      new Date().toISOString();
    const submittedDateLabel = new Date(submittedDate).toLocaleDateString(
      'fr-DZ',
    );
    const pdfKit = await this.createAdministrativePdfKit(
      'RECEPISSE DE COMPLETUDE',
      codeDemande,
    );

    const complementProblemLabels: Record<string, string> = {
      expire: 'Document expire',
      date_invalide: 'Date invalide',
      illisible: 'Document illisible',
      non_signe: 'Document non signe',
      incoherent: 'Information incoherente',
      autre: 'Autre probleme',
    };
    const docItems =
      Array.isArray(mappedComplement?.documents) &&
      mappedComplement.documents.length > 0
        ? mappedComplement.documents.map((item: any) => {
            const problems = Array.isArray(item.problems) ? item.problems : [];
            const labels =
              problems.length > 0
                ? problems
                    .map((problem) => complementProblemLabels[problem] || problem)
                    .join(', ')
                : 'Probleme signale';
            return {
              title: item.nom_doc,
              detail:
                item.decision === 'manquant'
                  ? 'Piece manquante fournie dans le complement soumis.'
                  : `Document corrige et transmis au service. Nature de la regularisation : ${labels}.`,
              note: null,
            };
          })
        : [];

    pdfKit.drawInfoGrid([
      { label: 'Demandeur', value: detenteur },
      { label: 'Reference dossier', value: codeDemande },
      { label: 'Type de permis', value: typePermis },
      { label: 'Date de soumission', value: submittedDateLabel },
      { label: 'Statut de la demande', value: 'Complement soumis' },
      {
        label: 'Reference complement',
        value:
          mappedComplement?.id_complement != null
            ? `Complement #${mappedComplement.id_complement}`
            : 'Complement transmis',
      },
    ]);

    pdfKit.drawSectionTitle('Confirmation de reception');
    pdfKit.drawParagraph(
      'Le complement de dossier a ete enregistre avec succes. Les pieces corrigees ont ete transmises au service instructeur pour reverification administrative.',
      { size: 11, gapAfter: 8 },
    );

    if (docItems.length > 0) {
      pdfKit.drawSectionTitle('Documents transmis');
      pdfKit.drawDocumentCards(docItems, 'success');
    }

    pdfKit.drawCallout(
      'Suite donnee au dossier',
      "L'instruction reprend a compter de cette date. La conformite des documents transmis reste soumise au controle du service instructeur.",
      'success',
    );

    pdfKit.drawParagraph(
      'Conservez ce recepisse. Il atteste la transmission du complement dans le registre numerique des demandes.',
      { size: 10.5, gapAfter: 4 },
    );

    const buffer = Buffer.from(await pdfKit.pdf.save());
    const filename = `recepisse-completude-${codeDemande}.pdf`;
    return { buffer, filename };
  }
}


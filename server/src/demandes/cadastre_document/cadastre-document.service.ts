import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SessionService } from 'src/session/session.service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  ActionDocumentCadastral,
  CanalVerificationCadastre,
  EnumTypeFonction,
  Prisma,
  StatutDemandeDocument,
  TypeDocumentCadastral,
  TypePieceCadastre,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import { createHash, randomBytes } from 'crypto';
import { isIP } from 'net';

type CadastreSessionUser = {
  id: number;
  role?: {
    name?: string | null;
    rolePermissions?: Array<{ permission?: { name?: string | null } | null }>;
  } | null;
  Prenom?: string | null;
  email?: string | null;
  nom?: string | null;
};

type CreateCadastreRequestBody = {
  typeDocument?: TypeDocumentCadastral | string;
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
};

type VerifyOtpBody = {
  code: string;
};

type SubmitCadastreRequestBody = {
  typeDocument?: TypeDocumentCadastral | string;
  qualiteDemandeur?: string;
  objetDemande?: string;
  baseCommunication?: string;
};

type CadastreDocumentReference = {
  id: number;
  code: string;
  label: string;
  subtitle: string | null;
  description: string | null;
  iconKey: string | null;
  accentKey: string | null;
  isDefault: boolean;
  sortOrder: number;
};

type CadastreVerificationReference = {
  id: number;
  code: string;
  label: string;
  description: string | null;
  iconKey: string | null;
  isDefault: boolean;
  sortOrder: number;
};

type CadastreWorkflowReferencesResponse = {
  documents: CadastreDocumentReference[];
  verificationChannels: CadastreVerificationReference[];
};

type OtpContactValidationResponse = {
  valid: boolean;
  message: string;
  qualiteDemandeur: string;
  canalVerification: CanalVerificationCadastre;
  expectedContact: string | null;
  actualContact: string;
  targetLabel: string;
  permisId: number | null;
  permisCode: string | null;
};

@Injectable()
export class CadastreDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  private mailer?: nodemailer.Transporter;

  private extractAuthToken(req: any): string | null {
    const cookieToken = req?.cookies?.auth_token || req?.cookies?.token;
    if (cookieToken) return String(cookieToken).trim();

    const authHeader = req?.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }

    return null;
  }

  private normalizeEmail(email?: string | null) {
    return String(email || '').trim().toLowerCase();
  }

  private normalizePhone(phone?: string | null) {
    const value = String(phone || '').trim();
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim();
  }

  private normalizeLabel(value?: string | null) {
    return String(value || '').trim();
  }

  private generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private generateTemporaryReferenceDemande() {
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `TMP-CDC-${Date.now()}-${suffix}`;
  }

  private buildSequentialReferenceDemande(demandeId: number) {
    return `CDC-${String(demandeId).padStart(6, '0')}`;
  }

  private normalizeDemandeurQuality(value?: string | null) {
    const normalized = this.normalizeLabel(value).toLowerCase();
    if (!normalized) return null;
    if (normalized.includes('representant')) return 'REPRESENTANT';
    if (normalized.includes('titulaire')) return 'TITULAIRE';
    if (normalized.includes('actionnaire')) return 'ACTIONNAIRE';
    return null;
  }

  private async resolveTypePermisId(value?: string | null) {
    const raw = this.normalizeLabel(value);
    if (!raw) {
      throw new BadRequestException('Le type de permis est requis.');
    }

    const numericTypePermisId = Number(raw);
    if (Number.isFinite(numericTypePermisId) && numericTypePermisId > 0) {
      const typePermis = await this.prisma.typePermis.findUnique({
        where: { id: numericTypePermisId },
        select: { id: true },
      });

      if (typePermis) {
        return typePermis.id;
      }
    }

    const matchedTypePermis = await this.prisma.typePermis.findFirst({
      where: {
        OR: [
          { code_type: { equals: raw, mode: 'insensitive' } },
          { lib_type: { equals: raw, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    if (!matchedTypePermis) {
      throw new NotFoundException('Type de permis introuvable.');
    }

    return matchedTypePermis.id;
  }

  private async buildOtpContactValidation(
    body: CreateCadastreRequestBody,
  ): Promise<OtpContactValidationResponse> {
    const qualiteDemandeur = this.normalizeDemandeurQuality(body.qualiteDemandeur);
    const canalVerification = await this.normalizeCanal(body.canalVerification);
    const emailContact = this.normalizeEmail(body.emailContact);
    const telephoneContact = this.normalizePhone(body.telephoneContact);
    const qrCode = this.normalizeLabel(body.qrCodeTitre);
    const codePermis = this.normalizeLabel(body.codePermis);
    const typePermis = this.normalizeLabel(body.typePermis);
    const actualContact =
      canalVerification === CanalVerificationCadastre.EMAIL
        ? emailContact
        : telephoneContact;

    if (!qrCode || !codePermis || !typePermis) {
      return {
        valid: false,
        message:
          'Veuillez saisir le code QR, le code permis et le type de permis avant d\'envoyer le code OTP.',
        qualiteDemandeur: String(body.qualiteDemandeur || '').trim(),
        canalVerification,
        expectedContact: null,
        actualContact,
        targetLabel: 'demandeur',
        permisId: null,
        permisCode: null,
      };
    }

    if (!qualiteDemandeur) {
      return {
        valid: false,
        message:
          'Veuillez selectionner une qualite du demandeur valide avant de continuer.',
        qualiteDemandeur: String(body.qualiteDemandeur || '').trim(),
        canalVerification,
        expectedContact: null,
        actualContact,
        targetLabel: 'demandeur',
        permisId: null,
        permisCode: null,
      };
    }

    const permisId = await this.resolvePermisId(body);
    const permis = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      select: {
        id: true,
        code_permis: true,
        detenteur: {
          select: {
            id_detenteur: true,
            nom_societeFR: true,
            nom_societeAR: true,
            email: true,
            telephone: true,
          },
        },
      },
    });

    if (!permis) {
      return {
        valid: false,
        message: 'Permis introuvable.',
        qualiteDemandeur: String(body.qualiteDemandeur || '').trim(),
        canalVerification,
        expectedContact: null,
        actualContact,
        targetLabel: 'demandeur',
        permisId,
        permisCode: null,
      };
    }

    const targetLabel =
      qualiteDemandeur === 'REPRESENTANT'
        ? 'representant legal'
        : qualiteDemandeur === 'ACTIONNAIRE'
          ? 'actionnaire'
          : 'titulaire';

    const detenteurId = permis.detenteur?.id_detenteur ?? null;

    let expectedContact = '';
    if (qualiteDemandeur === 'REPRESENTANT') {
      if (!detenteurId) {
        return {
          valid: false,
          message: 'Ce permis ne possède pas de détenteur pour verifier le representant legal.',
          qualiteDemandeur: String(body.qualiteDemandeur || '').trim(),
          canalVerification,
          expectedContact: null,
          actualContact,
          targetLabel,
          permisId: permis.id,
          permisCode: permis.code_permis ?? null,
        };
      }

      const representant = await this.prisma.fonctionPersonneMoral.findFirst({
        where: {
          id_detenteur: detenteurId,
          type_fonction: EnumTypeFonction.Representant,
        },
        select: {
          personne: {
            select: {
              nomFR: true,
              prenomFR: true,
              email: true,
              telephone: true,
            },
          },
        },
      });

      expectedContact =
        canalVerification === CanalVerificationCadastre.EMAIL
          ? this.normalizeEmail(representant?.personne?.email)
          : this.normalizePhone(representant?.personne?.telephone);

      if (!expectedContact) {
        return {
          valid: false,
          message:
            canalVerification === CanalVerificationCadastre.EMAIL
              ? 'Aucun email du representant legal n\'est renseigne pour ce permis.'
              : 'Aucun numero de telephone du representant legal n\'est renseigne pour ce permis.',
          qualiteDemandeur: String(body.qualiteDemandeur || '').trim(),
          canalVerification,
          expectedContact: null,
          actualContact,
          targetLabel,
          permisId: permis.id,
          permisCode: permis.code_permis ?? null,
        };
      }
    } else if (qualiteDemandeur === 'ACTIONNAIRE') {
      if (!detenteurId) {
        return {
          valid: false,
          message: 'Ce permis ne possède pas de détenteur pour verifier les actionnaires.',
          qualiteDemandeur: String(body.qualiteDemandeur || '').trim(),
          canalVerification,
          expectedContact: null,
          actualContact,
          targetLabel,
          permisId: permis.id,
          permisCode: permis.code_permis ?? null,
        };
      }

      const actionnaires = await this.prisma.fonctionPersonneMoral.findMany({
        where: {
          id_detenteur: detenteurId,
          type_fonction: EnumTypeFonction.Actionnaire,
        },
        select: {
          personne: {
            select: {
              nomFR: true,
              prenomFR: true,
              email: true,
              telephone: true,
            },
          },
        },
      });

      const expectedContacts =
        canalVerification === CanalVerificationCadastre.EMAIL
          ? actionnaires
              .map((row) => this.normalizeEmail(row.personne?.email))
              .filter(Boolean)
          : actionnaires
              .map((row) => this.normalizePhone(row.personne?.telephone))
              .filter(Boolean);

      if (expectedContacts.length === 0) {
        return {
          valid: false,
          message:
            canalVerification === CanalVerificationCadastre.EMAIL
              ? 'Aucun email d\'actionnaire n\'est renseigne pour ce permis.'
              : 'Aucun numero de telephone d\'actionnaire n\'est renseigne pour ce permis.',
          qualiteDemandeur: String(body.qualiteDemandeur || '').trim(),
          canalVerification,
          expectedContact: null,
          actualContact,
          targetLabel,
          permisId: permis.id,
          permisCode: permis.code_permis ?? null,
        };
      }

      expectedContact = expectedContacts.includes(actualContact) ? actualContact : expectedContacts[0];
    } else {
      expectedContact =
        canalVerification === CanalVerificationCadastre.EMAIL
          ? this.normalizeEmail(permis.detenteur?.email)
          : this.normalizePhone(permis.detenteur?.telephone);

      if (!expectedContact) {
        return {
          valid: false,
          message:
            canalVerification === CanalVerificationCadastre.EMAIL
              ? 'Aucun email du titulaire n\'est renseigne pour ce permis.'
              : 'Aucun numero de telephone du titulaire n\'est renseigne pour ce permis.',
          qualiteDemandeur: String(body.qualiteDemandeur || '').trim(),
          canalVerification,
          expectedContact: null,
          actualContact,
          targetLabel,
          permisId: permis.id,
          permisCode: permis.code_permis ?? null,
        };
      }
    }

    if (!actualContact) {
      return {
        valid: false,
        message:
          canalVerification === CanalVerificationCadastre.EMAIL
            ? `Veuillez saisir l'email de ${targetLabel}.`
            : `Veuillez saisir le numero de telephone de ${targetLabel}.`,
        qualiteDemandeur: String(body.qualiteDemandeur || '').trim(),
        canalVerification,
        expectedContact,
        actualContact,
        targetLabel,
        permisId: permis.id,
        permisCode: permis.code_permis ?? null,
      };
    }

    const matches = expectedContact === actualContact;
    if (!matches) {
      return {
        valid: false,
        message:
          canalVerification === CanalVerificationCadastre.EMAIL
            ? `Cet email est different de celui du ${targetLabel}.`
            : `Ce numero de telephone est different de celui du ${targetLabel}.`,
        qualiteDemandeur: String(body.qualiteDemandeur || '').trim(),
        canalVerification,
        expectedContact,
        actualContact,
        targetLabel,
        permisId: permis.id,
        permisCode: permis.code_permis ?? null,
      };
    }

    return {
      valid: true,
      message:
        canalVerification === CanalVerificationCadastre.EMAIL
          ? `L'email correspond au ${targetLabel}.`
          : `Le numero de telephone correspond au ${targetLabel}.`,
      qualiteDemandeur: String(body.qualiteDemandeur || '').trim(),
      canalVerification,
      expectedContact,
      actualContact,
      targetLabel,
      permisId: permis.id,
      permisCode: permis.code_permis ?? null,
    };
  }

  private async assertOtpContactValidation(body: CreateCadastreRequestBody) {
    const validation = await this.buildOtpContactValidation(body);
    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }
    return validation;
  }

  private getCadastreDemandDirectory(demandeId: number) {
    return path.join(
      process.cwd(),
      'public',
      'uploads',
      'cadastre',
      'demandes',
      String(demandeId),
    );
  }

  private sanitizeFilenameSegment(value: string, fallback = 'document') {
    const raw = String(value || '').trim();
    const safe = (raw || fallback)
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return safe || fallback;
  }

  private normalizePdfText(value: unknown, fallback = '—') {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    return text || fallback;
  }

  private formatFrenchDate(value?: Date | string | null) {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('fr-DZ');
  }

  private formatFrenchDateTime(value?: Date | string | null) {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.toLocaleDateString('fr-DZ')} à ${date.toLocaleTimeString('fr-DZ', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  private wrapPdfText(
    text: string,
    font: any,
    fontSize: number,
    maxWidth: number,
  ) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return [''];
    }

    const words = normalized.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const testLine = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width <= maxWidth) {
        current = testLine;
        continue;
      }

      if (current) {
        lines.push(current);
      }
      current = word;
    }

    if (current) {
      lines.push(current);
    }

    return lines.length > 0 ? lines : [normalized];
  }

  private isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private getMailer() {
    if (this.mailer) return this.mailer;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const tlsServername =
      process.env.SMTP_TLS_SERVERNAME || (!isIP(host || '') ? host : undefined);
    const rejectUnauthorized =
      (process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';

    if (!host || !user || !pass) {
      throw new HttpException(
        'SMTP non configure pour l\'envoi OTP cadastre.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.mailer = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      allowInternalNetworkInterfaces: true,
      tls: {
        rejectUnauthorized,
        ...(tlsServername ? { servername: tlsServername } : {}),
      },
    } as any);

    return this.mailer;
  }

  private async sendOtpEmail(
    email: string,
    prenom: string | null | undefined,
    code: string,
    referenceDemande: string,
  ) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || '';
    const name = prenom || 'Utilisateur';
    const portalUrl = (process.env.PORTAIL_URL || 'https://pom.anam.dz').trim();
    const supportEmail = (process.env.SUPPORT_EMAIL || 'support@anam.dz').trim();
    const subject = `Code OTP demande cadastrale ${referenceDemande}`;
    const text = [
      `Bonjour ${name},`,
      '',
      `Votre code OTP pour la demande ${referenceDemande} est: ${code}`,
      '',
      'Ce code est valable 10 minutes.',
      'Ne le partagez avec personne.',
      '',
      `Portail: ${portalUrl}`,
      `Support: ${supportEmail}`,
    ].join('\n');

    const html = `
      <div style="margin:0;padding:0;background:#f3f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7fb;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 24px 8px 24px;">
                    <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;color:#0f172a;">Verification de votre demande cadastrale</h1>
                    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.7;">Bonjour ${name},</p>
                    <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;">
                      Voici votre code OTP pour la demande <strong>${referenceDemande}</strong>.
                    </p>
                    <div style="text-align:center;margin:18px 0 20px 0;">
                      <div style="display:inline-block;letter-spacing:6px;font-size:28px;font-weight:800;color:#14532d;background:#ecfdf5;border:1px solid #cdeed8;border-radius:12px;padding:14px 18px;">
                        ${code}
                      </div>
                    </div>
                    <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#475569;">
                      Ce code est valable <strong>10 minutes</strong>. Ne le partagez avec personne.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 24px 24px;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                      <a href="${portalUrl}" style="color:#1d4ed8;text-decoration:none;">${portalUrl}</a>
                      &nbsp;|&nbsp;
                      <a href="mailto:${supportEmail}" style="color:#1d4ed8;text-decoration:none;">${supportEmail}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    await this.getMailer().sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
  }

  private async sendOtpPhoneFallback(
    telephone: string,
    code: string,
    referenceDemande: string,
    emailFallback?: string | null,
  ) {
    if (emailFallback && this.isValidEmail(emailFallback)) {
      await this.sendOtpEmail(emailFallback, null, code, referenceDemande);
      return {
        channel: 'EMAIL' as const,
        fallbackUsed: true,
        telephone,
      };
    }

    throw new HttpException(
      'Le canal telephone requiert un service SMS ou un email de secours valide.',
      HttpStatus.BAD_REQUEST,
    );
  }

  private async requireCadastreSession(req: any) {
    const token = this.extractAuthToken(req);
    if (!token) {
      throw new UnauthorizedException('Non authentifie');
    }

    const session = await this.sessionService.validateSession(token);
    const user = session?.user as CadastreSessionUser | undefined;
    const userId = user?.id ?? session?.userId ?? null;
    if (!user || !userId) {
      throw new UnauthorizedException('Session invalide');
    }

    const roleName = String(user?.role?.name || '').toLowerCase();
    const hasCadastrePermission = Array.isArray(user?.role?.rolePermissions)
      ? user.role.rolePermissions.some((rp) =>
          String(rp?.permission?.name || '').toLowerCase().includes('cadastre'),
        )
      : false;

    if (
      !roleName.includes('cadastre') &&
      !roleName.includes('admin') &&
      !roleName.includes('administrateur') &&
      !hasCadastrePermission
    ) {
      throw new ForbiddenException('Acces refuse');
    }

    return {
      userId: Number(userId),
      user,
      roleName,
    };
  }

  private async resolvePermisId(payload: CreateCadastreRequestBody) {
    const explicitPermisId = Number(payload.permisId);
    const qrCode = this.normalizeLabel(payload.qrCodeTitre);
    const codePermis = this.normalizeLabel(payload.codePermis);
    const typePermisValue = this.normalizeLabel(payload.typePermis);

    if (!qrCode || !codePermis || !typePermisValue) {
      throw new BadRequestException(
        'Le code QR, le code permis et le type de permis sont requis pour identifier le titre.',
      );
    }

    const typePermisId = await this.resolveTypePermisId(typePermisValue);

    if (Number.isFinite(explicitPermisId) && explicitPermisId > 0) {
      const permis = await this.prisma.permisPortail.findUnique({
        where: { id: explicitPermisId },
        select: {
          id: true,
          qr_code: true,
          code_permis: true,
          id_typePermis: true,
        },
      });

      if (!permis) {
        throw new NotFoundException('Permis introuvable.');
      }

      const matchesQr = this.normalizeLabel(permis.qr_code).toLowerCase() === qrCode.toLowerCase();
      const matchesCode =
        this.normalizeLabel(permis.code_permis).toLowerCase() === codePermis.toLowerCase();
      const matchesType = Number(permis.id_typePermis) === Number(typePermisId);

      if (!matchesQr || !matchesCode || !matchesType) {
        throw new BadRequestException(
          'Le permis fourni ne correspond pas au code QR, au code permis et au type de permis saisis.',
        );
      }

      return permis.id;
    }

    const permis = await this.prisma.permisPortail.findFirst({
      where: {
        qr_code: { equals: qrCode, mode: 'insensitive' },
        code_permis: { equals: codePermis, mode: 'insensitive' },
        id_typePermis: typePermisId,
      },
      select: { id: true },
    });

    if (!permis) {
      throw new NotFoundException(
        'Aucun permis ne correspond simultanement au code QR, au code permis et au type de permis fournis.',
      );
    }

    return permis.id;
  }

  async getWorkflowReferences(): Promise<CadastreWorkflowReferencesResponse> {
    const [documents, verificationChannels] = await Promise.all([
      this.prisma.$queryRaw<CadastreDocumentReference[]>`
        SELECT
          "id",
          "code",
          "label",
          "subtitle",
          "description",
          "iconKey",
          "accentKey",
          "isDefault",
          "sortOrder"
        FROM "cadastre_document_references"
        WHERE "isActive" = TRUE
        ORDER BY "isDefault" DESC, "sortOrder" ASC, "label" ASC
      `,
      this.prisma.$queryRaw<CadastreVerificationReference[]>`
        SELECT
          "id",
          "code",
          "label",
          "description",
          "iconKey",
          "isDefault",
          "sortOrder"
        FROM "cadastre_verification_references"
        WHERE "isActive" = TRUE
        ORDER BY "isDefault" DESC, "sortOrder" ASC, "label" ASC
      `,
    ]);

    return { documents, verificationChannels };
  }

  private async normalizeTypeDocument(value?: string | null) {
    const normalized = String(value || '').trim().toUpperCase();
    const fallback = await this.prisma.$queryRaw<Array<{ code: string }>>`
      SELECT "code"
      FROM "cadastre_document_references"
      WHERE "isActive" = TRUE
      ORDER BY "isDefault" DESC, "sortOrder" ASC, "label" ASC
      LIMIT 1
    `;

    if (!normalized) {
      if (fallback[0]?.code) {
        return fallback[0].code as TypeDocumentCadastral;
      }
      throw new BadRequestException(
        'Aucun type de document cadastral n\'est configure.',
      );
    }

    const activeMatch = await this.prisma.$queryRaw<Array<{ code: string }>>`
      SELECT "code"
      FROM "cadastre_document_references"
      WHERE "code" = ${normalized}
        AND "isActive" = TRUE
      LIMIT 1
    `;

    if (activeMatch[0]?.code) {
      return activeMatch[0].code as TypeDocumentCadastral;
    }

    const anyMatch = await this.prisma.$queryRaw<Array<{ code: string }>>`
      SELECT "code"
      FROM "cadastre_document_references"
      WHERE "code" = ${normalized}
      LIMIT 1
    `;

    if (anyMatch[0]?.code) {
      return anyMatch[0].code as TypeDocumentCadastral;
    }

    throw new BadRequestException(
      `Type de document cadastral invalide: ${normalized}.`,
    );
  }

  private async normalizeCanal(value?: string | null) {
    const normalized = String(value || '').trim().toUpperCase();
    const fallback = await this.prisma.$queryRaw<Array<{ code: string }>>`
      SELECT "code"
      FROM "cadastre_verification_references"
      WHERE "isActive" = TRUE
      ORDER BY "isDefault" DESC, "sortOrder" ASC, "label" ASC
      LIMIT 1
    `;

    if (!normalized) {
      if (fallback[0]?.code) {
        return fallback[0].code as CanalVerificationCadastre;
      }
      throw new BadRequestException(
        'Aucun canal de verification cadastral n\'est configure.',
      );
    }

    const activeMatch = await this.prisma.$queryRaw<Array<{ code: string }>>`
      SELECT "code"
      FROM "cadastre_verification_references"
      WHERE "code" = ${normalized}
        AND "isActive" = TRUE
      LIMIT 1
    `;

    if (activeMatch[0]?.code) {
      return activeMatch[0].code as CanalVerificationCadastre;
    }

    const anyMatch = await this.prisma.$queryRaw<Array<{ code: string }>>`
      SELECT "code"
      FROM "cadastre_verification_references"
      WHERE "code" = ${normalized}
      LIMIT 1
    `;

    if (anyMatch[0]?.code) {
      return anyMatch[0].code as CanalVerificationCadastre;
    }

    throw new BadRequestException(
      `Canal de verification cadastral invalide: ${normalized}.`,
    );
  }

  private async assertOwnershipOrAdmin(demandeId: number, user: CadastreSessionUser) {
    const demande = await this.prisma.demandeDocumentCadastral.findUnique({
      where: { id: demandeId },
      select: {
        id: true,
        utilisateurId: true,
        referenceDemande: true,
      },
    });

    if (!demande) {
      throw new NotFoundException('Demande cadastrale introuvable.');
    }

    const roleName = String(user?.role?.name || '').toLowerCase();
    const isAdmin =
      roleName.includes('admin') || roleName.includes('administrateur');
    if (!isAdmin && Number(demande.utilisateurId) !== Number(user.id)) {
      throw new ForbiddenException('Acces refuse');
    }

    return demande;
  }

  private async recordHistory(
    demandeId: number,
    action: ActionDocumentCadastral,
    detailsCommunication?: string,
  ) {
    await this.prisma.historiqueDemandeDocument.create({
      data: {
        demandeId,
        action,
        detailsCommunication: detailsCommunication || null,
      },
    });
  }

  private mapDemand(demande: any) {
    return {
      ...demande,
      emailContact: demande.emailContact || null,
      telephoneContact: demande.telephoneContact || null,
      otpHash: undefined,
      piecesJointes: Array.isArray(demande.piecesJointes) ? demande.piecesJointes : [],
      historique: Array.isArray(demande.historique) ? demande.historique : [],
    };
  }

  private async buildAccuseReceptionPdf(demande: any) {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const PAGE_W = 595;
    const PAGE_H = 842;
    const BORDER_X = 20;
    const BORDER_Y = 20;
    const BORDER_W = PAGE_W - BORDER_X * 2;
    const BORDER_H = PAGE_H - BORDER_Y * 2;
    const CONTENT_X = BORDER_X + 5;
    const CONTENT_W = BORDER_W - 10;
    const LABEL_W = 130;
    const VALUE_W = CONTENT_W - LABEL_W - 2;
    const BLUE = rgb(25 / 255, 71 / 255, 106 / 255);
    const BLUE_DARK = rgb(30 / 255, 53 / 255, 73 / 255);
    const GREY = rgb(88 / 255, 97 / 255, 106 / 255);

    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({
      x: BORDER_X,
      y: BORDER_Y,
      width: BORDER_W,
      height: BORDER_H,
      color: rgb(1, 1, 1),
      borderColor: BLUE,
      borderWidth: 0.6,
    });

    const centerX = PAGE_W / 2;
    const drawCenteredText = (
      text: string,
      y: number,
      size: number,
      useBold = false,
      color = BLUE_DARK,
    ) => {
      const selectedFont = useBold ? fontBold : font;
      const width = selectedFont.widthOfTextAtSize(text, size);
      page.drawText(text, {
        x: centerX - width / 2,
        y,
        size,
        font: selectedFont,
        color,
      });
    };

    const drawLabelValue = (label: string, value: string, y: number) => {
      const cleanValue = this.normalizePdfText(value);
      const valueLines = this.wrapPdfText(cleanValue, font, 8.4, VALUE_W);
      const lineHeight = 11.8;
      page.drawText(`${this.normalizePdfText(label)} :`, {
        x: CONTENT_X,
        y,
        size: 8.4,
        font: fontBold,
        color: BLUE_DARK,
      });
      valueLines.forEach((line, index) => {
        page.drawText(line, {
          x: CONTENT_X + LABEL_W,
          y: y - index * lineHeight,
          size: 8.4,
          font,
          color: BLUE_DARK,
        });
      });
      return Math.max(14, valueLines.length * lineHeight + 6.5);
    };

    const piecesJointes = Array.isArray(demande?.piecesJointes) ? demande.piecesJointes : [];
    const submitDate = demande?.dateSoumission || demande?.updatedAt || demande?.createdAt || new Date();
    const horodatage = this.formatFrenchDateTime(new Date());
    const dateDepot = this.formatFrenchDateTime(submitDate);
    const referenceAccuse = this.normalizePdfText(demande?.referenceDemande);
    const codeDemande = this.normalizePdfText(`CDC-${String(demande?.id ?? Date.now()).padStart(6, '0')}`);
    const titulaire = this.normalizePdfText(demande?.titulaire);
    const numeroRc = this.normalizePdfText(demande?.numeroRc);
    const codeQr = this.normalizePdfText(demande?.qrCodeTitre);
    const codePermis = this.normalizePdfText(demande?.codePermis);
    const typePermis = this.normalizePdfText(demande?.typePermis);
    const nin = this.normalizePdfText(demande?.nin);
    const deposant = this.normalizePdfText(
      `${demande?.prenom || ''} ${demande?.nom || ''}`.trim() ||
        demande?.titulaire ||
        demande?.emailContact ||
        demande?.telephoneContact,
    );
    const canalVerification = this.normalizePdfText(
      demande?.canalVerification === CanalVerificationCadastre.TELEPHONE ? 'Telephone' : 'Email',
    );
    const contactVerification = this.normalizePdfText(
      demande?.canalVerification === CanalVerificationCadastre.TELEPHONE
        ? demande?.telephoneContact
        : demande?.emailContact,
    );
    const qualiteDemandeur = this.normalizePdfText(demande?.qualiteDemandeur);
    const objetDemande = this.normalizePdfText(demande?.objetDemande);
    const baseCommunication = this.normalizePdfText(demande?.baseCommunication);
    const piecesCount = piecesJointes.length;

    drawCenteredText('REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE', 807, 8.7, true);
    drawCenteredText("MINISTERE DE L'ENERGIE ET DES MINES", 798, 8.4, true);
    drawCenteredText('AGENCE NATIONALE DES ACTIVITES MINIERES (ANAM)', 789, 8.1, true);
    page.drawLine({
      start: { x: BORDER_X + 3, y: 783.5 },
      end: { x: PAGE_W - BORDER_X - 3, y: 783.5 },
      color: BLUE,
      thickness: 0.6,
    });
    drawCenteredText('ACCUSE DE RECEPTION HORODATE', 762, 13, true, BLUE_DARK);
    drawCenteredText('Document de preuve du depot enregistre dans le systeme ANAM', 749.5, 8, false, GREY);

    let y = 742;
    page.drawText('Informations du depot', {
      x: CONTENT_X,
      y,
      size: 10.2,
      font: fontBold,
      color: BLUE,
    });
    page.drawLine({
      start: { x: CONTENT_X, y: y - 1.8 },
      end: { x: CONTENT_X + CONTENT_W, y: y - 1.8 },
      color: BLUE,
      thickness: 0.6,
    });
    y -= 12;

    const rows: Array<[string, string]> = [
      ['Reference accuse', referenceAccuse],
      ['Code demande', codeDemande],
      ['Horodatage systeme', horodatage],
      ['Date et heure de depot', dateDepot],
      ['Titulaire', titulaire],
      ['Numero de registre de commerce', numeroRc],
      ['Code QR du titre', codeQr],
      ['Code permis', codePermis],
      ['Type de permis', typePermis],
      ['NIN', nin],
      ['Nom et prenom', deposant],
      ['Canal de verification', canalVerification],
      ['Contact de verification', contactVerification],
      ['Qualite du demandeur', qualiteDemandeur],
      ['Objet de la demande', objetDemande],
      ['Base de communication', baseCommunication],
      ['Nombre de pieces remises', String(piecesCount)],
      ['Agent recepteur', 'Systeme ANAM'],
    ];

    rows.forEach(([label, value]) => {
      y -= drawLabelValue(label, value, y);
    });

    page.drawText(
      `Document officiel genere automatiquement le ${this.formatFrenchDateTime(new Date())}`,
      {
        x: BORDER_X + 6,
        y: 28,
        size: 7.2,
        font,
        color: GREY,
      },
    );
    const footerRight = 'ANAM - Registre numerique des demandes';
    page.drawText(footerRight, {
      x: PAGE_W - BORDER_X - 6 - font.widthOfTextAtSize(footerRight, 7.2),
      y: 28,
      size: 7.2,
      font,
      color: GREY,
    });

    const buffer = Buffer.from(await pdfDoc.save());
    const filename = `accuse-reception-${this.sanitizeFilenameSegment(
      demande?.referenceDemande || `demande-${demande?.id || Date.now()}`,
    )}.pdf`;
    const outputDir = this.getCadastreDemandDirectory(Number(demande.id));
    fs.mkdirSync(outputDir, { recursive: true });
    const absolutePath = path.join(outputDir, filename);
    fs.writeFileSync(absolutePath, buffer);

    return {
      buffer,
      filename,
      absolutePath,
      fileUrl: `/uploads/cadastre/demandes/${demande.id}/${filename}`,
    };

    if (false) {

    const PAGE_W = 595;
    const PAGE_H = 842;
    const MARGIN_X = 42;
    const MARGIN_BOTTOM = 54;
    const CONTENT_W = PAGE_W - MARGIN_X * 2;
    const HEADER_H = 112;
    const FOOTER_H = 32;

    const COLORS = {
      header: rgb(0.09, 0.38, 0.21),
      headerDark: rgb(0.06, 0.28, 0.16),
      accent: rgb(0.05, 0.48, 0.3),
      border: rgb(0.84, 0.88, 0.92),
      panel: rgb(0.98, 0.99, 1),
      text: rgb(0.11, 0.15, 0.22),
      muted: rgb(0.41, 0.46, 0.54),
      light: rgb(0.95, 0.98, 0.96),
      gold: rgb(0.76, 0.58, 0.16),
    };

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let pageNumber = 1;
    let cursorY = PAGE_H - HEADER_H - 30;

    const drawChrome = () => {
      page.drawRectangle({
        x: 0,
        y: PAGE_H - HEADER_H,
        width: PAGE_W,
        height: HEADER_H,
        color: COLORS.header,
      });
      page.drawRectangle({
        x: PAGE_W - 152,
        y: PAGE_H - 78,
        width: 110,
        height: 28,
        color: rgb(1, 1, 1),
        borderColor: COLORS.gold,
        borderWidth: 1,
      });
      page.drawText('ANAM CADASTRE', {
        x: PAGE_W - 139,
        y: PAGE_H - 68,
        size: 8,
        font: fontBold,
        color: COLORS.headerDark,
      });
      page.drawText('ACCUSE DE RECEPTION', {
        x: MARGIN_X,
        y: PAGE_H - 54,
        size: 9,
        font,
        color: rgb(0.9, 0.96, 0.92),
      });
      page.drawText('Accusé de réception de demande cadastrale', {
        x: MARGIN_X,
        y: PAGE_H - 82,
        size: 18,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      page.drawText(
        'Ce document atteste l’enregistrement de votre demande dans le registre cadastral numérique.',
        {
          x: MARGIN_X,
          y: PAGE_H - 98,
          size: 8.4,
          font,
          color: rgb(0.92, 0.97, 0.94),
        },
      );

      page.drawLine({
        start: { x: MARGIN_X, y: FOOTER_H + 12 },
        end: { x: PAGE_W - MARGIN_X, y: FOOTER_H + 12 },
        color: COLORS.border,
        thickness: 1,
      });
      page.drawText('Document généré automatiquement par le système cadastre ANAM', {
        x: MARGIN_X,
        y: 16,
        size: 7.5,
        font,
        color: COLORS.muted,
      });
      page.drawText(`Page ${pageNumber}`, {
        x: PAGE_W - MARGIN_X - 36,
        y: 16,
        size: 7.5,
        font,
        color: COLORS.muted,
      });
    };

    const startPage = () => {
      if (pageNumber > 1) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      }
      drawChrome();
      cursorY = PAGE_H - HEADER_H - 28;
      pageNumber += 1;
    };

    const ensureSpace = (heightNeeded: number) => {
      if (cursorY - heightNeeded < MARGIN_BOTTOM) {
        startPage();
      }
    };

    const drawSectionTitle = (title: string) => {
      ensureSpace(24);
      page.drawText(title.toUpperCase(), {
        x: MARGIN_X,
        y: cursorY,
        size: 9.5,
        font: fontBold,
        color: COLORS.headerDark,
      });
      page.drawLine({
        start: { x: MARGIN_X, y: cursorY - 6 },
        end: { x: PAGE_W - MARGIN_X, y: cursorY - 6 },
        color: COLORS.border,
        thickness: 1,
      });
      cursorY -= 18;
    };

    const drawParagraph = (text: string, size = 10.5, gapAfter = 8) => {
      const lines = this.wrapPdfText(text, font, size, CONTENT_W);
      const lineHeight = size + 3.8;
      ensureSpace(lines.length * lineHeight + gapAfter + 2);
      for (const line of lines) {
        page.drawText(line, {
          x: MARGIN_X,
          y: cursorY,
          size,
          font,
          color: COLORS.text,
        });
        cursorY -= lineHeight;
      }
      cursorY -= gapAfter;
    };

    const drawInfoGrid = (
      items: Array<{ label: string; value: string }>,
    ) => {
      const gap = 12;
      const colW = (CONTENT_W - gap) / 2;
      for (let index = 0; index < items.length; index += 2) {
        const rowItems = items.slice(index, index + 2);
        const rowLayout = rowItems.map((item) => {
          const valueLines = this.wrapPdfText(
            item.value,
            fontBold,
            10.3,
            colW - 22,
          );
          return {
            item,
            valueLines,
            height: Math.max(48, 26 + valueLines.length * 12),
          };
        });

        const rowHeight = Math.max(...rowLayout.map((entry) => entry.height));
        ensureSpace(rowHeight + 12);

        rowLayout.forEach((entry, idx) => {
          const x = MARGIN_X + idx * (colW + gap);
          const y = cursorY - rowHeight;
          page.drawRectangle({
            x,
            y,
            width: colW,
            height: rowHeight,
            color: COLORS.panel,
            borderColor: COLORS.border,
            borderWidth: 1,
          });
          page.drawText(entry.item.label.toUpperCase(), {
            x: x + 10,
            y: cursorY - 14,
            size: 7.1,
            font,
            color: COLORS.muted,
          });
          entry.valueLines.forEach((line, lineIndex) => {
            page.drawText(line, {
              x: x + 10,
              y: cursorY - 30 - lineIndex * 12,
              size: 10.2,
              font: lineIndex === 0 ? fontBold : font,
              color: COLORS.text,
            });
          });
        });

        cursorY -= rowHeight + 12;
      }
    };

    const drawBulletList = (items: string[]) => {
      ensureSpace(items.length * 18 + 10);
      items.forEach((item) => {
        const lines = this.wrapPdfText(item, font, 10.4, CONTENT_W - 20);
        const lineHeight = 12.4;
        page.drawCircle({
          x: MARGIN_X + 4,
          y: cursorY - 4,
          size: 3.3,
          color: COLORS.accent,
        });
        lines.forEach((line, index) => {
          page.drawText(line, {
            x: MARGIN_X + 14,
            y: cursorY - index * lineHeight,
            size: 10.4,
            font,
            color: COLORS.text,
          });
        });
        cursorY -= lines.length * lineHeight + 6;
      });
    };

    startPage();

    const piecesJointes = Array.isArray(demande?.piecesJointes)
      ? demande.piecesJointes
      : [];
    const selectedDocLabel = this.normalizePdfText(
      demande?.typeDocument === TypeDocumentCadastral.PLAN_CADASTRAL_OFFICIEL
        ? 'Plan cadastral officiel'
        : 'Extrait cadastral officiel',
    );
    const submitDate = demande?.dateSoumission || demande?.updatedAt || demande?.createdAt || new Date();
    const receiptDate = this.formatFrenchDateTime(submitDate);
    const verificationDate = this.formatFrenchDateTime(demande?.otpVerifiedAt);
    const verificationChannel = this.normalizePdfText(
      demande?.canalVerification === CanalVerificationCadastre.TELEPHONE
        ? 'Téléphone'
        : 'Email',
    );
    const contactValue =
      demande?.canalVerification === CanalVerificationCadastre.TELEPHONE
        ? this.normalizePdfText(demande?.telephoneContact)
        : this.normalizePdfText(demande?.emailContact);

    drawInfoGrid([
      { label: 'Référence de la demande', value: this.normalizePdfText(demande?.referenceDemande) },
      { label: 'Statut', value: 'Demande enregistrée' },
      { label: 'Date de réception', value: receiptDate },
      { label: 'Date de vérification OTP', value: verificationDate },
      { label: 'Type de document demandé', value: selectedDocLabel },
      { label: 'Canal de vérification', value: verificationChannel },
    ]);

    drawSectionTitle('Identité du demandeur');
    drawInfoGrid([
      { label: 'Titulaire', value: this.normalizePdfText(demande?.titulaire) },
      { label: 'Numéro de registre de commerce', value: this.normalizePdfText(demande?.numeroRc) },
      { label: 'Code QR du titre', value: this.normalizePdfText(demande?.qrCodeTitre) },
      { label: 'Code permis', value: this.normalizePdfText(demande?.codePermis) },
      { label: 'Type de permis', value: this.normalizePdfText(demande?.typePermis) },
      { label: 'Contact de vérification', value: contactValue },
      { label: 'NIN', value: this.normalizePdfText(demande?.nin) },
      { label: 'Nom et prénom', value: this.normalizePdfText(`${demande?.prenom || ''} ${demande?.nom || ''}`) },
    ]);

    drawSectionTitle('Dossier transmis');
    drawBulletList([
      `Scan du titre minier : ${piecesJointes.some((piece: any) => piece.typePiece === TypePieceCadastre.SCAN_TITRE) ? 'reçu' : 'non trouvé'}.`,
      `Scan de la carte d'identité : ${piecesJointes.some((piece: any) => piece.typePiece === TypePieceCadastre.SCAN_CARTE_IDENTITE) ? 'reçu' : 'non trouvé'}.`,
      `Objet de la demande : ${this.normalizePdfText(demande?.objetDemande)}`,
      `Qualité du demandeur : ${this.normalizePdfText(demande?.qualiteDemandeur)}`,
    ]);

    drawSectionTitle('Base de communication');
    drawParagraph(this.normalizePdfText(demande?.baseCommunication), 10.4, 6);

    drawParagraph(
      'Ce document confirme que votre demande cadastrale a été correctement enregistrée. Conservez cet accusé de réception pour vos suivis ultérieurs.',
      10.2,
      0,
    );

    const buffer = Buffer.from(await pdfDoc.save());
    const filename = `accuse-reception-${this.sanitizeFilenameSegment(
      demande?.referenceDemande || `demande-${demande?.id || Date.now()}`,
    )}.pdf`;
    const outputDir = this.getCadastreDemandDirectory(Number(demande.id));
    fs.mkdirSync(outputDir, { recursive: true });
    const absolutePath = path.join(outputDir, filename);
    fs.writeFileSync(absolutePath, buffer);

    return {
      buffer,
      filename,
      absolutePath,
      fileUrl: `/uploads/cadastre/demandes/${demande.id}/${filename}`,
    };
    }
  }

  private async persistAccuseReceptionPdf(demande: any) {
    const receipt = await this.buildAccuseReceptionPdf(demande);

    await this.prisma.demandeDocumentCadastral.update({
      where: { id: Number(demande.id) },
      data: {
        accuseReceptionPdfUrl: receipt.fileUrl,
        accuseReceptionPdfFilename: receipt.filename,
        accuseReceptionGeneratedAt: new Date(),
      },
    });

    return receipt;
  }

  private async ensureAccuseReceptionPdf(demandeId: number, user?: CadastreSessionUser) {
    const demande = await this.prisma.demandeDocumentCadastral.findUnique({
      where: { id: demandeId },
      include: {
        piecesJointes: true,
        historique: true,
        documentsGeneres: true,
      },
    });

    if (!demande) {
      throw new NotFoundException('Demande cadastrale introuvable.');
    }

    if (user) {
      const roleName = String(user?.role?.name || '').toLowerCase();
      const isAdmin =
        roleName.includes('admin') || roleName.includes('administrateur');
      if (!isAdmin && Number(demande.utilisateurId) !== Number(user.id)) {
        throw new ForbiddenException('Acces refuse');
      }
    }

    const existingPath =
      demande.accuseReceptionPdfFilename &&
      path.join(this.getCadastreDemandDirectory(demande.id), demande.accuseReceptionPdfFilename);

    if (existingPath && fs.existsSync(existingPath)) {
      return {
        absolutePath: existingPath,
        filename: demande.accuseReceptionPdfFilename,
        fileUrl: demande.accuseReceptionPdfUrl || `/uploads/cadastre/demandes/${demande.id}/${demande.accuseReceptionPdfFilename}`,
      };
    }

    return this.persistAccuseReceptionPdf(demande);
  }

  async createRequest(body: CreateCadastreRequestBody, req: any) {
    const session = await this.requireCadastreSession(req);

    const titulaire = String(body.titulaire || '').trim();
    const qrCodeTitre = String(body.qrCodeTitre || '').trim();
    const codePermis = String(body.codePermis || '').trim();
    const numeroRc = String(body.numeroRc || '').trim();
    const typePermis = String(body.typePermis || '').trim();
    const nin = String(body.nin || '').trim();
    const nom = String(body.nom || '').trim();
    const prenom = String(body.prenom || '').trim();
    const emailContact = this.normalizeEmail(body.emailContact);
    const telephoneContact = this.normalizePhone(body.telephoneContact);
    const canalVerification = await this.normalizeCanal(body.canalVerification);
    const qualiteDemandeur = String(body.qualiteDemandeur || 'Representant legal').trim();
    const objetDemande = String(body.objetDemande || 'Demande de document cadastral').trim();
    const baseCommunication = String(
      body.baseCommunication ||
        'Demande introduite via le workflow cadastral du portail.',
    ).trim();

    if (!titulaire) {
      throw new BadRequestException('Le titulaire est requis.');
    }
    if (!qrCodeTitre && !codePermis) {
      throw new BadRequestException('Le QR code ou le code permis est requis.');
    }
    if (!nin) {
      throw new BadRequestException('Le NIN est requis.');
    }
    if (!nom) {
      throw new BadRequestException('Le nom est requis.');
    }
    if (!prenom) {
      throw new BadRequestException('Le prenom est requis.');
    }
    if (canalVerification === CanalVerificationCadastre.EMAIL && !emailContact) {
      throw new BadRequestException('L\'email de contact est requis.');
    }
    if (canalVerification === CanalVerificationCadastre.TELEPHONE && !telephoneContact) {
      throw new BadRequestException('Le numero de telephone de contact est requis.');
    }
    if (emailContact && !this.isValidEmail(emailContact)) {
      throw new BadRequestException('Adresse email de contact invalide.');
    }
    if (!typePermis) {
      throw new BadRequestException('Le type de permis est requis.');
    }

    await this.assertOtpContactValidation(body);

    const permisId = await this.resolvePermisId(body);
    const typeDocument = await this.normalizeTypeDocument(body.typeDocument);

    const demande = await this.prisma.$transaction(async (tx) => {
      const created = await tx.demandeDocumentCadastral.create({
        data: {
          referenceDemande: this.generateTemporaryReferenceDemande(),
          utilisateurId: session.userId,
          permisId,
          typeDocument,
          statut: StatutDemandeDocument.ENREGISTREE,
          numeroRc: numeroRc || null,
          titulaire,
          qrCodeTitre: qrCodeTitre || null,
          codePermis: codePermis || null,
          typePermis: typePermis || null,
          nin,
          nom,
          prenom,
          emailContact: emailContact || null,
          telephoneContact: telephoneContact || null,
          canalVerification,
          objetDemande,
          qualiteDemandeur,
          baseCommunication,
        },
      });

      return tx.demandeDocumentCadastral.update({
        where: { id: created.id },
        data: { referenceDemande: this.buildSequentialReferenceDemande(created.id) },
      });
    });
    const referenceDemande = demande.referenceDemande;

    const otpCode = this.generateOtp();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.demandeDocumentCadastral.update({
      where: { id: demande.id },
      data: {
        otpHash,
        otpRequestedAt: new Date(),
        otpExpiresAt,
      },
    });

    if (canalVerification === CanalVerificationCadastre.EMAIL) {
      await this.sendOtpEmail(emailContact, prenom, otpCode, referenceDemande);
    } else {
      await this.sendOtpPhoneFallback(
        telephoneContact,
        otpCode,
        referenceDemande,
        emailContact,
      );
    }

    await this.recordHistory(
      demande.id,
      ActionDocumentCadastral.DEMANDE_ENREGISTREE,
      `Demande creee par ${session.user?.Prenom || 'Utilisateur'} (${session.user?.email || session.user?.id}).`,
    );

    return {
      message: 'Demande cadastrale creee. Le code OTP a ete envoye.',
      demande: await this.getDemandById(demande.id, session.user),
    };
  }

  async validateOtpContact(body: CreateCadastreRequestBody, req: any) {
    await this.requireCadastreSession(req);
    return this.buildOtpContactValidation(body);
  }

  async resendOtp(demandeId: number, req: any) {
    const session = await this.requireCadastreSession(req);
    const demande = await this.assertOwnershipOrAdmin(demandeId, session.user);
    const fullDemand = await this.prisma.demandeDocumentCadastral.findUnique({
      where: { id: demande.id },
    });

    if (!fullDemand) {
      throw new NotFoundException('Demande cadastrale introuvable.');
    }

    const otpCode = this.generateOtp();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.demandeDocumentCadastral.update({
      where: { id: demande.id },
      data: {
        otpHash,
        otpRequestedAt: new Date(),
        otpExpiresAt,
      },
    });

    if (fullDemand.canalVerification === CanalVerificationCadastre.EMAIL) {
      await this.sendOtpEmail(
        fullDemand.emailContact || '',
        fullDemand.prenom,
        otpCode,
        fullDemand.referenceDemande,
      );
    } else {
      await this.sendOtpPhoneFallback(
        fullDemand.telephoneContact || '',
        otpCode,
        fullDemand.referenceDemande,
        fullDemand.emailContact,
      );
    }

    await this.recordHistory(
      demande.id,
      ActionDocumentCadastral.DEMANDE_ENREGISTREE,
      'OTP renvoye au demandeur.',
    );

    return {
      message: 'Code OTP renvoye avec succes.',
    };
  }

  async verifyOtp(demandeId: number, body: VerifyOtpBody, req: any) {
    const session = await this.requireCadastreSession(req);
    const demande = await this.assertOwnershipOrAdmin(demandeId, session.user);

    const fullDemand = await this.prisma.demandeDocumentCadastral.findUnique({
      where: { id: demande.id },
    });
    if (!fullDemand) {
      throw new NotFoundException('Demande cadastrale introuvable.');
    }

    const code = String(body?.code || '').trim();
    if (!code) {
      throw new BadRequestException('Code OTP requis.');
    }

    if (
      !fullDemand.otpHash ||
      !fullDemand.otpExpiresAt ||
      fullDemand.otpExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Le code OTP est expire.');
    }

    const matches = await bcrypt.compare(code, fullDemand.otpHash);
    if (!matches) {
      throw new BadRequestException('Le code OTP est invalide.');
    }

    await this.prisma.demandeDocumentCadastral.update({
      where: { id: demande.id },
      data: {
        statut: StatutDemandeDocument.VERIFIEE,
        otpVerifiedAt: new Date(),
      },
    });

    await this.recordHistory(
      demande.id,
      ActionDocumentCadastral.DEMANDE_VERIFIEE,
      'Verification OTP reussie.',
    );

    return {
      message: 'Verification OTP reussie.',
      demande: await this.getDemandById(demande.id, session.user),
    };
  }

  async uploadPiece(
    demandeId: number,
    typePiece: TypePieceCadastre,
    file: Express.Multer.File,
    req: any,
  ) {
    const session = await this.requireCadastreSession(req);
    const demande = await this.assertOwnershipOrAdmin(demandeId, session.user);
    const fullDemand = await this.prisma.demandeDocumentCadastral.findUnique({
      where: { id: demande.id },
      select: { id: true, otpVerifiedAt: true },
    });

    if (!fullDemand) {
      throw new NotFoundException('Demande cadastrale introuvable.');
    }

    if (!fullDemand.otpVerifiedAt) {
      throw new BadRequestException(
        'La demande doit etre verifiee avant le televersement des pieces jointes.',
      );
    }

    if (!file) {
      throw new BadRequestException('Aucun fichier fourni.');
    }

    const fileUrl = `/uploads/cadastre/demandes/${demande.id}/${file.filename}`;

    await this.prisma.pieceJointeDemandeDocumentCadastral.deleteMany({
      where: {
        demandeId: demande.id,
        typePiece,
      },
    });

    const piece = await this.prisma.pieceJointeDemandeDocumentCadastral.create({
      data: {
        demandeId: demande.id,
        typePiece,
        fichierUrl: fileUrl,
        nomFichierOriginal: file.originalname || null,
        mimeType: file.mimetype || null,
        tailleOctets: Number.isFinite(file.size) ? Math.trunc(file.size) : null,
      },
    });

    await this.recordHistory(
      demande.id,
      ActionDocumentCadastral.DOCUMENT_GENERE,
      `Piece jointe telechargee: ${typePiece}.`,
    );

    return {
      message: 'Piece jointe telechargee avec succes.',
      piece,
    };
  }

  async submitRequest(
    demandeId: number,
    body: SubmitCadastreRequestBody,
    req: any,
  ) {
    const session = await this.requireCadastreSession(req);
    const demande = await this.assertOwnershipOrAdmin(demandeId, session.user);

    const fullDemand = await this.prisma.demandeDocumentCadastral.findUnique({
      where: { id: demande.id },
      include: {
        piecesJointes: true,
        historique: true,
        documentsGeneres: true,
      },
    });
    if (!fullDemand) {
      throw new NotFoundException('Demande cadastrale introuvable.');
    }

    if (!fullDemand.otpVerifiedAt) {
      throw new BadRequestException(
        'La demande doit etre verifiee avant sa soumission finale.',
      );
    }

    const updatedDemand = await this.prisma.demandeDocumentCadastral.update({
      where: { id: demande.id },
      data: {
        statut: StatutDemandeDocument.VERIFIEE,
        dateSoumission: new Date(),
        typeDocument: await this.normalizeTypeDocument(
          body.typeDocument || fullDemand.typeDocument,
        ),
        qualiteDemandeur:
          String(body.qualiteDemandeur || fullDemand.qualiteDemandeur || '').trim() ||
          'Representant legal',
        objetDemande:
          String(body.objetDemande || fullDemand.objetDemande || '').trim() ||
          'Demande de document cadastral',
        baseCommunication:
          String(body.baseCommunication || fullDemand.baseCommunication || '').trim() ||
          'Demande introduite via le workflow cadastral du portail.',
      },
    });

    await this.persistAccuseReceptionPdf({
      ...updatedDemand,
      piecesJointes: fullDemand.piecesJointes,
      historique: fullDemand.historique,
      documentsGeneres: fullDemand.documentsGeneres,
    });

    await this.recordHistory(
      demande.id,
      ActionDocumentCadastral.DOCUMENT_DELIVRE,
      'Demande soumise pour traitement.',
    );

    return {
      message:
        'Votre demande de cadastre a ete bien transmise avec succes. Vous recevrez une notification dans votre espace cadastre des que votre document sera pret.',
      demande: await this.getDemandById(demande.id, session.user),
    };
  }

  async getAccuseReceptionFile(demandeId: number, req: any) {
    const session = await this.requireCadastreSession(req);
    return this.ensureAccuseReceptionPdf(demandeId, session.user);
  }

  async getDemandById(demandeId: number, user?: CadastreSessionUser) {
    const demande = await this.prisma.demandeDocumentCadastral.findUnique({
      where: { id: demandeId },
      include: {
        piecesJointes: {
          orderBy: { createdAt: 'asc' },
        },
        documentsGeneres: {
          orderBy: { dateGeneration: 'desc' },
        },
        historique: {
          orderBy: { dateAction: 'desc' },
        },
        permis: {
          select: {
            id: true,
            code_permis: true,
            qr_code: true,
          },
        },
      },
    });

    if (!demande) {
      throw new NotFoundException('Demande cadastrale introuvable.');
    }

    if (user) {
      const roleName = String(user?.role?.name || '').toLowerCase();
      const isAdmin =
        roleName.includes('admin') || roleName.includes('administrateur');
      if (!isAdmin && Number(demande.utilisateurId) !== Number(user.id)) {
        throw new ForbiddenException('Acces refuse');
      }
    }

    return this.mapDemand(demande);
  }

  async getAuthenticatedDemandById(demandeId: number, req: any) {
    const session = await this.requireCadastreSession(req);
    return this.getDemandById(demandeId, session.user);
  }

  async listMyRequests(req: any, filters?: { statut?: string }) {
    const session = await this.requireCadastreSession(req);
    const where: Prisma.DemandeDocumentCadastralWhereInput = {
      utilisateurId: session.userId,
      ...(filters?.statut
        ? {
            statut: filters.statut as StatutDemandeDocument,
          }
        : {}),
    };

    const demandes = await this.prisma.demandeDocumentCadastral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        piecesJointes: true,
        documentsGeneres: true,
      },
    });

    return {
      items: demandes.map((item) => this.mapDemand(item)),
    };
  }
}

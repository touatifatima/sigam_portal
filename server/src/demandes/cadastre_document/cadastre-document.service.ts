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
import {
  ActionDocumentCadastral,
  CanalVerificationCadastre,
  ObjetDemandeCadastre,
  QualiteDemandeurCadastre,
  Prisma,
  StatutDemandeDocument,
  TypeDocumentCadastral,
  TypePieceCadastre,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { createHash, randomBytes } from 'crypto';
import { isIP } from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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
  qualiteDemandeur?: QualiteDemandeurCadastre | string;
  objetDemande?: string;
  objetDemandeAutre?: string;
  baseCommunication?: string;
};

type VerifyOtpBody = {
  code: string;
};

type SubmitCadastreRequestBody = {
  typeDocument?: TypeDocumentCadastral | string;
  qualiteDemandeur?: QualiteDemandeurCadastre | string;
  objetDemande?: string;
  objetDemandeAutre?: string;
  baseCommunication?: string;
};

type AdminRequestStatusBody = {
  statut?: string;
  commentaire?: string;
};

@Injectable()
export class CadastreDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async listDocumentReferences(req: any) {
    await this.requireCadastreSession(req);

    return this.prisma.cadastreDocumentReference.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: { id: true, code: true, label: true, subtitle: true, description: true, iconKey: true, accentKey: true, isDefault: true, sortOrder: true },
    });
  }

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

  private normalizePhoneComparable(phone?: string | null) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('00213')) return digits.slice(2);
    return digits;
  }

  private phoneMatches(input?: string | null, expected?: string | null) {
    const normalizedInput = this.normalizePhoneComparable(input);
    const normalizedExpected = this.normalizePhoneComparable(expected);

    if (!normalizedInput || !normalizedExpected) return false;
    if (normalizedInput === normalizedExpected) return true;

    const localInput = normalizedInput.slice(-9);
    const localExpected = normalizedExpected.slice(-9);
    return localInput.length === 9 && localInput === localExpected;
  }

  private normalizeComparable(value?: string | null) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private generateReferenceDemande() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `CDC-${y}${m}${d}-${suffix}`;
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

  private async requireCadastreAdminSession(req: any) {
    const session = await this.requireCadastreSession(req);
    const roleName = String(session.roleName || '').toLowerCase();
    const hasAdminPermission = Array.isArray(session.user?.role?.rolePermissions)
      ? session.user.role.rolePermissions.some((rp) => {
          const permission = String(rp?.permission?.name || '').toLowerCase();
          return permission.includes('admin') || permission.includes('manage_cadastre');
        })
      : false;

    if (
      !roleName.includes('admin') &&
      !roleName.includes('administrateur') &&
      !roleName.includes('agent_cadastre') &&
      !hasAdminPermission
    ) {
      throw new ForbiddenException('Acces reserve aux agents administratifs du cadastre.');
    }

    return session;
  }

  private async resolvePermisForCadastre(payload: CreateCadastreRequestBody) {
    const permisSelect = {
      id: true,
      code_permis: true,
      qr_code: true,
      detenteur: {
        select: {
          id_detenteur: true,
          email: true,
          telephone: true,
          fonctions: {
            select: {
              type_fonction: true,
              personne: {
                select: {
                  nomFR: true,
                  prenomFR: true,
                  email: true,
                  telephone: true,
                },
              },
            },
          },
        },
      },
      typePermis: {
        select: {
          id: true,
          lib_type: true,
          code_type: true,
        },
      },
    } satisfies Prisma.PermisPortailSelect;

    const explicitPermisId = Number(payload.permisId);
    if (Number.isFinite(explicitPermisId) && explicitPermisId > 0) {
      const permis = await this.prisma.permisPortail.findUnique({
        where: { id: explicitPermisId },
        select: permisSelect,
      });

      if (!permis) {
        throw new NotFoundException('Permis introuvable.');
      }

      return permis;
    }

    const qrCode = String(payload.qrCodeTitre || '').trim();
    const codePermis = String(payload.codePermis || '').trim();
    const search = [qrCode, codePermis].filter(Boolean);
    if (search.length === 0) {
      throw new BadRequestException(
        'QR code ou code permis requis pour identifier le titre.',
      );
    }

    if (qrCode) {
      const permis = await this.prisma.permisPortail.findFirst({
        where: { qr_code: qrCode },
        select: permisSelect,
      });

      if (!permis) {
        throw new NotFoundException(
          'Aucun permis ne correspond au QR code fourni.',
        );
      }

      if (codePermis && permis.code_permis && permis.code_permis !== codePermis) {
        throw new BadRequestException(
          'Le code permis ne correspond pas au QR code scanne.',
        );
      }

      return permis;
    }

    const permisMatches = await this.prisma.permisPortail.findMany({
      where: { code_permis: codePermis },
      select: permisSelect,
      take: 2,
    });

    if (permisMatches.length === 0) {
      throw new NotFoundException(
        'Aucun permis ne correspond au code permis fourni.',
      );
    }

    if (permisMatches.length > 1) {
      throw new BadRequestException(
        'Plusieurs permis correspondent a ce code permis. Veuillez scanner le QR code du titre.',
      );
    }

    return permisMatches[0];
  }

  private assertPermisMatchesRequest(
    permis: Prisma.PermisPortailGetPayload<{
      select: {
        id: true;
        code_permis: true;
        qr_code: true;
        detenteur: { select: { id_detenteur: true; email: true; telephone: true } };
        typePermis: { select: { id: true; lib_type: true; code_type: true } };
      };
    }>,
    typePermis: string,
  ) {
    if (!typePermis) {
      throw new BadRequestException('Le type de permis est requis.');
    }

    const requestedType = this.normalizeComparable(typePermis);
    const actualLabel = this.normalizeComparable(permis.typePermis?.lib_type);
    const actualCode = this.normalizeComparable(permis.typePermis?.code_type);
    const typeMatches =
      requestedType === actualLabel ||
      requestedType === actualCode ||
      (!!actualLabel &&
        (actualLabel.includes(requestedType) || requestedType.includes(actualLabel))) ||
      (!!actualCode && requestedType.includes(actualCode));

    if (!typeMatches) {
      throw new BadRequestException(
        `Le type de permis saisi ne correspond pas au titre. Type attendu: ${permis.typePermis?.lib_type || permis.typePermis?.code_type || 'non renseigne'}.`,
      );
    }
  }

  private assertContactMatchesDetenteur(
    permis: any,
    canalVerification: CanalVerificationCadastre,
    emailContact: string,
    telephoneContact: string,
    qualiteDemandeur: QualiteDemandeurCadastre,
  ) {
    if (!permis.detenteur) {
      throw new BadRequestException(
        'Aucun detenteur moral n\'est associe a ce permis.',
      );
    }

    const functions = Array.isArray(permis.detenteur.fonctions)
      ? permis.detenteur.fonctions
      : [];
    const candidates =
      qualiteDemandeur === QualiteDemandeurCadastre.TITULAIRE_TITRE_MINIER
        ? [{
            email: permis.detenteur.email,
            telephone: permis.detenteur.telephone,
            prenom: null,
          }]
        : functions
            .filter((fonction: any) => {
              if (!fonction.personne) return false;
              if (qualiteDemandeur === QualiteDemandeurCadastre.ACTIONNAIRE) {
                return ['Actionnaire', 'Representant_Actionnaire'].includes(
                  fonction.type_fonction,
                );
              }
              return ['Representant', 'Representant_Actionnaire'].includes(
                fonction.type_fonction,
              );
            })
            .map((fonction: any) => ({
              email: fonction.personne.email,
              telephone: fonction.personne.telephone,
              prenom: fonction.personne.prenomFR,
            }));

    const matched = candidates.find((candidate: any) =>
      canalVerification === CanalVerificationCadastre.EMAIL
        ? Boolean(candidate.email) &&
          this.normalizeEmail(emailContact) === this.normalizeEmail(candidate.email)
        : Boolean(candidate.telephone) &&
          this.phoneMatches(telephoneContact, candidate.telephone),
    );

    if (!matched) {
      const qualityLabel =
        qualiteDemandeur === QualiteDemandeurCadastre.TITULAIRE_TITRE_MINIER
          ? 'titulaire du titre minier'
          : qualiteDemandeur === QualiteDemandeurCadastre.ACTIONNAIRE
            ? 'actionnaire'
            : 'representant legal';
      throw new BadRequestException(
        `Le contact saisi ne correspond pas au ${qualityLabel} associe a ce permis.`,
      );
    }

    return {
      email: this.normalizeEmail(matched.email) || null,
      telephone: this.normalizePhone(matched.telephone) || null,
      prenom: matched.prenom || null,
    };
  }

  private normalizeTypeDocument(value?: string | null) {
    const normalized = String(value || '').trim();
    if (normalized === TypeDocumentCadastral.PLAN_CADASTRAL_OFFICIEL) {
      return TypeDocumentCadastral.PLAN_CADASTRAL_OFFICIEL;
    }
    return TypeDocumentCadastral.EXTRAIT_CERTIFIE_CONFORME;
  }

  private normalizeCanal(value?: string | null) {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === CanalVerificationCadastre.TELEPHONE) {
      return CanalVerificationCadastre.TELEPHONE;
    }
    return CanalVerificationCadastre.EMAIL;
  }

  private normalizeQualiteDemandeur(value?: string | null) {
    const normalized = this.normalizeComparable(value).replace(/[’']/g, '');

    if (!normalized) return QualiteDemandeurCadastre.REPRESENTANT_LEGAL;
    if (normalized === 'actionnaire') return QualiteDemandeurCadastre.ACTIONNAIRE;
    if (
      normalized === 'titulaire du titre minier' ||
      normalized === 'titulaire titre minier'
    ) {
      return QualiteDemandeurCadastre.TITULAIRE_TITRE_MINIER;
    }
    if (normalized === 'representant legal' || normalized === 'representant') {
      return QualiteDemandeurCadastre.REPRESENTANT_LEGAL;
    }

    throw new BadRequestException('Qualite du demandeur invalide.');
  }

  private normalizeObjetDemande(value?: string | null) {
    const normalized = this.normalizeComparable(value);
    const values: Array<[string, ObjetDemandeCadastre]> = [
      ['constitution de dossier administratif', ObjetDemandeCadastre.CONSTITUTION_DOSSIER_ADMINISTRATIF],
      ['transaction ou cession de droits miniers', ObjetDemandeCadastre.TRANSACTION_CESSION_DROITS_MINIERS],
      ['contentieux ou procedure judiciaire', ObjetDemandeCadastre.CONTENTIEUX_PROCEDURE_JUDICIAIRE],
      ['financement / garantie bancaire', ObjetDemandeCadastre.FINANCEMENT_GARANTIE_BANCAIRE],
      ['controle et suivi reglementaire', ObjetDemandeCadastre.CONTROLE_SUIVI_REGLEMENTAIRE],
    ];
    const found = values.find(([label, code]) => normalized === label || normalized === code.toLowerCase());
    return found?.[1] || ObjetDemandeCadastre.AUTRE;
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
    agentEmetteur?: string | null,
  ) {
    await this.prisma.historiqueDemandeDocument.create({
      data: {
        demandeId,
        action,
        detailsCommunication: detailsCommunication || null,
        agentEmetteur: agentEmetteur || null,
      },
    });
  }

  private async generateCadastreReceiptPdf(demandeId: number) {
    const demande = await this.prisma.demandeDocumentCadastral.findUnique({
      where: { id: demandeId },
      include: {
        piecesJointes: true,
        permis: { include: { typePermis: true } },
      },
    });

    if (!demande) throw new NotFoundException('Demande cadastrale introuvable.');

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.08, 0.18, 0.28);
    const muted = rgb(0.38, 0.42, 0.48);
    const left = 25;
    const right = 570;
    const valueX = 155;
    const contentWidth = right - valueX;
    let y = 805;
    const date = new Date(demande.dateSoumission || demande.dateDemande);
    const dateText = `${date.toLocaleDateString('fr-DZ')} à ${date.toLocaleTimeString('fr-DZ', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    const channel = demande.canalVerification === CanalVerificationCadastre.TELEPHONE
      ? 'Telephone'
      : 'Email';
    const contact = demande.canalVerification === CanalVerificationCadastre.TELEPHONE
      ? demande.telephoneContact || demande.emailContact || '—'
      : demande.emailContact || '—';
    const quality = demande.qualiteDemandeur === QualiteDemandeurCadastre.ACTIONNAIRE
      ? 'Actionnaire'
      : demande.qualiteDemandeur === QualiteDemandeurCadastre.TITULAIRE_TITRE_MINIER
        ? 'Titulaire du titre minier'
        : 'Representant legal';

    const wrap = (value: string, maxWidth: number, currentFont: any, size: number) => {
      const words = String(value || '—').split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (currentFont.widthOfTextAtSize(candidate, size) <= maxWidth) {
          line = candidate;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
      return lines.length ? lines : ['—'];
    };

    page.drawRectangle({
      x: 20,
      y: 20,
      width: 555,
      height: 802,
      borderColor: navy,
      borderWidth: 0.8,
    });
    const centered = (text: string, size: number, currentFont: any, yy: number) => {
      const width = currentFont.widthOfTextAtSize(text, size);
      page.drawText(text, { x: (595 - width) / 2, y: yy, size, font: currentFont, color: navy });
    };

    centered('REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE', 10, bold, y);
    y -= 13;
    centered("MINISTERE DE L'ENERGIE ET DES MINES", 10, bold, y);
    y -= 13;
    centered('AGENCE NATIONALE DES ACTIVITES MINIERES (ANAM)', 10, bold, y);
    y -= 14;
    page.drawLine({ start: { x: 23, y }, end: { x: 572, y }, thickness: 0.8, color: navy });
    y -= 25;
    centered('ACCUSE DE RECEPTION HORODATE', 17, bold, y);
    y -= 18;
    centered('Document de preuve du depot enregistre dans le systeme ANAM', 9, font, y);
    y -= 25;
    page.drawText('Informations du depot', { x: left, y, size: 13, font: bold, color: navy });
    page.drawLine({ start: { x: left, y: y - 5 }, end: { x: right, y: y - 5 }, thickness: 0.8, color: navy });
    y -= 25;

    const rows: Array<[string, string]> = [
      ['Reference accuse :', demande.referenceDemande],
      ['Code demande :', demande.referenceDemande],
      ['Horodatage systeme :', dateText],
      ['Date et heure de depot :', dateText],
      ['Titulaire :', demande.titulaire || '—'],
      ['Numero de registre de commerce', demande.numeroRc || '—'],
      ['Code QR du titre :', demande.qrCodeTitre || demande.permis?.qr_code || '—'],
      ['Code permis :', demande.codePermis || demande.permis?.code_permis || '—'],
      ['Type de permis :', demande.typePermis || demande.permis?.typePermis?.lib_type || demande.permis?.typePermis?.code_type || '—'],
      ['NIN :', demande.nin || '—'],
      ['Nom et prenom :', `${demande.prenom || ''} ${demande.nom || ''}`.trim() || '—'],
      ['Canal de verification :', channel],
      ['Contact de verification :', contact],
      ['Qualite du demandeur :', quality],
      ['Objet de la demande :', demande.objetDemande === ObjetDemandeCadastre.AUTRE
        ? demande.objetDemandeAutre || 'Autre'
        : demande.objetDemande === ObjetDemandeCadastre.CONSTITUTION_DOSSIER_ADMINISTRATIF
          ? 'Constitution de dossier administratif'
          : demande.objetDemande === ObjetDemandeCadastre.TRANSACTION_CESSION_DROITS_MINIERS
            ? 'Transaction ou cession de droits miniers'
            : demande.objetDemande === ObjetDemandeCadastre.CONTENTIEUX_PROCEDURE_JUDICIAIRE
              ? 'Contentieux ou procedure judiciaire'
              : demande.objetDemande === ObjetDemandeCadastre.FINANCEMENT_GARANTIE_BANCAIRE
                ? 'Financement / garantie bancaire'
                : 'Controle et suivi reglementaire'],
      ['Base de communication :', demande.baseCommunication || '—'],
      ['Nombre de pieces remises :', String(demande.piecesJointes?.length || 0)],
      ['Agent recepteur :', 'Systeme ANAM'],
    ];

    for (const [label, value] of rows) {
      const lines = wrap(value, contentWidth, font, 9);
      page.drawText(label, { x: left, y, size: 9, font: bold, color: navy });
      lines.forEach((line, index) => {
        page.drawText(line, { x: valueX, y: y - index * 12, size: 9, font, color: navy });
      });
      y -= Math.max(19, lines.length * 12 + 7);
    }

    page.drawText(`Document officiel genere automatiquement le ${dateText}`, {
      x: left + 2,
      y: 31,
      size: 8,
      font,
      color: muted,
    });
    const footer = 'ANAM - Registre numerique des demandes';
    page.drawText(footer, {
      x: right - font.widthOfTextAtSize(footer, 8),
      y: 31,
      size: 8,
      font,
      color: muted,
    });

    const folder = path.join(process.cwd(), 'public', 'uploads', 'cadastre', 'demandes', String(demande.id));
    fs.mkdirSync(folder, { recursive: true });
    const filename = `accuse-reception-${demande.referenceDemande}.pdf`;
    const absolutePath = path.join(folder, filename);
    fs.writeFileSync(absolutePath, Buffer.from(await pdf.save()));
    const fichierUrl = `/uploads/cadastre/demandes/${demande.id}/${filename}`;

    await this.prisma.demandeDocumentCadastral.update({
      where: { id: demande.id },
      data: {
        accuseReceptionPdfUrl: fichierUrl,
        accuseReceptionPdfFilename: filename,
        accuseReceptionGeneratedAt: new Date(),
      },
    });

    return { fichierUrl, filename };
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

  private getAgentLabel(user: CadastreSessionUser) {
    return [user?.Prenom, user?.nom].filter(Boolean).join(' ') || user?.email || `Agent #${user?.id}`;
  }

  async listAdminRequests(
    req: any,
    filters: {
      page?: string;
      pageSize?: string;
      search?: string;
      statut?: string;
      typeDocument?: string;
      dateFrom?: string;
      dateTo?: string;
      societe?: string;
      referenceDemande?: string;
      codePermis?: string;
      emailDemandeur?: string;
      nomDemandeur?: string;
    } = {},
  ) {
    await this.requireCadastreAdminSession(req);

    const page = Math.max(1, Number(filters.page || 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 10) || 10));
    const search = String(filters.search || '').trim();
    const normalizedStatuses = String(filters.statut || '').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);
    const normalizedTypes = String(filters.typeDocument || '').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);
    const normalizedSocietes = String(filters.societe || '').split(',').map((value) => value.trim()).filter(Boolean);
    const referenceDemande = String(filters.referenceDemande || '').trim();
    const codePermis = String(filters.codePermis || '').trim();
    const emailDemandeur = String(filters.emailDemandeur || '').trim();
    const nomDemandeur = String(filters.nomDemandeur || '').trim();
    const validStatuses = Object.values(StatutDemandeDocument);
    const dateFilter: Prisma.DateTimeFilter = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(filters.dateFrom || ''))) {
      dateFilter.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(filters.dateTo || ''))) {
      const endDate = new Date(`${filters.dateTo}T00:00:00.000Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      dateFilter.lt = endDate;
    }

    const where: Prisma.DemandeDocumentCadastralWhereInput = {
      ...(normalizedStatuses.some((value) => validStatuses.includes(value as StatutDemandeDocument))
        ? { statut: { in: normalizedStatuses.filter((value): value is StatutDemandeDocument => validStatuses.includes(value as StatutDemandeDocument)) } }
        : {}),
      ...(normalizedTypes.some((value) => Object.values(TypeDocumentCadastral).includes(value as TypeDocumentCadastral))
        ? { typeDocument: { in: normalizedTypes.filter((value): value is TypeDocumentCadastral => Object.values(TypeDocumentCadastral).includes(value as TypeDocumentCadastral)) } }
        : {}),
      ...(Object.keys(dateFilter).length ? { dateDemande: dateFilter } : {}),
      ...(referenceDemande ? { referenceDemande: { contains: referenceDemande, mode: 'insensitive' as const } } : {}),
      ...(codePermis ? { codePermis: { contains: codePermis, mode: 'insensitive' as const } } : {}),
      ...(emailDemandeur ? { emailContact: { contains: emailDemandeur, mode: 'insensitive' as const } } : {}),
      ...(nomDemandeur
        ? {
            AND: [{
              OR: [
                { nom: { contains: nomDemandeur, mode: 'insensitive' as const } },
                { prenom: { contains: nomDemandeur, mode: 'insensitive' as const } },
                { titulaire: { contains: nomDemandeur, mode: 'insensitive' as const } },
              ],
            }],
          }
        : {}),
      ...(normalizedSocietes.length
        ? {
            utilisateur: {
              detenteur: {
                is: {
                  OR: normalizedSocietes.flatMap((societe) => [
                    { nom_societeFR: { contains: societe, mode: 'insensitive' as const } },
                    { nom_societeAR: { contains: societe, mode: 'insensitive' as const } },
                  ]),
                },
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { referenceDemande: { contains: search, mode: 'insensitive' } },
              { codePermis: { contains: search, mode: 'insensitive' } },
              { titulaire: { contains: search, mode: 'insensitive' } },
              { nom: { contains: search, mode: 'insensitive' } },
              { prenom: { contains: search, mode: 'insensitive' } },
              { emailContact: { contains: search, mode: 'insensitive' } },
              ...(Object.values(ObjetDemandeCadastre).includes(search.toUpperCase() as ObjetDemandeCadastre)
                ? [{ objetDemande: search.toUpperCase() as ObjetDemandeCadastre }]
                : [{ objetDemandeAutre: { contains: search, mode: 'insensitive' as const } }]),
            ],
          }
        : {}),
    };

    const [total, demandes] = await this.prisma.$transaction([
      this.prisma.demandeDocumentCadastral.count({ where }),
      this.prisma.demandeDocumentCadastral.findMany({
        where,
        orderBy: { dateDemande: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          piecesJointes: true,
          documentsGeneres: true,
          historique: { orderBy: { dateAction: 'desc' }, take: 1 },
          utilisateur: {
            select: {
              id: true,
              username: true,
              email: true,
              nom: true,
              Prenom: true,
              detenteur: { select: { nom_societeFR: true, nom_societeAR: true, email: true } },
            },
          },
          permis: {
            select: {
              id: true,
              code_permis: true,
              qr_code: true,
              typePermis: { select: { lib_type: true, code_type: true } },
            },
          },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      items: demandes.map((item) => this.mapDemand(item)),
    };
  }

  async getAdminStats(req: any) {
    await this.requireCadastreAdminSession(req);
    const [total, grouped, generated, pendingItems, societyRows] = await this.prisma.$transaction([
      this.prisma.demandeDocumentCadastral.count(),
      this.prisma.demandeDocumentCadastral.groupBy({
        by: ['statut'],
        orderBy: { statut: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.documentCadastralGenere.count(),
      this.prisma.demandeDocumentCadastral.findMany({
        where: { statut: { in: [StatutDemandeDocument.ENREGISTREE, StatutDemandeDocument.EN_COURS_EXAMEN, StatutDemandeDocument.VERIFIEE] } },
        select: { dateDemande: true, dateSoumission: true },
      }),
      this.prisma.demandeDocumentCadastral.findMany({
        select: { utilisateur: { select: { detenteur: { select: { nom_societeFR: true, nom_societeAR: true } } } } },
      }),
    ]);
    const societes = Array.from(new Set(
      societyRows
        .flatMap((row) => [row.utilisateur.detenteur?.nom_societeFR, row.utilisateur.detenteur?.nom_societeAR])
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim()),
    )).sort((left, right) => left.localeCompare(right, 'fr'));
    const counts = Object.fromEntries(
      grouped.map((row) => [row.statut, Number((row._count as { _all?: number } | undefined)?._all || 0)]),
    );
    const durations = pendingItems
      .map((item) => (Date.now() - new Date(item.dateSoumission || item.dateDemande).getTime()) / 86400000)
      .filter((value) => Number.isFinite(value) && value >= 0);

    return {
      total,
      pending: Number(counts.ENREGISTREE || 0) + Number(counts.EN_COURS_EXAMEN || 0) + Number(counts.VERIFIEE || 0),
      accepted: Number(counts.ACCEPTEE || 0) + Number(counts.GENEREE || 0) + Number(counts.DELIVREE || 0),
      rejected: Number(counts.REJETEE || 0),
      documentsGenerated: generated,
      averageProcessingDays: durations.length ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(1)) : 0,
      byStatus: counts,
      societes,
    };
  }

  async updateAdminStatus(demandeId: number, body: AdminRequestStatusBody, req: any) {
    const session = await this.requireCadastreAdminSession(req);
    const statut = String(body?.statut || '').trim().toUpperCase() as StatutDemandeDocument;
    if (!Object.values(StatutDemandeDocument).includes(statut)) {
      throw new BadRequestException('Statut cadastral invalide.');
    }

    const demande = await this.prisma.demandeDocumentCadastral.findUnique({ where: { id: demandeId } });
    if (!demande) throw new NotFoundException('Demande cadastrale introuvable.');

    const actionByStatus: Partial<Record<StatutDemandeDocument, ActionDocumentCadastral>> = {
      EN_COURS_EXAMEN: ActionDocumentCadastral.DEMANDE_VERIFIEE,
      ACCEPTEE: ActionDocumentCadastral.DEMANDE_ACCEPTEE,
      EN_COMPLEMENT: ActionDocumentCadastral.COMPLEMENT_DEMANDE,
      REJETEE: ActionDocumentCadastral.DEMANDE_REJETEE,
      GENEREE: ActionDocumentCadastral.DOCUMENT_GENERE,
      DELIVREE: ActionDocumentCadastral.DOCUMENT_DELIVRE,
    };

    await this.prisma.demandeDocumentCadastral.update({ where: { id: demandeId }, data: { statut } });
    await this.recordHistory(
      demandeId,
      actionByStatus[statut] || ActionDocumentCadastral.DEMANDE_ENREGISTREE,
      String(body.commentaire || '').trim() || `Statut modifie vers ${statut}.`,
      this.getAgentLabel(session.user),
    );

    return { message: 'Statut de la demande mis a jour.', demande: await this.getDemandById(demandeId, session.user) };
  }

  async addAdminNote(demandeId: number, note: string, req: any) {
    const session = await this.requireCadastreAdminSession(req);
    const cleanNote = String(note || '').trim();
    if (!cleanNote) throw new BadRequestException('La note est requise.');
    const demande = await this.prisma.demandeDocumentCadastral.findUnique({ where: { id: demandeId }, select: { id: true } });
    if (!demande) throw new NotFoundException('Demande cadastrale introuvable.');
    await this.recordHistory(demandeId, ActionDocumentCadastral.NOTE_AJOUTEE, cleanNote, this.getAgentLabel(session.user));
    return { message: 'Note administrative ajoutee.' };
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
    const canalVerification = this.normalizeCanal(body.canalVerification);
    const qualiteDemandeur = this.normalizeQualiteDemandeur(body.qualiteDemandeur);
    const objetDemande = this.normalizeObjetDemande(body.objetDemande);
    const objetDemandeAutre = String(body.objetDemandeAutre || '').trim();
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
    if (objetDemande === ObjetDemandeCadastre.AUTRE && !objetDemandeAutre) {
      throw new BadRequestException('Veuillez preciser l objet de la demande.');
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

    const permis = await this.resolvePermisForCadastre(body);
    this.assertPermisMatchesRequest(permis, typePermis);
    const verifiedContact = this.assertContactMatchesDetenteur(
      permis,
      canalVerification,
      emailContact,
      telephoneContact,
      qualiteDemandeur,
    );
    const permisId = permis.id;
    const referenceDemande = this.generateReferenceDemande();
    const typeDocument = this.normalizeTypeDocument(body.typeDocument);

    const demande = await this.prisma.demandeDocumentCadastral.create({
      data: {
        referenceDemande,
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
        emailContact: verifiedContact.email,
        telephoneContact: verifiedContact.telephone,
        canalVerification,
        objetDemande,
        objetDemandeAutre: objetDemandeAutre || null,
        qualiteDemandeur,
        baseCommunication,
      },
    });

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
      await this.sendOtpEmail(
        verifiedContact.email || '',
        verifiedContact.prenom || prenom,
        otpCode,
        referenceDemande,
      );
    } else {
      await this.sendOtpPhoneFallback(
        verifiedContact.telephone || '',
        otpCode,
        referenceDemande,
        verifiedContact.email,
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

  async verifyTitleInformation(body: CreateCadastreRequestBody, req: any) {
    await this.requireCadastreSession(req);

    const typePermis = String(body.typePermis || '').trim();

    const permis = await this.resolvePermisForCadastre(body);
    this.assertPermisMatchesRequest(permis, typePermis);

    return {
      valid: true,
      message: 'QR code, code permis et type de permis valides.',
      permis: {
        id: permis.id,
        codePermis: permis.code_permis,
        qrCode: permis.qr_code,
        typePermis: permis.typePermis?.lib_type || permis.typePermis?.code_type || null,
        codeType: permis.typePermis?.code_type || null,
        detenteurEmail: permis.detenteur?.email || null,
      },
    };
  }

  async verifyDetenteurContact(body: CreateCadastreRequestBody, req: any) {
    await this.requireCadastreSession(req);

    const emailContact = this.normalizeEmail(body.emailContact);
    const telephoneContact = this.normalizePhone(body.telephoneContact);
    const canalVerification = this.normalizeCanal(body.canalVerification);
    const qualiteDemandeur = this.normalizeQualiteDemandeur(body.qualiteDemandeur);

    if (canalVerification === CanalVerificationCadastre.EMAIL && !emailContact) {
      throw new BadRequestException('L\'email de contact est requis.');
    }
    if (canalVerification === CanalVerificationCadastre.TELEPHONE && !telephoneContact) {
      throw new BadRequestException('Le numero de telephone de contact est requis.');
    }
    if (emailContact && !this.isValidEmail(emailContact)) {
      throw new BadRequestException('Adresse email de contact invalide.');
    }

    const permis = await this.resolvePermisForCadastre(body);
    const verifiedContact = this.assertContactMatchesDetenteur(
      permis,
      canalVerification,
      emailContact,
      telephoneContact,
      qualiteDemandeur,
    );

    return {
      valid: true,
      message:
        canalVerification === CanalVerificationCadastre.EMAIL
          ? 'Adresse email conforme a la qualite selectionnee pour ce permis.'
          : 'Numero de telephone conforme a la qualite selectionnee pour ce permis.',
      qualiteDemandeur,
      contact: {
        email: verifiedContact.email,
        telephone: verifiedContact.telephone,
      },
    };
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

    await this.prisma.demandeDocumentCadastral.update({
      where: { id: demande.id },
      data: {
        statut: StatutDemandeDocument.VERIFIEE,
        dateSoumission: new Date(),
        typeDocument: this.normalizeTypeDocument(body.typeDocument || fullDemand.typeDocument),
        qualiteDemandeur: this.normalizeQualiteDemandeur(
          body.qualiteDemandeur || fullDemand.qualiteDemandeur,
        ),
        objetDemande: this.normalizeObjetDemande(body.objetDemande || fullDemand.objetDemande),
        objetDemandeAutre: String(body.objetDemandeAutre || fullDemand.objetDemandeAutre || '').trim() || null,
        baseCommunication:
          String(body.baseCommunication || fullDemand.baseCommunication || '').trim() ||
          'Demande introduite via le workflow cadastral du portail.',
      },
    });

    await this.recordHistory(
      demande.id,
      ActionDocumentCadastral.DEMANDE_VERIFIEE,
      'Demande soumise pour traitement.',
    );

    await this.generateCadastreReceiptPdf(demande.id);

    return {
      message:
        'Votre demande de cadastre a ete bien transmise avec succes. Vous recevrez une notification dans votre espace cadastre des que votre document sera pret.',
      demande: await this.getDemandById(demande.id, session.user),
    };
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
            typePermis: { select: { lib_type: true, code_type: true } },
          },
        },
        utilisateur: {
          select: {
            id: true,
            username: true,
            email: true,
            nom: true,
            Prenom: true,
            telephone: true,
            detenteur: { select: { nom_societeFR: true, nom_societeAR: true, email: true } },
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

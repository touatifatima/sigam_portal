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
  Prisma,
  StatutDemandeDocument,
  TypeDocumentCadastral,
  TypePieceCadastre,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
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
    permis: Prisma.PermisPortailGetPayload<{
      select: {
        id: true;
        code_permis: true;
        qr_code: true;
        detenteur: { select: { id_detenteur: true; email: true; telephone: true } };
        typePermis: { select: { id: true; lib_type: true; code_type: true } };
      };
    }>,
    canalVerification: CanalVerificationCadastre,
    emailContact: string,
    telephoneContact: string,
  ) {
    if (!permis.detenteur) {
      throw new BadRequestException(
        'Aucun detenteur moral n\'est associe a ce permis.',
      );
    }

    if (canalVerification === CanalVerificationCadastre.EMAIL) {
      const detenteurEmail = this.normalizeEmail(permis.detenteur.email);
      if (!detenteurEmail) {
        throw new BadRequestException(
          'Aucune adresse email n\'est renseignee pour le detenteur moral de ce permis.',
        );
      }
      if (this.normalizeEmail(emailContact) !== detenteurEmail) {
        throw new BadRequestException(
          'L\'adresse email saisie ne correspond pas a celle du detenteur moral de ce permis.',
        );
      }
    }

    if (canalVerification === CanalVerificationCadastre.TELEPHONE) {
      if (!permis.detenteur.telephone) {
        throw new BadRequestException(
          'Aucun numero de telephone n\'est renseigne pour le detenteur moral de ce permis.',
        );
      }
      if (!this.phoneMatches(telephoneContact, permis.detenteur.telephone)) {
        throw new BadRequestException(
          'Le numero de telephone saisi ne correspond pas a celui du detenteur moral de ce permis.',
        );
      }
    }
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

    const permis = await this.resolvePermisForCadastre(body);
    this.assertPermisMatchesRequest(permis, typePermis);
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
        emailContact: emailContact || null,
        telephoneContact: telephoneContact || null,
        canalVerification,
        objetDemande,
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
    this.assertContactMatchesDetenteur(
      permis,
      canalVerification,
      emailContact,
      telephoneContact,
    );

    return {
      valid: true,
      message:
        canalVerification === CanalVerificationCadastre.EMAIL
          ? 'Adresse email conforme au detenteur moral.'
          : 'Numero de telephone conforme au detenteur moral.',
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

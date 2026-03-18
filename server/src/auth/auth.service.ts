// src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SessionService } from '../session/session.service';
import * as nodemailer from 'nodemailer';
import { isIP } from 'net';

const IDENTIFICATION_EVENT_TYPES = [
  'entreprise_identification_request',
  'entreprise_identification_request_resubmitted',
  'entreprise_identification_confirmed',
  'entreprise_identification_rejected',
] as const;

type IdentificationAccessState = 'ALLOW' | 'PENDING' | 'REJECTED';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private sessionService: SessionService,
  ) {}

  private sessionLocks = new Map<string, Promise<any>>();
  private otpResendLimits = new Map<
    string,
    { count: number; windowStart: number; cooldownUntil: number }
  >();
  private otpAttemptLimits = new Map<
    string,
    { count: number; blockedUntil?: number }
  >();
  private mailer?: nodemailer.Transporter;

  private getMailer() {
    if (this.mailer) return this.mailer;
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const tlsServername =
      process.env.SMTP_TLS_SERVERNAME ||
      (!isIP(host || '') ? host : undefined);
    const rejectUnauthorized =
      (process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() !==
      'false';
    if (!host || !user || !pass) {
      throw new Error('SMTP non configurée (SMTP_HOST/SMTP_USER/SMTP_PASS)');
    }
    const transportOptions: any = {
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      allowInternalNetworkInterfaces: true,
    };
    const tlsOptions: any = { rejectUnauthorized };
    if (tlsServername) {
      tlsOptions.servername = tlsServername;
    }
    transportOptions.tls = tlsOptions;
    this.mailer = nodemailer.createTransport(transportOptions);
    return this.mailer;
  }

  private normalizeEmail(email: string) {
    return (email || '').trim().toLowerCase();
  }

  private escapeHtml(value: string) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async sendOtpEmail(email: string, prenom: string | undefined, code: string) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || '';
    const name = prenom || 'Utilisateur';
    const siteUrl = (process.env.PORTAIL_URL || 'https://pom.anam.dz').trim();
    const supportEmail = (process.env.SUPPORT_EMAIL || 'support@anam.dz').trim();
    const logoUrl = (process.env.MAIL_LOGO_URL || `${siteUrl.replace(/\/+$/, '')}/logo.jpg`).trim();
    const subject = `Votre code de verification ANAM - ${code}`;
    const text = [
      `Bonjour ${name},`,
      '',
      'Voici votre code de verification pour securiser votre compte ANAM :',
      '',
      code,
      '',
      'Ce code est valable 10 minutes.',
      'Pour des raisons de securite, ne le partagez jamais avec qui que ce soit.',
      '',
      "Si vous n'avez pas initie cette demande, vous pouvez ignorer cet email en toute securite.",
      '',
      'Merci de votre confiance,',
      "L'equipe ANAM",
      siteUrl,
      supportEmail,
      '',
    ].join('\n');

    const safeName = this.escapeHtml(name);
    const safeCode = this.escapeHtml(code);
    const safeSiteUrl = this.escapeHtml(siteUrl);
    const safeSupportEmail = this.escapeHtml(supportEmail);
    const safeLogoUrl = this.escapeHtml(logoUrl);
    const html = `
      <div style="margin:0;padding:0;background:#f7f8fa;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f8fa;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 24px 8px 24px;text-align:center;">
                    <img src="${safeLogoUrl}" alt="ANAM" style="display:block;margin:0 auto 12px auto;max-width:140px;height:auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 8px 24px;">
                    <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#111827;">Verification de votre compte ANAM</h1>
                    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">Bonjour ${safeName},</p>
                    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">
                      Voici votre code de verification pour securiser votre compte ANAM :
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 16px 24px;">
                    <div style="text-align:center;border:2px solid #7f1d1d;border-radius:10px;padding:18px;background:#fff8f8;">
                      <span style="font-size:34px;letter-spacing:6px;font-weight:700;color:#7f1d1d;">${safeCode}</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 12px 24px;">
                    <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;">Ce code est valable <strong>10 minutes</strong>.</p>
                    <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;">
                      Pour des raisons de securite, ne le partagez jamais avec qui que ce soit.
                    </p>
                    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                      Si vous n'avez pas initie cette demande, vous pouvez ignorer cet email en toute securite.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 20px 24px;text-align:center;">
                    <a href="${safeSiteUrl}" style="display:inline-block;background:#7f1d1d;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;font-size:14px;">
                      Retour au site
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 24px 24px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#6b7280;">Merci de votre confiance,<br />L'equipe ANAM</p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
                      <a href="${safeSiteUrl}" style="color:#7f1d1d;text-decoration:none;">${safeSiteUrl}</a>
                      &nbsp;|&nbsp;
                      <a href="mailto:${safeSupportEmail}" style="color:#7f1d1d;text-decoration:none;">${safeSupportEmail}</a>
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

  private async findUserWithRoleByEmail(email: string) {
    return this.prisma.utilisateurPortail.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });
  }

  private async findUserWithRoleById(id: number) {
    return this.prisma.utilisateurPortail.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });
  }

  private async getLatestIdentificationEventType(
    userId: number,
  ): Promise<string | null> {
    const latestEvent = await this.prisma.notificationPortail.findFirst({
      where: {
        relatedEntityId: userId,
        relatedEntityType: {
          in: [...IDENTIFICATION_EVENT_TYPES],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { relatedEntityType: true },
    });
    return latestEvent?.relatedEntityType ?? null;
  }

  private async resolveIdentificationAccessState(
    userId: number,
    entrepriseVerified: boolean,
    detenteurId?: number | null,
  ): Promise<IdentificationAccessState> {
    if (entrepriseVerified) return 'ALLOW';
    if (!detenteurId) return 'ALLOW';

    const latestEventType = await this.getLatestIdentificationEventType(userId);
    if (!latestEventType) return 'PENDING';

    if (latestEventType === 'entreprise_identification_rejected') {
      return 'REJECTED';
    }
    if (latestEventType === 'entreprise_identification_confirmed') {
      return 'ALLOW';
    }
    if (
      latestEventType === 'entreprise_identification_request' ||
      latestEventType === 'entreprise_identification_request_resubmitted'
    ) {
      return 'PENDING';
    }
    return 'PENDING';
  }

  private async withSessionLock<T>(
    token: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (this.sessionLocks.has(token)) {
      await this.sessionLocks.get(token);
    }

    const lockPromise = operation().finally(() => {
      this.sessionLocks.delete(token);
    });

    this.sessionLocks.set(token, lockPromise);
    return lockPromise;
  }

  async validateUser(email: string, password: string) {
    const user = await this.findUserWithRoleByEmail(this.normalizeEmail(email));
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return { user: null };
    }
    if (!user.emailVerified) {
      return { user: null, error: 'EMAIL_NOT_VERIFIED' };
    }
    const identificationState = await this.resolveIdentificationAccessState(
      user.id,
      Boolean(user.entreprise_verified),
      user.detenteurId,
    );
    if (identificationState === 'REJECTED') {
      return { user: null, error: 'IDENTIFICATION_REJECTED' };
    }
    if (identificationState === 'PENDING') {
      return { user: null, error: 'IDENTIFICATION_PENDING' };
    }
    return { user };
  }

  async login(user: any) {
    return this.withSessionLock(`login-${user.id}`, async () => {
      const shouldShowWelcomeAfterConfirmation =
        Boolean(user.detenteurId) &&
        Boolean(user.entreprise_verified) &&
        Boolean(user.first_login_after_confirmation);

      if (shouldShowWelcomeAfterConfirmation) {
        await this.prisma.utilisateurPortail.update({
          where: { id: user.id },
          data: { first_login_after_confirmation: false },
        });
      }

      const session = await this.sessionService.createSession(user.id);
      const hasEntreprise = Boolean(user.detenteurId);
      const identificationStatus = hasEntreprise
        ? (user.entreprise_verified ? 'CONFIRMEE' : 'EN_ATTENTE')
        : null;

      return {
        token: session.token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nom: user.nom,
          Prenom: user.Prenom,
          telephone: user.telephone,
          createdAt: user.createdAt,
          entreprise_verified: user.entreprise_verified ?? false,
          identification_status: identificationStatus,
          first_login_after_confirmation: shouldShowWelcomeAfterConfirmation,
          role: user.role?.name,
          permissions: user.role?.rolePermissions.map(
            (rp: any) => rp.permission.name,
          ) || [],
        },
      };
    });
  }

  async verifyToken(token: string) {
    return this.withSessionLock(token, async () => {
      const session = await this.sessionService.validateSession(token);
      if (!session) return null;

      const currentUser = await this.findUserWithRoleById(session.user.id);
      if (!currentUser) return null;

      const identificationState = await this.resolveIdentificationAccessState(
        currentUser.id,
        Boolean(currentUser.entreprise_verified),
        currentUser.detenteurId,
      );
      if (identificationState === 'REJECTED') {
        await this.sessionService.deleteSession(token);
        return null;
      }

      await this.sessionService.extendSession(token);
      const hasEntreprise = Boolean(currentUser.detenteurId);
      const identificationStatus = hasEntreprise
        ? (currentUser.entreprise_verified
            ? 'CONFIRMEE'
            : identificationState === 'PENDING'
              ? 'EN_ATTENTE'
              : 'EN_ATTENTE')
        : null;
      const shouldShowWelcomeAfterConfirmation =
        hasEntreprise &&
        Boolean(currentUser.entreprise_verified) &&
        Boolean((currentUser as any).first_login_after_confirmation);

      return {
        id: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
        nom: currentUser.nom,
        Prenom: currentUser.Prenom,
        telephone: currentUser.telephone,
        createdAt: currentUser.createdAt,
        entreprise_verified: currentUser.entreprise_verified ?? false,
        identification_status: identificationStatus,
        first_login_after_confirmation: shouldShowWelcomeAfterConfirmation,
        role: currentUser.role?.name,
        permissions: currentUser.role?.rolePermissions.map(
          (rp: any) => rp.permission.name,
        ) || [],
      };
    });
  }

  async logout(token: string) {
    return this.withSessionLock(token, () =>
      this.sessionService.deleteSession(token),
    );
  }

  private checkResendLimit(email: string) {
    const key = email;
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const cooldownMs = 60 * 1000;

    let entry = this.otpResendLimits.get(key);
    if (!entry || now - entry.windowStart > oneHour) {
      entry = { count: 0, windowStart: now, cooldownUntil: 0 };
    }

    if (entry.count >= 3 && now - entry.windowStart < oneHour) {
      throw new Error('Limite de renvoi atteinte (3 par heure)');
    }
    if (entry.cooldownUntil > now) {
      const wait = Math.ceil((entry.cooldownUntil - now) / 1000);
      throw new Error(`Veuillez attendre ${wait}s avant de renvoyer`);
    }

    entry.count += 1;
    entry.cooldownUntil = now + cooldownMs;
    this.otpResendLimits.set(key, entry);
  }

  private checkAttemptLimit(email: string) {
    const key = email;
    const now = Date.now();
    const entry = this.otpAttemptLimits.get(key) || { count: 0 };
    if (entry.blockedUntil && now < entry.blockedUntil) {
      const wait = Math.ceil((entry.blockedUntil - now) / 1000);
      throw new Error(
        `Trop de tentatives. RÃ©essayez dans ${wait}s`,
      );
    }
    return entry;
  }

  private recordFailedAttempt(email: string) {
    const key = email;
    const now = Date.now();
    const entry = this.otpAttemptLimits.get(key) || { count: 0 };
    entry.count += 1;
    if (entry.count >= 5) {
      entry.blockedUntil = now + 15 * 60 * 1000;
    }
    this.otpAttemptLimits.set(key, entry);
  }

  async register(body: {
    email: string;
    password: string;
    role: string;
    nom?: string;
    Prenom?: string;
    username?: string;
    telephone?: string;
  }) {
    const hashed = await bcrypt.hash(body.password, 10);
    const normalizedEmail = this.normalizeEmail(body.email);

    const existingRole = await this.prisma.role.findUnique({
      where: { name: body.role },
    });

    if (!existingRole) {
      throw new Error(`Role "${body.role}" n'existe pas`);
    }

    const existingUser = await this.prisma.utilisateurPortail.findUnique({
      where: { email: normalizedEmail },
    });

    const phone = body.telephone?.trim() || '';
    if (!phone) {
      throw new Error('TÃ©lÃ©phone requis');
    }
    const isValidPhone =
      /^0\d{9}$/.test(phone) || /^\+\d{8,15}$/.test(phone);
    if (!isValidPhone) {
      throw new Error(
        'Veuillez entrer un numÃ©ro de tÃ©lÃ©phone valide (10 chiffres)',
      );
    }
    if (phone) {
      const phoneWhere: any = {
        telephone: phone,
        deletedAt: null,
      };
      if (existingUser?.id) {
        phoneWhere.NOT = { id: existingUser.id };
      }
      const existingPhone = await this.prisma.utilisateurPortail.findFirst({
        where: phoneWhere,
      });
      if (existingPhone) {
        throw new Error("NumÃ©ro de tÃ©lÃ©phone dÃ©jÃ  utilisÃ©");
      }
    }

    if (existingUser?.emailVerified) {
      throw new Error('Email dÃ©jÃ  utilisÃ©');
    }

    const otpCode = this.generateOtp();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    const user = existingUser
      ? await this.prisma.utilisateurPortail.update({
          where: { email: normalizedEmail },
          data: {
            password: hashed,
            roleId: existingRole.id,
            nom: body.nom || '',
            Prenom: body.Prenom || '',
            username: body.username || body.email,
            telephone: phone || null,
            verificationCode: otpHash,
            verificationCodeExpires: expires,
            emailVerified: false,
          },
        })
      : await this.prisma.utilisateurPortail.create({
          data: {
            email: normalizedEmail,
            password: hashed,
            roleId: existingRole.id,
            nom: body.nom || '',
            Prenom: body.Prenom || '',
            username: body.username || body.email,
            telephone: phone || null,
            verificationCode: otpHash,
            verificationCodeExpires: expires,
            emailVerified: false,
          },
        });

    await this.sendOtpEmail(normalizedEmail, body.Prenom, otpCode);

    return { message: 'Code envoyÃ©', userId: user.id };
  }

  async verifyEmail(email: string, code: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.utilisateurPortail.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new Error('Compte introuvable');
    }
    if (user.emailVerified) {
      throw new Error('Email dÃ©jÃ  vÃ©rifiÃ©');
    }

    this.checkAttemptLimit(normalizedEmail);
    const now = Date.now();
    if (
      !user.verificationCode ||
      !user.verificationCodeExpires ||
      user.verificationCodeExpires.getTime() < now
    ) {
      this.recordFailedAttempt(normalizedEmail);
      throw new Error('Code invalide ou expirÃ©');
    }

    const match = await bcrypt.compare(code, user.verificationCode);
    if (!match) {
      this.recordFailedAttempt(normalizedEmail);
      throw new Error('Code invalide ou expirÃ©');
    }

    await this.prisma.utilisateurPortail.update({
      where: { email: normalizedEmail },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpires: null,
      },
    });

    this.otpAttemptLimits.delete(normalizedEmail);

    const verifiedUser = await this.findUserWithRoleByEmail(normalizedEmail);
    if (!verifiedUser) {
      throw new Error('Utilisateur introuvable aprÃ¨s vÃ©rification');
    }

    return this.login(verifiedUser);
  }

  async resendVerification(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.utilisateurPortail.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new Error('Compte introuvable');
    }
    if (user.emailVerified) {
      throw new Error('Email dÃ©jÃ  vÃ©rifiÃ©');
    }

    this.checkResendLimit(normalizedEmail);

    const otpCode = this.generateOtp();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.utilisateurPortail.update({
      where: { email: normalizedEmail },
      data: {
        verificationCode: otpHash,
        verificationCodeExpires: expires,
      },
    });

    await this.sendOtpEmail(normalizedEmail, user.Prenom, otpCode);

    return { message: 'Code renvoyÃ©' };
  }

}

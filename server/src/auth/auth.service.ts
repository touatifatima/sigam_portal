// src/auth/auth.service.ts
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SessionService } from '../session/session.service';
import * as nodemailer from 'nodemailer';
import { isIP } from 'net';
import { createHash, randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import * as https from 'https';

const IDENTIFICATION_EVENT_TYPES = [
  'entreprise_identification_request',
  'entreprise_identification_request_resubmitted',
  'entreprise_identification_confirmed',
  'entreprise_identification_rejected',
] as const;

type IdentificationAccessState = 'ALLOW' | 'PENDING' | 'REJECTED';
type ForgotPasswordLimitEntry = { count: number; windowStart: number };
type ProfileUpdateAttemptEntry = { count: number; blockedUntil?: number };
type RecaptchaVerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
};

type PendingProfileUpdateData = {
  Prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  passwordHash: string | null;
  passwordChanged: boolean;
};

const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "Un email de reinitialisation a ete envoye a l'adresse indiquee. Si un compte est associe a cet email, vous recevrez un lien dans les prochaines minutes. Verifiez votre boite de reception (et vos spams). Le lien est valide pendant 15 minutes.";
const PROFILE_UPDATE_COOLDOWN_MS = 48 * 60 * 60 * 1000;
const PROFILE_UPDATE_OTP_TTL_MS = 10 * 60 * 1000;

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
  private forgotPasswordIpLimits = new Map<string, ForgotPasswordLimitEntry>();
  private profileUpdateResendLimits = new Map<
    string,
    { count: number; windowStart: number; cooldownUntil: number }
  >();
  private profileUpdateAttemptLimits = new Map<string, ProfileUpdateAttemptEntry>();
  private mailer?: nodemailer.Transporter;
  private recaptchaCaBundlePem?: string;
  private recaptchaCaBundlePathLoaded?: string;

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

  private normalizePhone(phone?: string | null) {
    const value = (phone || '').trim();
    if (!value) return null;
    const digitsOnly = value.replace(/\D/g, '');
    return digitsOnly || null;
  }

  private isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidPhone(phone: string | null) {
    if (!phone) return true;
    return /^0\d{9}$/.test(phone);
  }

  private formatRemainingHoursMessage(remainingMs: number) {
    const totalMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) {
      return `Vous avez deja modifie vos informations personnelles recemment. Cette action est disponible a nouveau dans ${minutes} minute${minutes > 1 ? 's' : ''}.`;
    }

    if (minutes === 0) {
      return `Vous avez deja modifie vos informations personnelles recemment. Cette action est disponible a nouveau dans ${hours} heure${hours > 1 ? 's' : ''}.`;
    }

    return `Vous avez deja modifie vos informations personnelles recemment. Cette action est disponible a nouveau dans ${hours} heure${hours > 1 ? 's' : ''} et ${minutes} minute${minutes > 1 ? 's' : ''}.`;
  }

  private getProfileUpdateStatusPayload(user: any) {
    const now = Date.now();
    const lastProfileUpdateAt = user.lastProfileUpdateAt
      ? new Date(user.lastProfileUpdateAt)
      : null;
    const nextAvailableAt = lastProfileUpdateAt
      ? new Date(lastProfileUpdateAt.getTime() + PROFILE_UPDATE_COOLDOWN_MS)
      : null;
    const remainingMs = nextAvailableAt
      ? Math.max(0, nextAvailableAt.getTime() - now)
      : 0;
    const pendingExpiresAt = user.profileUpdateOtpExpiresAt
      ? new Date(user.profileUpdateOtpExpiresAt)
      : null;
    const resendAvailableAt = user.profileUpdateOtpRequestedAt
      ? new Date(new Date(user.profileUpdateOtpRequestedAt).getTime() + 60 * 1000)
      : null;

    return {
      canEdit: remainingMs <= 0,
      lastProfileUpdateAt,
      nextAvailableAt,
      remainingMs,
      cooldownMessage:
        remainingMs > 0 ? this.formatRemainingHoursMessage(remainingMs) : null,
      hasPendingRequest:
        Boolean(user.profileUpdatePendingData) &&
        (pendingExpiresAt ? pendingExpiresAt.getTime() > now : false),
      pendingExpiresAt,
      resendAvailableAt,
    };
  }

  private generatePasswordResetToken() {
    return randomBytes(32).toString('hex');
  }

  private hashPasswordResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private isStrongPassword(password: string) {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  }

  private getRecaptchaMinScore() {
    const value = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
    if (!Number.isFinite(value)) {
      return 0.5;
    }

    return Math.min(Math.max(value, 0), 1);
  }

  private getRecaptchaVerifyUrls() {
    const configured = String(process.env.RECAPTCHA_VERIFY_URLS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (configured.length > 0) {
      return configured;
    }

    return [
      'https://www.google.com/recaptcha/api/siteverify',
      'https://www.recaptcha.net/recaptcha/api/siteverify',
    ];
  }

  private getRecaptchaTimeoutMs() {
    const value = Number(process.env.RECAPTCHA_VERIFY_TIMEOUT_MS || 8000);
    if (!Number.isFinite(value) || value <= 0) {
      return 8000;
    }

    return value;
  }

  private getRecaptchaCaBundlePath() {
    const explicitPath = String(process.env.RECAPTCHA_CA_BUNDLE_PATH || '').trim();
    if (explicitPath) {
      return explicitPath;
    }

    return String(process.env.NODE_EXTRA_CA_CERTS || '').trim();
  }

  private getRecaptchaCaBundlePem() {
    const caPath = this.getRecaptchaCaBundlePath();
    if (!caPath || !existsSync(caPath)) {
      return undefined;
    }

    if (this.recaptchaCaBundlePem && this.recaptchaCaBundlePathLoaded === caPath) {
      return this.recaptchaCaBundlePem;
    }

    try {
      this.recaptchaCaBundlePem = readFileSync(caPath, 'utf8');
      this.recaptchaCaBundlePathLoaded = caPath;
      return this.recaptchaCaBundlePem;
    } catch {
      return undefined;
    }
  }

  private postRecaptchaForm(
    verifyUrl: string,
    body: string,
    timeoutMs: number,
    caPem?: string,
  ) {
    return new Promise<{ statusCode: number; bodyText: string }>(
      (resolve, reject) => {
        const parsedUrl = new URL(verifyUrl);
        const request = https.request(
          {
            protocol: parsedUrl.protocol,
            hostname: parsedUrl.hostname,
            port: parsedUrl.port ? Number(parsedUrl.port) : 443,
            path: `${parsedUrl.pathname}${parsedUrl.search}`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(body),
            },
            timeout: timeoutMs,
            ...(caPem ? { ca: caPem } : {}),
          },
          (response) => {
            let data = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
              data += chunk;
            });
            response.on('end', () => {
              resolve({
                statusCode: response.statusCode || 0,
                bodyText: data,
              });
            });
          },
        );

        request.on('timeout', () => {
          request.destroy(new Error('request timeout'));
        });
        request.on('error', (error) => {
          reject(error);
        });
        request.write(body);
        request.end();
      },
    );
  }

  async verifyRecaptchaToken(
    recaptchaToken: string | undefined,
    expectedAction: string,
    ipAddress?: string,
  ) {
    const token = String(recaptchaToken || '').trim();
    if (!token) {
      throw new BadRequestException('Verification anti-bot manquante.');
    }

    const secretKey = String(process.env.RECAPTCHA_SECRET_KEY || '').trim();
    if (!secretKey) {
      throw new HttpException(
        'Configuration reCAPTCHA manquante sur le serveur.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const payload = new URLSearchParams();
    payload.append('secret', secretKey);
    payload.append('response', token);
    if (ipAddress && ipAddress !== 'unknown') {
      payload.append('remoteip', ipAddress);
    }

    const verifyUrls = this.getRecaptchaVerifyUrls();
    const timeoutMs = this.getRecaptchaTimeoutMs();
    const networkErrors: string[] = [];
    const caPem = this.getRecaptchaCaBundlePem();
    const requestBody = payload.toString();

    for (const verifyUrl of verifyUrls) {
      try {
        const verifyResponse = await this.postRecaptchaForm(
          verifyUrl,
          requestBody,
          timeoutMs,
          caPem,
        );

        if (verifyResponse.statusCode < 200 || verifyResponse.statusCode >= 300) {
          networkErrors.push(`${verifyUrl} -> HTTP ${verifyResponse.statusCode}`);
          continue;
        }

        const verifyBody = JSON.parse(
          verifyResponse.bodyText,
        ) as RecaptchaVerifyResponse;
        if (!verifyBody.success) {
          const errorCodes = Array.isArray(verifyBody['error-codes'])
            ? verifyBody['error-codes'].filter(Boolean)
            : [];
          const errorSuffix =
            errorCodes.length > 0 ? ` (${errorCodes.join(', ')})` : '';
          throw new BadRequestException(
            `Echec de verification reCAPTCHA${errorSuffix}.`,
          );
        }

        if (verifyBody.action && verifyBody.action !== expectedAction) {
          throw new BadRequestException('Action reCAPTCHA invalide.');
        }

        const minScore = this.getRecaptchaMinScore();
        if (typeof verifyBody.score !== 'number' || verifyBody.score < minScore) {
          const currentScore =
            typeof verifyBody.score === 'number'
              ? verifyBody.score.toFixed(2)
              : 'inconnu';
          throw new BadRequestException(
            `Score reCAPTCHA insuffisant (${currentScore} < ${minScore}).`,
          );
        }

        return verifyBody;
      } catch (error: any) {
        if (
          error instanceof BadRequestException ||
          error instanceof HttpException
        ) {
          throw error;
        }

        const errorMessage = String(error?.message || error || 'unknown error');
        const causeMessage = error?.cause?.message
          ? `; cause: ${String(error.cause.message)}`
          : '';
        networkErrors.push(`${verifyUrl} -> ${errorMessage}${causeMessage}`);
      }
    }

    const details = networkErrors.length > 0 ? ` (${networkErrors.join(' | ')})` : '';
    throw new HttpException(
      `Impossible de verifier reCAPTCHA pour le moment.${details}`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private checkForgotPasswordRateLimit(ipAddress: string) {
    const key = (ipAddress || 'unknown').trim() || 'unknown';
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    const existing = this.forgotPasswordIpLimits.get(key);
    if (!existing || now - existing.windowStart >= oneHour) {
      this.forgotPasswordIpLimits.set(key, { count: 1, windowStart: now });
      return;
    }

    if (existing.count >= 3) {
      throw new HttpException(
        'Trop de demandes. Reessayez dans une heure.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.count += 1;
    this.forgotPasswordIpLimits.set(key, existing);
  }

  private async sendPasswordResetEmail(
    email: string,
    prenom: string | null | undefined,
    token: string,
  ) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || '';
    const name = prenom || 'Utilisateur';
    const siteUrl = (process.env.PORTAIL_URL || 'https://pom.anam.dz')
      .trim()
      .replace(/\/+$/, '');
    const supportEmail = (process.env.SUPPORT_EMAIL || 'support@anam.dz').trim();
    const logoUrl = (
      process.env.MAIL_LOGO_URL || `${siteUrl}/logo.jpg`
    ).trim();
    const resetUrl = `${siteUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
    const subject = 'Reinitialisez votre mot de passe ANAM';

    const text = [
      `Bonjour ${name},`,
      '',
      'Nous avons recu une demande de reinitialisation de votre mot de passe ANAM.',
      '',
      `Cliquez sur ce lien pour continuer: ${resetUrl}`,
      '',
      'Ce lien est valable 15 minutes.',
      "Si vous n'avez pas demande cette reinitialisation, ignorez cet email.",
      '',
      "L'equipe ANAM",
      siteUrl,
      supportEmail,
    ].join('\n');

    const safeName = this.escapeHtml(name);
    const safeSiteUrl = this.escapeHtml(siteUrl);
    const safeSupportEmail = this.escapeHtml(supportEmail);
    const safeLogoUrl = this.escapeHtml(logoUrl);
    const safeResetUrl = this.escapeHtml(resetUrl);
    const html = `
      <div style="margin:0;padding:0;background:#f3f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7fb;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 24px 8px 24px;text-align:center;">
                    <img src="${safeLogoUrl}" alt="ANAM" style="display:block;margin:0 auto 12px auto;max-width:140px;height:auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 8px 24px;">
                    <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;color:#0f172a;">Reinitialisation de mot de passe</h1>
                    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.7;">Bonjour ${safeName},</p>
                    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;">
                      Vous avez demande la reinitialisation de votre mot de passe ANAM.
                      Cliquez sur le bouton ci-dessous pour definir un nouveau mot de passe.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 18px 24px;text-align:center;">
                    <a href="${safeResetUrl}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:10px;font-size:15px;">
                      Reinitialiser mon mot de passe
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 16px 24px;">
                    <p style="margin:0 0 8px 0;font-size:14px;line-height:1.7;color:#0f172a;">
                      Ce lien est valable <strong>15 minutes</strong>.
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
                      Si vous n'avez pas demande cette reinitialisation, ignorez cet email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 24px 24px;border-top:1px solid #e2e8f0;">
                    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#64748b;">Merci,<br />L'equipe ANAM</p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                      <a href="${safeSiteUrl}" style="color:#1d4ed8;text-decoration:none;">${safeSiteUrl}</a>
                      &nbsp;|&nbsp;
                      <a href="mailto:${safeSupportEmail}" style="color:#1d4ed8;text-decoration:none;">${safeSupportEmail}</a>
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

  private async sendProfileUpdateOtpEmail(
    email: string,
    prenom: string | undefined,
    code: string,
  ) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || '';
    const name = prenom || 'Utilisateur';
    const siteUrl = (process.env.PORTAIL_URL || 'https://pom.anam.dz')
      .trim()
      .replace(/\/+$/, '');
    const supportEmail = (process.env.SUPPORT_EMAIL || 'support@anam.dz').trim();
    const logoUrl = (process.env.MAIL_LOGO_URL || `${siteUrl}/logo.jpg`).trim();
    const subject = `Validation de modification de profil ANAM - ${code}`;
    const text = [
      `Bonjour ${name},`,
      '',
      'Un changement de vos informations personnelles a ete demande sur votre compte ANAM.',
      '',
      `Code OTP: ${code}`,
      '',
      'Ce code est valable 10 minutes.',
      'Si vous n etes pas a l origine de cette demande, ne partagez pas ce code et contactez le support.',
      '',
      "L'equipe ANAM",
      siteUrl,
      supportEmail,
    ].join('\n');

    const safeName = this.escapeHtml(name);
    const safeCode = this.escapeHtml(code);
    const safeSiteUrl = this.escapeHtml(siteUrl);
    const safeSupportEmail = this.escapeHtml(supportEmail);
    const safeLogoUrl = this.escapeHtml(logoUrl);
    const html = `
      <div style="margin:0;padding:0;background:#f3f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7fb;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 24px 8px 24px;text-align:center;">
                    <img src="${safeLogoUrl}" alt="ANAM" style="display:block;margin:0 auto 12px auto;max-width:140px;height:auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 8px 24px;">
                    <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#0f172a;">Validation de modification de profil</h1>
                    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.7;">Bonjour ${safeName},</p>
                    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;">
                      Une demande de mise a jour de vos informations personnelles a ete initiee sur votre compte ANAM.
                      Saisissez le code ci-dessous pour confirmer cette operation.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 16px 24px;">
                    <div style="text-align:center;border:2px solid #085041;border-radius:10px;padding:18px;background:#f3fbf8;">
                      <span style="font-size:34px;letter-spacing:6px;font-weight:700;color:#085041;">${safeCode}</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 16px 24px;">
                    <p style="margin:0 0 8px 0;font-size:14px;line-height:1.7;color:#0f172a;">
                      Ce code est valable <strong>10 minutes</strong>.
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
                      Si vous n'etes pas a l'origine de cette demande, ignorez cet email et contactez le support.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 24px 24px;border-top:1px solid #e2e8f0;">
                    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#64748b;">Merci,<br />L'equipe ANAM</p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                      <a href="${safeSiteUrl}" style="color:#085041;text-decoration:none;">${safeSiteUrl}</a>
                      &nbsp;|&nbsp;
                      <a href="mailto:${safeSupportEmail}" style="color:#085041;text-decoration:none;">${safeSupportEmail}</a>
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

  private async getAuthenticatedUserSession(token: string) {
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      throw new HttpException('Session invalide.', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.sessionService.validateSession(cleanToken);
    if (!session?.user?.id) {
      throw new HttpException('Session invalide.', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.findUserWithRoleById(session.user.id);
    if (!user) {
      throw new HttpException('Utilisateur introuvable.', HttpStatus.UNAUTHORIZED);
    }

    return { session, user, token: cleanToken };
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
          lastProfileUpdateAt: user.lastProfileUpdateAt,
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
        lastProfileUpdateAt: currentUser.lastProfileUpdateAt,
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

  async getProfileUpdateStatus(token: string) {
    const { user } = await this.getAuthenticatedUserSession(token);
    return this.getProfileUpdateStatusPayload(user);
  }

  async requestProfileUpdate(
    token: string,
    body: {
      Prenom?: string;
      nom?: string;
      email?: string;
      telephone?: string | null;
      password?: string;
      confirmPassword?: string;
    },
  ) {
    const { user } = await this.getAuthenticatedUserSession(token);
    this.assertProfileUpdateWindow(user);

    const pendingData = await this.buildPendingProfileUpdateData(user, body);
    const otpCode = this.generateOtp();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + PROFILE_UPDATE_OTP_TTL_MS);
    const resendKey = `profile-update:${user.id}`;

    this.checkProfileUpdateResendLimit(resendKey);

    await this.prisma.utilisateurPortail.update({
      where: { id: user.id },
      data: {
        profileUpdatePendingData: pendingData as any,
        profileUpdateOtpHash: otpHash,
        profileUpdateOtpExpiresAt: expiresAt,
        profileUpdateOtpRequestedAt: new Date(),
      },
    });

    await this.sendProfileUpdateOtpEmail(user.email, user.Prenom, otpCode);

    return {
      message:
        'Un code OTP a ete envoye a votre adresse email actuelle pour confirmer les modifications.',
      expiresAt,
      resendAvailableAt: new Date(Date.now() + 60 * 1000),
    };
  }

  async resendProfileUpdateOtp(token: string) {
    const { user } = await this.getAuthenticatedUserSession(token);
    this.assertProfileUpdateWindow(user);

    if (!user.profileUpdatePendingData) {
      throw new BadRequestException(
        'Aucune demande de modification en attente a confirmer.',
      );
    }

    const resendKey = `profile-update:${user.id}`;
    this.checkProfileUpdateResendLimit(resendKey);

    const otpCode = this.generateOtp();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + PROFILE_UPDATE_OTP_TTL_MS);

    await this.prisma.utilisateurPortail.update({
      where: { id: user.id },
      data: {
        profileUpdateOtpHash: otpHash,
        profileUpdateOtpExpiresAt: expiresAt,
        profileUpdateOtpRequestedAt: new Date(),
      },
    });

    await this.sendProfileUpdateOtpEmail(user.email, user.Prenom, otpCode);

    return {
      message: 'Un nouveau code OTP a ete envoye.',
      expiresAt,
      resendAvailableAt: new Date(Date.now() + 60 * 1000),
    };
  }

  async verifyProfileUpdate(token: string, body: { code: string }) {
    const { user, session } = await this.getAuthenticatedUserSession(token);
    this.assertProfileUpdateWindow(user);

    const attemptKey = `profile-update:${user.id}`;
    this.checkProfileUpdateAttemptLimit(attemptKey);

    const pendingData = user.profileUpdatePendingData as PendingProfileUpdateData | null;
    if (
      !pendingData ||
      !user.profileUpdateOtpHash ||
      !user.profileUpdateOtpExpiresAt ||
      user.profileUpdateOtpExpiresAt.getTime() < Date.now()
    ) {
      this.recordProfileUpdateFailedAttempt(attemptKey);
      throw new BadRequestException(
        'Le code OTP est invalide ou expire. Veuillez recommencer.',
      );
    }

    const code = String(body?.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Veuillez saisir un code OTP a 6 chiffres.');
    }

    const isValid = await bcrypt.compare(code, user.profileUpdateOtpHash);
    if (!isValid) {
      this.recordProfileUpdateFailedAttempt(attemptKey);
      throw new BadRequestException('Le code OTP est invalide ou expire.');
    }

    const now = new Date();
    const updateData: Record<string, any> = {
      Prenom: pendingData.Prenom,
      nom: pendingData.nom,
      email: pendingData.email,
      telephone: pendingData.telephone,
      lastProfileUpdateAt: now,
      profileUpdatePendingData: null,
      profileUpdateOtpHash: null,
      profileUpdateOtpExpiresAt: null,
      profileUpdateOtpRequestedAt: null,
    };

    if (pendingData.passwordChanged && pendingData.passwordHash) {
      updateData.password = pendingData.passwordHash;
    }

    await this.prisma.$transaction([
      this.prisma.utilisateurPortail.update({
        where: { id: user.id },
        data: updateData,
      }),
      ...(pendingData.passwordChanged
        ? [
            this.prisma.sessionPortail.deleteMany({
              where: {
                userId: user.id,
                NOT: { token: session.token },
              },
            }),
          ]
        : []),
    ]);

    this.clearProfileUpdateAttemptLimit(attemptKey);

    const updatedUser = await this.findUserWithRoleById(user.id);
    if (!updatedUser) {
      throw new HttpException(
        'Impossible de recharger le profil apres modification.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const identificationState = await this.resolveIdentificationAccessState(
      updatedUser.id,
      Boolean(updatedUser.entreprise_verified),
      updatedUser.detenteurId,
    );
    const hasEntreprise = Boolean(updatedUser.detenteurId);
    const identificationStatus = hasEntreprise
      ? updatedUser.entreprise_verified
        ? 'CONFIRMEE'
        : identificationState === 'PENDING'
          ? 'EN_ATTENTE'
          : 'EN_ATTENTE'
      : null;

    return {
      message: 'Vos informations personnelles ont ete mises a jour avec succes.',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        nom: updatedUser.nom,
        Prenom: updatedUser.Prenom,
        telephone: updatedUser.telephone,
        createdAt: updatedUser.createdAt,
        lastProfileUpdateAt: updatedUser.lastProfileUpdateAt,
        entreprise_verified: updatedUser.entreprise_verified ?? false,
        identification_status: identificationStatus,
        first_login_after_confirmation: Boolean(
          updatedUser.first_login_after_confirmation,
        ),
        role: updatedUser.role?.name,
        permissions:
          updatedUser.role?.rolePermissions.map(
            (rp: any) => rp.permission.name,
          ) || [],
      },
    };
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
        `Trop de tentatives. Réessayez dans ${wait}s`,
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

  private checkProfileUpdateResendLimit(userKey: string) {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const cooldownMs = 60 * 1000;

    let entry = this.profileUpdateResendLimits.get(userKey);
    if (!entry || now - entry.windowStart > oneHour) {
      entry = { count: 0, windowStart: now, cooldownUntil: 0 };
    }

    if (entry.count >= 3 && now - entry.windowStart < oneHour) {
      throw new HttpException(
        'Limite de renvoi OTP atteinte. Reessayez dans une heure.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (entry.cooldownUntil > now) {
      const wait = Math.ceil((entry.cooldownUntil - now) / 1000);
      throw new HttpException(
        `Veuillez attendre ${wait}s avant de renvoyer un nouveau code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count += 1;
    entry.cooldownUntil = now + cooldownMs;
    this.profileUpdateResendLimits.set(userKey, entry);
  }

  private checkProfileUpdateAttemptLimit(userKey: string) {
    const now = Date.now();
    const entry = this.profileUpdateAttemptLimits.get(userKey) || { count: 0 };
    if (entry.blockedUntil && now < entry.blockedUntil) {
      const wait = Math.ceil((entry.blockedUntil - now) / 1000);
      throw new HttpException(
        `Trop de tentatives OTP. Reessayez dans ${wait}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return entry;
  }

  private recordProfileUpdateFailedAttempt(userKey: string) {
    const now = Date.now();
    const entry = this.profileUpdateAttemptLimits.get(userKey) || { count: 0 };
    entry.count += 1;
    if (entry.count >= 5) {
      entry.blockedUntil = now + 15 * 60 * 1000;
    }
    this.profileUpdateAttemptLimits.set(userKey, entry);
  }

  private clearProfileUpdateAttemptLimit(userKey: string) {
    this.profileUpdateAttemptLimits.delete(userKey);
  }

  private assertProfileUpdateWindow(user: any) {
    const status = this.getProfileUpdateStatusPayload(user);
    if (!status.canEdit) {
      throw new HttpException(
        status.cooldownMessage ||
          'Vous avez deja modifie vos informations personnelles recemment.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return status;
  }

  private async buildPendingProfileUpdateData(
    user: any,
    body: {
      Prenom?: string;
      nom?: string;
      email?: string;
      telephone?: string | null;
      password?: string;
      confirmPassword?: string;
    },
  ): Promise<PendingProfileUpdateData> {
    const nextPrenom = (body.Prenom || '').trim();
    const nextNom = (body.nom || '').trim();
    const nextEmail = this.normalizeEmail(body.email || '');
    const nextTelephone = this.normalizePhone(body.telephone);
    const password = body.password || '';
    const confirmPassword = body.confirmPassword || '';

    if (!nextPrenom) {
      throw new BadRequestException('Le prenom est requis.');
    }

    if (!nextNom) {
      throw new BadRequestException('Le nom est requis.');
    }

    if (!nextEmail || !this.isValidEmail(nextEmail)) {
      throw new BadRequestException('Veuillez entrer une adresse email valide.');
    }

    if (!this.isValidPhone(nextTelephone)) {
      throw new BadRequestException(
        'Veuillez entrer un numero de telephone valide (10 chiffres commencant par 0).',
      );
    }

    if (nextEmail !== this.normalizeEmail(user.email)) {
      const existingEmail = await this.prisma.utilisateurPortail.findFirst({
        where: {
          email: nextEmail,
          NOT: { id: user.id },
        },
        select: { id: true },
      });
      if (existingEmail) {
        throw new BadRequestException('Cette adresse email est deja utilisee.');
      }
    }

    if (nextTelephone !== this.normalizePhone(user.telephone)) {
      const existingPhone = await this.prisma.utilisateurPortail.findFirst({
        where: {
          telephone: nextTelephone,
          NOT: { id: user.id },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existingPhone) {
        throw new BadRequestException(
          'Ce numero de telephone est deja utilise.',
        );
      }
    }

    let passwordHash: string | null = null;
    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        throw new BadRequestException(
          'La confirmation du mot de passe ne correspond pas.',
        );
      }
      if (!this.isStrongPassword(password)) {
        throw new BadRequestException(
          'Le mot de passe doit contenir au moins 8 caracteres, une majuscule, un chiffre et un symbole.',
        );
      }
      passwordHash = await bcrypt.hash(password, 10);
    }

    const hasChanges =
      nextPrenom !== user.Prenom ||
      nextNom !== user.nom ||
      nextEmail !== this.normalizeEmail(user.email) ||
      nextTelephone !== this.normalizePhone(user.telephone) ||
      Boolean(passwordHash);

    if (!hasChanges) {
      throw new BadRequestException('Aucune modification detectee.');
    }

    return {
      Prenom: nextPrenom,
      nom: nextNom,
      email: nextEmail,
      telephone: nextTelephone,
      passwordHash,
      passwordChanged: Boolean(passwordHash),
    };
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
    if (!this.isStrongPassword(body.password || '')) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins 8 caracteres, une majuscule, un chiffre et un symbole.',
      );
    }

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

    const phone = this.normalizePhone(body.telephone);
    if (!phone) {
      throw new Error('Telephone requis');
    }
    const isValidPhone = this.isValidPhone(phone);
    if (!isValidPhone) {
      throw new Error(
        'Veuillez entrer un numéro de téléphone valide (10 chiffres commençant par 0)',
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
        throw new Error("Numéro de téléphone déja utilisé");
      }
    }

    if (existingUser?.emailVerified) {
      throw new Error('Email déja vérifié');
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

    return { message: 'Code envoyé', userId: user.id };
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
      throw new Error('Email déja  vérifié');
    }

    this.checkAttemptLimit(normalizedEmail);
    const now = Date.now();
    if (
      !user.verificationCode ||
      !user.verificationCodeExpires ||
      user.verificationCodeExpires.getTime() < now
    ) {
      this.recordFailedAttempt(normalizedEmail);
      throw new Error('Code invalide ou expiré');
    }

    const match = await bcrypt.compare(code, user.verificationCode);
    if (!match) {
      this.recordFailedAttempt(normalizedEmail);
      throw new Error('Code invalide ou expiré');
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
      throw new Error('Utilisateur introuvable après vérification');
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
      throw new Error('Email déja  vérifié');
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

    return { message: 'Code renvoyé' };
  }

  async forgotPassword(email: string, ipAddress: string) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      throw new BadRequestException('Email requis.');
    }

    this.checkForgotPasswordRateLimit(ipAddress);

    const genericResponse = { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };

    const user = await this.prisma.utilisateurPortail.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, Prenom: true },
    });
    if (!user) {
      return genericResponse;
    }

    const plainToken = this.generatePasswordResetToken();
    const tokenHash = this.hashPasswordResetToken(plainToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const resetTokenData: Record<string, unknown> = {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpires: expiresAt,
      passwordResetTokenUsedAt: null,
    };

    await this.prisma.utilisateurPortail.update({
      where: { id: user.id },
      data: resetTokenData as any,
    });

    try {
      await this.sendPasswordResetEmail(user.email, user.Prenom, plainToken);
    } catch (error) {
      // Keep the same client response to avoid account/email enumeration.
      console.error('Failed to send password reset email:', error);
    }

    return genericResponse;
  }

  async resetPassword(token: string, newPassword: string, confirmPassword: string) {
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      throw new BadRequestException('Lien invalide ou expire.');
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('La confirmation du mot de passe ne correspond pas.');
    }

    if (!this.isStrongPassword(newPassword || '')) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins 8 caracteres, une majuscule, un chiffre et un symbole.',
      );
    }

    const tokenHash = this.hashPasswordResetToken(cleanToken);
    const resetTokenWhere: Record<string, unknown> = {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenUsedAt: null,
      passwordResetTokenExpires: { gt: new Date() },
    };
    const user = await this.prisma.utilisateurPortail.findFirst({
      where: resetTokenWhere as any,
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('Le lien de reinitialisation est invalide ou expire.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const resetTokenCleanupData: Record<string, unknown> = {
      password: hashedPassword,
      passwordResetTokenHash: null,
      passwordResetTokenExpires: null,
      passwordResetTokenUsedAt: new Date(),
    };
    await this.prisma.$transaction([
      this.prisma.utilisateurPortail.update({
        where: { id: user.id },
        data: resetTokenCleanupData as any,
      }),
      this.prisma.sessionPortail.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return { message: 'Votre mot de passe a ete modifie avec succes !' };
  }

}

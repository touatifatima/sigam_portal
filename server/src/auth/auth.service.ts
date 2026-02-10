// src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SessionService } from '../session/session.service';
import * as nodemailer from 'nodemailer';

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
    if (!host || !user || !pass) {
      throw new Error('SMTP non configuré (SMTP_HOST/SMTP_USER/SMTP_PASS)');
    }
    this.mailer = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    return this.mailer;
  }

  private normalizeEmail(email: string) {
    return (email || '').trim().toLowerCase();
  }

  private generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async sendOtpEmail(email: string, prenom: string | undefined, code: string) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || '';
    const name = prenom || 'Utilisateur';
    const subject = 'Votre code de vérification SIGAM';
    const text = `Bonjour ${name},\n\nVotre code est : ${code}\n\nValable 10 minutes. Ne le partagez jamais.\n`;
    await this.getMailer().sendMail({
      from,
      to: email,
      subject,
      text,
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
    return { user };
  }

  async login(user: any) {
    return this.withSessionLock(`login-${user.id}`, async () => {
      const session = await this.sessionService.createSession(user.id);

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

      await this.sessionService.extendSession(token);

      return {
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
        nom: session.user.nom,
        Prenom: session.user.Prenom,
        telephone: session.user.telephone,
        createdAt: session.user.createdAt,
        entreprise_verified: session.user.entreprise_verified ?? false,
        role: session.user.role?.name,
        permissions: session.user.role?.rolePermissions.map(
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
      throw new Error('Téléphone requis');
    }
    const isValidPhone =
      /^0\d{9}$/.test(phone) || /^\+\d{8,15}$/.test(phone);
    if (!isValidPhone) {
      throw new Error(
        'Veuillez entrer un numéro de téléphone valide (10 chiffres)',
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
        throw new Error("Numéro de téléphone déjà utilisé");
      }
    }

    if (existingUser?.emailVerified) {
      throw new Error('Email déjà utilisé');
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
      throw new Error('Email déjà vérifié');
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
      throw new Error('Email déjà vérifié');
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

}

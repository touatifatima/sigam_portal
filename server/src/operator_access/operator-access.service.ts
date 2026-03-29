import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';

const OPERATOR_ROLE_NAMES = ['operateur', 'operator'];

@Injectable()
export class OperatorAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  private normalizeEmail(email: string) {
    return String(email || '').trim().toLowerCase();
  }

  private normalizeCodeQr(codeqr: string) {
    return String(codeqr || '').trim();
  }

  private isStrongPassword(password: string) {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  }

  private isOperatorRole(roleName?: string | null) {
    const normalized = String(roleName || '').trim().toLowerCase();
    return OPERATOR_ROLE_NAMES.includes(normalized);
  }

  private isAdminRole(roleName?: string | null) {
    return String(roleName || '').trim().toLowerCase() === 'admin';
  }

  private async resolveOperatorRoleId() {
    const role = await this.prisma.role.findFirst({
      where: {
        OR: OPERATOR_ROLE_NAMES.map((name) => ({
          name: { equals: name, mode: 'insensitive' },
        })),
      },
      select: { id: true, name: true },
    });

    if (!role?.id) {
      throw new NotFoundException(
        "Role operateur introuvable. Verifiez vos donnees de reference (roles).",
      );
    }

    return role.id;
  }

  private sanitizeUsernameSeed(seed: string) {
    const cleaned = String(seed || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-._]+|[-._]+$/g, '');
    return cleaned || 'operateur';
  }

  private async generateUniqueUsername(seed: string) {
    const base = this.sanitizeUsernameSeed(seed);
    let candidate = base;
    let suffix = 1;

    // Keep checking until we find a free username.
    // Loop is bounded by uniqueness checks and low collision probability.
    while (
      await this.prisma.utilisateurPortail.findUnique({
        where: { username: candidate },
        select: { id: true },
      })
    ) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }

  private async findPermisByQrOrThrow(codeqr: string) {
    const normalizedCodeQr = this.normalizeCodeQr(codeqr);
    if (!normalizedCodeQr) {
      throw new BadRequestException('Le code QR est requis.');
    }

    const permis = await this.prisma.permisPortail.findFirst({
      where: { qr_code: normalizedCodeQr },
      include: {
        operator: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        detenteur: {
          select: {
            id_detenteur: true,
            short_code: true,
            nom_societeFR: true,
            nom_societeAR: true,
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
        statut: {
          select: {
            id: true,
            lib_statut: true,
          },
        },
      },
    });

    if (!permis) {
      throw new NotFoundException('Aucun permis trouve pour ce QR code.');
    }

    return permis;
  }

  private mapPermisSummary(permis: any) {
    return {
      id: permis.id,
      short_code: permis.short_code,
      code_permis: permis.code_permis,
      qr_code: permis.qr_code,
      id_detenteur: permis.id_detenteur,
      type_permis: permis.typePermis,
      statut: permis.statut,
      date_octroi: permis.date_octroi,
      date_expiration: permis.date_expiration,
    };
  }

  private mapDetenteurSummary(permis: any) {
    const detenteur = permis.detenteur;
    if (!detenteur) {
      return null;
    }

    return {
      id_detenteur: detenteur.id_detenteur,
      short_code: detenteur.short_code,
      nom: detenteur.nom_societeFR || detenteur.nom_societeAR || null,
      email: detenteur.email || null,
      telephone: detenteur.telephone || null,
    };
  }

  private mapOperatorSummary(permis: any) {
    const operator = permis.operator;
    if (!operator) {
      return null;
    }

    return {
      id: operator.id,
      email: operator.email,
      nom: operator.nom,
      Prenom: operator.Prenom,
      emailVerified: Boolean(operator.emailVerified),
      role: operator.role?.name || null,
    };
  }

  async getAccessContext(codeqr: string) {
    const permis = await this.findPermisByQrOrThrow(codeqr);

    const operatorLinkedAndVerified =
      Boolean(permis.operator?.id) && Boolean(permis.operator?.emailVerified);

    return {
      mode: operatorLinkedAndVerified ? 'LOGIN' : 'FIRST_ACCESS',
      permit: this.mapPermisSummary(permis),
      detenteur: this.mapDetenteurSummary(permis),
      operator: this.mapOperatorSummary(permis),
    };
  }

  async loginWithCodeQr(input: { codeqr: string; password: string }) {
    const { codeqr, password } = input;
    const plainPassword = String(password || '');
    if (!plainPassword) {
      throw new BadRequestException('Le mot de passe est requis.');
    }

    const permis = await this.findPermisByQrOrThrow(codeqr);
    const operator = permis.operator;

    if (!operator?.id) {
      throw new BadRequestException(
        "Aucun compte operateur n'est lie a ce permis. Utilisez le premier acces.",
      );
    }

    if (!this.isOperatorRole(operator.role?.name)) {
      throw new UnauthorizedException('Le compte lie a ce permis n\'est pas un operateur valide.');
    }

    if (!operator.emailVerified) {
      throw new UnauthorizedException('EMAIL_NOT_VERIFIED_OPERATOR');
    }

    const passwordOk = await bcrypt.compare(plainPassword, operator.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Mot de passe operateur invalide.');
    }

    const auth = await this.authService.login(operator);

    return {
      ...auth,
      permit: this.mapPermisSummary(permis),
      detenteur: this.mapDetenteurSummary(permis),
    };
  }

  async createAccess(input: { codeqr: string; email: string; password: string }) {
    const codeqr = this.normalizeCodeQr(input.codeqr);
    const email = this.normalizeEmail(input.email);
    const password = String(input.password || '');

    if (!codeqr) {
      throw new BadRequestException('Le code QR est requis.');
    }
    if (!email) {
      throw new BadRequestException('Email requis.');
    }
    if (!this.isStrongPassword(password)) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins 8 caracteres, une majuscule, un chiffre et un symbole.',
      );
    }

    const permis = await this.findPermisByQrOrThrow(codeqr);
    const operatorRoleId = await this.resolveOperatorRoleId();

    if (permis.operator?.id && permis.operator.emailVerified) {
      throw new ConflictException(
        'Un acces operateur est deja actif pour ce permis. Utilisez la page de connexion.',
      );
    }

    const existingByEmail = await this.prisma.utilisateurPortail.findUnique({
      where: { email },
      include: {
        role: true,
        operatedPermis: {
          select: { id: true, code_permis: true },
        },
      },
    });

    if (
      existingByEmail?.operatedPermis?.id &&
      existingByEmail.operatedPermis.id !== permis.id
    ) {
      throw new ConflictException(
        'Cet email est deja associe a un autre permis operateur.',
      );
    }

    let operatorUserId: number;
    const hashedPassword = await bcrypt.hash(password, 10);
    const detenteurId = permis.id_detenteur ?? null;

    if (permis.operator?.id) {
      if (this.normalizeEmail(permis.operator.email) !== email) {
        throw new ConflictException(
          'Un compte operateur existe deja pour ce permis avec un autre email.',
        );
      }

      const updated = await this.prisma.utilisateurPortail.update({
        where: { id: permis.operator.id },
        data: {
          password: hashedPassword,
          roleId: operatorRoleId,
          detenteurId,
          entreprise_verified: true,
          first_login_after_confirmation: false,
          emailVerified: false,
          verificationCode: null,
          verificationCodeExpires: null,
        },
        select: { id: true },
      });
      operatorUserId = updated.id;
    } else if (existingByEmail) {
      if (existingByEmail.emailVerified) {
        throw new ConflictException(
          'Un compte avec cet email existe deja. Utilisez un autre email pour ce permis.',
        );
      }

      if (!this.isOperatorRole(existingByEmail.role?.name)) {
        throw new ConflictException(
          'Cet email est deja utilise par un compte non operateur.',
        );
      }

      const updated = await this.prisma.utilisateurPortail.update({
        where: { id: existingByEmail.id },
        data: {
          password: hashedPassword,
          roleId: operatorRoleId,
          detenteurId,
          entreprise_verified: true,
          first_login_after_confirmation: false,
          emailVerified: false,
          verificationCode: null,
          verificationCodeExpires: null,
        },
        select: { id: true },
      });
      operatorUserId = updated.id;
    } else {
      const detenteurName =
        permis.detenteur?.nom_societeFR || permis.detenteur?.nom_societeAR || 'Operateur';
      const usernameSeed = email.split('@')[0] || `operateur-${permis.id}`;
      const username = await this.generateUniqueUsername(usernameSeed);

      const created = await this.prisma.utilisateurPortail.create({
        data: {
          email,
          password: hashedPassword,
          roleId: operatorRoleId,
          username,
          nom: detenteurName,
          Prenom: 'Operateur',
          telephone: null,
          detenteurId,
          entreprise_verified: true,
          first_login_after_confirmation: false,
          emailVerified: false,
        },
        select: { id: true },
      });
      operatorUserId = created.id;
    }

    await this.prisma.permisPortail.update({
      where: { id: permis.id },
      data: { operatorId: operatorUserId },
    });

    await this.authService.resendVerification(email);

    return {
      message:
        "Un code de verification a ete envoye. Finalisez l'activation pour acceder a votre espace operateur.",
      permit: this.mapPermisSummary(permis),
      operatorEmail: email,
    };
  }

  async verifyAccess(input: { codeqr: string; email: string; code: string }) {
    const codeqr = this.normalizeCodeQr(input.codeqr);
    const email = this.normalizeEmail(input.email);
    const code = String(input.code || '').trim();

    if (!codeqr) {
      throw new BadRequestException('Le code QR est requis.');
    }
    if (!email) {
      throw new BadRequestException('Email requis.');
    }
    if (!code) {
      throw new BadRequestException('Code de verification requis.');
    }

    const permis = await this.findPermisByQrOrThrow(codeqr);
    if (!permis.operator?.id) {
      throw new BadRequestException(
        "Aucun compte operateur n'est encore associe a ce permis.",
      );
    }

    if (this.normalizeEmail(permis.operator.email) !== email) {
      throw new UnauthorizedException('Cet email ne correspond pas au permis scanne.');
    }

    const auth = await this.authService.verifyEmail(email, code);

    if (auth?.user?.id !== permis.operator.id) {
      throw new UnauthorizedException('Le compte verifie ne correspond pas au permis scanne.');
    }

    return {
      ...auth,
      permit: this.mapPermisSummary(permis),
      detenteur: this.mapDetenteurSummary(permis),
      message: 'Acces active avec succes',
    };
  }

  private async resolveAuthenticatedUserFromCookie(authToken?: string) {
    const token = String(authToken || '').trim();
    if (!token) {
      throw new UnauthorizedException('Session invalide.');
    }

    const session = await this.sessionService.validateSession(token);
    if (!session?.user) {
      throw new UnauthorizedException('Session expiree ou invalide.');
    }

    return session.user;
  }

  async getDashboardContext(input: { codeqr?: string; authToken?: string }) {
    const user = await this.resolveAuthenticatedUserFromCookie(input.authToken);
    const isOperator = this.isOperatorRole(user.role?.name);
    const isAdmin = this.isAdminRole(user.role?.name);

    if (!isOperator && !isAdmin) {
      throw new UnauthorizedException('Acces reserve aux operateurs.');
    }

    let permis: any;
    const codeqr = this.normalizeCodeQr(input.codeqr || '');

    if (codeqr) {
      permis = await this.findPermisByQrOrThrow(codeqr);
    } else {
      permis = await this.prisma.permisPortail.findFirst({
        where: { operatorId: user.id },
        include: {
          operator: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          },
          detenteur: {
            select: {
              id_detenteur: true,
              short_code: true,
              nom_societeFR: true,
              nom_societeAR: true,
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
          statut: {
            select: {
              id: true,
              lib_statut: true,
            },
          },
        },
      });

      if (!permis) {
        throw new NotFoundException('Aucun permis associe a cet operateur.');
      }
    }

    if (!isAdmin && permis.operatorId !== user.id) {
      throw new UnauthorizedException('Ce permis n\'est pas lie a votre compte operateur.');
    }

    return {
      operator: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        Prenom: user.Prenom,
        role: user.role?.name || null,
      },
      permit: this.mapPermisSummary(permis),
      detenteur: this.mapDetenteurSummary(permis),
      highlightedPermitId: permis.id,
    };
  }
}

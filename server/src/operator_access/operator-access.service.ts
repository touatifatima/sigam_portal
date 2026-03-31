import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { EnumTypeFonction } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';

const OPERATOR_ROLE_NAMES = ['operateur', 'operator'];
const execFileAsync = promisify(execFile);

@Injectable()
export class OperatorAccessService {
  private readonly logger = new Logger(OperatorAccessService.name);

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

  private extractCodePermisCandidate(codeqr: string) {
    const raw = this.normalizeCodeQr(codeqr);
    if (!raw) {
      return '';
    }

    try {
      const parsed = new URL(raw);
      const fromQuery =
        parsed.searchParams.get('codeqr') ||
        parsed.searchParams.get('code_permis') ||
        parsed.searchParams.get('code');
      if (fromQuery) {
        return this.normalizeCodeQr(fromQuery);
      }
      const lastPath = parsed.pathname.split('/').filter(Boolean).pop();
      return this.normalizeCodeQr(lastPath || raw);
    } catch {
      return raw;
    }
  }

  private getPermisInclude() {
    return {
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
    } as const;
  }

  private async findPermisByQr(codeqr: string) {
    return this.prisma.permisPortail.findFirst({
      where: { qr_code: codeqr },
      include: this.getPermisInclude(),
    });
  }

  private async findPermisByCodePermis(codePermis: string) {
    return this.prisma.permisPortail.findFirst({
      where: { code_permis: codePermis },
      orderBy: { id: 'desc' },
      include: this.getPermisInclude(),
    });
  }

  private async bindQrCodeToPermisIfMissing(permisId: number, scannedCodeQr: string) {
    const code = this.normalizeCodeQr(scannedCodeQr);
    if (!code) {
      return;
    }

    try {
      await this.prisma.permisPortail.update({
        where: { id: permisId },
        data: { qr_code: code },
      });
    } catch (error) {
      this.logger.warn(
        `Impossible de lier qr_code="${code}" au permis ${permisId}: ${String(
          (error as Error)?.message || error,
        )}`,
      );
    }
  }

  private async tryAutoImportPermisFromCsv(codePermis: string) {
    const normalized = this.normalizeCodeQr(codePermis);
    if (!normalized || !/^[A-Za-z0-9._-]+$/.test(normalized)) {
      return false;
    }

    const scriptPath = path.resolve(process.cwd(), 'prisma', 'import_permis_case.ts');
    if (!fs.existsSync(scriptPath)) {
      return false;
    }

    try {
      await execFileAsync('npx', ['ts-node', scriptPath, `--code-permis=${normalized}`], {
        cwd: process.cwd(),
        windowsHide: true,
        timeout: 2 * 60 * 1000,
      });
      this.logger.log(`Import CSV auto execute pour code_permis=${normalized}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `Import CSV auto impossible pour code_permis=${normalized}: ${String(
          (error as Error)?.message || error,
        )}`,
      );
      return false;
    }
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

    const codePermisCandidate = this.extractCodePermisCandidate(normalizedCodeQr);

    let permis = await this.findPermisByQr(normalizedCodeQr);
    if (!permis && codePermisCandidate && codePermisCandidate !== normalizedCodeQr) {
      permis = await this.findPermisByQr(codePermisCandidate);
    }

    if (!permis && codePermisCandidate) {
      permis = await this.findPermisByCodePermis(codePermisCandidate);
      if (permis && !permis.qr_code) {
        await this.bindQrCodeToPermisIfMissing(permis.id, normalizedCodeQr);
        permis = await this.findPermisByQr(normalizedCodeQr);
      }
    }

    if (!permis && codePermisCandidate) {
      const imported = await this.tryAutoImportPermisFromCsv(codePermisCandidate);
      if (imported) {
        permis = await this.findPermisByCodePermis(codePermisCandidate);
        if (permis && !permis.qr_code) {
          await this.bindQrCodeToPermisIfMissing(permis.id, normalizedCodeQr);
          permis = await this.findPermisByQr(normalizedCodeQr);
        }
      }
    }

    if (!permis) {
      throw new NotFoundException(
        'Aucun permis trouve pour ce QR code. Verifiez le code ou importez le permis.',
      );
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

  private async getDetenteurIdentificationDetails(idDetenteur?: number | null) {
    const detenteurId = Number(idDetenteur || 0);
    if (!Number.isFinite(detenteurId) || detenteurId <= 0) {
      return null;
    }

    const detenteur = await this.prisma.detenteurMoralePortail.findUnique({
      where: { id_detenteur: detenteurId },
      include: {
        pays: true,
        nationaliteRef: true,
        FormeJuridiqueDetenteur: {
          include: {
            statutJuridique: true,
          },
          orderBy: { id_formeDetenteur: 'desc' },
          take: 1,
        },
        registreCommerce: {
          orderBy: { date_enregistrement: 'desc' },
          take: 1,
        },
        fonctions: {
          where: {
            type_fonction: {
              in: [
                EnumTypeFonction.Representant,
                EnumTypeFonction.Actionnaire,
                EnumTypeFonction.Representant_Actionnaire,
              ],
            },
          },
          include: {
            personne: {
              include: {
                pays: true,
                nationaliteRef: true,
              },
            },
          },
          orderBy: { id_fonctionDetent: 'asc' },
        },
      },
    });

    if (!detenteur) {
      return null;
    }

    const representantRow =
      detenteur.fonctions.find((row) => row.type_fonction === EnumTypeFonction.Representant) ||
      detenteur.fonctions.find(
        (row) => row.type_fonction === EnumTypeFonction.Representant_Actionnaire,
      ) ||
      null;

    const mapPersonne = (personne: any) => {
      if (!personne) return null;
      return {
        id_personne: personne.id_personne,
        nomFR: personne.nomFR ?? null,
        prenomFR: personne.prenomFR ?? null,
        nomAR: personne.nomAR ?? null,
        prenomAR: personne.prenomAR ?? null,
        qualification: personne.qualification ?? null,
        telephone: personne.telephone ?? null,
        email: personne.email ?? null,
        num_carte_identite: personne.num_carte_identite ?? null,
        pays: personne.pays
          ? {
              id_pays: personne.pays.id_pays,
              nom_pays: personne.pays.nom_pays,
            }
          : null,
        nationaliteRef: personne.nationaliteRef
          ? {
              id_nationalite: personne.nationaliteRef.id_nationalite,
              libelle: personne.nationaliteRef.libelle,
            }
          : null,
      };
    };

    const representant = representantRow
      ? {
          id_fonctionDetent: representantRow.id_fonctionDetent,
          type_fonction: representantRow.type_fonction,
          taux_participation: representantRow.taux_participation ?? null,
          personne: mapPersonne(representantRow.personne),
        }
      : null;

    const actionnaires = detenteur.fonctions
      .filter(
        (row) =>
          row.type_fonction === EnumTypeFonction.Actionnaire ||
          row.type_fonction === EnumTypeFonction.Representant_Actionnaire,
      )
      .map((row) => ({
        id_actionnaire: row.id_fonctionDetent,
        id_fonctionDetent: row.id_fonctionDetent,
        type_fonction: row.type_fonction,
        taux_participation: row.taux_participation ?? null,
        personne: mapPersonne(row.personne),
      }));

    const registre = detenteur.registreCommerce?.[0] ?? null;
    const forme = detenteur.FormeJuridiqueDetenteur?.[0] ?? null;

    return {
      detenteur: {
        id_detenteur: detenteur.id_detenteur,
        short_code: detenteur.short_code,
        nom_societeFR: detenteur.nom_societeFR ?? null,
        nom_societeAR: detenteur.nom_societeAR ?? null,
        adresse_siege: detenteur.adresse_siege ?? null,
        telephone: detenteur.telephone ?? null,
        email: detenteur.email ?? null,
        fax: detenteur.fax ?? null,
        site_web: detenteur.site_web ?? null,
        date_constitution: detenteur.date_constitution ?? null,
        pays: detenteur.pays
          ? {
              id_pays: detenteur.pays.id_pays,
              nom_pays: detenteur.pays.nom_pays,
            }
          : null,
        nationaliteRef: detenteur.nationaliteRef
          ? {
              id_nationalite: detenteur.nationaliteRef.id_nationalite,
              libelle: detenteur.nationaliteRef.libelle,
            }
          : null,
        statut_juridique: forme?.statutJuridique
          ? {
              id_statut: forme.statutJuridique.id_statutJuridique,
              code_statut: forme.statutJuridique.code_statut,
              statut_fr: forme.statutJuridique.statut_fr,
              statut_ar: forme.statutJuridique.statut_ar,
            }
          : null,
      },
      representant,
      registre: registre
        ? {
            id: registre.id,
            numero_rc: registre.numero_rc ?? null,
            date_enregistrement: registre.date_enregistrement ?? null,
            capital_social: registre.capital_social ?? null,
            nis: registre.nis ?? null,
            nif: registre.nif ?? null,
            adresse_legale: registre.adresse_legale ?? null,
          }
        : null,
      actionnaires,
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
    const detenteurIdentification = await this.getDetenteurIdentificationDetails(
      permis.id_detenteur,
    );

    return {
      ...auth,
      permit: this.mapPermisSummary(permis),
      detenteur: this.mapDetenteurSummary(permis),
      detenteurIdentification,
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

    const detenteurIdentification = await this.getDetenteurIdentificationDetails(
      permis.id_detenteur,
    );

    return {
      ...auth,
      permit: this.mapPermisSummary(permis),
      detenteur: this.mapDetenteurSummary(permis),
      detenteurIdentification,
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

    const userDetenteurId =
      Number.isFinite(Number((user as any)?.detenteurId)) &&
      Number((user as any)?.detenteurId) > 0
        ? Number((user as any)?.detenteurId)
        : null;
    const permisDetenteurId =
      Number.isFinite(Number(permis?.id_detenteur)) && Number(permis?.id_detenteur) > 0
        ? Number(permis.id_detenteur)
        : null;

    if (!isAdmin) {
      if (userDetenteurId && permisDetenteurId && userDetenteurId !== permisDetenteurId) {
        throw new UnauthorizedException(
          "Le detenteur du compte operateur ne correspond pas au detenteur du permis scanne.",
        );
      }

      if (!userDetenteurId && permisDetenteurId) {
        await this.prisma.utilisateurPortail.update({
          where: { id: user.id },
          data: { detenteurId: permisDetenteurId },
        });
      }
    }

    const detenteurIdentification = await this.getDetenteurIdentificationDetails(
      permisDetenteurId,
    );

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
      detenteurIdentification,
      highlightedPermitId: permis.id,
    };
  }
}

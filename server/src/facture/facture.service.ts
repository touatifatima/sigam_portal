import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DeviseFacture,
  FactureType,
  Prisma,
  StatutFacture,
} from '@prisma/client';
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { PrismaService } from 'src/prisma/prisma.service';

const FIXED_AMOUNT = 215000;

type FactureLine = {
  poste: string;
  base: string;
  montant: number;
  isTotal: boolean;
};

type DemandeWithType = Prisma.demandePortailGetPayload<{
  include: { typeProcedure: true; demInitial: true };
}>;

@Injectable()
export class FactureService {
  constructor(private readonly prisma: PrismaService) {}

  async generateInvestisseurFacture(id_demande: number) {
    console.log('[Facture] generateInvestisseurFacture start', { id_demande });

    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
      include: { typeProcedure: true, demInitial: true },
    });

    if (!demande) {
      throw new NotFoundException('Demande introuvable');
    }

    console.log('[Facture] demande loaded', {
      id_demande,
      hasDemInitial: !!demande.demInitial,
      typeProcedure: demande.typeProcedure?.libelle ?? null,
    });

    if (!this.isInitialDemande(demande)) {
      console.warn('[Facture] demande not initiale', { id_demande });
      throw new BadRequestException('Demande non initiale');
    }

    let facture = await this.prisma.facture.findUnique({
      where: { id_demande },
    });

    if (facture) {
      console.log('[Facture] facture exists', {
        id_facture: facture.id_facture,
        statut: facture.statut,
        numero_facture: facture.numero_facture,
      });
      if (facture.type_facture !== FactureType.INVESTISSEUR) {
        throw new BadRequestException('Type de facture incompatible');
      }

      if (facture.statut === StatutFacture.BROUILLON) {
        facture = await this.prisma.facture.update({
          where: { id_facture: facture.id_facture },
          data: {
            montant_total: FIXED_AMOUNT,
            date_emission: new Date(),
          },
        });
        console.log('[Facture] facture updated (brouillon)', {
          id_facture: facture.id_facture,
          montant_total: facture.montant_total,
          date_emission: facture.date_emission,
        });
      }

      if (!facture.numero_facture) {
        facture = await this.prisma.facture.update({
          where: { id_facture: facture.id_facture },
          data: { numero_facture: this.formatNumero(facture.id_facture) },
        });
        console.log('[Facture] facture numero updated', {
          id_facture: facture.id_facture,
          numero_facture: facture.numero_facture,
        });
      }

      return {
        facture,
        lignes: this.buildLines(),
      };
    }

    facture = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const created = await tx.facture.create({
        data: {
          id_demande,
          montant_total: FIXED_AMOUNT,
          devise: DeviseFacture.DZD,
          statut: StatutFacture.BROUILLON,
          type_facture: FactureType.INVESTISSEUR,
          numero_facture: `TEMP-${id_demande}-${Date.now()}`,
          date_emission: now,
        },
      });

      return tx.facture.update({
        where: { id_facture: created.id_facture },
        data: { numero_facture: this.formatNumero(created.id_facture) },
      });
    });

    console.log('[Facture] facture created', {
      id_facture: facture.id_facture,
      id_demande: facture.id_demande,
      numero_facture: facture.numero_facture,
      montant_total: facture.montant_total,
      devise: facture.devise,
      statut: facture.statut,
      date_emission: facture.date_emission,
      type_facture: facture.type_facture,
    });

    return {
      facture,
      lignes: this.buildLines(),
    };
  }

  async getFactureByDemande(id_demande: number) {
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
      include: { typeProcedure: true, demInitial: true },
    });

    if (!demande) {
      throw new NotFoundException('Demande introuvable');
    }

    if (!this.isInitialDemande(demande)) {
      throw new BadRequestException('Demande non initiale');
    }

    const facture = await this.prisma.facture.findUnique({
      where: { id_demande },
    });

    if (!facture) {
      return { facture: null, lignes: [] };
    }

    if (facture.type_facture !== FactureType.INVESTISSEUR) {
      throw new BadRequestException('Type de facture incompatible');
    }

    return {
      facture,
      lignes: this.buildLines(),
    };
  }

  async emettreFacture(id_facture: number) {
    console.log('[Facture] emettreFacture start', { id_facture });
    const facture = await this.prisma.facture.findUnique({
      where: { id_facture },
    });

    if (!facture) {
      throw new NotFoundException('Facture introuvable');
    }

    if (facture.type_facture !== FactureType.INVESTISSEUR) {
      throw new BadRequestException('Type de facture incompatible');
    }

    if (facture.statut !== StatutFacture.BROUILLON) {
      console.log('[Facture] facture deja emise', {
        id_facture: facture.id_facture,
        statut: facture.statut,
      });
      return { facture };
    }

    const updated = await this.prisma.facture.update({
      where: { id_facture },
      data: { statut: StatutFacture.EMISE, date_emission: new Date() },
    });

    console.log('[Facture] facture emise', {
      id_facture: updated.id_facture,
      statut: updated.statut,
      date_emission: updated.date_emission,
    });

    return { facture: updated };
  }

  async generateFacturePdf(id_facture: number) {
    type FactureWithDemande = Prisma.FactureGetPayload<{
      include: {
        demande: {
          include: {
            typeProcedure: true;
            typePermis: true;
            commune: true;
            daira: true;
            wilaya: true;
            demInitial: true;
            verificationGeo: true;
            inscriptionProvisoire: true;
            utilisateur: { include: { detenteur: true } };
            detenteurdemande: { include: { detenteur: true } };
            communes: {
              include: {
                commune: { include: { daira: { include: { wilaya: true } } } };
              };
            };
          };
        };
      };
    }>;

    let facture: FactureWithDemande | null = await this.prisma.facture.findUnique({
      where: { id_facture },
      include: {
        demande: {
          include: {
            typeProcedure: true,
            typePermis: true,
            commune: true,
            daira: true,
            wilaya: true,
            demInitial: true,
            verificationGeo: true,
            inscriptionProvisoire: true,
            utilisateur: { include: { detenteur: true } },
            detenteurdemande: { include: { detenteur: true } },
            communes: {
              include: { commune: { include: { daira: { include: { wilaya: true } } } } },
            },
          },
        },
      },
    });

    if (!facture) {
      throw new NotFoundException('Facture introuvable');
    }

    if (!facture.demande) {
      throw new NotFoundException('Demande introuvable');
    }

    if (!this.isInitialDemande(facture.demande)) {
      throw new BadRequestException('Demande non initiale');
    }

    let numeroFacture = facture.numero_facture;
    if (!numeroFacture) {
      numeroFacture = this.formatNumero(facture.id_facture);
      await this.prisma.facture.update({
        where: { id_facture: facture.id_facture },
        data: { numero_facture: numeroFacture },
      });
      facture = { ...facture, numero_facture: numeroFacture };
    }

    const formatDate = (date: Date | null) => {
      if (!date) return '--';
      try {
        return new Intl.DateTimeFormat('fr-DZ').format(date);
      } catch {
        return date.toISOString().slice(0, 10);
      }
    };

    const sanitizeText = (value: string) => {
      return String(value ?? '')
        .replace(/[\u00A0\u202F]/g, ' ')
        .replace(/[“”]/g, '"')
        .replace(/[’]/g, "'");
    };

    const formatMoney = (value: number | null) => {
      if (value == null || Number.isNaN(value)) return '--';
      try {
        const formatted = new Intl.NumberFormat('fr-DZ', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
        return sanitizeText(formatted);
      } catch {
        return sanitizeText(String(value));
      }
    };

    const pickName = (obj: any, keys: string[]) => {
      if (!obj) return null;
      if (typeof obj === 'string') return obj;
      for (const key of keys) {
        const val = obj?.[key];
        if (typeof val === 'string' && val.trim() !== '') return val;
      }
      return null;
    };

    const formatPersonName = (obj: any) => {
      if (!obj) return null;
      if (typeof obj === 'string') return obj;
      const company = pickName(obj, [
        'nom_societeFR',
        'nom_societeAR',
        'nom_societe',
        'raison_sociale',
        'nom_entreprise',
      ]);
      if (company) return company;
      const nom = pickName(obj, ['nom', 'nom_fr', 'nom_ar']);
      const prenom = pickName(obj, ['prenom', 'prenom_fr', 'prenom_ar']);
      if (nom && prenom) return `${nom} ${prenom}`.trim();
      return nom || prenom || null;
    };

    const demande = facture.demande;
    const detenteur =
      demande.detenteurdemande?.[0]?.detenteur ??
      demande.utilisateur?.detenteur ??
      null;
    const userName =
      [demande.utilisateur?.Prenom, demande.utilisateur?.nom]
        .filter(Boolean)
        .join(' ')
        .trim() || null;
    const titulaire =
      formatPersonName(detenteur) || userName || '--';

    const communeNames = new Set<string>();
    const dairaNames = new Set<string>();
    const wilayaNames = new Set<string>();
    if (Array.isArray(demande.communes) && demande.communes.length > 0) {
      demande.communes.forEach((item: any) => {
        const c = item?.commune;
        const cName =
          pickName(c, ['nom_communeFR', 'nom_communeAR', 'nom_commune']) ??
          null;
        if (cName) communeNames.add(cName);
        const dName = pickName(c?.daira, ['nom_dairaFR', 'nom_dairaAR', 'nom_daira']);
        if (dName) dairaNames.add(dName);
        const wName = pickName(
          c?.daira?.wilaya ?? c?.wilaya,
          ['nom_wilayaFR', 'nom_wilayaAR', 'nom_wilaya'],
        );
        if (wName) wilayaNames.add(wName);
      });
    } else {
      const cName = pickName(demande.commune, [
        'nom_communeFR',
        'nom_communeAR',
        'nom_commune',
      ]);
      const dName = pickName(demande.daira, [
        'nom_dairaFR',
        'nom_dairaAR',
        'nom_daira',
      ]);
      const wName = pickName(demande.wilaya, [
        'nom_wilayaFR',
        'nom_wilayaAR',
        'nom_wilaya',
      ]);
      if (cName) communeNames.add(cName);
      if (dName) dairaNames.add(dName);
      if (wName) wilayaNames.add(wName);
    }

    const localisationParts = [
      Array.from(communeNames).join(', '),
      Array.from(dairaNames).join(', '),
      Array.from(wilayaNames).join(', '),
    ].filter((v) => v && v.trim() !== '');
    const localisation = localisationParts.length
      ? localisationParts.join(' - ')
      : '--';

    let substancesText = '--';
    if (demande.id_proc) {
      const subs = await this.prisma.substanceAssocieeDemande.findMany({
        where: { id_proc: demande.id_proc },
        include: { substance: true },
      });
      const sorted = subs.sort((a, b) => {
        const pa = String(a?.priorite || '').toLowerCase() === 'principale' ? 0 : 1;
        const pb = String(b?.priorite || '').toLowerCase() === 'principale' ? 0 : 1;
        return pa - pb;
      });
      const names = sorted
        .map((s) => s.substance?.nom_subFR || s.substance?.nom_subAR)
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '');
      const unique = Array.from(new Set(names));
      if (unique.length) {
        substancesText = unique.join(', ');
      }
    }

    const superficie =
      demande.verificationGeo?.superficie_cadastrale ??
      demande.inscriptionProvisoire?.superficie_declaree ??
      demande.superficie ??
      null;
    const superficieText =
      superficie != null && Number.isFinite(superficie)
        ? `${superficie.toFixed(2)} ha`
        : '--';

    const devise = facture.devise === DeviseFacture.DZD ? 'DA' : facture.devise;

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { height, width } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const marginX = 50;
    const contentWidth = width - marginX * 2;
    const brand = rgb(0.49, 0.23, 0.82);
    const brandSoft = rgb(0.96, 0.94, 0.99);
    const textColor = rgb(0.12, 0.12, 0.16);
    const muted = rgb(0.4, 0.4, 0.45);
    const tableHeader = rgb(0.94, 0.94, 0.97);
    const border = rgb(0.86, 0.86, 0.9);

    page.drawRectangle({
      x: 0,
      y: height - 110,
      width,
      height: 110,
      color: brandSoft,
    });

    page.drawText('SIGAM', {
      x: marginX,
      y: height - 62,
      size: 22,
      font: fontBold,
      color: brand,
    });

    const drawRight = (
      text: string,
      y: number,
      size: number,
      currentFont: PDFFont,
      color = textColor,
    ) => {
      const safeText = sanitizeText(text);
      const textWidth = currentFont.widthOfTextAtSize(safeText, size);
      page.drawText(safeText, {
        x: width - marginX - textWidth,
        y,
        size,
        font: currentFont,
        color,
      });
    };

    drawRight('FACTURE', height - 62, 18, fontBold, brand);
    drawRight(`N° ${numeroFacture ?? facture.id_facture}`, height - 82, 10, font, muted);
    drawRight(
      `Date émission : ${formatDate(facture.date_emission ?? null)}`,
      height - 98,
      10,
      font,
      muted,
    );

    let y = height - 140;

    page.drawText('Informations de la demande', {
      x: marginX,
      y,
      size: 13,
      font: fontBold,
      color: brand,
    });
    y -= 12;
    page.drawRectangle({
      x: marginX,
      y,
      width: contentWidth,
      height: 1,
      color: border,
    });
    y -= 16;

    const wrapText = (
      text: string,
      maxWidth: number,
      currentFont: PDFFont,
      size: number,
    ) => {
      const words = sanitizeText(text).split(' ');
      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (currentFont.widthOfTextAtSize(next, size) > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
      return lines.length ? lines : [''];
    };

    const labelSize = 9;
    const valueSize = 11;
    const valueLineHeight = 14;
    const colGap = 22;
    const colWidth = (contentWidth - colGap) / 2;

    const drawField = (
      x: number,
      yPos: number,
      label: string,
      value: string,
      maxWidth: number,
    ) => {
      page.drawText(sanitizeText(label.toUpperCase()), {
        x,
        y: yPos,
        size: labelSize,
        font: font,
        color: muted,
      });
      const lines = wrapText(value || '--', maxWidth, font, valueSize);
      let currentY = yPos - labelSize - 4;
      lines.forEach((line) => {
        page.drawText(sanitizeText(line), {
          x,
          y: currentY,
          size: valueSize,
          font,
          color: textColor,
        });
        currentY -= valueLineHeight;
      });
      return labelSize + 4 + lines.length * valueLineHeight + 6;
    };

    const rows = [
      {
        left: {
          label: 'Code demande',
          value: demande.code_demande ?? '--',
        },
        right: {
          label: 'Type de procédure',
          value: demande.typeProcedure?.libelle ?? '--',
        },
      },
      {
        left: {
          label: 'Type de permis',
          value: demande.typePermis?.lib_type ?? '--',
        },
        right: {
          label: 'Titulaire',
          value: titulaire,
        },
      },
      {
        left: {
          label: 'Localisation',
          value: localisation,
        },
        right: {
          label: 'Superficie',
          value: superficieText,
        },
      },
    ];

    for (const row of rows) {
      const leftHeight = row.left
        ? drawField(marginX, y, row.left.label, row.left.value, colWidth)
        : 0;
      const rightHeight = row.right
        ? drawField(
            marginX + colWidth + colGap,
            y,
            row.right.label,
            row.right.value,
            colWidth,
          )
        : 0;
      const rowHeight = Math.max(leftHeight, rightHeight);
      y -= rowHeight + 4;
    }

    const substanceHeight = drawField(
      marginX,
      y,
      'Substances',
      substancesText,
      contentWidth,
    );
    y -= substanceHeight + 8;

    page.drawText('Détail des montants', {
      x: marginX,
      y,
      size: 13,
      font: fontBold,
      color: brand,
    });
    y -= 18;

    const tableX = marginX;
    const tableWidth = contentWidth;
    const col1 = tableWidth * 0.42;
    const col2 = tableWidth * 0.38;
    const col3 = tableWidth - col1 - col2;
    const headerHeight = 22;

    page.drawRectangle({
      x: tableX,
      y: y - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: tableHeader,
    });
    page.drawText('Poste', {
      x: tableX + 8,
      y: y - 15,
      size: 9,
      font: fontBold,
      color: muted,
    });
    page.drawText('Base de calcul', {
      x: tableX + col1 + 8,
      y: y - 15,
      size: 9,
      font: fontBold,
      color: muted,
    });
    drawRight('Montant', y - 15, 9, fontBold, muted);

    y -= headerHeight + 6;

    const lines = this.buildLines();
    for (const row of lines) {
      const posteLines = wrapText(row.poste, col1 - 12, font, valueSize);
      const baseLines = wrapText(row.base, col2 - 12, font, valueSize);
      const maxLines = Math.max(posteLines.length, baseLines.length, 1);
      const rowHeight = maxLines * valueLineHeight + 8;

      const rowRect = {
        x: tableX,
        y: y - rowHeight + 2,
        width: tableWidth,
        height: rowHeight,
        borderColor: border,
        borderWidth: 0.5,
        ...(row.isTotal ? { color: brandSoft } : {}),
      };
      page.drawRectangle(rowRect);

      let textY = y - valueSize;
      for (let i = 0; i < maxLines; i += 1) {
        page.drawText(sanitizeText(posteLines[i] ?? ''), {
          x: tableX + 8,
          y: textY,
          size: valueSize,
          font,
          color: textColor,
        });
        page.drawText(sanitizeText(baseLines[i] ?? ''), {
          x: tableX + col1 + 8,
          y: textY,
          size: valueSize,
          font,
          color: textColor,
        });
        if (i === 0) {
          drawRight(
            `${formatMoney(row.montant)} ${devise}`,
            textY,
            valueSize,
            fontBold,
            row.isTotal ? brand : textColor,
          );
        }
        textY -= valueLineHeight;
      }
      y -= rowHeight + 4;
    }

    const totalText = `${formatMoney(facture.montant_total)} ${devise}`;
    page.drawRectangle({
      x: tableX,
      y: y - 26,
      width: tableWidth,
      height: 26,
      color: brandSoft,
    });
    page.drawText('TOTAL', {
      x: tableX + 8,
      y: y - 18,
      size: 11,
      font: fontBold,
      color: brand,
    });
    drawRight(totalText, y - 18, 11, fontBold, brand);
    y -= 40;

    const footerLines = wrapText(
      `Cette facture est un récapitulatif des droits et taxes applicables à votre demande. ${totalText} sera exigible après validation de votre dossier. Paiement sécurisé SIGAM.`,
      contentWidth,
      font,
      8,
    );
    let footerY = 52;
    footerLines.forEach((line) => {
      page.drawText(line, {
        x: marginX,
        y: footerY,
        size: 8,
        font,
        color: muted,
      });
      footerY -= 10;
    });

    const buffer = Buffer.from(await pdfDoc.save());
    const filename = `facture-${numeroFacture ?? facture.id_facture}.pdf`;
    return { buffer, filename };
  }

  private isInitialDemande(demande: DemandeWithType) {
    if (demande.demInitial) {
      return true;
    }
    const label = demande.typeProcedure?.libelle?.toLowerCase() ?? '';
    return label.includes('demande');
  }

  private buildLines(): FactureLine[] {
    return [
      {
        poste: "Frais d'inscription et d'étude de dossier",
        base: 'Montant fixe pour nouvelle demande de permis',
        montant: FIXED_AMOUNT,
        isTotal: true,
      },
    ];
  }

  private formatNumero(id_facture: number) {
    return `FAC-${id_facture.toString().padStart(5, '0')}`;
  }
}

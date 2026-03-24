import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DeviseFacture,
  FactureType,
  Prisma,
  StatutFacture,
} from '@prisma/client';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { PrismaService } from 'src/prisma/prisma.service';

const FIXED_AMOUNT = 215000;

type FactureLine = {
  poste: string;
  base: string;
  montant: number;
  isTotal: boolean;
};

type LogoAsset = {
  bytes: Uint8Array;
  type: 'png' | 'jpg';
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

    if (!this.isFacturableDemande(demande)) {
      console.warn('[Facture] demande non facturable', { id_demande });
      throw new BadRequestException('Demande non facturable');
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
        lignes: this.buildLines(demande),
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
      lignes: this.buildLines(demande),
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

    if (!this.isFacturableDemande(demande)) {
      throw new BadRequestException('Demande non facturable');
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
      lignes: this.buildLines(demande),
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

    if (!this.isFacturableDemande(facture.demande)) {
      throw new BadRequestException('Demande non facturable');
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
      const normalized = String(value ?? '')
        .replace(/[\u00A0\u202F]/g, ' ')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2019]/g, "'")
        .replace(/[\r\n\t]+/g, ' ')
        .trim();

      const safe = Array.from(normalized)
        .map((char) => {
          const code = char.charCodeAt(0);
          if (code >= 32 && code <= 255) return char;
          return ' ';
        })
        .join('')
        .replace(/\s{2,}/g, ' ')
        .trim();

      return safe || '--';
    };

    const formatMoney = (value: number | null | unknown) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return '--';
      try {
        const formatted = new Intl.NumberFormat('fr-DZ', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(numeric);
        return sanitizeText(formatted);
      } catch {
        return sanitizeText(String(numeric));
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
    const logoAsset = await this.loadAnamLogoAsset();
    const marginX = 50;
    const contentWidth = width - marginX * 2;
    const brand = rgb(0.545, 0.227, 0.384);
    const brandDark = rgb(0.36, 0.14, 0.26);
    const brandSoft = rgb(0.985, 0.95, 0.97);
    const accent = rgb(0.12, 0.56, 0.51);
    const accentSoft = rgb(0.93, 0.98, 0.96);
    const textColor = rgb(0.13, 0.13, 0.18);
    const muted = rgb(0.41, 0.41, 0.46);
    const tableHeader = rgb(0.48, 0.19, 0.34);
    const border = rgb(0.86, 0.84, 0.88);

    page.drawRectangle({
      x: 0,
      y: height - 132,
      width,
      height: 132,
      color: brandSoft,
    });
    page.drawRectangle({
      x: 0,
      y: height - 132,
      width,
      height: 34,
      color: accentSoft,
    });
    page.drawRectangle({
      x: 0,
      y: height - 8,
      width,
      height: 8,
      color: accent,
    });

    let textStartX = marginX;
    if (logoAsset) {
      try {
        const logoImage =
          logoAsset.type === 'png'
            ? await pdfDoc.embedPng(logoAsset.bytes)
            : await pdfDoc.embedJpg(logoAsset.bytes);
        const boxX = marginX;
        const boxY = height - 102;
        const boxW = 52;
        const boxH = 54;
        page.drawRectangle({
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
          color: rgb(1, 1, 1),
          borderColor: border,
          borderWidth: 0.8,
        });
        const scale = Math.min(
          (boxW - 8) / logoImage.width,
          (boxH - 8) / logoImage.height,
        );
        const logoW = logoImage.width * scale;
        const logoH = logoImage.height * scale;
        page.drawImage(logoImage, {
          x: boxX + (boxW - logoW) / 2,
          y: boxY + (boxH - logoH) / 2,
          width: logoW,
          height: logoH,
        });
        textStartX = boxX + boxW + 10;
      } catch {
        textStartX = marginX;
      }
    }

    page.drawText('ANAM', {
      x: textStartX,
      y: height - 64,
      size: 24,
      font: fontBold,
      color: brand,
    });
    page.drawText('Agence Nationale des Activites Minieres', {
      x: textStartX,
      y: height - 82,
      size: 9,
      font,
      color: muted,
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

    page.drawRectangle({
      x: width - marginX - 190,
      y: height - 98,
      width: 190,
      height: 54,
      color: rgb(1, 1, 1),
      borderColor: border,
      borderWidth: 0.8,
    });

    drawRight('FACTURE OFFICIELLE', height - 62, 15, fontBold, brandDark);
    drawRight(`No ${numeroFacture ?? facture.id_facture}`, height - 80, 10, fontBold, brandDark);
    drawRight(
      `Date d'emission : ${formatDate(facture.date_emission ?? null)}`,
      height - 94,
      9,
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
          label: 'Type de procedure',
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

    page.drawText('Detail des montants', {
      x: marginX,
      y,
      size: 13,
      font: fontBold,
      color: brandDark,
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
      color: rgb(1, 1, 1),
    });
    page.drawText('Base de calcul', {
      x: tableX + col1 + 8,
      y: y - 15,
      size: 9,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    drawRight('Montant', y - 15, 9, fontBold, rgb(1, 1, 1));

    y -= headerHeight + 6;

    const lines = this.buildLines(demande);
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
      color: brand,
    });
    page.drawText('TOTAL', {
      x: tableX + 8,
      y: y - 18,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    drawRight(totalText, y - 18, 11, fontBold, rgb(1, 1, 1));
    y -= 40;

    const footerLines = wrapText(
      `Cette facture est un recapitulatif des droits et taxes applicables a votre demande. ${totalText} sera exigible apres validation de votre dossier. Paiement securise ANAM.`,
      contentWidth - 20,
      font,
      8,
    );

    const noteY = 52;
    page.drawRectangle({
      x: marginX,
      y: noteY - 8,
      width: contentWidth,
      height: 34,
      color: accentSoft,
      borderColor: border,
      borderWidth: 0.6,
    });

    page.drawText('NOTE IMPORTANTE', {
      x: marginX + 8,
      y: noteY + 17,
      size: 8,
      font: fontBold,
      color: brandDark,
    });

    let footerY = noteY + 7;
    footerLines.forEach((line) => {
      page.drawText(line, {
        x: marginX + 8,
        y: footerY,
        size: 8,
        font,
        color: muted,
      });
      footerY -= 9;
    });

    const buffer = Buffer.from(await pdfDoc.save());
    const filename = `facture-${numeroFacture ?? facture.id_facture}.pdf`;
    return { buffer, filename };
  }

  private async loadAnamLogoAsset(): Promise<LogoAsset | null> {
    const fileCandidates = ['anamlogo.png', 'anamlogo.jpg', 'anamlogo.jpeg'];
    const baseCandidates = [
      path.resolve(process.cwd(), 'client', 'public'),
      path.resolve(process.cwd(), '..', 'client', 'public'),
      path.resolve(__dirname, '..', '..', '..', 'client', 'public'),
      path.resolve(__dirname, '..', '..', 'client', 'public'),
    ];

    for (const basePath of baseCandidates) {
      for (const fileName of fileCandidates) {
        const absolutePath = path.resolve(basePath, fileName);
        if (!existsSync(absolutePath)) continue;
        try {
          const fileBuffer = await readFile(absolutePath);
          return {
            bytes: new Uint8Array(fileBuffer),
            type: fileName.endsWith('.png') ? 'png' : 'jpg',
          };
        } catch {
          // Try next candidate path.
        }
      }
    }

    return null;
  }

  private isFacturableDemande(demande: DemandeWithType) {
    if (demande.demInitial) {
      return true;
    }
    const label = (demande.typeProcedure?.libelle ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const allowedKeywords = [
      'demande',
      'renouvellement',
      'extension',
      'extention',
      'transfert',
      'cession',
      'fusion',
      'modification',
      'substitution',
    ];

    return allowedKeywords.some((keyword) => label.includes(keyword));
  }

  private buildLines(
    demande?: { typeProcedure?: { libelle?: string | null } | null } | null,
  ): FactureLine[] {
    const typeLabel = (demande?.typeProcedure?.libelle ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    let procedureLabel = 'nouvelle demande de permis';
    if (typeLabel.includes('renouvellement')) procedureLabel = 'renouvellement de permis';
    else if (typeLabel.includes('cession')) procedureLabel = 'cession de permis';
    else if (typeLabel.includes('transfert')) procedureLabel = 'transfert de permis';
    else if (typeLabel.includes('fusion')) procedureLabel = 'fusion de permis';
    else if (typeLabel.includes('extension') || typeLabel.includes('extention')) {
      if (typeLabel.includes('substance')) procedureLabel = 'extension de substances';
      else procedureLabel = 'extension de perimetre';
    } else if (typeLabel.includes('modification')) procedureLabel = 'modification de permis';

    const poste = `Frais d'inscription et d'etude de dossier (${procedureLabel})`;
    const base = `Montant fixe pour ${procedureLabel}`;

    return [
      {
        poste,
        base,
        montant: FIXED_AMOUNT,
        isTotal: true,
      },
    ];
  }

  private formatNumero(id_facture: number) {
    return `FAC-${id_facture.toString().padStart(5, '0')}`;
  }
}

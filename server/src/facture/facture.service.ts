import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DeviseFacture,
  FactureType,
  Prisma,
  StatutFacture,
} from '@prisma/client';
import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
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
    let facture = await this.prisma.facture.findUnique({
      where: { id_facture },
      include: {
        demande: {
          include: {
            typeProcedure: true,
            typePermis: true,
            commune: true,
            wilaya: true,
            demInitial: true,
            detenteurdemande: { include: { detenteur: true } },
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

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { height, width } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 11;
    const lineHeight = 16;
    let y = height - 60;
    const left = 50;

    page.drawText('FACTURE', { x: left, y, size: 18, font: fontBold });
    y -= 28;

    const drawLine = (label: string, value: string) => {
      page.drawText(`${label}: ${value}`, { x: left, y, size: fontSize, font });
      y -= lineHeight;
    };

    const formatDate = (date: Date | null) => {
      if (!date) return '--';
      return date.toISOString().slice(0, 10);
    };

    const detenteur =
      facture.demande.detenteurdemande?.[0]?.detenteur ?? null;
    const societe =
      detenteur?.nom_societeFR ||
      detenteur?.nom_societeAR ||
      '--';
    const commune =
      facture.demande.commune?.nom_communeFR ||
      facture.demande.commune?.nom_communeAR ||
      '--';
    const wilaya =
      facture.demande.wilaya?.nom_wilayaFR ||
      facture.demande.wilaya?.nom_wilayaAR ||
      '--';

    drawLine('Numero', numeroFacture ?? String(facture.id_facture));
    drawLine('Date emission', formatDate(facture.date_emission ?? null));
    drawLine('Demande', facture.demande.code_demande ?? '--');
    drawLine('Type procedure', facture.demande.typeProcedure?.libelle ?? '--');
    drawLine('Type permis', facture.demande.typePermis?.lib_type ?? '--');
    drawLine('Societe', societe);
    drawLine('Localisation', [commune, wilaya].filter(Boolean).join(', '));
    y -= 8;

    page.drawText('Montants', { x: left, y, size: 13, font: fontBold });
    y -= 18;

    const wrapText = (
      text: string,
      maxWidth: number,
      currentFont: PDFFont,
      size: number,
    ) => {
      const words = String(text ?? '').split(' ');
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

    const lines = this.buildLines();
    for (const row of lines) {
      const posteLines = wrapText(row.poste, width - 200, font, fontSize);
      const baseLines = wrapText(row.base, width - 200, font, fontSize);
      const maxLines = Math.max(posteLines.length, baseLines.length);
      for (let i = 0; i < maxLines; i += 1) {
        page.drawText(posteLines[i] ?? '', { x: left, y, size: fontSize, font });
        page.drawText(baseLines[i] ?? '', { x: left + 200, y, size: fontSize, font });
        if (i === 0) {
          page.drawText(String(row.montant), {
            x: width - 90,
            y,
            size: fontSize,
            font,
          });
        }
        y -= lineHeight;
      }
      y -= 4;
    }

    page.drawText(`Total: ${String(facture.montant_total)} ${facture.devise}`, {
      x: left,
      y,
      size: 12,
      font: fontBold,
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
        poste: "Frais d'inscription et d'etude de dossier",
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

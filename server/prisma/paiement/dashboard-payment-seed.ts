import { PrismaClient, EnumStatutPaiement, StatutFacture } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

type SeedStatus = 'paid' | 'pending' | 'failed' | 'cancelled';

type SeedPlanItem = {
  status: SeedStatus;
  date: Date;
  modePaiement: string;
};

function loadPortailEnv() {
  const envPath = path.resolve(__dirname, '../../.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL_PORTAIL=(.*)$/);
    if (!match) continue;
    process.env.DATABASE_URL_PORTAIL = match[1].replace(/^"|"$/g, '');
  }
}

function atUtc(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 10, 0, 0));
}

function paymentStatusLabel(status: SeedStatus, index: number): string {
  if (status === 'paid') {
    return index % 3 === 0 ? 'Valide' : index % 3 === 1 ? 'Confirme' : 'Paye';
  }

  if (status === 'pending') {
    return 'En attente';
  }

  if (status === 'failed') {
    return 'Echoue';
  }

  return 'Annule';
}

function obligationStatusForSeed(status: SeedStatus): EnumStatutPaiement {
  if (status === 'paid') return EnumStatutPaiement.Paye;
  if (status === 'pending') return EnumStatutPaiement.A_payer;
  if (status === 'failed') return EnumStatutPaiement.En_retard;
  return EnumStatutPaiement.Annule;
}

function factureStatusForSeed(status: SeedStatus): StatutFacture {
  if (status === 'paid') return StatutFacture.PAYEE;
  if (status === 'cancelled') return StatutFacture.ANNULEE;
  return StatutFacture.EMISE;
}

function buildSeedPlan(now: Date): SeedPlanItem[] {
  const year = now.getFullYear();

  return [
    { status: 'paid', date: atUtc(year, 6, 14), modePaiement: 'Virement bancaire' },
    { status: 'paid', date: atUtc(year, 6, 12), modePaiement: 'Paiement guichet' },
    { status: 'paid', date: atUtc(year, 6, 10), modePaiement: 'Virement bancaire' },
    { status: 'paid', date: atUtc(year, 6, 8), modePaiement: 'Paiement guichet' },
    { status: 'paid', date: atUtc(year, 6, 6), modePaiement: 'Carte bancaire' },
    { status: 'paid', date: atUtc(year, 6, 4), modePaiement: 'Virement bancaire' },
    { status: 'paid', date: atUtc(year, 6, 2), modePaiement: 'Paiement guichet' },
    { status: 'paid', date: atUtc(year, 5, 26), modePaiement: 'Virement bancaire' },
    { status: 'paid', date: atUtc(year, 5, 18), modePaiement: 'Paiement guichet' },
    { status: 'paid', date: atUtc(year, 5, 8), modePaiement: 'Carte bancaire' },
    { status: 'paid', date: atUtc(year, 4, 23), modePaiement: 'Virement bancaire' },
    { status: 'paid', date: atUtc(year, 4, 14), modePaiement: 'Paiement guichet' },
    { status: 'paid', date: atUtc(year, 3, 28), modePaiement: 'Virement bancaire' },
    { status: 'paid', date: atUtc(year, 3, 14), modePaiement: 'Carte bancaire' },
    { status: 'pending', date: atUtc(year, 6, 11), modePaiement: 'En attente' },
    { status: 'pending', date: atUtc(year, 5, 16), modePaiement: 'En attente' },
    { status: 'pending', date: atUtc(year, 4, 16), modePaiement: 'En attente' },
    { status: 'failed', date: atUtc(year, 6, 9), modePaiement: 'Carte bancaire' },
    { status: 'failed', date: atUtc(year, 5, 13), modePaiement: 'Carte bancaire' },
    { status: 'cancelled', date: atUtc(year, 6, 7), modePaiement: 'Annule' },
    { status: 'cancelled', date: atUtc(year, 5, 3), modePaiement: 'Annule' },
    { status: 'paid', date: atUtc(year, 2, 26), modePaiement: 'Virement bancaire' },
    { status: 'paid', date: atUtc(year, 2, 11), modePaiement: 'Paiement guichet' },
    { status: 'paid', date: atUtc(year, 1, 21), modePaiement: 'Virement bancaire' },
    { status: 'paid', date: atUtc(year, 1, 9), modePaiement: 'Carte bancaire' },
    { status: 'paid', date: atUtc(year, 0, 18), modePaiement: 'Virement bancaire' },
    { status: 'paid', date: atUtc(year, 0, 6), modePaiement: 'Paiement guichet' },
  ];
}

async function main() {
  loadPortailEnv();

  if (!process.env.DATABASE_URL_PORTAIL) {
    throw new Error('DATABASE_URL_PORTAIL is not set.');
  }

  const prisma = new PrismaClient();

  try {
    const existingPayments = await prisma.paiement.count();
    if (existingPayments > 0) {
      console.log(`Seed skipped: ${existingPayments} payment(s) already exist in the database.`);
      return;
    }

    const [factures, obligations] = await Promise.all([
      prisma.facture.findMany({
        orderBy: { id_facture: 'asc' },
        select: {
          id_facture: true,
          montant_total: true,
          demande: {
            select: {
              utilisateurId: true,
              code_demande: true,
            },
          },
        },
      }),
      prisma.obligationFiscale.findMany({
        orderBy: { id: 'asc' },
        select: {
          id: true,
          montant_attendu: true,
          typePaiement: {
            select: {
              libelle: true,
            },
          },
        },
      }),
    ]);

    if (factures.length === 0) {
      throw new Error('No factures found. Cannot seed dashboard payments.');
    }

    if (obligations.length === 0) {
      throw new Error('No obligations found. Cannot seed dashboard payments.');
    }

    const plan = buildSeedPlan(new Date());
    const totalToSeed = Math.min(plan.length, factures.length, obligations.length);
    const operations: any[] = [];

    for (let index = 0; index < totalToSeed; index += 1) {
      const planItem = plan[index];
      const facture = factures[index];
      const obligation = obligations[index];
      const amount = Number(obligation.montant_attendu ?? facture.montant_total ?? 0);
      const receiptPrefix = String(index + 1).padStart(4, '0');

      operations.push(
        prisma.paiement.create({
          data: {
            id_obligation: obligation.id,
            montant_paye: amount,
            devise: 'DZD',
            date_paiement: planItem.date,
            mode_paiement: planItem.modePaiement,
            num_quittance: `Q-2026-${receiptPrefix}`,
            etat_paiement: paymentStatusLabel(planItem.status, index),
            justificatif_url: null,
            num_perc: `PERC-2026-${receiptPrefix}`,
            date_remisOp: planItem.status === 'paid' ? planItem.date : null,
            idUtilisateur: facture.demande.utilisateurId,
            id_facture: facture.id_facture,
          },
        }),
      );

      operations.push(
        prisma.obligationFiscale.update({
          where: { id: obligation.id },
          data: {
            statut: obligationStatusForSeed(planItem.status),
          },
        }),
      );

      operations.push(
        prisma.facture.update({
          where: { id_facture: facture.id_facture },
          data: {
            statut: factureStatusForSeed(planItem.status),
          },
        }),
      );
    }

    await prisma.$transaction(operations);

    const summary = await prisma.paiement.aggregate({
      where: {
        etat_paiement: {
          in: ['Paye', 'Valide', 'Confirme', 'valid', 'paye', 'confirm'],
        },
      },
      _count: { _all: true },
      _sum: { montant_paye: true },
    });

    console.log(
      JSON.stringify(
        {
          insertedPayments: totalToSeed,
          validatedPayments: summary._count._all,
          validatedAmount: summary._sum.montant_paye ?? 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});

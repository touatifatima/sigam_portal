import * as fs from 'fs';
import csv = require('csv-parser');

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import { createPrismaClient } from '../../src/prisma/prisma-factory';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL_PORTAIL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in the environment.');
}

const prisma = createPrismaClient();

type SuperficiaireCSV = {
  id_taxe: string;
  droit_fixe: string;
  periode_initiale: string;
  premier_renouv: string;
  autre_renouv: string;
  Devise: string;
};

export async function main() {
  const superficiaireData: any[] = [];

  // ✅ نفس style تاع seed phases
  const csvFilePath = path.join(
    'T:',
    'Amina',
    'BaseSicma_Urgence',
    'df_superficiaireBareme.csv'
  );

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ';',
        mapHeaders: ({ header }) =>
          header.trim().replace(/\uFEFF/g, ''),
      })
    )
    .on('data', (row: SuperficiaireCSV) => {
      superficiaireData.push({
        id_taxe: Number(row.id_taxe.trim()),
        droit_fixe: parseFloat(
          row.droit_fixe.trim().replace(',', '.')
        ),
        periode_initiale: parseFloat(
          row.periode_initiale.trim().replace(',', '.')
        ),
        premier_renouv: parseFloat(
          row.premier_renouv.trim().replace(',', '.')
        ),
        autre_renouv: parseFloat(
          row.autre_renouv.trim().replace(',', '.')
        ),
        devise: row.Devise?.trim() || null,
      });
    })
    .on('end', async () => {
      console.log('CSV loaded, inserting into database...');

      try {
        await prisma.superficiaireBareme.createMany({
          data: superficiaireData,
          skipDuplicates: true,
        });

        console.log('Seed finished.');
      } catch (error) {
        console.error('Error inserting data:', error);
      } finally {
        await prisma.$disconnect();
      }
    });
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

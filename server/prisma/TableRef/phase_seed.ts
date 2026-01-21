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
type PhasesCSV = {
  id_phase: string;
  libelle: string;
  ordre: string;
  description: string;
};

export async function main() {
  const phasesData: any[] = [];
  const csvFilePath = path.join('T:', 'Amina', 'BaseSicma_Urgence', 'df_phases.csv');

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ';',
        mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ''),
      })
    )
    .on('data', (row: PhasesCSV) => {
      phasesData.push({
        id_phase: Number(row.id_phase.trim()),
        ordre: Number(row.ordre.trim()),
        libelle: row.libelle || null,
        description: row.description || null,
      });
    })
    .on('end', async () => {
      console.log('CSV loaded, inserting into database...');

      try {
        await prisma.phase.createMany({
          data: phasesData,
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

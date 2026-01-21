import * as fs from 'fs';
import csv = require('csv-parser');
import { Prisma } from '@prisma/client';

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import { createPrismaClient } from '../../src/prisma/prisma-factory';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL_PORTAIL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL_PORTAIL is not set in the environment.');
}

const prisma = createPrismaClient();
export async function main() {
  const csvFilePath = path.join('T:', 'Amina', 'BaseSicma_Urgence', 'df_demandeMin.csv');
  let totalRows = 0;
  let skippedRows = 0;
  const skippedIds: number[] = [];

  const rows: Prisma.demandeMinCreateManyInput[] = [];

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ';',
        mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""),
      })
    )
    .on('data', (row: any) => {
      totalRows++;
      const ordre = (row.ordre_mineral ?? '').toString().trim();
      rows.push({
        id_demande: parseInt(row.id_demande, 10),
        min_label: row.min_label || null,
        min_teneur: parseFloat(row.min_teneur) || null,
        ordre_mineral: ordre.length ? ordre : null,
       
      });
    })
    .on('end', async () => {
      console.log(`CSV loaded: total rows = ${totalRows}`);

      for (const row of rows) {
        try {
          await prisma.demandeMin.create({ data: row });
        } catch (error: any) {
          console.warn(`⚠️ Skipped demande 'unknown'} due to error: ${error.message}`);
        }
      }

      console.log(`Insertion finished. ✅ Total skipped rows: ${skippedRows}`);
      if (skippedIds.length > 0) {
        console.log("IDs des demandes non insérées:", skippedIds.join(", "));
      }

      await prisma.$disconnect();
    });
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

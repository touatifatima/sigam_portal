import * as fs from 'fs';
import csv = require('csv-parser');
import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import { createPrismaClient } from '../../src/prisma/prisma-factory';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL_PORTAIL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL_PORTAIL is not set in the environment.');
}

const prisma = createPrismaClient();
type typeProcedureCSV = {
  id_typeProc: string;
  libelle_type: string;
  description: string;
};

export async function main() {
  const typeProcedureData: any[] = [];
  const csvFilePath = path.join('T:', 'Amina', 'BaseSicma_Urgence', 'df_typeProcedures.csv');

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ';',
        mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ''),
      }),
    )
    .on('data', (row: typeProcedureCSV) => {
      typeProcedureData.push({
        id: Number(row.id_typeProc.trim()),
        libelle: row.libelle_type || null,
        description: row.description || null,
      });
    })
    .on('end', async () => {
      console.log('CSV loaded, inserting into database...');

      try {
        await prisma.typeProcedure.createMany({
          data: typeProcedureData,
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

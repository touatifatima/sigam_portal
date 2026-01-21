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
type etapeProcCSV = {
  id_etape: string;
  lib_etape: string;
  ordre_etape: string;
  id_phase: string;
  page_route?: string;
};

export async function main() {
  const etapeProcData: any[] = [];
  const manyEtapeData: any[] = [];
  const csvFilePath = path.join('T:', 'Amina', 'BaseSicma_Urgence', 'df_EtapeProc.csv');

  fs.createReadStream(csvFilePath)
    .pipe(
        csv({
          separator: ';',
          mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""), 
        })
    )
    .on("data", (row: etapeProcCSV) => {
      const id_etape = Number(row.id_etape.trim());
      const id_phase = Number(row.id_phase.trim());
      const ordre_etape = Number(row.ordre_etape.trim());
      const lib_etape = row.lib_etape || null;
      const page_route = row.page_route?.trim() || null;

      etapeProcData.push({
        id_etape,
        lib_etape,
      });

      manyEtapeData.push({
        id_etape,
        id_phase,
        ordre_etape,
        page_route,
      });
    })
    .on("end", async () => {
      console.log("CSV loaded, inserting into database...");

      try {
        await prisma.etapeProc.createMany({
          data: etapeProcData,
          skipDuplicates: true,
        });
        await prisma.manyEtape.createMany({
          data: manyEtapeData,
          skipDuplicates: true,
        });

        console.log("Seed finished.");
      } catch (error) {
        console.error("Error inserting data:", error);
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

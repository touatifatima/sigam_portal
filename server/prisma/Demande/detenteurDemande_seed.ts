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
type detenteurDemandeCSV = {
  id_detenteurDemande: string;
  id_demandeGeneral: string;
  id_detenteur: string;
  role_detenteur: string;

};

export async function main() {
  const detenteurDemandeData: any[] = [];
  const csvFilePath =
    "C:\\Users\\A\\Desktop\\sigam_vite\\sigam\\BaseSicma_Urgence\\df_detenteurDemande.csv";

  fs.createReadStream(csvFilePath)
    .pipe(
        csv({
          separator: ';',
          mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""), 
        })
      )
    .on("data", (row: detenteurDemandeCSV) => {
      detenteurDemandeData.push({
        id_detenteurDemande: Number(row.id_detenteurDemande.trim()),
        id_demandeGeneral: Number(row.id_demandeGeneral.trim()),
        id_detenteur: Number(row.id_detenteur.trim()),
        role_detenteur: row.role_detenteur || null,
      });
    })
    .on("end", async () => {
      console.log("CSV loaded, inserting into database...");

      try {
        await prisma.detenteurDemandePortail.createMany({
          data: detenteurDemandeData,
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

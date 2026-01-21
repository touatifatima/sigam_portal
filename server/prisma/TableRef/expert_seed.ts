import * as fs from 'fs';
import csv = require('csv-parser');
import { ExpertMinier } from "@prisma/client";

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import { createPrismaClient } from '../../src/prisma/prisma-factory';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL_PORTAIL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL_PORTAIL is not set in the environment.');
}

const prisma = createPrismaClient();
type ExpertCSV = {
  id_expert: string;
  nom_expert: string;
};

export async function main() {
  const expertData: any[] = [];
  const csvFilePath = path.join('T:', 'Amina', 'BaseSicma_Urgence', 'df_expert.csv');

  if (!fs.existsSync(csvFilePath)) {
    console.error(`Fichier non trouvé : ${csvFilePath}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  fs.createReadStream(csvFilePath)
    .pipe(
        csv({
          separator: ';',
          mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""), 
        })
      )
    .on("data", (row: ExpertCSV) => {
      const id = Number((row.id_expert || '').trim());
      const nom = (row.nom_expert || '').trim();
      if (!id || !nom) {
        console.warn('Ligne ignorée (données manquantes) :', row);
        return;
      }
      expertData.push({
        id_expert: id,
        nom_expert: nom,
      });
    })
    .on("end", async () => {
      console.log("CSV loaded, inserting into database...");

      try {
        await prisma.expertMinier.createMany({
          data: expertData,
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

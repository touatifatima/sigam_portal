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


type relationPhaseTypeProcCSV = {
  id_phase: string;
  id_combinaison: string;
  dureeEstimee: string;
};

export async function main() {
  const relationPhaseTypeProcData: any[] = [];
  const csvFilePath = path.join('T:', 'Amina', 'BaseSicma_Urgence', 'df_relationPhaseTypeProc.csv');

  // Preload existing combinaison ids to avoid FK errors
  const combos = await prisma.combinaisonPermisProc.findMany({
    select: { id_combinaison: true },
  });
  const comboSet = new Set<number>(combos.map(c => c.id_combinaison));
  let skippedMissingCombo = 0;

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ';',
        mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""),
      })
    )
    .on("data", (row: relationPhaseTypeProcCSV) => {
      const id_combinaison = row.id_combinaison?.trim();
      
      // ignorer si id_combinaison est vide ou null
      if (!id_combinaison) return;

      const comboIdNum = Number(id_combinaison);
      if (!comboSet.has(comboIdNum)) {
        skippedMissingCombo++;
        return;
      }

      relationPhaseTypeProcData.push({
        id_combinaison: comboIdNum,
        dureeEstimee: Number(row.dureeEstimee.trim()),
        ordre: null,
        id_manyEtape: null, // phase not stored on this model anymore
      });
    })
    .on("end", async () => {
      console.log("CSV loaded, inserting into database...");

      try {
        await prisma.relationPhaseTypeProc.createMany({
          data: relationPhaseTypeProcData,
          skipDuplicates: true,
        });

        console.log("Seed finished.");
        if (skippedMissingCombo > 0) {
          console.warn(`Skipped ${skippedMissingCombo} rows (missing combinaisonPermisProc).`);
        }
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

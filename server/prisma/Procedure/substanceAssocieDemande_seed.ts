import * as fs from 'fs';
import csv = require('csv-parser');
import { createPrismaClient } from '../../src/prisma/prisma-factory';
import * as path from 'path';

const prisma = createPrismaClient();

type substanceAssocieeDemandeCSV = {
  id_procsub: string;
  id_proc: string;
  id_sub: string;

};

function parseId(value: string | undefined): number | null {
  const parsed = parseInt(value ?? "", 10);
  if (isNaN(parsed) || parsed === 0) return null;
  return parsed;
}

export async function main() {
  const substanceAssocieeDemandeData: any[] = [];
  const csvFilePath =
    path.join('T:', 'Amina', 'BaseSicma_Urgence', 'df_substanceAssocieeDemande.csv');

  fs.createReadStream(csvFilePath)
    .pipe(
        csv({
          separator: ';',
          mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""), 
        })
      )
    .on("data", (row: substanceAssocieeDemandeCSV) => {
      substanceAssocieeDemandeData.push({
        id_assoc: Number(row.id_procsub.trim()),
        id_substance: parseId(row.id_sub),
        id_proc: Number(row.id_proc.trim()),
      });
    })
    .on("end", async () => {
      console.log("CSV loaded, inserting into database...");

      try {
        await prisma.substanceAssocieeDemande.createMany({
          data: substanceAssocieeDemandeData,
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

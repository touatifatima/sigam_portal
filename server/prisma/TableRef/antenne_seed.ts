import * as fs from 'fs';
import * as path from 'path';
import csv = require('csv-parser');
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '../../src/prisma/prisma-factory';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL_PORTAIL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL_PORTAIL is not set in the environment.');
}

const prisma = createPrismaClient();
type AntenneCSV = {
  id_antenne: string;  
  nom: string;
  localisation: string;
  Email: string;
  Telephone: string;
  Responsable: string;
};

export async function main() {
  const antenneData: any[] = [];
  const csvFilePath = path.join('T:', 'cleaned_df', 'df_antenne.csv');

  if (!fs.existsSync(csvFilePath)) {
    console.error(`Fichier non trouvé : ${csvFilePath}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  fs.createReadStream(csvFilePath)
        .pipe(
            csv({
              separator: ';',
              mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ""), // supprime BOM + espaces
            })
          )
    .on("data", (row: AntenneCSV) => {
      // Validate required fields
      if (!row.id_antenne || !row.nom) {
        console.warn("Ligne ignorée (id_antenne ou nom manquant) :", row);
        return;
      }

      antenneData.push({
        id_antenne: Number(row.id_antenne.trim()),
        nom: row.nom.trim(),
        localisation: row.localisation?.trim() || null,
        Email: row.Email?.trim() || null,
        Telephone: row.Telephone?.trim() || null,
        Responsable: row.Responsable?.trim() || null,
      });
    })
    .on("end", async () => {
      console.log("CSV loaded, inserting into database...");

      try {
        await prisma.antenne.createMany({
          data: antenneData,
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

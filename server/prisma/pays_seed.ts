// seeds/seed-pays.ts
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CSV_PATH = path.join('T:', 'cleaned_df', 'pays_nationalites_codes.csv');

async function seedPays() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Fichier non trouvé : ${CSV_PATH}`);
    process.exit(1);
  }

  const paysToInsert: { code_pays: string; nom_pays: string }[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(
        csv({
          separator: ';',
          mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ''),
        })
      )
      .on('data', (row) => {
        const code = (row.Code_pays || row.code_pays || '').toString().trim();
        const nom = (row.Pays || row.pays || '').toString().trim();

        if (code && nom) {
          paysToInsert.push({ code_pays: code, nom_pays: nom });
        }
      })
      .on('end', () => resolve())
      .on('error', reject);
  });

  console.log(`Chargement de ${paysToInsert.length} pays...`);

  for (const pays of paysToInsert) {
    await prisma.pays.upsert({
      where: { code_pays: pays.code_pays },
      update: {},
      create: pays,
    });
  }

  console.log(' Seed pays terminé avec succès !');
}

seedPays()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
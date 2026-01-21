// seeds/seed-wilayas.ts
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CSV_PATH = path.join('T:', 'cleaned_df', 'df_wilaya.csv');

async function seedWilayas() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Fichier non trouvé : ${CSV_PATH}`);
    process.exit(1);
  }

  const data: any[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(
        csv({
          separator: ';',
          mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, ''),
        })
      )
      .on('data', (row) => {
        const id_wilaya = Number(row.id_wilaya?.trim());
        const id_antenne = row.id_antenne ? Number(row.id_antenne) : null;
        const code_wilaya = row.code_wilaya?.trim();
        const nom_fr = row.nom_wilayaFR?.trim();
        const nom_ar = (row.nom_wilayaAR || '').trim();
        const zone = (row.zone || '').trim();

        if (id_wilaya && code_wilaya && nom_fr) {
          data.push({
            id_wilaya,
            id_antenne,
            code_wilaya,
            nom_wilayaFR: nom_fr,
            nom_wilayaAR: nom_ar,
            zone,
          });
        }
      })
      .on('end', () => resolve())
      .on('error', reject);
  });

  console.log(`${data.length} wilayas chargées, insertion en cours...`);

  await prisma.wilaya.createMany({
    data,
    skipDuplicates: true,
  });

  console.log('Seed wilayas terminé avec succès !');
}

seedWilayas()
  .catch((e) => {
    console.error('Erreur seed wilayas :', e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());

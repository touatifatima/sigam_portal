import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import csv = require('csv-parser');
import { Pays } from '@prisma/client';
import { createPrismaClient } from '../../src/prisma/prisma-factory';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

// On utilise la base portail
const databaseUrl = process.env.DATABASE_URL_PORTAIL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL_PORTAIL is not set in the environment.');
}

const prisma = createPrismaClient();

type PaysCSV = {
  Pays?: string;
  Code_pays?: string;
};

export async function main() {
  const paysData: Array<Pick<Pays, 'code_pays' | 'nom_pays'>> = [];
  const csvFilePath = path.join('T:', 'Amina', 'BaseSicma_Urgence', 'pays.csv');

  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`Fichier non trouvé : ${csvFilePath}`);
  }

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv({ separator: ';' }))
      .on('data', (row: PaysCSV) => {
        const code = (row.Code_pays || '').trim();
        const nom = (row.Pays || '').trim();
        if (!code || !nom) {
          console.warn('Ligne ignorée (données manquantes) :', row);
          return;
        }
        paysData.push({ code_pays: code, nom_pays: nom });
      })
      .on('end', () => resolve())
      .on('error', (e) => reject(e));
  });

  for (const pays of paysData) {
    await prisma.pays.upsert({
      where: { code_pays: pays.code_pays },
      update: {},
      create: pays,
    });
  }

  console.log(`Seed pays terminé : ${paysData.length} lignes traitées`);
}

if (require.main === module) {
  main()
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}


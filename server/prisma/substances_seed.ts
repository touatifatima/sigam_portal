import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Crée une redevance par défaut
  const redevance = await prisma.redevanceBareme.upsert({
    where: { id_redevance: 1 },
    update: {},
    create: {
      taux_redevance: 0,
      valeur_marchande: 0,
      unite: 'tonne',
      devise: 'DZD',
      description: 'Redevance par défaut',
    },
  });
  await prisma.substance.createMany({
    data: [
      {
        nom_subFR: 'Fer',
        nom_subAR: 'الحديد',
        categorie_sub: 'métalliques',
        famille_sub: '',
        id_redevance:1
      },
      {
        nom_subFR: 'Cuivre',
        nom_subAR: 'النحاس',
        categorie_sub: 'métalliques',
        famille_sub: '',
        id_redevance:1
      },
      {
        nom_subFR: 'Argile',
        nom_subAR: 'الطين',
        categorie_sub: 'non-métalliques',
        famille_sub: '',
        id_redevance:1
      },
      {
        nom_subFR: 'Sable',
        nom_subAR: 'الرمل',
        categorie_sub: 'non-métalliques',
        famille_sub: '',
        id_redevance:1
      },
      {
        nom_subFR: 'Uranium',
        nom_subAR: 'اليورانيوم',
        categorie_sub: 'radioactives',
        famille_sub: '',
        id_redevance:1
      }
    ],
    skipDuplicates: true,
  });

  console.log('✅ Substances inserted successfully');
}

main()
  .catch((e) => {
    console.error('❌ Error inserting substances:', e);
  })
  .finally(() => {
    prisma.$disconnect();
  });

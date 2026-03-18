import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type DeclarationItem = {
  texte: string;
  ordre: number;
};

type DeclarationGroup = {
  typeProcedure: string;
  items: DeclarationItem[];
};

function getTypeProcedureCandidates(key: string): string[] {
  const normalized = key.trim().toLowerCase();

  switch (normalized) {
    case 'demande_initiale':
      return ['demande initiale', 'demande', 'initiale'];
    case 'extension':
      return ['extension', 'extention'];
    default:
      return [normalized];
  }
}

async function resolveTypeProcedureId(typeProcedureKey: string): Promise<number> {
  const candidates = getTypeProcedureCandidates(typeProcedureKey);

  for (const candidate of candidates) {
    const exact = await prisma.typeProcedure.findFirst({
      where: { libelle: { equals: candidate, mode: 'insensitive' } },
      select: { id: true },
    });
    if (exact) return exact.id;
  }

  for (const candidate of candidates) {
    const like = await prisma.typeProcedure.findFirst({
      where: { libelle: { contains: candidate, mode: 'insensitive' } },
      select: { id: true },
    });
    if (like) return like.id;
  }

  const available = await prisma.typeProcedure.findMany({
    select: { libelle: true },
    orderBy: { id: 'asc' },
  });

  const labels = available
    .map((tp) => tp.libelle)
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  throw new Error(
    `TypeProcedure introuvable pour "${typeProcedureKey}". Valeurs disponibles: ${labels.join(', ')}`,
  );
}

async function upsertDeclaration(typeProcedureId: number, item: DeclarationItem) {
  const existing = await prisma.procedureDeclaration.findFirst({
    where: {
      typeProcedureId,
      ordre: item.ordre,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.procedureDeclaration.update({
      where: { id: existing.id },
      data: {
        texte: item.texte,
        actif: true,
      },
    });
    return;
  }

  await prisma.procedureDeclaration.create({
    data: {
      typeProcedure: { connect: { id: typeProcedureId } },
      ordre: item.ordre,
      texte: item.texte,
      actif: true,
    },
  });
}

async function main() {
  console.log('Debut du seed des declarations de confirmation...');

  const common: DeclarationItem[] = [
    {
      texte:
        "Je certifie sur l'honneur que les informations et documents fournis dans cette demande sont exacts, complets et sinceres.",
      ordre: 1,
    },
    {
      texte:
        "Je m'engage a respecter pleinement la legislation et la reglementation minieres en vigueur en Republique Algerienne Democratique et Populaire.",
      ordre: 2,
    },
    {
      texte:
        "Je reconnais que le paiement des frais administratifs ne constitue en aucun cas une garantie d'acceptation de la demande par l'administration competente.",
      ordre: 3,
    },
  ];

  const declarations: DeclarationGroup[] = [
    {
      typeProcedure: 'demande_initiale',
      items: [
        ...common,
        {
          texte:
            "Je m'engage a souscrire et executer integralement le cahier des charges applicable au permis sollicite.",
          ordre: 4,
        },
        {
          texte:
            "Je certifie disposer des capacites techniques, financieres et juridiques requises pour mener a bien l'exploitation projetee.",
          ordre: 5,
        },
        {
          texte:
            "Je m'engage a proceder a la remise en etat du site a la fin de l'exploitation, conformement aux normes environnementales en vigueur.",
          ordre: 6,
        },
      ],
    },
    {
      typeProcedure: 'renouvellement',
      items: [
        ...common,
        {
          texte:
            "Je declare que les travaux realises sur le permis ont ete conformes aux engagements pris lors de l'octroi initial.",
          ordre: 4,
        },
        {
          texte:
            "Je m'engage a poursuivre l'exploitation dans le respect des nouvelles conditions de validite et des obligations environnementales renforcees.",
          ordre: 5,
        },
        {
          texte:
            "Je certifie que le permis n'a pas fait l'objet de violations graves ou d'infractions non regularisees a ce jour.",
          ordre: 6,
        },
      ],
    },
    {
      typeProcedure: 'extension',
      items: [
        ...common,
        {
          texte:
            "Je declare que l'extension sollicitee ne porte atteinte ni aux droits de tiers ni aux zones protegees ou interdites.",
          ordre: 4,
        },
        {
          texte:
            "Je m'engage a fournir toute etude complementaire (impact environnemental, hydrogeologique, etc.) si exigee par l'administration.",
          ordre: 5,
        },
        {
          texte:
            "Je reconnais que l'extension est soumise a l'approbation prealable et discretionnaire de l'autorite competente.",
          ordre: 6,
        },
      ],
    },
    {
      typeProcedure: 'cession',
      items: [
        ...common,
        {
          texte:
            "Je certifie que la cession des parts est realisee de bonne foi, sans fraude ni collusion, et dans le strict respect des dispositions legales.",
          ordre: 4,
        },
        {
          texte:
            "Je renonce expressement a tout recours futur concernant les parts cedees apres acceptation de la demande par l'administration.",
          ordre: 5,
        },
        {
          texte:
            "Je m'engage a informer immediatement l'administration de tout changement ulterieur dans la composition actionnariale.",
          ordre: 6,
        },
      ],
    },
    {
      typeProcedure: 'renonciation',
      items: [
        ...common,
        {
          texte:
            "Je renonce volontairement, definitivement et irrevocablement a l'ensemble des droits et obligations decoulant du permis concerne.",
          ordre: 4,
        },
        {
          texte:
            "Je m'engage a proceder a la remise en etat complete et conforme du site d'exploitation dans les delais reglementaires.",
          ordre: 5,
        },
        {
          texte:
            "Je reconnais que cette renonciation entraine la perte totale des droits miniers et que je ne pourrai formuler aucune reclamation ulterieure.",
          ordre: 6,
        },
      ],
    },
    {
      typeProcedure: 'fusion',
      items: [
        ...common,
        {
          texte:
            "Je certifie que les permis concernes sont contigus et respectent les conditions minimales de frontiere commune exigees par la reglementation.",
          ordre: 4,
        },
        {
          texte:
            "Je m'engage a ce que la fusion n'entraine aucune atteinte aux droits de tiers ni aux zones protegees ou interdites.",
          ordre: 5,
        },
        {
          texte:
            "Je reconnais que le permis resultant sera soumis a l'ensemble des obligations du permis originel et des nouvelles conditions eventuelles.",
          ordre: 6,
        },
      ],
    },
  ];

  let count = 0;

  for (const group of declarations) {
    const typeProcedureId = await resolveTypeProcedureId(group.typeProcedure);

    for (const item of group.items) {
      await upsertDeclaration(typeProcedureId, item);
      count += 1;
    }

    console.log(`-> ${group.items.length} declarations inserees pour: ${group.typeProcedure}`);
  }

  console.log(`Seed termine! ${count} declarations traitees.`);
}

main()
  .catch((e) => {
    console.error('Erreur lors du seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

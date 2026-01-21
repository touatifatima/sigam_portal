import * as fs from 'fs'
import * as path from 'path'
import csv = require('csv-parser');
import { createPrismaClient } from '../../src/prisma/prisma-factory'

const prisma = createPrismaClient()

function pickNationalityKey(obj: Record<string, any>): string | null {
  const keys = Object.keys(obj)
  for (const k of keys) {
    const norm = k.normalize('NFKD').replace(/[^a-zA-Z]/g, '').toLowerCase()
    if (norm.includes('nationalit')) return k
  }
  return null
}

export async function main() {
  const csvFilePath = path.join('T:', 'cleaned_df', 'pays.csv')
  if (!fs.existsSync(csvFilePath)) {
    console.error(`Fichier non trouvé : ${csvFilePath}`)
    await prisma.$disconnect()
    process.exit(1)
  }
  const seen = new Set<string>()
  const batch: string[] = []

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv({ separator: ';' }))
      .on('data', (row: Record<string, any>) => {
        try {
          const key = pickNationalityKey(row)
          const value = key ? String(row[key]).trim() : ''
          if (value && !seen.has(value)) {
            seen.add(value)
            batch.push(value)
          }
        } catch {}
      })
      .on('end', () => resolve())
      .on('error', (e) => reject(e))
  })

  for (const libelle of batch) {
    await prisma.nationalite.upsert({ where: { libelle }, update: {}, create: { libelle } })
  }
}

if (require.main === module) {
  main()
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}


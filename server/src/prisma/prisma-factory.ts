import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import * as path from 'path';

// Ensure environment variables (including DATABASE_URL) are loaded
// when this module is imported, regardless of how the script is run.
loadEnv({ path: path.resolve(process.cwd(), '.env') });

// Reusable PrismaClient options using the Postgres adapter.
export function createPrismaClientOptions(): any {
  const connectionString = process.env.DATABASE_URL_PORTAIL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Please define it in server/.env or your environment.',
    );
  }

  const pool = new Pool({
    connectionString,
  });

  return {
    // `adapter` is supported by Prisma 7+ clients (Prisma 7+)
    // Older generated clients may not have it in their types, so we
    // deliberately return `any` here to stay compatible.
    adapter: new PrismaPg(pool),
  } as any;
}

/**
 * Helper to construct a PrismaClient using the Postgres driver adapter.
 * Useful for scripts (seeds, maintenance tasks, etc.).
 */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient(createPrismaClientOptions());
}

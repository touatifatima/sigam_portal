import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import * as path from 'path';

// Ensure environment variables (including DATABASE_URL) are loaded
// when this module is imported, regardless of how the script is run.
loadEnv({ path: path.resolve(process.cwd(), '.env') });

/**
 * Helper to construct a PrismaClient.
 * Kept minimal to avoid dependency on optional adapters.
 */
export function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL_PORTAIL) {
    throw new Error(
      'DATABASE_URL_PORTAIL is not set. Please define it in server/.env or your environment.',
    );
  }
  return new PrismaClient();
}

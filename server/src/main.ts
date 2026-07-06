import * as cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { setDefaultResultOrder } from 'dns';
import { AppModule } from './app.module';
import * as fs from 'fs';
if (!global.crypto?.subtle) {
  const { webcrypto } = require('crypto');
  (global as any).crypto = webcrypto;
}

try {
  setDefaultResultOrder('ipv4first');
} catch {
  // Older Node versions may not support this API.
}

  async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());

  const apiRouteRoots = new Set([
    'procedure',
    'demande',
    'capacites',
    'summary',
    'statuts-juridiques',
    'detenteur-morale',
    'representant-legal',
    'registre-commerce',
    'profil',
  ]);

  app.use((req, _res, next) => {
    try {
      const originalUrl = String(req?.url || '');
      const [pathname] = originalUrl.split('?');

      if (!pathname || pathname.startsWith('/api/')) {
        return next();
      }

      const firstSegment = pathname.split('/').filter(Boolean)[0] || '';
      if (!apiRouteRoots.has(firstSegment)) {
        return next();
      }

      req.url = `/api${originalUrl}`;
    } catch {
      // Keep the original route on any unexpected failure.
    }

    return next();
  });

  app.enableCors({
    origin: [
      'http://localhost:3002',
      'http://localhost:5174',
      'http://localhost:5173',
      'https://pom.anam.dz',
      'http://pom.anam.dz',
      'http://10.16.220.140:8080',
      'http://pom.anam.dz:8080',
      'https://pom.anam.dz:8080',
    ],
    credentials: true,
    exposedHeaders: ['set-cookie', 'authorization'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'x-user-id',
      'x-user-name'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH','HEAD'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // ✅ Serving static files from public (ensure correct path, no double "server")
  const publicPath = join(process.cwd(), 'public');
  if (!fs.existsSync(publicPath)) {
    console.warn('⚠️ Warning: public folder not found at:', publicPath);
  }
  app.useStaticAssets(publicPath);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

const WEAK_SECRETS = [
  'change_this_secret',
  'secret',
  'changeme',
  'jwt_secret',
  'reemplazar_con_secreto_largo_y_aleatorio'
];

function parseCorsOrigins(corsOrigin: string): string[] | string {
  const origins = corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 1 ? origins : origins[0] ?? corsOrigin;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  // El backend recibe trafico a traves del proxy Nginx en la red de Docker.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  const configService = app.get(ConfigService);
  const port = Number(configService.get('BACKEND_PORT', 3000));
  const corsOrigin = parseCorsOrigins(configService.get('CORS_ORIGIN', 'http://localhost'));
  const jwtSecret = configService.get<string>('JWT_SECRET', '');

  // ❌ Seguridad: rechaza arrancar con secretos débiles en producción
  if (
    process.env.NODE_ENV === 'production'
    && (WEAK_SECRETS.includes(jwtSecret.toLowerCase()) || Buffer.byteLength(jwtSecret) < 32)
  ) {
    logger.error(
      '❌ [SECURITY] JWT_SECRET tiene un valor débil o por defecto. Definí un JWT_SECRET fuerte en el .env antes de iniciar en producción.'
    );
    process.exit(1);
  } else if (WEAK_SECRETS.includes(jwtSecret.toLowerCase()) || Buffer.byteLength(jwtSecret) < 32) {
    logger.warn('⚠️ [SECURITY] JWT_SECRET usa el valor por defecto. Cambiálo antes de producir.');
  }

  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  await app.listen(port);
  logger.log(`🚀 Backend escuchando en el puerto ${port} [${process.env.NODE_ENV ?? 'development'}]`);
}

void bootstrap();


import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cho phép frontend gọi API trực tiếp từ trình duyệt (ADR-008).
  const corsOrigin = process.env['CORS_ORIGIN'] ?? 'http://localhost:3000';
  const lanHost = process.env['LAN_HOST'] ?? '192.168.1.12';
  const allowedOrigins = new Set([
    ...corsOrigin.split(',').map((origin) => origin.trim()),
    `http://${lanHost}:3000`,
  ]);
  app.enableCors({ origin: [...allowedOrigins] });

  // whitelist + forbidNonWhitelisted: từ chối trường lạ, ví dụ `role` khi đăng ký.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env['PORT'] ?? 3001);
  await app.listen(port, '0.0.0.0');
}

await bootstrap();

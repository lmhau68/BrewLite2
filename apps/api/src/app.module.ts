import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildConnectionOptions } from './config/database.config.js';
import { entities } from './database/entities/index.js';
import { migrations } from './database/migrations/index.js';
import { HealthModule } from './modules/health/health.module.js';
import { ProductsModule } from './modules/products/products.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        ...buildConnectionOptions(process.env),
        entities,
        migrations,
        autoLoadEntities: false,
        synchronize: false,
        migrationsRun: configService.get('DB_MIGRATIONS_RUN', 'true') === 'true',
        migrationsTableName: 'brewlite_migrations',
        logging: configService.get('DB_LOGGING', 'false') === 'true',
      }),
    }),
    ProductsModule,
    HealthModule,
  ],
})
export class AppModule {}

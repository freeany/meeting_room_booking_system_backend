import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: 'REDIS_CLIENT',
      async useFactory(configService: ConfigService) {
        const redis_server_host = configService.get('redis_server_host');
        const redis_server_port = configService.get('redis_server_port');
        const redis_server_db = configService.get('redis_server_db');

        const client = createClient({
          socket: {
            host: redis_server_host,
            port: redis_server_port,
          },
          database: redis_server_db,
        });
        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}

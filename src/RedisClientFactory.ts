import * as redis from '@redis/client';

export class RedisClientFactory {

    static getInstance(): redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts> {
        const client = redis.createClient();
        return client;
    }
}

import * as redis from '@redis/client';

export class RedisClientFactory {

    static async getInstance() :Promise<redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>> {
        const client = redis.createClient();
        await client.connect();
        return client;        
    }
}

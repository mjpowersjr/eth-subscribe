import { EthersStateManager, EthersStateManagerOpts } from "@ethereumjs/statemanager";
import type { Address } from '@ethereumjs/util'
import { 
    bytesToHex, 
    unpadArray,
    unpadBytes,
    padToEven,
    hexToBytes,
 } from '@ethereumjs/util'
import redis from "@redis/client";

export interface CachingStateManagerOpts extends EthersStateManagerOpts {
    redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
}

export class CachingStateManager extends EthersStateManager {

    redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;

    constructor(opts: CachingStateManagerOpts) {
        super(opts);
        this.redisClient = opts.redisClient;
    }

    async getContractStorage(address: Address, key: Uint8Array): Promise<Uint8Array> {
        
        const cacheKey = [
            this._blockTag,
            address.toString().toLowerCase(),
            bytesToHex(unpadBytes(key)),
        ].join(':');

        // console.log({
        //     method: 'getContractStorage',
        //     blockTag: this._blockTag,
        //     address: address.toString().toLowerCase(),
        //     key,
        //     keyHex: bytesToHex(key),
        //     cacheKey,
        // })
        
        let result : any = await this.redisClient.GET(cacheKey);
        if (! result) {
            console.log({
                msg: 'cache miss',
                blockNumber: this._blockTag,
                address: address.toString(),
                key: bytesToHex(unpadBytes(key)),
                cacheKey,
            })
            result = await super.getContractStorage(address, key);
            await this.redisClient.set(cacheKey, bytesToHex(result));
        } else {
            result = hexToBytes(result);
        }


        return result;
    }
}

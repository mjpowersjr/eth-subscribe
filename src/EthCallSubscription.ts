import { EVMResult } from '@ethereumjs/evm';
import * as redis from '@redis/client';
import { ethers } from "ethers";
import { EventEmitter } from 'events';
import { AddressStorageKeyCodec } from "./codecs/AddressStorageKeyCodec";
import { SlotStorageCacheManager } from "./contract-storage/SlotStorageCacheManager";
import { StorageSubscriptionManager } from "./pubsub/StorageSubscriptionManager";
import { CachingStateManager } from "./simulator/CachingStateManager";
import { Simulator } from "./simulator/Simulator";
import { StorageSlotsCollection } from "./utils/StorageSlotsCollection";
import { Logger, LoggerFactory } from './utils/LoggerFactory';

export type EthCallSubscriptionOpts = {
    provider: ethers.JsonRpcProvider;
    storageManager: SlotStorageCacheManager;
    redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
    request: {
        address: string;
        data: string;
    };
}

export class EthCallSubscription extends EventEmitter {

    request: {
        address: string;
        data: string;
    };
    storageManager: SlotStorageCacheManager;
    redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
    provider: ethers.JsonRpcProvider;
    subscriptionManager: StorageSubscriptionManager;
    subscriptions: StorageSlotsCollection;
    codec: AddressStorageKeyCodec;
    log: Logger;

    constructor(opts: EthCallSubscriptionOpts) {
        super();
        this.request = opts.request;
        this.redisClient = opts.redisClient;
        this.provider = opts.provider;
        this.subscriptionManager = new StorageSubscriptionManager({
            redisClient: this.redisClient,
        });
        this.storageManager = opts.storageManager;
        this.subscriptions = new StorageSlotsCollection();
        this.codec = new AddressStorageKeyCodec();

        this.log = LoggerFactory.build({ name: EthCallSubscription.name });

        this.handleBlockUpdate = this.handleBlockUpdate.bind(this);
        this.handleStorageUpdate = this.handleStorageUpdate.bind(this);
    }

    async start() {
        this.log.debug({
            msg: 'starting subscription',
        });

        // execute code once to initialize storage slot subscriptions
        const blockNumber = await this.provider.getBlockNumber();
        await this.executeAt(BigInt(blockNumber));
        
        // for now we'll execute on every block update, we may be able to optimize
        // this in the future...
        this.redisClient.subscribe('block_height', this.handleBlockUpdate);
    }

    async executeAt(blockNumber: bigint): Promise<EVMResult> {
        this.log.debug({
            method: 'executeAt',
            blockNumber,
        });

        const stateManager = new CachingStateManager({
            storageManager: this.storageManager,
            provider: this.provider,
            blockTag: blockNumber,
        });

        const simulator = new Simulator({
            stateManager,
        });

        const {
            accessedStorage,
            result,
        } = await simulator.simulate({
            ...this.request,
            blockNumber,
        });

        await this.subscriptionManager.updateSubscriptions(
            accessedStorage,
            this.handleStorageUpdate
        );

        return result;
    }

    protected async handleStorageUpdate(message: string) {
        // const blockNumber = BigInt(message);
        // const result = await this.executeAt(blockNumber);
        // this.emit('update', { blockNumber, result });
    }


    protected async handleBlockUpdate(message: string) {
        const blockNumber = BigInt(message);
        const result = await this.executeAt(blockNumber);
        this.emit('update', { blockNumber, result });
    }


}

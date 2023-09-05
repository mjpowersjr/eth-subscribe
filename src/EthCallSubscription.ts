import { ethers } from "ethers";
import { Simulator } from "./simulator/Simulator";
import { StorageSubscriptionManager } from "./pubsub/StorageSubscriptionManager";
import { StorageSlotsCollection } from "./utils/StorageSlotsCollection";
import { ArrayUtils } from "./utils/ArrayUtils";
import { CachingStateManager } from "./simulator/CachingStateManager";
import * as redis from '@redis/client';
import { AddressStorageCacheCodec } from "./codecs/AddressStorageCacheCodec";
import { EventEmitter } from 'events'
import { EVMResult } from '@ethereumjs/evm';
import { RedisClientFactory } from "./RedisClientFactory";
import { StorageManager } from "./contract-storage/StorageManager";

export type EthCallSubscriptionOpts = {
    // id: string;
    provider: ethers.JsonRpcProvider;
    storageManager: StorageManager;
    redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
    request: {
        address: string;
        data: string;
    };
    subscriptionManager: StorageSubscriptionManager;
}

export class EthCallSubscription extends EventEmitter {

    // id: string;
    request: {
        address: string;
        data: string;
    };
    storageManager: StorageManager;
    redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
    provider: ethers.JsonRpcProvider;
    subscriptionManager: StorageSubscriptionManager;
    subscriptions: StorageSlotsCollection;
    codec: AddressStorageCacheCodec;

    constructor(opts: EthCallSubscriptionOpts) {
        super();
        // this.id = opts.id;
        this.request = opts.request;
        this.redisClient = opts.redisClient;
        this.provider = opts.provider;
        this.subscriptionManager = opts.subscriptionManager;
        this.storageManager = opts.storageManager;
        this.subscriptions = new StorageSlotsCollection();
        this.codec = new AddressStorageCacheCodec();

        this.handleStorageUpdate = this.handleStorageUpdate.bind(this);
    }

    async executeAt(blockNumber: bigint): Promise<EVMResult> {
        // console.log({
        //     method: 'executeAt',
        //     blockNumber,
        // });

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

        await this.updateSubscriptions(accessedStorage);

        return result;
    }

    protected async handleStorageUpdate(message: string) {
        const blockNumber = BigInt(message);
        const result = await this.executeAt(blockNumber);
        this.emit('update', { blockNumber, result });
    }

    protected async updateSubscriptions(
        subscriptionsNew: StorageSlotsCollection
    ): Promise<void> {

        const oldAddresses = this.subscriptions.getAddresses();
        const newAddresses = subscriptionsNew.getAddresses();
        const addressesDiff = ArrayUtils.compare(oldAddresses, newAddresses);

        for (const address of addressesDiff.added) {
            // add all
            const storageSlots = subscriptionsNew.getStorageSlotsFor(address);
            this.addAll(address, storageSlots);
        }

        for (const address of addressesDiff.removed) {
            // remove all
            const storageSlots = this.subscriptions.getStorageSlotsFor(address);
            this.removeAll(address, storageSlots);
        }

        for (const address of addressesDiff.common) {
            // compare slots
            const storageSlotsOld = this.subscriptions.getStorageSlotsFor(address);
            const storageSlotsNew = subscriptionsNew.getStorageSlotsFor(address);
            const storageSlogsDiff = ArrayUtils.compare(storageSlotsOld, storageSlotsNew);
            this.addAll(address, storageSlogsDiff.added);
            this.removeAll(address, storageSlogsDiff.removed);
        }

        this.subscriptions = subscriptionsNew;

        this.redisClient.subscribe('block_height', this.handleStorageUpdate);
    }

    async addAll(address: string, storageSlots: Array<string> | Set<string>): Promise<void> {
        const channels = Array.from(storageSlots).map((slot) => this.codec.encodeAsCacheKey(address, slot));
        // console.log({
        //     method: 'addAll',
        //     channels,
        // });
        if (channels.length) {
            await this.redisClient.subscribe(channels, this.handleStorageUpdate);
        }
    }

    async removeAll(address: string, storageSlots: Array<string> | Set<string>): Promise<void> {
        const channels = Array.from(storageSlots).map((slot) => this.codec.encodeAsCacheKey(address, slot));
        // console.log({
        //     method: 'removeAll',
        //     channels,
        // });
        if (channels.length) {
            await this.redisClient.unsubscribe(channels);
        }
    }



}

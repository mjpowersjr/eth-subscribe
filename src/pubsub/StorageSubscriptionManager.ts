import * as redis from "@redis/client";
import { AddressStorageKeyCodec } from "../codecs/AddressStorageKeyCodec";
import { StorageSlotsCollection } from "../utils/StorageSlotsCollection";
import { ArrayUtils } from "../utils/ArrayUtils";
import { Logger, LoggerFactory } from "../utils/LoggerFactory";

export interface ContractStorageSubscription {
    address: string;
    storageSlots: Set<string>;
}

export type StorageUpdateCallback = (message: string) => Promise<void>;

export class StorageSubscriptionManager {

    static keyPrefix = 'sub';

    subscriptions: StorageSlotsCollection
    codec: AddressStorageKeyCodec;
    redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
    log: Logger;

    constructor(opts: {
        redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
    }) {
        this.redisClient = opts.redisClient;
        this.codec = new AddressStorageKeyCodec(StorageSubscriptionManager.keyPrefix);
        this.subscriptions = new StorageSlotsCollection();
        this.log = LoggerFactory.build({ name: StorageSubscriptionManager.name });
    }

    protected async tryConnect(): Promise<void> {
        if (!this.redisClient.isOpen) {
            await this.redisClient.connect();
        }
    }

    // protected async findAllContractStorageSubscriptions(): Promise<ContractStorageSubscription[]> {
    //     const collection = new StorageSlotsCollection();

    //     for await (const stream of this.redisClient.scanIterator({
    //         MATCH: 'slot:*',
    //         // TYPE: 'stream',
    //     })) {
    //         const [
    //             prefix,
    //             address,
    //             slot
    //         ] = stream.split(':');
    //         collection.add(address, slot);
    //     }

    //     return collection.getAddresses()
    //         .map((address) => {
    //             return {
    //                 address,
    //                 storageSlots: collection.getStorageSlotsFor(address)
    //             }
    //         })
    // }

    async findAllContractStorageSubscriptions(
    ): Promise<Array<ContractStorageSubscription>> {
        await this.tryConnect();

        const channels = await this.redisClient.PUBSUB_CHANNELS(StorageSubscriptionManager.keyPrefix + ':*');

        // group subscriptions by contract address
        const storageSlotsCollection = new StorageSlotsCollection();
        for (const channel of channels) {
            const {
                address,
                storageSlot: key
            } = this.codec.decodeCacheKey(channel);
            storageSlotsCollection.add(address, key);
        }

        // transform into subscriptions
        const subscriptions = Object.entries(storageSlotsCollection.getAllStorageSlotsByAddress())
            .map(([address, storageSlots]): ContractStorageSubscription => {
                return {
                    address,
                    storageSlots
                }
            });

        return subscriptions;
    }


    async updateSubscriptions(
        subscriptionsNew: StorageSlotsCollection,
        callback: StorageUpdateCallback,
    ): Promise<void> {

        const oldAddresses = this.subscriptions.getAddresses();
        const newAddresses = subscriptionsNew.getAddresses();
        const addressesDiff = ArrayUtils.compare(oldAddresses, newAddresses);

        for (const address of addressesDiff.added) {
            // add all
            const storageSlots = subscriptionsNew.getStorageSlotsFor(address);
            this.addAll(address, storageSlots, callback);
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
            this.addAll(address, storageSlogsDiff.added, callback);
            this.removeAll(address, storageSlogsDiff.removed);
        }

        this.subscriptions = subscriptionsNew;

    }

    protected async addAll(
        address: string,
        storageSlots: Array<string> | Set<string>,
        callback: StorageUpdateCallback,
    ): Promise<void> {
        const channels = Array.from(storageSlots).map((slot) => this.codec.encodeAsCacheKey(address, slot));
        this.log.debug({
            method: 'addAll',
            channels,
        });
        if (channels.length) {
            await this.tryConnect();

            this.log.debug({
                msg: 'subscribe',
                channels,
            });
            await this.redisClient.subscribe(channels, callback);
        }
    }

    protected async removeAll(address: string, storageSlots: Array<string> | Set<string>): Promise<void> {
        const channels = Array.from(storageSlots).map((slot) => this.codec.encodeAsCacheKey(address, slot));
        this.log.debug({
            method: 'removeAll',
            channels,
        });
        if (channels.length) {
            await this.tryConnect();

            this.log.debug({
                msg: 'unsubscribe',
                channels,
            });

            await this.redisClient.unsubscribe(channels);
        }
    }

}

import * as redis from "@redis/client";
import { AddressStorageCacheCodec } from "../codecs/AddressStorageCacheCodec";
import { StorageSlotsCollection } from "../utils/StorageSlotsCollection";
import { ArrayUtils } from "../utils/ArrayUtils";

export interface ContractStorageSubscription {
    address: string;
    storageSlots: Set<string>;
}

export class StorageSubscriptionManager {
    codec: AddressStorageCacheCodec;
    redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;

    constructor(opts: {
        redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
    }) {
        this.redisClient = opts.redisClient;
        this.codec = new AddressStorageCacheCodec();
    }


    async findAllContractStorageSubscriptions(
    ): Promise<Array<ContractStorageSubscription>> {
        const channels = await this.redisClient.PUBSUB_CHANNELS();

        // group subscriptions by contract address
        const storageSlotsCollection = new StorageSlotsCollection();
        for (const channel of channels) {
            const {
                address,
                key
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

}

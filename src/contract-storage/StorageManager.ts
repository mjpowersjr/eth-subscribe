import { BlockTag, recoverAddress } from "ethers";
import { EthereumAccountProof, EthereumProofFetcher } from "./EthereumProofFetcher";
import { ContractStorageSubscription, StorageSubscriptionManager } from "../pubsub/StorageSubscriptionManager";
import {
    padToEven,
    unpadHex,
    stripHexPrefix
} from '@ethereumjs/util'
import * as redis from "@redis/client";
import { AddressStorageCacheCodec } from "../codecs/AddressStorageCacheCodec";
import { StorageSlotsCollection } from "../utils/StorageSlotsCollection";

function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
}

type StorageUpdate = {
    key: string;
    id: string;
    value: string;
    publishTo: string;
}

type StorageUpdates = Array<StorageUpdate>;

export class StorageManager {

    codec: AddressStorageCacheCodec;
    redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
    proofFetcher: EthereumProofFetcher;
    subscriptionManager: StorageSubscriptionManager;

    constructor(opts: {
        redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
        proofFetcher: EthereumProofFetcher;
        subscriptionManager: StorageSubscriptionManager;
    }) {
        this.redisClient = opts.redisClient;
        this.proofFetcher = opts.proofFetcher;
        this.subscriptionManager = opts.subscriptionManager;
        this.codec = new AddressStorageCacheCodec();
    }

    protected generateStreamId(blockNumber: bigint): string {
        return blockNumber + '-1';
    }

    protected generateStreamKey(address: string, storageSlot: string) {
        return [
            'slot',
            address.toLowerCase(),
            storageSlot.toLowerCase()
        ].join(':')
    }

    protected async addToStream(key: string, id: string, value: string, client?: any): Promise<void> {
        const redisClient = client || this.redisClient;
        // console.log({
        //     method: 'addToStream',
        //     key,
        //     id,
        //     value,
        // })

        try {
            await redisClient.xAdd(key, id, { v: value }, {
                TRIM: {
                    strategy: 'MAXLEN',
                    threshold: 5,
                },
            });
        } catch (e) {
            // TODO: Handle:
            // [ErrorReply: ERR The ID specified in XADD is equal or smaller than the target stream top item]
        }
    }



    async getStorageSlot(props: {
        blockNumber: bigint,
        address: string;
        storageSlot: string
    }): Promise<string | null> {
        const id = this.generateStreamId(props.blockNumber);
        const key = this.generateStreamKey(props.address, props.storageSlot);;

        // NOTE: For some reason xRead did not seem to return results, but XRange works fine.
        const records = await this.redisClient.xRange(key, id, id)
        const record = records?.[0];
        const data = record?.message.v;

        // console.log({
        //     method: 'getStorageSlot',
        //     key,
        //     id,
        //     record,
        // });

        return data;
    }

    async setStorageSlot(props: {
        blockNumber: bigint,
        address: string;
        storageSlot: string;
        value: string;
    }): Promise<void> {
        const id = this.generateStreamId(props.blockNumber);
        const key = this.generateStreamKey(props.address, props.storageSlot);;
        await this.addToStream(key, id, props.value);
    }

    protected async findAllContractStorageSubscriptions(): Promise<ContractStorageSubscription[]> {
        const collection = new StorageSlotsCollection();

        for await (const stream of this.redisClient.scanIterator({
            MATCH: 'slot:*',
            // TYPE: 'stream',
        })) {
            const [
                prefix,
                address,
                slot
            ] = stream.split(':');
            collection.add(address, slot);
        }

        return collection.getAddresses()
            .map((address) => {
                return {
                    address,
                    storageSlots: collection.getStorageSlotsFor(address)
                }
            })
    }

    async update(blockNumber: bigint): Promise<void> {
        // fetch subscriptions
        const contractSubscriptions = await this.findAllContractStorageSubscriptions()

        // fetch storage updates
        const updatesByContract: Array<StorageUpdates> = [];
        for (const subscription of contractSubscriptions) {
            const updates = await this.getUpdatesForSubscription(subscription, blockNumber);
            updatesByContract.push(updates);
        }

        const multi = this.redisClient.multi();
        // const msetParams = [];
        for (const updates of updatesByContract) {
            for (const update of updates) {
                // console.log({ update })
                // msetParams.push(update.key)
                // msetParams.push(update.value)
                // const id = this.generateStreamId(blockNumber);
                await this.addToStream(update.key, update.id, update.value, multi);
            }
        }

        // FIXME: convert to storing streams of data for blocks
        // FIXME: build better codecs for cache and pub/sub channels
        // FIXME: remove the padEven nonsense
        // FIXME: verify lc'd addresses consistently
        // FIXME: encode block number consistently

        // this.redisClient.mSet(msetParams)
        // FIXME
        // await this.redisClient.flushAll();

        // multi = this.redisClient.multi();
        for (const subscription of contractSubscriptions) {
            const publishTo = this.generateSubscriptionChannel(subscription.address);
            this.redisClient.publish(publishTo, blockNumber.toString());
        }
        multi.publish('block_height', blockNumber.toString())
        await multi.exec();

    }

    protected async getUpdatesForSubscription(
        subscription: ContractStorageSubscription,
        blockNumber: bigint
    ): Promise<StorageUpdates> {
        const proof = await this.proofFetcher.getAccountProof(
            subscription.address,
            Array.from(subscription.storageSlots),
            blockNumber
        )
        const updates = this.createUpdatesFromProof(proof, blockNumber);

        // console.log({
        //     method: 'getUpdatesForSubscription',
        //     subscription,
        //     blockNumber,
        //     proof,
        //     updates,
        // });

        return updates;
    }

    generateSubscriptionChannel(address: string): string {
        return 'c:' + address.toLowerCase();
    }

    protected createUpdatesFromProof(proof: EthereumAccountProof, blockNumber: bigint): StorageUpdates {

        // const blockNumber = '0x' + BigInt(blockTag).toString(16);
        const updates: StorageUpdates = [];

        for (const sp of proof.storageProof) {
            const storageSlot = '0x' + padToEven(stripHexPrefix(sp.key));
            const key = this.generateStreamKey(proof.address, storageSlot);
            const id = this.generateStreamId(blockNumber)
            const publishTo = this.generateSubscriptionChannel(proof.address);
            const value = sp.value;
            updates.push({
                key,
                id,
                value,
                publishTo,
            })
        }

        return updates;
    }

}

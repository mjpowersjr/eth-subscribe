import {
    padToEven,
    stripHexPrefix
} from '@ethereumjs/util';
import * as redis from "@redis/client";
import { AddressStorageKeyCodec } from "../codecs/AddressStorageKeyCodec";
import { EthereumAccountProof, EthereumProofFetcher } from "../rpc/EthereumProofFetcher";
import { Logger, LoggerFactory } from "../utils/LoggerFactory";

type StorageUpdate = {
    key: string;
    id: string;
    value: string;
    publishTo: string;
}

type StorageUpdates = Array<StorageUpdate>;

export class SlotStorageCacheManager {

    log: Logger;
    codec: AddressStorageKeyCodec;
    redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
    proofFetcher: EthereumProofFetcher;

    constructor(opts: {
        redisClient: redis.RedisClientType<redis.RedisModules, redis.RedisFunctions, redis.RedisScripts>;
        proofFetcher: EthereumProofFetcher;
    }) {
        this.redisClient = opts.redisClient;
        this.proofFetcher = opts.proofFetcher;
        this.codec = new AddressStorageKeyCodec('storage');
        this.log = LoggerFactory.build({ name: SlotStorageCacheManager.name });
    }

    protected async tryConnect() : Promise<void> {
        if (! this.redisClient.isOpen) {
            await this.redisClient.connect();
        }
    }

    /**
     * By default redis uses epoch + suffix as a stream element's id, but we
     * specify the blockNumber to make future lookups of historical data easier
     */
    protected generateStreamId(blockNumber: bigint): string {
        return blockNumber + '-1';
    }

    protected async addToStream(
        key: string,
        id: string,
        value: string, client?: any
    ): Promise<void> {
        await this.tryConnect();

        const redisClient = client || this.redisClient;
        this.log.debug({
            method: 'addToStream',
            key,
            id,
            value,
        })

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

    async getStorage(props: {
        blockNumber: bigint,
        address: string;
        storageSlot: string
    }): Promise<string | null> {
        await this.tryConnect();

        const id = this.generateStreamId(props.blockNumber);
        const key = this.codec.encodeAsCacheKey(props.address, props.storageSlot);

        // NOTE: For some reason xRead did not seem to return results
        // ut XRange works fine.
        const records = await this.redisClient.xRange(key, id, id)
        const record = records?.[0];
        const data = record?.message.v;

        this.log.debug({
            method: 'getStorage',
            props,
            key,
            id,
            records: records.length,
            record,
        });

        return data;
    }

    async setStorage(props: {
        blockNumber: bigint,
        address: string;
        storageSlot: string;
        value: string;
    }): Promise<void> {
        const id = this.generateStreamId(props.blockNumber);
        const key = this.codec.encodeAsCacheKey(props.address, props.storageSlot);
        await this.addToStream(key, id, props.value);
    }


    async importFromProofs(
        proofs: EthereumAccountProof[],
        blockNumber: bigint
    ): Promise<void> {
        await this.tryConnect();

        // fetch storage updates
        const updatesByContract: Array<StorageUpdates> = proofs
            .map((proof) => this.getUpdatesForProof(proof, blockNumber));
            
        const multi = this.redisClient.multi();
        for (const updates of updatesByContract) {
            for (const update of updates) {
                this.log.debug({ update })
                await this.addToStream(update.key, update.id, update.value, multi);
            }
        }

        // FIXME: convert to storing streams of data for blocks
        // FIXME: build better codecs for cache and pub/sub channels
        // FIXME: remove the padEven nonsense
        // FIXME: verify lc'd addresses consistently
        // FIXME: encode block number consistently

        for (const proof of proofs) {
            const publishTo = this.generateSubscriptionChannel(proof.address);
            this.redisClient.publish(publishTo, blockNumber.toString());
        }

        multi.publish('block_height', blockNumber.toString())
        await multi.exec();
    }

    protected getUpdatesForProof(
        proof: EthereumAccountProof,
        blockNumber: bigint,
    ): StorageUpdates {
        const updates = this.createUpdatesFromProof(proof, blockNumber);

        this.log.debug({
            method: 'getUpdatesForSubscription',
            blockNumber,
            proof,
            updates,
        });

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
            const key = this.codec.encodeAsCacheKey(proof.address, storageSlot);
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

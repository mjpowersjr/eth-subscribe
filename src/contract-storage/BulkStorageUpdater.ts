import { BlockTag } from "ethers";
import { EthereumAccountProof, EthereumProofFetcher } from "./EthereumProofFetcher";
import { ContractStorageSubscription, StorageSubscriptionManager } from "../pubsub/StorageSubscriptionManager";
import {
    padToEven,
    unpadHex,
    stripHexPrefix
} from '@ethereumjs/util'
import * as redis from "@redis/client";

type StorageUpdate = {
    key: string;
    value: string;
    publishTo: string;
}

type StorageUpdates = Array<StorageUpdate>;

export class BulkStorageUpdater {

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
    }

    async update(blockNumber: BlockTag): Promise<void> {
        // fetch subscriptions
        const contractSubscriptions = await this.subscriptionManager.findAllContractStorageSubscriptions()


        // fetch storage updates
        const updatesByContract: Array<StorageUpdates> = [];
        for (const subscription of contractSubscriptions) {
            const updates = await this.getUpdatesForSubscription(subscription, blockNumber);
            updatesByContract.push(updates);
        }

        // console.log({
        //     method: BulkStorageUpdater.name + '.update',
        //     contractSubscriptions,
        //     updatesByContract,
        // });

        // update redis
        // let multi = this.redisClient.multi();
        // for (const updates of updatesByContract) {
        //     for (const update of updates) {
        //         console.log({ update })
        //         multi.set(update.key, update.value);
        //     }
        // }
        // await multi.exec();

        const msetParams = [];
        for (const updates of updatesByContract) {
            for (const update of updates) {
                // console.log({update})
                msetParams.push(update.key)
                msetParams.push(update.value)
            }
        }

        // FIXME: convert to storing streams of data for blocks
        // FIXME: build better codecs for cache and pub/sub channels
        // FIXME: remove the padEven nonsense
        // FIXME: verify lc'd addresses consistently
        // FIXME: encode block number consistently

        this.redisClient.mSet(msetParams)
        // FIXME
        // await this.redisClient.flushAll();

        // multi = this.redisClient.multi();
        for (const updates of updatesByContract) {
            for (const update of updates) {
                this.redisClient.publish(update.publishTo, blockNumber.toString());
            }
        }
        // await multi.exec();

    }

    protected async getUpdatesForSubscription(
        subscription: ContractStorageSubscription,
        blockNumber: BlockTag
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

    protected createUpdatesFromProof(proof: EthereumAccountProof, blockTag: BlockTag): StorageUpdates {

        const blockNumber = '0x' + BigInt(blockTag).toString(16);
        const updates: StorageUpdates = [];

        for (const sp of proof.storageProof) {
            updates.push({
                key: [
                    blockNumber,
                    proof.address,
                    '0x' + padToEven(stripHexPrefix(sp.key))
                ].join(':'),
                value: sp.value,
                publishTo: [
                    proof.address,
                    '0x' + padToEven(stripHexPrefix(sp.key))
                ].join(':')
            })
        }

        return updates;
    }

}

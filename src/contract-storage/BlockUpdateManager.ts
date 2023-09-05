import { JsonRpcProvider } from "ethers";
import { StorageSubscriptionManager } from "../pubsub/StorageSubscriptionManager";
import { EthereumAccountProof, EthereumProofFetcher } from "../rpc/EthereumProofFetcher";
import { Logger, LoggerFactory } from "../utils/LoggerFactory";
import { SlotStorageCacheManager } from "./SlotStorageCacheManager";

export type BlockUpdateManagerOpts = {
    provider: JsonRpcProvider;
    ethereumProofFetcher: EthereumProofFetcher;
    slotStorageCacheManager: SlotStorageCacheManager;
    storageSubscriptionManager: StorageSubscriptionManager;
}

export class BlockUpdateManager {
    ethereumProofFetcher: EthereumProofFetcher;
    slotStorageCacheManager: SlotStorageCacheManager;
    storageSubscriptionManager: StorageSubscriptionManager;
    log: Logger;
    provider: JsonRpcProvider;

    constructor(opts: BlockUpdateManagerOpts) {
        this.ethereumProofFetcher = opts.ethereumProofFetcher;
        this.slotStorageCacheManager = opts.slotStorageCacheManager;
        this.storageSubscriptionManager = opts.storageSubscriptionManager;
        this.provider = opts.provider;

        this.log = LoggerFactory.build({ name: BlockUpdateManager.name });

        this.processBlock = this.processBlock.bind(this);
    }

    start() {
        this.log.debug({
            msg: 'listening for new blocks'
        });

        this.provider.on('block', async (blockNumber) => {
            try {
                await this.processBlock(blockNumber);
            } catch (e) {
                this.log.error({
                    err: e,
                });
            }
        })
    }

    async processBlock(blockNumber: bigint): Promise<void> {

        // find all active subscriptions
        const subscriptions = await this.storageSubscriptionManager.findAllContractStorageSubscriptions();

        this.log.debug({
            msg: 'processBlock',
            blockNumber,
            subscriptions: subscriptions.length,
        });

        const proofs: EthereumAccountProof[] = [];
        for (const subscription of subscriptions) {
            this.log.trace({
                msg: 'fetching proof',
                blockNumber,
                subscription,
            });

            const proof = await this.ethereumProofFetcher.getAccountProof(
                subscription.address,
                Array.from(subscription.storageSlots),
                blockNumber
            )
            proofs.push(proof);
        }

        await this.slotStorageCacheManager.importFromProofs(proofs, blockNumber);
    }


}

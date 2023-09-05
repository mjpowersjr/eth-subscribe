import { ethers } from 'ethers';
import { RedisClientFactory } from './RedisClientFactory';
import { SlotStorageCacheManager } from './contract-storage/SlotStorageCacheManager';
import { EthereumProofFetcher } from './rpc/EthereumProofFetcher';
import { EmbeddedRpcServer } from './server/EmbeddedRpcServer';
import { LoggerFactory } from './utils/LoggerFactory';
import { BlockUpdateManager } from './contract-storage/BlockUpdateManager';
import { StorageSubscriptionManager } from './pubsub/StorageSubscriptionManager';
import { AddressStorageKeyCodec } from './codecs/AddressStorageKeyCodec';
import { StorageAccessRecorder } from './simulator/StorageAccessRecorder';

LoggerFactory.configure({
    [AddressStorageKeyCodec.name]: 'info',
    [EthereumProofFetcher.name]: 'info',
    [StorageAccessRecorder.name]: 'info',
    [StorageSubscriptionManager.name]: 'info',
    default: 'info',
})

export const provider = new ethers.JsonRpcProvider(
    'https://mainnet.infura.io/v3/dbee8026e4154623b4711781185c3cc6'
)

export const ethereumProofFetcher = new EthereumProofFetcher({
    provider,
});

export const slotStorageCacheManager = new SlotStorageCacheManager({
    redisClient: RedisClientFactory.getInstance(),
    proofFetcher: ethereumProofFetcher,
});

export const blockUpdateManager = new BlockUpdateManager({
    ethereumProofFetcher,
    provider,
    slotStorageCacheManager,
    storageSubscriptionManager: new StorageSubscriptionManager({
        redisClient: RedisClientFactory.getInstance(),
    })
})


export const embeddedRpcServer = EmbeddedRpcServer.create({
    provider,
    storageManager: slotStorageCacheManager,
});

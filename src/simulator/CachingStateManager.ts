import { EthersStateManager, EthersStateManagerOpts } from "@ethereumjs/statemanager";
import type { Address } from '@ethereumjs/util';
import {
    bytesToHex,
    hexToBytes,
    unpadBytes
} from '@ethereumjs/util';
import { SlotStorageCacheManager } from "../contract-storage/SlotStorageCacheManager";
import { Logger, LoggerFactory } from "../utils/LoggerFactory";

export interface CachingStateManagerOpts extends EthersStateManagerOpts {
    storageManager: SlotStorageCacheManager;
}

export class CachingStateManager extends EthersStateManager {

    storageManager: SlotStorageCacheManager;
    log: Logger;

    constructor(opts: CachingStateManagerOpts) {
        super(opts);
        this.storageManager = opts.storageManager;
        this.log = LoggerFactory.build({ name: CachingStateManager.name });

    }

    async getContractStorage(address: Address, key: Uint8Array): Promise<Uint8Array> {

        const storageSlot = bytesToHex(unpadBytes(key));

        this.log.debug({
            method: 'getContractStorage',
            blockTag: this._blockTag,
            address: address.toString().toLowerCase(),
            storageSlot,
        })

        let result: any = await this.storageManager.getStorage({
            address: address.toString(),
            blockNumber: BigInt(this._blockTag),
            storageSlot,
        });

        if (result) {
            this.log.debug({
                msg: 'cache hit',
                blockNumber: this._blockTag,
                address: address.toString(),
                key: bytesToHex(unpadBytes(key)),
            });
            result = hexToBytes(result);
        } else {
            this.log.warn({
                msg: 'cache miss',
                blockNumber: this._blockTag,
                address: address.toString(),
                key: bytesToHex(unpadBytes(key)),
            })

            result = await super.getContractStorage(address, key);

            await this.storageManager.setStorage({
                address: address.toString(),
                blockNumber: BigInt(this._blockTag),
                storageSlot: bytesToHex(unpadBytes(key)),
                value: bytesToHex(result),
            });

        }

        return result;
    }
}

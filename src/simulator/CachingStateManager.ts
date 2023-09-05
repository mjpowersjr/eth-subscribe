import { EthersStateManager, EthersStateManagerOpts } from "@ethereumjs/statemanager";
import type { Address } from '@ethereumjs/util'
import { 
    bytesToHex, 
    unpadArray,
    unpadBytes,
    padToEven,
    hexToBytes,
 } from '@ethereumjs/util'
import redis from "@redis/client";
import { StorageManager } from "../contract-storage/StorageManager";

export interface CachingStateManagerOpts extends EthersStateManagerOpts {
    storageManager: StorageManager;
}

export class CachingStateManager extends EthersStateManager {

    storageManager: StorageManager;

    constructor(opts: CachingStateManagerOpts) {
        super(opts);
        this.storageManager = opts.storageManager;
    }

    async getContractStorage(address: Address, key: Uint8Array): Promise<Uint8Array> {
        
        // const cacheKey = [
        //     this._blockTag,
        //     address.toString().toLowerCase(),
        //     bytesToHex(unpadBytes(key)),
        // ].join(':');

        // console.log({
        //     method: 'getContractStorage',
        //     blockTag: this._blockTag,
        //     address: address.toString().toLowerCase(),
        //     key,
        //     keyHex: bytesToHex(key),
        //     cacheKey,
        // })
        
        let result : any = await this.storageManager.getStorageSlot({
            address: address.toString(),
            blockNumber: BigInt(this._blockTag),
            storageSlot: bytesToHex(unpadBytes(key)),
        });

        if (result) {
            // console.log({
            //     msg: 'cache HIT!!!',
            //     blockNumber: this._blockTag,
            //     address: address.toString(),
            //     key: bytesToHex(unpadBytes(key)),
            // });
            result = hexToBytes(result);
        } else {
            console.log({
                msg: 'cache miss',
                blockNumber: this._blockTag,
                address: address.toString(),
                key: bytesToHex(unpadBytes(key)),
            })

            result = await super.getContractStorage(address, key);

            await this.storageManager.setStorageSlot({
                address: address.toString(),
                blockNumber: BigInt(this._blockTag),
                storageSlot: bytesToHex(unpadBytes(key)),
                value: bytesToHex(result),
            });
            // await this.redisClient.set(cacheKey, bytesToHex(result));
        }


        return result;
    }
}

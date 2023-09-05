import {
    unpadHex
} from '@ethereumjs/util';

import { Logger, LoggerFactory } from "../utils/LoggerFactory";

/**
 * Encodes/Decodes a Contract Address <> Storage Slot pair for looking up cached
 * data in redis.
 */
export class AddressStorageKeyCodec {

    prefix: string | undefined;
    log: Logger;

    constructor(prefix?: string) {
        this.prefix = prefix;
        this.log = LoggerFactory.build({
            name: AddressStorageKeyCodec.name,
            prefix,
        });
    }

    encodeAsCacheKey(address: string, storageSlot: string): string {
        const parts = [
            address.toLowerCase(),
            unpadHex(storageSlot)
        ];

        if (this.prefix) {
            parts.unshift(this.prefix);
        }

        const cacheKey = parts.join(':');

        return cacheKey;
    }

    decodeCacheKey(cacheKey: string): { address: string; storageSlot: string } {
        // todo: could check string length and split at specific offset to improve performance
        const parts = cacheKey.split(':');

        const [
            prefix,
            addressString,
            keyString
        ] = parts.length === 3
                ? parts
                : [null, ...parts];

        const address = addressString;
        if (!address) {
            throw new Error(`Failed to decode address from cache key (${cacheKey})`);
        }

        const storageSlot = keyString;
        if (!storageSlot) {
            throw new Error(`Failed to decode storageSlot from cache key (${cacheKey})`);
        }

        return {
            address,
            storageSlot
        };
    }
}

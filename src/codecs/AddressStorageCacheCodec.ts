// import {
//     Address,
//     hexToBytes,
//     bytesToHex,
// } from '@ethereumjs/util'

export class AddressStorageCacheCodec {

    // encodeAsCacheKey(address: Address, key: Uint8Array): string {
    encodeAsCacheKey(address: string, key: string): string {
        // const cacheKey = [
        //     address.toString().toLowerCase(),
        //     bytesToHex(key)
        // ].join(':');

        const cacheKey = [
            address.toLowerCase(),
            key
        ].join(':');

        return cacheKey;
    }

    // decodeCacheKey(cacheKey: string): { address: Address; key: Uint8Array } {
    decodeCacheKey(cacheKey: string): { address: string; key: string } {
        // todo: could check string length and split at specific offset to improve performance
        const [
            addressString,
            keyString
        ] = cacheKey.split(':');

        const address = addressString; //Address.fromString(addressString);
        const key = keyString; //hexToBytes(keyString);

        return {
            address,
            key
        };
    }
}
